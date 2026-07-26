import { randomUUID } from "crypto";

export type ObjectiveFeatureWindowSourceType =
    | "simulator"
    | "public_dataset_replay"
    | "prototype_hardware";

export type ObjectiveFeatureWindowStatus =
    | "ready"
    | "suppressed"
    | "insufficient_data";

export type ObjectiveFeatureSuppressionState =
    | "not_suppressed"
    | "suppressed_low_quality"
    | "suppressed_missing_baseline"
    | "suppressed_motion_confound"
    | "suppressed_signal_conflict"
    | "suppressed_missing_data";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type ObjectiveFeatureWindowVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveFeatureWindowPersistenceInput = {
    feature_window_key: string;
    session_id: string;
    segment_id?: string;
    source_type: ObjectiveFeatureWindowSourceType;
    start_esp_time_ms: number;
    end_esp_time_ms: number;
    start_pc_timestamp?: string;
    end_pc_timestamp?: string;
    raw_batch_id?: string;
    raw_chunk_refs: JsonValue[];
    raw_range_refs: JsonObject;
    preprocessing_version: string;
    feature_schema_version: string;
    window_status: ObjectiveFeatureWindowStatus;
    suppression_state?: ObjectiveFeatureSuppressionState;
    quality: JsonObject;
    missingness: JsonObject;
    modality_availability: JsonObject;
    features: JsonObject;
    baseline_profile_id?: string;
    baseline_relative: JsonObject;
    uncertainty_reasons: string[];
    clinician_visible?: true;
    patient_visible?: false;
    chatbot_visible?: false;
};

export type ObjectiveFeatureWindowRecord =
    ObjectiveFeatureWindowPersistenceInput &
        ObjectiveFeatureWindowVisibility & {
            id: string;
            created_at: string;
            suppression_state: ObjectiveFeatureSuppressionState;
        };

type NormalizedObjectiveFeatureWindowInput =
    ObjectiveFeatureWindowPersistenceInput &
        ObjectiveFeatureWindowVisibility & {
            suppression_state: ObjectiveFeatureSuppressionState;
        };

export type ObjectiveFeatureWindowListFilter = {
    session_id: string;
    segment_id?: string;
};

export type ObjectiveFeatureWindowStorageRepository = {
    saveFeatureWindow(
        input: ObjectiveFeatureWindowPersistenceInput,
    ): Promise<ObjectiveFeatureWindowRecord>;
    saveFeatureWindows(
        inputs: readonly ObjectiveFeatureWindowPersistenceInput[],
    ): Promise<ObjectiveFeatureWindowRecord[]>;
    getFeatureWindowByKey(
        featureWindowKey: string,
    ): Promise<ObjectiveFeatureWindowRecord | null>;
    listFeatureWindowsForSession(
        filter: ObjectiveFeatureWindowListFilter,
    ): Promise<ObjectiveFeatureWindowRecord[]>;
    listAllFeatureWindows(): Promise<ObjectiveFeatureWindowRecord[]>;
};

const SOURCE_TYPES: readonly ObjectiveFeatureWindowSourceType[] = [
    "simulator",
    "public_dataset_replay",
    "prototype_hardware",
];

const WINDOW_STATUSES: readonly ObjectiveFeatureWindowStatus[] = [
    "ready",
    "suppressed",
    "insufficient_data",
];

const SUPPRESSION_STATES: readonly ObjectiveFeatureSuppressionState[] = [
    "not_suppressed",
    "suppressed_low_quality",
    "suppressed_missing_baseline",
    "suppressed_motion_confound",
    "suppressed_signal_conflict",
    "suppressed_missing_data",
];

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function assertNonEmptyString(value: string | undefined, name: string): string {
    if (!value || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return value;
}

function assertFiniteInteger(value: number, name: string): number {
    if (!Number.isInteger(value)) {
        throw new Error(`${name} must be an integer`);
    }

    return value;
}

function assertJsonObject(value: unknown, name: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${name} must be a JSON object`);
    }

    return value as JsonObject;
}

function assertJsonArray(value: unknown, name: string): JsonValue[] {
    if (!Array.isArray(value)) {
        throw new Error(`${name} must be a JSON array`);
    }

    return value as JsonValue[];
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

function assertAllowedValue<T extends string>(
    value: string | undefined,
    allowed: readonly T[],
    name: string,
): T {
    if (!value || !allowed.includes(value as T)) {
        throw new Error(`${name} is not supported`);
    }

    return value as T;
}

function assertClinicianOnlyVisibility(
    input: Pick<
        ObjectiveFeatureWindowPersistenceInput,
        "clinician_visible" | "patient_visible" | "chatbot_visible"
    >,
): ObjectiveFeatureWindowVisibility {
    if (input.clinician_visible !== undefined && input.clinician_visible !== true) {
        throw new Error("feature window clinician_visible must remain true");
    }

    if (input.patient_visible !== undefined && input.patient_visible !== false) {
        throw new Error("feature window patient_visible must remain false");
    }

    if (input.chatbot_visible !== undefined && input.chatbot_visible !== false) {
        throw new Error("feature window chatbot_visible must remain false");
    }

    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function normalizeFeatureWindowInput(
    input: ObjectiveFeatureWindowPersistenceInput,
): NormalizedObjectiveFeatureWindowInput {
    const startEspTimeMs = assertFiniteInteger(
        input.start_esp_time_ms,
        "start_esp_time_ms",
    );
    const endEspTimeMs = assertFiniteInteger(
        input.end_esp_time_ms,
        "end_esp_time_ms",
    );

    if (endEspTimeMs < startEspTimeMs) {
        throw new Error(
            "end_esp_time_ms must be greater than or equal to start_esp_time_ms",
        );
    }

    return {
        feature_window_key: assertNonEmptyString(
            input.feature_window_key,
            "feature_window_key",
        ),
        session_id: assertNonEmptyString(input.session_id, "session_id"),
        ...(input.segment_id
            ? { segment_id: assertNonEmptyString(input.segment_id, "segment_id") }
            : {}),
        source_type: assertAllowedValue(
            input.source_type,
            SOURCE_TYPES,
            "source_type",
        ),
        start_esp_time_ms: startEspTimeMs,
        end_esp_time_ms: endEspTimeMs,
        ...(input.start_pc_timestamp
            ? {
                  start_pc_timestamp: assertNonEmptyString(
                      input.start_pc_timestamp,
                      "start_pc_timestamp",
                  ),
              }
            : {}),
        ...(input.end_pc_timestamp
            ? {
                  end_pc_timestamp: assertNonEmptyString(
                      input.end_pc_timestamp,
                      "end_pc_timestamp",
                  ),
              }
            : {}),
        ...(input.raw_batch_id
            ? {
                  raw_batch_id: assertNonEmptyString(
                      input.raw_batch_id,
                      "raw_batch_id",
                  ),
              }
            : {}),
        raw_chunk_refs: assertJsonArray(input.raw_chunk_refs, "raw_chunk_refs"),
        raw_range_refs: assertJsonObject(input.raw_range_refs, "raw_range_refs"),
        preprocessing_version: assertNonEmptyString(
            input.preprocessing_version,
            "preprocessing_version",
        ),
        feature_schema_version: assertNonEmptyString(
            input.feature_schema_version,
            "feature_schema_version",
        ),
        window_status: assertAllowedValue(
            input.window_status,
            WINDOW_STATUSES,
            "window_status",
        ),
        suppression_state: assertAllowedValue(
            input.suppression_state ?? "not_suppressed",
            SUPPRESSION_STATES,
            "suppression_state",
        ),
        quality: assertJsonObject(input.quality, "quality"),
        missingness: assertJsonObject(input.missingness, "missingness"),
        modality_availability: assertJsonObject(
            input.modality_availability,
            "modality_availability",
        ),
        features: assertJsonObject(input.features, "features"),
        ...(input.baseline_profile_id
            ? {
                  baseline_profile_id: assertNonEmptyString(
                      input.baseline_profile_id,
                      "baseline_profile_id",
                  ),
              }
            : {}),
        baseline_relative: assertJsonObject(
            input.baseline_relative,
            "baseline_relative",
        ),
        uncertainty_reasons: assertStringArray(
            input.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        ...assertClinicianOnlyVisibility(input),
    };
}

function createFeatureWindowRecord(
    input: ObjectiveFeatureWindowPersistenceInput,
    now: () => Date,
): ObjectiveFeatureWindowRecord {
    const normalized = normalizeFeatureWindowInput(input);

    return {
        id: randomUUID(),
        created_at: now().toISOString(),
        ...cloneJson(normalized),
    };
}

export class InMemoryObjectiveFeatureWindowRepository
    implements ObjectiveFeatureWindowStorageRepository
{
    private readonly byKey = new Map<string, ObjectiveFeatureWindowRecord>();

    constructor(private readonly now: () => Date = () => new Date()) {}

    async saveFeatureWindow(
        input: ObjectiveFeatureWindowPersistenceInput,
    ): Promise<ObjectiveFeatureWindowRecord> {
        const [record] = await this.saveFeatureWindows([input]);

        return record;
    }

    async saveFeatureWindows(
        inputs: readonly ObjectiveFeatureWindowPersistenceInput[],
    ): Promise<ObjectiveFeatureWindowRecord[]> {
        const candidateRecords = inputs.map((input) =>
            createFeatureWindowRecord(input, this.now),
        );
        const candidateKeys = candidateRecords.map(
            (record) => record.feature_window_key,
        );
        const uniqueCandidateKeys = new Set(candidateKeys);

        if (uniqueCandidateKeys.size !== candidateKeys.length) {
            throw new Error(
                "feature_window_key values must be unique within one save operation",
            );
        }

        for (const key of candidateKeys) {
            if (this.byKey.has(key)) {
                throw new Error(`feature_window_key already exists: ${key}`);
            }
        }

        for (const record of candidateRecords) {
            this.byKey.set(record.feature_window_key, cloneJson(record));
        }

        return candidateRecords.map(cloneJson);
    }

    async getFeatureWindowByKey(
        featureWindowKey: string,
    ): Promise<ObjectiveFeatureWindowRecord | null> {
        const key = assertNonEmptyString(featureWindowKey, "feature_window_key");
        const record = this.byKey.get(key);

        return record ? cloneJson(record) : null;
    }

    async listFeatureWindowsForSession(
        filter: ObjectiveFeatureWindowListFilter,
    ): Promise<ObjectiveFeatureWindowRecord[]> {
        const sessionId = assertNonEmptyString(filter.session_id, "session_id");
        const records = [...this.byKey.values()]
            .filter((record) => record.session_id === sessionId)
            .filter((record) =>
                filter.segment_id ? record.segment_id === filter.segment_id : true,
            )
            .sort(
                (left, right) =>
                    left.start_esp_time_ms - right.start_esp_time_ms ||
                    left.end_esp_time_ms - right.end_esp_time_ms ||
                    left.feature_window_key.localeCompare(right.feature_window_key),
            );

        return records.map(cloneJson);
    }

    async listAllFeatureWindows(): Promise<ObjectiveFeatureWindowRecord[]> {
        return [...this.byKey.values()]
            .sort((left, right) =>
                left.feature_window_key.localeCompare(right.feature_window_key),
            )
            .map(cloneJson);
    }
}
