import type { IncomingHttpHeaders } from "http";
import type { ObjectiveTraceContext } from "./trace.js";

export const OBJECTIVE_AUTHORIZED_ROLES = [
    "clinician",
    "service",
    "developer",
] as const;

export type ObjectiveAuthorizedRole =
    (typeof OBJECTIVE_AUTHORIZED_ROLES)[number];

export const OBJECTIVE_DENIED_ROLES = ["patient", "chatbot"] as const;

export type ObjectiveDeniedRole = (typeof OBJECTIVE_DENIED_ROLES)[number];

export type ObjectiveKnownRole = ObjectiveAuthorizedRole | ObjectiveDeniedRole;

export type ObjectiveActor = {
    actorId: string;
    role: ObjectiveAuthorizedRole;
};

export type ObjectiveAuthFailureReason =
    | "missing_auth"
    | "unsupported_role"
    | "patient_denied"
    | "chatbot_denied"
    | "missing_actor_id";

export type ObjectiveAuditReadyEvent = {
    event_type: "access_denied";
    actor_id?: string;
    actor_role?: string;
    patient_id?: string;
    session_id?: string;
    reason: ObjectiveAuthFailureReason | "unassigned_clinician";
    request_id: string;
    trace_id: string;
};

export type ObjectiveGuardResult<T> =
    | {
          allowed: true;
          value: T;
          auditEvent: null;
      }
    | {
          allowed: false;
          statusCode: 400 | 401 | 403 | 404 | 409;
          code: string;
          message: string;
          auditEvent: ObjectiveAuditReadyEvent | null;
      };

function firstHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

function cleanHeaderValue(value: string | null): string | null {
    if (value === null) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function readHeader(headers: IncomingHttpHeaders, name: string): string | null {
    return cleanHeaderValue(firstHeaderValue(headers[name.toLowerCase()]));
}

function isAuthorizedRole(value: string): value is ObjectiveAuthorizedRole {
    return OBJECTIVE_AUTHORIZED_ROLES.includes(value as ObjectiveAuthorizedRole);
}

function isDeniedRole(value: string): value is ObjectiveDeniedRole {
    return OBJECTIVE_DENIED_ROLES.includes(value as ObjectiveDeniedRole);
}

function createDeniedAuditEvent(
    trace: ObjectiveTraceContext,
    reason: ObjectiveAuthFailureReason,
    actorId?: string,
    actorRole?: string,
): ObjectiveAuditReadyEvent {
    return {
        event_type: "access_denied",
        actor_id: actorId,
        actor_role: actorRole,
        reason,
        request_id: trace.requestId,
        trace_id: trace.traceId,
    };
}

function denyAuth(
    trace: ObjectiveTraceContext,
    statusCode: 401 | 403,
    code: string,
    message: string,
    reason: ObjectiveAuthFailureReason,
    actorId?: string,
    actorRole?: string,
): ObjectiveGuardResult<ObjectiveActor> {
    return {
        allowed: false,
        statusCode,
        code,
        message,
        auditEvent: createDeniedAuditEvent(trace, reason, actorId, actorRole),
    };
}

export function parseObjectiveActorFromHeaders(
    headers: IncomingHttpHeaders,
    trace: ObjectiveTraceContext,
): ObjectiveGuardResult<ObjectiveActor> {
    const actorId = readHeader(headers, "x-objective-actor-id");
    const role = readHeader(headers, "x-objective-role");

    if (!role) {
        return denyAuth(
            trace,
            401,
            "objective_missing_auth",
            "Objective request requires authenticated objective access.",
            "missing_auth",
            actorId ?? undefined,
        );
    }

    if (isDeniedRole(role)) {
        const reason = role === "patient" ? "patient_denied" : "chatbot_denied";

        return denyAuth(
            trace,
            403,
            `objective_${role}_denied`,
            "This objective service is not available to this actor role.",
            reason,
            actorId ?? undefined,
            role,
        );
    }

    if (!isAuthorizedRole(role)) {
        return denyAuth(
            trace,
            403,
            "objective_unsupported_role",
            "Objective request role is not allowed.",
            "unsupported_role",
            actorId ?? undefined,
            role,
        );
    }

    if (!actorId) {
        return denyAuth(
            trace,
            401,
            "objective_missing_actor_id",
            "Objective request requires an actor identifier.",
            "missing_actor_id",
            undefined,
            role,
        );
    }

    return {
        allowed: true,
        value: {
            actorId,
            role,
        },
        auditEvent: null,
    };
}

export function requireObjectiveRole(
    actor: ObjectiveActor,
    allowedRoles: readonly ObjectiveAuthorizedRole[],
    trace: ObjectiveTraceContext,
): ObjectiveGuardResult<ObjectiveActor> {
    if (allowedRoles.includes(actor.role)) {
        return {
            allowed: true,
            value: actor,
            auditEvent: null,
        };
    }

    return {
        allowed: false,
        statusCode: 403,
        code: "objective_role_denied",
        message: "Objective request role is not allowed for this operation.",
        auditEvent: {
            event_type: "access_denied",
            actor_id: actor.actorId,
            actor_role: actor.role,
            reason: "unsupported_role",
            request_id: trace.requestId,
            trace_id: trace.traceId,
        },
    };
}

export function requireClinicianActor(
    actor: ObjectiveActor,
    trace: ObjectiveTraceContext,
): ObjectiveGuardResult<ObjectiveActor> {
    return requireObjectiveRole(actor, ["clinician"], trace);
}

export function requireServiceActor(
    actor: ObjectiveActor,
    trace: ObjectiveTraceContext,
): ObjectiveGuardResult<ObjectiveActor> {
    return requireObjectiveRole(actor, ["service"], trace);
}

export function requireDeveloperActor(
    actor: ObjectiveActor,
    trace: ObjectiveTraceContext,
): ObjectiveGuardResult<ObjectiveActor> {
    return requireObjectiveRole(actor, ["developer"], trace);
}
