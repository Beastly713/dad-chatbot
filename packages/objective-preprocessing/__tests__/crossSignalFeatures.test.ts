import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import {
  applyObjectiveBaselineRelativeFeatures,
  buildObjectiveFeatureWindows,
  createObjectiveSessionBaselineProfile,
  extractEcgGsrFeatures,
  extractObjectiveCrossSignalFeatures,
  extractObjectiveCrossSignalFeaturesForWindows,
  extractPpgImuTemperatureFeatures
} from "../src/index.js";

const ALL_FIELDS: RawSensorFieldName[] = [
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

function pulseWave(espTimeMs: number, cycleMs: number): number {
  const phase = ((espTimeMs % cycleMs) / cycleMs) * Math.PI * 2;

  return Math.max(0, Math.sin(phase));
}

function ecgValueAt(espTimeMs: number, cycleMs: number): number {
  const phase = espTimeMs % cycleMs;
  const distance = Math.min(phase, cycleMs - phase);
  const peak = distance <= 35 ? 1050 * (1 - distance / 35) : 0;

  return Math.round(2000 + peak);
}

function makeEnvelope(
  espTimeMs: number,
  options: {
    ecg_cycle_ms?: number;
    ppg_cycle_ms?: number;
    gsr_offset?: number;
    gsr_slope?: number;
    motion_offset?: number;
  } = {}
): ObjectiveRawFrameEnvelope {
  const ecgCycleMs = options.ecg_cycle_ms ?? 800;
  const ppgCycleMs = options.ppg_cycle_ms ?? ecgCycleMs;
  const pulse = pulseWave(espTimeMs, ppgCycleMs);
  const seconds = espTimeMs / 1000;
  const motionOffset = options.motion_offset ?? 0;

  const frame = {
    pc_timestamp: new Date(
      Date.UTC(2026, 4, 30, 13, 56, 10, espTimeMs)
    ).toISOString(),
    esp_time_ms: espTimeMs,
    ecg_raw: ecgValueAt(espTimeMs, ecgCycleMs),
    gsr_raw: Math.round(
      2400 + (options.gsr_offset ?? 0) + seconds * (options.gsr_slope ?? 3)
    ),
    max_red: Math.round(210 + pulse * 18),
    max_ir: Math.round(260 + pulse * 32),
    max_green: Math.round(44 + pulse * 12),
    accel_x: 0.06 + motionOffset,
    accel_y: 0.04 + motionOffset * 0.5,
    accel_z: 9.81 + motionOffset * 0.2,
    gyro_x: 0.01 + motionOffset * 0.08,
    gyro_y: 0.01 + motionOffset * 0.06,
    gyro_z: 0.01 + motionOffset * 0.04,
    mpu_temp_c: 28.1 + seconds * 0.002,
    tmp117_temp_c: 32.2 + seconds * 0.004
  };

  return {
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frame,
    updated_fields: ALL_FIELDS,
    held_fields: [],
    stale_fields: []
  };
}

function makeBatch(
  batchId: string,
  options: Parameters<typeof makeEnvelope>[1] = {}
): ObjectiveRawBatch {
  const frames: ObjectiveRawFrameEnvelope[] = [];

  for (let espTimeMs = 0; espTimeMs < 12000; espTimeMs += 100) {
    frames.push(makeEnvelope(espTimeMs, options));
  }

  return {
    batch_id: batchId,
    session_id: "session-1",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-1",
    device_boot_id: "boot-1",
    segment_id: "segment-1",
    frames
  };
}

function makeFeatureWindow(batch: ObjectiveRawBatch) {
  const [foundation] = buildObjectiveFeatureWindows({
    batches: [batch],
    window_duration_ms: 12000,
    step_ms: 12000,
    expected_sample_interval_ms: 100,
    min_frames_per_window: 20
  });

  return extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));
}

function makeBaselineProfile() {
  const baseline = makeFeatureWindow(makeBatch("baseline"));
  return createObjectiveSessionBaselineProfile({
    baseline_profile_id: "baseline-profile-1",
    windows: [baseline],
    min_usable_windows: 1
  });
}

describe("objective cross-signal feature engine", () => {
  it("marks HR and GSR same-direction change as agreement", () => {
    const baselineProfile = makeBaselineProfile();
    const current = makeFeatureWindow(
      makeBatch("current", {
        ecg_cycle_ms: 500,
        ppg_cycle_ms: 500,
        gsr_offset: 140,
        gsr_slope: 9
      })
    );

    const withBaseline = applyObjectiveBaselineRelativeFeatures(
      current,
      baselineProfile
    );
    const enriched = extractObjectiveCrossSignalFeatures(withBaseline);

    expect(enriched.cross_signal).toBeDefined();
    expect(enriched.cross_signal?.hr_gsr_agreement_state).toBe("agreement");
    expect(enriched.cross_signal?.hr_gsr_agreement_index).toBeGreaterThan(0.55);
    expect(enriched.cross_signal?.signal_conflict_score).toBeLessThan(0.5);
  });

  it("marks HR and GSR opposite-direction change as uncertainty, not diagnosis", () => {
    const baselineProfile = makeBaselineProfile();
    const current = makeFeatureWindow(
      makeBatch("current", {
        ecg_cycle_ms: 500,
        ppg_cycle_ms: 500,
        gsr_offset: -160,
        gsr_slope: 0.1
      })
    );

    const withBaseline = applyObjectiveBaselineRelativeFeatures(
      current,
      baselineProfile
    );
    const enriched = extractObjectiveCrossSignalFeatures(withBaseline);

    expect(enriched.cross_signal?.hr_gsr_agreement_state).toBe("divergence");
    expect(enriched.cross_signal?.signal_conflict_score).toBeGreaterThan(0);
    expect(enriched.uncertainty_reasons).toContain("hr_gsr_divergence");

    const serialized = JSON.stringify(enriched).toLowerCase();

    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("risk_score");
  });

  it("marks high motion as a confound signal", () => {
    const baselineProfile = makeBaselineProfile();
    const current = makeFeatureWindow(
      makeBatch("current", {
        ecg_cycle_ms: 500,
        ppg_cycle_ms: 500,
        gsr_offset: 140,
        gsr_slope: 9,
        motion_offset: 8
      })
    );

    const enriched = extractObjectiveCrossSignalFeatures(
      applyObjectiveBaselineRelativeFeatures(current, baselineProfile)
    );

    expect(enriched.cross_signal?.high_motion_confound_present).toBe(true);
    expect(enriched.cross_signal?.motion_confound_index).toBeGreaterThanOrEqual(0.45);
    expect(enriched.uncertainty_reasons).toContain("high_motion_confound");
  });

  it("marks ECG and PPG agreement and disagreement technically", () => {
    const baselineProfile = makeBaselineProfile();

    const agreeing = extractObjectiveCrossSignalFeatures(
      applyObjectiveBaselineRelativeFeatures(
        makeFeatureWindow(
          makeBatch("agreeing", {
            ecg_cycle_ms: 700,
            ppg_cycle_ms: 700,
            gsr_offset: 120,
            gsr_slope: 9
          })
        ),
        baselineProfile
      )
    );

    const disagreeing = extractObjectiveCrossSignalFeatures(
      applyObjectiveBaselineRelativeFeatures(
        makeFeatureWindow(
          makeBatch("disagreeing", {
            ecg_cycle_ms: 500,
            ppg_cycle_ms: 1300,
            gsr_offset: 120,
            gsr_slope: 9
          })
        ),
        baselineProfile
      )
    );

    expect(agreeing.cross_signal?.ecg_ppg_agreement_state).toBe("agreement");
    expect(disagreeing.cross_signal?.ecg_ppg_agreement_state).toBe(
      "disagreement"
    );
    expect(disagreeing.uncertainty_reasons).toContain("ecg_ppg_disagreement");
  });

  it("adds baseline confidence limitation when no baseline is available", () => {
    const current = makeFeatureWindow(makeBatch("current"));
    const withNoBaseline = applyObjectiveBaselineRelativeFeatures(current);
    const enriched = extractObjectiveCrossSignalFeatures(withNoBaseline);

    expect(enriched.cross_signal?.signal_conflict_score).toBeGreaterThan(0);
    expect(enriched.uncertainty_reasons).toContain("baseline_confidence_limited");
  });

  it("works across multiple windows", () => {
    const baselineProfile = makeBaselineProfile();
    const windows = [
      applyObjectiveBaselineRelativeFeatures(
        makeFeatureWindow(makeBatch("current-1")),
        baselineProfile
      ),
      applyObjectiveBaselineRelativeFeatures(
        makeFeatureWindow(makeBatch("current-2")),
        baselineProfile
      )
    ];

    const enriched = extractObjectiveCrossSignalFeaturesForWindows(windows);

    expect(enriched).toHaveLength(2);
    expect(enriched[0].cross_signal).toBeDefined();
    expect(enriched[1].cross_signal).toBeDefined();
  });

  it("does not emit forbidden clinical labels or chatbot-facing state", () => {
    const baselineProfile = makeBaselineProfile();
    const current = makeFeatureWindow(
      makeBatch("current", {
        ecg_cycle_ms: 500,
        ppg_cycle_ms: 1300,
        gsr_offset: -160,
        gsr_slope: 0.1,
        motion_offset: 8
      })
    );

    const enriched = extractObjectiveCrossSignalFeatures(
      applyObjectiveBaselineRelativeFeatures(current, baselineProfile)
    );
    const serialized = JSON.stringify(enriched);
    const lower = serialized.toLowerCase();

    expect(enriched.visibility).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    });

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    for (const forbiddenPhrase of [
      "craving",
      "relapse",
      "withdrawal",
      "intoxication",
      "diagnosis",
      "risk_score",
      "treatment",
      "detox",
      "medication",
      "ciwa",
      "spo2",
      "oxygen",
      "saturation",
      "body_temperature",
      "core_temperature",
      "fever"
    ]) {
      expect(lower).not.toContain(forbiddenPhrase);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-preprocessing/src/crossSignalFeatures.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
