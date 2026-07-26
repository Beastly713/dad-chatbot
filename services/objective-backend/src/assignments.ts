import type {
    ObjectiveActor,
    ObjectiveAuditReadyEvent,
    ObjectiveGuardResult,
} from "./auth.js";
import type { ObjectiveTraceContext } from "./trace.js";

export type ObjectiveClinicianAssignment = {
    assignmentId: string;
    clinicianId: string;
    patientId: string;
    status: "active" | "revoked";
};

export type ObjectiveAssignmentLookup = {
    findActiveAssignment(
        clinicianId: string,
        patientId: string,
    ): Promise<ObjectiveClinicianAssignment | null>;
};

export type ObjectiveAssignmentAccess = {
    actor: ObjectiveActor;
    assignment: ObjectiveClinicianAssignment;
    patientId: string;
};

function createAssignmentDeniedAuditEvent(
    actor: ObjectiveActor,
    patientId: string,
    trace: ObjectiveTraceContext,
): ObjectiveAuditReadyEvent {
    return {
        event_type: "access_denied",
        actor_id: actor.actorId,
        actor_role: actor.role,
        patient_id: patientId,
        reason: "unassigned_clinician",
        request_id: trace.requestId,
        trace_id: trace.traceId,
    };
}

export async function requireAssignedClinician(
    actor: ObjectiveActor,
    patientId: string,
    lookup: ObjectiveAssignmentLookup,
    trace: ObjectiveTraceContext,
): Promise<ObjectiveGuardResult<ObjectiveAssignmentAccess>> {
    if (actor.role !== "clinician") {
        return {
            allowed: false,
            statusCode: 403,
            code: "objective_clinician_required",
            message: "Objective patient-scoped access requires a clinician actor.",
            auditEvent: {
                event_type: "access_denied",
                actor_id: actor.actorId,
                actor_role: actor.role,
                patient_id: patientId,
                reason: "unsupported_role",
                request_id: trace.requestId,
                trace_id: trace.traceId,
            },
        };
    }

    const assignment = await lookup.findActiveAssignment(actor.actorId, patientId);

    if (!assignment || assignment.status !== "active") {
        return {
            allowed: false,
            statusCode: 403,
            code: "objective_assignment_required",
            message: "Objective patient-scoped access requires an active assignment.",
            auditEvent: createAssignmentDeniedAuditEvent(actor, patientId, trace),
        };
    }

    return {
        allowed: true,
        value: {
            actor,
            assignment,
            patientId,
        },
        auditEvent: null,
    };
}
