import type { SubjectiveState } from "./types.js";

export const SUBJECTIVE_STATE_FRESHNESS_MS = 15 * 60 * 1000;
export const CHECKIN_SKIP_SUPPRESSION_MS = 10 * 60 * 1000;

export function isFreshTimestamp(
  isoTimestamp: string | undefined,
  now: Date = new Date(),
  freshnessMs = SUBJECTIVE_STATE_FRESHNESS_MS,
): boolean {
  if (!isoTimestamp) return false;

  const timestamp = Date.parse(isoTimestamp);
  if (Number.isNaN(timestamp)) return false;

  return now.getTime() - timestamp <= freshnessMs;
}

export function isSubjectiveStateFresh(
  state: SubjectiveState,
  now: Date = new Date(),
): boolean {
  return isFreshTimestamp(state.updatedAt, now, SUBJECTIVE_STATE_FRESHNESS_MS);
}

export function hasRecentSkip(
  state: SubjectiveState,
  now: Date = new Date(),
): boolean {
  if (state.skippedFields.length === 0) return false;

  return isFreshTimestamp(
    state.updatedAt,
    now,
    CHECKIN_SKIP_SUPPRESSION_MS,
  );
}