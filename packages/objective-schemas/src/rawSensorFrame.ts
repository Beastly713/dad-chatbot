// packages/objective-schemas/src/rawSensorFrame.ts

import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  assertAllowedObjectiveSourceType,
  type AllowedObjectiveSourceType,
} from "@dad-chatbot/objective-safety";

export const OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION = "objective_raw_frame.v1";

export const RAW_SENSOR_FIELD_NAMES = [
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
  "tmp117_temp_c",
] as const;

export type RawSensorFieldName = (typeof RAW_SENSOR_FIELD_NAMES)[number];

export type ObjectiveRawSensorFrame = {
  pc_timestamp: string;
  esp_time_ms: number;

  ecg_raw?: number;
  gsr_raw?: number;

  max_red?: number;
  max_ir?: number;
  max_green?: number;

  accel_x?: number;
  accel_y?: number;
  accel_z?: number;

  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;

  mpu_temp_c?: number;
  tmp117_temp_c?: number;
};

export type ObjectiveRawFrameEnvelope = {
  session_id: string;
  source_type: AllowedObjectiveSourceType;
  schema_version: typeof OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION;
  device_id: string;
  device_boot_id: string;
  segment_id?: string;
  frame: ObjectiveRawSensorFrame;
  updated_fields: RawSensorFieldName[];
  held_fields: RawSensorFieldName[];
  stale_fields: RawSensorFieldName[];
};

export type ObjectiveSchemaValidationError = {
  path: string;
  message: string;
};

export type ObjectiveSchemaValidationResult<T> =
  | {
      success: true;
      data: T;
      errors: [];
    }
  | {
      success: false;
      data: null;
      errors: ObjectiveSchemaValidationError[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function validateStringField(
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

function validateNumberField(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
  options: { required: boolean; integer?: boolean; min?: number } = {
    required: false,
  },
): number | undefined {
  const value = record[fieldName];

  if (value === undefined) {
    if (options.required) {
      errors.push({
        path: fieldName,
        message: `${fieldName} is required`,
      });
    }

    return undefined;
  }

  if (!isFiniteNumber(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be a finite number`,
    });

    return undefined;
  }

  if (options.integer && !Number.isInteger(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an integer`,
    });

    return undefined;
  }

  if (options.min !== undefined && value < options.min) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be greater than or equal to ${options.min}`,
    });

    return undefined;
  }

  return value;
}

function validateFieldNameArray(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): RawSensorFieldName[] {
  const value = record[fieldName];

  if (!Array.isArray(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an array`,
    });

    return [];
  }

  const validNames = new Set<string>(RAW_SENSOR_FIELD_NAMES);
  const parsed: RawSensorFieldName[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "string" || !validNames.has(item)) {
      errors.push({
        path: `${fieldName}.${index}`,
        message: `${fieldName} must contain only raw sensor field names`,
      });

      return;
    }

    parsed.push(item as RawSensorFieldName);
  });

  return parsed;
}

function validateFrame(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveRawSensorFrame> {
  const errors: ObjectiveSchemaValidationError[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: [{ path: "frame", message: "frame must be an object" }],
    };
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value));

  const pcTimestamp = validateStringField(value, "pc_timestamp", errors);

  const espTimeMs = validateNumberField(value, "esp_time_ms", errors, {
    required: true,
    integer: true,
    min: 0,
  });

  const parsed: ObjectiveRawSensorFrame = {
    pc_timestamp: pcTimestamp ?? "",
    esp_time_ms: espTimeMs ?? 0,
  };

  for (const fieldName of RAW_SENSOR_FIELD_NAMES) {
    if (fieldName === "pc_timestamp" || fieldName === "esp_time_ms") {
      continue;
    }

    const parsedValue = validateNumberField(value, fieldName, errors);

    if (parsedValue !== undefined) {
      parsed[fieldName] = parsedValue;
    }
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return { success: true, data: parsed, errors: [] };
}

export function validateObjectiveRawFrameEnvelope(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveRawFrameEnvelope> {
  const errors: ObjectiveSchemaValidationError[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: [{ path: "$", message: "raw frame envelope must be an object" }],
    };
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value));

  const sessionId = validateStringField(value, "session_id", errors);
  const deviceId = validateStringField(value, "device_id", errors);
  const deviceBootId = validateStringField(value, "device_boot_id", errors);

  const segmentId =
    value.segment_id === undefined
      ? undefined
      : validateStringField(value, "segment_id", errors) ?? undefined;

  const sourceTypeValue = value.source_type;
  let sourceType: AllowedObjectiveSourceType | null = null;

  if (!isNonEmptyString(sourceTypeValue)) {
    errors.push({
      path: "source_type",
      message: "source_type must be a non-empty string",
    });
  } else {
    try {
      sourceType = assertAllowedObjectiveSourceType(sourceTypeValue);
    } catch {
      errors.push({
        path: "source_type",
        message: `Unsupported objective source type: ${sourceTypeValue}`,
      });
    }
  }

  if (value.schema_version !== OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION) {
    errors.push({
      path: "schema_version",
      message: `schema_version must be ${OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION}`,
    });
  }

  const frameResult = validateFrame(value.frame);

  if (!frameResult.success) {
    errors.push(...frameResult.errors);
  }

  const updatedFields = validateFieldNameArray(value, "updated_fields", errors);
  const heldFields = validateFieldNameArray(value, "held_fields", errors);
  const staleFields = validateFieldNameArray(value, "stale_fields", errors);

  if (errors.length > 0 || !frameResult.success || sourceType === null) {
    return { success: false, data: null, errors };
  }

  return {
    success: true,
    data: {
      session_id: sessionId ?? "",
      source_type: sourceType,
      schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
      device_id: deviceId ?? "",
      device_boot_id: deviceBootId ?? "",
      segment_id: segmentId,
      frame: frameResult.data,
      updated_fields: updatedFields,
      held_fields: heldFields,
      stale_fields: staleFields,
    },
    errors: [],
  };
}

export function assertObjectiveRawFrameEnvelope(
  value: unknown,
): ObjectiveRawFrameEnvelope {
  const result = validateObjectiveRawFrameEnvelope(value);

  if (result.success) {
    return result.data;
  }

  const message = result.errors
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");

  throw new Error(`Invalid objective raw frame envelope: ${message}`);
}
