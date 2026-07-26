import {
  OBJECTIVE_CONFIDENCE_LABELS,
  OBJECTIVE_EVIDENCE_LEVELS,
  OBJECTIVE_INTERPRETATION_LABELS,
  OBJECTIVE_INTERPRETATION_TARGET,
  OBJECTIVE_INTERPRETATION_VERSION,
  OBJECTIVE_SUPPRESSION_STATES,
  type ObjectiveArtifactStateInput,
  type ObjectiveConfidenceLabel,
  type ObjectiveEvidenceLevel,
  type ObjectiveInterpretationDecision,
  type ObjectiveInterpretationLabel,
  type ObjectiveInterpretationMapperInput,
  type ObjectiveInterpretationSuppressionState,
  type ObjectiveInterpretationVisibility,
  type ObjectiveMapperFeatureWindowInput,
  type ObjectiveMapperMlInferenceInput
} from "./types.js";

function clinicianOnlyVisibility(): ObjectiveInterpretationVisibility {
  return {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false
  };
}

function assertNonEmptyString(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function assertClinicianOnlyVisibility(
  visibility: Partial<ObjectiveInterpretationVisibility> | undefined,
  name: string
): ObjectiveInterpretationVisibility {
  if (
    visibility?.clinician_visible !== undefined &&
    visibility.clinician_visible !== true
  ) {
    throw new Error(`${name} clinician_visible must remain true`);
  }

  if (
    visibility?.patient_visible !== undefined &&
    visibility.patient_visible !== false
  ) {
    throw new Error(`${name} patient_visible must remain false`);
  }

  if (
    visibility?.chatbot_visible !== undefined &&
    visibility.chatbot_visible !== false
  ) {
    throw new Error(`${name} chatbot_visible must remain false`);
  }

  return clinicianOnlyVisibility();
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nestedNumber(
  value: Record<string, unknown>,
  ...path: string[]
): number | null {
  let current: unknown = value;

  for (const key of path) {
    current = asObject(current)[key];
  }

  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function nestedBoolean(
  value: Record<string, unknown>,
  ...path: string[]
): boolean {
  let current: unknown = value;

  for (const key of path) {
    current = asObject(current)[key];
  }

  return current === true;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function confidenceRank(label: ObjectiveConfidenceLabel): number {
  return {
    insufficient_confidence: 0,
    low_confidence: 1,
    moderate_confidence: 2
  }[label];
}

function minConfidence(
  left: ObjectiveConfidenceLabel,
  right: ObjectiveConfidenceLabel
): ObjectiveConfidenceLabel {
  return confidenceRank(left) <= confidenceRank(right) ? left : right;
}

function evidenceRank(level: ObjectiveEvidenceLevel): number {
  return {
    none: 0,
    low: 1,
    moderate: 2
  }[level];
}

function minEvidence(
  left: ObjectiveEvidenceLevel,
  right: ObjectiveEvidenceLevel
): ObjectiveEvidenceLevel {
  return evidenceRank(left) <= evidenceRank(right) ? left : right;
}

function clampAllowedConfidence(
  label: string | undefined
): ObjectiveConfidenceLabel {
  return OBJECTIVE_CONFIDENCE_LABELS.includes(label as ObjectiveConfidenceLabel)
    ? (label as ObjectiveConfidenceLabel)
    : "insufficient_confidence";
}

function clampAllowedSuppression(
  state: string | undefined
): ObjectiveInterpretationSuppressionState {
  return OBJECTIVE_SUPPRESSION_STATES.includes(
    state as ObjectiveInterpretationSuppressionState
  )
    ? (state as ObjectiveInterpretationSuppressionState)
    : "suppressed_missing_data";
}

function validateMlInput(
  ml: ObjectiveMapperMlInferenceInput
): ObjectiveMapperMlInferenceInput {
  if (ml.target !== OBJECTIVE_INTERPRETATION_TARGET) {
    throw new Error("ML inference target is not allowed");
  }

  if (
    ml.probability < 0 ||
    ml.probability > 1 ||
    !Number.isFinite(ml.probability)
  ) {
    throw new Error("ML inference probability must be between 0 and 1");
  }

  assertNonEmptyString(ml.model_version, "model_version");
  assertClinicianOnlyVisibility(ml.visibility, "ML inference visibility");

  return ml;
}

function baselineState(featureWindow: ObjectiveMapperFeatureWindowInput): string {
  const state = featureWindow.baseline_relative.baseline_state;

  return typeof state === "string" ? state : "unavailable";
}

function signalConflictScore(
  featureWindow: ObjectiveMapperFeatureWindowInput
): number {
  return nestedNumber(featureWindow.cross_signal ?? {}, "signal_conflict_score") ?? 0;
}

function highMotionConfound(
  featureWindow: ObjectiveMapperFeatureWindowInput
): boolean {
  return nestedBoolean(
    featureWindow.cross_signal ?? {},
    "high_motion_confound_present"
  );
}

function modalitySuppressed(
  featureWindow: ObjectiveMapperFeatureWindowInput,
  modality: string
): boolean {
  return nestedBoolean(featureWindow.features, modality, "suppression", "suppressed");
}

function qualityLow(featureWindow: ObjectiveMapperFeatureWindowInput): boolean {
  return (
    modalitySuppressed(featureWindow, "ecg") ||
    modalitySuppressed(featureWindow, "gsr") ||
    featureWindow.window_status !== "ready"
  );
}

function sourceBanner(
  featureWindow: ObjectiveMapperFeatureWindowInput,
  artifactState: ObjectiveArtifactStateInput | undefined
): ObjectiveInterpretationDecision["source_banner"] {
  if (artifactState?.source_banner) {
    return artifactState.source_banner;
  }

  return featureWindow.source_type === "simulator"
    ? "simulated_data"
    : featureWindow.source_type;
}

function baseLabelFromMl(
  ml: ObjectiveMapperMlInferenceInput | undefined
): ObjectiveInterpretationLabel {
  if (!ml) {
    return "insufficient_reliable_data";
  }

  if (ml.predicted_class === "elevated_arousal_evidence") {
    return "elevated_physiological_arousal_evidence";
  }

  if (ml.predicted_class === "recovery_cooldown") {
    return "recovery_cooldown_evidence";
  }

  if (ml.predicted_class === "low_or_baseline_arousal_evidence") {
    return "baseline_or_low_arousal_evidence";
  }

  return "insufficient_reliable_data";
}

function evidenceFromMl(
  ml: ObjectiveMapperMlInferenceInput | undefined
): ObjectiveEvidenceLevel {
  if (!ml || ml.predicted_class === "insufficient_reliable_data") {
    return "none";
  }

  if (ml.probability >= 0.65) {
    return "moderate";
  }

  return "low";
}

function confidenceFromInputs(
  ml: ObjectiveMapperMlInferenceInput | undefined,
  featureWindow: ObjectiveMapperFeatureWindowInput
): ObjectiveConfidenceLabel {
  let confidence = clampAllowedConfidence(ml?.confidence_label);

  if (!ml) {
    return "insufficient_confidence";
  }

  if (ml.probability < 0.65) {
    confidence = minConfidence(confidence, "low_confidence");
  }

  if (baselineState(featureWindow) !== "available") {
    confidence = minConfidence(confidence, "low_confidence");
  }

  if (qualityLow(featureWindow)) {
    confidence = minConfidence(confidence, "insufficient_confidence");
  }

  if (signalConflictScore(featureWindow) >= 0.5 || highMotionConfound(featureWindow)) {
    confidence = minConfidence(confidence, "insufficient_confidence");
  }

  return confidence;
}

function suppressionFromInputs(
  ml: ObjectiveMapperMlInferenceInput | undefined,
  featureWindow: ObjectiveMapperFeatureWindowInput
): ObjectiveInterpretationSuppressionState {
  if (featureWindow.window_status === "insufficient_data") {
    return "suppressed_missing_data";
  }

  if (!ml) {
    return "suppressed_missing_data";
  }

  if (baselineState(featureWindow) !== "available") {
    return "suppressed_missing_baseline";
  }

  if (qualityLow(featureWindow)) {
    return "suppressed_low_quality";
  }

  if (highMotionConfound(featureWindow)) {
    return "suppressed_motion_confound";
  }

  if (signalConflictScore(featureWindow) >= 0.5) {
    return "suppressed_signal_conflict";
  }

  if (ml.predicted_class === "insufficient_reliable_data") {
    return clampAllowedSuppression(ml.suppression_state);
  }

  return "not_suppressed";
}

function labelAfterSuppression(
  label: ObjectiveInterpretationLabel,
  suppressionState: ObjectiveInterpretationSuppressionState,
  featureWindow: ObjectiveMapperFeatureWindowInput
): ObjectiveInterpretationLabel {
  if (suppressionState === "suppressed_motion_confound") {
    return "motion_confounded_evidence";
  }

  if (suppressionState === "suppressed_signal_conflict") {
    return "signal_conflict_uncertain";
  }

  if (suppressionState !== "not_suppressed") {
    return suppressionState === "suppressed_low_quality"
      ? "suppressed_for_quality"
      : "insufficient_reliable_data";
  }

  if (
    label === "elevated_physiological_arousal_evidence" &&
    highMotionConfound(featureWindow)
  ) {
    return "motion_confounded_evidence";
  }

  return label;
}

function contributingModalities(
  featureWindow: ObjectiveMapperFeatureWindowInput
): string[] {
  return ["ecg", "gsr", "ppg", "imu", "temperature"].filter((modality) => {
    const feature = featureWindow.features[modality];

    return (
      typeof feature === "object" &&
      feature !== null &&
      !modalitySuppressed(featureWindow, modality)
    );
  });
}

function excludedModalities(
  featureWindow: ObjectiveMapperFeatureWindowInput
): string[] {
  return ["ecg", "gsr", "ppg", "imu", "temperature"].filter((modality) =>
    modalitySuppressed(featureWindow, modality)
  );
}

function mapperUncertaintyReasons(
  featureWindow: ObjectiveMapperFeatureWindowInput,
  ml: ObjectiveMapperMlInferenceInput | undefined,
  artifactState: ObjectiveArtifactStateInput | undefined,
  suppressionState: ObjectiveInterpretationSuppressionState
): string[] {
  return uniqueStrings([
    ...featureWindow.uncertainty_reasons,
    ...(ml?.uncertainty_reasons ?? []),
    ...(baselineState(featureWindow) !== "available"
      ? ["baseline_not_available"]
      : []),
    ...(signalConflictScore(featureWindow) >= 0.5
      ? ["signal_conflict_high"]
      : []),
    ...(highMotionConfound(featureWindow) ? ["motion_confound_present"] : []),
    ...(qualityLow(featureWindow) ? ["low_or_insufficient_signal_quality"] : []),
    ...(!ml ? ["ml_inference_unavailable"] : []),
    ...(artifactState?.model_loaded === false ? ["model_artifact_unavailable"] : []),
    ...(suppressionState !== "not_suppressed" ? [suppressionState] : [])
  ]);
}

function assertAllowedOutputLabel(
  label: ObjectiveInterpretationLabel
): ObjectiveInterpretationLabel {
  if (!OBJECTIVE_INTERPRETATION_LABELS.includes(label)) {
    throw new Error("interpretation label is not allowed");
  }

  return label;
}

function assertAllowedEvidenceLevel(
  level: ObjectiveEvidenceLevel
): ObjectiveEvidenceLevel {
  if (!OBJECTIVE_EVIDENCE_LEVELS.includes(level)) {
    throw new Error("evidence level is not allowed");
  }

  return level;
}

export function mapObjectiveInterpretation(
  input: ObjectiveInterpretationMapperInput
): ObjectiveInterpretationDecision {
  const featureWindow = input.feature_window;
  const ml = input.ml_inference ? validateMlInput(input.ml_inference) : undefined;

  assertNonEmptyString(featureWindow.feature_window_id, "feature_window_id");
  assertNonEmptyString(featureWindow.session_id, "session_id");
  assertClinicianOnlyVisibility(
    featureWindow.visibility,
    "feature window visibility"
  );

  const suppressionState = suppressionFromInputs(ml, featureWindow);
  const baseLabel = baseLabelFromMl(ml);
  const interpretationLabel = assertAllowedOutputLabel(
    labelAfterSuppression(baseLabel, suppressionState, featureWindow)
  );
  const confidence = confidenceFromInputs(ml, featureWindow);
  let evidence = assertAllowedEvidenceLevel(evidenceFromMl(ml));

  if (confidence === "insufficient_confidence") {
    evidence = minEvidence(evidence, "low");
  }

  if (suppressionState !== "not_suppressed") {
    evidence = "none";
  }

  return {
    interpretation_version: OBJECTIVE_INTERPRETATION_VERSION,
    target: OBJECTIVE_INTERPRETATION_TARGET,
    interpretation_label: interpretationLabel,
    evidence_level: evidence,
    confidence_label: confidence,
    suppression_state: suppressionState,
    uncertainty_reasons: mapperUncertaintyReasons(
      featureWindow,
      ml,
      input.artifact_state,
      suppressionState
    ),
    contributing_modalities: contributingModalities(featureWindow),
    excluded_modalities: excludedModalities(featureWindow),
    source_banner: sourceBanner(featureWindow, input.artifact_state),
    trace: {
      feature_window_id: featureWindow.feature_window_id,
      ...(featureWindow.feature_window_key
        ? { feature_window_key: featureWindow.feature_window_key }
        : {}),
      ...(ml?.ml_inference_id ? { ml_inference_id: ml.ml_inference_id } : {}),
      ...(ml?.model_version ? { model_version: ml.model_version } : {}),
      session_id: featureWindow.session_id,
      ...(featureWindow.segment_id ? { segment_id: featureWindow.segment_id } : {})
    },
    visibility: clinicianOnlyVisibility()
  };
}
