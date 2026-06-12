import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAuditLogger } from "./audit.js";
import { parseObjectiveActorFromHeaders } from "./auth.js";
import {
    requireAssignedClinician,
    type ObjectiveAssignmentLookup,
} from "./assignments.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import {
    createObjectiveSessionHistoryRepositoryFromSessions,
    listObjectiveSessionHistoryForPatient,
    serializeObjectiveSessionHistoryDetail,
    type ObjectiveSessionHistoryRepository,
} from "./sessionHistory.js";
import type { ObjectiveSessionRepository } from "./sessionLifecycle.js";
import { createObjectiveTraceContext } from "./trace.js";

export type ObjectiveSessionHistoryRouteDependencies = {
    history: ObjectiveSessionHistoryRepository;
    assignments: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
};

export function createDefaultObjectiveSessionHistoryRouteDependencies(
    sessions: ObjectiveSessionRepository,
    assignments: ObjectiveAssignmentLookup,
    auditLogger?: ObjectiveAuditLogger,
): ObjectiveSessionHistoryRouteDependencies {
    return {
        history: createObjectiveSessionHistoryRepositoryFromSessions(sessions),
        assignments,
        auditLogger,
    };
}

function writeJson(
    response: ServerResponse,
    statusCode: number,
    body: Record<string, unknown>,
): void {
    const serialized = JSON.stringify(body);
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("content-length", Buffer.byteLength(serialized));
    response.end(serialized);
}

async function recordDeniedAudit(
    dependencies: ObjectiveSessionHistoryRouteDependencies,
    auditEvent:
        | Parameters<ObjectiveAuditLogger["recordAccessDenied"]>[0]
        | null,
): Promise<void> {
    if (!auditEvent || !dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.recordAccessDenied(auditEvent);
}

function parsePatientSessionsPath(pathname: string): { patientId: string } | null {
    const match = /^\/api\/objective\/history\/patients\/([^/]+)\/sessions$/.exec(
        pathname,
    );

    if (!match) {
        return null;
    }

    return {
        patientId: decodeURIComponent(match[1]),
    };
}

function parseSessionDetailPath(pathname: string): { sessionId: string } | null {
    const match = /^\/api\/objective\/history\/sessions\/([^/]+)$/.exec(pathname);

    if (!match) {
        return null;
    }

    return {
        sessionId: decodeURIComponent(match[1]),
    };
}

export async function handleObjectiveSessionHistoryRoute(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: ObjectiveSessionHistoryRouteDependencies,
): Promise<boolean> {
    const trace = createObjectiveTraceContext(request.headers);
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);

    response.setHeader("x-request-id", trace.requestId);
    response.setHeader("x-trace-id", trace.traceId);

    const patientSessionsPath = parsePatientSessionsPath(url.pathname);
    const sessionDetailPath = parseSessionDetailPath(url.pathname);

    if (!patientSessionsPath && !sessionDetailPath) {
        return false;
    }

    if (request.method !== "GET") {
        writeJson(
            response,
            404,
            createObjectiveSafeErrorBody(
                trace,
                "objective_route_not_found",
                "Objective service route not found.",
            ),
        );
        return true;
    }

    const actorResult = parseObjectiveActorFromHeaders(request.headers, trace);
    if (!actorResult.allowed) {
        await recordDeniedAudit(dependencies, actorResult.auditEvent);
        writeJson(
            response,
            actorResult.statusCode,
            createObjectiveSafeErrorBody(
                trace,
                actorResult.code,
                actorResult.message,
            ),
        );
        return true;
    }

    if (patientSessionsPath) {
        const assignmentResult = await requireAssignedClinician(
            actorResult.value,
            patientSessionsPath.patientId,
            dependencies.assignments,
            trace,
        );

        if (!assignmentResult.allowed) {
            await recordDeniedAudit(dependencies, assignmentResult.auditEvent);
            writeJson(
                response,
                assignmentResult.statusCode,
                createObjectiveSafeErrorBody(
                    trace,
                    assignmentResult.code,
                    assignmentResult.message,
                ),
            );
            return true;
        }

        const sessions = await listObjectiveSessionHistoryForPatient(
            dependencies.history,
            patientSessionsPath.patientId,
            dependencies.now,
        );

        writeJson(response, 200, {
            history: {
                patient_id: patientSessionsPath.patientId,
                sessions,
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            },
        });
        return true;
    }

    if (sessionDetailPath) {
        const session = await dependencies.history.getSession(
            sessionDetailPath.sessionId,
        );

        if (!session) {
            writeJson(
                response,
                404,
                createObjectiveSafeErrorBody(
                    trace,
                    "objective_session_not_found",
                    "Objective session was not found.",
                ),
            );
            return true;
        }

        const assignmentResult = await requireAssignedClinician(
            actorResult.value,
            session.patient_id,
            dependencies.assignments,
            trace,
        );

        if (!assignmentResult.allowed) {
            await recordDeniedAudit(dependencies, assignmentResult.auditEvent);
            writeJson(
                response,
                assignmentResult.statusCode,
                createObjectiveSafeErrorBody(
                    trace,
                    assignmentResult.code,
                    assignmentResult.message,
                ),
            );
            return true;
        }

        writeJson(response, 200, {
            history: {
                session: serializeObjectiveSessionHistoryDetail(
                    session,
                    dependencies.now,
                ),
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            },
        });
        return true;
    }

    return false;
}
