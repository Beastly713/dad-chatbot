import { assertObjectiveRawBatch } from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_SIMULATOR_SCENARIO_IDS,
  createObjectiveSimulatorScenarioBatches,
  generateObjectiveRawBatch,
  generateObjectiveRawFrameEnvelopes,
  generateObjectiveScenarioTimeline,
  getObjectiveSimulatorScenarioProfile,
  objectiveRawBatchesToCsv
} from "../src/index.js";

type NumericFrameKey =
  | "ecg_raw"
  | "gsr_raw"
  | "max_red"
  | "max_ir"
  | "max_green"
  | "accel_x"
  | "accel_y"
  | "accel_z"
  | "gyro_x"
  | "gyro_y"
  | "gyro_z"
  | "mpu_temp_c"
  | "tmp117_temp_c";

function makeScenarioBatches(options?: {
  scenario_id?: string;
  seed?: number;
  duration_ms?: number;
  sample_interval_ms?: number;
  batch_size_frames?: number;
}) {
  return createObjectiveSimulatorScenarioBatches({
    scenario_id: options?.scenario_id ?? "baseline_rest",
    seed: options?.seed ?? 42,
    duration_ms: options?.duration_ms ?? 10000,
    sample_interval_ms: options?.sample_interval_ms ?? 100,
    batch_size_frames: options?.batch_size_frames ?? 25,
    session_id: "session-stage6",
    device_id: "device-stage6",
    device_boot_id: "boot-stage6",
    batch_id_prefix: "stage6-batch",
    start_esp_time_ms: 1000,
    start_pc_timestamp: "2026-05-30T13:56:10.124Z"
  });
}

function flattenFrames(batches: ReturnType<typeof makeScenarioBatches>) {
  return batches.flatMap((batch) => batch.frames);
}

function numericSeries(
  batches: ReturnType<typeof makeScenarioBatches>,
  key: NumericFrameKey
): number[] {
  return flattenFrames(batches)
    .map((envelope) => envelope.frame[key])
    .filter((value): value is number => typeof value === "number");
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function localPeakIndexes(values: readonly number[]): number[] {
  const indexes: number[] = [];

  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] > values[index - 1] && values[index] >= values[index + 1]) {
      indexes.push(index);
    }
  }

  return indexes;
}

function highAmplitudePeakIndexes(values: readonly number[]): number[] {
  const avg = mean(values);
  const std = standardDeviation(values);
  const threshold = avg + std * 0.75;
  const minimumPeakDistanceSamples = 24;
  const acceptedIndexes: number[] = [];

  for (const index of localPeakIndexes(values)) {
    if (values[index] < threshold) {
      continue;
    }

    const previousIndex = acceptedIndexes.at(-1);

    if (
      previousIndex !== undefined &&
      index - previousIndex < minimumPeakDistanceSamples
    ) {
      if (values[index] > values[previousIndex]) {
        acceptedIndexes[acceptedIndexes.length - 1] = index;
      }

      continue;
    }

    acceptedIndexes.push(index);
  }

  return acceptedIndexes;
}

function countNearbyPeaks(
  anchorIndexes: readonly number[],
  candidateIndexes: readonly number[],
  toleranceSamples: number
): number {
  return anchorIndexes.filter((anchorIndex) =>
    candidateIndexes.some(
      (candidateIndex) => Math.abs(candidateIndex - anchorIndex) <= toleranceSamples
    )
  ).length;
}

function maxAbs(values: readonly number[]): number {
  return Math.max(...values.map((value) => Math.abs(value)));
}

describe("Stage 6 objective simulator regression suite", () => {
  it("same seed gives the same generated stream", () => {
    const first = makeScenarioBatches({
      scenario_id: "elevated_arousal_pattern",
      seed: 123,
      duration_ms: 12000,
      sample_interval_ms: 100,
      batch_size_frames: 20
    });

    const second = makeScenarioBatches({
      scenario_id: "elevated_arousal_pattern",
      seed: 123,
      duration_ms: 12000,
      sample_interval_ms: 100,
      batch_size_frames: 20
    });

    expect(first).toEqual(second);
  });

  it("different seeds produce variation while preserving schema validity", () => {
    const first = makeScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 123,
      duration_ms: 5000,
      sample_interval_ms: 100,
      batch_size_frames: 10
    });

    const second = makeScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 124,
      duration_ms: 5000,
      sample_interval_ms: 100,
      batch_size_frames: 10
    });

    expect(first).not.toEqual(second);

    for (const batch of [...first, ...second]) {
      expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
      expect(batch.source_type).toBe("simulator");
    }

    const firstEcg = numericSeries(first, "ecg_raw");
    const secondEcg = numericSeries(second, "ecg_raw");

    expect(firstEcg).not.toEqual(secondEcg);
  });

  it("covers every required Stage 6 scenario with schema-valid batches", () => {
    expect(OBJECTIVE_SIMULATOR_SCENARIO_IDS).toEqual([
      "baseline_rest",
      "elevated_arousal_pattern",
      "recovery_cooldown",
      "motion_artifact",
      "poor_contact",
      "sensor_dropout",
      "signal_conflict",
      "device_reset_or_timing_gap"
    ]);

    for (const scenarioId of OBJECTIVE_SIMULATOR_SCENARIO_IDS) {
      const profile = getObjectiveSimulatorScenarioProfile(scenarioId);
      const timeline = generateObjectiveScenarioTimeline({
        scenario_id: scenarioId,
        seed: 7,
        duration_ms: 10000,
        start_esp_time_ms: 1000
      });

      const batch = generateObjectiveRawBatch({
        batch_id: `stage6-${scenarioId}`,
        timeline,
        session_id: "session-stage6",
        device_id: "device-stage6",
        device_boot_id: "boot-stage6",
        sample_interval_ms: 100
      });

      expect(profile.scenario_id).toBe(scenarioId);
      expect(timeline.scenario_id).toBe(scenarioId);
      expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
      expect(batch.source_type).toBe("simulator");
      expect(batch.frames.length).toBeGreaterThan(0);
    }
  });

  it("keeps ECG and PPG rough pulse cadence coherent in a clean baseline scenario", () => {
    const batches = makeScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 321,
      duration_ms: 20000,
      sample_interval_ms: 20,
      batch_size_frames: 100
    });

    const ecg = numericSeries(batches, "ecg_raw");
    const ppgIr = numericSeries(batches, "max_ir");

    expect(ecg.length).toBeGreaterThan(500);
    expect(ppgIr.length).toBeGreaterThan(500);

    const ecgPeaks = highAmplitudePeakIndexes(ecg);
    const ppgPeaks = highAmplitudePeakIndexes(ppgIr);

    expect(ecgPeaks.length).toBeGreaterThan(10);
    expect(ppgPeaks.length).toBeGreaterThan(10);

    const peakCountDifference = Math.abs(ecgPeaks.length - ppgPeaks.length);
    expect(peakCountDifference).toBeLessThanOrEqual(5);

    const nearbyPeakCount = countNearbyPeaks(ecgPeaks, ppgPeaks, 18);
    const requiredNearbyPeakCount = Math.floor(
      Math.min(ecgPeaks.length, ppgPeaks.length) * 0.5
    );

    expect(nearbyPeakCount).toBeGreaterThanOrEqual(requiredNearbyPeakCount);
  });

  it("motion artifact scenario affects motion context and ECG/PPG raw variability", () => {
    const baseline = makeScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 55,
      duration_ms: 20000,
      sample_interval_ms: 100,
      batch_size_frames: 50
    });

    const motion = makeScenarioBatches({
      scenario_id: "motion_artifact",
      seed: 55,
      duration_ms: 20000,
      sample_interval_ms: 100,
      batch_size_frames: 50
    });

    const baselineAccelX = numericSeries(baseline, "accel_x");
    const motionAccelX = numericSeries(motion, "accel_x");
    const baselineEcg = numericSeries(baseline, "ecg_raw");
    const motionEcg = numericSeries(motion, "ecg_raw");
    const baselinePpgIr = numericSeries(baseline, "max_ir");
    const motionPpgIr = numericSeries(motion, "max_ir");

    expect(maxAbs(motionAccelX)).toBeGreaterThan(maxAbs(baselineAccelX));
    expect(standardDeviation(motionEcg)).toBeGreaterThan(
      standardDeviation(baselineEcg)
    );
    expect(standardDeviation(motionPpgIr)).toBeGreaterThan(
      standardDeviation(baselinePpgIr)
    );

    const serializedMotion = JSON.stringify(motion);
    expect(serializedMotion).not.toContain("motion_artifact");
    expect(serializedMotion).not.toContain("phase_type");
    expect(serializedMotion).not.toContain("developer_labels_visible");
  });

  it("dropout and poor-contact scenarios remain schema-valid without exposing synthetic ground truth", () => {
    for (const scenarioId of ["poor_contact", "sensor_dropout"] as const) {
      const batches = makeScenarioBatches({
        scenario_id: scenarioId,
        seed: 88,
        duration_ms: 30000,
        sample_interval_ms: 1000,
        batch_size_frames: 10
      });

      const frames = flattenFrames(batches);

      expect(frames.length).toBeGreaterThan(0);
      expect(
        frames.some(
          (frame) =>
            frame.held_fields.length > 0 || frame.stale_fields.length > 0
        )
      ).toBe(true);

      for (const batch of batches) {
        expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
      }

      const serialized = JSON.stringify(batches);

      expect(serialized).not.toContain(scenarioId);
      expect(serialized).not.toContain("phase_type");
      expect(serialized).not.toContain("ground_truth");
      expect(serialized).not.toContain("synthetic_label");
    }
  });

  it("timing-gap and device-reset scenario produces timing discontinuities without unsafe labels", () => {
    const batches = makeScenarioBatches({
      scenario_id: "device_reset_or_timing_gap",
      seed: 99,
      duration_ms: 100000,
      sample_interval_ms: 1000,
      batch_size_frames: 25
    });

    const frames = flattenFrames(batches);
    const espTimes = frames.map((frame) => frame.frame.esp_time_ms);

    const hasLargePositiveGap = espTimes
      .slice(1)
      .some((espTimeMs, index) => espTimeMs - espTimes[index] > 1000);

    const hasResetLikeDrop = espTimes
      .slice(1)
      .some((espTimeMs, index) => espTimeMs < espTimes[index]);

    expect(hasLargePositiveGap).toBe(true);
    expect(hasResetLikeDrop).toBe(true);

    for (const batch of batches) {
      expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
    }

    const serialized = JSON.stringify(batches);

    expect(serialized).not.toContain("device_reset_period");
    expect(serialized).not.toContain("timing_gap_period");
    expect(serialized).not.toContain("ground_truth");
  });

  it("does not emit clinical labels, risk claims, or hidden developer labels in Stage 6 outputs", () => {
    const batches = OBJECTIVE_SIMULATOR_SCENARIO_IDS.flatMap((scenarioId) =>
      makeScenarioBatches({
        scenario_id: scenarioId,
        seed: 44,
        duration_ms: 5000,
        sample_interval_ms: 100,
        batch_size_frames: 25
      })
    );

    const csv = objectiveRawBatchesToCsv(batches);
    const serialized = JSON.stringify({ batches, csv });

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    for (const forbiddenPhrase of [
      "heart_rate",
      "spo2",
      "diagnosis",
      "risk_score",
      "clinical_score",
      "ground_truth",
      "synthetic_label",
      "developer_labels_visible",
      "craving",
      "withdrawal",
      "intoxication",
      "relapse"
    ]) {
      expect(serialized).not.toContain(forbiddenPhrase);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/__tests__/stage6SimulatorRegression.test.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("keeps generated simulator CSV raw-column only", () => {
    const batches = makeScenarioBatches({
      scenario_id: "signal_conflict",
      seed: 66,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 10
    });

    const csv = objectiveRawBatchesToCsv(batches);
    const [header] = csv.trim().split(/\r?\n/);

    expect(header).toBe(
      "pc_timestamp,esp_time_ms,ecg_raw,gsr_raw,max_red,max_ir,max_green,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mpu_temp_c,tmp117_temp_c"
    );

    expect(csv).not.toContain("scenario_id");
    expect(csv).not.toContain("phase_type");
    expect(csv).not.toContain("developer_labels_visible");
    expect(csv).not.toContain("ground_truth");
  });
});
