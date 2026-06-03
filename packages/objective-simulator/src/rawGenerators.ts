import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  RAW_SENSOR_FIELD_NAMES,
  assertObjectiveRawBatch,
  assertObjectiveRawFrameEnvelope,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type ObjectiveRawSensorFrame
} from "@dad-chatbot/objective-schemas";
import {
  OBJECTIVE_SIMULATOR_SOURCE_TYPE,
  type ObjectiveSimulatorBaselineParameters,
  type ObjectiveSimulatorScenarioId
} from "./types.js";
import { getObjectiveSimulatorScenarioProfile } from "./scenarios.js";
import {
  type ObjectiveSimulatorTimeline,
  type ObjectiveSimulatorTimelinePhase
} from "./timeline.js";
import {
  applyObjectiveSimulatorFrameInjections,
  resolveObjectiveSimulatorEspTimeMs,
  shouldEmitObjectiveSimulatorSample
} from "./injections.js";

export type ObjectiveRawSensorGeneratorInput = {
  esp_time_ms: number;
  seed: number;
  timeline: ObjectiveSimulatorTimeline;
  phase: ObjectiveSimulatorTimelinePhase;
  baseline_parameters: ObjectiveSimulatorBaselineParameters;
};

export type GenerateObjectiveRawFramesOptions = {
  timeline: ObjectiveSimulatorTimeline;
  session_id: string;
  device_id: string;
  device_boot_id: string;
  segment_id?: string;
  sample_interval_ms: number;
  start_pc_timestamp?: string;
};

export type GenerateObjectiveRawBatchOptions =
  GenerateObjectiveRawFramesOptions & {
    batch_id: string;
  };

type Max30101PpgRaw = {
  max_red: number;
  max_ir: number;
  max_green: number;
};

type Mpu6050MotionRaw = {
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
};

type TemperatureRaw = {
  mpu_temp_c: number;
  tmp117_temp_c: number;
};

const DEFAULT_START_PC_TIMESTAMP = "2026-05-30T13:56:10.000Z";

function assertNonEmptyString(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;

  return Math.round(value * scale) / scale;
}

function deterministicNoise(seed: number, espTimeMs: number, salt: number): number {
  const raw =
    Math.sin(seed * 12.9898 + espTimeMs * 0.001 + salt * 78.233) * 43758.5453;

  return (raw - Math.floor(raw)) * 2 - 1;
}

function phaseElapsedMs(
  espTimeMs: number,
  phase: ObjectiveSimulatorTimelinePhase
): number {
  return Math.max(0, espTimeMs - phase.start_esp_time_ms);
}

function timelineElapsedMs(
  espTimeMs: number,
  timeline: ObjectiveSimulatorTimeline
): number {
  return Math.max(0, espTimeMs - timeline.start_esp_time_ms);
}

function findPhaseForEspTime(
  timeline: ObjectiveSimulatorTimeline,
  espTimeMs: number
): ObjectiveSimulatorTimelinePhase {
  const matchingPhase = timeline.phases.find(
    (phase) =>
      espTimeMs >= phase.start_esp_time_ms &&
      espTimeMs < phase.end_esp_time_ms
  );

  return matchingPhase ?? timeline.phases[timeline.phases.length - 1];
}

function formatPcTimestamp(startPcTimestamp: string, offsetMs: number): string {
  const startMs = Date.parse(startPcTimestamp);

  if (!Number.isFinite(startMs)) {
    throw new Error("start_pc_timestamp must be parseable as a date-time string");
  }

  return new Date(startMs + offsetMs).toISOString();
}

function pulseCycleMs(input: ObjectiveRawSensorGeneratorInput): number {
  const noise = deterministicNoise(input.seed, input.esp_time_ms, 101);
  const intensityShiftMs = input.phase.relative_intensity * 120;

  return Math.max(
    520,
    Math.round(
      input.baseline_parameters.ecg_cycle_ms -
        intensityShiftMs +
        input.baseline_parameters.ecg_variability_ms * noise * 0.2
    )
  );
}

function positivePulseWave(
  input: ObjectiveRawSensorGeneratorInput,
  cycleMs: number
): number {
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const phase = ((elapsed + input.seed * 17) % cycleMs) / cycleMs;
  const sinusoid = Math.sin(phase * Math.PI * 2);

  return Math.max(0, sinusoid);
}

export function generateAd8232EcgRaw(
  input: ObjectiveRawSensorGeneratorInput
): number {
  const cycleMs = pulseCycleMs(input);
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const shiftedElapsed = elapsed + input.seed * 19;
  const beatPhaseMs = shiftedElapsed % cycleMs;
  const distanceFromPeakMs = Math.min(beatPhaseMs, cycleMs - beatPhaseMs);
  const peakWindowMs = 28;
  const peakShape =
    distanceFromPeakMs <= peakWindowMs
      ? 1 - distanceFromPeakMs / peakWindowMs
      : 0;

  const baselineWander =
    Math.sin(elapsed / 1300) * 26 +
    Math.sin(elapsed / 4100) * 18 +
    input.phase.relative_intensity * 35;
  const noise = deterministicNoise(input.seed, input.esp_time_ms, 201) * 18;
  const rPeak = peakShape * 950;

  return clampInteger(1960 + baselineWander + noise + rPeak, 0, 4095);
}

export function generateTinyGsrRaw(
  input: ObjectiveRawSensorGeneratorInput
): number {
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const phaseElapsed = phaseElapsedMs(input.esp_time_ms, input.phase);
  const gradualPhaseResponse =
    (1 - Math.exp(-phaseElapsed / 18000)) * input.phase.relative_intensity * 95;
  const slowTrend = Math.sin(elapsed / 45000) * 22;
  const noise = deterministicNoise(input.seed, input.esp_time_ms, 301) * 5;

  return clampInteger(
    input.baseline_parameters.gsr_tonic_raw +
      input.phase.relative_intensity * 150 +
      gradualPhaseResponse +
      slowTrend +
      noise,
    0,
    4095
  );
}

export function generateMax30101PpgRaw(
  input: ObjectiveRawSensorGeneratorInput
): Max30101PpgRaw {
  const cycleMs = pulseCycleMs(input);
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const pulse = positivePulseWave(input, cycleMs);
  const lowFrequencyDrift = Math.sin(elapsed / 9000) * 6;
  const base = input.baseline_parameters.ppg_ir_baseline_raw;
  const amplitude = 28 + input.phase.relative_intensity * 14;

  const irNoise = deterministicNoise(input.seed, input.esp_time_ms, 401) * 3;
  const redNoise = deterministicNoise(input.seed, input.esp_time_ms, 402) * 3;
  const greenNoise = deterministicNoise(input.seed, input.esp_time_ms, 403) * 2;

  return {
    max_red: clampInteger(
      base * 0.82 + pulse * amplitude * 0.78 + redNoise,
      0,
      262143
    ),
    max_ir: clampInteger(
      base + pulse * amplitude + lowFrequencyDrift + irNoise,
      0,
      262143
    ),
    max_green: clampInteger(
      base * 0.18 + pulse * amplitude * 0.45 + greenNoise,
      0,
      262143
    )
  };
}

export function generateMpu6050MotionRaw(
  input: ObjectiveRawSensorGeneratorInput
): Mpu6050MotionRaw {
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const movementScale =
    input.phase.phase_type === "movement_confound_period"
      ? 1.1 + input.phase.relative_intensity
      : 0.06 + input.phase.relative_intensity * 0.16;

  const accelNoiseX =
    deterministicNoise(input.seed, input.esp_time_ms, 501) * movementScale;
  const accelNoiseY =
    deterministicNoise(input.seed, input.esp_time_ms, 502) * movementScale;
  const accelNoiseZ =
    deterministicNoise(input.seed, input.esp_time_ms, 503) * movementScale * 0.7;

  const oscillation = Math.sin(elapsed / 850) * movementScale;

  return {
    accel_x: roundTo(accelNoiseX + oscillation * 0.4, 6),
    accel_y: roundTo(accelNoiseY + oscillation * 0.3, 6),
    accel_z: roundTo(
      input.baseline_parameters.motion_baseline_mps2 + accelNoiseZ,
      6
    ),
    gyro_x: roundTo(
      deterministicNoise(input.seed, input.esp_time_ms, 601) *
        movementScale *
        0.08,
      6
    ),
    gyro_y: roundTo(
      deterministicNoise(input.seed, input.esp_time_ms, 602) *
        movementScale *
        0.08,
      6
    ),
    gyro_z: roundTo(
      deterministicNoise(input.seed, input.esp_time_ms, 603) *
        movementScale *
        0.08,
      6
    )
  };
}

export function generateTemperatureRaw(
  input: ObjectiveRawSensorGeneratorInput
): TemperatureRaw {
  const elapsed = timelineElapsedMs(input.esp_time_ms, input.timeline);
  const slowDrift = Math.sin(elapsed / 120000) * 0.12;
  const localContactShift = input.phase.relative_intensity * 0.08;
  const tmpNoise = deterministicNoise(input.seed, input.esp_time_ms, 701) * 0.025;
  const mpuNoise = deterministicNoise(input.seed, input.esp_time_ms, 702) * 0.04;

  return {
    mpu_temp_c: roundTo(
      28.2 + slowDrift + input.phase.relative_intensity * 0.05 + mpuNoise,
      3
    ),
    tmp117_temp_c: roundTo(
      input.baseline_parameters.local_skin_temp_c +
        slowDrift +
        localContactShift +
        tmpNoise,
      3
    )
  };
}

export function generateObjectiveRawSensorFrame(
  input: ObjectiveRawSensorGeneratorInput
): ObjectiveRawSensorFrame {
  return {
    pc_timestamp: "",
    esp_time_ms: input.esp_time_ms,
    ecg_raw: generateAd8232EcgRaw(input),
    gsr_raw: generateTinyGsrRaw(input),
    ...generateMax30101PpgRaw(input),
    ...generateMpu6050MotionRaw(input),
    ...generateTemperatureRaw(input)
  };
}

export function generateObjectiveRawFrameEnvelopes(
  options: GenerateObjectiveRawFramesOptions
): ObjectiveRawFrameEnvelope[] {
  assertNonEmptyString(options.session_id, "session_id");
  assertNonEmptyString(options.device_id, "device_id");
  assertNonEmptyString(options.device_boot_id, "device_boot_id");
  assertPositiveInteger(options.sample_interval_ms, "sample_interval_ms");

  const startPcTimestamp =
    options.start_pc_timestamp ?? DEFAULT_START_PC_TIMESTAMP;
  const scenarioId: ObjectiveSimulatorScenarioId = options.timeline.scenario_id;
  const profile = getObjectiveSimulatorScenarioProfile(scenarioId);
  const frames: ObjectiveRawFrameEnvelope[] = [];
  let sampleIndex = 0;

  for (
    let scheduledEspTimeMs = options.timeline.start_esp_time_ms;
    scheduledEspTimeMs < options.timeline.end_esp_time_ms;
    scheduledEspTimeMs += options.sample_interval_ms
  ) {
    const phase = findPhaseForEspTime(options.timeline, scheduledEspTimeMs);

    if (
      !shouldEmitObjectiveSimulatorSample({
        phase,
        scheduled_esp_time_ms: scheduledEspTimeMs,
        sample_interval_ms: options.sample_interval_ms
      })
    ) {
      sampleIndex += 1;
      continue;
    }

    const effectiveEspTimeMs = resolveObjectiveSimulatorEspTimeMs(
      options.timeline,
      scheduledEspTimeMs
    );

    const frame = generateObjectiveRawSensorFrame({
      esp_time_ms: effectiveEspTimeMs,
      seed: options.timeline.seed,
      timeline: options.timeline,
      phase,
      baseline_parameters: profile.baseline_parameters
    });

    frame.pc_timestamp = formatPcTimestamp(
      startPcTimestamp,
      scheduledEspTimeMs - options.timeline.start_esp_time_ms
    );

    const injectedFrame = applyObjectiveSimulatorFrameInjections({
      frame,
      timeline: options.timeline,
      phase,
      scheduled_esp_time_ms: scheduledEspTimeMs,
      effective_esp_time_ms: effectiveEspTimeMs,
      sample_index: sampleIndex,
      sample_interval_ms: options.sample_interval_ms,
      seed: options.timeline.seed
    });

    const envelope: ObjectiveRawFrameEnvelope = {
      session_id: options.session_id,
      source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
      schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
      device_id: options.device_id,
      device_boot_id: options.device_boot_id,
      ...(options.segment_id ? { segment_id: options.segment_id } : {}),
      frame: injectedFrame.frame,
      updated_fields: injectedFrame.updated_fields,
      held_fields: injectedFrame.held_fields,
      stale_fields: injectedFrame.stale_fields
    };

    frames.push(assertObjectiveRawFrameEnvelope(envelope));
    sampleIndex += 1;
  }

  if (frames.length === 0) {
    throw new Error("timeline duration produced no raw frames");
  }

  return frames;
}

export function generateObjectiveRawBatch(
  options: GenerateObjectiveRawBatchOptions
): ObjectiveRawBatch {
  assertNonEmptyString(options.batch_id, "batch_id");

  const frames = generateObjectiveRawFrameEnvelopes(options);

  const batch = {
    batch_id: options.batch_id,
    session_id: options.session_id,
    source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
    schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    device_id: options.device_id,
    device_boot_id: options.device_boot_id,
    ...(options.segment_id ? { segment_id: options.segment_id } : {}),
    frames
  };

  return assertObjectiveRawBatch(batch);
}
