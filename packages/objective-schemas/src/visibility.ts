// packages/objective-schemas/src/visibility.ts

import { OBJECTIVE_VISIBILITY_DEFAULTS } from "@dad-chatbot/objective-safety";
import type {
  ObjectiveSchemaValidationError,
  ObjectiveSchemaValidationResult,
} from "./rawSensorFrame.js";

export type ObjectiveVisibilityFlags = {
  clinician_visible: true;
  patient_visible: false;
  chatbot_visible: false;
};

export const OBJECTIVE_CLINICIAN_ONLY_VISIBILITY: ObjectiveVisibilityFlags = {
  clinician_visible: OBJECTIVE_VISIBILITY_DEFAULTS.clinician_visible,
  patient_visible: OBJECTIVE_VISIBILITY_DEFAULTS.patient_visible,
  chatbot_visible: OBJECTIVE_VISIBILITY_DEFAULTS.chatbot_visible,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createObjectiveVisibilityFlags(): ObjectiveVisibilityFlags {
  return { ...OBJECTIVE_CLINICIAN_ONLY_VISIBILITY };
}

export function validateObjectiveVisibilityFlags(
  value: unknown,
): ObjectiveSchemaValidationResult<ObjectiveVisibilityFlags> {
  const errors: ObjectiveSchemaValidationError[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: [
        {
          path: "visibility",
          message: "visibility must be an object",
        },
      ],
    };
  }

  if (value.clinician_visible !== true) {
    errors.push({
      path: "clinician_visible",
      message: "objective records must be clinician_visible=true",
    });
  }

  if (value.patient_visible !== false) {
    errors.push({
      path: "patient_visible",
      message: "objective records must be patient_visible=false",
    });
  }

  if (value.chatbot_visible !== false) {
    errors.push({
      path: "chatbot_visible",
      message: "objective records must be chatbot_visible=false",
    });
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return {
    success: true,
    data: createObjectiveVisibilityFlags(),
    errors: [],
  };
}

export function normalizeObjectiveVisibilityFlags(
  value: unknown,
): ObjectiveVisibilityFlags {
  if (value === undefined || value === null) {
    return createObjectiveVisibilityFlags();
  }

  const result = validateObjectiveVisibilityFlags(value);

  if (result.success) {
    return result.data;
  }

  const message = result.errors
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");

  throw new Error(`Invalid objective visibility flags: ${message}`);
}

export function assertClinicianOnlyObjectiveVisibility(
  value: unknown,
): ObjectiveVisibilityFlags {
  const result = validateObjectiveVisibilityFlags(value);

  if (result.success) {
    return result.data;
  }

  const message = result.errors
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");

  throw new Error(`Invalid objective visibility flags: ${message}`);
}
