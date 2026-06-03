import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAuditLogger } from "./audit.js";
import { parseObjectiveActorFromHeaders } from "./auth.js";
import type { ObjectiveAssignmentLookup } from "./assignments.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import type { ObjectiveRawStorageRepository } from "./rawStorage.js";
import {
    requireSessionAccess,
    type ObjectiveSessionLifecycleDependencies,
    type ObjectiveSessionRepository,
} from "./sessionLifecycle.js";
import { createObjectiveTraceContext } from "./trace.js";

export type ObjectiveRawTraceabilityRouteDependencies = {
    sessions: ObjectiveSessionRepository;
    assignments: ObjectiveAssignmentLookup;
    rawIngestion: ObjectiveRawStorageRepository;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
};

type QuarantineSummary = {
    total_quarantined_frames: number;
    by_reject_reason: Record<string, number>;
    by_payload_shape: Record<string, number>;
    visibility: {
        clinician_visible: true;
        patient_visible: false;
        chatbot_visible: false;
    };
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

function parseRawTraceabilityPath(
    pathname: string,
): { sessionId: string; view: "traceability" | "quarantine-summary" } | null {
    const match =
        /^\/api\/objective\/sessions\/([^/]+)\/raw\/([^/]+)$/.exec(pathname);

    if (!match) {
        return null;
    }

    const [, sessionId, view] = match;

    if (view !== "traceability" && view !== "quarantine-summary") {
        return null;
    }

    return {
        sessionId: decodeURIComponent(sessionId),
        view,
    };
}

async function recordDeniedAudit(
    dependencies: ObjectiveRawTraceabilityRouteDependencies,
    auditEvent: Parameters<ObjectiveAuditLogger["recordAccessDenied"]>[0] | null,
): Promise<void> {
    if (!auditEvent || !dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.recordAccessDenied(auditEvent);
}

function lifecycleDependencies(
    dependencies: ObjectiveRawTraceabilityRouteDependencies,
): ObjectiveSessionLifecycleDependencies {
    return {
        sessions: dependencies.sessions,
        assignments: dependencies.assignments,
        auditLogger: dependencies.auditLogger,
        now: dependencies.now,
    };
}

function summarizeQuarantinedFrames(
    quarantinedFrames: Awaited<
        ReturnType<ObjectiveRawStorageRepository["listQuarantinedFramesForSession"]>
    >,
): QuarantineSummary {
    const byRejectReason: Record<string, number> = {};
    const byPayloadShape: Record<string, number> = {};

    for (const frame of quarantinedFrames) {
        byRejectReason[frame.reject_reason] =
            (byRejectReason[frame.reject_reason] ?? 0) + 1;
        byPayloadShape[frame.raw_payload_shape] =
            (byPayloadShape[frame.raw_payload_shape] ?? 0) + 1;
    }

    return {
        total_quarantined_frames: quarantinedFrames.length,
        by_reject_reason: byRejectReason,
        by_payload_shape: byPayloadShape,
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
    };
}

export async function handleObjectiveRawTraceabilityRoute(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: ObjectiveRawTraceabilityRouteDependencies,
): Promise<boolean> {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const route = parseRawTraceabilityPath(url.pathname);

    if (!route) {
        return false;
    }

    const trace = createObjectiveTraceContext(request.headers);

    response.setHeader("x-request-id", trace.requestId);
    response.setHeader("x-trace-id", trace.traceId);

    if (request.method !== "GET") {
        writeJson(
            response,
            405,
            createObjectiveSafeErrorBody(
                trace,
                "objective_method_not_allowed",
                "Objective raw traceability routes require GET.",
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
            createObjectiveSafeErrorBody(trace, actorResult.code, actorResult.message),
        );
        return true;
    }

    const accessResult = await requireSessionAccess(
        actorResult.value,
        route.sessionId,
        lifecycleDependencies(dependencies),
        trace,
    );

    if (!accessResult.allowed) {
        await recordDeniedAudit(dependencies, accessResult.auditEvent);
        writeJson(
            response,
            accessResult.statusCode,
            createObjectiveSafeErrorBody(
                trace,
                accessResult.code,
                accessResult.message,
            ),
        );
        return true;
    }

    if (route.view === "traceability") {
        const traceability =
            await dependencies.rawIngestion.listClinicianSafeChunkTraceability(
                route.sessionId,
            );

        writeJson(response, 200, {
            raw_traceability: {
                session_id: route.sessionId,
                chunk_count: traceability.length,
                chunks: traceability,
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            },
        });
        return true;
    }

    const quarantined =
        await dependencies.rawIngestion.listQuarantinedFramesForSession(
            route.sessionId,
        );

    writeJson(response, 200, {
        quarantine_summary: {
            session_id: route.sessionId,
            ...summarizeQuarantinedFrames(quarantined),
        },
    });

    return true;
}
