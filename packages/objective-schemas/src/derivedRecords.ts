// packages/objective-schemas/src/derivedRecords.ts

import {
  ALLOWED_OBJECTIVE_CONFIDENCE_LABELS,
  ALLOWED_OBJECTIVE_EVIDENCE_LEVELS,
  ALLOWED_OBJECTIVE_ML_CLASSES,
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  assertAllowedObjectiveInterpretationLabel,
  assertAllowedObjectiveMlTarget,
  type AllowedObjectiveConfidenceLabel,
  type AllowedObjectiveEvidenceLevel,
  type AllowedObjectiveInterpretationLabel,
  type AllowedObjectiveMlClass,
  type AllowedObjectiveMlTarget,
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

export const OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION =
  "objective_derived_record.v1";

export const OBJECTIVE_FEATURE_WINDOW_STATUSES = [
  "ready",
  "suppressed",
  "insufficient_data",
] as const;

export type ObjectiveFeatureWindowStatus =
  (typeof OBJECTIVE_FEATURE_WINDOW_STATUSES)[number];

export const OBJECTIVE_SUPPRESSION_STATES = [
  "not_suppressed",
  "suppressed_low_quality",
  "suppressed_missing_baseline",
  "suppressed_motion_confound",
  "suppressed_signal_conflict",
  "suppressed_missing_data",
] as const;

export type ObjectiveSuppressionState =
  (typeof OBJECTIVE_SUPPRESSION_STATES)[number];

export const OBJECTIVE_DASHBOARD_EVENT_TYPES = [
  "heartbeat",
  "session.status",
  "session.segment",
  "chart.samples",
  "quality.update",
  "feature.window",
  "ml.inference",
  "interpretation.record",
  "interpretation.suppressed",
  "session.summary.partial",
  "error",
] as const;

export type ObjectiveDashboardEventType =
  (typeof OBJECTIVE_DASHBOARD_EVENT_TYPES)[number];

export const OBJECTIVE_AUDIT_EVENT_TYPES = [
  "session_created",
  "session_started",
  "session_paused",
  "session_resumed",
  "session_stopped",
  "ingest_accepted",
  "ingest_rejected",
  "stream_token_issued",
  "stream_denied",
  "access_denied",
  "forbidden_label_blocked",
  "serializer_blocked",
  "interpretation_created",
  "interpretation_suppressed",
] as const;

export type ObjectiveAuditEventType =
  (typeof OBJECTIVE_AUDIT_EVENT_TYPES)[number];

export type ObjectiveFeatureWindowRecord = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  feature_window_id: string;
  session_id: string;
  segment_id?: string;
  source_type: string;
  start_esp_time_ms: number;
  end_esp_time_ms: number;
  raw_range_refs: string[];
  preprocessing_version: string;
  feature_schema_version: string;
  status: ObjectiveFeatureWindowStatus;
  suppression_state: ObjectiveSuppressionState;
  quality: {
    ecg_quality?: number;
    gsr_quality?: number;
    ppg_quality?: number;
    motion_quality?: number;
    temperature_quality?: number;
    timing_quality?: number;
  };
  missingness: Record<string, number>;
  modality_availability: Record<string, boolean>;
  features: Record<string, number | string | boolean | null>;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveMlInferenceRecord = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  ml_inference_id: string;
  feature_window_id: string;
  session_id: string;
  model_id: string;
  model_version: string;
  target: AllowedObjectiveMlTarget;
  predicted_class: AllowedObjectiveMlClass;
  confidence_label: AllowedObjectiveConfidenceLabel;
  probability?: number;
  uncertainty_reasons: string[];
  suppression_state: ObjectiveSuppressionState;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveInterpretationRecord = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  interpretation_id: string;
  session_id: string;
  feature_window_id?: string;
  ml_inference_id?: string;
  label: AllowedObjectiveInterpretationLabel;
  evidence_level: AllowedObjectiveEvidenceLevel;
  confidence_label: AllowedObjectiveConfidenceLabel;
  summary: string;
  uncertainty_reasons: string[];
  contributing_modalities: string[];
  excluded_modalities: string[];
  suppression_state: ObjectiveSuppressionState;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveDashboardStreamEvent = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  event_id: string;
  event_type: ObjectiveDashboardEventType;
  session_id: string;
  emitted_at: string;
  payload: Record<string, unknown>;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveSessionSummaryRecord = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  session_summary_id: string;
  session_id: string;
  total_windows: number;
  interpretable_fraction: number;
  suppressed_fraction: number;
  modality_availability: Record<string, number>;
  quality_distribution: Record<string, number>;
  evidence_period_count: number;
  cooldown_period_count: number;
  motion_confounded_fraction: number;
  preprocessing_version?: string;
  model_version?: string;
  visibility: ObjectiveVisibilityFlags;
};

export type ObjectiveAuditEventRecord = {
  schema_version: typeof OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION;
  audit_event_id: string;
  event_type: ObjectiveAuditEventType;
  actor_id?: string;
  actor_role: "service" | "clinician" | "developer";
  session_id?: string;
  patient_id?: string;
  occurred_at: string;
  metadata: Record<string, string | number | boolean | null>;
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
  prefix = "",
): ObjectiveSchemaValidationError[] {
  const errors: ObjectiveSchemaValidationError[] = [];

  for (const forbiddenField of FORBIDDEN_OBJECTIVE_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(value, forbiddenField)) {
      errors.push({
        path: `${prefix}${forbiddenField}`,
        message: `Forbidden objective clinical field is not allowed: ${forbiddenField}`,
      });
    }
  }

  return errors;
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

function fail<T>(
  errors: ObjectiveSchemaValidationError[],
): ObjectiveSchemaValidationResult<T> {
  return { success: false, data: null, errors };
}

function validateDerivedSchemaVersion(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): void {
  if (record.schema_version !== OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION) {
    errors.push({
      path: "schema_version",
      message: `schema_version must be ${OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION}`,
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

  return value as AllowedObjectiveMlClass;
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
  options: { integer?: boolean; min?: number; max?: number } = {},
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

  if (options.max !== undefined && value > options.max) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be less than or equal to ${options.max}`,
    });

    return null;
  }

  return value;
}

function validateOptionalNumber(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
  options: { integer?: boolean; min?: number; max?: number } = {},
): number | undefined {
  if (record[fieldName] === undefined) {
    return undefined;
  }

  return validateRequiredNumber(record, fieldName, errors, options) ?? undefined;
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

  return value as AllowedObjectiveMlClass;
}

function validateStringArray(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): string[] {
  const value = record[fieldName];

  if (!Array.isArray(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an array`,
    });

    return [];
  }

  const parsed: string[] = [];

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push({
        path: `${fieldName}.${index}`,
        message: `${fieldName} must contain non-empty strings`,
      });

      return;
    }

    parsed.push(item);
  });

  return parsed;
}

function validateNumberRecord(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): Record<string, number> {
  const value = record[fieldName];

  if (!isRecord(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an object`,
    });

    return {};
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value, `${fieldName}.`));

  const parsed: Record<string, number> = {};

  for (const [key, item] of Object.entries(value)) {
    if (!isFiniteNumber(item)) {
      errors.push({
        path: `${fieldName}.${key}`,
        message: `${fieldName}.${key} must be a finite number`,
      });

      continue;
    }

    parsed[key] = item;
  }

  return parsed;
}

function validateBooleanRecord(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): Record<string, boolean> {
  const value = record[fieldName];

  if (!isRecord(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an object`,
    });

    return {};
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value, `${fieldName}.`));

  const parsed: Record<string, boolean> = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "boolean") {
      errors.push({
        path: `${fieldName}.${key}`,
        message: `${fieldName}.${key} must be a boolean`,
      });

      continue;
    }

    parsed[key] = item;
  }

  return parsed;
}

function validateFeatureValueRecord(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): Record<string, number | string | boolean | null> {
  const value = record[fieldName];

  if (!isRecord(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an object`,
    });

    return {};
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value, `${fieldName}.`));

  const parsed: Record<string, number | string | boolean | null> = {};

  for (const [key, item] of Object.entries(value)) {
    const isAllowedValue =
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      isFiniteNumber(item);

    if (!isAllowedValue) {
      errors.push({
        path: `${fieldName}.${key}`,
        message:
          `${fieldName}.${key} must be a number, string, boolean, or null`,
      });

      continue;
    }

    parsed[key] = item;
  }

  return parsed;
}

function validateUnknownPayload(
  record: Record<string, unknown>,
  fieldName: string,
  errors: ObjectiveSchemaValidationError[],
): Record<string, unknown> {
  const value = record[fieldName];

  if (!isRecord(value)) {
    errors.push({
      path: fieldName,
      message: `${fieldName} must be an object`,
    });

    return {};
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value, `${fieldName}.`));

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

function validateAllowedMlTarget(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveMlTarget | null {
  const value = record.target;

  if (!isNonEmptyString(value)) {
    errors.push({
      path: "target",
      message: "target must be a non-empty string",
    });

    return null;
  }

  try {
    return assertAllowedObjectiveMlTarget(value);
  } catch {
    errors.push({
      path: "target",
      message: `Unsupported objective ML target: ${value}`,
    });

    return null;
  }
}

function validateAllowedMlClass(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveMlClass | null {
  const value = record.predicted_class;

  if (
    !isNonEmptyString(value) ||
    !ALLOWED_OBJECTIVE_ML_CLASSES.includes(value as AllowedObjectiveMlClass)
  ) {
    errors.push({
      path: "predicted_class",
      message: `predicted_class must be one of: ${ALLOWED_OBJECTIVE_ML_CLASSES.join(
        ", ",
      )}`,
    });

    return null;
  }

  return value as AllowedObjectiveMlClass;
}

function validateAllowedInterpretationLabel(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveInterpretationLabel | null {
  const value = record.label;

  if (!isNonEmptyString(value)) {
    errors.push({
      path: "label",
      message: "label must be a non-empty string",
    });

    return null;
  }

  try {
    return assertAllowedObjectiveInterpretationLabel(value);
  } catch {
    errors.push({
      path: "label",
      message: `Unsupported objective interpretation label: ${value}`,
    });

    return null;
  }
}

function validateConfidenceLabel(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveConfidenceLabel | null {
  const value = record.confidence_label;

  if (
    !isNonEmptyString(value) ||
    !ALLOWED_OBJECTIVE_CONFIDENCE_LABELS.includes(
      value as AllowedObjectiveConfidenceLabel,
    )
  ) {
    errors.push({
      path: "confidence_label",
      message: `confidence_label must be one of: ${ALLOWED_OBJECTIVE_CONFIDENCE_LABELS.join(
        ", ",
      )}`,
    });

    return null;
  }

  return value as AllowedObjectiveConfidenceLabel;
}

function validateEvidenceLevel(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): AllowedObjectiveEvidenceLevel | null {
  const value = record.evidence_level;

  if (
    !isNonEmptyString(value) ||
    !ALLOWED_OBJECTIVE_EVIDENCE_LEVELS.includes(
      value as AllowedObjectiveEvidenceLevel,
    )
  ) {
    errors.push({
      path: "evidence_level",
      message: `evidence_level must be one of: ${ALLOWED_OBJECTIVE_EVIDENCE_LEVELS.join(
        ", ",
      )}`,
    });

    return null;
  }

  return value as AllowedObjectiveEvidenceLevel;
}

function validateAuditMetadata(
  record: Record<string, unknown>,
  errors: ObjectiveSchemaValidationError[],
): Record<string, string | number | boolean | null> {
  const value = record.metadata;

  if (!isRecord(value)) {
    errors.push({
      path: "metadata",
      message: "metadata must be an object",
    });

    return {};
  }

  errors.push(...hasForbiddenClinicalFieldKeys(value, "metadata."));

  const parsed: Record<string, string | number | boolean | null> = {};

  for (const [key, item] of Object.entries(value)) {
    const isAllowedValue =
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      isFiniteNumber(item);

    if (!isAllowedValue) {
      errors.push({
        path: `metadata.${key}`,
        message: `metadata.${key} must be a string, number, boolean, or null`,
      });

      continue;
    }

    parsed[key] = item;
  }

  return parsed;
}

export function validateObjectiveFeatureWindowRecord(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveFeatureWindowRecord> {
  const nonRecord = rejectNonRecord<ObjectiveFeatureWindowRecord>(
    value,
    "feature window record",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const featureWindowId = validateRequiredString(
    record,
    "feature_window_id",
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const segmentId = validateOptionalString(record, "segment_id", errors);
  const sourceType = validateRequiredString(record, "source_type", errors);
  const startEspTimeMs =
    validateRequiredNumber(record, "start_esp_time_ms", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const endEspTimeMs =
    validateRequiredNumber(record, "end_esp_time_ms", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const rawRangeRefs = validateStringArray(record, "raw_range_refs", errors);
  const preprocessingVersion = validateRequiredString(
    record,
    "preprocessing_version",
    errors,
  );
  const featureSchemaVersion = validateRequiredString(
    record,
    "feature_schema_version",
    errors,
  );
  const status = validateStringEnum(
    record,
    "status",
    OBJECTIVE_FEATURE_WINDOW_STATUSES,
    errors,
  );
  const suppressionState = validateStringEnum(
    record,
    "suppression_state",
    OBJECTIVE_SUPPRESSION_STATES,
    errors,
  );

  const quality = validateNumberRecord(record, "quality", errors);
  const missingness = validateNumberRecord(record, "missingness", errors);
  const modalityAvailability = validateBooleanRecord(
    record,
    "modality_availability",
    errors,
  );
  const features = validateFeatureValueRecord(record, "features", errors);
  const visibility = parseVisibility(record, errors);

  if (endEspTimeMs < startEspTimeMs) {
    errors.push({
      path: "end_esp_time_ms",
      message: "end_esp_time_ms must be greater than or equal to start_esp_time_ms",
    });
  }

  if (errors.length > 0 || status === null || suppressionState === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      feature_window_id: featureWindowId ?? "",
      session_id: sessionId ?? "",
      segment_id: segmentId,
      source_type: sourceType ?? "",
      start_esp_time_ms: startEspTimeMs,
      end_esp_time_ms: endEspTimeMs,
      raw_range_refs: rawRangeRefs,
      preprocessing_version: preprocessingVersion ?? "",
      feature_schema_version: featureSchemaVersion ?? "",
      status,
      suppression_state: suppressionState,
      quality,
      missingness,
      modality_availability: modalityAvailability,
      features,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveMlInferenceRecord(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveMlInferenceRecord> {
  const nonRecord = rejectNonRecord<ObjectiveMlInferenceRecord>(
    value,
    "ML inference record",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const mlInferenceId = validateRequiredString(
    record,
    "ml_inference_id",
    errors,
  );
  const featureWindowId = validateRequiredString(
    record,
    "feature_window_id",
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const modelId = validateRequiredString(record, "model_id", errors);
  const modelVersion = validateRequiredString(record, "model_version", errors);
  const target = validateAllowedMlTarget(record, errors);
  const predictedClass = validateAllowedMlClass(record, errors);
  const confidenceLabel = validateConfidenceLabel(record, errors);
  const probability = validateOptionalNumber(record, "probability", errors, {
    min: 0,
    max: 1,
  });
  const uncertaintyReasons = validateStringArray(
    record,
    "uncertainty_reasons",
    errors,
  );
  const suppressionState = validateStringEnum(
    record,
    "suppression_state",
    OBJECTIVE_SUPPRESSION_STATES,
    errors,
  );
  const visibility = parseVisibility(record, errors);

  if (
    errors.length > 0 ||
    target === null ||
    predictedClass === null ||
    confidenceLabel === null ||
    suppressionState === null
  ) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      ml_inference_id: mlInferenceId ?? "",
      feature_window_id: featureWindowId ?? "",
      session_id: sessionId ?? "",
      model_id: modelId ?? "",
      model_version: modelVersion ?? "",
      target,
      predicted_class: predictedClass,
      confidence_label: confidenceLabel,
      probability,
      uncertainty_reasons: uncertaintyReasons,
      suppression_state: suppressionState,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveInterpretationRecord(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveInterpretationRecord> {
  const nonRecord = rejectNonRecord<ObjectiveInterpretationRecord>(
    value,
    "interpretation record",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const interpretationId = validateRequiredString(
    record,
    "interpretation_id",
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const featureWindowId = validateOptionalString(
    record,
    "feature_window_id",
    errors,
  );
  const mlInferenceId = validateOptionalString(
    record,
    "ml_inference_id",
    errors,
  );
  const label = validateAllowedInterpretationLabel(record, errors);
  const evidenceLevel = validateEvidenceLevel(record, errors);
  const confidenceLabel = validateConfidenceLabel(record, errors);
  const summary = validateRequiredString(record, "summary", errors);
  const uncertaintyReasons = validateStringArray(
    record,
    "uncertainty_reasons",
    errors,
  );
  const contributingModalities = validateStringArray(
    record,
    "contributing_modalities",
    errors,
  );
  const excludedModalities = validateStringArray(
    record,
    "excluded_modalities",
    errors,
  );
  const suppressionState = validateStringEnum(
    record,
    "suppression_state",
    OBJECTIVE_SUPPRESSION_STATES,
    errors,
  );
  const visibility = parseVisibility(record, errors);

  if (
    errors.length > 0 ||
    label === null ||
    evidenceLevel === null ||
    confidenceLabel === null ||
    suppressionState === null
  ) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      interpretation_id: interpretationId ?? "",
      session_id: sessionId ?? "",
      feature_window_id: featureWindowId,
      ml_inference_id: mlInferenceId,
      label,
      evidence_level: evidenceLevel,
      confidence_label: confidenceLabel,
      summary: summary ?? "",
      uncertainty_reasons: uncertaintyReasons,
      contributing_modalities: contributingModalities,
      excluded_modalities: excludedModalities,
      suppression_state: suppressionState,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveDashboardStreamEvent(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveDashboardStreamEvent> {
  const nonRecord = rejectNonRecord<ObjectiveDashboardStreamEvent>(
    value,
    "dashboard stream event",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const eventId = validateRequiredString(record, "event_id", errors);
  const eventType = validateStringEnum(
    record,
    "event_type",
    OBJECTIVE_DASHBOARD_EVENT_TYPES,
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const emittedAt = validateRequiredString(record, "emitted_at", errors);
  const payload = validateUnknownPayload(record, "payload", errors);
  const visibility = parseVisibility(record, errors);

  if (errors.length > 0 || eventType === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      event_id: eventId ?? "",
      event_type: eventType,
      session_id: sessionId ?? "",
      emitted_at: emittedAt ?? "",
      payload,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveSessionSummaryRecord(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveSessionSummaryRecord> {
  const nonRecord = rejectNonRecord<ObjectiveSessionSummaryRecord>(
    value,
    "session summary record",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const sessionSummaryId = validateRequiredString(
    record,
    "session_summary_id",
    errors,
  );
  const sessionId = validateRequiredString(record, "session_id", errors);
  const totalWindows =
    validateRequiredNumber(record, "total_windows", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const interpretableFraction =
    validateRequiredNumber(record, "interpretable_fraction", errors, {
      min: 0,
      max: 1,
    }) ?? 0;
  const suppressedFraction =
    validateRequiredNumber(record, "suppressed_fraction", errors, {
      min: 0,
      max: 1,
    }) ?? 0;
  const modalityAvailability = validateNumberRecord(
    record,
    "modality_availability",
    errors,
  );
  const qualityDistribution = validateNumberRecord(
    record,
    "quality_distribution",
    errors,
  );
  const evidencePeriodCount =
    validateRequiredNumber(record, "evidence_period_count", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const cooldownPeriodCount =
    validateRequiredNumber(record, "cooldown_period_count", errors, {
      integer: true,
      min: 0,
    }) ?? 0;
  const motionConfoundedFraction =
    validateRequiredNumber(record, "motion_confounded_fraction", errors, {
      min: 0,
      max: 1,
    }) ?? 0;
  const preprocessingVersion = validateOptionalString(
    record,
    "preprocessing_version",
    errors,
  );
  const modelVersion = validateOptionalString(record, "model_version", errors);
  const visibility = parseVisibility(record, errors);

  if (errors.length > 0) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      session_summary_id: sessionSummaryId ?? "",
      session_id: sessionId ?? "",
      total_windows: totalWindows,
      interpretable_fraction: interpretableFraction,
      suppressed_fraction: suppressedFraction,
      modality_availability: modalityAvailability,
      quality_distribution: qualityDistribution,
      evidence_period_count: evidencePeriodCount,
      cooldown_period_count: cooldownPeriodCount,
      motion_confounded_fraction: motionConfoundedFraction,
      preprocessing_version: preprocessingVersion,
      model_version: modelVersion,
      visibility,
    },
    errors: [],
  };
}

export function validateObjectiveAuditEventRecord(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveAuditEventRecord> {
  const nonRecord = rejectNonRecord<ObjectiveAuditEventRecord>(
    value,
    "audit event record",
  );

  if (nonRecord) {
    return nonRecord;
  }

  const record = value as Record<string, unknown>;
  const errors = hasForbiddenClinicalFieldKeys(record);

  validateDerivedSchemaVersion(record, errors);

  const auditEventId = validateRequiredString(record, "audit_event_id", errors);
  const eventType = validateStringEnum(
    record,
    "event_type",
    OBJECTIVE_AUDIT_EVENT_TYPES,
    errors,
  );
  const actorId = validateOptionalString(record, "actor_id", errors);
  const actorRole = validateStringEnum(
    record,
    "actor_role",
    ["service", "clinician", "developer"] as const,
    errors,
  );
  const sessionId = validateOptionalString(record, "session_id", errors);
  const patientId = validateOptionalString(record, "patient_id", errors);
  const occurredAt = validateRequiredString(record, "occurred_at", errors);
  const metadata = validateAuditMetadata(record, errors);

  if (errors.length > 0 || eventType === null || actorRole === null) {
    return fail(errors);
  }

  return {
    success: true,
    data: {
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      audit_event_id: auditEventId ?? "",
      event_type: eventType,
      actor_id: actorId,
      actor_role: actorRole,
      session_id: sessionId,
      patient_id: patientId,
      occurred_at: occurredAt ?? "",
      metadata,
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

export function assertObjectiveFeatureWindowRecord(
  value: unknown,
): ObjectiveFeatureWindowRecord {
  return assertFromValidation(
    "objective feature window record",
    validateObjectiveFeatureWindowRecord(value),
  );
}

export function assertObjectiveMlInferenceRecord(
  value: unknown,
): ObjectiveMlInferenceRecord {
  return assertFromValidation(
    "objective ML inference record",
    validateObjectiveMlInferenceRecord(value),
  );
}

export function assertObjectiveInterpretationRecord(
  value: unknown,
): ObjectiveInterpretationRecord {
  return assertFromValidation(
    "objective interpretation record",
    validateObjectiveInterpretationRecord(value),
  );
}

export function assertObjectiveDashboardStreamEvent(
  value: unknown,
): ObjectiveDashboardStreamEvent {
  return assertFromValidation(
    "objective dashboard stream event",
    validateObjectiveDashboardStreamEvent(value),
  );
}

export function assertObjectiveSessionSummaryRecord(
  value: unknown,
): ObjectiveSessionSummaryRecord {
  return assertFromValidation(
    "objective session summary record",
    validateObjectiveSessionSummaryRecord(value),
  );
}

export function assertObjectiveAuditEventRecord(
  value: unknown,
): ObjectiveAuditEventRecord {
  return assertFromValidation(
    "objective audit event record",
    validateObjectiveAuditEventRecord(value),
  );
}
