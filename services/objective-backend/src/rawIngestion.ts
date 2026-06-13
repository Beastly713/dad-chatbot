import { randomUUID } from "crypto";
import type { ObjectiveAuditLogger } from "./audit.js";
import type { ObjectiveActor, ObjectiveGuardResult } from "./auth.js";
import {
    analyzeObjectiveRawTiming,
    partitionObjectiveFramesByTimingGaps,
    type ObjectiveRawTimingAnalysis,
} from "./rawTiming.js";
import {
    InMemoryObjectiveRawStorageRepository,
    type ObjectiveRawStorageRepository,
} from "./rawStorage.js";
import {
    inferSegmentReason,
    InMemoryObjectiveSegmentManager,
    type ObjectiveSegmentManager,
} from "./segmentManager.js";
import type {
    ObjectiveSessionLifecycleDependencies,
    ObjectiveSessionRecord,
} from "./sessionLifecycle.js";
import { requireSessionAccess } from "./sessionLifecycle.js";
import type { ObjectiveTraceContext } from "./trace.js";

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

const OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV =
    "OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED";

function isTruthyPrototypeHardwareFlag(value: string | undefined): boolean {
    const normalized = value?.trim().toLowerCase();

    return (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "enabled" ||
        normalized === "debug"
    );
}

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

export type ObjectiveRawBatchInput = {
    batch_id: string;
    session_id: string;
    source_type: ObjectiveSessionRecord["source_type"];
    schema_version: typeof OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION;
    device_id: string;
    device_boot_id: string;
    segment_id?: string;
    frames: unknown[];
};

export type ObjectiveAcceptedRawChunk = {
    raw_chunk_id: string;
    batch_id: string;
    session_id: string;
    source_type: ObjectiveSessionRecord["source_type"];
    device_id: string;
    device_boot_id: string;
    segment_id?: string;
    chunk_index: number;
    frame_count: number;
    first_esp_time_ms: number;
    last_esp_time_ms: number;
    timing: ObjectiveRawTimingAnalysis;
    frames: ObjectiveRawSensorFrame[];
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveQuarantinedRawFrame = {
    quarantine_id: string;
    batch_id: string;
    session_id: string;
    source_type?: ObjectiveSessionRecord["source_type"];
    device_id?: string;
    device_boot_id?: string;
    segment_id?: string;
    frame_index: number;
    esp_time_ms?: number;
    pc_timestamp?: string;
    reject_reason: string;
    reject_details: string[];
    raw_payload_shape: "object" | "array" | "primitive" | "null";
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveRawIngestionResult = {
    batch_id: string;
    session_id: string;
    accepted_frame_count: number;
    quarantined_frame_count: number;
    timing: ObjectiveRawTimingAnalysis;
    chunks: ObjectiveAcceptedRawChunk[];
    quarantined: ObjectiveQuarantinedRawFrame[];
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveRawIngestionRepository = ObjectiveRawStorageRepository;

export type ObjectiveRawIngestionDependencies =
    ObjectiveSessionLifecycleDependencies & {
        rawIngestion: ObjectiveRawIngestionRepository;
        segmentManager?: ObjectiveSegmentManager;
        auditLogger?: ObjectiveAuditLogger;
        prototypeHardwareIngestionEnabled?: boolean;
    };

const NUMERIC_RAW_FIELDS = RAW_SENSOR_FIELD_NAMES.filter(
    (fieldName): fieldName is Exclude<RawSensorFieldName, "pc_timestamp"> =>
        fieldName !== "pc_timestamp",
);

const FORBIDDEN_FRAME_KEYS = new Set([
    "craving_detected",
    "relapse_risk",
    "withdrawal_risk",
    "intoxication_detected",
    "AUD_severity",
    "emergency_detected",
    "treatment_need",
    "detox_need",
    "medication_need",
    "CIWA_score",
    "sobriety_status",
    "patient_truthfulness",
    "patient_is_lying",
    "patient_is_safe",
    "patient_is_stable",
    "stress_proven",
]);

export class InMemoryObjectiveRawIngestionRepository extends InMemoryObjectiveRawStorageRepository {}

const defaultSegmentManager = new InMemoryObjectiveSegmentManager();

function isPrototypeHardwareIngestionEnabled(
    dependencies: ObjectiveRawIngestionDependencies,
): boolean {
    if (typeof dependencies.prototypeHardwareIngestionEnabled === "boolean") {
        return dependencies.prototypeHardwareIngestionEnabled;
    }

    return isTruthyPrototypeHardwareFlag(
        process.env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV],
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function rawPayloadShape(
    value: unknown,
): ObjectiveQuarantinedRawFrame["raw_payload_shape"] {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return "array";
    }

    if (typeof value === "object") {
        return "object";
    }

    return "primitive";
}

function validateFrame(
    value: unknown,
):
    | { valid: true; frame: ObjectiveRawSensorFrame }
    | {
          valid: false;
          errors: string[];
          espTimeMs?: number;
          pcTimestamp?: string;
      } {
    const errors: string[] = [];

    if (!isRecord(value)) {
        return {
            valid: false,
            errors: ["frame must be an object"],
        };
    }

    for (const forbiddenKey of FORBIDDEN_FRAME_KEYS) {
        if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) {
            errors.push(`forbidden field is not allowed: ${forbiddenKey}`);
        }
    }

    if (!isNonEmptyString(value.pc_timestamp)) {
        errors.push("pc_timestamp must be a non-empty string");
    }

    if (!isFiniteNumber(value.esp_time_ms) || !Number.isInteger(value.esp_time_ms)) {
        errors.push("esp_time_ms must be an integer");
    } else if (value.esp_time_ms < 0) {
        errors.push("esp_time_ms must be non-negative");
    }

    for (const fieldName of NUMERIC_RAW_FIELDS) {
        const rawValue = value[fieldName];

        if (rawValue !== undefined && !isFiniteNumber(rawValue)) {
            errors.push(`${fieldName} must be a finite number when provided`);
        }
    }

    if (errors.length > 0) {
        return {
            valid: false,
            errors,
            espTimeMs: isFiniteNumber(value.esp_time_ms)
                ? value.esp_time_ms
                : undefined,
            pcTimestamp: isNonEmptyString(value.pc_timestamp)
                ? value.pc_timestamp
                : undefined,
        };
    }

    const pcTimestamp = value.pc_timestamp;
    const espTimeMs = value.esp_time_ms;

    if (!isNonEmptyString(pcTimestamp) || !isFiniteNumber(espTimeMs)) {
        return {
            valid: false,
            errors: ["frame validation failed"],
        };
    }

    const frame: ObjectiveRawSensorFrame = {
        pc_timestamp: pcTimestamp,
        esp_time_ms: espTimeMs,
    };

    for (const fieldName of NUMERIC_RAW_FIELDS) {
        const rawValue = value[fieldName];

        if (isFiniteNumber(rawValue)) {
            frame[fieldName] = rawValue;
        }
    }

    return {
        valid: true,
        frame,
    };
}

function parseRawBatchInput(
    value: unknown,
): ObjectiveGuardResult<ObjectiveRawBatchInput> {
    if (!isRecord(value)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_raw_batch",
            message: "Objective raw batch payload must be an object.",
            auditEvent: null,
        };
    }

    if (!isNonEmptyString(value.batch_id)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_batch_id",
            message: "Objective raw batch requires batch_id.",
            auditEvent: null,
        };
    }

    if (!isNonEmptyString(value.session_id)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_session_id",
            message: "Objective raw batch requires session_id.",
            auditEvent: null,
        };
    }

    if (value.schema_version !== OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_raw_schema_version",
            message: "Objective raw batch schema_version is unsupported.",
            auditEvent: null,
        };
    }

    if (
        value.source_type !== "simulator" &&
        value.source_type !== "public_dataset_replay" &&
        value.source_type !== "prototype_hardware"
    ) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_source_type",
            message: "Objective raw batch source_type is unsupported.",
            auditEvent: null,
        };
    }

    if (!isNonEmptyString(value.device_id)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_device_id",
            message: "Objective raw batch requires device_id.",
            auditEvent: null,
        };
    }

    if (!isNonEmptyString(value.device_boot_id)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_device_boot_id",
            message: "Objective raw batch requires device_boot_id.",
            auditEvent: null,
        };
    }

    if (!Array.isArray(value.frames) || value.frames.length === 0) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_raw_frames",
            message: "Objective raw batch requires at least one frame.",
            auditEvent: null,
        };
    }

    if (value.segment_id !== undefined && !isNonEmptyString(value.segment_id)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_segment_id",
            message: "Objective raw batch segment_id must be non-empty when provided.",
            auditEvent: null,
        };
    }

    return {
        allowed: true,
        value: {
            batch_id: value.batch_id,
            session_id: value.session_id,
            source_type: value.source_type,
            schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
            device_id: value.device_id,
            device_boot_id: value.device_boot_id,
            segment_id: value.segment_id,
            frames: value.frames,
        },
        auditEvent: null,
    };
}

async function buildIngestionResult(
    input: ObjectiveRawBatchInput,
    segmentManager: ObjectiveSegmentManager,
): Promise<ObjectiveRawIngestionResult> {
    const acceptedFrames: ObjectiveRawSensorFrame[] = [];
    const quarantined: ObjectiveQuarantinedRawFrame[] = [];

    input.frames.forEach((frameValue, frameIndex) => {
        const validation = validateFrame(frameValue);

        if (validation.valid) {
            acceptedFrames.push(validation.frame);
            return;
        }

        quarantined.push({
            quarantine_id: randomUUID(),
            batch_id: input.batch_id,
            session_id: input.session_id,
            source_type: input.source_type,
            device_id: input.device_id,
            device_boot_id: input.device_boot_id,
            segment_id: input.segment_id,
            frame_index: frameIndex,
            esp_time_ms: validation.espTimeMs,
            pc_timestamp: validation.pcTimestamp,
            reject_reason: "invalid_raw_frame",
            reject_details: validation.errors,
            raw_payload_shape: rawPayloadShape(frameValue),
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
    });

    const timing = analyzeObjectiveRawTiming(acceptedFrames);
    const partitions = partitionObjectiveFramesByTimingGaps(acceptedFrames);

    let currentSegment = await segmentManager.getCurrentSegment(input.session_id);
    const chunks: ObjectiveAcceptedRawChunk[] = [];

    for (const partition of partitions) {
        const segmentReason = inferSegmentReason(
            currentSegment,
            input.device_boot_id,
            partition.partition_index,
        );

        const segment = input.segment_id
            ? {
                  segment_id: input.segment_id,
              }
            : await segmentManager.assignSegment({
                  sessionId: input.session_id,
                  deviceBootId: input.device_boot_id,
                  firstEspTimeMs: partition.first_esp_time_ms,
                  lastEspTimeMs: partition.last_esp_time_ms,
                  reason: segmentReason,
              });

        chunks.push({
            raw_chunk_id: randomUUID(),
            batch_id: input.batch_id,
            session_id: input.session_id,
            source_type: input.source_type,
            device_id: input.device_id,
            device_boot_id: input.device_boot_id,
            segment_id: segment.segment_id,
            chunk_index: partition.partition_index,
            frame_count: partition.frames.length,
            first_esp_time_ms: partition.first_esp_time_ms,
            last_esp_time_ms: partition.last_esp_time_ms,
            timing: analyzeObjectiveRawTiming(partition.frames),
            frames: partition.frames,
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });

        currentSegment = await segmentManager.getCurrentSegment(input.session_id);
    }

    return {
        batch_id: input.batch_id,
        session_id: input.session_id,
        accepted_frame_count: acceptedFrames.length,
        quarantined_frame_count: quarantined.length,
        timing,
        chunks,
        quarantined,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

async function auditIngestion(
    auditLogger: ObjectiveAuditLogger | undefined,
    actor: ObjectiveActor,
    result: ObjectiveRawIngestionResult,
    trace: ObjectiveTraceContext,
): Promise<void> {
    if (!auditLogger) {
        return;
    }

    await auditLogger.record({
        eventType:
            result.accepted_frame_count > 0 ? "ingest_accepted" : "ingest_rejected",
        actorId: actor.actorId,
        actorRole: actor.role,
        sessionId: result.session_id,
        trace,
        metadata: {
            batch_id: result.batch_id,
            accepted_frame_count: result.accepted_frame_count,
            quarantined_frame_count: result.quarantined_frame_count,
            chunk_count: result.chunks.length,
        },
    });
}

export async function ingestObjectiveRawBatch(
    actor: ObjectiveActor,
    payload: unknown,
    dependencies: ObjectiveRawIngestionDependencies,
    trace: ObjectiveTraceContext,
): Promise<ObjectiveGuardResult<ObjectiveRawIngestionResult>> {
    const batchInput = parseRawBatchInput(payload);

    if (!batchInput.allowed) {
        return batchInput;
    }

    if (actor.role !== "service") {
        return {
            allowed: false,
            statusCode: 403,
            code: "objective_ingest_service_required",
            message: "Objective raw ingestion requires a service producer identity.",
            auditEvent: {
                event_type: "access_denied",
                actor_id: actor.actorId,
                actor_role: actor.role,
                session_id: batchInput.value.session_id,
                reason: "unsupported_role",
                request_id: trace.requestId,
                trace_id: trace.traceId,
            },
        };
    }

    if (
        batchInput.value.source_type === "prototype_hardware" &&
        !isPrototypeHardwareIngestionEnabled(dependencies)
    ) {
        return {
            allowed: false,
            statusCode: 403,
            code: "objective_prototype_hardware_disabled",
            message:
                "Prototype hardware ingestion is disabled by default and requires an explicit server-side debug flag.",
            auditEvent: {
                event_type: "access_denied",
                actor_id: actor.actorId,
                actor_role: actor.role,
                session_id: batchInput.value.session_id,
                reason: "unsupported_role",
                request_id: trace.requestId,
                trace_id: trace.traceId,
            },
        };
    }

    const accessResult = await requireSessionAccess(
        actor,
        batchInput.value.session_id,
        dependencies,
        trace,
    );

    if (!accessResult.allowed) {
        return accessResult;
    }

    if (accessResult.value.session.status === "stopped") {
        return {
            allowed: false,
            statusCode: 409,
            code: "objective_session_not_active_for_ingest",
            message: "Objective raw ingestion requires an active or paused session.",
            auditEvent: null,
        };
    }

    if (accessResult.value.session.source_type !== batchInput.value.source_type) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_batch_source_mismatch",
            message: "Objective raw batch source_type must match the session source_type.",
            auditEvent: null,
        };
    }

    const result = await buildIngestionResult(
        batchInput.value,
        dependencies.segmentManager ?? defaultSegmentManager,
    );

    await dependencies.rawIngestion.saveIngestionResult(result);
    await auditIngestion(dependencies.auditLogger, actor, result, trace);

    return {
        allowed: true,
        value: result,
        auditEvent: null,
    };
}
