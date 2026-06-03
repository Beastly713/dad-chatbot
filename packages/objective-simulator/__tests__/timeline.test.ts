import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_SIMULATOR_SCENARIO_IDS,
  generateObjectiveScenarioTimeline
} from "../src/index.js";

describe("objective simulator timeline generator", () => {
  it("generates deterministic timelines for the same scenario and seed", () => {
    const first = generateObjectiveScenarioTimeline({
      scenario_id: "elevated_arousal_pattern",
      seed: 42,
      duration_ms: 300000,
      start_esp_time_ms: 1000
    });

    const second = generateObjectiveScenarioTimeline({
      scenario_id: "elevated_arousal_pattern",
      seed: 42,
      duration_ms: 300000,
      start_esp_time_ms: 1000
    });

    expect(first).toEqual(second);
  });

  it("uses esp_time_ms-style boundaries and covers the requested duration", () => {
    const timeline = generateObjectiveScenarioTimeline({
      scenario_id: "recovery_cooldown",
      seed: 7,
      duration_ms: 120000,
      start_esp_time_ms: 5000
    });

    expect(timeline.start_esp_time_ms).toBe(5000);
    expect(timeline.end_esp_time_ms).toBe(125000);
    expect(timeline.duration_ms).toBe(120000);
    expect(timeline.phases[0].start_esp_time_ms).toBe(5000);
    expect(timeline.phases.at(-1)?.end_esp_time_ms).toBe(125000);

    for (const phase of timeline.phases) {
      expect(phase.end_esp_time_ms).toBeGreaterThan(phase.start_esp_time_ms);
    }
  });

  it("keeps timeline and phases clinician-only with developer labels hidden", () => {
    const timeline = generateObjectiveScenarioTimeline({
      scenario_id: "motion_artifact",
      seed: 11,
      duration_ms: 90000
    });

    expect(timeline.visibility).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
      developer_labels_visible: false
    });
    expect(timeline.developer_labels_visible).toBe(false);

    for (const phase of timeline.phases) {
      expect(phase.visibility).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
        developer_labels_visible: false
      });
      expect(phase.developer_labels_visible).toBe(false);
    }
  });

  it("creates timing-gap and device-reset phase labels without generating raw rows", () => {
    const timeline = generateObjectiveScenarioTimeline({
      scenario_id: "device_reset_or_timing_gap",
      seed: 99,
      duration_ms: 100000
    });

    expect(timeline.phases.map((phase) => phase.phase_type)).toEqual([
      "baseline_period",
      "timing_gap_period",
      "device_reset_period",
      "recovery_period"
    ]);

    const serializedTimeline = JSON.stringify(timeline);

    for (const rawFrameKey of [
      "pc_timestamp",
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
    ]) {
      expect(serializedTimeline).not.toContain(rawFrameKey);
    }
  });

  it("supports every Stage 6 scenario id", () => {
    for (const scenarioId of OBJECTIVE_SIMULATOR_SCENARIO_IDS) {
      const timeline = generateObjectiveScenarioTimeline({
        scenario_id: scenarioId,
        seed: 1,
        duration_ms: 60000
      });

      expect(timeline.scenario_id).toBe(scenarioId);
      expect(timeline.phases.length).toBeGreaterThan(0);
    }
  });

  it("does not use forbidden objective terms in generated timeline payloads", () => {
    const timelines = OBJECTIVE_SIMULATOR_SCENARIO_IDS.map((scenarioId) =>
      generateObjectiveScenarioTimeline({
        scenario_id: scenarioId,
        seed: 123,
        duration_ms: 60000
      })
    );

    const serializedTimelines = JSON.stringify(timelines);

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serializedTimelines).not.toContain(forbidden);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/timeline.ts",
        surface: "source",
        content: serializedTimelines
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects invalid timeline options", () => {
    expect(() =>
      generateObjectiveScenarioTimeline({
        scenario_id: "baseline_rest",
        seed: -1,
        duration_ms: 60000
      })
    ).toThrow("seed must be a non-negative integer");

    expect(() =>
      generateObjectiveScenarioTimeline({
        scenario_id: "baseline_rest",
        seed: 1,
        duration_ms: 0
      })
    ).toThrow("duration_ms must be a positive integer");

    expect(() =>
      generateObjectiveScenarioTimeline({
        scenario_id: "not_supported",
        seed: 1,
        duration_ms: 60000
      })
    ).toThrow("Unsupported objective simulator scenario id");
  });
});
