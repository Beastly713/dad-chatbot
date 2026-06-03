import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope
} from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import { buildObjectiveFeatureWindows } from "../src/index.js";

function makeEnvelope(espTimeMs: number): ObjectiveRawFrameEnvelope {
  return {
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frame: {
      pc_timestamp: new Date(
        Date.UTC(2026, 4, 30, 13, 56, 10, espTimeMs)
      ).toISOString(),
      esp_time_ms: espTimeMs,
      ecg_raw: 2000,
      gsr_raw: 2400,
      max_red: 210,
      max_ir: 260,
      max_green: 44,
      accel_x: 0.1,
      accel_y: 0.2,
      accel_z: 9.81,
      gyro_x: 0.01,
      gyro_y: 0.02,
      gyro_z: 0.03,
      mpu_temp_c: 28.1,
      tmp117_temp_c: 32.2
    },
    updated_fields: [
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
    ],
    held_fields: [],
    stale_fields: []
  };
}

function makeBatch(): ObjectiveRawBatch {
  return {
    batch_id: "batch-1",
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frames: [makeEnvelope(1000), makeEnvelope(1100), makeEnvelope(1200)]
  };
}

describe("Stage 7 preprocessing boundary", () => {
  it("keeps preprocessing windows clinician-only and non-chatbot", () => {
    const [window] = buildObjectiveFeatureWindows({
      batches: [makeBatch()],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    expect(window.visibility).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    });

    expect(JSON.stringify(window)).not.toContain('chatbot_visible":true');
    expect(JSON.stringify(window)).not.toContain('patient_visible":true');
  });

  it("preserves source session segment and raw range linkage", () => {
    const [window] = buildObjectiveFeatureWindows({
      batches: [makeBatch()],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    expect(window.session_id).toBe("session-1");
    expect(window.segment_id).toBe("segment-1");
    expect(window.source_type).toBe("simulator");
    expect(window.device_id).toBe("device-1");
    expect(window.device_boot_id).toBe("boot-1");
    expect(window.raw_batch_refs).toEqual(["batch-1"]);
    expect(window.raw_range_refs).toEqual(
      expect.objectContaining({
        first_esp_time_ms: 1000,
        last_esp_time_ms: 1200,
        frame_count: 3
      })
    );
  });

  it("does not create clinical labels, model outputs, interpretation records, or dashboard events", () => {
    const windows = buildObjectiveFeatureWindows({
      batches: [makeBatch()],
      window_duration_ms: 300,
      step_ms: 300,
      expected_sample_interval_ms: 100
    });

    const serialized = JSON.stringify(windows);

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(serialized).not.toContain("predicted_class");
    expect(serialized).not.toContain("interpretation");
    expect(serialized).not.toContain("dashboard");
    expect(serialized).not.toContain("model_version");
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("heart_rate");
    expect(serialized).not.toContain("spo2");

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-preprocessing/src/windowing.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
