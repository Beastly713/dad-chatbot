// packages/objective-schemas/src/rawBatch.ts

import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  assertObjectiveRawFrameEnvelope,
  type ObjectiveRawFrameEnvelope,
  type ObjectiveSchemaValidationError,
  type ObjectiveSchemaValidationResult,
} from "./rawSensorFrame.js";

export type ObjectiveRawBatch = {
  batch_id: string;
  session_id: string;
  source_type: ObjectiveRawFrameEnvelope["source_type"];
  schema_version: typeof OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION;
  device_id: string;
  device_boot_id: string;
  segment_id?: string;
  frames: ObjectiveRawFrameEnvelope[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fieldError(
  path: string,
  message: string,
): ObjectiveSchemaValidationError {
  return { path, message };
}

function validateRequiredString(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): string | null {
  const value = record[fieldName];

  if (!isNonEmptyString(value)) {
    errors.push(fieldError(fieldName, `${fieldName} must be a non-empty string`));
    return null;
  }

  return value;
}

export function validateObjectiveRawBatch(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveRawBatch> {
  const errors: ObjectiveSchemaValidationError[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: [{ path: "$", message: "raw batch must be an object" }],
    };
  }

  const batchId = validateRequiredString(value, "batch_id", errors);
  const sessionId = validateRequiredString(value, "session_id", errors);
  const deviceId = validateRequiredString(value, "device_id", errors);
  const deviceBootId = validateRequiredString(value, "device_boot_id", errors);

  const segmentId =
    value.segment_id === undefined
      ? undefined
      : validateRequiredString(value, "segment_id", errors) ?? undefined;

  if (value.schema_version !== OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION) {
    errors.push(
      fieldError(
        "schema_version",
        `schema_version must be ${OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION}`,
      ),
    );
  }

  if (!isNonEmptyString(value.source_type)) {
    errors.push(fieldError("source_type", "source_type must be a non-empty string"));
  }

  if (!Array.isArray(value.frames)) {
    errors.push(fieldError("frames", "frames must be an array"));
  }

  if (Array.isArray(value.frames) && value.frames.length === 0) {
    errors.push(fieldError("frames", "frames must contain at least one frame"));
  }

  const parsedFrames: ObjectiveRawFrameEnvelope[] = [];

  if (Array.isArray(value.frames)) {
    value.frames.forEach((frame, index) => {
      try {
        const parsedFrame = assertObjectiveRawFrameEnvelope(frame);

        if (sessionId && parsedFrame.session_id !== sessionId) {
          errors.push(
            fieldError(
              `frames.${index}.session_id`,
              "frame session_id must match batch session_id",
            ),
          );
        }

        if (
          isNonEmptyString(value.source_type) &&
          parsedFrame.source_type !== value.source_type
        ) {
          errors.push(
            fieldError(
              `frames.${index}.source_type`,
              "frame source_type must match batch source_type",
            ),
          );
        }

        if (deviceId && parsedFrame.device_id !== deviceId) {
          errors.push(
            fieldError(
              `frames.${index}.device_id`,
              "frame device_id must match batch device_id",
            ),
          );
        }

        if (deviceBootId && parsedFrame.device_boot_id !== deviceBootId) {
          errors.push(
            fieldError(
              `frames.${index}.device_boot_id`,
              "frame device_boot_id must match batch device_boot_id",
            ),
          );
        }

        if (segmentId && parsedFrame.segment_id !== segmentId) {
          errors.push(
            fieldError(
              `frames.${index}.segment_id`,
              "frame segment_id must match batch segment_id",
            ),
          );
        }

        parsedFrames.push(parsedFrame);
      } catch (error) {
        errors.push(
          fieldError(
            `frames.${index}`,
            error instanceof Error ? error.message : "invalid frame",
          ),
        );
      }
    });
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  const firstFrame = parsedFrames[0];

  return {
    success: true,
    data: {
      batch_id: batchId ?? "",
      session_id: sessionId ?? "",
      source_type: firstFrame.source_type,
      schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
      device_id: deviceId ?? "",
      device_boot_id: deviceBootId ?? "",
      segment_id: segmentId,
      frames: parsedFrames,
    },
    errors: [],
  };
}

export function assertObjectiveRawBatch(value: unknown): ObjectiveRawBatch {
  const result = validateObjectiveRawBatch(value);

  if (result.success) {
    return result.data;
  }

  const message = result.errors
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");

  throw new Error(`Invalid objective raw batch: ${message}`);
}
