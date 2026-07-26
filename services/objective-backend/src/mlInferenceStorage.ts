import { randomUUID } from "crypto";
import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlClass,
    type ObjectiveMlConfidenceLabel,
    type ObjectiveMlInferenceResponse,
    type ObjectiveMlJsonObject,
    type ObjectiveMlTarget,
} from "./mlInferenceContract.js";

export type ObjectiveMlInferenceVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveMlInferencePersistenceInput = {
    inference_key: string;
    feature_window_id: string;
    feature_window_key?: string;
    session_id: string;
    segment_id?: string;
    model_version: string;
    target: ObjectiveMlTarget;
    predicted_class: ObjectiveMlClass;
    confidence_label: ObjectiveMlConfidenceLabel;
    probability: number;
    uncertainty_reasons: string[];
    suppression_state: string;
    inference_response: ObjectiveMlInferenceResponse;
    request_metadata?: ObjectiveMlJsonObject;
    clinician_visible?: true;
    patient_visible?: false;
    chatbot_visible?: false;
};

export type ObjectiveMlInferenceRecord = ObjectiveMlInferencePersistenceInput &
    ObjectiveMlInferenceVisibility & {
        id: string;
        created_at: string;
    };

export type ObjectiveMlInferenceListFilter = {
    session_id: string;
    segment_id?: string;
};

export type ObjectiveMlInferenceStorageRepository = {
    saveMlInference(
        input: ObjectiveMlInferencePersistenceInput,
    ): Promise<ObjectiveMlInferenceRecord>;
    saveMlInferences(
        inputs: readonly ObjectiveMlInferencePersistenceInput[],
    ): Promise<ObjectiveMlInferenceRecord[]>;
    getMlInferenceByKey(
        inferenceKey: string,
    ): Promise<ObjectiveMlInferenceRecord | null>;
    listMlInferencesForSession(
        filter: ObjectiveMlInferenceListFilter,
    ): Promise<ObjectiveMlInferenceRecord[]>;
    listMlInferencesForFeatureWindow(
        featureWindowId: string,
    ): Promise<ObjectiveMlInferenceRecord[]>;
    listAllMlInferences(): Promise<ObjectiveMlInferenceRecord[]>;
};

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function assertNonEmptyString(value: string | undefined, name: string): string {
    if (!value || value.trim().length === 0) {
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

function assertProbability(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("probability must be between 0 and 1");
    }

    return value;
}

function assertClinicianOnlyVisibility(
    input: Pick<
        ObjectiveMlInferencePersistenceInput,
        "clinician_visible" | "patient_visible" | "chatbot_visible"
    >,
): ObjectiveMlInferenceVisibility {
    if (input.clinician_visible !== undefined && input.clinician_visible !== true) {
        throw new Error("ML inference clinician_visible must remain true");
    }

    if (input.patient_visible !== undefined && input.patient_visible !== false) {
        throw new Error("ML inference patient_visible must remain false");
    }

    if (input.chatbot_visible !== undefined && input.chatbot_visible !== false) {
        throw new Error("ML inference chatbot_visible must remain false");
    }

    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function normalizeMlInferenceInput(
    input: ObjectiveMlInferencePersistenceInput,
): ObjectiveMlInferencePersistenceInput & ObjectiveMlInferenceVisibility {
    const validatedResponse = validateObjectiveMlInferenceResponse(
        input.inference_response,
    );

    if (input.target !== OBJECTIVE_ML_ALLOWED_TARGET) {
        throw new Error("target is not allowed");
    }

    if (validatedResponse.target !== input.target) {
        throw new Error("inference response target must match persisted target");
    }

    if (validatedResponse.predicted_class !== input.predicted_class) {
        throw new Error(
            "inference response predicted_class must match persisted predicted_class",
        );
    }

    if (validatedResponse.model_version !== input.model_version) {
        throw new Error(
            "inference response model_version must match persisted model_version",
        );
    }

    if (validatedResponse.confidence_label !== input.confidence_label) {
        throw new Error(
            "inference response confidence_label must match persisted confidence_label",
        );
    }

    if (validatedResponse.suppression_state !== input.suppression_state) {
        throw new Error(
            "inference response suppression_state must match persisted suppression_state",
        );
    }

    return {
        inference_key: assertNonEmptyString(input.inference_key, "inference_key"),
        feature_window_id: assertNonEmptyString(
            input.feature_window_id,
            "feature_window_id",
        ),
        ...(input.feature_window_key
            ? {
                  feature_window_key: assertNonEmptyString(
                      input.feature_window_key,
                      "feature_window_key",
                  ),
              }
            : {}),
        session_id: assertNonEmptyString(input.session_id, "session_id"),
        ...(input.segment_id
            ? { segment_id: assertNonEmptyString(input.segment_id, "segment_id") }
            : {}),
        model_version: assertNonEmptyString(input.model_version, "model_version"),
        target: input.target,
        predicted_class: validatedResponse.predicted_class,
        confidence_label: validatedResponse.confidence_label,
        probability: assertProbability(input.probability),
        uncertainty_reasons: assertStringArray(
            input.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        suppression_state: assertNonEmptyString(
            input.suppression_state,
            "suppression_state",
        ),
        inference_response: validatedResponse,
        ...(input.request_metadata
            ? {
                  request_metadata: assertJsonObject(
                      input.request_metadata,
                      "request_metadata",
                  ),
              }
            : {}),
        ...assertClinicianOnlyVisibility(input),
    };
}

function createMlInferenceRecord(
    input: ObjectiveMlInferencePersistenceInput,
    now: () => Date,
): ObjectiveMlInferenceRecord {
    const normalized = normalizeMlInferenceInput(input);

    return {
        id: randomUUID(),
        created_at: now().toISOString(),
        ...cloneJson(normalized),
    };
}

export function createObjectiveMlInferencePersistenceInput(options: {
    inference_key?: string;
    feature_window_id: string;
    feature_window_key?: string;
    session_id: string;
    segment_id?: string;
    response: ObjectiveMlInferenceResponse;
    request_metadata?: ObjectiveMlJsonObject;
}): ObjectiveMlInferencePersistenceInput {
    const inferenceKey =
        options.inference_key ??
        `${options.feature_window_id}:${options.response.model_version}`;

    return {
        inference_key: inferenceKey,
        feature_window_id: options.feature_window_id,
        ...(options.feature_window_key
            ? { feature_window_key: options.feature_window_key }
            : {}),
        session_id: options.session_id,
        ...(options.segment_id ? { segment_id: options.segment_id } : {}),
        model_version: options.response.model_version,
        target: options.response.target,
        predicted_class: options.response.predicted_class,
        confidence_label: options.response.confidence_label,
        probability: options.response.probability,
        uncertainty_reasons: options.response.uncertainty_reasons,
        suppression_state: options.response.suppression_state,
        inference_response: options.response,
        ...(options.request_metadata
            ? { request_metadata: options.request_metadata }
            : {}),
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

export class InMemoryObjectiveMlInferenceRepository
    implements ObjectiveMlInferenceStorageRepository
{
    private readonly byKey = new Map<string, ObjectiveMlInferenceRecord>();

    constructor(private readonly now: () => Date = () => new Date()) {}

    async saveMlInference(
        input: ObjectiveMlInferencePersistenceInput,
    ): Promise<ObjectiveMlInferenceRecord> {
        const [record] = await this.saveMlInferences([input]);

        return record;
    }

    async saveMlInferences(
        inputs: readonly ObjectiveMlInferencePersistenceInput[],
    ): Promise<ObjectiveMlInferenceRecord[]> {
        const candidateRecords = inputs.map((input) =>
            createMlInferenceRecord(input, this.now),
        );
        const candidateKeys = candidateRecords.map((record) => record.inference_key);
        const uniqueCandidateKeys = new Set(candidateKeys);

        if (uniqueCandidateKeys.size !== candidateKeys.length) {
            throw new Error(
                "inference_key values must be unique within one save operation",
            );
        }

        for (const key of candidateKeys) {
            if (this.byKey.has(key)) {
                throw new Error(`inference_key already exists: ${key}`);
            }
        }

        for (const record of candidateRecords) {
            this.byKey.set(record.inference_key, cloneJson(record));
        }

        return candidateRecords.map(cloneJson);
    }

    async getMlInferenceByKey(
        inferenceKey: string,
    ): Promise<ObjectiveMlInferenceRecord | null> {
        const key = assertNonEmptyString(inferenceKey, "inference_key");
        const record = this.byKey.get(key);

        return record ? cloneJson(record) : null;
    }

    async listMlInferencesForSession(
        filter: ObjectiveMlInferenceListFilter,
    ): Promise<ObjectiveMlInferenceRecord[]> {
        const sessionId = assertNonEmptyString(filter.session_id, "session_id");

        return [...this.byKey.values()]
            .filter((record) => record.session_id === sessionId)
            .filter((record) =>
                filter.segment_id ? record.segment_id === filter.segment_id : true,
            )
            .sort(
                (left, right) =>
                    left.created_at.localeCompare(right.created_at) ||
                    left.inference_key.localeCompare(right.inference_key),
            )
            .map(cloneJson);
    }

    async listMlInferencesForFeatureWindow(
        featureWindowId: string,
    ): Promise<ObjectiveMlInferenceRecord[]> {
        const id = assertNonEmptyString(featureWindowId, "feature_window_id");

        return [...this.byKey.values()]
            .filter((record) => record.feature_window_id === id)
            .sort(
                (left, right) =>
                    left.created_at.localeCompare(right.created_at) ||
                    left.inference_key.localeCompare(right.inference_key),
            )
            .map(cloneJson);
    }

    async listAllMlInferences(): Promise<ObjectiveMlInferenceRecord[]> {
        return [...this.byKey.values()]
            .sort((left, right) =>
                left.inference_key.localeCompare(right.inference_key),
            )
            .map(cloneJson);
    }
}
