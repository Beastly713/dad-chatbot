import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  buildObjectiveFeatureWindows,
  extractEcgGsrFeatures,
  extractEcgGsrFeaturesForWindows
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

function ecgValueAt(espTimeMs: number): number {
  const cycleMs = 800;
  const phase = espTimeMs % cycleMs;
  const distance = Math.min(phase, cycleMs - phase);
  const peak = distance <= 35 ? 1050 * (1 - distance / 35) : 0;
  const baseline = 2000 + Math.sin(espTimeMs / 900) * 25;

  return Math.round(baseline + peak);
}

function gsrValueAt(espTimeMs: number): number {
  const tonic = 2400 + (espTimeMs / 1000) * 4;
  const phasic =
    espTimeMs === 2200 || espTimeMs === 4200 || espTimeMs === 6200 ? 90 : 0;

  return Math.round(tonic + phasic);
}

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
    ecg_raw: ecgValueAt(espTimeMs),
    gsr_raw: gsrValueAt(espTimeMs),
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
    updated_fields: ALL_FIELDS.filter((fieldName) => frame[fieldName] !== undefined),
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

function makeCleanWindow() {
  const frames: ObjectiveRawFrameEnvelope[] = [];

  for (let espTimeMs = 0; espTimeMs < 10000; espTimeMs += 100) {
    frames.push(makeEnvelope(espTimeMs));
  }

  const [window] = buildObjectiveFeatureWindows({
    batches: [makeBatch(frames)],
    window_duration_ms: 10000,
    step_ms: 10000,
    expected_sample_interval_ms: 100,
    min_frames_per_window: 20
  });

  return window;
}

describe("ECG and GSR feature extraction", () => {
  it("extracts ECG features from a clean technical ECG window", () => {
    const window = extractEcgGsrFeatures(makeCleanWindow());

    expect(window.features.ecg).toEqual(
      expect.objectContaining({
        modality: "ecg",
        suppression: {
          suppressed: false,
          reasons: []
        }
      })
    );

    expect(window.features.ecg?.mean_hr_bpm).toBeGreaterThan(60);
    expect(window.features.ecg?.mean_hr_bpm).toBeLessThan(90);
    expect(window.features.ecg?.median_hr_bpm).toBeGreaterThan(60);
    expect(window.features.ecg?.rr_validity_fraction).toBeGreaterThan(0.8);
    expect(window.features.ecg?.rmssd_ms).not.toBeNull();
    expect(window.features.ecg?.sdnn_ms).not.toBeNull();
    expect(window.features.ecg?.r_peak_count).toBeGreaterThanOrEqual(8);
    expect(window.features.ecg?.r_peak_quality_score).toBeGreaterThan(0.5);
  });

  it("extracts GSR features from a clean technical GSR window", () => {
    const window = extractEcgGsrFeatures(makeCleanWindow());

    expect(window.features.gsr).toEqual(
      expect.objectContaining({
        modality: "gsr",
        suppression: {
          suppressed: false,
          reasons: []
        }
      })
    );

    expect(window.features.gsr?.tonic_trend_raw_per_min).toBeGreaterThan(0);
    expect(window.features.gsr?.tonic_baseline_deviation_raw).toBeGreaterThan(0);
    expect(window.features.gsr?.scr_count).toBeGreaterThanOrEqual(1);
    expect(window.features.gsr?.scr_rate_per_min).toBeGreaterThan(0);
    expect(window.features.gsr?.phasic_area_raw_seconds).toBeGreaterThan(0);
    expect(window.features.gsr?.gsr_quality_score).toBeGreaterThan(0.8);
  });

  it("suppresses ECG features when ECG quality is poor", () => {
    const frames = [
      makeEnvelope(0, { ecg_raw: undefined }, ["ecg_raw"]),
      makeEnvelope(100, { ecg_raw: undefined }, ["ecg_raw"]),
      makeEnvelope(200, { ecg_raw: undefined }, ["ecg_raw"]),
      makeEnvelope(300, { ecg_raw: undefined }, ["ecg_raw"])
    ];

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 500,
      step_ms: 500,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 2
    });

    const window = extractEcgGsrFeatures(foundation);

    expect(window.features.ecg?.suppression.suppressed).toBe(true);
    expect(window.features.ecg?.suppression.reasons).toContain("ecg_unavailable");
    expect(window.features.ecg?.mean_hr_bpm).toBeNull();
    expect(window.features.ecg?.rmssd_ms).toBeNull();
    expect(window.uncertainty_reasons).toContain("ecg_unavailable");
  });

  it("suppresses GSR features when GSR quality is poor", () => {
    const frames = [
      makeEnvelope(0, { gsr_raw: undefined }, ["gsr_raw"]),
      makeEnvelope(100, { gsr_raw: undefined }, ["gsr_raw"]),
      makeEnvelope(200, { gsr_raw: undefined }, ["gsr_raw"])
    ];

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 500,
      step_ms: 500,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 2
    });

    const window = extractEcgGsrFeatures(foundation);

    expect(window.features.gsr?.suppression.suppressed).toBe(true);
    expect(window.features.gsr?.suppression.reasons).toContain("gsr_unavailable");
    expect(window.features.gsr?.tonic_trend_raw_per_min).toBeNull();
    expect(window.features.gsr?.scr_count).toBe(0);
    expect(window.uncertainty_reasons).toContain("gsr_unavailable");
  });

  it("extracts ECG/GSR features across multiple windows", () => {
    const first = makeCleanWindow();
    const second = makeCleanWindow();

    const windows = extractEcgGsrFeaturesForWindows([first, second]);

    expect(windows).toHaveLength(2);
    expect(windows[0].features.ecg).toBeDefined();
    expect(windows[0].features.gsr).toBeDefined();
    expect(windows[1].features.ecg).toBeDefined();
    expect(windows[1].features.gsr).toBeDefined();
  });

  it("keeps feature output non-diagnostic and clinician-only", () => {
    const window = extractEcgGsrFeatures(makeCleanWindow());
    const serialized = JSON.stringify(window);

    expect(window.visibility).toEqual({
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
      "spo2"
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbiddenPhrase);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-preprocessing/src/ecgGsrFeatures.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
