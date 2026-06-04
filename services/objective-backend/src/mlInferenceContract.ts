export const OBJECTIVE_ML_ALLOWED_TARGET =
    "baseline_relative_elevated_physiological_arousal_evidence" as const;

export const OBJECTIVE_ML_ALLOWED_CLASSES = [
    "low_or_baseline_arousal_evidence",
    "elevated_arousal_evidence",
    "recovery_cooldown",
    "insufficient_reliable_data",
] as const;

export const OBJECTIVE_ML_ALLOWED_CONFIDENCE_LABELS = [
    "low_confidence",
    "moderate_confidence",
    "insufficient_confidence",
] as const;

export type ObjectiveMlTarget = typeof OBJECTIVE_ML_ALLOWED_TARGET;
export type ObjectiveMlClass = (typeof OBJECTIVE_ML_ALLOWED_CLASSES)[number];
export type ObjectiveMlConfidenceLabel =
    (typeof OBJECTIVE_ML_ALLOWED_CONFIDENCE_LABELS)[number];

export type ObjectiveMlJsonPrimitive = string | number | boolean | null;
export type ObjectiveMlJsonValue =
    | ObjectiveMlJsonPrimitive
    | ObjectiveMlJsonObject
    | ObjectiveMlJsonValue[];
export type ObjectiveMlJsonObject = { [key: string]: ObjectiveMlJsonValue };

export type ObjectiveMlInferenceRequest = {
    request_id: string;
    feature_window_id: string;
    session_id: string;
    feature_schema_version: string;
    preprocessing_version: string;
    features: ObjectiveMlJsonObject;
    baseline_relative: ObjectiveMlJsonObject;
    quality: ObjectiveMlJsonObject;
    missingness: ObjectiveMlJsonObject;
    modality_availability: ObjectiveMlJsonObject;
    cross_signal?: ObjectiveMlJsonObject;
    uncertainty_reasons: string[];
    timeout_ms: number;
};

export type ObjectiveMlInferenceResponse = {
    target: ObjectiveMlTarget;
    predicted_class: ObjectiveMlClass;
    confidence_label: ObjectiveMlConfidenceLabel;
    probability: number;
    uncertainty_reasons: string[];
    suppression_state: string;
    model_version: string;
    visibility: {
        clinician_visible: true;
        patient_visible: false;
        chatbot_visible: false;
    };
};

const FORBIDDEN_ML_TEXT_PATTERNS = [
    /craving/i,
    /relapse/i,
    /withdrawal/i,
    /intoxication/i,
    /diagnos/i,
    /treatment/i,
    /detox/i,
    /medication/i,
    /ciwa/i,
    /sobriety/i,
    /truthfulness/i,
    /patient_is_lying/i,
    /patient_is_safe/i,
    /patient_is_stable/i,
    /emergency/i,
];

function assertNonEmptyString(value: unknown, name: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return value;
}

function assertJsonObject(value: unknown, name: string): ObjectiveMlJsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${name} must be a JSON object`);
    }

    return value as ObjectiveMlJsonObject;
}

function assertStringArray(value: unknown, name: string): string[] {
    if (
        !Array.isArray(value) ||
        value.some((entry) => typeof entry !== "string")
    ) {
        throw new Error(`${name} must be an array of strings`);
    }

    return value;
}

function assertPositiveInteger(value: unknown, name: string): number {
    if (!Number.isInteger(value) || Number(value) <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return Number(value);
}

function containsForbiddenMlText(value: unknown): boolean {
    if (typeof value === "string") {
        return FORBIDDEN_ML_TEXT_PATTERNS.some((pattern) => pattern.test(value));
    }

    if (Array.isArray(value)) {
        return value.some(containsForbiddenMlText);
    }

    if (typeof value === "object" && value !== null) {
        return Object.entries(value).some(
            ([key, entry]) =>
                containsForbiddenMlText(key) || containsForbiddenMlText(entry),
        );
    }

    return false;
}

function assertNoForbiddenMlText(value: unknown, context: string): void {
    if (containsForbiddenMlText(value)) {
        throw new Error(`${context} contains forbidden clinical or unsafe wording`);
    }
}

function assertAllowedValue<T extends string>(
    value: unknown,
    allowed: readonly T[],
    name: string,
): T {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
        throw new Error(`${name} is not allowed`);
    }

    return value as T;
}

export function validateObjectiveMlInferenceRequest(
    payload: unknown,
): ObjectiveMlInferenceRequest {
    assertJsonObject(payload, "inference request");
    assertNoForbiddenMlText(payload, "inference request");

    const record = payload as Record<string, unknown>;

    return {
        request_id: assertNonEmptyString(record.request_id, "request_id"),
        feature_window_id: assertNonEmptyString(
            record.feature_window_id,
            "feature_window_id",
        ),
        session_id: assertNonEmptyString(record.session_id, "session_id"),
        feature_schema_version: assertNonEmptyString(
            record.feature_schema_version,
            "feature_schema_version",
        ),
        preprocessing_version: assertNonEmptyString(
            record.preprocessing_version,
            "preprocessing_version",
        ),
        features: assertJsonObject(record.features, "features"),
        baseline_relative: assertJsonObject(
            record.baseline_relative,
            "baseline_relative",
        ),
        quality: assertJsonObject(record.quality, "quality"),
        missingness: assertJsonObject(record.missingness, "missingness"),
        modality_availability: assertJsonObject(
            record.modality_availability,
            "modality_availability",
        ),
        ...(record.cross_signal !== undefined
            ? { cross_signal: assertJsonObject(record.cross_signal, "cross_signal") }
            : {}),
        uncertainty_reasons: assertStringArray(
            record.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        timeout_ms: assertPositiveInteger(record.timeout_ms, "timeout_ms"),
    };
}

export function validateObjectiveMlInferenceResponse(
    payload: unknown,
): ObjectiveMlInferenceResponse {
    assertJsonObject(payload, "inference response");
    assertNoForbiddenMlText(payload, "inference response");

    const record = payload as Record<string, unknown>;
    const visibility = assertJsonObject(record.visibility, "visibility");

    if (
        visibility.clinician_visible !== true ||
        visibility.patient_visible !== false ||
        visibility.chatbot_visible !== false
    ) {
        throw new Error("visibility must be clinician-only");
    }

    const probability =
        typeof record.probability === "number" ? record.probability : Number.NaN;

    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("probability must be between 0 and 1");
    }

    return {
        target: assertAllowedValue(
            record.target,
            [OBJECTIVE_ML_ALLOWED_TARGET],
            "target",
        ),
        predicted_class: assertAllowedValue(
            record.predicted_class,
            OBJECTIVE_ML_ALLOWED_CLASSES,
            "predicted_class",
        ),
        confidence_label: assertAllowedValue(
            record.confidence_label,
            OBJECTIVE_ML_ALLOWED_CONFIDENCE_LABELS,
            "confidence_label",
        ),
        probability,
        uncertainty_reasons: assertStringArray(
            record.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        suppression_state: assertNonEmptyString(
            record.suppression_state,
            "suppression_state",
        ),
        model_version: assertNonEmptyString(record.model_version, "model_version"),
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
    };
}
