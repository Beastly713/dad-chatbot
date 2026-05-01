import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph";
import { buildKbFilterForPolicy } from "../kb/filters.js";
import { finalGuard } from "../safety/finalGuard.js";
import { getPolicyForCategory } from "../safety/policies.js";
import { getTemplate } from "../safety/templates.js";
import type { SafetyDebugLog } from "../safety/types.js";
import { triageMessage } from "../safety/triage.js";
import { makeRetriever } from "../shared/retrieval.js";
import {
  AgentConfigurationAnnotation,
  ensureAgentConfiguration,
} from "./configuration.js";
import { AgentStateAnnotation } from "./state.js";
import { buildSafeResponsePrompt } from "./prompts.js";
import { formatDocs } from "./utils.js";
import { loadChatModel } from "../shared/utils.js";

type GraphRoute = "templateResponder" | "retrieveDocuments";

async function inputTriage(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const triage = triageMessage(state.query);

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
): Promise<GraphRoute> {
  const policy = getPolicyForCategory(state.safetyCategory);

  if (policy.useTemplateOnly || !policy.allowRAG) {
    return "templateResponder";
  }

  return "retrieveDocuments";
}

/**
 * Template-only paths must bypass both the retriever and the LLM.
 */
async function templateResponder(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  const policy = getPolicyForCategory(state.safetyCategory);
  const text = getTemplate(policy.templateId ?? "fallback_safe");

  return {
    draftResponse: text,
    finalResponse: text,
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
  const documents = await retriever.invoke(state.query);

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

  const prompt = buildSafeResponsePrompt({
    query: state.query,
    context,
    mode: policy.mode,
    maxWords: policy.maxWords,
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
 * Every path, including fixed templates, passes through the final guard.
 * Only the guarded final answer is added to message history.
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

  const path = policy.useTemplateOnly || !policy.allowRAG ? "template" : "rag";

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
  };

  console.info("safety_debug", debugLog);

  return {
    guard,
    finalResponse: guard.finalText,
    messages: [new HumanMessage(state.query), new AIMessage(guard.finalText)],
  };
}

const builder = new StateGraph(
  AgentStateAnnotation,
  AgentConfigurationAnnotation,
)
  .addNode("inputTriage", inputTriage)
  .addNode("policySelector", policySelector)
  .addNode("templateResponder", templateResponder)
  .addNode("retrieveDocuments", retrieveDocuments)
  .addNode("generateSafeResponse", generateSafeResponse)
  .addNode("finalSafetyGuard", finalSafetyGuardNode)
  .addEdge(START, "inputTriage")
  .addEdge("inputTriage", "policySelector")
  .addConditionalEdges("policySelector", routeByPolicy, [
    "templateResponder",
    "retrieveDocuments",
  ])
  .addEdge("templateResponder", "finalSafetyGuard")
  .addEdge("retrieveDocuments", "generateSafeResponse")
  .addEdge("generateSafeResponse", "finalSafetyGuard")
  .addEdge("finalSafetyGuard", END);

export const graph = builder.compile().withConfig({
  runName: "Phase1AlcoholSupportGraph",
});