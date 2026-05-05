import { ALCOHOL_SUBSTANCE_ID } from "./substances/alcohol.js";

export * from "./types.js";

export {
  ALCOHOL_SUBSTANCE_ID,
  alcoholCheckInQuestions,
  alcoholSafetySubflagLabels,
} from "./substances/alcohol.js";

export {
  ALL_CHECKIN_FIELDS,
  buildPendingCheckInRequest,
  getAlcoholCheckInQuestion,
  selectAlcoholCheckInQuestions,
} from "./questions.js";

export {
  CHECKIN_SKIP_SUPPRESSION_MS,
  SUBJECTIVE_STATE_FRESHNESS_MS,
  hasRecentSkip,
  isFreshTimestamp,
  isSubjectiveStateFresh,
} from "./freshness.js";

export {
  answerValueToOrdinalLevel,
  extractSubjectiveEvidence,
  extractSubjectiveEvidenceFromCheckInResponse,
  extractSubjectiveEvidenceFromText,
  mergeSafetySubflags,
  normalizeSkippedFields,
  numberToOrdinalLevel,
} from "./extractor.js";

export {
  appendSubjectiveHistory,
  reduceSubjectiveState,
} from "./reducer.js";

export { planSubjectiveCheckIn } from "./planner.js";

export { deriveResponseControl } from "./controller.js";

export const ACTIVE_SUBSTANCE_IDS = [ALCOHOL_SUBSTANCE_ID] as const;