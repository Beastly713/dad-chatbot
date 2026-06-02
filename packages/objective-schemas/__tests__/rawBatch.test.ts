// packages/objective-schemas/__tests__/rawBatch.test.ts

import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  assertObjectiveRawBatch,
  validateObjectiveRawBatch,
} from "../src/index.js";

function makeFrame(espTimeMs: number) {
  return {
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frame: {
      pc_timestamp: "2026-05-30T13:56:10.124Z",
      esp_time_ms: espTimeMs,
      ecg_raw: 2900,
      gsr_raw: 2405,
    },
    updated_fields: ["ecg_raw", "gsr_raw"],
    held_fields: [],
    stale_fields: [],
  };
}

const validBatch = {
  batch_id: "batch-1",
  session_id: "session-1",
  source_type: "simulator",
  schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  device_id: "device-1",
  device_boot_id: "boot-1",
  segment_id: "segment-1",
  frames: [makeFrame(15040), makeFrame(15045)],
};

describe("objective raw batch schema", () => {
  it("accepts a valid raw batch", () => {
    const result = validateObjectiveRawBatch(validBatch);

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid raw batch");
    }

    expect(result.data.frames).toHaveLength(2);
    expect(result.data.source_type).toBe("simulator");
    expect(result.data.schema_version).toBe(
      OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    );
  });

  it("rejects empty frame batches", () => {
    const result = validateObjectiveRawBatch({
      ...validBatch,
      frames: [],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "frames",
        }),
      ]),
    );
  });

  it("rejects unsupported schema versions", () => {
    const result = validateObjectiveRawBatch({
      ...validBatch,
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

  it("rejects frames whose session_id does not match the batch", () => {
    const result = validateObjectiveRawBatch({
      ...validBatch,
      frames: [
        {
          ...makeFrame(15040),
          session_id: "other-session",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "frames.0.session_id",
        }),
      ]),
    );
  });

  it("rejects frames whose source_type does not match the batch", () => {
    const result = validateObjectiveRawBatch({
      ...validBatch,
      frames: [
        {
          ...makeFrame(15040),
          source_type: "prototype_hardware",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "frames.0.source_type",
        }),
      ]),
    );
  });

  it("rejects invalid nested frames", () => {
    const result = validateObjectiveRawBatch({
      ...validBatch,
      frames: [
        {
          ...makeFrame(15040),
          frame: {
            pc_timestamp: "2026-05-30T13:56:10.124Z",
            gsr_raw: 2405,
            relapse_risk: "high",
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "frames.0",
        }),
      ]),
    );
  });

  it("assert helper throws on invalid raw batches", () => {
    expect(() =>
      assertObjectiveRawBatch({
        ...validBatch,
        source_type: "",
      }),
    ).toThrow("Invalid objective raw batch");
  });
});
