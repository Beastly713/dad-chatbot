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
  extractPpgImuTemperatureFeatures,
  extractPpgImuTemperatureFeaturesForWindows
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

function pulseWave(espTimeMs: number): number {
  const cycleMs = 800;
  const phase = ((espTimeMs % cycleMs) / cycleMs) * Math.PI * 2;

  return Math.max(0, Math.sin(phase));
}

function ecgValueAt(espTimeMs: number): number {
  const cycleMs = 800;
  const phase = espTimeMs % cycleMs;
  const distance = Math.min(phase, cycleMs - phase);
  const peak = distance <= 35 ? 1050 * (1 - distance / 35) : 0;

  return Math.round(2000 + peak);
}

function makeEnvelope(
  espTimeMs: number,
  overrides: Partial<ObjectiveRawFrameEnvelope["frame"]> = {},
  staleFields: RawSensorFieldName[] = []
): ObjectiveRawFrameEnvelope {
  const pulse = pulseWave(espTimeMs);
  const seconds = espTimeMs / 1000;
  const frame = {
    pc_timestamp: new Date(
      Date.UTC(2026, 4, 30, 13, 56, 10, espTimeMs)
    ).toISOString(),
    esp_time_ms: espTimeMs,
    ecg_raw: ecgValueAt(espTimeMs),
    gsr_raw: Math.round(2400 + seconds * 3),
    max_red: Math.round(210 + pulse * 18),
    max_ir: Math.round(260 + pulse * 32),
    max_green: Math.round(44 + pulse * 12),
    accel_x: 0.06,
    accel_y: 0.04,
    accel_z: 9.81,
    gyro_x: 0.01,
    gyro_y: 0.01,
    gyro_z: 0.01,
    mpu_temp_c: 28.1 + seconds * 0.002,
    tmp117_temp_c: 32.2 + seconds * 0.004,
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

  for (let espTimeMs = 0; espTimeMs < 12000; espTimeMs += 100) {
    frames.push(makeEnvelope(espTimeMs));
  }

  const [foundation] = buildObjectiveFeatureWindows({
    batches: [makeBatch(frames)],
    window_duration_ms: 12000,
    step_ms: 12000,
    expected_sample_interval_ms: 100,
    min_frames_per_window: 20
  });

  return extractEcgGsrFeatures(foundation);
}

describe("PPG, IMU, and temperature feature extraction", () => {
  it("extracts PPG technical pulse features without computing SpO2", () => {
    const window = extractPpgImuTemperatureFeatures(makeCleanWindow());

    expect(window.features.ppg).toEqual(
      expect.objectContaining({
        modality: "ppg",
        best_channel: "max_ir",
        suppression: {
          suppressed: false,
          reasons: []
        }
      })
    );

    expect(window.features.ppg?.pulse_rate_bpm).toBeGreaterThan(60);
    expect(window.features.ppg?.pulse_rate_bpm).toBeLessThan(90);
    expect(window.features.ppg?.pulse_interval_median_ms).toBeGreaterThan(600);
    expect(window.features.ppg?.waveform_quality_score).toBeGreaterThan(0.25);
    expect(window.features.ppg?.ecg_ppg_pulse_interval_agreement).toBeGreaterThan(0.7);

    const serialized = JSON.stringify(window).toLowerCase();

    expect(serialized).not.toContain("spo2");
    expect(serialized).not.toContain("oxygen");
    expect(serialized).not.toContain("saturation");
  });

  it("extracts IMU motion and activity-like confound features", () => {
    const frames: ObjectiveRawFrameEnvelope[] = [];

    for (let espTimeMs = 0; espTimeMs < 6000; espTimeMs += 100) {
      const movement = espTimeMs >= 2000 && espTimeMs < 5000 ? 2.4 : 0;

      frames.push(
        makeEnvelope(espTimeMs, {
          accel_x: movement,
          accel_y: movement * 0.5,
          accel_z: 9.81 + movement * 0.25,
          gyro_x: movement * 0.12,
          gyro_y: movement * 0.08,
          gyro_z: movement * 0.05
        })
      );
    }

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 6000,
      step_ms: 6000,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 20
    });

    const window = extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));

    expect(window.features.imu).toEqual(
      expect.objectContaining({
        modality: "imu",
        suppression: {
          suppressed: false,
          reasons: []
        }
      })
    );

    expect(window.features.imu?.motion_magnitude_mean).toBeGreaterThan(9.7);
    expect(window.features.imu?.motion_magnitude_max).toBeGreaterThan(10);
    expect(window.features.imu?.jerk_mean).not.toBeNull();
    expect(window.features.imu?.gyro_magnitude_mean).toBeGreaterThan(0);
    expect(window.features.imu?.stillness_fraction).toBeLessThan(1);
    expect(window.features.imu?.activity_like_confound_index).toBeGreaterThan(0);
  });

  it("extracts TMP117 local temperature and MPU board-temperature technical features", () => {
    const window = extractPpgImuTemperatureFeatures(makeCleanWindow());

    expect(window.features.temperature).toEqual(
      expect.objectContaining({
        modality: "temperature",
        suppression: {
          suppressed: false,
          reasons: []
        }
      })
    );

    expect(window.features.temperature?.tmp117_trend_c_per_min).toBeGreaterThan(0);
    expect(window.features.temperature?.tmp117_contact_shift_c).toBeGreaterThan(0);
    expect(
      window.features.temperature?.mpu_board_heating_indicator_c_per_min
    ).toBeGreaterThan(0);
    expect(window.features.temperature?.local_temperature_quality_score).toBeGreaterThan(0.8);
    expect(window.features.temperature?.board_temperature_quality_score).toBeGreaterThan(0.8);

    const serialized = JSON.stringify(window).toLowerCase();

    expect(serialized).toContain("mpu_board_heating_indicator");
    expect(serialized).not.toContain("body_temperature");
    expect(serialized).not.toContain("core_temperature");
    expect(serialized).not.toContain("fever");
  });

  it("suppresses poor PPG quality without creating clinical outputs", () => {
    const frames = [
      makeEnvelope(0, { max_red: undefined, max_ir: undefined, max_green: undefined }, [
        "max_red",
        "max_ir",
        "max_green"
      ]),
      makeEnvelope(100, { max_red: undefined, max_ir: undefined, max_green: undefined }, [
        "max_red",
        "max_ir",
        "max_green"
      ]),
      makeEnvelope(200, { max_red: undefined, max_ir: undefined, max_green: undefined }, [
        "max_red",
        "max_ir",
        "max_green"
      ])
    ];

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 500,
      step_ms: 500,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 2
    });

    const window = extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));

    expect(window.features.ppg?.suppression.suppressed).toBe(true);
    expect(window.features.ppg?.suppression.reasons).toContain("ppg_unavailable");
    expect(window.features.ppg?.best_channel).toBeNull();
    expect(window.features.ppg?.pulse_rate_bpm).toBeNull();
    expect(window.features.ppg?.ecg_ppg_pulse_interval_agreement).toBeNull();
    expect(window.uncertainty_reasons).toContain("ppg_unavailable");
  });

  it("suppresses poor IMU quality but keeps feature shape safe", () => {
    const frames = [
      makeEnvelope(
        0,
        {
          accel_x: undefined,
          accel_y: undefined,
          accel_z: undefined,
          gyro_x: undefined,
          gyro_y: undefined,
          gyro_z: undefined
        },
        ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"]
      ),
      makeEnvelope(
        100,
        {
          accel_x: undefined,
          accel_y: undefined,
          accel_z: undefined,
          gyro_x: undefined,
          gyro_y: undefined,
          gyro_z: undefined
        },
        ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"]
      )
    ];

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 500,
      step_ms: 500,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 1
    });

    const window = extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));

    expect(window.features.imu?.suppression.suppressed).toBe(true);
    expect(window.features.imu?.suppression.reasons).toContain("imu_unavailable");
    expect(window.features.imu?.motion_magnitude_mean).toBeNull();
    expect(window.features.imu?.activity_like_confound_index).toBe(0);
  });

  it("suppresses local temperature features when TMP117 data is unavailable", () => {
    const frames = [
      makeEnvelope(0, { tmp117_temp_c: undefined }, ["tmp117_temp_c"]),
      makeEnvelope(100, { tmp117_temp_c: undefined }, ["tmp117_temp_c"]),
      makeEnvelope(200, { tmp117_temp_c: undefined }, ["tmp117_temp_c"])
    ];

    const [foundation] = buildObjectiveFeatureWindows({
      batches: [makeBatch(frames)],
      window_duration_ms: 500,
      step_ms: 500,
      expected_sample_interval_ms: 100,
      min_frames_per_window: 1
    });

    const window = extractPpgImuTemperatureFeatures(extractEcgGsrFeatures(foundation));

    expect(window.features.temperature?.suppression.suppressed).toBe(true);
    expect(window.features.temperature?.suppression.reasons).toContain(
      "temperature_partial_availability"
    );
    expect(window.features.temperature?.tmp117_trend_c_per_min).toBeNull();
    expect(window.features.temperature?.tmp117_contact_shift_c).toBeNull();
    expect(
      window.features.temperature?.mpu_board_heating_indicator_c_per_min
    ).not.toBeNull();
  });

  it("extracts PPG/IMU/temperature features across multiple windows", () => {
    const first = makeCleanWindow();
    const second = makeCleanWindow();

    const windows = extractPpgImuTemperatureFeaturesForWindows([first, second]);

    expect(windows).toHaveLength(2);
    expect(windows[0].features.ppg).toBeDefined();
    expect(windows[0].features.imu).toBeDefined();
    expect(windows[0].features.temperature).toBeDefined();
    expect(windows[1].features.ppg).toBeDefined();
    expect(windows[1].features.imu).toBeDefined();
    expect(windows[1].features.temperature).toBeDefined();
  });

  it("keeps PPG/IMU/temperature output non-diagnostic and clinician-only", () => {
    const window = extractPpgImuTemperatureFeatures(makeCleanWindow());
    const serialized = JSON.stringify(window);
    const lower = serialized.toLowerCase();

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
        path: "packages/objective-preprocessing/src/ppgImuTemperatureFeatures.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
