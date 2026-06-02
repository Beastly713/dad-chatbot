export type ObjectiveVisibilityFlags = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveVisibilityInput = {
    clinician_visible?: unknown;
    patient_visible?: unknown;
    chatbot_visible?: unknown;
    developer_visible?: unknown;
    developer_only?: unknown;
};

export type ObjectiveSerializedRecord<T extends Record<string, unknown>> = T & {
    visibility: ObjectiveVisibilityFlags;
};

const HIDDEN_KEYS = new Set([
    "clinician_visible",
    "patient_visible",
    "chatbot_visible",
    "developer_visible",
    "developer_only",
    "developer_labels",
    "synthetic_ground_truth",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertObjectiveRecordClinicianOnly(
    record: ObjectiveVisibilityInput,
): ObjectiveVisibilityFlags {
    if (
        record.clinician_visible !== true ||
        record.patient_visible !== false ||
        record.chatbot_visible !== false
    ) {
        throw new Error("Invalid objective visibility flags");
    }

    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

export function serializeClinicianObjectiveRecord<
    T extends Record<string, unknown>,
>(record: T): ObjectiveSerializedRecord<Omit<T, keyof ObjectiveVisibilityInput>> {
    const visibility = assertObjectiveRecordClinicianOnly(record);

    const serializedEntries = Object.entries(record).filter(
        ([key]) => !HIDDEN_KEYS.has(key),
    );

    return {
        ...(Object.fromEntries(serializedEntries) as Omit<
            T,
            keyof ObjectiveVisibilityInput
        >),
        visibility,
    };
}

export function stripDeveloperOnlyFields<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => stripDeveloperOnlyFields(item)) as T;
    }

    if (!isRecord(value)) {
        return value;
    }

    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
        if (HIDDEN_KEYS.has(key)) {
            continue;
        }

        output[key] = stripDeveloperOnlyFields(item);
    }

    return output as T;
}
