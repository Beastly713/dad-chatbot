import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAuditLogger } from "./audit.js";
import {
    requireAssignedClinician,
    type ObjectiveAssignmentLookup,
} from "./assignments.js";
import { parseObjectiveActorFromHeaders } from "./auth.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import type { ObjectiveSessionHistoryRepository } from "./sessionHistory.js";
import {
    buildObjectiveFinalSessionSummary,
    type ObjectiveSessionSummaryRepository,
} from "./sessionSummary.js";
import { createObjectiveTraceContext } from "./trace.js";

export type ObjectiveSessionSummaryRouteDependencies = {
    summary: ObjectiveSessionSummaryRepository;
    assignments: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
};

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

function parseSummaryPath(pathname: string): { sessionId: string } | null {
    const match = /^\/api\/objective\/history\/sessions\/([^/]+)\/summary$/.exec(
        pathname,
    );

    if (!match) {
        return null;
    }

    return {
        sessionId: decodeURIComponent(match[1]),
    };
}

async function recordDeniedAudit(
    dependencies: ObjectiveSessionSummaryRouteDependencies,
    auditEvent:
        | Parameters<ObjectiveAuditLogger["recordAccessDenied"]>[0]
        | null,
): Promise<void> {
    if (!auditEvent || !dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.recordAccessDenied(auditEvent);
}

export function createEmptyObjectiveSessionSummaryRepository(
    history: ObjectiveSessionHistoryRepository,
): ObjectiveSessionSummaryRepository {
    return {
        getSession: history.getSession.bind(history),
        async listFeatureWindowsForSession() {
            return [];
        },
        async listInterpretationsForSession() {
            return [];
        },
        async listMlInferencesForSession() {
            return [];
        },
    };
}

export async function handleObjectiveSessionSummaryRoute(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: ObjectiveSessionSummaryRouteDependencies,
): Promise<boolean> {
    const trace = createObjectiveTraceContext(request.headers);
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);

    response.setHeader("x-request-id", trace.requestId);
    response.setHeader("x-trace-id", trace.traceId);

    const summaryPath = parseSummaryPath(url.pathname);

    if (!summaryPath) {
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

    const session = await dependencies.summary.getSession(summaryPath.sessionId);
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

    const summary = await buildObjectiveFinalSessionSummary(
        dependencies.summary,
        summaryPath.sessionId,
        dependencies.now,
    );

    if (!summary) {
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

    writeJson(response, 200, {
        summary,
    });
    return true;
}
