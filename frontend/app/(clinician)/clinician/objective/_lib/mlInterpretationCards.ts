export type ObjectiveDashboardMlTarget =
  "baseline_relative_elevated_physiological_arousal_evidence";

export type ObjectiveDashboardInterpretationLabel =
  | "baseline_or_low_arousal_evidence"
  | "elevated_physiological_arousal_evidence"
  | "recovery_or_cooldown_evidence"
  | "motion_confounded_window"
  | "poor_contact_or_dropout"
  | "signal_conflict"
  | "insufficient_reliable_data"
  | "ml_unavailable";

export type ObjectiveDashboardEvidenceLevel =
  | "none"
  | "low"
  | "moderate"
  | "high";

export type ObjectiveDashboardConfidenceLabel =
  | "low_confidence"
  | "moderate_confidence"
  | "high_confidence"
  | "not_confident";

export type ObjectiveDashboardSuppressionState =
  | "not_suppressed"
  | "suppressed"
  | "downgraded";

export type ObjectiveDashboardModality =
  | "ECG"
  | "GSR"
  | "PPG"
  | "motion"
  | "local temperature";

export type ObjectiveMlInterpretationSummary = {
  mlTarget: ObjectiveDashboardMlTarget;
  interpretationLabel: ObjectiveDashboardInterpretationLabel;
  evidenceLevel: ObjectiveDashboardEvidenceLevel;
  confidenceLabel: ObjectiveDashboardConfidenceLabel;
  modelScore: number | null;
  modelScoreNote: string;
  uncertaintyReasons: string[];
  contributingModalities: ObjectiveDashboardModality[];
  excludedModalities: {
    modality: ObjectiveDashboardModality;
    reason: string;
  }[];
  suppressionState: ObjectiveDashboardSuppressionState;
  scopeNote: string;
  sourceNote: string;
};

export function getObjectiveMlTargetLabel(
  target: ObjectiveDashboardMlTarget,
): string {
  switch (target) {
    case "baseline_relative_elevated_physiological_arousal_evidence":
      return "Baseline-relative elevated physiological arousal evidence";
  }
}

export function getObjectiveInterpretationLabel(
  label: ObjectiveDashboardInterpretationLabel,
): string {
  switch (label) {
    case "baseline_or_low_arousal_evidence":
      return "Baseline or low arousal evidence";
    case "elevated_physiological_arousal_evidence":
      return "Elevated physiological arousal evidence";
    case "recovery_or_cooldown_evidence":
      return "Recovery or cooldown evidence";
    case "motion_confounded_window":
      return "Motion-confounded window";
    case "poor_contact_or_dropout":
      return "Poor contact or dropout";
    case "signal_conflict":
      return "Signal conflict";
    case "insufficient_reliable_data":
      return "Insufficient reliable data";
    case "ml_unavailable":
      return "ML unavailable";
  }
}

export function getObjectiveEvidenceLevelLabel(
  level: ObjectiveDashboardEvidenceLevel,
): string {
  switch (level) {
    case "none":
      return "No usable evidence";
    case "low":
      return "Low evidence";
    case "moderate":
      return "Moderate evidence";
    case "high":
      return "High evidence";
  }
}

export function getObjectiveConfidenceLabel(
  confidence: ObjectiveDashboardConfidenceLabel,
): string {
  switch (confidence) {
    case "low_confidence":
      return "Low confidence";
    case "moderate_confidence":
      return "Moderate confidence";
    case "high_confidence":
      return "High confidence";
    case "not_confident":
      return "Not confident";
  }
}

export function getObjectiveSuppressionStateLabel(
  state: ObjectiveDashboardSuppressionState,
): string {
  switch (state) {
    case "not_suppressed":
      return "Not suppressed";
    case "suppressed":
      return "Suppressed";
    case "downgraded":
      return "Downgraded";
  }
}

export function formatObjectiveModelScore(score: number | null): string {
  if (score === null) {
    return "Unavailable";
  }

  if (!Number.isFinite(score)) {
    return "Unavailable";
  }

  const clamped = Math.min(1, Math.max(0, score));
  return `${Math.round(clamped * 100)}% model score`;
}

export function createObjectiveDemoMlInterpretationSummary(): ObjectiveMlInterpretationSummary {
  return {
    mlTarget: "baseline_relative_elevated_physiological_arousal_evidence",
    interpretationLabel: "elevated_physiological_arousal_evidence",
    evidenceLevel: "moderate",
    confidenceLabel: "moderate_confidence",
    modelScore: 0.62,
    modelScoreNote:
      "The model score is one bounded input. It does not override quality, baseline, motion, conflict, or uncertainty checks.",
    uncertaintyReasons: [
      "Baseline context is still limited in this demo shell.",
      "Motion context can reduce confidence in short windows.",
      "PPG is treated as secondary waveform context.",
    ],
    contributingModalities: ["ECG", "GSR", "motion"],
    excludedModalities: [
      {
        modality: "PPG",
        reason: "Optical waveform quality is limited in this example window.",
      },
      {
        modality: "local temperature",
        reason: "Local trend is available as contact context only.",
      },
    ],
    suppressionState: "not_suppressed",
    scopeNote:
      "This card is clinician-only and non-diagnostic. It summarizes source-bound physiological evidence and uncertainty.",
    sourceNote:
      "Demo values are static dashboard scaffolding until live clinician-safe stream data is connected in a later commit.",
  };
}
