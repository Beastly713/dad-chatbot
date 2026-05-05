import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { reduceDocs } from "../shared/state.js";
import type {
  CheckInPlan,
  CheckInResponsePayload,
  PendingCheckInRequest,
  ResponseControl,
  SafetySubflags,
  SubjectiveEvidence,
  SubjectiveHistoryEntry,
  SubjectiveState,
  UIAction,
} from "../subjective/types.js";
import type {
  GuardResult,
  ResponseMode,
  RiskCategory,
  TriageResult,
} from "../safety/types.js";
import {
  createDefaultResponseControl,
  createDefaultSafetySubflags,
  createDefaultSubjectiveState,
} from "../subjective/types.js";

function replaceValue<T>(_current: T, update: T): T {
  return update;
}

/**
 * Represents the state of the alcohol-support retrieval graph.
 *
 * Phase 1 fields preserve deterministic triage, policy selection, either
 * template-only response or approved KB retrieval, and final guard.
 *
 * Phase 2 subjective fields are added with safe defaults but are not wired
 * into runtime graph behavior in Commit 1.
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
   * Phase 2 subjective check-in state.
   */
  subjectiveState: Annotation<SubjectiveState>({
    value: replaceValue,
    default: createDefaultSubjectiveState,
  }),

  subjectiveEvidenceDraft: Annotation<SubjectiveEvidence[]>({
    value: replaceValue,
    default: () => [],
  }),

  checkInPlan: Annotation<CheckInPlan | null>({
    value: replaceValue,
    default: () => null,
  }),

  needsCheckIn: Annotation<boolean>({
    value: replaceValue,
    default: () => false,
  }),

  subjectiveHistory: Annotation<SubjectiveHistoryEntry[]>({
    value: replaceValue,
    default: () => [],
  }),

  pendingCheckInRequest: Annotation<PendingCheckInRequest | null>({
    value: replaceValue,
    default: () => null,
  }),

  checkInResponse: Annotation<CheckInResponsePayload | null>({
    value: replaceValue,
    default: () => null,
  }),

  responseControl: Annotation<ResponseControl>({
    value: replaceValue,
    default: createDefaultResponseControl,
  }),

  safetySubflags: Annotation<SafetySubflags>({
    value: replaceValue,
    default: createDefaultSafetySubflags,
  }),

  uiAction: Annotation<UIAction>({
    value: replaceValue,
    default: () => null,
  }),

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