import type {
  ObjectiveRawBatch,
  RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import {
  OBJECTIVE_FEATURE_SCHEMA_VERSION,
  OBJECTIVE_PREPROCESSING_MODALITIES,
  OBJECTIVE_PREPROCESSING_VERSION,
  OBJECTIVE_PREPROCESSING_WINDOW_SCHEMA_VERSION,
  type ObjectiveBufferedRawFrame,
  type ObjectiveFeatureWindowFoundation,
  type ObjectiveModalityAvailability,
  type ObjectiveModalityBuffer,
  type ObjectiveModalityCadence,
  type ObjectiveModalityMissingness,
  type ObjectivePreprocessingModality,
  type ObjectivePreprocessingVisibility,
  type ObjectiveWindowBuildContext,
  type ObjectiveWindowingOptions
} from "./types.js";

const MODALITY_FIELDS = {
  ecg: ["ecg_raw"],
  gsr: ["gsr_raw"],
  ppg: ["max_red", "max_ir", "max_green"],
  imu: ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"],
  temperature: ["mpu_temp_c", "tmp117_temp_c"]
} as const satisfies Record<
  ObjectivePreprocessingModality,
  readonly RawSensorFieldName[]
>;

export function createObjectivePreprocessingVisibility(): ObjectivePreprocessingVisibility {
  return {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false
  };
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function assertNonEmptyBatches(
  batches: readonly ObjectiveRawBatch[]
): readonly ObjectiveRawBatch[] {
  if (batches.length === 0) {
    throw new Error("batches must contain at least one raw batch");
  }

  return batches;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function sameOrUndefined<T>(values: readonly (T | undefined)[]): T | undefined {
  const present = values.filter((value): value is T => value !== undefined);
  const [first] = present;

  if (first === undefined) {
    return undefined;
  }

  if (present.some((value) => value !== first)) {
    throw new Error("raw batches for one preprocessing call must share metadata");
  }

  return first;
}

function getRequiredSharedString(
  batches: readonly ObjectiveRawBatch[],
  key: "session_id" | "source_type" | "device_id" | "device_boot_id"
): string {
  const value = sameOrUndefined(batches.map((batch) => String(batch[key])));

  if (!value || value.trim().length === 0) {
    throw new Error(`${key} must be present on every raw batch`);
  }

  return value;
}

function getSharedOptionalString(
  batches: readonly ObjectiveRawBatch[],
  key: "segment_id"
): string | undefined {
  return sameOrUndefined(batches.map((batch) => batch[key]));
}

export function flattenObjectiveRawBatches(
  batches: readonly ObjectiveRawBatch[]
): ObjectiveBufferedRawFrame[] {
  assertNonEmptyBatches(batches);

  let globalFrameIndex = 0;

  const flattened = batches.flatMap((batch) =>
    batch.frames.map((envelope, batchFrameIndex) => {
      const buffered: ObjectiveBufferedRawFrame = {
        batch_id: batch.batch_id,
        batch_frame_index: batchFrameIndex,
        global_frame_index: globalFrameIndex,
        envelope
      };

      globalFrameIndex += 1;

      return buffered;
    })
  );

  return flattened
    .filter((frame) => Number.isFinite(frame.envelope.frame.esp_time_ms))
    .sort(
      (left, right) =>
        left.envelope.frame.esp_time_ms - right.envelope.frame.esp_time_ms ||
        left.global_frame_index - right.global_frame_index
    );
}

function hasAnyField(
  frame: ObjectiveBufferedRawFrame,
  fields: readonly RawSensorFieldName[]
): boolean {
  return fields.some((fieldName) => frame.envelope.frame[fieldName] !== undefined);
}

function countFieldState(
  frame: ObjectiveBufferedRawFrame,
  fields: readonly RawSensorFieldName[],
  key: "updated_fields" | "held_fields" | "stale_fields"
): boolean {
  return fields.some((fieldName) => frame.envelope[key].includes(fieldName));
}

function createModalitySample(
  frame: ObjectiveBufferedRawFrame,
  fields: readonly RawSensorFieldName[]
) {
  const values: Partial<Record<RawSensorFieldName, number | string>> = {};

  for (const fieldName of fields) {
    const value = frame.envelope.frame[fieldName];

    if (value !== undefined) {
      values[fieldName] = value;
    }
  }

  return {
    esp_time_ms: frame.envelope.frame.esp_time_ms,
    pc_timestamp: frame.envelope.frame.pc_timestamp,
    values,
    updated_fields: frame.envelope.updated_fields.filter((fieldName) =>
      fields.includes(fieldName)
    ),
    held_fields: frame.envelope.held_fields.filter((fieldName) =>
      fields.includes(fieldName)
    ),
    stale_fields: frame.envelope.stale_fields.filter((fieldName) =>
      fields.includes(fieldName)
    )
  };
}

function buildModalityBuffer(
  modality: ObjectivePreprocessingModality,
  frames: readonly ObjectiveBufferedRawFrame[]
): ObjectiveModalityBuffer {
  const fields = MODALITY_FIELDS[modality];
  const samples = frames
    .filter((frame) => hasAnyField(frame, fields))
    .map((frame) => createModalitySample(frame, fields));

  const heldSampleCount = frames.filter((frame) =>
    countFieldState(frame, fields, "held_fields")
  ).length;
  const staleSampleCount = frames.filter((frame) =>
    countFieldState(frame, fields, "stale_fields")
  ).length;
  const presentSampleCount = samples.length;
  const expectedSampleCount = frames.length;

  return {
    modality,
    fields,
    expected_sample_count: expectedSampleCount,
    present_sample_count: presentSampleCount,
    missing_sample_count: Math.max(0, expectedSampleCount - presentSampleCount),
    held_sample_count: heldSampleCount,
    stale_sample_count: staleSampleCount,
    samples
  };
}

function buildMissingness(
  buffer: ObjectiveModalityBuffer
): ObjectiveModalityMissingness {
  const missingFraction =
    buffer.expected_sample_count === 0
      ? 1
      : buffer.missing_sample_count / buffer.expected_sample_count;

  return {
    expected_sample_count: buffer.expected_sample_count,
    present_sample_count: buffer.present_sample_count,
    missing_sample_count: buffer.missing_sample_count,
    missing_fraction: roundTo(missingFraction, 4),
    held_sample_count: buffer.held_sample_count,
    stale_sample_count: buffer.stale_sample_count
  };
}

function buildAvailability(
  buffer: ObjectiveModalityBuffer
): ObjectiveModalityAvailability {
  const presentFraction =
    buffer.expected_sample_count === 0
      ? 0
      : buffer.present_sample_count / buffer.expected_sample_count;

  const state =
    presentFraction >= 0.8
      ? "available"
      : presentFraction > 0
        ? "partial"
        : "unavailable";

  return {
    state,
    present_fraction: roundTo(presentFraction, 4),
    has_updated_data: buffer.samples.some(
      (sample) => sample.updated_fields.length > 0
    ),
    has_held_data: buffer.held_sample_count > 0,
    has_stale_data: buffer.stale_sample_count > 0
  };
}

function buildCadence(buffer: ObjectiveModalityBuffer): ObjectiveModalityCadence {
  const sortedEspTimes = buffer.samples
    .map((sample) => sample.esp_time_ms)
    .sort((left, right) => left - right);

  const deltas = sortedEspTimes
    .slice(1)
    .map((espTimeMs, index) => espTimeMs - sortedEspTimes[index])
    .filter((delta) => delta >= 0);

  if (deltas.length === 0) {
    return {
      status: "insufficient_samples",
      sample_count: buffer.samples.length,
      median_delta_ms: null,
      min_delta_ms: null,
      max_delta_ms: null
    };
  }

  const minDelta = Math.min(...deltas);
  const maxDelta = Math.max(...deltas);
  const medianDelta = median(deltas);
  const isIrregular = medianDelta !== null && maxDelta > medianDelta * 2;

  return {
    status: isIrregular ? "irregular" : "available",
    sample_count: buffer.samples.length,
    median_delta_ms: medianDelta,
    min_delta_ms: minDelta,
    max_delta_ms: maxDelta
  };
}

function createWindowId(
  sessionId: string,
  segmentId: string | undefined,
  startEspTimeMs: number,
  endEspTimeMs: number
): string {
  return `objective-window-${sessionId}-${segmentId ?? "no-segment"}-${startEspTimeMs}-${endEspTimeMs}`;
}

function createWindowKey(
  sourceType: string,
  sessionId: string,
  segmentId: string | undefined,
  startEspTimeMs: number,
  endEspTimeMs: number
): string {
  return `${sourceType}:${sessionId}:${segmentId ?? "no-segment"}:${startEspTimeMs}:${endEspTimeMs}`;
}

function getPcTimestampBounds(frames: readonly ObjectiveBufferedRawFrame[]) {
  const timestamps = frames
    .map((frame) => frame.envelope.frame.pc_timestamp)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    start_pc_timestamp: timestamps[0],
    end_pc_timestamp: timestamps[timestamps.length - 1]
  };
}

function countTimingGaps(
  frames: readonly ObjectiveBufferedRawFrame[],
  expectedSampleIntervalMs: number | undefined
): number {
  if (!expectedSampleIntervalMs || frames.length < 2) {
    return 0;
  }

  return frames
    .slice(1)
    .filter(
      (frame, index) =>
        frame.envelope.frame.esp_time_ms -
          frames[index].envelope.frame.esp_time_ms >
        expectedSampleIntervalMs * 2
    ).length;
}

export function buildObjectiveFeatureWindowFoundation(
  batches: readonly ObjectiveRawBatch[],
  context: ObjectiveWindowBuildContext,
  options: Pick<
    ObjectiveWindowingOptions,
    "expected_sample_interval_ms" | "min_frames_per_window"
  >
): ObjectiveFeatureWindowFoundation {
  const sessionId = getRequiredSharedString(batches, "session_id");
  const sourceType = getRequiredSharedString(batches, "source_type");
  const deviceId = getRequiredSharedString(batches, "device_id");
  const deviceBootId = getRequiredSharedString(batches, "device_boot_id");
  const segmentId = getSharedOptionalString(batches, "segment_id");

  const rawBatchRefs = [...new Set(context.frames.map((frame) => frame.batch_id))];
  const firstFrame = context.frames[0];
  const lastFrame = context.frames[context.frames.length - 1];

  if (!firstFrame || !lastFrame) {
    throw new Error("feature window must contain at least one raw frame");
  }

  const buffers = Object.fromEntries(
    OBJECTIVE_PREPROCESSING_MODALITIES.map((modality) => [
      modality,
      buildModalityBuffer(modality, context.frames)
    ])
  ) as ObjectiveFeatureWindowFoundation["buffers"];

  const missingness = Object.fromEntries(
    OBJECTIVE_PREPROCESSING_MODALITIES.map((modality) => [
      modality,
      buildMissingness(buffers[modality])
    ])
  ) as ObjectiveFeatureWindowFoundation["missingness"];

  const modalityAvailability = Object.fromEntries(
    OBJECTIVE_PREPROCESSING_MODALITIES.map((modality) => [
      modality,
      buildAvailability(buffers[modality])
    ])
  ) as ObjectiveFeatureWindowFoundation["modality_availability"];

  const cadence = Object.fromEntries(
    OBJECTIVE_PREPROCESSING_MODALITIES.map((modality) => [
      modality,
      buildCadence(buffers[modality])
    ])
  ) as ObjectiveFeatureWindowFoundation["cadence"];

  const availableModalities = OBJECTIVE_PREPROCESSING_MODALITIES.filter(
    (modality) => modalityAvailability[modality].state === "available"
  );
  const partialModalities = OBJECTIVE_PREPROCESSING_MODALITIES.filter(
    (modality) => modalityAvailability[modality].state === "partial"
  );
  const unavailableModalities = OBJECTIVE_PREPROCESSING_MODALITIES.filter(
    (modality) => modalityAvailability[modality].state === "unavailable"
  );

  const minFramesPerWindow = options.min_frames_per_window ?? 1;
  const windowStatus =
    context.frames.length >= minFramesPerWindow && availableModalities.length > 0
      ? "ready"
      : "insufficient_data";

  const uncertaintyReasons = [
    ...(partialModalities.length > 0 ? ["partial_modality_availability"] : []),
    ...(unavailableModalities.length > 0 ? ["unavailable_modality_data"] : []),
    ...(windowStatus === "insufficient_data" ? ["insufficient_window_data"] : [])
  ];

  const pcTimestampBounds = getPcTimestampBounds(context.frames);
  const firstEspTimeMs = firstFrame.envelope.frame.esp_time_ms;
  const lastEspTimeMs = lastFrame.envelope.frame.esp_time_ms;

  return {
    schema_version: OBJECTIVE_PREPROCESSING_WINDOW_SCHEMA_VERSION,
    preprocessing_version: OBJECTIVE_PREPROCESSING_VERSION,
    feature_schema_version: OBJECTIVE_FEATURE_SCHEMA_VERSION,
    feature_window_id: createWindowId(
      sessionId,
      segmentId,
      context.window_start_esp_time_ms,
      context.window_end_esp_time_ms
    ),
    feature_window_key: createWindowKey(
      sourceType,
      sessionId,
      segmentId,
      context.window_start_esp_time_ms,
      context.window_end_esp_time_ms
    ),
    session_id: sessionId,
    ...(segmentId ? { segment_id: segmentId } : {}),
    source_type: sourceType as ObjectiveRawBatch["source_type"],
    device_id: deviceId,
    device_boot_id: deviceBootId,
    start_esp_time_ms: context.window_start_esp_time_ms,
    end_esp_time_ms: context.window_end_esp_time_ms,
    ...pcTimestampBounds,
    raw_batch_refs: rawBatchRefs,
    raw_range_refs: {
      first_global_frame_index: firstFrame.global_frame_index,
      last_global_frame_index: lastFrame.global_frame_index,
      first_esp_time_ms: firstEspTimeMs,
      last_esp_time_ms: lastEspTimeMs,
      frame_count: context.frames.length
    },
    window_status: windowStatus,
    suppression_state: "not_suppressed",
    quality: {
      window_frame_count: context.frames.length,
      expected_frame_count: options.expected_sample_interval_ms
        ? Math.ceil(
            (context.window_end_esp_time_ms -
              context.window_start_esp_time_ms) /
              options.expected_sample_interval_ms
          )
        : context.frames.length,
      timing_gap_count: countTimingGaps(
        context.frames,
        options.expected_sample_interval_ms
      ),
      cadence_placeholder_only: true
    },
    missingness,
    modality_availability: modalityAvailability,
    cadence,
    buffers,
    features: {},
    baseline_relative: {},
    uncertainty_reasons: uncertaintyReasons,
    visibility: createObjectivePreprocessingVisibility()
  };
}

export function buildObjectiveFeatureWindows(
  options: ObjectiveWindowingOptions
): ObjectiveFeatureWindowFoundation[] {
  assertNonEmptyBatches(options.batches);
  assertPositiveInteger(options.window_duration_ms, "window_duration_ms");
  assertPositiveInteger(options.step_ms, "step_ms");

  if (options.expected_sample_interval_ms !== undefined) {
    assertPositiveInteger(
      options.expected_sample_interval_ms,
      "expected_sample_interval_ms"
    );
  }

  if (options.min_frames_per_window !== undefined) {
    assertPositiveInteger(options.min_frames_per_window, "min_frames_per_window");
  }

  const frames = flattenObjectiveRawBatches(options.batches);

  if (frames.length === 0) {
    return [];
  }

  const firstEspTimeMs = frames[0].envelope.frame.esp_time_ms;
  const lastEspTimeMs = frames[frames.length - 1].envelope.frame.esp_time_ms;
  const windows: ObjectiveFeatureWindowFoundation[] = [];

  for (
    let windowStartEspTimeMs = firstEspTimeMs;
    windowStartEspTimeMs <= lastEspTimeMs;
    windowStartEspTimeMs += options.step_ms
  ) {
    const windowEndEspTimeMs =
      windowStartEspTimeMs + options.window_duration_ms;
    const windowFrames = frames.filter(
      (frame) =>
        frame.envelope.frame.esp_time_ms >= windowStartEspTimeMs &&
        frame.envelope.frame.esp_time_ms < windowEndEspTimeMs
    );

    if (windowFrames.length === 0) {
      continue;
    }

    windows.push(
      buildObjectiveFeatureWindowFoundation(
        options.batches,
        {
          window_start_esp_time_ms: windowStartEspTimeMs,
          window_end_esp_time_ms: windowEndEspTimeMs,
          frames: windowFrames
        },
        options
      )
    );

    if (
      windowEndEspTimeMs > lastEspTimeMs &&
      options.step_ms >= options.window_duration_ms
    ) {
      break;
    }
  }

  return windows;
}

export { MODALITY_FIELDS };
