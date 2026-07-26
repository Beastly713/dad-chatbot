// packages/objective-schemas/src/sessionMetadata.ts

import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  assertAllowedObjectiveSourceType,
  type AllowedObjectiveSourceType,
} from "@dad-chatbot/objective-safety";
import type {
  ObjectiveSchemaValidationError,
  ObjectiveSchemaValidationResult,
} from "./rawSensorFrame.js";
import {
  createObjectiveVisibilityFlags,
  normalizeObjectiveVisibilityFlags,
  type ObjectiveVisibilityFlags,
} from "./visibility.js";

export const OBJECTIVE_METADATA_SCHEMA_VERSION = "objective_metadata.v1";

export const OBJECTIVE_SESSION_STATUSES = [
  "created",
  "active",
  "paused",
  "stopped",
  "aborted",
] as const;

export type ObjectiveSessionStatus =
  (typeof OBJECTIVE_SESSION_STATUSES)[number];

export const OBJECTIVE_SEGMENT_REASONS = [
  "session_start",
  "manual_segment",
  "device_reset",
  "timing_gap",
  "source_change",
] as const;

export type ObjectiveSegmentReason =
  (typeof OBJECTIVE_SEGMENT_REASONS)[number];

export type ObjectiveSourceMetadata = {
  schema_version: typeof OBJECTIVE_METADATA_SCHEMA_VERSION;
  source_type: AllowedObjectiveSourceType;
  source_id: string;
  producer_id?: string;
  source_label?: string;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveDeviceBootMetadata = {
  schema_version: typeof OBJECTIVE_METADATA_SCHEMA_VERSION;
  device_id: string;
  device_boot_id: string;
  source_type: AllowedObjectiveSourceType;
  boot_started_at?: string;
  boot_started_esp_time_ms: number;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveSessionMetadata = {
  schema_version: typeof OBJECTIVE_METADATA_SCHEMA_VERSION;
  session_id: string;
  patient_id: string;
  source_type: AllowedObjectiveSourceType;
  status: ObjectiveSessionStatus;
  device_id?: string;
  device_boot_id?: string;
  created_at: string;
  started_at?: string;
  paused_at?: string;
  stopped_at?: string;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveSessionSegmentMetadata = {
  schema_version: typeof OBJECTIVE_METADATA_SCHEMA_VERSION;
  segment_id: string;
  session_id: string;
  device_boot_id: string;
  source_type: AllowedObjectiveSourceType;
  reason: ObjectiveSegmentReason;
  start_esp_time_ms: number;
  end_esp_time_ms?: number;
  start_pc_timestamp?: string;
  end_pc_timestamp?: string;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveSimulatorRunMetadata = {
  schema_version: typeof OBJECTIVE_METADATA_SCHEMA_VERSION;
  simulator_run_id: string;
  session_id: string;
  source_type: "simulator";
  scenario_id: string;
  seed: number;
  started_at: string;
  ended_at?: string;
  developer_labels_visible: false;
  visibility: ObjectiveVisibilityFlags;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasForbiddenClinicalFieldKeys(
  value: Record<string, unknown>,
): ObjectiveSchemaValidationError[] {
  const errors: ObjectiveSchemaValidationError[] = [];

  for (const forbiddenField of FORBIDDEN_OBJECTIVE_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(value, forbiddenField)) {
      errors.push({
        path: forbiddenField,
        message: `Forbidden objective clinical field is not allowed: ${forbiddenField}`,
      });
    }
  }

  return errors;
}

function validateMetadataSchemaVersion(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): void {
  if (record.schema_version !== OBJECTIVE_METADATA_SCHEMA_VERSION) {
    errors.push({
      path: "schema_version",
      message: `schema_version must be ${OBJECTIVE_METADATA_SCHEMA_VERSION}`,
    });
  }
}

function validateRequiredString(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): string | null {
  const value = record[fieldName];

  if (!isNonEmptyString(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be a non-empty string`,
    });

    return null;
  }

  return value;
}

function validateOptionalString(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): string | undefined {
  const value = record[fieldName];

  if (value === undefined) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be a non-empty string when provided`,
    });

    return undefined;
  }

  return value;
}

function validateRequiredNumber(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
  options: { integer?: boolean; min?: number } = {},
): number | null {
  const value = record[fieldName];

  if (!isFiniteNumber(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be a finite number`,
    });

    return null;
  }

  if (options.integer && !Number.isInteger(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an integer`,
    });

    return null;
  }

  if (options.min !== undefined && value < options.min) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be greater than or equal to ${options.min}`,
    });

    return null;
  }

  return value;
}

function validateOptionalNumber(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
  options: { integer?: boolean; min?: number } = {},
): number | undefined {
  if (record[fieldName] === undefined) {
    return undefined;
  }

  return validateRequiredNumber(record, fieldName, errors, options) ?? undefined;
}

function validateSourceType(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveSourceType | null {
  const value = record.source_type;

  if (!isNonEmptyString(value)) {
    errors.push({
      path: "source_type",
      message: "source_type must be a non-empty string",
    });

    return null;
  }

  try {
    return assertAllowedObjectiveSourceType(value);
  } catch {
    errors.push({
      path: "source_type",
      message: `Unsupported objective source type: ${value}`,
    });

    return null;
  }
}

function validateStringEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  fieldName: string,
  allowedValues: T,
  errors: ObjectiveSchemaValidationError[],
): T[number] | null {
  const value = record[fieldName];

  if (!isNonEmptyString(value) || !allowedValues.includes(value as T[number])) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be one of: ${allowedValues.join(", ")}`,
    });

    return null;
  }

  return value;
}

function parseVisibility(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): ObjectiveVisibilityFlags {
  try {
    return normalizeObjectiveVisibilityFlags(record.visibility);
  } catch (error) {
    errors.push({
      path: "visibility",
      message:
        error instanceof Error
          ? error.message
          : "invalid objective visibility flags",
    });

    return createObjectiveVisibilityFlags();
  }
}

function fail<T>(
  errors: ObjectiveSchemaValidationError[],
): ObjectiveSchemaValidationResult<T> {
  return { success: false, data: null, errors };
}

function rejectNonRecord<T>(
  value: unknown,
  label: string,
): ObjectiveSchemaValidationResult<T> | null {
  if (isRecord(value)) {
    return null;
  }

  return {
    success: false,
    data: null,
    errors: [{ path: "$", message: `${label} must be an object` }],
  };
}

export function validateObjectiveSourceMetadata(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveSourceMetadata> {
  const nonRecord = rejectNonRecord<ObjectiveSourceMetadata>(
    value,
    "source metadata",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateMetadataSchemaVersion(record, errors);

  const sourceType = validateSourceType(record, errors);
  const sourceId = validateRequiredString(record, "source_id", errors);
  const producerId = validateOptionalString(record, "producer_id", errors);
  const sourceLabel = validateOptionalString(record, "source_label", errors);
  const visibility = parseVisibility(record, errors);

  if (errors.length > 0 || sourceType === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      source_type: sourceType,
      source_id: sourceId ?? "",
      producer_id: producerId,
      source_label: sourceLabel,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveDeviceBootMetadata(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveDeviceBootMetadata> {
  const nonRecord = rejectNonRecord<ObjectiveDeviceBootMetadata>(
    value,
    "device boot metadata",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateMetadataSchemaVersion(record, errors);

  const deviceId = validateRequiredString(record, "device_id", errors);
  const deviceBootId = validateRequiredString(record, "device_boot_id", errors);
  const sourceType = validateSourceType(record, errors);
  const bootStartedAt = validateOptionalString(record, "boot_started_at", errors);
  const bootStartedEspTimeMs =
    validateRequiredNumber(record, "boot_started_esp_time_ms", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const visibility = parseVisibility(record, errors);

  if (errors.length > 0 || sourceType === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      device_id: deviceId ?? "",
      device_boot_id: deviceBootId ?? "",
      source_type: sourceType,
      boot_started_at: bootStartedAt,
      boot_started_esp_time_ms: bootStartedEspTimeMs,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveSessionMetadata(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveSessionMetadata> {
  const nonRecord = rejectNonRecord<ObjectiveSessionMetadata>(
    value,
    "session metadata",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateMetadataSchemaVersion(record, errors);

  const sessionId = validateRequiredString(record, "session_id", errors);
  const patientId = validateRequiredString(record, "patient_id", errors);
  const sourceType = validateSourceType(record, errors);
  const status = validateStringEnum(
    record,
    "status",
    OBJECTIVE_SESSION_STATUSES,
    errors,
  );
  const deviceId = validateOptionalString(record, "device_id", errors);
  const deviceBootId = validateOptionalString(record, "device_boot_id", errors);
  const createdAt = validateRequiredString(record, "created_at", errors);
  const startedAt = validateOptionalString(record, "started_at", errors);
  const pausedAt = validateOptionalString(record, "paused_at", errors);
  const stoppedAt = validateOptionalString(record, "stopped_at", errors);
  const visibility = parseVisibility(record, errors);

  if (errors.length > 0 || sourceType === null || status === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      session_id: sessionId ?? "",
      patient_id: patientId ?? "",
      source_type: sourceType,
      status,
      device_id: deviceId,
      device_boot_id: deviceBootId,
      created_at: createdAt ?? "",
      started_at: startedAt,
      paused_at: pausedAt,
      stopped_at: stoppedAt,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveSessionSegmentMetadata(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveSessionSegmentMetadata> {
  const nonRecord = rejectNonRecord<ObjectiveSessionSegmentMetadata>(
    value,
    "session segment metadata",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateMetadataSchemaVersion(record, errors);

  const segmentId = validateRequiredString(record, "segment_id", errors);
  const sessionId = validateRequiredString(record, "session_id", errors);
  const deviceBootId = validateRequiredString(record, "device_boot_id", errors);
  const sourceType = validateSourceType(record, errors);
  const reason = validateStringEnum(
    record,
    "reason",
    OBJECTIVE_SEGMENT_REASONS,
    errors,
  );
  const startEspTimeMs =
    validateRequiredNumber(record, "start_esp_time_ms", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const endEspTimeMs = validateOptionalNumber(
    record,
    "end_esp_time_ms",
    errors,
    {
      integer: true,
      min: 0,
    },
  );
  const startPcTimestamp = validateOptionalString(
    record,
    "start_pc_timestamp",
    errors,
  );
  const endPcTimestamp = validateOptionalString(
    record,
    "end_pc_timestamp",
    errors,
  );
  const visibility = parseVisibility(record, errors);

  if (endEspTimeMs !== undefined && endEspTimeMs < startEspTimeMs) {
    errors.push({
      path: "end_esp_time_ms",
      message: "end_esp_time_ms must be greater than or equal to start_esp_time_ms",
    });
  }

  if (errors.length > 0 || sourceType === null || reason === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      segment_id: segmentId ?? "",
      session_id: sessionId ?? "",
      device_boot_id: deviceBootId ?? "",
      source_type: sourceType,
      reason,
      start_esp_time_ms: startEspTimeMs,
      end_esp_time_ms: endEspTimeMs,
      start_pc_timestamp: startPcTimestamp,
      end_pc_timestamp: endPcTimestamp,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveSimulatorRunMetadata(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveSimulatorRunMetadata> {
  const nonRecord = rejectNonRecord<ObjectiveSimulatorRunMetadata>(
    value,
    "simulator run metadata",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateMetadataSchemaVersion(record, errors);

  const simulatorRunId = validateRequiredString(
    record,
    "simulator_run_id",
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const scenarioId = validateRequiredString(record, "scenario_id", errors);
  const seed = validateRequiredNumber(record, "seed", errors, {
    integer: true,
    min: 0,
  });
  const startedAt = validateRequiredString(record, "started_at", errors);
  const endedAt = validateOptionalString(record, "ended_at", errors);
  const visibility = parseVisibility(record, errors);

  if (record.source_type !== "simulator") {
    errors.push({
      path: "source_type",
      message: "simulator run metadata must use source_type=simulator",
    });
  }

  if (record.developer_labels_visible !== false) {
    errors.push({
      path: "developer_labels_visible",
      message:
        "simulator developer labels must not be clinician/patient/chatbot visible",
    });
  }

  if (errors.length > 0 || seed === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      simulator_run_id: simulatorRunId ?? "",
      session_id: sessionId ?? "",
      source_type: "simulator",
      scenario_id: scenarioId ?? "",
      seed,
      started_at: startedAt ?? "",
      ended_at: endedAt,
      developer_labels_visible: false,
      visibility,
    },
    errors: [],
  };
}

function assertFromValidation<T>(
  label: string,
  result: ObjectiveSchemaValidationResult<T>,
): T {
  if (result.success) {
    return result.data;
  }

  const message = result.errors
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");

  throw new Error(`Invalid ${label}: ${message}`);
}

export function assertObjectiveSourceMetadata(
  value: unknown,
): ObjectiveSourceMetadata {
  return assertFromValidation(
    "objective source metadata",
    validateObjectiveSourceMetadata(value),
  );
}

export function assertObjectiveDeviceBootMetadata(
  value: unknown,
): ObjectiveDeviceBootMetadata {
  return assertFromValidation(
    "objective device boot metadata",
    validateObjectiveDeviceBootMetadata(value),
  );
}

export function assertObjectiveSessionMetadata(
  value: unknown,
): ObjectiveSessionMetadata {
  return assertFromValidation(
    "objective session metadata",
    validateObjectiveSessionMetadata(value),
  );
}

export function assertObjectiveSessionSegmentMetadata(
  value: unknown,
): ObjectiveSessionSegmentMetadata {
  return assertFromValidation(
    "objective session segment metadata",
    validateObjectiveSessionSegmentMetadata(value),
  );
}

export function assertObjectiveSimulatorRunMetadata(
  value: unknown,
): ObjectiveSimulatorRunMetadata {
  return assertFromValidation(
    "objective simulator run metadata",
    validateObjectiveSimulatorRunMetadata(value),
  );
}
