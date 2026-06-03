import { randomUUID } from "crypto";
import type { ObjectiveAuditReadyEvent } from "./auth.js";
import type { ObjectiveTraceContext } from "./trace.js";

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

export type ObjectiveAuditActorRole = "service" | "clinician" | "developer";

export type ObjectiveAuditMetadataValue = string | number | boolean | null;

export type ObjectiveAuditMetadata = Record<string, ObjectiveAuditMetadataValue>;

export type ObjectiveAuditInput = {
    eventType: ObjectiveAuditEventType;
    actorId?: string;
    actorRole: ObjectiveAuditActorRole;
    patientId?: string;
    sessionId?: string;
    assignmentId?: string;
    trace: ObjectiveTraceContext;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
};

export type ObjectiveAuditRecord = {
    audit_event_key: string;
    event_type: ObjectiveAuditEventType;
    actor_id?: string;
    actor_role: ObjectiveAuditActorRole;
    patient_id?: string;
    session_id?: string;
    assignment_id?: string;
    occurred_at: string;
    request_id: string;
    trace_id: string;
    metadata: ObjectiveAuditMetadata;
};

export type ObjectiveAuditSink = {
    write(record: ObjectiveAuditRecord): Promise<void>;
};

const MAX_AUDIT_STRING_LENGTH = 160;

const BLOCKED_METADATA_KEYS = new Set([
    "raw_payload",
    "rawPayload",
    "payload",
    "frame",
    "frames",
    "raw_frame",
    "rawFrame",
    "raw_frames",
    "rawFrames",
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
    "note_text",
    "noteText",
    "summary",
    "summary_text",
    "summaryText",
    "prompt",
    "response",
    "message",
    "messages",
    "finalResponse",
    "draftResponse",
    "userInput",
    "user_input",
]);

function normalizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const NORMALIZED_BLOCKED_METADATA_KEYS = new Set(
    [...BLOCKED_METADATA_KEYS].map(normalizeKey),
);

export class ObjectiveAuditMetadataRejectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ObjectiveAuditMetadataRejectedError";
        Object.setPrototypeOf(this, ObjectiveAuditMetadataRejectedError.prototype);
    }
}

function isAllowedAuditEventType(value: string): value is ObjectiveAuditEventType {
    return OBJECTIVE_AUDIT_EVENT_TYPES.includes(value as ObjectiveAuditEventType);
}

function assertAllowedAuditEventType(value: string): ObjectiveAuditEventType {
    if (!isAllowedAuditEventType(value)) {
        throw new ObjectiveAuditMetadataRejectedError(
            `Unsupported objective audit event type: ${value}`,
        );
    }

    return value;
}

function isBlockedMetadataKey(key: string): boolean {
    return NORMALIZED_BLOCKED_METADATA_KEYS.has(normalizeKey(key));
}

function sanitizeMetadataValue(
    key: string,
    value: unknown,
): ObjectiveAuditMetadataValue {
    if (isBlockedMetadataKey(key)) {
        throw new ObjectiveAuditMetadataRejectedError(
            `Unsafe audit metadata key is not allowed: ${key}`,
        );
    }

    if (value === null) {
        return null;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new ObjectiveAuditMetadataRejectedError(
                `Audit metadata number must be finite: ${key}`,
            );
        }

        return value;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed.length > MAX_AUDIT_STRING_LENGTH) {
            throw new ObjectiveAuditMetadataRejectedError(
                `Audit metadata string is too long for safe logging: ${key}`,
            );
        }

        return trimmed;
    }

    throw new ObjectiveAuditMetadataRejectedError(
        `Audit metadata value must be primitive: ${key}`,
    );
}

export function createSafeObjectiveAuditMetadata(
    metadata: Record<string, unknown> = {},
): ObjectiveAuditMetadata {
    const sanitized: ObjectiveAuditMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
        sanitized[key] = sanitizeMetadataValue(key, value);
    }

    return sanitized;
}

export class InMemoryObjectiveAuditSink implements ObjectiveAuditSink {
    private readonly records: ObjectiveAuditRecord[] = [];

    async write(record: ObjectiveAuditRecord): Promise<void> {
        this.records.push(record);
    }

    getRecords(): ObjectiveAuditRecord[] {
        return [...this.records];
    }

    clear(): void {
        this.records.length = 0;
    }
}

export class ObjectiveAuditLogger {
    constructor(private readonly sink: ObjectiveAuditSink) {}

    async record(input: ObjectiveAuditInput): Promise<ObjectiveAuditRecord> {
        const record: ObjectiveAuditRecord = {
            audit_event_key: randomUUID(),
            event_type: assertAllowedAuditEventType(input.eventType),
            actor_id: input.actorId,
            actor_role: input.actorRole,
            patient_id: input.patientId,
            session_id: input.sessionId,
            assignment_id: input.assignmentId,
            occurred_at: (input.occurredAt ?? new Date()).toISOString(),
            request_id: input.trace.requestId,
            trace_id: input.trace.traceId,
            metadata: createSafeObjectiveAuditMetadata(input.metadata),
        };

        await this.sink.write(record);

        return record;
    }

    async recordAccessDenied(
        auditEvent: ObjectiveAuditReadyEvent,
    ): Promise<ObjectiveAuditRecord> {
        return this.record({
            eventType: "access_denied",
            actorId: auditEvent.actor_id,
            actorRole: normalizeAuditActorRole(auditEvent.actor_role),
            patientId: auditEvent.patient_id,
            sessionId: auditEvent.session_id,
            trace: {
                requestId: auditEvent.request_id,
                traceId: auditEvent.trace_id,
            },
            metadata: {
                reason: auditEvent.reason,
            },
        });
    }
}

export function normalizeAuditActorRole(
    actorRole: string | undefined,
): ObjectiveAuditActorRole {
    if (
        actorRole === "service" ||
        actorRole === "clinician" ||
        actorRole === "developer"
    ) {
        return actorRole;
    }

    return "service";
}

export function createInMemoryObjectiveAuditLogger(): {
    logger: ObjectiveAuditLogger;
    sink: InMemoryObjectiveAuditSink;
} {
    const sink = new InMemoryObjectiveAuditSink();

    return {
        logger: new ObjectiveAuditLogger(sink),
        sink,
    };
}
