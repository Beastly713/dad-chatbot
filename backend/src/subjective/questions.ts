import type {
  CheckInField,
  CheckInQuestion,
  PendingCheckInRequest,
} from "./types.js";
import { alcoholCheckInQuestions } from "./substances/alcohol.js";

export const ALL_CHECKIN_FIELDS: CheckInField[] = [
  "craving_level",
  "distress_level",
  "coping_confidence",
  "alcohol_availability",
  "support_preference",
  "recent_use_status",
  "social_context",
  "trigger_context",
];

export function getAlcoholCheckInQuestion(
  field: CheckInField,
): CheckInQuestion | undefined {
  return alcoholCheckInQuestions.find((question) => question.field === field);
}

export function selectAlcoholCheckInQuestions(
  fields: CheckInField[],
): CheckInQuestion[] {
  const seen = new Set<CheckInField>();
  const questions: CheckInQuestion[] = [];

  for (const field of fields) {
    if (seen.has(field)) continue;

    const question = getAlcoholCheckInQuestion(field);
    if (!question) continue;

    questions.push(question);
    seen.add(field);
  }

  return questions;
}

export function buildPendingCheckInRequest(params: {
  fields: CheckInField[];
  reason: string;
  now?: Date;
  requestId?: string;
}): PendingCheckInRequest {
  const now = params.now ?? new Date();

  return {
    requestId:
      params.requestId ??
      `phase2-checkin-${now.getTime()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    substance: "alcohol",
    questions: selectAlcoholCheckInQuestions(params.fields),
    reason: params.reason,
    createdAt: now.toISOString(),
  };
}