import { randomUUID } from "crypto";
import type { ObjectiveFeatureWindowRecord } from "./featureStorage.js";
import type { ObjectiveInterpretationRecord } from "./interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "./mlInferenceStorage.js";
import type { ObjectiveSegmentRecord } from "./segmentManager.js";
import type { ObjectiveSessionRecord } from "./sessionLifecycle.js";
import type { ObjectiveStreamEventScope } from "./streamTokens.js";

export type ObjectiveStreamJsonPrimitive = string | number | boolean | null;
export type ObjectiveStreamJsonValue =
    | ObjectiveStreamJsonPrimitive
    | ObjectiveStreamJsonObject
    | ObjectiveStreamJsonValue[];
export type ObjectiveStreamJsonObject = {
    [key: string]: ObjectiveStreamJsonValue;
};

export type ObjectiveStreamVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveClinicianStreamEventType = ObjectiveStreamEventScope;

export type ObjectiveClinicianStreamEvent<
    TPayload extends ObjectiveStreamJsonObject = ObjectiveStreamJsonObject,
> = {
    event_id: string;
    event_type: ObjectiveClinicianStreamEventType;
    session_id: string;
    emitted_at: string;
    payload: TPayload;
    visibility: ObjectiveStreamVisibility;
};

export type ObjectiveChartSafeSample = {
    t_ms: number;
    relative_time_ms?: number;
    values: {
        heart_activity_trend?: number;
        skin_conductance_trend?: number;
        ppg_pulse_trend?: number;
        motion_confound_index?: number;
        local_temperature_trend?: number;
    };
    quality?: {
        overall?: string | number;
        ecg?: string | number;
        gsr?: string | number;
        ppg?: string | number;
        motion?: string | number;
        temperature?: string | number;
    };
};

const RAW_OR_UNSAFE_KEYS = new Set([
    "raw_payload",
    "rawPayload",
    "raw_frame",
    "rawFrame",
    "raw_frames",
    "rawFrames",
    "frame",
    "frames",
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
    "developer_labels",
    "synthetic_ground_truth",
]);

const FORBIDDEN_STREAM_TEXT = [
    "craving_detected",
    "relapse_risk",
    "withdrawal_risk",
    "intoxication_detected",
    "aud_severity",
    "emergency_detected",
    "treatment_need",
    "detox_need",
    "medication_need",
    "ciwa_score",
    "sobriety_status",
    "patient_truthfulness",
    "patient_is_lying",
    "patient_is_safe",
    "patient_is_stable",
    "stress_proven",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function visibility(): ObjectiveStreamVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function assertFiniteNumber(value: number, name: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be finite`);
    }

    return value;
}

function assertNonEmptyString(value: string, name: string): string {
    if (value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return value;
}

function assertJsonSafe(value: unknown, path = "payload"): void {
    if (typeof value === "string") {
        const lowered = value.toLowerCase();

        for (const forbidden of FORBIDDEN_STREAM_TEXT) {
            if (lowered.includes(forbidden)) {
                throw new Error(`Unsafe stream text is not allowed at ${path}`);
            }
        }

        return;
    }

    if (
        value === null ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        if (typeof value === "number" && !Number.isFinite(value)) {
            throw new Error(`Stream number must be finite at ${path}`);
        }

        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
        return;
    }

    if (!isRecord(value)) {
        throw new Error(`Stream payload contains unsupported value at ${path}`);
    }

    if (
        Object.prototype.hasOwnProperty.call(value, "clinician_visible") ||
        Object.prototype.hasOwnProperty.call(value, "patient_visible") ||
        Object.prototype.hasOwnProperty.call(value, "chatbot_visible")
    ) {
        if (
            value.clinician_visible !== true ||
            value.patient_visible !== false ||
            value.chatbot_visible !== false
        ) {
            throw new Error(
                `Objective stream visibility must remain clinician-only at ${path}`,
            );
        }
    }

    for (const [key, item] of Object.entries(value)) {
        if (RAW_OR_UNSAFE_KEYS.has(key)) {
            throw new Error(`Unsafe stream payload key is not allowed: ${key}`);
        }

        const loweredKey = key.toLowerCase();

        for (const forbidden of FORBIDDEN_STREAM_TEXT) {
            if (loweredKey.includes(forbidden)) {
                throw new Error(`Unsafe stream payload key is not allowed: ${key}`);
            }
        }

        assertJsonSafe(item, `${path}.${key}`);
    }
}

function createStreamEvent<TPayload extends ObjectiveStreamJsonObject>(
    event_type: ObjectiveClinicianStreamEventType,
    session_id: string,
    payload: TPayload,
    now: () => Date = () => new Date(),
): ObjectiveClinicianStreamEvent<TPayload> {
    assertNonEmptyString(session_id, "session_id");
    assertJsonSafe(payload);

    return {
        event_id: randomUUID(),
        event_type,
        session_id,
        emitted_at: now().toISOString(),
        payload: cloneJson(payload),
        visibility: visibility(),
    };
}

export function createObjectiveHeartbeatStreamEvent(
    sessionId: string,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "heartbeat",
        sessionId,
        {
            status: "connected",
        },
        now,
    );
}

export function createObjectiveSessionStatusStreamEvent(
    session: ObjectiveSessionRecord,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "session.status",
        session.session_id,
        {
            session_id: session.session_id,
            patient_id: session.patient_id,
            source_type: session.source_type,
            status: session.status,
            device_id: session.device_id ?? null,
            device_boot_id: session.device_boot_id ?? null,
            created_at: session.created_at,
            started_at: session.started_at ?? null,
            paused_at: session.paused_at ?? null,
            stopped_at: session.stopped_at ?? null,
            visibility: visibility(),
        },
        now,
    );
}

export function createObjectiveSessionSegmentStreamEvent(
    segment: ObjectiveSegmentRecord,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "session.segment",
        segment.session_id,
        {
            segment_id: segment.segment_id,
            session_id: segment.session_id,
            device_boot_id: segment.device_boot_id,
            reason: segment.reason,
            start_esp_time_ms: segment.start_esp_time_ms,
            end_esp_time_ms: segment.end_esp_time_ms ?? null,
            created_at: segment.created_at,
            visibility: visibility(),
        },
        now,
    );
}

export function createObjectiveChartSamplesStreamEvent(
    sessionId: string,
    samples: readonly ObjectiveChartSafeSample[],
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    const safeSamples = samples.map((sample) => ({
        t_ms: assertFiniteNumber(sample.t_ms, "sample.t_ms"),
        ...(sample.relative_time_ms !== undefined
            ? {
                  relative_time_ms: assertFiniteNumber(
                      sample.relative_time_ms,
                      "sample.relative_time_ms",
                  ),
              }
            : {}),
        values: {
            ...(sample.values.heart_activity_trend !== undefined
                ? {
                      heart_activity_trend: assertFiniteNumber(
                          sample.values.heart_activity_trend,
                          "heart_activity_trend",
                      ),
                  }
                : {}),
            ...(sample.values.skin_conductance_trend !== undefined
                ? {
                      skin_conductance_trend: assertFiniteNumber(
                          sample.values.skin_conductance_trend,
                          "skin_conductance_trend",
                      ),
                  }
                : {}),
            ...(sample.values.ppg_pulse_trend !== undefined
                ? {
                      ppg_pulse_trend: assertFiniteNumber(
                          sample.values.ppg_pulse_trend,
                          "ppg_pulse_trend",
                      ),
                  }
                : {}),
            ...(sample.values.motion_confound_index !== undefined
                ? {
                      motion_confound_index: assertFiniteNumber(
                          sample.values.motion_confound_index,
                          "motion_confound_index",
                      ),
                  }
                : {}),
            ...(sample.values.local_temperature_trend !== undefined
                ? {
                      local_temperature_trend: assertFiniteNumber(
                          sample.values.local_temperature_trend,
                          "local_temperature_trend",
                      ),
                  }
                : {}),
        },
        ...(sample.quality ? { quality: sample.quality } : {}),
    }));

    return createStreamEvent(
        "chart.samples",
        sessionId,
        {
            samples: safeSamples,
        },
        now,
    );
}

export function createObjectiveQualityUpdateStreamEvent(
    sessionId: string,
    payload: ObjectiveStreamJsonObject,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent("quality.update", sessionId, payload, now);
}

export function createObjectiveFeatureWindowStreamEvent(
    featureWindow: ObjectiveFeatureWindowRecord,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "feature.window",
        featureWindow.session_id,
        {
            feature_window_id: featureWindow.id,
            feature_window_key: featureWindow.feature_window_key,
            session_id: featureWindow.session_id,
            segment_id: featureWindow.segment_id ?? null,
            source_type: featureWindow.source_type,
            start_esp_time_ms: featureWindow.start_esp_time_ms,
            end_esp_time_ms: featureWindow.end_esp_time_ms,
            start_pc_timestamp: featureWindow.start_pc_timestamp ?? null,
            end_pc_timestamp: featureWindow.end_pc_timestamp ?? null,
            preprocessing_version: featureWindow.preprocessing_version,
            feature_schema_version: featureWindow.feature_schema_version,
            window_status: featureWindow.window_status,
            suppression_state: featureWindow.suppression_state,
            quality: featureWindow.quality,
            missingness: featureWindow.missingness,
            modality_availability: featureWindow.modality_availability,
            baseline_relative: featureWindow.baseline_relative,
            uncertainty_reasons: featureWindow.uncertainty_reasons,
            visibility: visibility(),
        },
        now,
    );
}

export function createObjectiveMlInferenceStreamEvent(
    inference: ObjectiveMlInferenceRecord,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "ml.inference",
        inference.session_id,
        {
            ml_inference_id: inference.id,
            inference_key: inference.inference_key,
            feature_window_id: inference.feature_window_id,
            feature_window_key: inference.feature_window_key ?? null,
            session_id: inference.session_id,
            segment_id: inference.segment_id ?? null,
            model_version: inference.model_version,
            target: inference.target,
            predicted_class: inference.predicted_class,
            confidence_label: inference.confidence_label,
            probability: inference.probability,
            uncertainty_reasons: inference.uncertainty_reasons,
            suppression_state: inference.suppression_state,
            created_at: inference.created_at,
            visibility: visibility(),
        },
        now,
    );
}

export function createObjectiveInterpretationRecordStreamEvent(
    interpretation: ObjectiveInterpretationRecord,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    const eventType =
        interpretation.suppression_state === "not_suppressed"
            ? "interpretation.record"
            : "interpretation.suppressed";

    return createStreamEvent(
        eventType,
        interpretation.session_id,
        {
            interpretation_id: interpretation.id,
            interpretation_key: interpretation.interpretation_key,
            feature_window_id: interpretation.feature_window_id,
            feature_window_key: interpretation.feature_window_key ?? null,
            ml_inference_id: interpretation.ml_inference_id ?? null,
            session_id: interpretation.session_id,
            segment_id: interpretation.segment_id ?? null,
            interpretation_version: interpretation.interpretation_version,
            target: interpretation.target,
            interpretation_label: interpretation.interpretation_label,
            evidence_level: interpretation.evidence_level,
            confidence_label: interpretation.confidence_label,
            suppression_state: interpretation.suppression_state,
            uncertainty_reasons: interpretation.uncertainty_reasons,
            contributing_modalities: interpretation.contributing_modalities,
            excluded_modalities: interpretation.excluded_modalities,
            source_banner: interpretation.source_banner,
            summary_payload: interpretation.summary_payload ?? null,
            created_at: interpretation.created_at,
            visibility: visibility(),
        },
        now,
    );
}

export function createObjectiveSessionSummaryPartialStreamEvent(
    sessionId: string,
    payload: ObjectiveStreamJsonObject,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent("session.summary.partial", sessionId, payload, now);
}

export function createObjectiveStreamErrorEvent(
    sessionId: string,
    code: string,
    message: string,
    now?: () => Date,
): ObjectiveClinicianStreamEvent {
    return createStreamEvent(
        "error",
        sessionId,
        {
            code: assertNonEmptyString(code, "code"),
            message: assertNonEmptyString(message, "message"),
        },
        now,
    );
}

export function serializeObjectiveClinicianStreamEvent(
    event: ObjectiveClinicianStreamEvent,
): ObjectiveClinicianStreamEvent {
    assertJsonSafe(event);

    if (
        event.visibility.clinician_visible !== true ||
        event.visibility.patient_visible !== false ||
        event.visibility.chatbot_visible !== false
    ) {
        throw new Error("Objective stream event visibility must remain clinician-only");
    }

    return cloneJson(event);
}

export class InMemoryObjectiveClinicianStreamHub {
    private readonly subscribersBySession = new Map<
        string,
        Set<{
            allowedScopes: ReadonlySet<ObjectiveClinicianStreamEventType>;
            send(event: ObjectiveClinicianStreamEvent): void;
        }>
    >();

    subscribe(
        sessionId: string,
        subscriber: {
            allowedScopes: ReadonlySet<ObjectiveClinicianStreamEventType>;
            send(event: ObjectiveClinicianStreamEvent): void;
        },
    ): () => void {
        const normalizedSessionId = assertNonEmptyString(sessionId, "session_id");
        const subscribers =
            this.subscribersBySession.get(normalizedSessionId) ?? new Set();

        subscribers.add(subscriber);
        this.subscribersBySession.set(normalizedSessionId, subscribers);

        return () => {
            subscribers.delete(subscriber);

            if (subscribers.size === 0) {
                this.subscribersBySession.delete(normalizedSessionId);
            }
        };
    }

    publish(event: ObjectiveClinicianStreamEvent): number {
        const safeEvent = serializeObjectiveClinicianStreamEvent(event);
        const subscribers = this.subscribersBySession.get(safeEvent.session_id);

        if (!subscribers) {
            return 0;
        }

        let delivered = 0;

        for (const subscriber of subscribers) {
            if (!subscriber.allowedScopes.has(safeEvent.event_type)) {
                continue;
            }

            subscriber.send(safeEvent);
            delivered += 1;
        }

        return delivered;
    }

    subscriberCount(sessionId?: string): number {
        if (sessionId) {
            return this.subscribersBySession.get(sessionId)?.size ?? 0;
        }

        let count = 0;

        for (const subscribers of this.subscribersBySession.values()) {
            count += subscribers.size;
        }

        return count;
    }

    clear(): void {
        this.subscribersBySession.clear();
    }
}
