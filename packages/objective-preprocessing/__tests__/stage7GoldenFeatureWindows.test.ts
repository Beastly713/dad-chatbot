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
  applyObjectiveBaselineRelativeFeatures,
  buildObjectiveFeatureWindows,
  createObjectiveSessionBaselineProfile,
  extractEcgGsrFeatures,
  extractObjectiveCrossSignalFeatures,
  extractPpgImuTemperatureFeatures,
  type ObjectiveFeatureWindowFoundation,
  type ObjectiveSessionBaselineProfile
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

type GoldenScenario =
  | "baseline"
  | "elevated_arousal_pattern"
  | "motion_confound"
  | "poor_contact"
  | "signal_conflict"
  | "suppressed_window";

type GoldenFrameOptions = {
  ecg_cycle_ms: number;
  ppg_cycle_ms: number;
  gsr_slope_raw_per_second: number;
  gsr_start_raw: number;
  motion_offset: number;
  tmp117_slope_c_per_second: number;
  ppg_present: boolean;
  ecg_present: boolean;
  gsr_present: boolean;
  imu_present: boolean;
  temperature_present: boolean;
};

const GOLDEN_OPTIONS: Record<GoldenScenario, GoldenFrameOptions> = {
  baseline: {
    ecg_cycle_ms: 800,
    ppg_cycle_ms: 800,
    gsr_slope_raw_per_second: 3,
    gsr_start_raw: 2400,
    motion_offset: 0,
    tmp117_slope_c_per_second: 0.004,
    ppg_present: true,
    ecg_present: true,
    gsr_present: true,
    imu_present: true,
    temperature_present: true
  },
  elevated_arousal_pattern: {
    ecg_cycle_ms: 500,
    ppg_cycle_ms: 500,
    gsr_slope_raw_per_second: 15,
    gsr_start_raw: 2400,
    motion_offset: 0.2,
    tmp117_slope_c_per_second: 0.006,
    ppg_present: true,
    ecg_present: true,
    gsr_present: true,
    imu_present: true,
    temperature_present: true
  },
  motion_confound: {
    ecg_cycle_ms: 500,
    ppg_cycle_ms: 500,
    gsr_slope_raw_per_second: 12,
    gsr_start_raw: 2400,
    motion_offset: 4.5,
    tmp117_slope_c_per_second: 0.006,
    ppg_present: true,
    ecg_present: true,
    gsr_present: true,
    imu_present: true,
    temperature_present: true
  },
  poor_contact: {
    ecg_cycle_ms: 800,
    ppg_cycle_ms: 800,
    gsr_slope_raw_per_second: 3,
    gsr_start_raw: 2400,
    motion_offset: 0,
    tmp117_slope_c_per_second: 0.004,
    ppg_present: false,
    ecg_present: false,
    gsr_present: true,
    imu_present: true,
    temperature_present: true
  },
  signal_conflict: {
    ecg_cycle_ms: 500,
    ppg_cycle_ms: 1100,
    gsr_slope_raw_per_second: -4,
    gsr_start_raw: 2500,
    motion_offset: 0.1,
    tmp117_slope_c_per_second: 0.004,
    ppg_present: true,
    ecg_present: true,
    gsr_present: true,
    imu_present: true,
    temperature_present: true
  },
  suppressed_window: {
    ecg_cycle_ms: 800,
    ppg_cycle_ms: 800,
    gsr_slope_raw_per_second: 0,
    gsr_start_raw: 2400,
    motion_offset: 0,
    tmp117_slope_c_per_second: 0,
    ppg_present: false,
    ecg_present: false,
    gsr_present: false,
    imu_present: false,
    temperature_present: false
  }
};

function pulseWave(espTimeMs: number, cycleMs: number): number {
  const phase = ((espTimeMs % cycleMs) / cycleMs) * Math.PI * 2;

  return Math.max(0, Math.sin(phase));
}

function ecgValueAt(espTimeMs: number, cycleMs: number): number {
  const phase = espTimeMs % cycleMs;
  const distance = Math.min(phase, cycleMs - phase);
  const peak = distance <= 35 ? 1100 * (1 - distance / 35) : 0;

  return Math.round(2000 + peak);
}

function updatedFieldsForFrame(
  frame: ObjectiveRawFrameEnvelope["frame"]
): RawSensorFieldName[] {
  return ALL_FIELDS.filter((fieldName) => frame[fieldName] !== undefined);
}

function missingFieldsForFrame(
  frame: ObjectiveRawFrameEnvelope["frame"]
): RawSensorFieldName[] {
  return ALL_FIELDS.filter((fieldName) => frame[fieldName] === undefined);
}

function makeEnvelope(
  espTimeMs: number,
  options: GoldenFrameOptions,
  sequenceOffsetMs = 0
): ObjectiveRawFrameEnvelope {
  const effectiveEspTimeMs = espTimeMs + sequenceOffsetMs;
  const seconds = espTimeMs / 1000;
  const pulse = pulseWave(espTimeMs, options.ppg_cycle_ms);
  const movement = options.motion_offset;

  const frame: ObjectiveRawFrameEnvelope["frame"] = {
    pc_timestamp: new Date(
      Date.UTC(2026, 4, 30, 13, 56, 10, effectiveEspTimeMs)
    ).toISOString(),
    esp_time_ms: effectiveEspTimeMs,
    ...(options.ecg_present
      ? {
          ecg_raw: ecgValueAt(espTimeMs, options.ecg_cycle_ms)
        }
      : {}),
    ...(options.gsr_present
      ? {
          gsr_raw: Math.round(
            options.gsr_start_raw + seconds * options.gsr_slope_raw_per_second
          )
        }
      : {}),
    ...(options.ppg_present
      ? {
          max_red: Math.round(210 + pulse * 18),
          max_ir: Math.round(260 + pulse * 34),
          max_green: Math.round(44 + pulse * 10)
        }
      : {}),
    ...(options.imu_present
      ? {
          accel_x: 0.06 + movement,
          accel_y: 0.04 + movement * 0.6,
          accel_z: 9.81 + movement * 0.25,
          gyro_x: 0.01 + movement * 0.08,
          gyro_y: 0.01 + movement * 0.06,
          gyro_z: 0.01 + movement * 0.04
        }
      : {}),
    ...(options.temperature_present
      ? {
          mpu_temp_c: 28.1 + seconds * 0.002,
          tmp117_temp_c: 32.2 + seconds * options.tmp117_slope_c_per_second
        }
      : {})
  };

  return {
    session_id: "session-golden",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-golden",
    device_boot_id: "boot-golden",
    segment_id: "segment-golden",
    frame,
    updated_fields: updatedFieldsForFrame(frame),
    held_fields: [],
    stale_fields: missingFieldsForFrame(frame)
  };
}

function makeBatch(
  batchId: string,
  scenario: GoldenScenario,
  sequenceOffsetMs = 0,
  durationMs = 12000,
  sampleIntervalMs = 100
): ObjectiveRawBatch {
  const options = GOLDEN_OPTIONS[scenario];
  const frames: ObjectiveRawFrameEnvelope[] = [];

  for (let espTimeMs = 0; espTimeMs < durationMs; espTimeMs += sampleIntervalMs) {
    frames.push(makeEnvelope(espTimeMs, options, sequenceOffsetMs));
  }

  return {
    batch_id: batchId,
    session_id: "session-golden",
    source_type: "simulator",
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: "device-golden",
    device_boot_id: "boot-golden",
    segment_id: "segment-golden",
    frames
  };
}

function buildTechnicalFeatureWindow(
  scenario: GoldenScenario,
  batchId = `batch-${scenario}`,
  sequenceOffsetMs = 0
): ObjectiveFeatureWindowFoundation {
  const [foundation] = buildObjectiveFeatureWindows({
    batches: [makeBatch(batchId, scenario, sequenceOffsetMs)],
    window_duration_ms: 12000,
    step_ms: 12000,
    expected_sample_interval_ms: 100,
    min_frames_per_window: scenario === "suppressed_window" ? 1 : 20
  });

  return extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));
}

function createGoldenBaselineProfile(): ObjectiveSessionBaselineProfile {
  const baselineWindows = [
    buildTechnicalFeatureWindow("baseline", "baseline-1", 0),
    buildTechnicalFeatureWindow("baseline", "baseline-2", 12000)
  ];

  return createObjectiveSessionBaselineProfile({
    baseline_profile_id: "golden-baseline-profile",
    windows: baselineWindows,
    min_usable_windows: 2
  });
}

function buildGoldenWindow(
  scenario: GoldenScenario,
  baselineProfile?: ObjectiveSessionBaselineProfile
): ObjectiveFeatureWindowFoundation {
  const technicalWindow = buildTechnicalFeatureWindow(scenario);
  const baselineWindow = applyObjectiveBaselineRelativeFeatures(
    technicalWindow,
    baselineProfile
  );

  return extractObjectiveCrossSignalFeatures(baselineWindow);
}

function expectClinicianOnly(window: ObjectiveFeatureWindowFoundation): void {
  expect(window.visibility).toEqual({
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false
  });
}

function expectNoClinicalOrChatbotLeakage(
  payload: unknown,
  path = "packages/objective-preprocessing/__tests__/stage7GoldenFeatureWindows.test.ts"
): void {
  const serialized = JSON.stringify(payload);
  const lower = serialized.toLowerCase();

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
    "treatment",
    "detox",
    "medication",
    "ciwa",
    "spo2",
    "oxygen",
    "saturation",
    "body_temperature",
    "core_temperature",
    "fever",
    "predicted_class",
    "model_version",
    "interpretation",
    "dashboard",
    "chatbot_visible\":true",
    "patient_visible\":true"
  ]) {
    expect(lower).not.toContain(forbiddenPhrase);
  }

  const violations = findForbiddenObjectiveTermViolations([
    {
      path,
      surface: "source",
      content: serialized
    }
  ]);

  expect(violations).toEqual([]);
}

describe("Stage 7 golden feature-window scenarios", () => {
  it("golden baseline scenario produces ready low-conflict clinician-only window", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("baseline", baselineProfile);

    expect(window.window_status).toBe("ready");
    expect(window.features.ecg?.suppression.suppressed).toBe(false);
    expect(window.features.gsr?.suppression.suppressed).toBe(false);
    expect(window.features.ppg?.suppression.suppressed).toBe(false);
    expect(window.features.imu?.suppression.suppressed).toBe(false);
    expect(window.features.temperature?.suppression.suppressed).toBe(false);

    if (!("baseline_state" in window.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(window.baseline_relative.baseline_state).toBe("available");
    expect(window.baseline_relative.readiness_confidence_modifier).toBe(1);
    expect(
      Math.abs(window.baseline_relative.ecg_median_hr_delta_bpm ?? 0)
    ).toBeLessThan(2);
    expect(
      Math.abs(
        window.baseline_relative.gsr_tonic_baseline_deviation_delta_raw ?? 0
      )
    ).toBeLessThan(5);

    expect(window.cross_signal?.hr_gsr_agreement_state).toBe("agreement");
    expect(window.cross_signal?.ecg_ppg_agreement_state).toBe("agreement");
    expect(window.cross_signal?.high_motion_confound_present).toBe(false);
    expect(window.cross_signal?.signal_conflict_score).toBeLessThanOrEqual(0.1);

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden elevated arousal pattern produces positive baseline-relative technical deltas", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("elevated_arousal_pattern", baselineProfile);

    if (!("baseline_state" in window.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(window.baseline_relative.baseline_state).toBe("available");
    expect(window.baseline_relative.ecg_median_hr_delta_bpm).toBeGreaterThan(20);
    expect(window.baseline_relative.ppg_pulse_rate_delta_bpm).toBeGreaterThan(20);
    expect(
      window.baseline_relative.gsr_tonic_baseline_deviation_delta_raw
    ).toBeGreaterThan(20);

    expect(window.cross_signal?.hr_gsr_agreement_state).toBe("agreement");
    expect(window.cross_signal?.ecg_ppg_agreement_state).toBe("agreement");
    expect(window.cross_signal?.signal_conflict_score).toBeLessThan(0.5);

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden motion confound scenario flags motion uncertainty without clinical output", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("motion_confound", baselineProfile);

    expect(window.features.imu?.activity_like_confound_index).toBeGreaterThanOrEqual(
      0.45
    );
    expect(window.cross_signal?.high_motion_confound_present).toBe(true);
    expect(window.cross_signal?.motion_confound_index).toBeGreaterThanOrEqual(0.45);
    expect(window.uncertainty_reasons).toContain("high_motion_confound");
    expect(window.cross_signal?.signal_conflict_score).toBeGreaterThan(0);

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden poor-contact scenario suppresses poor ECG/PPG while preserving uncertainty", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("poor_contact", baselineProfile);

    expect(window.features.ecg?.suppression.suppressed).toBe(true);
    expect(window.features.ppg?.suppression.suppressed).toBe(true);
    expect(window.features.gsr?.suppression.suppressed).toBe(false);
    expect(window.features.imu?.suppression.suppressed).toBe(false);
    expect(window.features.temperature?.suppression.suppressed).toBe(false);

    expect(window.modality_availability.ecg.state).toBe("unavailable");
    expect(window.modality_availability.ppg.state).toBe("unavailable");
    expect(window.uncertainty_reasons).toContain("ecg_unavailable");
    expect(window.uncertainty_reasons).toContain("ppg_unavailable");
    expect(window.cross_signal?.ecg_ppg_agreement_state).toBe("unavailable");

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden signal-conflict scenario marks disagreement as uncertainty only", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("signal_conflict", baselineProfile);

    expect(window.cross_signal?.hr_gsr_agreement_state).toBe("divergence");
    expect(window.cross_signal?.ecg_ppg_agreement_state).toBe("disagreement");
    expect(window.cross_signal?.signal_conflict_score).toBeGreaterThanOrEqual(0.35);
    expect(window.uncertainty_reasons).toContain("hr_gsr_divergence");
    expect(window.uncertainty_reasons).toContain("ecg_ppg_disagreement");

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden no-baseline mode lowers readiness confidence and adds uncertainty", () => {
    const window = buildGoldenWindow("elevated_arousal_pattern");

    if (!("baseline_state" in window.baseline_relative)) {
      throw new Error("baseline_relative was not enriched");
    }

    expect(window.baseline_relative.baseline_state).toBe("unavailable");
    expect(window.baseline_relative.readiness_confidence_modifier).toBeLessThan(1);
    expect(window.baseline_relative.no_baseline_reason).toBe("baseline_unavailable");
    expect(window.uncertainty_reasons).toContain("baseline_unavailable");
    expect(window.uncertainty_reasons).toContain("baseline_confidence_limited");

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden suppressed window stays schema-safe with suppressed technical features", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const window = buildGoldenWindow("suppressed_window", baselineProfile);

    expect(window.features.ecg?.suppression.suppressed).toBe(true);
    expect(window.features.gsr?.suppression.suppressed).toBe(true);
    expect(window.features.ppg?.suppression.suppressed).toBe(true);
    expect(window.features.imu?.suppression.suppressed).toBe(true);
    expect(window.features.temperature?.suppression.suppressed).toBe(true);

    expect(window.features.ecg?.mean_hr_bpm).toBeNull();
    expect(window.features.gsr?.tonic_trend_raw_per_min).toBeNull();
    expect(window.features.ppg?.pulse_rate_bpm).toBeNull();
    expect(window.features.imu?.motion_magnitude_mean).toBeNull();
    expect(window.features.temperature?.tmp117_trend_c_per_min).toBeNull();

    expect(window.cross_signal?.hr_gsr_agreement_state).toBe("unavailable");
    expect(window.cross_signal?.ecg_ppg_agreement_state).toBe("unavailable");
    expect(window.uncertainty_reasons.length).toBeGreaterThan(0);

    expectClinicianOnly(window);
    expectNoClinicalOrChatbotLeakage(window);
  });

  it("golden scenario snapshots preserve stable high-level shapes", () => {
    const baselineProfile = createGoldenBaselineProfile();
    const scenarios: GoldenScenario[] = [
      "baseline",
      "elevated_arousal_pattern",
      "motion_confound",
      "poor_contact",
      "signal_conflict",
      "suppressed_window"
    ];

    const summaries = Object.fromEntries(
      scenarios.map((scenario) => {
        const window = buildGoldenWindow(scenario, baselineProfile);

        if (!("baseline_state" in window.baseline_relative)) {
          throw new Error(`baseline_relative missing for ${scenario}`);
        }

        return [
          scenario,
          {
            window_status: window.window_status,
            baseline_state: window.baseline_relative.baseline_state,
            ecg_suppressed: window.features.ecg?.suppression.suppressed,
            gsr_suppressed: window.features.gsr?.suppression.suppressed,
            ppg_suppressed: window.features.ppg?.suppression.suppressed,
            imu_suppressed: window.features.imu?.suppression.suppressed,
            temperature_suppressed:
              window.features.temperature?.suppression.suppressed,
            hr_gsr_state: window.cross_signal?.hr_gsr_agreement_state,
            ecg_ppg_state: window.cross_signal?.ecg_ppg_agreement_state,
            high_motion_confound:
              window.cross_signal?.high_motion_confound_present,
            clinician_visible: window.visibility.clinician_visible,
            patient_visible: window.visibility.patient_visible,
            chatbot_visible: window.visibility.chatbot_visible
          }
        ];
      })
    );

    expect(summaries).toEqual({
      baseline: {
        window_status: "ready",
        baseline_state: "available",
        ecg_suppressed: false,
        gsr_suppressed: false,
        ppg_suppressed: false,
        imu_suppressed: false,
        temperature_suppressed: false,
        hr_gsr_state: "agreement",
        ecg_ppg_state: "agreement",
        high_motion_confound: false,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      },
      elevated_arousal_pattern: {
        window_status: "ready",
        baseline_state: "available",
        ecg_suppressed: false,
        gsr_suppressed: false,
        ppg_suppressed: false,
        imu_suppressed: false,
        temperature_suppressed: false,
        hr_gsr_state: "agreement",
        ecg_ppg_state: "agreement",
        high_motion_confound: false,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      },
      motion_confound: {
        window_status: "ready",
        baseline_state: "available",
        ecg_suppressed: false,
        gsr_suppressed: false,
        ppg_suppressed: false,
        imu_suppressed: false,
        temperature_suppressed: false,
        hr_gsr_state: "agreement",
        ecg_ppg_state: "agreement",
        high_motion_confound: true,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      },
      poor_contact: {
        window_status: "ready",
        baseline_state: "available",
        ecg_suppressed: true,
        gsr_suppressed: false,
        ppg_suppressed: true,
        imu_suppressed: false,
        temperature_suppressed: false,
        hr_gsr_state: "unavailable",
        ecg_ppg_state: "unavailable",
        high_motion_confound: false,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      },
      signal_conflict: {
        window_status: "ready",
        baseline_state: "available",
        ecg_suppressed: false,
        gsr_suppressed: false,
        ppg_suppressed: false,
        imu_suppressed: false,
        temperature_suppressed: false,
        hr_gsr_state: "divergence",
        ecg_ppg_state: "disagreement",
        high_motion_confound: false,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      },
      suppressed_window: {
        window_status: "insufficient_data",
        baseline_state: "available",
        ecg_suppressed: true,
        gsr_suppressed: true,
        ppg_suppressed: true,
        imu_suppressed: true,
        temperature_suppressed: true,
        hr_gsr_state: "unavailable",
        ecg_ppg_state: "unavailable",
        high_motion_confound: false,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      }
    });

    expectNoClinicalOrChatbotLeakage(summaries);
  });
});
