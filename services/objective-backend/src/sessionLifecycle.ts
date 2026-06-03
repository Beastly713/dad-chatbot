import { randomUUID } from "crypto";
import type { ObjectiveAuditLogger } from "./audit.js";
import type { ObjectiveActor, ObjectiveGuardResult } from "./auth.js";
import type {
    ObjectiveAssignmentAccess,
    ObjectiveAssignmentLookup,
} from "./assignments.js";
import { requireAssignedClinician } from "./assignments.js";
import type { ObjectiveTraceContext } from "./trace.js";

export const OBJECTIVE_SESSION_STATUSES = [
    "created",
    "active",
    "paused",
    "stopped",
    "aborted",
] as const;

export type ObjectiveSessionStatus =
    (typeof OBJECTIVE_SESSION_STATUSES)[number];

export const OBJECTIVE_SOURCE_TYPES = [
    "simulator",
    "public_dataset_replay",
    "prototype_hardware",
] as const;

export type ObjectiveSourceType = (typeof OBJECTIVE_SOURCE_TYPES)[number];

export type ObjectiveSessionRecord = {
    session_id: string;
    patient_id: string;
    source_type: ObjectiveSourceType;
    status: ObjectiveSessionStatus;
    device_id?: string;
    device_boot_id?: string;
    created_at: string;
    started_at?: string;
    paused_at?: string;
    stopped_at?: string;
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveCreateSessionInput = {
    patient_id: string;
    source_type: ObjectiveSourceType;
    device_id?: string;
    device_boot_id?: string;
};

export type ObjectiveLifecycleAction = "start" | "pause" | "resume" | "stop";

export type ObjectiveSessionRepository = {
    createSession(
        input: ObjectiveCreateSessionInput,
    ): Promise<ObjectiveSessionRecord>;
    getSession(sessionId: string): Promise<ObjectiveSessionRecord | null>;
    updateSessionStatus(
        sessionId: string,
        status: ObjectiveSessionStatus,
        timestamps: Partial<
            Pick<ObjectiveSessionRecord, "started_at" | "paused_at" | "stopped_at">
        >,
    ): Promise<ObjectiveSessionRecord | null>;
};

export type ObjectiveSessionAccess = {
    actor: ObjectiveActor;
    session: ObjectiveSessionRecord;
    assignment?: ObjectiveAssignmentAccess["assignment"];
};

export type ObjectiveSessionLifecycleDependencies = {
    sessions: ObjectiveSessionRepository;
    assignments: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
};

export class InMemoryObjectiveSessionRepository
    implements ObjectiveSessionRepository
{
    private readonly sessions = new Map<string, ObjectiveSessionRecord>();

    constructor(private readonly now: () => Date = () => new Date()) {}

    async createSession(
        input: ObjectiveCreateSessionInput,
    ): Promise<ObjectiveSessionRecord> {
        const createdAt = this.now().toISOString();

        const session: ObjectiveSessionRecord = {
            session_id: randomUUID(),
            patient_id: input.patient_id,
            source_type: input.source_type,
            status: "created",
            device_id: input.device_id,
            device_boot_id: input.device_boot_id,
            created_at: createdAt,
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        };

        this.sessions.set(session.session_id, session);

        return session;
    }

    async getSession(sessionId: string): Promise<ObjectiveSessionRecord | null> {
        return this.sessions.get(sessionId) ?? null;
    }

    async updateSessionStatus(
        sessionId: string,
        status: ObjectiveSessionStatus,
        timestamps: Partial<
            Pick<ObjectiveSessionRecord, "started_at" | "paused_at" | "stopped_at">
        >,
    ): Promise<ObjectiveSessionRecord | null> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return null;
        }

        const updated: ObjectiveSessionRecord = {
            ...session,
            ...timestamps,
            status,
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        };

        this.sessions.set(sessionId, updated);

        return updated;
    }

    clear(): void {
        this.sessions.clear();
    }
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export function isObjectiveSourceType(
    value: string,
): value is ObjectiveSourceType {
    return OBJECTIVE_SOURCE_TYPES.includes(value as ObjectiveSourceType);
}

export function parseCreateSessionInput(
    value: unknown,
): ObjectiveGuardResult<ObjectiveCreateSessionInput> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_session_payload",
            message: "Objective session payload must be an object.",
            auditEvent: null,
        };
    }

    const record = value as Record<string, unknown>;
    const patientId = record.patient_id;
    const sourceType = record.source_type;

    if (!isNonEmptyString(patientId)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_missing_patient_id",
            message: "Objective session payload requires patient_id.",
            auditEvent: null,
        };
    }

    if (!isNonEmptyString(sourceType) || !isObjectiveSourceType(sourceType)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_source_type",
            message: "Objective session payload has unsupported source_type.",
            auditEvent: null,
        };
    }

    const deviceId = record.device_id;
    const deviceBootId = record.device_boot_id;

    if (deviceId !== undefined && !isNonEmptyString(deviceId)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_device_id",
            message:
                "Objective session payload device_id must be non-empty when provided.",
            auditEvent: null,
        };
    }

    if (deviceBootId !== undefined && !isNonEmptyString(deviceBootId)) {
        return {
            allowed: false,
            statusCode: 400,
            code: "objective_invalid_device_boot_id",
            message:
                "Objective session payload device_boot_id must be non-empty when provided.",
            auditEvent: null,
        };
    }

    return {
        allowed: true,
        value: {
            patient_id: patientId,
            source_type: sourceType,
            device_id: deviceId,
            device_boot_id: deviceBootId,
        },
        auditEvent: null,
    };
}

function invalidTransition(
    current: ObjectiveSessionStatus,
    action: ObjectiveLifecycleAction,
): string {
    return `Cannot ${action} objective session from status ${current}.`;
}

export function nextSessionStatusForAction(
    current: ObjectiveSessionStatus,
    action: ObjectiveLifecycleAction,
): ObjectiveGuardResult<ObjectiveSessionStatus> {
    const allowedTransitions: Record<
        ObjectiveLifecycleAction,
        Partial<Record<ObjectiveSessionStatus, ObjectiveSessionStatus>>
    > = {
        start: {
            created: "active",
            paused: "active",
        },
        pause: {
            active: "paused",
        },
        resume: {
            paused: "active",
        },
        stop: {
            created: "stopped",
            active: "stopped",
            paused: "stopped",
        },
    };

    const nextStatus = allowedTransitions[action][current];

    if (!nextStatus) {
        return {
            allowed: false,
            statusCode: 409,
            code: "objective_invalid_session_transition",
            message: invalidTransition(current, action),
            auditEvent: null,
        };
    }

    return {
        allowed: true,
        value: nextStatus,
        auditEvent: null,
    };
}

async function auditLifecycleEvent(
    auditLogger: ObjectiveAuditLogger | undefined,
    eventType:
        | "session_created"
        | "session_started"
        | "session_paused"
        | "session_resumed"
        | "session_stopped",
    actor: ObjectiveActor,
    session: ObjectiveSessionRecord,
    trace: ObjectiveTraceContext,
): Promise<void> {
    if (!auditLogger) {
        return;
    }

    await auditLogger.record({
        eventType,
        actorId: actor.actorId,
        actorRole: actor.role,
        patientId: session.patient_id,
        sessionId: session.session_id,
        trace,
        metadata: {
            source_type: session.source_type,
            status: session.status,
        },
    });
}

export async function createObjectiveSession(
    actor: ObjectiveActor,
    input: ObjectiveCreateSessionInput,
    dependencies: ObjectiveSessionLifecycleDependencies,
    trace: ObjectiveTraceContext,
): Promise<ObjectiveGuardResult<ObjectiveSessionRecord>> {
    if (actor.role === "service") {
        if (input.source_type !== "simulator") {
            return {
                allowed: false,
                statusCode: 403,
                code: "objective_service_source_denied",
                message: "Service identity may create simulator objective sessions only.",
                auditEvent: {
                    event_type: "access_denied",
                    actor_id: actor.actorId,
                    actor_role: actor.role,
                    patient_id: input.patient_id,
                    reason: "unsupported_role",
                    request_id: trace.requestId,
                    trace_id: trace.traceId,
                },
            };
        }

        const session = await dependencies.sessions.createSession(input);
        await auditLifecycleEvent(
            dependencies.auditLogger,
            "session_created",
            actor,
            session,
            trace,
        );

        return {
            allowed: true,
            value: session,
            auditEvent: null,
        };
    }

    if (actor.role !== "clinician") {
        return {
            allowed: false,
            statusCode: 403,
            code: "objective_clinician_or_service_required",
            message: "Objective session creation requires clinician or service actor.",
            auditEvent: {
                event_type: "access_denied",
                actor_id: actor.actorId,
                actor_role: actor.role,
                patient_id: input.patient_id,
                reason: "unsupported_role",
                request_id: trace.requestId,
                trace_id: trace.traceId,
            },
        };
    }

    const assignmentResult = await requireAssignedClinician(
        actor,
        input.patient_id,
        dependencies.assignments,
        trace,
    );

    if (!assignmentResult.allowed) {
        return assignmentResult;
    }

    const session = await dependencies.sessions.createSession(input);
    await auditLifecycleEvent(
        dependencies.auditLogger,
        "session_created",
        actor,
        session,
        trace,
    );

    return {
        allowed: true,
        value: session,
        auditEvent: null,
    };
}

export async function requireSessionAccess(
    actor: ObjectiveActor,
    sessionId: string,
    dependencies: ObjectiveSessionLifecycleDependencies,
    trace: ObjectiveTraceContext,
): Promise<ObjectiveGuardResult<ObjectiveSessionAccess>> {
    const session = await dependencies.sessions.getSession(sessionId);

    if (!session) {
        return {
            allowed: false,
            statusCode: 404,
            code: "objective_session_not_found",
            message: "Objective session was not found.",
            auditEvent: null,
        };
    }

    if (actor.role === "service") {
        if (session.source_type !== "simulator") {
            return {
                allowed: false,
                statusCode: 403,
                code: "objective_service_session_denied",
                message:
                    "Service identity may access simulator objective sessions only.",
                auditEvent: {
                    event_type: "access_denied",
                    actor_id: actor.actorId,
                    actor_role: actor.role,
                    patient_id: session.patient_id,
                    session_id: session.session_id,
                    reason: "unsupported_role",
                    request_id: trace.requestId,
                    trace_id: trace.traceId,
                },
            };
        }

        return {
            allowed: true,
            value: {
                actor,
                session,
            },
            auditEvent: null,
        };
    }

    const assignmentResult = await requireAssignedClinician(
        actor,
        session.patient_id,
        dependencies.assignments,
        trace,
    );

    if (!assignmentResult.allowed) {
        return assignmentResult;
    }

    return {
        allowed: true,
        value: {
            actor,
            session,
            assignment: assignmentResult.value.assignment,
        },
        auditEvent: null,
    };
}

export async function updateObjectiveSessionLifecycle(
    actor: ObjectiveActor,
    sessionId: string,
    action: ObjectiveLifecycleAction,
    dependencies: ObjectiveSessionLifecycleDependencies,
    trace: ObjectiveTraceContext,
): Promise<ObjectiveGuardResult<ObjectiveSessionRecord>> {
    const accessResult = await requireSessionAccess(
        actor,
        sessionId,
        dependencies,
        trace,
    );

    if (!accessResult.allowed) {
        return accessResult;
    }

    const transitionResult = nextSessionStatusForAction(
        accessResult.value.session.status,
        action,
    );

    if (!transitionResult.allowed) {
        return transitionResult;
    }

    const nowIso = (dependencies.now ?? (() => new Date()))().toISOString();

    const timestamps: Partial<
        Pick<ObjectiveSessionRecord, "started_at" | "paused_at" | "stopped_at">
    > = {};

    if (action === "start" || action === "resume") {
        timestamps.started_at = accessResult.value.session.started_at ?? nowIso;
        timestamps.paused_at = undefined;
    }

    if (action === "pause") {
        timestamps.paused_at = nowIso;
    }

    if (action === "stop") {
        timestamps.stopped_at = nowIso;
    }

    const updated = await dependencies.sessions.updateSessionStatus(
        sessionId,
        transitionResult.value,
        timestamps,
    );

    if (!updated) {
        return {
            allowed: false,
            statusCode: 404,
            code: "objective_session_not_found",
            message: "Objective session was not found.",
            auditEvent: null,
        };
    }

    const eventMap: Record<
        ObjectiveLifecycleAction,
        "session_started" | "session_paused" | "session_resumed" | "session_stopped"
    > = {
        start: "session_started",
        pause: "session_paused",
        resume: "session_resumed",
        stop: "session_stopped",
    };

    await auditLifecycleEvent(
        dependencies.auditLogger,
        eventMap[action],
        actor,
        updated,
        trace,
    );

    return {
        allowed: true,
        value: updated,
        auditEvent: null,
    };
}
