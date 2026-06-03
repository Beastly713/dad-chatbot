import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import {
  applyObjectiveBaselineRelativeFeatures,
  applyObjectiveBaselineRelativeFeaturesForWindows,
  buildObjectiveFeatureWindows,
  createObjectiveSessionBaselineProfile,
  extractEcgGsrFeatures,
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
    gsr_offset?: number;
    gsr_slope?: number;
    ppg_cycle_ms?: number;
    motion_offset?: number;
    tmp117_slope?: number;
  } = {}
): ObjectiveRawFrameEnvelope {
  const ecgCycleMs = options.ecg_cycle_ms ?? 800;
  const ppgCycleMs = options.ppg_cycle_ms ?? ecgCycleMs;
  const pulse = pulseWave(espTimeMs, ppgCycleMs);
  const seconds = espTimeMs / 1000;
  const motionOffset = options.motion_offset ?? 0;
  const tmp117Slope = options.tmp117_slope ?? 0.004;

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
    gyro_x: 0.01 + motionOffset * 0.04,
    gyro_y: 0.01 + motionOffset * 0.03,
    gyro_z: 0.01 + motionOffset * 0.02,
    mpu_temp_c: 28.1 + seconds * 0.002,
    tmp117_temp_c: 32.2 + seconds * tmp117Slope
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
  frameOptions: Parameters<typeof makeEnvelope>[1] = {},
  startEspTimeMs = 0
): ObjectiveRawBatch {
  const frames: ObjectiveRawFrameEnvelope[] = [];

  for (let offset = 0; offset < 10000; offset += 100) {
    frames.push(makeEnvelope(startEspTimeMs + offset, frameOptions));
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

function makeFeatureWindow(
  batch: ObjectiveRawBatch,
  windowStart = 0,
  windowDuration = 10000
) {
  const windows = buildObjectiveFeatureWindows({
    batches: [batch],
    window_duration_ms: windowDuration,
    step_ms: windowDuration,
    expected_sample_interval_ms: 100,
    min_frames_per_window: 20
  });

  const window = windows.find(
    (candidate) => candidate.start_esp_time_ms === windowStart
  ) ?? windows[0];

  return extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(window));
}

describe("objective baseline manager", () => {
  it("creates a session baseline profile from usable feature windows", () => {
    const baselineWindows = [
      makeFeatureWindow(makeBatch("baseline-1", {}, 0)),
      makeFeatureWindow(makeBatch("baseline-2", {}, 10000), 10000)
    ];

    const profile = createObjectiveSessionBaselineProfile({
      baseline_profile_id: "baseline-profile-1",
      windows: baselineWindows,
      min_usable_windows: 2
    });

    expect(profile).toEqual(
      expect.objectContaining({
        baseline_profile_id: "baseline-profile-1",
        session_id: "session-1",
        source_type: "simulator",
        visibility: {
          clinician_visible: true,
          patient_visible: false,
          chatbot_visible: false
        }
      })
    );

    expect(profile.created_from_feature_window_ids).toHaveLength(2);
    expect(profile.baseline_quality.state).toBe("available");
    expect(profile.baseline_quality.quality_score).toBeGreaterThan(0.9);
    expect(profile.baseline_features.ecg_median_hr_bpm).toBeGreaterThan(60);
    expect(profile.baseline_features.ppg_pulse_rate_bpm).toBeGreaterThan(60);
  });

  it("applies baseline-relative deltas to later windows", () => {
    const baselineWindows = [
      makeFeatureWindow(makeBatch("baseline-1", {}, 0)),
      makeFeatureWindow(makeBatch("baseline-2", {}, 10000), 10000)
    ];
    const profile = createObjectiveSessionBaselineProfile({
      baseline_profile_id: "baseline-profile-1",
      windows: baselineWindows,
      min_usable_windows: 2
    });
    const currentWindow = makeFeatureWindow(
      makeBatch("current-1", {
        ecg_cycle_ms: 500,
        gsr_offset: 120,
        gsr_slope: 9,
        ppg_cycle_ms: 500,
        motion_offset: 1.2,
        tmp117_slope: 0.009
      })
    );

    const enriched = applyObjectiveBaselineRelativeFeatures(currentWindow, profile);

    expect("baseline_state" in enriched.baseline_relative).toBe(true);

    if (!("baseline_state" in enriched.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(enriched.baseline_relative.baseline_state).toBe("available");
    expect(enriched.baseline_relative.baseline_profile_id).toBe(
      "baseline-profile-1"
    );
    expect(enriched.baseline_relative.readiness_confidence_modifier).toBe(1);
    expect(enriched.baseline_relative.ecg_median_hr_delta_bpm).toBeGreaterThan(0);
    expect(
      enriched.baseline_relative.gsr_tonic_baseline_deviation_delta_raw
    ).toBeGreaterThan(0);
    expect(enriched.baseline_relative.ppg_pulse_rate_delta_bpm).toBeGreaterThan(0);
    expect(enriched.baseline_relative.motion_magnitude_delta).toBeGreaterThan(0);
  });

  it("marks no-baseline state and reduces readiness confidence", () => {
    const currentWindow = makeFeatureWindow(makeBatch("current-1"));
    const enriched = applyObjectiveBaselineRelativeFeatures(currentWindow);

    if (!("baseline_state" in enriched.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(enriched.baseline_relative.baseline_state).toBe("unavailable");
    expect(enriched.baseline_relative.readiness_confidence_modifier).toBeLessThan(1);
    expect(enriched.baseline_relative.no_baseline_reason).toBe(
      "baseline_unavailable"
    );
    expect(enriched.uncertainty_reasons).toContain("baseline_unavailable");
  });

  it("marks limited baseline and reduces readiness confidence", () => {
    const baselineWindows = [makeFeatureWindow(makeBatch("baseline-1"))];
    const profile = createObjectiveSessionBaselineProfile({
      baseline_profile_id: "baseline-profile-1",
      windows: baselineWindows,
      min_usable_windows: 2
    });
    const currentWindow = makeFeatureWindow(makeBatch("current-1"));
    const enriched = applyObjectiveBaselineRelativeFeatures(currentWindow, profile);

    expect(profile.baseline_quality.state).toBe("limited");

    if (!("baseline_state" in enriched.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(enriched.baseline_relative.baseline_state).toBe("limited");
    expect(enriched.baseline_relative.readiness_confidence_modifier).toBeLessThan(1);
    expect(enriched.uncertainty_reasons).toContain("baseline_limited");
  });

  it("applies baseline-relative features across multiple windows", () => {
    const baselineWindow = makeFeatureWindow(makeBatch("baseline-1"));
    const profile = createObjectiveSessionBaselineProfile({
      baseline_profile_id: "baseline-profile-1",
      windows: [baselineWindow],
      min_usable_windows: 1
    });

    const currentWindows = [
      makeFeatureWindow(makeBatch("current-1")),
      makeFeatureWindow(makeBatch("current-2"))
    ];

    const enriched = applyObjectiveBaselineRelativeFeaturesForWindows(
      currentWindows,
      profile
    );

    expect(enriched).toHaveLength(2);

    for (const window of enriched) {
      expect("baseline_state" in window.baseline_relative).toBe(true);
    }
  });
});
