import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAuditLogger } from "./audit.js";
import { parseObjectiveActorFromHeaders } from "./auth.js";
import type { ObjectiveAssignmentLookup } from "./assignments.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import {
    ingestObjectiveRawBatch,
    type ObjectiveRawIngestionDependencies,
} from "./rawIngestion.js";
import {
    InMemoryObjectiveRawStorageRepository,
    type ObjectiveRawStorageRepository,
} from "./rawStorage.js";
import {
    InMemoryObjectiveSegmentManager,
    type ObjectiveSegmentManager,
} from "./segmentManager.js";
import type { ObjectiveSessionRepository } from "./sessionLifecycle.js";
import { createObjectiveTraceContext } from "./trace.js";

export type ObjectiveRawIngestionRouteDependencies = {
    sessions: ObjectiveSessionRepository;
    assignments: ObjectiveAssignmentLookup;
    rawIngestion: ObjectiveRawStorageRepository;
    segmentManager?: ObjectiveSegmentManager;
    auditLogger?: ObjectiveAuditLogger;
    now?: () => Date;
    prototypeHardwareIngestionEnabled?: boolean;
};

const defaultSegmentManager = new InMemoryObjectiveSegmentManager();

export function createDefaultObjectiveRawIngestionRepository(): ObjectiveRawStorageRepository {
    return new InMemoryObjectiveRawStorageRepository();
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

type ParsedIngestPath =
    | {
          mode: "canonical";
          sessionIdFromPath: null;
      }
    | {
          mode: "session_alias";
          sessionIdFromPath: string;
      };

function parseIngestPath(pathname: string): ParsedIngestPath | null {
    if (pathname === "/api/objective/ingest/batch") {
        return {
            mode: "canonical",
            sessionIdFromPath: null,
        };
    }

    const match = /^\/api\/objective\/sessions\/([^/]+)\/ingest$/.exec(pathname);

    if (!match) {
        return null;
    }

    return {
        mode: "session_alias",
        sessionIdFromPath: decodeURIComponent(match[1]),
    };
}

async function recordDeniedAudit(
    dependencies: ObjectiveRawIngestionRouteDependencies,
    auditEvent: Parameters<ObjectiveAuditLogger["recordAccessDenied"]>[0] | null,
): Promise<void> {
    if (!auditEvent || !dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.recordAccessDenied(auditEvent);
}

function lifecycleDependencies(
    dependencies: ObjectiveRawIngestionRouteDependencies,
): ObjectiveRawIngestionDependencies {
    return {
        sessions: dependencies.sessions,
        assignments: dependencies.assignments,
        rawIngestion: dependencies.rawIngestion,
        segmentManager: dependencies.segmentManager ?? defaultSegmentManager,
        auditLogger: dependencies.auditLogger,
        now: dependencies.now,
        prototypeHardwareIngestionEnabled:
            dependencies.prototypeHardwareIngestionEnabled,
    };
}

export async function handleObjectiveRawIngestionRoute(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: ObjectiveRawIngestionRouteDependencies,
): Promise<boolean> {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const ingestPath = parseIngestPath(url.pathname);

    if (!ingestPath) {
        return false;
    }

    const trace = createObjectiveTraceContext(request.headers);

    response.setHeader("x-request-id", trace.requestId);
    response.setHeader("x-trace-id", trace.traceId);

    if (request.method !== "POST") {
        writeJson(
            response,
            405,
            createObjectiveSafeErrorBody(
                trace,
                "objective_method_not_allowed",
                "Objective raw ingestion requires POST.",
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

    const payload =
        typeof body === "object" && body !== null && !Array.isArray(body)
            ? {
                  ...body,
                  session_id:
                      (body as Record<string, unknown>).session_id ??
                      ingestPath.sessionIdFromPath,
              }
            : body;

    const result = await ingestObjectiveRawBatch(
        actorResult.value,
        payload,
        lifecycleDependencies(dependencies),
        trace,
    );

    if (!result.allowed) {
        await recordDeniedAudit(dependencies, result.auditEvent);
        writeJson(
            response,
            result.statusCode,
            createObjectiveSafeErrorBody(trace, result.code, result.message),
        );
        return true;
    }

    writeJson(response, 202, {
        ingestion: {
            batch_id: result.value.batch_id,
            session_id: result.value.session_id,
            accepted_frame_count: result.value.accepted_frame_count,
            quarantined_frame_count: result.value.quarantined_frame_count,
            chunk_count: result.value.chunks.length,
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
    });

    return true;
}
