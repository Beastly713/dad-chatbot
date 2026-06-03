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
  features: Record<string, never>;
  baseline_relative: Record<string, never>;
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
