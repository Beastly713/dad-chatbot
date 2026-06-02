export const ALLOWED_OBJECTIVE_ML_TARGETS = [
  "baseline_relative_elevated_physiological_arousal_evidence",
] as const;

export type AllowedObjectiveMlTarget =
  (typeof ALLOWED_OBJECTIVE_ML_TARGETS)[number];

export const ALLOWED_OBJECTIVE_ML_CLASSES = [
  "low_or_baseline_arousal_evidence",
  "elevated_arousal_evidence",
  "recovery_cooldown",
  "insufficient_reliable_data",
] as const;

export type AllowedObjectiveMlClass =
  (typeof ALLOWED_OBJECTIVE_ML_CLASSES)[number];

export const ALLOWED_OBJECTIVE_INTERPRETATION_LABELS = [
  "low_or_baseline_arousal_evidence",
  "elevated_physiological_arousal_evidence",
  "stress_like_autonomic_activation_evidence",
  "recovery_cooldown_trend",
  "movement_activity_like_confound",
  "signal_quality_limitation",
  "cross_signal_agreement",
  "cross_signal_disagreement",
  "insufficient_reliable_data",
  "ml_unavailable",
  "simulated_data_notice",
] as const;

export type AllowedObjectiveInterpretationLabel =
  (typeof ALLOWED_OBJECTIVE_INTERPRETATION_LABELS)[number];

export const ALLOWED_OBJECTIVE_EVIDENCE_LEVELS = [
  "none_observed",
  "low",
  "moderate",
  "elevated",
  "insufficient_data",
] as const;

export type AllowedObjectiveEvidenceLevel =
  (typeof ALLOWED_OBJECTIVE_EVIDENCE_LEVELS)[number];

export const ALLOWED_OBJECTIVE_CONFIDENCE_LABELS = [
  "low_confidence",
  "moderate_confidence",
  "high_confidence",
  "not_available",
] as const;

export type AllowedObjectiveConfidenceLabel =
  (typeof ALLOWED_OBJECTIVE_CONFIDENCE_LABELS)[number];

export const ALLOWED_OBJECTIVE_SOURCE_TYPES = [
  "simulator",
  "public_dataset_replay",
  "prototype_hardware",
] as const;

export type AllowedObjectiveSourceType =
  (typeof ALLOWED_OBJECTIVE_SOURCE_TYPES)[number];

export const OBJECTIVE_VISIBILITY_DEFAULTS = {
  clinician_visible: true,
  patient_visible: false,
  chatbot_visible: false,
} as const;

export const FORBIDDEN_OBJECTIVE_LABELS = [
  "craving_detected",
  "relapse_risk",
  "withdrawal_risk",
  "intoxication_detected",
  "AUD_severity",
  "emergency_detected",
  "treatment_need",
  "detox_need",
  "medication_need",
  "CIWA_score",
  "sobriety_status",
  "patient_truthfulness",
  "patient_is_lying",
  "patient_is_safe",
  "patient_is_stable",
  "stress_proven",
] as const;

export type ForbiddenObjectiveLabel =
  (typeof FORBIDDEN_OBJECTIVE_LABELS)[number];

export const FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS = [
  "relapse-risk",
  "withdrawal-risk",
  "intoxication",
  "ciwa",
  "craving-detector",
  "lie-detector",
  "patient-truthfulness",
  "sobriety-status",
] as const;

export type ForbiddenObjectiveRouteSegment =
  (typeof FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS)[number];

export const FORBIDDEN_OBJECTIVE_FIELD_NAMES = [
  ...FORBIDDEN_OBJECTIVE_LABELS,
  "relapseRisk",
  "withdrawalRisk",
  "intoxicationDetected",
  "cravingDetected",
  "ciwaScore",
  "audSeverity",
  "treatmentNeed",
  "detoxNeed",
  "medicationNeed",
  "sobrietyStatus",
  "patientTruthfulness",
  "patientIsLying",
  "patientIsSafe",
  "patientIsStable",
  "stressProven",
] as const;

export type ForbiddenObjectiveFieldName =
  (typeof FORBIDDEN_OBJECTIVE_FIELD_NAMES)[number];

export function isAllowedObjectiveMlTarget(
  value: string,
): value is AllowedObjectiveMlTarget {
  return ALLOWED_OBJECTIVE_ML_TARGETS.includes(
    value as AllowedObjectiveMlTarget,
  );
}

export function isAllowedObjectiveMlClass(
  value: string,
): value is AllowedObjectiveMlClass {
  return ALLOWED_OBJECTIVE_ML_CLASSES.includes(
    value as AllowedObjectiveMlClass,
  );
}

export function isAllowedObjectiveInterpretationLabel(
  value: string,
): value is AllowedObjectiveInterpretationLabel {
  return ALLOWED_OBJECTIVE_INTERPRETATION_LABELS.includes(
    value as AllowedObjectiveInterpretationLabel,
  );
}

export function isAllowedObjectiveEvidenceLevel(
  value: string,
): value is AllowedObjectiveEvidenceLevel {
  return ALLOWED_OBJECTIVE_EVIDENCE_LEVELS.includes(
    value as AllowedObjectiveEvidenceLevel,
  );
}

export function isAllowedObjectiveConfidenceLabel(
  value: string,
): value is AllowedObjectiveConfidenceLabel {
  return ALLOWED_OBJECTIVE_CONFIDENCE_LABELS.includes(
    value as AllowedObjectiveConfidenceLabel,
  );
}

export function isAllowedObjectiveSourceType(
  value: string,
): value is AllowedObjectiveSourceType {
  return ALLOWED_OBJECTIVE_SOURCE_TYPES.includes(
    value as AllowedObjectiveSourceType,
  );
}

export function isForbiddenObjectiveLabel(
  value: string,
): value is ForbiddenObjectiveLabel {
  return FORBIDDEN_OBJECTIVE_LABELS.includes(value as ForbiddenObjectiveLabel);
}

export function assertAllowedObjectiveMlTarget(
  value: string,
): AllowedObjectiveMlTarget {
  if (!isAllowedObjectiveMlTarget(value)) {
    throw new Error(`Unsupported objective ML target: ${value}`);
  }

  return value;
}

export function assertAllowedObjectiveInterpretationLabel(
  value: string,
): AllowedObjectiveInterpretationLabel {
  if (!isAllowedObjectiveInterpretationLabel(value)) {
    throw new Error(`Unsupported objective interpretation label: ${value}`);
  }

  return value;
}

export function assertAllowedObjectiveSourceType(
  value: string,
): AllowedObjectiveSourceType {
  if (!isAllowedObjectiveSourceType(value)) {
    throw new Error(`Unsupported objective source type: ${value}`);
  }

  return value;
}
