import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { reduceDocs } from "../shared/state.js";
import type {
  GuardResult,
  ResponseMode,
  RiskCategory,
  TriageResult,
} from "../safety/types.js";

/**
 * Represents the state of the Phase 1 alcohol-support retrieval graph.
 *
 * All user messages pass through deterministic triage, policy selection,
 * either template-only response or approved KB retrieval, and final guard.
 */
export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>(),

  ...MessagesAnnotation.spec,

  safetyCategory: Annotation<RiskCategory>(),
  responseMode: Annotation<ResponseMode>(),
  triage: Annotation<TriageResult>(),

  draftResponse: Annotation<string>(),
  finalResponse: Annotation<string>(),
  guard: Annotation<GuardResult>(),

  /**
   * Populated only for safe support categories that allow RAG.
   */
  documents: Annotation<
    Document[],
    Document[] | { [key: string]: any }[] | string[] | string | "delete"
  >({
    default: () => [],
    // @ts-ignore
    reducer: reduceDocs,
  }),
});