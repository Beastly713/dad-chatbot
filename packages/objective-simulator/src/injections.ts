import {
  RAW_SENSOR_FIELD_NAMES,
  type ObjectiveRawSensorFrame,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";
import type { ObjectiveSimulatorTimeline } from "./timeline.js";
import type { ObjectiveSimulatorTimelinePhase } from "./timeline.js";

const TIMING_FIELDS: readonly RawSensorFieldName[] = [
  "pc_timestamp",
  "esp_time_ms"
];

const ECG_FIELDS: readonly RawSensorFieldName[] = ["ecg_raw"];
const GSR_FIELDS: readonly RawSensorFieldName[] = ["gsr_raw"];
const PPG_FIELDS: readonly RawSensorFieldName[] = [
  "max_red",
  "max_ir",
  "max_green"
];
const TEMPERATURE_CONTACT_FIELDS: readonly RawSensorFieldName[] = [
  "tmp117_temp_c"
];

export type ObjectiveSimulatorInjectionInput = {
  frame: ObjectiveRawSensorFrame;
  timeline: ObjectiveSimulatorTimeline;
  phase: ObjectiveSimulatorTimelinePhase;
  scheduled_esp_time_ms: number;
  effective_esp_time_ms: number;
  sample_index: number;
  sample_interval_ms: number;
  seed: number;
};

export type ObjectiveSimulatorInjectionResult = {
  frame: ObjectiveRawSensorFrame;
  updated_fields: RawSensorFieldName[];
  held_fields: RawSensorFieldName[];
  stale_fields: RawSensorFieldName[];
};

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

function orderedUniqueFields(
  fields: readonly RawSensorFieldName[]
): RawSensorFieldName[] {
  const set = new Set(fields);

  return RAW_SENSOR_FIELD_NAMES.filter((fieldName) => set.has(fieldName));
}

function presentFields(frame: ObjectiveRawSensorFrame): RawSensorFieldName[] {
  return RAW_SENSOR_FIELD_NAMES.filter(
    (fieldName) => frame[fieldName] !== undefined
  );
}

function removeFields(
  frame: ObjectiveRawSensorFrame,
  fields: readonly RawSensorFieldName[],
  staleFields: Set<RawSensorFieldName>
): void {
  for (const fieldName of fields) {
    if (TIMING_FIELDS.includes(fieldName)) {
      continue;
    }

    if (frame[fieldName] !== undefined) {
      delete frame[fieldName];
      staleFields.add(fieldName);
    }
  }
}

function holdFields(
  frame: ObjectiveRawSensorFrame,
  fields: readonly RawSensorFieldName[],
  heldFields: Set<RawSensorFieldName>
): void {
  for (const fieldName of fields) {
    if (TIMING_FIELDS.includes(fieldName)) {
      continue;
    }

    if (frame[fieldName] !== undefined) {
      heldFields.add(fieldName);
    }
  }
}

function applyEcgLeadNoise(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  if (frame.ecg_raw === undefined) {
    return;
  }

  const noise =
    deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1101) * 420;
  const oscillation =
    Math.sin(input.scheduled_esp_time_ms / 18) *
    (120 + input.phase.relative_intensity * 160);

  frame.ecg_raw = clampInteger(frame.ecg_raw + noise + oscillation, 0, 4095);
}

function applyGsrContactJump(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  if (frame.gsr_raw === undefined) {
    return;
  }

  const jumpDirection =
    deterministicNoise(input.seed, input.phase.start_esp_time_ms, 1201) >= 0
      ? 1
      : -1;
  const jumpMagnitude = 260 + input.phase.relative_intensity * 160;
  const smallNoise =
    deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1202) * 14;

  frame.gsr_raw = clampInteger(
    frame.gsr_raw + jumpDirection * jumpMagnitude + smallNoise,
    0,
    4095
  );
}

function applyPpgMotionCorruption(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  const corruption =
    deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1301) *
    (55 + input.phase.relative_intensity * 75);
  const inverseCorruption =
    deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1302) *
    (40 + input.phase.relative_intensity * 65);

  if (frame.max_red !== undefined) {
    frame.max_red = clampInteger(frame.max_red + corruption, 0, 262143);
  }

  if (frame.max_ir !== undefined) {
    frame.max_ir = clampInteger(frame.max_ir - inverseCorruption, 0, 262143);
  }

  if (frame.max_green !== undefined) {
    frame.max_green = clampInteger(frame.max_green + corruption * 0.6, 0, 262143);
  }
}

function applyTemperatureContactShift(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  if (frame.tmp117_temp_c !== undefined) {
    const shift =
      -0.9 -
      input.phase.relative_intensity * 0.55 +
      deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1401) * 0.06;

    frame.tmp117_temp_c = roundTo(frame.tmp117_temp_c + shift, 3);
  }

  if (frame.mpu_temp_c !== undefined) {
    const boardDrift =
      deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1402) * 0.025;

    frame.mpu_temp_c = roundTo(frame.mpu_temp_c + boardDrift, 3);
  }
}

function amplifyMotionContext(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  const motionBurst =
    1.4 +
    input.phase.relative_intensity * 1.8 +
    Math.abs(deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1501));

  if (frame.accel_x !== undefined) {
    frame.accel_x = roundTo(frame.accel_x + motionBurst, 6);
  }

  if (frame.accel_y !== undefined) {
    frame.accel_y = roundTo(frame.accel_y - motionBurst * 0.65, 6);
  }

  if (frame.gyro_x !== undefined) {
    frame.gyro_x = roundTo(frame.gyro_x + motionBurst * 0.09, 6);
  }

  if (frame.gyro_y !== undefined) {
    frame.gyro_y = roundTo(frame.gyro_y - motionBurst * 0.07, 6);
  }

  if (frame.gyro_z !== undefined) {
    frame.gyro_z = roundTo(frame.gyro_z + motionBurst * 0.05, 6);
  }
}

function applyCrossSignalConflict(
  frame: ObjectiveRawSensorFrame,
  input: ObjectiveSimulatorInjectionInput
): void {
  if (frame.ecg_raw !== undefined) {
    frame.ecg_raw = clampInteger(
      frame.ecg_raw -
        180 +
        deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1601) * 35,
      0,
      4095
    );
  }

  if (frame.gsr_raw !== undefined) {
    frame.gsr_raw = clampInteger(
      frame.gsr_raw +
        280 +
        deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1602) * 45,
      0,
      4095
    );
  }

  if (frame.max_ir !== undefined) {
    frame.max_ir = clampInteger(
      frame.max_ir +
        deterministicNoise(input.seed, input.scheduled_esp_time_ms, 1603) * 85,
      0,
      262143
    );
  }
}

function shouldApplySparseDropout(sampleIndex: number): boolean {
  return sampleIndex % 4 === 0;
}

function shouldApplySecondarySparseDropout(sampleIndex: number): boolean {
  return sampleIndex % 6 === 0;
}

export function shouldEmitObjectiveSimulatorSample(
  input: Pick<
    ObjectiveSimulatorInjectionInput,
    "phase" | "scheduled_esp_time_ms" | "sample_interval_ms"
  >
): boolean {
  if (input.phase.phase_type !== "timing_gap_period") {
    return true;
  }

  const phaseDurationMs =
    input.phase.end_esp_time_ms - input.phase.start_esp_time_ms;
  const elapsedInPhaseMs =
    input.scheduled_esp_time_ms - input.phase.start_esp_time_ms;
  const gapDurationMs = Math.min(
    input.sample_interval_ms * 5,
    Math.max(input.sample_interval_ms, phaseDurationMs - input.sample_interval_ms)
  );

  return elapsedInPhaseMs === 0 || elapsedInPhaseMs > gapDurationMs;
}

export function resolveObjectiveSimulatorEspTimeMs(
  timeline: ObjectiveSimulatorTimeline,
  scheduledEspTimeMs: number
): number {
  const resetPhase = timeline.phases.find(
    (phase) => phase.phase_type === "device_reset_period"
  );

  if (!resetPhase || scheduledEspTimeMs < resetPhase.start_esp_time_ms) {
    return scheduledEspTimeMs;
  }

  return scheduledEspTimeMs - resetPhase.start_esp_time_ms;
}

export function applyObjectiveSimulatorFrameInjections(
  input: ObjectiveSimulatorInjectionInput
): ObjectiveSimulatorInjectionResult {
  const frame: ObjectiveRawSensorFrame = { ...input.frame };
  const heldFields = new Set<RawSensorFieldName>();
  const staleFields = new Set<RawSensorFieldName>();

  switch (input.phase.phase_type) {
    case "movement_confound_period": {
      amplifyMotionContext(frame, input);
      applyEcgLeadNoise(frame, input);
      applyPpgMotionCorruption(frame, input);
      break;
    }

    case "signal_quality_limitation_period": {
      applyEcgLeadNoise(frame, input);
      applyGsrContactJump(frame, input);
      applyTemperatureContactShift(frame, input);

      holdFields(frame, TEMPERATURE_CONTACT_FIELDS, heldFields);

      if (shouldApplySparseDropout(input.sample_index)) {
        removeFields(frame, PPG_FIELDS, staleFields);
      }

      if (shouldApplySecondarySparseDropout(input.sample_index)) {
        removeFields(frame, ECG_FIELDS, staleFields);
      }

      break;
    }

    case "sensor_dropout_period": {
      if (shouldApplySparseDropout(input.sample_index)) {
        removeFields(frame, [...GSR_FIELDS, ...PPG_FIELDS], staleFields);
      }

      if (shouldApplySecondarySparseDropout(input.sample_index)) {
        removeFields(frame, [...ECG_FIELDS, ...TEMPERATURE_CONTACT_FIELDS], staleFields);
      }

      break;
    }

    case "cross_signal_conflict_period": {
      applyCrossSignalConflict(frame, input);
      break;
    }

    default:
      break;
  }

  const staleFieldList = orderedUniqueFields([...staleFields]);
  const heldFieldList = orderedUniqueFields([...heldFields]);
  const unavailableFields = new Set<RawSensorFieldName>([
    ...staleFieldList,
    ...heldFieldList
  ]);

  const updatedFields = presentFields(frame).filter(
    (fieldName) => !unavailableFields.has(fieldName)
  );

  return {
    frame,
    updated_fields: updatedFields,
    held_fields: heldFieldList,
    stale_fields: staleFieldList
  };
}
