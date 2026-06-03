export const OBJECTIVE_SIMULATOR_SCHEMA_VERSION =
  "objective-simulator-scenario-v1" as const;

export const OBJECTIVE_SIMULATOR_SOURCE_TYPE = "simulator" as const;

export const OBJECTIVE_SIMULATOR_SCENARIO_IDS = [
  "baseline_rest",
  "elevated_arousal_pattern",
  "recovery_cooldown",
  "motion_artifact",
  "poor_contact",
  "sensor_dropout",
  "signal_conflict",
  "device_reset_or_timing_gap"
] as const;

export type ObjectiveSimulatorScenarioId =
  (typeof OBJECTIVE_SIMULATOR_SCENARIO_IDS)[number];

export const OBJECTIVE_SIMULATOR_PHASE_TYPES = [
  "baseline_period",
  "elevated_arousal_period",
  "movement_confound_period",
  "recovery_period",
  "signal_quality_limitation_period",
  "sensor_dropout_period",
  "cross_signal_conflict_period",
  "timing_gap_period",
  "device_reset_period"
] as const;

export type ObjectiveSimulatorPhaseType =
  (typeof OBJECTIVE_SIMULATOR_PHASE_TYPES)[number];

export type ObjectiveSimulatorVisibility = {
  clinician_visible: true;
  patient_visible: false;
  chatbot_visible: false;
  developer_labels_visible: false;
};

export type ObjectiveSimulatorBaselineParameters = {
  ecg_cycle_ms: number;
  ecg_variability_ms: number;
  gsr_tonic_raw: number;
  ppg_ir_baseline_raw: number;
  local_skin_temp_c: number;
  motion_baseline_mps2: number;
};

export type ObjectiveSimulatorSourceMetadata = {
  source_type: typeof OBJECTIVE_SIMULATOR_SOURCE_TYPE;
  producer_key: string;
  device_profile_key: string;
  source_banner: string;
  engineering_only: true;
  clinical_validation_claim: false;
};

export type ObjectiveSimulatorScenarioProfile = {
  schema_version: typeof OBJECTIVE_SIMULATOR_SCHEMA_VERSION;
  scenario_id: ObjectiveSimulatorScenarioId;
  source_type: typeof OBJECTIVE_SIMULATOR_SOURCE_TYPE;
  display_name: string;
  description: string;
  baseline_parameters: ObjectiveSimulatorBaselineParameters;
  expected_phase_types: readonly ObjectiveSimulatorPhaseType[];
  visibility: ObjectiveSimulatorVisibility;
  source_metadata: ObjectiveSimulatorSourceMetadata;
};

export function createObjectiveSimulatorVisibility(): ObjectiveSimulatorVisibility {
  return {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false,
    developer_labels_visible: false
  };
}

export function isObjectiveSimulatorScenarioId(
  value: string
): value is ObjectiveSimulatorScenarioId {
  return (OBJECTIVE_SIMULATOR_SCENARIO_IDS as readonly string[]).includes(value);
}

export function assertObjectiveSimulatorScenarioId(
  value: string
): ObjectiveSimulatorScenarioId {
  if (!isObjectiveSimulatorScenarioId(value)) {
    throw new Error(`Unsupported objective simulator scenario id: ${value}`);
  }

  return value;
}

export function isObjectiveSimulatorPhaseType(
  value: string
): value is ObjectiveSimulatorPhaseType {
  return (OBJECTIVE_SIMULATOR_PHASE_TYPES as readonly string[]).includes(value);
}
