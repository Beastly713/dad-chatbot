import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
    requireAssignedClinician,
    type ObjectiveAssignmentLookup,
} from "./assignments.js";
import type { ObjectiveActor, ObjectiveGuardResult } from "./auth.js";
import type { ObjectiveAuditLogger, ObjectiveAuditMetadata } from "./audit.js";
import type { ObjectiveTraceContext } from "./trace.js";

export const OBJECTIVE_STREAM_TOKEN_TYPE = "objective_stream" as const;
export const OBJECTIVE_STREAM_TOKEN_VERSION = 1 as const;

export const DEFAULT_OBJECTIVE_STREAM_TOKEN_TTL_MS = 5 * 60 * 1000;
export const MAX_OBJECTIVE_STREAM_TOKEN_TTL_MS = 15 * 60 * 1000;

export const OBJECTIVE_STREAM_EVENT_SCOPES = [
    "heartbeat",
    "session.status",
    "session.segment",
    "chart.samples",
    "quality.update",
    "feature.window",
    "ml.inference",
    "interpretation.record",
    "interpretation.suppressed",
    "session.summary.partial",
    "error",
] as const;

export type ObjectiveStreamEventScope =
    (typeof OBJECTIVE_STREAM_EVENT_SCOPES)[number];

export type ObjectiveStreamTokenPayload = {
    token_type: typeof OBJECTIVE_STREAM_TOKEN_TYPE;
    token_version: typeof OBJECTIVE_STREAM_TOKEN_VERSION;
    token_id: string;
    actor_role: "clinician";
    clinician_id: string;
    patient_id: string;
    session_id: string;
    assignment_id: string;
    issued_at_ms: number;
    expires_at_ms: number;
    allowed_event_scopes: ObjectiveStreamEventScope[];
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveStreamTokenIssueInput = {
    actor: ObjectiveActor;
    patientId: string;
    sessionId: string;
    assignmentLookup: ObjectiveAssignmentLookup;
    trace: ObjectiveTraceContext;
    secret: string;
    nowMs?: number;
    ttlMs?: number;
    allowedEventScopes?: readonly ObjectiveStreamEventScope[];
    auditLogger?: ObjectiveAuditLogger;
};

export type ObjectiveStreamTokenIssueResult = {
    token: string;
    payload: ObjectiveStreamTokenPayload;
    auditMetadata: ObjectiveAuditMetadata;
};

export type ObjectiveStreamTokenExpectedContext = {
    clinicianId?: string;
    patientId?: string;
    sessionId?: string;
    assignmentId?: string;
    requiredEventScope?: ObjectiveStreamEventScope;
};

export type ObjectiveStreamTokenValidationInput = {
    token: string;
    secret: string;
    nowMs?: number;
    expected?: ObjectiveStreamTokenExpectedContext;
};

export type ObjectiveStreamTokenValidationResult =
    | {
          valid: true;
          payload: ObjectiveStreamTokenPayload;
      }
    | {
          valid: false;
          statusCode: 401 | 403;
          code: string;
          message: string;
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: string, name: string): string {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return trimmed;
}

function assertSafeSecret(secret: string): string {
    const trimmed = secret.trim();

    if (trimmed.length < 32) {
        throw new Error(
            "Objective stream token secret must be at least 32 characters.",
        );
    }

    return trimmed;
}

function normalizeTtlMs(ttlMs: number | undefined): number {
    const normalized = ttlMs ?? DEFAULT_OBJECTIVE_STREAM_TOKEN_TTL_MS;

    if (
        !Number.isInteger(normalized) ||
        normalized <= 0 ||
        normalized > MAX_OBJECTIVE_STREAM_TOKEN_TTL_MS
    ) {
        throw new Error(
            `Objective stream token TTL must be an integer from 1 to ${MAX_OBJECTIVE_STREAM_TOKEN_TTL_MS} milliseconds.`,
        );
    }

    return normalized;
}

function isAllowedStreamScope(value: string): value is ObjectiveStreamEventScope {
    return OBJECTIVE_STREAM_EVENT_SCOPES.includes(
        value as ObjectiveStreamEventScope,
    );
}

function normalizeScopes(
    scopes: readonly ObjectiveStreamEventScope[] | undefined,
): ObjectiveStreamEventScope[] {
    const selectedScopes =
        scopes && scopes.length > 0 ? scopes : OBJECTIVE_STREAM_EVENT_SCOPES;
    const uniqueScopes = Array.from(new Set(selectedScopes));

    for (const scope of uniqueScopes) {
        if (!isAllowedStreamScope(scope)) {
            throw new Error(`Unsupported objective stream event scope: ${scope}`);
        }
    }

    return uniqueScopes;
}

function encodeBase64UrlJson(value: ObjectiveStreamTokenPayload): string {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signPayloadSegment(payloadSegment: string, secret: string): string {
    return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

function createSignedToken(
    payload: ObjectiveStreamTokenPayload,
    secret: string,
): string {
    const payloadSegment = encodeBase64UrlJson(payload);
    const signatureSegment = signPayloadSegment(payloadSegment, secret);

    return `${payloadSegment}.${signatureSegment}`;
}

function invalidToken(
    code: string,
    message: string,
    statusCode: 401 | 403 = 401,
): ObjectiveStreamTokenValidationResult {
    return {
        valid: false,
        statusCode,
        code,
        message,
    };
}

function verifySignature(
    payloadSegment: string,
    signatureSegment: string,
    secret: string,
): boolean {
    const expectedSignature = signPayloadSegment(payloadSegment, secret);

    let expectedBuffer: Buffer;
    let providedBuffer: Buffer;

    try {
        expectedBuffer = Buffer.from(expectedSignature, "base64url");
        providedBuffer = Buffer.from(signatureSegment, "base64url");
    } catch {
        return false;
    }

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function decodePayloadSegment(payloadSegment: string): unknown {
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");

    return JSON.parse(json) as unknown;
}

function readStringClaim(
    payload: Record<string, unknown>,
    key: string,
): string | null {
    const value = payload[key];

    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readIntegerClaim(
    payload: Record<string, unknown>,
    key: string,
): number | null {
    const value = payload[key];

    return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function parseStreamTokenPayload(
    decoded: unknown,
): ObjectiveStreamTokenPayload | null {
    if (!isRecord(decoded)) {
        return null;
    }

    if (decoded.token_type !== OBJECTIVE_STREAM_TOKEN_TYPE) {
        return null;
    }

    if (decoded.token_version !== OBJECTIVE_STREAM_TOKEN_VERSION) {
        return null;
    }

    if (decoded.actor_role !== "clinician") {
        return null;
    }

    if (
        decoded.clinician_visible !== true ||
        decoded.patient_visible !== false ||
        decoded.chatbot_visible !== false
    ) {
        return null;
    }

    const tokenId = readStringClaim(decoded, "token_id");
    const clinicianId = readStringClaim(decoded, "clinician_id");
    const patientId = readStringClaim(decoded, "patient_id");
    const sessionId = readStringClaim(decoded, "session_id");
    const assignmentId = readStringClaim(decoded, "assignment_id");
    const issuedAtMs = readIntegerClaim(decoded, "issued_at_ms");
    const expiresAtMs = readIntegerClaim(decoded, "expires_at_ms");

    if (
        !tokenId ||
        !clinicianId ||
        !patientId ||
        !sessionId ||
        !assignmentId ||
        issuedAtMs === null ||
        expiresAtMs === null ||
        expiresAtMs <= issuedAtMs
    ) {
        return null;
    }

    const scopes = decoded.allowed_event_scopes;

    if (!Array.isArray(scopes) || scopes.length === 0) {
        return null;
    }

    const allowedEventScopes: ObjectiveStreamEventScope[] = [];

    for (const scope of scopes) {
        if (typeof scope !== "string" || !isAllowedStreamScope(scope)) {
            return null;
        }

        allowedEventScopes.push(scope);
    }

    return {
        token_type: OBJECTIVE_STREAM_TOKEN_TYPE,
        token_version: OBJECTIVE_STREAM_TOKEN_VERSION,
        token_id: tokenId,
        actor_role: "clinician",
        clinician_id: clinicianId,
        patient_id: patientId,
        session_id: sessionId,
        assignment_id: assignmentId,
        issued_at_ms: issuedAtMs,
        expires_at_ms: expiresAtMs,
        allowed_event_scopes: Array.from(new Set(allowedEventScopes)),
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function contextMatches(
    payload: ObjectiveStreamTokenPayload,
    expected: ObjectiveStreamTokenExpectedContext | undefined,
): boolean {
    if (!expected) {
        return true;
    }

    if (
        expected.clinicianId !== undefined &&
        payload.clinician_id !== expected.clinicianId
    ) {
        return false;
    }

    if (
        expected.patientId !== undefined &&
        payload.patient_id !== expected.patientId
    ) {
        return false;
    }

    if (
        expected.sessionId !== undefined &&
        payload.session_id !== expected.sessionId
    ) {
        return false;
    }

    if (
        expected.assignmentId !== undefined &&
        payload.assignment_id !== expected.assignmentId
    ) {
        return false;
    }

    return true;
}

export async function generateObjectiveStreamToken(
    input: ObjectiveStreamTokenIssueInput,
): Promise<ObjectiveGuardResult<ObjectiveStreamTokenIssueResult>> {
    const patientId = assertNonEmptyString(input.patientId, "patientId");
    const sessionId = assertNonEmptyString(input.sessionId, "sessionId");
    const secret = assertSafeSecret(input.secret);
    const nowMs = input.nowMs ?? Date.now();
    const ttlMs = normalizeTtlMs(input.ttlMs);
    const allowedEventScopes = normalizeScopes(input.allowedEventScopes);

    const assignmentResult = await requireAssignedClinician(
        input.actor,
        patientId,
        input.assignmentLookup,
        input.trace,
    );

    if (!assignmentResult.allowed) {
        return {
            allowed: false,
            statusCode: assignmentResult.statusCode,
            code: assignmentResult.code,
            message: assignmentResult.message,
            auditEvent: assignmentResult.auditEvent,
        };
    }

    const payload: ObjectiveStreamTokenPayload = {
        token_type: OBJECTIVE_STREAM_TOKEN_TYPE,
        token_version: OBJECTIVE_STREAM_TOKEN_VERSION,
        token_id: randomUUID(),
        actor_role: "clinician",
        clinician_id: input.actor.actorId,
        patient_id: patientId,
        session_id: sessionId,
        assignment_id: assignmentResult.value.assignment.assignmentId,
        issued_at_ms: nowMs,
        expires_at_ms: nowMs + ttlMs,
        allowed_event_scopes: allowedEventScopes,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };

    const token = createSignedToken(payload, secret);
    const auditMetadata: ObjectiveAuditMetadata = {
        token_version: OBJECTIVE_STREAM_TOKEN_VERSION,
        ttl_ms: ttlMs,
        allowed_scope_count: allowedEventScopes.length,
        expires_at_ms: payload.expires_at_ms,
    };

    if (input.auditLogger) {
        await input.auditLogger.record({
            eventType: "stream_token_issued",
            actorId: input.actor.actorId,
            actorRole: "clinician",
            patientId,
            sessionId,
            assignmentId: payload.assignment_id,
            trace: input.trace,
            metadata: auditMetadata,
        });
    }

    return {
        allowed: true,
        value: {
            token,
            payload,
            auditMetadata,
        },
        auditEvent: null,
    };
}

export function validateObjectiveStreamToken(
    input: ObjectiveStreamTokenValidationInput,
): ObjectiveStreamTokenValidationResult {
    const secret = assertSafeSecret(input.secret);
    const nowMs = input.nowMs ?? Date.now();
    const parts = input.token.split(".");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return invalidToken(
            "objective_stream_token_invalid",
            "Objective stream token is malformed or invalid.",
        );
    }

    const [payloadSegment, signatureSegment] = parts;

    if (!verifySignature(payloadSegment, signatureSegment, secret)) {
        return invalidToken(
            "objective_stream_token_invalid",
            "Objective stream token is malformed or invalid.",
        );
    }

    let decodedPayload: unknown;

    try {
        decodedPayload = decodePayloadSegment(payloadSegment);
    } catch {
        return invalidToken(
            "objective_stream_token_invalid",
            "Objective stream token is malformed or invalid.",
        );
    }

    const payload = parseStreamTokenPayload(decodedPayload);

    if (!payload) {
        return invalidToken(
            "objective_stream_token_invalid",
            "Objective stream token payload is not allowed.",
        );
    }

    if (payload.expires_at_ms <= nowMs) {
        return invalidToken(
            "objective_stream_token_expired",
            "Objective stream token has expired.",
        );
    }

    if (!contextMatches(payload, input.expected)) {
        return invalidToken(
            "objective_stream_token_context_mismatch",
            "Objective stream token does not match the requested stream context.",
            403,
        );
    }

    const requiredScope = input.expected?.requiredEventScope;

    if (
        requiredScope !== undefined &&
        !payload.allowed_event_scopes.includes(requiredScope)
    ) {
        return invalidToken(
            "objective_stream_scope_denied",
            "Objective stream token does not allow the requested event scope.",
            403,
        );
    }

    return {
        valid: true,
        payload,
    };
}
