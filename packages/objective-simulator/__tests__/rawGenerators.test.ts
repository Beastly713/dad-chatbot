import {
  RAW_SENSOR_FIELD_NAMES,
  assertObjectiveRawBatch,
  assertObjectiveRawFrameEnvelope
} from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_SIMULATOR_SCENARIO_IDS,
  generateAd8232EcgRaw,
  generateMax30101PpgRaw,
  generateMpu6050MotionRaw,
  generateObjectiveRawBatch,
  generateObjectiveRawFrameEnvelopes,
  generateObjectiveScenarioTimeline,
  generateTemperatureRaw,
  generateTinyGsrRaw,
  getObjectiveSimulatorScenarioProfile
} from "../src/index.js";

function makeTimeline() {
  return generateObjectiveScenarioTimeline({
    scenario_id: "elevated_arousal_pattern",
    seed: 42,
    duration_ms: 1000,
    start_esp_time_ms: 15040
  });
}

describe("objective simulator raw generators", () => {
  it("generates schema-valid raw frame envelopes", () => {
    const timeline = makeTimeline();

    const frames = generateObjectiveRawFrameEnvelopes({
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      segment_id: "segment-1",
      sample_interval_ms: 100,
      start_pc_timestamp: "2026-05-30T13:56:10.124Z"
    });

    expect(frames).toHaveLength(10);

    for (const frame of frames) {
      expect(() => assertObjectiveRawFrameEnvelope(frame)).not.toThrow();
      expect(frame.session_id).toBe("session-1");
      expect(frame.source_type).toBe("simulator");
      expect(frame.device_id).toBe("device-1");
      expect(frame.device_boot_id).toBe("boot-1");
      expect(frame.segment_id).toBe("segment-1");
    }
  });

  it("generates schema-valid raw batches", () => {
    const timeline = makeTimeline();

    const batch = generateObjectiveRawBatch({
      batch_id: "batch-1",
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      segment_id: "segment-1",
      sample_interval_ms: 100
    });

    expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
    expect(batch.batch_id).toBe("batch-1");
    expect(batch.source_type).toBe("simulator");
    expect(batch.frames).toHaveLength(10);
  });

  it("uses esp_time_ms as the primary monotonic timing axis", () => {
    const timeline = makeTimeline();

    const frames = generateObjectiveRawFrameEnvelopes({
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    expect(frames.map((frame) => frame.frame.esp_time_ms)).toEqual([
      15040,
      15140,
      15240,
      15340,
      15440,
      15540,
      15640,
      15740,
      15840,
      15940
    ]);

    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].frame.esp_time_ms).toBeGreaterThan(
        frames[index - 1].frame.esp_time_ms
      );
    }
  });

  it("includes every raw sensor field without adding phase labels to raw rows", () => {
    const timeline = makeTimeline();

    const [firstFrame] = generateObjectiveRawFrameEnvelopes({
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    for (const fieldName of RAW_SENSOR_FIELD_NAMES) {
      expect(firstFrame.frame[fieldName]).not.toBeUndefined();
    }

    const serializedFrame = JSON.stringify(firstFrame);

    expect(serializedFrame).not.toContain("scenario_id");
    expect(serializedFrame).not.toContain("phase_type");
    expect(serializedFrame).not.toContain("relative_intensity");
    expect(serializedFrame).not.toContain("developer_labels_visible");
  });

  it("keeps raw ADC-like values numeric and bounded", () => {
    const timeline = makeTimeline();

    const frames = generateObjectiveRawFrameEnvelopes({
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    for (const { frame } of frames) {
      expect(Number.isInteger(frame.ecg_raw)).toBe(true);
      expect(Number.isInteger(frame.gsr_raw)).toBe(true);
      expect(Number.isInteger(frame.max_red)).toBe(true);
      expect(Number.isInteger(frame.max_ir)).toBe(true);
      expect(Number.isInteger(frame.max_green)).toBe(true);

      expect(frame.ecg_raw).toBeGreaterThanOrEqual(0);
      expect(frame.ecg_raw).toBeLessThanOrEqual(4095);
      expect(frame.gsr_raw).toBeGreaterThanOrEqual(0);
      expect(frame.gsr_raw).toBeLessThanOrEqual(4095);

      expect(frame.max_red).toBeGreaterThanOrEqual(0);
      expect(frame.max_ir).toBeGreaterThanOrEqual(0);
      expect(frame.max_green).toBeGreaterThanOrEqual(0);

      expect(Number.isFinite(frame.accel_x)).toBe(true);
      expect(Number.isFinite(frame.accel_y)).toBe(true);
      expect(Number.isFinite(frame.accel_z)).toBe(true);
      expect(Number.isFinite(frame.gyro_x)).toBe(true);
      expect(Number.isFinite(frame.gyro_y)).toBe(true);
      expect(Number.isFinite(frame.gyro_z)).toBe(true);
      expect(Number.isFinite(frame.mpu_temp_c)).toBe(true);
      expect(Number.isFinite(frame.tmp117_temp_c)).toBe(true);
    }
  });

  it("exposes sensor-specific generator functions", () => {
    const timeline = makeTimeline();
    const phase = timeline.phases[0];
    const profile = getObjectiveSimulatorScenarioProfile(timeline.scenario_id);
    const input = {
      esp_time_ms: 15040,
      seed: timeline.seed,
      timeline,
      phase,
      baseline_parameters: profile.baseline_parameters
    };

    expect(Number.isInteger(generateAd8232EcgRaw(input))).toBe(true);
    expect(Number.isInteger(generateTinyGsrRaw(input))).toBe(true);

    expect(generateMax30101PpgRaw(input)).toEqual({
      max_red: expect.any(Number),
      max_ir: expect.any(Number),
      max_green: expect.any(Number)
    });

    expect(generateMpu6050MotionRaw(input)).toEqual({
      accel_x: expect.any(Number),
      accel_y: expect.any(Number),
      accel_z: expect.any(Number),
      gyro_x: expect.any(Number),
      gyro_y: expect.any(Number),
      gyro_z: expect.any(Number)
    });

    expect(generateTemperatureRaw(input)).toEqual({
      mpu_temp_c: expect.any(Number),
      tmp117_temp_c: expect.any(Number)
    });
  });

  it("is deterministic for the same timeline and options", () => {
    const timeline = makeTimeline();

    const first = generateObjectiveRawBatch({
      batch_id: "batch-1",
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    const second = generateObjectiveRawBatch({
      batch_id: "batch-1",
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    expect(first).toEqual(second);
  });

  it("supports every Stage 6 scenario with schema-valid raw envelopes", () => {
    for (const scenarioId of OBJECTIVE_SIMULATOR_SCENARIO_IDS) {
      const timeline = generateObjectiveScenarioTimeline({
        scenario_id: scenarioId,
        seed: 5,
        duration_ms: 1000,
        start_esp_time_ms: 1000
      });

      const batch = generateObjectiveRawBatch({
        batch_id: `batch-${scenarioId}`,
        timeline,
        session_id: "session-1",
        device_id: "device-1",
        device_boot_id: "boot-1",
        sample_interval_ms: 100
      });

      expect(batch.frames.length).toBeGreaterThan(0);

      for (const frame of batch.frames) {
        expect(frame.frame.pc_timestamp).toBeTruthy();
        expect(Number.isFinite(frame.frame.esp_time_ms)).toBe(true);

        const rawFieldState = [
          ...frame.updated_fields,
          ...frame.held_fields,
          ...frame.stale_fields
        ];

        expect(rawFieldState).toContain("pc_timestamp");
        expect(rawFieldState).toContain("esp_time_ms");
      }
    }
  });

  it("does not add unsafe or over-claiming labels to generated raw payloads", () => {
    const timeline = makeTimeline();

    const batch = generateObjectiveRawBatch({
      batch_id: "batch-1",
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 100
    });

    const serializedBatch = JSON.stringify(batch);

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serializedBatch).not.toContain(forbidden);
    }

    expect(serializedBatch).not.toContain("heart_rate");
    expect(serializedBatch).not.toContain("spo2");
    expect(serializedBatch).not.toContain("diagnosis");
    expect(serializedBatch).not.toContain("score");

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/rawGenerators.ts",
        surface: "source",
        content: serializedBatch
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects invalid raw generation options", () => {
    const timeline = makeTimeline();

    expect(() =>
      generateObjectiveRawFrameEnvelopes({
        timeline,
        session_id: "",
        device_id: "device-1",
        device_boot_id: "boot-1",
        sample_interval_ms: 100
      })
    ).toThrow("session_id must be a non-empty string");

    expect(() =>
      generateObjectiveRawFrameEnvelopes({
        timeline,
        session_id: "session-1",
        device_id: "device-1",
        device_boot_id: "boot-1",
        sample_interval_ms: 0
      })
    ).toThrow("sample_interval_ms must be a positive integer");

    expect(() =>
      generateObjectiveRawFrameEnvelopes({
        timeline,
        session_id: "session-1",
        device_id: "device-1",
        device_boot_id: "boot-1",
        sample_interval_ms: 100,
        start_pc_timestamp: "not-a-date"
      })
    ).toThrow("start_pc_timestamp must be parseable");
  });
});
