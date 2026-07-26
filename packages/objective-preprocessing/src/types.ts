import type {
  ObjectiveRawBatch,
  ObjectiveRawFrameEnvelope,
  RawSensorFieldName
} from "@dad-chatbot/objective-schemas";

export const OBJECTIVE_PREPROCESSING_WINDOW_SCHEMA_VERSION =
  "objective-preprocessing-window-foundation-v1" as const;

export const OBJECTIVE_PREPROCESSING_VERSION =
  "objective-preprocessing-v1" as const;

export const OBJECTIVE_FEATURE_SCHEMA_VERSION =
  "objective-feature-window-foundation-v1" as const;

export const OBJECTIVE_PREPROCESSING_MODALITIES = [
  "ecg",
  "gsr",
  "ppg",
  "imu",
  "temperature"
] as const;

export type ObjectivePreprocessingModality =
  (typeof OBJECTIVE_PREPROCESSING_MODALITIES)[number];

export type ObjectiveWindowStatus = "ready" | "insufficient_data";

export type ObjectiveModalityAvailabilityState =
  | "available"
  | "partial"
  | "unavailable";

export type ObjectiveCadenceStatus =
  | "available"
  | "irregular"
  | "insufficient_samples";

export type ObjectivePreprocessingVisibility = {
  clinician_visible: true;
  patient_visible: false;
  chatbot_visible: false;
};

export type ObjectiveBufferedRawFrame = {
  batch_id: string;
  batch_frame_index: number;
  global_frame_index: number;
  envelope: ObjectiveRawFrameEnvelope;
};

export type ObjectiveModalitySample = {
  esp_time_ms: number;
  pc_timestamp?: string;
  values: Partial<Record<RawSensorFieldName, number | string>>;
  updated_fields: RawSensorFieldName[];
  held_fields: RawSensorFieldName[];
  stale_fields: RawSensorFieldName[];
};

export type ObjectiveModalityBuffer = {
  modality: ObjectivePreprocessingModality;
  fields: readonly RawSensorFieldName[];
  expected_sample_count: number;
  present_sample_count: number;
  missing_sample_count: number;
  held_sample_count: number;
  stale_sample_count: number;
  samples: ObjectiveModalitySample[];
};

export type ObjectiveModalityMissingness = {
  expected_sample_count: number;
  present_sample_count: number;
  missing_sample_count: number;
  missing_fraction: number;
  held_sample_count: number;
  stale_sample_count: number;
};

export type ObjectiveModalityAvailability = {
  state: ObjectiveModalityAvailabilityState;
  present_fraction: number;
  has_updated_data: boolean;
  has_held_data: boolean;
  has_stale_data: boolean;
};

export type ObjectiveModalityCadence = {
  status: ObjectiveCadenceStatus;
  sample_count: number;
  median_delta_ms: number | null;
  min_delta_ms: number | null;
  max_delta_ms: number | null;
};

export type ObjectiveFeatureSuppressionState = {
  suppressed: boolean;
  reasons: string[];
};

export type ObjectiveEcgFeatureSet = {
  modality: "ecg";
  mean_hr_bpm: number | null;
  median_hr_bpm: number | null;
  hr_slope_bpm_per_min: number | null;
  rr_validity_fraction: number;
  rmssd_ms: number | null;
  sdnn_ms: number | null;
  r_peak_count: number;
  r_peak_quality_score: number;
  suppression: ObjectiveFeatureSuppressionState;
};

export type ObjectiveGsrFeatureSet = {
  modality: "gsr";
  tonic_trend_raw_per_min: number | null;
  tonic_baseline_deviation_raw: number | null;
  scr_count: number;
  scr_rate_per_min: number | null;
  phasic_area_raw_seconds: number | null;
  gsr_quality_score: number;
  suppression: ObjectiveFeatureSuppressionState;
};

export type ObjectivePpgBestChannel = "max_red" | "max_ir" | "max_green" | null;

export type ObjectivePpgFeatureSet = {
  modality: "ppg";
  best_channel: ObjectivePpgBestChannel;
  pulse_rate_bpm: number | null;
  pulse_interval_median_ms: number | null;
  waveform_quality_score: number;
  ecg_ppg_pulse_interval_agreement: number | null;
  suppression: ObjectiveFeatureSuppressionState;
};

export type ObjectiveImuFeatureSet = {
  modality: "imu";
  motion_magnitude_mean: number | null;
  motion_magnitude_max: number | null;
  jerk_mean: number | null;
  gyro_magnitude_mean: number | null;
  stillness_fraction: number | null;
  activity_like_confound_index: number;
  suppression: ObjectiveFeatureSuppressionState;
};

export type ObjectiveTemperatureFeatureSet = {
  modality: "temperature";
  tmp117_trend_c_per_min: number | null;
  tmp117_contact_shift_c: number | null;
  mpu_board_heating_indicator_c_per_min: number | null;
  local_temperature_quality_score: number;
  board_temperature_quality_score: number;
  suppression: ObjectiveFeatureSuppressionState;
};

export type ObjectiveBaselineState = "available" | "limited" | "unavailable";

export type ObjectiveBaselineQuality = {
  state: ObjectiveBaselineState;
  baseline_window_count: number;
  usable_baseline_window_count: number;
  quality_score: number;
  reasons: string[];
};

export type ObjectiveBaselineFeatureSummary = {
  ecg_median_hr_bpm: number | null;
  ecg_mean_hr_bpm: number | null;
  gsr_tonic_baseline_deviation_raw: number | null;
  ppg_pulse_rate_bpm: number | null;
  tmp117_trend_c_per_min: number | null;
  motion_magnitude_mean: number | null;
};

export type ObjectiveSessionBaselineProfile = {
  baseline_profile_id: string;
  session_id: string;
  source_type: string;
  created_from_feature_window_ids: string[];
  baseline_features: ObjectiveBaselineFeatureSummary;
  baseline_quality: ObjectiveBaselineQuality;
  visibility: ObjectivePreprocessingVisibility;
};

export type ObjectiveBaselineRelativeFeatureSet = {
  baseline_state: ObjectiveBaselineState;
  baseline_profile_id?: string;
  readiness_confidence_modifier: number;
  no_baseline_reason?: string;
  ecg_median_hr_delta_bpm: number | null;
  ecg_mean_hr_delta_bpm: number | null;
  gsr_tonic_baseline_deviation_delta_raw: number | null;
  ppg_pulse_rate_delta_bpm: number | null;
  tmp117_trend_delta_c_per_min: number | null;
  motion_magnitude_delta: number | null;
};

export type ObjectiveEcgPpgAgreementState =
  | "agreement"
  | "disagreement"
  | "unavailable";

export type ObjectiveCrossSignalFeatureSet = {
  hr_gsr_agreement_index: number | null;
  hr_gsr_agreement_state: "agreement" | "divergence" | "unavailable";
  high_motion_confound_present: boolean;
  motion_confound_index: number;
  ecg_ppg_agreement_state: ObjectiveEcgPpgAgreementState;
  ecg_ppg_agreement_value: number | null;
  signal_conflict_score: number;
  uncertainty_reasons: string[];
};

export type ObjectiveFeatureMap = {
  ecg?: ObjectiveEcgFeatureSet;
  gsr?: ObjectiveGsrFeatureSet;
  ppg?: ObjectivePpgFeatureSet;
  imu?: ObjectiveImuFeatureSet;
  temperature?: ObjectiveTemperatureFeatureSet;
};

export type ObjectiveFeatureWindowFoundation = {
  schema_version: typeof OBJECTIVE_PREPROCESSING_WINDOW_SCHEMA_VERSION;
  preprocessing_version: typeof OBJECTIVE_PREPROCESSING_VERSION;
  feature_schema_version: typeof OBJECTIVE_FEATURE_SCHEMA_VERSION;
  feature_window_id: string;
  feature_window_key: string;
  session_id: string;
  segment_id?: string;
  source_type: ObjectiveRawBatch["source_type"];
  device_id: string;
  device_boot_id: string;
  start_esp_time_ms: number;
  end_esp_time_ms: number;
  start_pc_timestamp?: string;
  end_pc_timestamp?: string;
  raw_batch_refs: string[];
  raw_range_refs: {
    first_global_frame_index: number;
    last_global_frame_index: number;
    first_esp_time_ms: number;
    last_esp_time_ms: number;
    frame_count: number;
  };
  window_status: ObjectiveWindowStatus;
  suppression_state: "not_suppressed";
  quality: {
    window_frame_count: number;
    expected_frame_count: number;
    timing_gap_count: number;
    cadence_placeholder_only: true;
  };
  missingness: Record<ObjectivePreprocessingModality, ObjectiveModalityMissingness>;
  modality_availability: Record<
    ObjectivePreprocessingModality,
    ObjectiveModalityAvailability
  >;
  cadence: Record<ObjectivePreprocessingModality, ObjectiveModalityCadence>;
  buffers: Record<ObjectivePreprocessingModality, ObjectiveModalityBuffer>;
  features: ObjectiveFeatureMap;
  baseline_relative: ObjectiveBaselineRelativeFeatureSet | Record<string, never>;
  cross_signal?: ObjectiveCrossSignalFeatureSet;
  uncertainty_reasons: string[];
  visibility: ObjectivePreprocessingVisibility;
};

export type ObjectiveWindowingOptions = {
  batches: readonly ObjectiveRawBatch[];
  window_duration_ms: number;
  step_ms: number;
  expected_sample_interval_ms?: number;
  min_frames_per_window?: number;
};

export type ObjectiveWindowBuildContext = {
  window_start_esp_time_ms: number;
  window_end_esp_time_ms: number;
  frames: readonly ObjectiveBufferedRawFrame[];
};
