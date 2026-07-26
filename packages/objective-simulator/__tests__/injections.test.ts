import {
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
  generateObjectiveRawBatch,
  generateObjectiveRawFrameEnvelopes,
  generateObjectiveScenarioTimeline
} from "../src/index.js";

function makeFramesForScenario(scenario_id: string) {
  const timeline = generateObjectiveScenarioTimeline({
    scenario_id,
    seed: 77,
    duration_ms: 100000,
    start_esp_time_ms: 1000
  });

  return generateObjectiveRawFrameEnvelopes({
    timeline,
    session_id: "session-1",
    device_id: "device-1",
    device_boot_id: "boot-1",
    sample_interval_ms: 1000,
    start_pc_timestamp: "2026-05-30T13:56:10.124Z"
  });
}

describe("objective simulator artifact/dropout/conflict/reset injection", () => {
  it("keeps injected motion artifact frames schema-valid and raw-only", () => {
    const frames = makeFramesForScenario("motion_artifact");

    expect(frames.length).toBeGreaterThan(0);

    for (const frame of frames) {
      expect(() => assertObjectiveRawFrameEnvelope(frame)).not.toThrow();
    }

    const motionLikeFrames = frames.filter(
      (frame) =>
        Math.abs(frame.frame.accel_x ?? 0) > 1 ||
        Math.abs(frame.frame.gyro_x ?? 0) > 0.08 ||
        Math.abs(frame.frame.gyro_y ?? 0) > 0.08
    );

    expect(motionLikeFrames.length).toBeGreaterThan(0);
  });

  it("adds poor-contact style held/stale field state without exposing phase labels", () => {
    const frames = makeFramesForScenario("poor_contact");

    const limitedFrames = frames.filter(
      (frame) => frame.held_fields.length > 0 || frame.stale_fields.length > 0
    );

    expect(limitedFrames.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(frames);

    expect(serialized).not.toContain("phase_type");
    expect(serialized).not.toContain("scenario_id");
    expect(serialized).not.toContain("relative_intensity");
    expect(serialized).not.toContain("developer_labels_visible");
  });

  it("adds sparse sensor dropout using stale fields and sparse frames", () => {
    const frames = makeFramesForScenario("sensor_dropout");

    const sparseFrames = frames.filter(
      (frame) =>
        frame.stale_fields.length > 0 ||
        frame.frame.ecg_raw === undefined ||
        frame.frame.gsr_raw === undefined ||
        frame.frame.max_ir === undefined ||
        frame.frame.tmp117_temp_c === undefined
    );

    expect(sparseFrames.length).toBeGreaterThan(0);

    for (const frame of sparseFrames) {
      expect(frame.frame.pc_timestamp).toBeTruthy();
      expect(Number.isFinite(frame.frame.esp_time_ms)).toBe(true);
      expect(frame.stale_fields.length).toBeGreaterThan(0);
      expect(() => assertObjectiveRawFrameEnvelope(frame)).not.toThrow();
    }
  });

  it("adds timing gaps by omitting scheduled samples while preserving valid frames", () => {
    const frames = makeFramesForScenario("device_reset_or_timing_gap");

    const positiveDeltas = frames
      .slice(1)
      .map((frame, index) => frame.frame.esp_time_ms - frames[index].frame.esp_time_ms)
      .filter((delta) => delta > 0);

    expect(positiveDeltas.some((delta) => delta > 1000)).toBe(true);

    for (const frame of frames) {
      expect(() => assertObjectiveRawFrameEnvelope(frame)).not.toThrow();
    }
  });

  it("adds device-reset timing discontinuity without adding clinician-visible labels", () => {
    const frames = makeFramesForScenario("device_reset_or_timing_gap");

    const hasResetLikeDrop = frames
      .slice(1)
      .some(
        (frame, index) =>
          frame.frame.esp_time_ms < frames[index].frame.esp_time_ms
      );

    expect(hasResetLikeDrop).toBe(true);

    const serialized = JSON.stringify(frames);

    expect(serialized).not.toContain("device_reset_period");
    expect(serialized).not.toContain("timing_gap_period");
    expect(serialized).not.toContain("developer");
    expect(serialized).not.toContain("ground_truth");
  });

  it("adds cross-signal conflict as raw-value changes only", () => {
    const frames = makeFramesForScenario("signal_conflict");

    expect(frames.length).toBeGreaterThan(0);

    const hasEcg = frames.some((frame) => frame.frame.ecg_raw !== undefined);
    const hasGsr = frames.some((frame) => frame.frame.gsr_raw !== undefined);
    const hasPpg = frames.some((frame) => frame.frame.max_ir !== undefined);

    expect(hasEcg).toBe(true);
    expect(hasGsr).toBe(true);
    expect(hasPpg).toBe(true);

    const serialized = JSON.stringify(frames);

    expect(serialized).not.toContain("cross_signal_conflict_period");
    expect(serialized).not.toContain("conflict_label");
    expect(serialized).not.toContain("synthetic_label");
  });

  it("keeps injected raw batches schema-valid", () => {
    const timeline = generateObjectiveScenarioTimeline({
      scenario_id: "sensor_dropout",
      seed: 77,
      duration_ms: 100000,
      start_esp_time_ms: 1000
    });

    const batch = generateObjectiveRawBatch({
      batch_id: "batch-1",
      timeline,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      sample_interval_ms: 1000
    });

    expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
    expect(batch.frames.length).toBeGreaterThan(0);
  });

  it("does not expose unsafe labels, developer-only labels, or clinical claims in injected payloads", () => {
    const scenarios = [
      "motion_artifact",
      "poor_contact",
      "sensor_dropout",
      "signal_conflict",
      "device_reset_or_timing_gap"
    ];

    const frames = scenarios.flatMap((scenario_id) =>
      makeFramesForScenario(scenario_id)
    );

    const serialized = JSON.stringify(frames);

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(serialized).not.toContain("heart_rate");
    expect(serialized).not.toContain("spo2");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("risk_score");
    expect(serialized).not.toContain("developer_effect_trace");
    expect(serialized).not.toContain("private_effect_trace");

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/injections.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
