import {
  createDefaultSubjectiveState,
  type CheckInField,
  type SubjectiveEvidence,
  type SubjectiveHistoryEntry,
  type SubjectiveState,
  type SubjectiveUncertaintyLevel,
} from "./types.js";
import { isSubjectiveStateFresh } from "./freshness.js";
import { mergeSafetySubflags } from "./extractor.js";

const MAX_SUBJECTIVE_HISTORY_ENTRIES = 8;

function evidencePriority(evidence: SubjectiveEvidence): number {
  if (evidence.source === "structured_checkin") return 3;
  if (evidence.source === "free_text") return 2;
  if (evidence.source === "carry_forward") return 1;
  return 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueFields(values: CheckInField[]): CheckInField[] {
  return [...new Set(values)];
}

function maxUncertainty(
  current: SubjectiveUncertaintyLevel,
  incoming: SubjectiveUncertaintyLevel,
): SubjectiveUncertaintyLevel {
  const rank: Record<SubjectiveUncertaintyLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return rank[incoming] > rank[current] ? incoming : current;
}

function computeUncertainty(
  evidence: SubjectiveEvidence[],
): {
  level: SubjectiveUncertaintyLevel;
  reasons: string[];
} {
  if (evidence.length === 0) {
    return {
      level: "high",
      reasons: ["no_subjective_evidence"],
    };
  }

  let level: SubjectiveUncertaintyLevel = evidence.some(
    (entry) => entry.source === "structured_checkin",
  )
    ? "low"
    : "medium";

  const reasons = new Set<string>();

  for (const entry of evidence) {
    if (entry.source === "free_text") {
      reasons.add("free_text_only");
    }

    if (entry.uncertainty) {
      level = maxUncertainty(level, entry.uncertainty.level);
      for (const reason of entry.uncertainty.reasons) {
        reasons.add(reason);
      }
    }

    if (entry.skippedFields && entry.skippedFields.length > 0) {
      level = "high";
      reasons.add("checkin_skipped");
    }

    if (entry.vagueAnswer) {
      level = maxUncertainty(level, "medium");
      reasons.add("vague_answer");
    }

    if (entry.contradictionHint) {
      level = "high";
      reasons.add("contradiction_hint");
    }
  }

  if (reasons.size === 0) {
    reasons.add("fresh_subjective_evidence");
  }

  return {
    level,
    reasons: [...reasons],
  };
}

export function reduceSubjectiveState(params: {
  currentState?: SubjectiveState;
  evidence: SubjectiveEvidence[];
  now?: Date;
}): SubjectiveState {
  const now = params.now ?? new Date();
  const currentState = params.currentState ?? createDefaultSubjectiveState();
  const sortedEvidence = [...params.evidence].sort(
    (a, b) => evidencePriority(a) - evidencePriority(b),
  );

  if (sortedEvidence.length === 0) {
    if (isSubjectiveStateFresh(currentState, now)) {
      return currentState;
    }

    return {
      ...currentState,
      uncertainty: {
        level: "high",
        reasons: uniqueStrings([
          ...currentState.uncertainty.reasons,
          "stale_subjective_state",
        ]),
      },
      allowedResponseInfluence: "none",
    };
  }

  let next: SubjectiveState = {
    ...currentState,
    safetySubflags: { ...currentState.safetySubflags },
    triggerContext: [...currentState.triggerContext],
    skippedFields: [...currentState.skippedFields],
    evidenceCount: currentState.evidenceCount + sortedEvidence.length,
    updatedAt: now.toISOString(),
  };

  for (const entry of sortedEvidence) {
    next = {
      ...next,
      safetySubflags: mergeSafetySubflags(
        next.safetySubflags,
        entry.safetySubflags,
      ),
    };

    if (entry.craving) {
      next.cravingLevel = entry.craving.level;
      next.cravingRawValue = entry.craving.rawValue;
    }

    if (entry.distress) {
      next.distressLevel = entry.distress.level;
      next.distressRawValue = entry.distress.rawValue;
    }

    if (entry.copingConfidence) {
      next.copingConfidence = entry.copingConfidence.level;
      next.copingConfidenceRawValue = entry.copingConfidence.rawValue;
    }

    if (entry.supportPreference) {
      next.supportPreference = entry.supportPreference;
    }

    if (entry.recentUseStatus) {
      next.recentUseStatus = entry.recentUseStatus;
    }

    if (entry.alcoholAvailability) {
      next.alcoholAvailability = entry.alcoholAvailability;
    }

    if (entry.socialContext) {
      next.socialContext = entry.socialContext;
    }

    if (entry.triggerContext) {
      next.triggerContext = uniqueStrings([
        ...next.triggerContext,
        ...entry.triggerContext,
      ]);
    }

    if (entry.shameCue !== undefined) {
      next.shameCue = next.shameCue || entry.shameCue;
    }

    if (entry.vagueAnswer !== undefined) {
      next.vagueAnswer = next.vagueAnswer || entry.vagueAnswer;
    }

    if (entry.contradictionHint !== undefined) {
      next.contradictionHint =
        next.contradictionHint || entry.contradictionHint;
    }

    if (entry.skippedFields) {
      next.skippedFields = uniqueFields([
        ...next.skippedFields,
        ...entry.skippedFields,
      ]);
    }
  }

  next.uncertainty = computeUncertainty(sortedEvidence);

  return next;
}

export function appendSubjectiveHistory(params: {
  history: SubjectiveHistoryEntry[];
  state: SubjectiveState;
  evidence: SubjectiveEvidence[];
  now?: Date;
}): SubjectiveHistoryEntry[] {
  const now = params.now ?? new Date();

  const nextEntry: SubjectiveHistoryEntry = {
    id: `subjective-history-${now.getTime()}`,
    state: params.state,
    evidence: params.evidence,
    createdAt: now.toISOString(),
  };

  return [...params.history, nextEntry].slice(-MAX_SUBJECTIVE_HISTORY_ENTRIES);
}