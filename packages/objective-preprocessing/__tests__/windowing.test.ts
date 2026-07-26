import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import {
  OBJECTIVE_FEATURE_SCHEMA_VERSION,
  OBJECTIVE_PREPROCESSING_VERSION,
  buildObjectiveFeatureWindows,
  flattenObjectiveRawBatches
} from "../src/index.js";

const RAW_FIELDS: RawSensorFieldName[] = [
  "pc_timestamp",
  "esp_time_ms",
  "ecg_raw",
  "gsr_raw",
  "max_red",
  "max_ir",
  "max_green",
  "accel_x",
  "accel_y",
  "accel_z",
  "gyro_x",
  "gyro_y",
  "gyro_z",
  "mpu_temp_c",
  "tmp117_temp_c"
];

function makeEnvelope(
  espTimeMs: number,
  overrides: Partial<ObjectiveRawFrameEnvelope["frame"]> = {},
  staleFields: RawSensorFieldName[] = []
): ObjectiveRawFrameEnvelope {
  const frame = {
    pc_timestamp: new Date(
      Date.UTC(2026, 4, 30, 13, 56, 10, espTimeMs)
    ).toISOString(),
    esp_time_ms: espTimeMs,
    ecg_raw: 2000 + (espTimeMs % 200),
    gsr_raw: 2400 + (espTimeMs % 50),
    max_red: 210 + (espTimeMs % 10),
    max_ir: 260 + (espTimeMs % 10),
    max_green: 44 + (espTimeMs % 5),
    accel_x: 0.1,
    accel_y: 0.2,
    accel_z: 9.81,
    gyro_x: 0.01,
    gyro_y: 0.02,
    gyro_z: 0.03,
    mpu_temp_c: 28.1,
    tmp117_temp_c: 32.2,
    ...overrides
  };

  return {
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frame,
    updated_fields: RAW_FIELDS.filter((fieldName) => frame[fieldName] !== undefined),
    held_fields: [],
    stale_fields: staleFields
  };
}

function makeBatch(frames: ObjectiveRawFrameEnvelope[]): ObjectiveRawBatch {
  return {
    batch_id: "batch-1",
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frames
  };
}

describe("objective preprocessing windowing foundation", () => {
  it("flattens raw batches while preserving batch and frame indexes", () => {
    const batch = makeBatch([
      makeEnvelope(1000),
      makeEnvelope(1100),
      makeEnvelope(1200)
    ]);

    const frames = flattenObjectiveRawBatches([batch]);

    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual(
      expect.objectContaining({
        batch_id: "batch-1",
        batch_frame_index: 0,
        global_frame_index: 0
      })
    );
    expect(frames[2]).toEqual(
      expect.objectContaining({
        batch_id: "batch-1",
        batch_frame_index: 2,
        global_frame_index: 2
      })
    );
  });

  it("builds feature-window foundations from raw batches", () => {
    const batch = makeBatch([
      makeEnvelope(1000),
      makeEnvelope(1100),
      makeEnvelope(1200),
      makeEnvelope(1300),
      makeEnvelope(1400),
      makeEnvelope(1500)
    ]);

    const windows = buildObjectiveFeatureWindows({
      batches: [batch],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 2
    });

    expect(windows).toHaveLength(2);

    expect(windows[0]).toEqual(
      expect.objectContaining({
        preprocessing_version: OBJECTIVE_PREPROCESSING_VERSION,
        feature_schema_version: OBJECTIVE_FEATURE_SCHEMA_VERSION,
        feature_window_id: "objective-window-session-1-segment-1-1000-1300",
        feature_window_key: "simulator:session-1:segment-1:1000:1300",
        session_id: "session-1",
        segment_id: "segment-1",
        source_type: "simulator",
        device_id: "device-1",
        device_boot_id: "boot-1",
        start_esp_time_ms: 1000,
        end_esp_time_ms: 1300,
        raw_batch_refs: ["batch-1"],
        window_status: "ready",
        suppression_state: "not_suppressed",
        features: {},
        baseline_relative: {},
        visibility: {
          clinician_visible: true,
          patient_visible: false,
          chatbot_visible: false
        }
      })
    );

    expect(windows[0].raw_range_refs).toEqual({
      first_global_frame_index: 0,
      last_global_frame_index: 2,
      first_esp_time_ms: 1000,
      last_esp_time_ms: 1200,
      frame_count: 3
    });
  });

  it("creates per-modality buffers and availability masks", () => {
    const batch = makeBatch([
      makeEnvelope(1000),
      makeEnvelope(1100),
      makeEnvelope(1200)
    ]);

    const [window] = buildObjectiveFeatureWindows({
      batches: [batch],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    expect(window.buffers.ecg.present_sample_count).toBe(3);
    expect(window.buffers.gsr.present_sample_count).toBe(3);
    expect(window.buffers.ppg.present_sample_count).toBe(3);
    expect(window.buffers.imu.present_sample_count).toBe(3);
    expect(window.buffers.temperature.present_sample_count).toBe(3);

    expect(window.modality_availability.ecg.state).toBe("available");
    expect(window.modality_availability.gsr.state).toBe("available");
    expect(window.modality_availability.ppg.state).toBe("available");
    expect(window.modality_availability.imu.state).toBe("available");
    expect(window.modality_availability.temperature.state).toBe("available");
  });

  it("tracks missingness and partial modality availability for sparse frames", () => {
    const batch = makeBatch([
      makeEnvelope(1000),
      makeEnvelope(
        1100,
        {
          ecg_raw: undefined,
          max_red: undefined,
          max_ir: undefined,
          max_green: undefined
        },
        ["ecg_raw", "max_red", "max_ir", "max_green"]
      ),
      makeEnvelope(1200)
    ]);

    const [window] = buildObjectiveFeatureWindows({
      batches: [batch],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    expect(window.missingness.ecg).toEqual(
      expect.objectContaining({
        expected_sample_count: 3,
        present_sample_count: 2,
        missing_sample_count: 1,
        stale_sample_count: 1
      })
    );

    expect(window.modality_availability.ecg.state).toBe("partial");
    expect(window.modality_availability.ppg.state).toBe("partial");
    expect(window.uncertainty_reasons).toContain("partial_modality_availability");
  });

  it("adds cadence placeholders without computing physiology features", () => {
    const batch = makeBatch([
      makeEnvelope(1000),
      makeEnvelope(1100),
      makeEnvelope(1200)
    ]);

    const [window] = buildObjectiveFeatureWindows({
      batches: [batch],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    expect(window.cadence.ecg).toEqual({
      status: "available",
      sample_count: 3,
      median_delta_ms: 100,
      min_delta_ms: 100,
      max_delta_ms: 100
    });

    expect(window.quality.cadence_placeholder_only).toBe(true);
    expect(window.features).toEqual({});
  });

  it("marks too-small windows as insufficient data", () => {
    const batch = makeBatch([makeEnvelope(1000)]);

    const [window] = buildObjectiveFeatureWindows({
      batches: [batch],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 2
    });

    expect(window.window_status).toBe("insufficient_data");
    expect(window.uncertainty_reasons).toContain("insufficient_window_data");
  });

  it("rejects invalid windowing options", () => {
    const batch = makeBatch([makeEnvelope(1000)]);

    expect(() =>
      buildObjectiveFeatureWindows({
        batches: [batch],
        window_duration_ms: 0,
        step_ms: 100
      })
    ).toThrow("window_duration_ms must be a positive integer");

    expect(() =>
      buildObjectiveFeatureWindows({
        batches: [batch],
        window_duration_ms: 100,
        step_ms: 0
      })
    ).toThrow("step_ms must be a positive integer");

    expect(() =>
      buildObjectiveFeatureWindows({
        batches: [],
        window_duration_ms: 100,
        step_ms: 100
      })
    ).toThrow("batches must contain at least one raw batch");
  });
});
