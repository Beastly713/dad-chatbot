import { createHash } from "crypto";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import type { ObjectiveAuditLogger } from "./audit.js";
import type { ObjectiveAssignmentLookup } from "./assignments.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import {
    createObjectiveHeartbeatStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
    type ObjectiveClinicianStreamEvent,
    type ObjectiveClinicianStreamSubscriber,
    type ObjectiveStreamReplayMode,
} from "./streamEvents.js";
import {
    validateObjectiveStreamToken,
    type ObjectiveStreamTokenPayload,
} from "./streamTokens.js";
import {
    createObjectiveTraceContext,
    type ObjectiveTraceContext,
} from "./trace.js";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export const DEFAULT_OBJECTIVE_STREAM_ASSIGNMENT_RECHECK_MS = 30_000;

export type ObjectiveWebSocketSocket = Duplex & {
    write(chunk: string | Buffer): boolean;
    end(chunk?: string | Buffer): void;
    destroy(error?: Error): void;
};

export type ObjectiveStreamRouteDependencies = {
    streamTokenSecret: string;
    streamHub: InMemoryObjectiveClinicianStreamHub;
    assignmentLookup: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveAuditLogger;
    assignmentRecheckIntervalMs?: number;
};

export function createDefaultObjectiveStreamRouteDependencies(
    assignmentLookup: ObjectiveAssignmentLookup = {
        async findActiveAssignment() {
            return null;
        },
    },
): ObjectiveStreamRouteDependencies {
    return {
        streamTokenSecret: process.env.OBJECTIVE_STREAM_TOKEN_SECRET ?? "",
        streamHub: new InMemoryObjectiveClinicianStreamHub(),
        assignmentLookup,
    };
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

function readHeader(request: IncomingMessage, name: string): string | null {
    const value = firstHeaderValue(request.headers[name.toLowerCase()]);
    const trimmed = value?.trim();

    return trimmed && trimmed.length > 0 ? trimmed : null;
}

function parseStreamPath(pathname: string): { sessionId: string } | null {
    const match = /^\/api\/objective\/sessions\/([^/]+)\/stream$/.exec(pathname);

    if (!match) {
        return null;
    }

    return {
        sessionId: decodeURIComponent(match[1]),
    };
}

function parseRequestUrl(request: IncomingMessage): URL {
    const host = request.headers.host ?? "localhost";

    return new URL(request.url ?? "/", `http://${host}`);
}

function statusText(statusCode: number): string {
    switch (statusCode) {
        case 400:
            return "Bad Request";
        case 401:
            return "Unauthorized";
        case 403:
            return "Forbidden";
        case 404:
            return "Not Found";
        case 426:
            return "Upgrade Required";
        case 500:
            return "Internal Server Error";
        default:
            return "Error";
    }
}

function writeUpgradeError(
    socket: ObjectiveWebSocketSocket,
    statusCode: number,
    trace: ObjectiveTraceContext,
    code: string,
    message: string,
): void {
    const body = JSON.stringify(createObjectiveSafeErrorBody(trace, code, message));

    socket.write(
        [
            `HTTP/1.1 ${statusCode} ${statusText(statusCode)}`,
            "content-type: application/json; charset=utf-8",
            `content-length: ${Buffer.byteLength(body)}`,
            "connection: close",
            "",
            body,
        ].join("\r\n"),
    );
    socket.end();
}

function isWebSocketUpgrade(request: IncomingMessage): boolean {
    const upgrade = readHeader(request, "upgrade")?.toLowerCase() ?? null;
    const connection = readHeader(request, "connection")?.toLowerCase() ?? null;
    const key = readHeader(request, "sec-websocket-key");

    return (
        request.method === "GET" &&
        upgrade === "websocket" &&
        connection !== null &&
        connection.includes("upgrade") &&
        key !== null
    );
}

function createWebSocketAcceptKey(secWebSocketKey: string): string {
    return createHash("sha1")
        .update(`${secWebSocketKey}${WEBSOCKET_GUID}`)
        .digest("base64");
}

function writeWebSocketHandshake(
    request: IncomingMessage,
    socket: ObjectiveWebSocketSocket,
): void {
    const key = readHeader(request, "sec-websocket-key");

    if (!key) {
        throw new Error("Missing sec-websocket-key");
    }

    socket.write(
        [
            "HTTP/1.1 101 Switching Protocols",
            "upgrade: websocket",
            "connection: Upgrade",
            `sec-websocket-accept: ${createWebSocketAcceptKey(key)}`,
            "",
            "",
        ].join("\r\n"),
    );
}

function encodeWebSocketTextFrame(text: string): Buffer {
    const payload = Buffer.from(text, "utf8");
    const length = payload.length;

    if (length < 126) {
        return Buffer.concat([Buffer.from([0x81, length]), payload]);
    }

    if (length <= 0xffff) {
        const header = Buffer.allocUnsafe(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(length, 2);

        return Buffer.concat([header, payload]);
    }

    const header = Buffer.allocUnsafe(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);

    return Buffer.concat([header, payload]);
}

function sendWebSocketEvent(
    socket: ObjectiveWebSocketSocket,
    event: ObjectiveClinicianStreamEvent,
): void {
    socket.write(encodeWebSocketTextFrame(JSON.stringify(event)));
}

function readTokenFromRequest(url: URL, request: IncomingMessage): string | null {
    const queryToken = url.searchParams.get("token");

    if (queryToken && queryToken.trim().length > 0) {
        return queryToken.trim();
    }

    const protocol = readHeader(request, "sec-websocket-protocol");

    if (!protocol) {
        return null;
    }

    const parts = protocol
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    return (
        parts.find((part) => part.startsWith("objective-stream-token.")) ?? null
    );
}

function roleHeaderIsExplicitlyDenied(request: IncomingMessage): boolean {
    const role = readHeader(request, "x-objective-role");

    return role === "patient" || role === "chatbot";
}

function readReplayMode(url: URL): ObjectiveStreamReplayMode | null {
    const replay = url.searchParams.get("replay");

    if (replay === null || replay.trim() === "" || replay === "none") {
        return "none";
    }

    if (replay === "latest") {
        return "latest";
    }

    return null;
}

async function hasActiveMatchingAssignment(
    dependencies: ObjectiveStreamRouteDependencies,
    payload: ObjectiveStreamTokenPayload,
): Promise<boolean> {
    const assignment = await dependencies.assignmentLookup.findActiveAssignment(
        payload.clinician_id,
        payload.patient_id,
    );

    return (
        assignment !== null &&
        assignment.status === "active" &&
        assignment.assignmentId === payload.assignment_id
    );
}

function startAssignmentRecheckLoop(
    dependencies: ObjectiveStreamRouteDependencies,
): () => void {
    const intervalMs =
        dependencies.assignmentRecheckIntervalMs ??
        DEFAULT_OBJECTIVE_STREAM_ASSIGNMENT_RECHECK_MS;

    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
        return () => undefined;
    }

    const interval = setInterval(() => {
        void dependencies.streamHub.recheckSubscriptions();
    }, intervalMs);

    interval.unref?.();

    return () => {
        clearInterval(interval);
    };
}

async function auditStreamDenied(
    dependencies: ObjectiveStreamRouteDependencies,
    trace: ObjectiveTraceContext,
    sessionId: string | undefined,
    reason: string,
): Promise<void> {
    if (!dependencies.auditLogger) {
        return;
    }

    await dependencies.auditLogger.record({
        eventType: "stream_denied",
        actorRole: "service",
        sessionId,
        trace,
        metadata: {
            reason,
        },
    });
}

function createSubscriber(
    socket: ObjectiveWebSocketSocket,
    payload: ObjectiveStreamTokenPayload,
    dependencies: ObjectiveStreamRouteDependencies,
    trace: ObjectiveTraceContext,
): ObjectiveClinicianStreamSubscriber {
    const allowedScopes = new Set(payload.allowed_event_scopes);

    return {
        allowedScopes,
        send(event: ObjectiveClinicianStreamEvent) {
            sendWebSocketEvent(socket, event);
        },
        close(event: ObjectiveClinicianStreamEvent) {
            sendWebSocketEvent(socket, event);
            socket.end();
        },
        async isAuthorized() {
            return hasActiveMatchingAssignment(dependencies, payload);
        },
        async onAuthorizationRevoked() {
            await auditStreamDenied(
                dependencies,
                trace,
                payload.session_id,
                "assignment_revoked_after_connect",
            );
        },
    };
}

export async function handleObjectiveStreamUpgrade(
    request: IncomingMessage,
    socket: ObjectiveWebSocketSocket,
    _head: Buffer,
    dependencies: ObjectiveStreamRouteDependencies,
): Promise<boolean> {
    const trace = createObjectiveTraceContext(request.headers);
    const url = parseRequestUrl(request);
    const parsedPath = parseStreamPath(url.pathname);

    if (!parsedPath) {
        return false;
    }

    const replayMode = readReplayMode(url);

    if (replayMode === null) {
        writeUpgradeError(
            socket,
            400,
            trace,
            "objective_stream_invalid_replay_mode",
            "Objective stream replay mode must be none or latest.",
        );
        return true;
    }

    if (roleHeaderIsExplicitlyDenied(request)) {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            "patient_or_chatbot_role_denied",
        );
        writeUpgradeError(
            socket,
            403,
            trace,
            "objective_stream_role_denied",
            "Objective streaming is available only to assigned clinicians.",
        );
        return true;
    }

    if (!isWebSocketUpgrade(request)) {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            "invalid_websocket_upgrade",
        );
        writeUpgradeError(
            socket,
            426,
            trace,
            "objective_stream_upgrade_required",
            "Objective stream requires a WebSocket upgrade request.",
        );
        return true;
    }

    const token = readTokenFromRequest(url, request);

    if (!token) {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            "missing_stream_token",
        );
        writeUpgradeError(
            socket,
            401,
            trace,
            "objective_stream_token_required",
            "Objective stream token is required.",
        );
        return true;
    }

    let validation;

    try {
        validation = validateObjectiveStreamToken({
            token,
            secret: dependencies.streamTokenSecret,
            expected: {
                sessionId: parsedPath.sessionId,
            },
        });
    } catch {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            "stream_token_validation_error",
        );
        writeUpgradeError(
            socket,
            401,
            trace,
            "objective_stream_token_invalid",
            "Objective stream token is malformed or invalid.",
        );
        return true;
    }

    if (!validation.valid) {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            validation.code,
        );
        writeUpgradeError(
            socket,
            validation.statusCode,
            trace,
            validation.code,
            validation.message,
        );
        return true;
    }

    const assignmentStillActive = await hasActiveMatchingAssignment(
        dependencies,
        validation.payload,
    );

    if (!assignmentStillActive) {
        await auditStreamDenied(
            dependencies,
            trace,
            parsedPath.sessionId,
            "inactive_or_revoked_assignment",
        );
        writeUpgradeError(
            socket,
            403,
            trace,
            "objective_stream_assignment_inactive",
            "Objective stream requires an active clinician assignment.",
        );
        return true;
    }

    writeWebSocketHandshake(request, socket);

    const subscriber = createSubscriber(
        socket,
        validation.payload,
        dependencies,
        trace,
    );
    const unsubscribe = dependencies.streamHub.subscribe(
        parsedPath.sessionId,
        subscriber,
    );
    const stopAssignmentRecheck = startAssignmentRecheckLoop(dependencies);

    const cleanup = () => {
        unsubscribe();
        stopAssignmentRecheck();
    };

    socket.on("close", cleanup);
    socket.on("end", cleanup);
    socket.on("error", cleanup);

    sendWebSocketEvent(
        socket,
        createObjectiveHeartbeatStreamEvent(parsedPath.sessionId),
    );

    if (replayMode === "latest") {
        dependencies.streamHub.replayLatest(parsedPath.sessionId, subscriber);
    }

    return true;
}
