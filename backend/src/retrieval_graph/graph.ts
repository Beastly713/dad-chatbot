import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph";
import { buildKbFilterForPolicy } from "../kb/filters.js";
import { finalGuard } from "../safety/finalGuard.js";
import { getPolicyForCategory } from "../safety/policies.js";
import { getTemplate } from "../safety/templates.js";
import type {
  RiskCategory,
  SafetyDebugLog,
  TriageResult,
} from "../safety/types.js";
import {
  categoryFromSafetySubflags,
  triageMessage,
  triageMessageWithSubjectiveContext,
} from "../safety/triage.js";
import { detectSafetySubflags } from "../safety/subflags.js";
import { makeRetriever } from "../shared/retrieval.js";
import {
  AgentConfigurationAnnotation,
  ensureAgentConfiguration,
} from "./configuration.js";
import { AgentStateAnnotation } from "./state.js";
import { buildSafeResponsePrompt } from "./prompts.js";
import { formatDocs } from "./utils.js";
import { loadChatModel } from "../shared/utils.js";
import { buildSubjectiveStateSummary } from "./stateSummary.js";
import {
  appendSubjectiveHistory,
  buildPendingCheckInRequest,
  deriveResponseControl,
  extractSubjectiveEvidence,
  mergeSafetySubflags,
  planSubjectiveCheckIn,
  reduceSubjectiveState,
} from "../subjective/index.js";
import { createDefaultSafetySubflags } from "../subjective/types.js";

type PolicyRoute = "templateResponder" | "subjectiveStateExtractor";
type SubjectiveSafetyRoute =
  | "subjectiveSafetyEscalation"
  | "subjectiveStateReducer";
type CheckInRoute = "checkInRequestBuilder" | "subjectivePolicyController";

const SAFE_SUPPORT_CATEGORIES: RiskCategory[] = [
  "alcohol_craving",
  "lapse_or_relapse",
  "general_support",
];

function isSafeSupportCategory(category: RiskCategory | undefined): boolean {
  return !!category && SAFE_SUPPORT_CATEGORIES.includes(category);
}

function buildTriageForCategory(
  category: RiskCategory,
  matchedRules: string[],
): TriageResult {
  const policy = getPolicyForCategory(category);

  return {
    category,
    confidence: matchedRules.length > 0 ? 1 : 0.6,
    matchedRules,
    needsTemplate: policy.useTemplateOnly,
    allowRAG: policy.allowRAG,
  };
}

function getFallbackRetrievalQuery(category: RiskCategory): string {
  if (category === "alcohol_craving") {
    return "alcohol craving urge delay grounding coping support";
  }

  if (category === "lapse_or_relapse") {
    return "alcohol lapse relapse nonjudgmental reset next safe step";
  }

  return "alcohol recovery support stress coping cravings are temporary";
}

async function inputTriage(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const query = state.query ?? "";

  /**
   * A structured check-in response can introduce a red flag.
   * It may escalate upward, but never downgrade danger.
   */
  if (query.trim().length > 0) {
    const triage = triageMessageWithSubjectiveContext(
      query,
      state.checkInResponse,
    );

    return {
      triage,
      safetyCategory: triage.category,
    };
  }

  /**
   * Resume path for submitted/skipped check-ins.
   *
   * The frontend API update arrives in Commit 5. This makes the graph ready for:
   * { query: "", checkInResponse: ... }
   *
   * If the structured answer has a red flag, triageMessageWithSubjectiveContext
   * already escalates it. Otherwise, resume the previous safe-support category
   * from thread state if available.
   */
  if (state.checkInResponse) {
    const triage = triageMessageWithSubjectiveContext("", state.checkInResponse);

    if (!isSafeSupportCategory(triage.category)) {
      return {
        triage,
        safetyCategory: triage.category,
      };
    }

    const resumedCategory = isSafeSupportCategory(state.safetyCategory)
      ? state.safetyCategory
      : "general_support";

    const resumedTriage = buildTriageForCategory(resumedCategory, [
      "structured_checkin_resume",
    ]);

    return {
      triage: resumedTriage,
      safetyCategory: resumedCategory,
    };
  }

  const triage = triageMessage(query);

  return {
    triage,
    safetyCategory: triage.category,
  };
}

async function policySelector(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const policy = getPolicyForCategory(state.safetyCategory);

  return {
    responseMode: policy.mode,
  };
}

async function routeByPolicy(
  state: typeof AgentStateAnnotation.State,
): Promise<PolicyRoute> {
  const policy = getPolicyForCategory(state.safetyCategory);

  if (policy.useTemplateOnly || !policy.allowRAG) {
    return "templateResponder";
  }

  return "subjectiveStateExtractor";
}

/**
 * Template-only paths must bypass subjective check-ins, retriever, and LLM.
 */
async function templateResponder(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const policy = getPolicyForCategory(state.safetyCategory);
  const text = getTemplate(policy.templateId ?? "fallback_safe");

  return {
    draftResponse: text,
    finalResponse: text,
    pendingCheckInRequest: null,
    uiAction: null,
    needsCheckIn: false,
    documents: "delete",
  };
}

/**
 * Phase 2 deterministic subjective extraction.
 *
 * This node runs only after policy selection has confirmed a safe-support
 * category. It does not call the LLM or retriever.
 */
async function subjectiveStateExtractor(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const evidence = extractSubjectiveEvidence({
    query: state.query,
    checkInResponse: state.checkInResponse,
  });

  const querySubflags = detectSafetySubflags(state.query);
  const checkInSubflags = detectSafetySubflags(state.checkInResponse);

  const safetySubflags = mergeSafetySubflags(
    mergeSafetySubflags(createDefaultSafetySubflags(), querySubflags),
    checkInSubflags,
  );

  const evidenceWithSubflags =
    evidence.length > 0
      ? evidence.map((entry, index) =>
          index === evidence.length - 1
            ? {
                ...entry,
                safetySubflags,
              }
            : entry,
        )
      : [
          {
            source: "default" as const,
            substance: "alcohol" as const,
            observedAt: new Date().toISOString(),
            safetySubflags,
            uncertainty: {
              level: "high" as const,
              reasons: ["no_subjective_evidence"],
            },
          },
        ];

  return {
    subjectiveEvidenceDraft: evidenceWithSubflags,
    safetySubflags,
  };
}

/**
 * Extra safety route after subjective extraction.
 *
 * In normal cases, Commit 3's triage helper catches structured red flags
 * before this branch. This secondary route is defensive: if any subjective
 * safety subflag appears here, normal personalization stops.
 */
async function routeBySubjectiveSafety(
  state: typeof AgentStateAnnotation.State,
): Promise<SubjectiveSafetyRoute> {
  const escalatedCategory = categoryFromSafetySubflags(state.safetySubflags);

  if (escalatedCategory) {
    return "subjectiveSafetyEscalation";
  }

  return "subjectiveStateReducer";
}

async function subjectiveSafetyEscalation(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const escalatedCategory =
    categoryFromSafetySubflags(state.safetySubflags) ?? state.safetyCategory;
  const policy = getPolicyForCategory(escalatedCategory);

  return {
    safetyCategory: escalatedCategory,
    responseMode: policy.mode,
    triage: buildTriageForCategory(escalatedCategory, [
      "subjective_safety_subflag",
    ]),
    pendingCheckInRequest: null,
    uiAction: null,
    needsCheckIn: false,
  };
}

async function subjectiveStateReducer(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const subjectiveState = reduceSubjectiveState({
    currentState: state.subjectiveState,
    evidence: state.subjectiveEvidenceDraft,
  });

  const subjectiveHistory = appendSubjectiveHistory({
    history: state.subjectiveHistory ?? [],
    state: subjectiveState,
    evidence: state.subjectiveEvidenceDraft,
  });

  return {
    subjectiveState,
    subjectiveHistory,
    safetySubflags: subjectiveState.safetySubflags,
  };
}

async function subjectiveCheckInPlanner(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const checkInPlan = planSubjectiveCheckIn({
    safetyCategory: state.safetyCategory,
    subjectiveState: state.subjectiveState,
  });

  return {
    checkInPlan,
    needsCheckIn:
      checkInPlan.action === "ask_checkin" && checkInPlan.questions.length > 0,
  };
}

async function routeByCheckInPlan(
  state: typeof AgentStateAnnotation.State,
): Promise<CheckInRoute> {
  /**
   * Do not ask another check-in immediately on a check-in submission turn.
   * After submit/skip, continue to safe support.
   */
  if (state.checkInResponse) {
    return "subjectivePolicyController";
  }

  if (state.needsCheckIn) {
    return "checkInRequestBuilder";
  }

  return "subjectivePolicyController";
}

async function checkInRequestBuilder(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const fields =
    state.checkInPlan?.questions.map((question) => question.field) ?? [];

  const pendingCheckInRequest = buildPendingCheckInRequest({
    fields,
    reason: state.checkInPlan?.reason ?? "safe_support_personalization",
  });

  const draftResponse =
    "If you want, a very quick check-in can help me tailor this. You can also skip it.";

  return {
    draftResponse,
    pendingCheckInRequest,
    uiAction: {
      type: "subjective_checkin",
      request: pendingCheckInRequest,
    },
    needsCheckIn: true,
    documents: "delete",
  };
}

async function subjectivePolicyController(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const responseControl = deriveResponseControl(state.subjectiveState);

  return {
    responseControl,
    pendingCheckInRequest: null,
    uiAction: null,
    needsCheckIn: false,
  };
}

/**
 * Safe support categories retrieve only approved internal alcohol KB documents.
 */
async function retrieveDocuments(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const policy = getPolicyForCategory(state.safetyCategory);
  const kbFilter = buildKbFilterForPolicy(policy);

  const mergedConfig: RunnableConfig = {
    ...(config ?? {}),
    configurable: {
      ...((config?.configurable ?? {}) as Record<string, unknown>),
      filterKwargs: kbFilter ?? {},
      k: 4,
    },
  };

  const retriever = await makeRetriever(mergedConfig);

  const retrievalQuery =
    state.query && state.query.trim().length > 0
      ? state.query
      : getFallbackRetrievalQuery(state.safetyCategory);

  const documents = await retriever.invoke(retrievalQuery);

  return { documents };
}

/**
 * LLM generation is used only after KB retrieval for safe support categories.
 * The output is still only a draft until finalGuard runs.
 */
async function generateSafeResponse(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const configuration = ensureAgentConfiguration(config);
  const model = await loadChatModel(configuration.queryModel);
  const policy = getPolicyForCategory(state.safetyCategory);
  const context = formatDocs(state.documents);

  const queryForPrompt =
    state.query && state.query.trim().length > 0
      ? state.query
      : "The user submitted or skipped the optional check-in. Continue with safe alcohol-support based on the available context.";

  const subjectiveStateSummary = buildSubjectiveStateSummary({
    subjectiveState: state.subjectiveState,
    responseControl: state.responseControl,
  });

  const prompt = buildSafeResponsePrompt({
    query: queryForPrompt,
    context,
    mode: policy.mode,
    maxWords: state.responseControl?.maxWordsOverride ?? policy.maxWords,
    subjectiveStateSummary,
    responseControl: state.responseControl,
  });

  const response = await model.invoke(prompt);
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return {
    draftResponse: content,
  };
}

/**
 * Every path, including fixed templates and check-in prompts, passes through
 * the final guard. Only the guarded final answer is added to message history.
 */
async function finalSafetyGuardNode(
  state: typeof AgentStateAnnotation.State,
  config?: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const policy = getPolicyForCategory(state.safetyCategory);
  const draft = state.draftResponse || state.finalResponse || "";

  const guard = finalGuard({
    draft,
    category: state.safetyCategory,
  });

  const isTemplatePath = policy.useTemplateOnly || !policy.allowRAG;
  const isCheckInPrompt = state.uiAction?.type === "subjective_checkin";
  const path = isTemplatePath || isCheckInPrompt ? "template" : "rag";

  const debugLog: SafetyDebugLog = {
    timestamp: new Date().toISOString(),
    threadId: config?.configurable?.thread_id as string | undefined,
    category: state.safetyCategory,
    responseMode: policy.mode,
    path,
    retrievedDocCount: state.documents?.length ?? 0,
    templateId: policy.templateId,
    guardAction: guard.action,
    triggeredRules: guard.triggeredRules,
    safetySubflags: state.safetySubflags,
    subjectiveUncertainty: state.subjectiveState?.uncertainty?.level,
    checkInRequested: isCheckInPrompt,
  };

  console.info("safety_debug", debugLog);

  const humanMessageContent =
    state.query && state.query.trim().length > 0
      ? state.query
      : state.checkInResponse
        ? "[structured check-in response]"
        : "";

  return {
    guard,
    finalResponse: guard.finalText,
    messages: [
      new HumanMessage(humanMessageContent),
      new AIMessage(guard.finalText),
    ],
  };
}

const builder = new StateGraph(
  AgentStateAnnotation,
  AgentConfigurationAnnotation,
)
  .addNode("inputTriage", inputTriage)
  .addNode("policySelector", policySelector)
  .addNode("templateResponder", templateResponder)
  .addNode("subjectiveStateExtractor", subjectiveStateExtractor)
  .addNode("subjectiveSafetyEscalation", subjectiveSafetyEscalation)
  .addNode("subjectiveStateReducer", subjectiveStateReducer)
  .addNode("subjectiveCheckInPlanner", subjectiveCheckInPlanner)
  .addNode("checkInRequestBuilder", checkInRequestBuilder)
  .addNode("subjectivePolicyController", subjectivePolicyController)
  .addNode("retrieveDocuments", retrieveDocuments)
  .addNode("generateSafeResponse", generateSafeResponse)
  .addNode("finalSafetyGuard", finalSafetyGuardNode)
  .addEdge(START, "inputTriage")
  .addEdge("inputTriage", "policySelector")
  .addConditionalEdges("policySelector", routeByPolicy, [
    "templateResponder",
    "subjectiveStateExtractor",
  ])
  .addEdge("templateResponder", "finalSafetyGuard")
  .addConditionalEdges("subjectiveStateExtractor", routeBySubjectiveSafety, [
    "subjectiveSafetyEscalation",
    "subjectiveStateReducer",
  ])
  .addEdge("subjectiveSafetyEscalation", "templateResponder")
  .addEdge("subjectiveStateReducer", "subjectiveCheckInPlanner")
  .addConditionalEdges("subjectiveCheckInPlanner", routeByCheckInPlan, [
    "checkInRequestBuilder",
    "subjectivePolicyController",
  ])
  .addEdge("checkInRequestBuilder", "finalSafetyGuard")
  .addEdge("subjectivePolicyController", "retrieveDocuments")
  .addEdge("retrieveDocuments", "generateSafeResponse")
  .addEdge("generateSafeResponse", "finalSafetyGuard")
  .addEdge("finalSafetyGuard", END);

export const graph = builder.compile().withConfig({
  runName: "Phase2AlcoholSupportGraph",
});