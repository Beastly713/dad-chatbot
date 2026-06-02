// packages/objective-schemas/__tests__/rawSensorFrame.test.ts

import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  RAW_SENSOR_FIELD_NAMES,
  assertObjectiveRawFrameEnvelope,
  validateObjectiveRawFrameEnvelope,
} from "../src/index.js";

const validFrameEnvelope = {
  session_id: "session-1",
  source_type: "simulator",
  schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  device_id: "device-1",
  device_boot_id: "boot-1",
  segment_id: "segment-1",
  frame: {
    pc_timestamp: "2026-05-30T13:56:10.124Z",
    esp_time_ms: 15040,
    ecg_raw: 2900,
    gsr_raw: 2405,
    max_red: 213,
    max_ir: 261,
    max_green: 44,
    accel_x: -8.798691,
    accel_y: -3.97337,
    accel_z: -1.577779,
    gyro_x: -0.032242,
    gyro_y: 0.024248,
    gyro_z: 0.00794,
    mpu_temp_c: 28.106,
    tmp117_temp_c: 25.571,
  },
  updated_fields: ["ecg_raw", "gsr_raw", "max_ir"],
  held_fields: ["tmp117_temp_c"],
  stale_fields: [],
};

describe("objective raw sensor frame schema", () => {
  it("defines the exact raw sensor field names for Phase 3 ingestion", () => {
    expect(RAW_SENSOR_FIELD_NAMES).toEqual([
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
      "tmp117_temp_c",
    ]);
  });

  it("accepts a complete valid raw frame envelope", () => {
    const result = validateObjectiveRawFrameEnvelope(validFrameEnvelope);

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid frame envelope");
    }

    expect(result.data.source_type).toBe("simulator");
    expect(result.data.frame.ecg_raw).toBe(2900);
    expect(result.data.frame.gsr_raw).toBe(2405);

    const rawFrameData = result.data as Record<string, unknown>;

    expect(rawFrameData.patient_visible).toBeUndefined();
    expect(rawFrameData.chatbot_visible).toBeUndefined();
  });

  it("accepts sparse frames as long as timing fields are present", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      frame: {
        pc_timestamp: "2026-05-30T13:56:10.124Z",
        esp_time_ms: 15040,
        ecg_raw: 2900,
      },
      updated_fields: ["ecg_raw"],
      held_fields: [],
      stale_fields: ["gsr_raw", "max_ir"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing esp_time_ms because ESP32 time is the primary signal timing axis", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      frame: {
        pc_timestamp: "2026-05-30T13:56:10.124Z",
        ecg_raw: 2900,
      },
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "esp_time_ms",
        }),
      ]),
    );
  });

  it("rejects unsupported source types", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      source_type: "validated_hardware",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "source_type",
        }),
      ]),
    );
  });

  it("rejects unsupported schema versions", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      schema_version: "objective_raw_frame.v999",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "schema_version",
        }),
      ]),
    );
  });

  it("rejects forbidden clinical fields at the envelope level", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      relapse_risk: "high",
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "relapse_risk",
        }),
      ]),
    );
  });

  it("rejects forbidden clinical fields inside the frame", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      frame: {
        ...validFrameEnvelope.frame,
        craving_detected: true,
        CIWA_score: 12,
      },
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "craving_detected",
        }),
        expect.objectContaining({
          path: "CIWA_score",
        }),
      ]),
    );
  });

  it("rejects invalid updated, held, or stale field names", () => {
    const result = validateObjectiveRawFrameEnvelope({
      ...validFrameEnvelope,
      updated_fields: ["ecg_raw", "relapse_risk"],
      held_fields: ["unknown_field"],
      stale_fields: ["gsr_raw"],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "updated_fields.1",
        }),
        expect.objectContaining({
          path: "held_fields.0",
        }),
      ]),
    );
  });

  it("assert helper throws on invalid frame envelopes", () => {
    expect(() =>
      assertObjectiveRawFrameEnvelope({
        ...validFrameEnvelope,
        source_type: "clinical_device",
      }),
    ).toThrow("Invalid objective raw frame envelope");
  });
});
