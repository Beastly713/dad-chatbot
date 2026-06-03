import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAuditLogger } from "./audit.js";
import { parseObjectiveActorFromHeaders } from "./auth.js";
import type { ObjectiveAssignmentLookup } from "./assignments.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    parseCreateSessionInput,
    requireSessionAccess,
    updateObjectiveSessionLifecycle,
    type ObjectiveLifecycleAction,
    type ObjectiveSessionLifecycleDependencies,
    type ObjectiveSessionRecord,
    type ObjectiveSessionRepository,
} from "./sessionLifecycle.js";
import { createObjectiveTraceContext } from "./trace.js";

export type ObjectiveSessionRouteDependencies = {
    sessions: ObjectiveSessionRepository;
    assignments: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
};

export function createDefaultObjectiveSessionRouteDependencies(): ObjectiveSessionRouteDependencies {
    return {
        sessions: new InMemoryObjectiveSessionRepository(),
        assignments: {
            async findActiveAssignment() {
                return null;
            },
        },
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

function sessionResponse(
    session: ObjectiveSessionRecord,
): Record<string, unknown> {
    return {
        session: {
            session_id: session.session_id,
            patient_id: session.patient_id,
            source_type: session.source_type,
            status: session.status,
            device_id: session.device_id,
            device_boot_id: session.device_boot_id,
            created_at: session.created_at,
            started_at: session.started_at,
            paused_at: session.paused_at,
            stopped_at: session.stopped_at,
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
    };
}

function readRequestBody(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        request.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });

        request.on("end", () => {
            if (chunks.length === 0) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
            } catch (error) {
                reject(error);
            }
        });

        request.on("error", reject);
    });
}

function isSessionRootPath(pathname: string): boolean {
    return pathname === "/api/objective/sessions";
}

function parseSessionActionPath(
    pathname: string,
): { sessionId: string; action: ObjectiveLifecycleAction | "status" } | null {
    const match = /^\/api\/objective\/sessions\/([^/]+)\/([^/]+)$/.exec(pathname);

    if (!match) {
        return null;
    }

    const [, sessionId, action] = match;

    if (
        action !== "start" &&
        action !== "pause" &&
        action !== "resume" &&
        action !== "stop" &&
        action !== "status"
    ) {
        return null;
    }

    return {
        sessionId: decodeURIComponent(sessionId),
        action,
    };
}

function lifecycleDependencies(
    dependencies: ObjectiveSessionRouteDependencies,
): ObjectiveSessionLifecycleDependencies {
    return {
        sessions: dependencies.sessions,
        assignments: dependencies.assignments,
        auditLogger: dependencies.auditLogger,
        now: dependencies.now,
    };
}

async function recordDeniedAudit(
    dependencies: ObjectiveSessionRouteDependencies,
    auditEvent: Parameters<ObjectiveAuditLogger["recordAccessDenied"]>[0] | null,
): Promise<void> {
    if (!auditEvent || !dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.recordAccessDenied(auditEvent);
}

export async function handleObjectiveSessionRoute(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: ObjectiveSessionRouteDependencies,
): Promise<boolean> {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const trace = createObjectiveTraceContext(request.headers);

    response.setHeader("x-request-id", trace.requestId);
    response.setHeader("x-trace-id", trace.traceId);

    const isSessionRoot = isSessionRootPath(url.pathname);
    const actionPath = parseSessionActionPath(url.pathname);

    if (!isSessionRoot && !actionPath) {
        return false;
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

    if (request.method === "POST" && isSessionRoot) {
        let body: unknown;

        try {
            body = await readRequestBody(request);
        } catch {
            writeJson(
                response,
                400,
                createObjectiveSafeErrorBody(
                    trace,
                    "objective_invalid_json",
                    "Objective request body must be valid JSON.",
                ),
            );
            return true;
        }

        const inputResult = parseCreateSessionInput(body);

        if (!inputResult.allowed) {
            writeJson(
                response,
                inputResult.statusCode,
                createObjectiveSafeErrorBody(
                    trace,
                    inputResult.code,
                    inputResult.message,
                ),
            );
            return true;
        }

        const createResult = await createObjectiveSession(
            actorResult.value,
            inputResult.value,
            lifecycleDependencies(dependencies),
            trace,
        );

        if (!createResult.allowed) {
            await recordDeniedAudit(dependencies, createResult.auditEvent);
            writeJson(
                response,
                createResult.statusCode,
                createObjectiveSafeErrorBody(
                    trace,
                    createResult.code,
                    createResult.message,
                ),
            );
            return true;
        }

        writeJson(response, 201, sessionResponse(createResult.value));
        return true;
    }

    if (!actionPath) {
        return false;
    }

    if (actionPath.action === "status") {
        if (request.method !== "GET") {
            writeJson(
                response,
                405,
                createObjectiveSafeErrorBody(
                    trace,
                    "objective_method_not_allowed",
                    "Objective session status requires GET.",
                ),
            );
            return true;
        }

        const accessResult = await requireSessionAccess(
            actorResult.value,
            actionPath.sessionId,
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

        writeJson(response, 200, sessionResponse(accessResult.value.session));
        return true;
    }

    if (request.method !== "POST") {
        writeJson(
            response,
            405,
            createObjectiveSafeErrorBody(
                trace,
                "objective_method_not_allowed",
                "Objective session lifecycle action requires POST.",
            ),
        );
        return true;
    }

    const updateResult = await updateObjectiveSessionLifecycle(
        actorResult.value,
        actionPath.sessionId,
        actionPath.action,
        lifecycleDependencies(dependencies),
        trace,
    );

    if (!updateResult.allowed) {
        await recordDeniedAudit(dependencies, updateResult.auditEvent);
        writeJson(
            response,
            updateResult.statusCode,
            createObjectiveSafeErrorBody(
                trace,
                updateResult.code,
                updateResult.message,
            ),
        );
        return true;
    }

    writeJson(response, 200, sessionResponse(updateResult.value));
    return true;
}
