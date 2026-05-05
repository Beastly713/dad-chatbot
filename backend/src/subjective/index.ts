import { ALCOHOL_SUBSTANCE_ID } from "./substances/alcohol.js";

export * from "./types.js";

export {
  ALCOHOL_SUBSTANCE_ID,
  alcoholCheckInQuestions,
  alcoholSafetySubflagLabels,
} from "./substances/alcohol.js";

export const ACTIVE_SUBSTANCE_IDS = [ALCOHOL_SUBSTANCE_ID] as const;