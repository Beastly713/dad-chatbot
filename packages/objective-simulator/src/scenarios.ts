import {
  OBJECTIVE_SIMULATOR_SCHEMA_VERSION,
  OBJECTIVE_SIMULATOR_SOURCE_TYPE,
  type ObjectiveSimulatorBaselineParameters,
  type ObjectiveSimulatorScenarioId,
  type ObjectiveSimulatorScenarioProfile,
  createObjectiveSimulatorVisibility,
  assertObjectiveSimulatorScenarioId
} from "./types.js";

const DEFAULT_BASELINE_PARAMETERS: ObjectiveSimulatorBaselineParameters = {
  ecg_cycle_ms: 820,
  ecg_variability_ms: 45,
  gsr_tonic_raw: 2400,
  ppg_ir_baseline_raw: 260,
  local_skin_temp_c: 32.4,
  motion_baseline_mps2: 9.81
};

const DEFAULT_SOURCE_METADATA = {
  source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
  producer_key: "objective-simulator-local",
  device_profile_key: "synthetic-multisignal-profile-v1",
  source_banner:
    "Synthetic objective simulator data for engineering and safety testing only.",
  engineering_only: true,
  clinical_validation_claim: false
} as const;

function makeProfile(
  scenario_id: ObjectiveSimulatorScenarioId,
  display_name: string,
  description: string,
  expected_phase_types: ObjectiveSimulatorScenarioProfile["expected_phase_types"],
  baseline_parameters: Partial<ObjectiveSimulatorBaselineParameters> = {}
): ObjectiveSimulatorScenarioProfile {
  return {
    schema_version: OBJECTIVE_SIMULATOR_SCHEMA_VERSION,
    scenario_id,
    source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
    display_name,
    description,
    baseline_parameters: {
      ...DEFAULT_BASELINE_PARAMETERS,
      ...baseline_parameters
    },
    expected_phase_types,
    visibility: createObjectiveSimulatorVisibility(),
    source_metadata: DEFAULT_SOURCE_METADATA
  };
}

export const OBJECTIVE_SIMULATOR_SCENARIO_PROFILES = {
  baseline_rest: makeProfile(
    "baseline_rest",
    "Baseline rest",
    "Stable baseline-oriented simulator profile for engineering checks.",
    ["baseline_period"]
  ),

  elevated_arousal_pattern: makeProfile(
    "elevated_arousal_pattern",
    "Elevated arousal pattern",
    "Baseline-relative elevated physiological arousal evidence pattern for engineering checks.",
    ["baseline_period", "elevated_arousal_period", "recovery_period"],
    {
      ecg_cycle_ms: 760,
      gsr_tonic_raw: 2480
    }
  ),

  recovery_cooldown: makeProfile(
    "recovery_cooldown",
    "Recovery cooldown",
    "Simulator profile that moves from elevated arousal evidence toward a cooldown pattern.",
    ["elevated_arousal_period", "recovery_period", "baseline_period"]
  ),

  motion_artifact: makeProfile(
    "motion_artifact",
    "Motion artifact",
    "Simulator profile for movement/activity-like confound coverage.",
    ["baseline_period", "movement_confound_period", "recovery_period"],
    {
      motion_baseline_mps2: 10.2
    }
  ),

  poor_contact: makeProfile(
    "poor_contact",
    "Poor contact",
    "Simulator profile for signal-quality limitation coverage.",
    ["baseline_period", "signal_quality_limitation_period", "recovery_period"]
  ),

  sensor_dropout: makeProfile(
    "sensor_dropout",
    "Sensor dropout",
    "Simulator profile for missingness and dropout coverage.",
    ["baseline_period", "sensor_dropout_period", "recovery_period"]
  ),

  signal_conflict: makeProfile(
    "signal_conflict",
    "Signal conflict",
    "Simulator profile for cross-signal disagreement coverage.",
    ["baseline_period", "cross_signal_conflict_period", "recovery_period"]
  ),

  device_reset_or_timing_gap: makeProfile(
    "device_reset_or_timing_gap",
    "Device reset or timing gap",
    "Simulator profile for timing discontinuity and device reset coverage.",
    ["baseline_period", "timing_gap_period", "device_reset_period", "recovery_period"]
  )
} satisfies Record<ObjectiveSimulatorScenarioId, ObjectiveSimulatorScenarioProfile>;

export function getObjectiveSimulatorScenarioProfile(
  scenarioId: string
): ObjectiveSimulatorScenarioProfile {
  const safeScenarioId = assertObjectiveSimulatorScenarioId(scenarioId);

  return OBJECTIVE_SIMULATOR_SCENARIO_PROFILES[safeScenarioId];
}
