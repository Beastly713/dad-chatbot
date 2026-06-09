export const OBJECTIVE_INTERPRETATION_VERSION =
  "objective-interpretation-v1" as const;

export const OBJECTIVE_INTERPRETATION_TARGET =
  "baseline_relative_elevated_physiological_arousal_evidence" as const;

export const OBJECTIVE_INTERPRETATION_LABELS = [
  "baseline_or_low_arousal_evidence",
  "elevated_physiological_arousal_evidence",
  "recovery_cooldown_evidence",
  "insufficient_reliable_data",
  "suppressed_for_quality",
  "motion_confounded_evidence",
  "signal_conflict_uncertain"
] as const;

export const OBJECTIVE_EVIDENCE_LEVELS = ["none", "low", "moderate"] as const;

export const OBJECTIVE_CONFIDENCE_LABELS = [
  "insufficient_confidence",
  "low_confidence",
  "moderate_confidence"
] as const;

export const OBJECTIVE_SUPPRESSION_STATES = [
  "not_suppressed",
  "suppressed_low_quality",
  "suppressed_missing_baseline",
  "suppressed_motion_confound",
  "suppressed_signal_conflict",
  "suppressed_missing_data"
] as const;

export type ObjectiveInterpretationLabel =
  (typeof OBJECTIVE_INTERPRETATION_LABELS)[number];

export type ObjectiveEvidenceLevel = (typeof OBJECTIVE_EVIDENCE_LEVELS)[number];

export type ObjectiveConfidenceLabel =
  (typeof OBJECTIVE_CONFIDENCE_LABELS)[number];

export type ObjectiveInterpretationSuppressionState =
  (typeof OBJECTIVE_SUPPRESSION_STATES)[number];

export type ObjectiveInterpretationVisibility = {
  clinician_visible: true;
  patient_visible: false;
  chatbot_visible: false;
};

export type ObjectiveMlClass =
  | "low_or_baseline_arousal_evidence"
  | "elevated_arousal_evidence"
  | "recovery_cooldown"
  | "insufficient_reliable_data";

export type ObjectiveMapperFeatureWindowInput = {
  feature_window_id: string;
  feature_window_key?: string;
  session_id: string;
  segment_id?: string;
  source_type: "simulator" | "public_dataset_replay" | "prototype_hardware";
  window_status: "ready" | "suppressed" | "insufficient_data";
  suppression_state?: string;
  quality: Record<string, unknown>;
  missingness: Record<string, unknown>;
  modality_availability: Record<string, unknown>;
  features: Record<string, unknown>;
  baseline_relative: Record<string, unknown>;
  cross_signal?: Record<string, unknown>;
  uncertainty_reasons: string[];
  visibility?: Partial<ObjectiveInterpretationVisibility>;
};

export type ObjectiveMapperMlInferenceInput = {
  ml_inference_id?: string;
  model_version: string;
  target: typeof OBJECTIVE_INTERPRETATION_TARGET;
  predicted_class: ObjectiveMlClass;
  confidence_label: ObjectiveConfidenceLabel;
  probability: number;
  uncertainty_reasons: string[];
  suppression_state: string;
  visibility?: Partial<ObjectiveInterpretationVisibility>;
};

export type ObjectiveArtifactStateInput = {
  source_banner?:
    | "simulated_data"
    | "public_dataset_replay"
    | "prototype_hardware";
  model_loaded?: boolean;
  model_version?: string;
  preprocessing_version?: string;
  feature_schema_version?: string;
};

export type ObjectiveInterpretationMapperInput = {
  interpretation_id?: string;
  feature_window: ObjectiveMapperFeatureWindowInput;
  ml_inference?: ObjectiveMapperMlInferenceInput;
  artifact_state?: ObjectiveArtifactStateInput;
};

export type ObjectiveInterpretationDecision = {
  interpretation_version: typeof OBJECTIVE_INTERPRETATION_VERSION;
  target: typeof OBJECTIVE_INTERPRETATION_TARGET;
  interpretation_label: ObjectiveInterpretationLabel;
  evidence_level: ObjectiveEvidenceLevel;
  confidence_label: ObjectiveConfidenceLabel;
  suppression_state: ObjectiveInterpretationSuppressionState;
  uncertainty_reasons: string[];
  contributing_modalities: string[];
  excluded_modalities: string[];
  source_banner:
    | "simulated_data"
    | "public_dataset_replay"
    | "prototype_hardware";
  trace: {
    feature_window_id: string;
    feature_window_key?: string;
    ml_inference_id?: string;
    model_version?: string;
    session_id: string;
    segment_id?: string;
  };
  visibility: ObjectiveInterpretationVisibility;
};
