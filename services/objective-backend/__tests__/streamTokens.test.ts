import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import {
    parseObjectiveActorFromHeaders,
    type ObjectiveActor,
} from "../src/auth.js";
import {
    generateObjectiveStreamToken,
    OBJECTIVE_STREAM_EVENT_SCOPES,
    validateObjectiveStreamToken,
} from "../src/streamTokens.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

const secret = "objective-stream-token-test-secret-32-chars";

const clinicianActor: ObjectiveActor = {
    actorId: "clinician-1",
    role: "clinician",
};

const serviceActor: ObjectiveActor = {
    actorId: "service-1",
    role: "service",
};

const developerActor: ObjectiveActor = {
    actorId: "developer-1",
    role: "developer",
};

function makeLookup(active: boolean): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!active) {
                return null;
            }

            return {
                assignmentId: "assignment-1",
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

function decodePayload(token: string): Record<string, unknown> {
    const [payloadSegment] = token.split(".");

    if (!payloadSegment) {
        throw new Error("Expected token payload segment");
    }

    return JSON.parse(
        Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
}

function tamperPayload(token: string, changes: Record<string, unknown>): string {
    const [payloadSegment, signatureSegment] = token.split(".");

    if (!payloadSegment || !signatureSegment) {
        throw new Error("Expected signed token");
    }

    const payload = decodePayload(token);
    const tamperedPayloadSegment = Buffer.from(
        JSON.stringify({
            ...payload,
            ...changes,
        }),
        "utf8",
    ).toString("base64url");

    return `${tamperedPayloadSegment}.${signatureSegment}`;
}

describe("objective stream token generation and validation", () => {
    it("generates and validates a short-lived assigned-clinician stream token", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
            ttlMs: 300_000,
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        expect(issued.value.token).toEqual(expect.any(String));
        expect(issued.value.payload).toEqual(
            expect.objectContaining({
                token_type: "objective_stream",
                token_version: 1,
                actor_role: "clinician",
                clinician_id: "clinician-1",
                patient_id: "patient-1",
                session_id: "session-1",
                assignment_id: "assignment-1",
                issued_at_ms: 1000,
                expires_at_ms: 301_000,
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        expect(issued.value.payload.allowed_event_scopes).toEqual([
            ...OBJECTIVE_STREAM_EVENT_SCOPES,
        ]);

        const validation = validateObjectiveStreamToken({
            token: issued.value.token,
            secret,
            nowMs: 2000,
            expected: {
                clinicianId: "clinician-1",
                patientId: "patient-1",
                sessionId: "session-1",
                assignmentId: "assignment-1",
                requiredEventScope: "feature.window",
            },
        });

        expect(validation.valid).toBe(true);

        if (!validation.valid) {
            throw new Error("Expected valid stream token");
        }

        expect(validation.payload.session_id).toBe("session-1");
    });

    it("records stream-token issuance with safe audit metadata only", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
            ttlMs: 300_000,
            auditLogger: logger,
        });

        expect(issued.allowed).toBe(true);
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "stream_token_issued",
                actor_id: "clinician-1",
                actor_role: "clinician",
                patient_id: "patient-1",
                session_id: "session-1",
                assignment_id: "assignment-1",
                request_id: "request-1",
                trace_id: "trace-1",
                metadata: {
                    token_version: 1,
                    ttl_ms: 300_000,
                    allowed_scope_count: OBJECTIVE_STREAM_EVENT_SCOPES.length,
                    expires_at_ms: 301_000,
                },
            }),
        ]);
    });

    it("keeps token payload free of raw physiological fields and unsafe output wording", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        const serializedPayload = JSON.stringify(issued.value.payload).toLowerCase();

        for (const blockedFragment of [
            "raw_payload",
            "ecg_raw",
            "gsr_raw",
            "max_red",
            "max_ir",
            "max_green",
            "accel_x",
            "accel_y",
            "accel_z",
            "gyro_x",
            "gyro_y",
            "gyro_z",
            "mpu_temp_c",
            "tmp117_temp_c",
            "craving_detected",
            "relapse_risk",
            "withdrawal_risk",
            "intoxication_detected",
            "aud_severity",
            "emergency_detected",
            "treatment_need",
            "detox_need",
            "medication_need",
            "ciwa_score",
            "sobriety_status",
            "patient_truthfulness",
            "patient_is_lying",
            "patient_is_safe",
            "patient_is_stable",
            "stress_proven",
        ]) {
            expect(serializedPayload).not.toContain(blockedFragment);
        }
    });

    it("rejects patient and chatbot roles before token issuance", () => {
        for (const role of ["patient", "chatbot"] as const) {
            const parsed = parseObjectiveActorFromHeaders(
                {
                    "x-objective-role": role,
                    "x-objective-actor-id": `${role}-1`,
                },
                trace,
            );

            expect(parsed.allowed).toBe(false);

            if (parsed.allowed) {
                throw new Error(`Expected ${role} role to be denied`);
            }

            expect(parsed.code).toBe(`objective_${role}_denied`);
        }
    });

    it("rejects non-clinician actors for stream token issuance", async () => {
        for (const actor of [serviceActor, developerActor]) {
            const issued = await generateObjectiveStreamToken({
                actor,
                patientId: "patient-1",
                sessionId: "session-1",
                assignmentLookup: makeLookup(true),
                trace,
                secret,
                nowMs: 1000,
            });

            expect(issued.allowed).toBe(false);

            if (issued.allowed) {
                throw new Error("Expected non-clinician actor to be denied");
            }

            expect(issued.code).toBe("objective_clinician_required");
        }
    });

    it("rejects unassigned clinicians", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(false),
            trace,
            secret,
            nowMs: 1000,
        });

        expect(issued.allowed).toBe(false);

        if (issued.allowed) {
            throw new Error("Expected unassigned clinician to be denied");
        }

        expect(issued.code).toBe("objective_assignment_required");
        expect(issued.auditEvent).toEqual(
            expect.objectContaining({
                event_type: "access_denied",
                actor_id: "clinician-1",
                actor_role: "clinician",
                patient_id: "patient-1",
                reason: "unassigned_clinician",
            }),
        );
    });

    it("rejects malformed tokens", () => {
        const validation = validateObjectiveStreamToken({
            token: "not-a-signed-token",
            secret,
            nowMs: 2000,
        });

        expect(validation.valid).toBe(false);

        if (validation.valid) {
            throw new Error("Expected malformed token to be rejected");
        }

        expect(validation.statusCode).toBe(401);
        expect(validation.code).toBe("objective_stream_token_invalid");
    });

    it("rejects expired tokens", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
            ttlMs: 1000,
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        const validation = validateObjectiveStreamToken({
            token: issued.value.token,
            secret,
            nowMs: 2001,
            expected: {
                sessionId: "session-1",
            },
        });

        expect(validation.valid).toBe(false);

        if (validation.valid) {
            throw new Error("Expected expired token to be rejected");
        }

        expect(validation.code).toBe("objective_stream_token_expired");
    });

    it("rejects tampered tokens", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        const tamperedToken = tamperPayload(issued.value.token, {
            session_id: "session-2",
        });

        const validation = validateObjectiveStreamToken({
            token: tamperedToken,
            secret,
            nowMs: 2000,
            expected: {
                sessionId: "session-2",
            },
        });

        expect(validation.valid).toBe(false);

        if (validation.valid) {
            throw new Error("Expected tampered token to be rejected");
        }

        expect(validation.code).toBe("objective_stream_token_invalid");
    });

    it("rejects tokens used for the wrong stream context", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        for (const expected of [
            { clinicianId: "clinician-2" },
            { patientId: "patient-2" },
            { sessionId: "session-2" },
            { assignmentId: "assignment-2" },
        ]) {
            const validation = validateObjectiveStreamToken({
                token: issued.value.token,
                secret,
                nowMs: 2000,
                expected,
            });

            expect(validation.valid).toBe(false);

            if (validation.valid) {
                throw new Error("Expected wrong-context token use to be rejected");
            }

            expect(validation.statusCode).toBe(403);
            expect(validation.code).toBe(
                "objective_stream_token_context_mismatch",
            );
        }
    });

    it("rejects requested event scopes that were not granted", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeLookup(true),
            trace,
            secret,
            nowMs: 1000,
            allowedEventScopes: ["heartbeat"],
        });

        expect(issued.allowed).toBe(true);

        if (!issued.allowed) {
            throw new Error("Expected assigned clinician to receive stream token");
        }

        const validation = validateObjectiveStreamToken({
            token: issued.value.token,
            secret,
            nowMs: 2000,
            expected: {
                sessionId: "session-1",
                requiredEventScope: "feature.window",
            },
        });

        expect(validation.valid).toBe(false);

        if (validation.valid) {
            throw new Error("Expected ungranted scope to be rejected");
        }

        expect(validation.statusCode).toBe(403);
        expect(validation.code).toBe("objective_stream_scope_denied");
    });

    it("rejects unsupported event scopes at issuance time", async () => {
        await expect(
            generateObjectiveStreamToken({
                actor: clinicianActor,
                patientId: "patient-1",
                sessionId: "session-1",
                assignmentLookup: makeLookup(true),
                trace,
                secret,
                nowMs: 1000,
                allowedEventScopes: ["unsupported.scope" as never],
            }),
        ).rejects.toThrow("Unsupported objective stream event scope");
    });

    it("rejects weak signing secrets", async () => {
        await expect(
            generateObjectiveStreamToken({
                actor: clinicianActor,
                patientId: "patient-1",
                sessionId: "session-1",
                assignmentLookup: makeLookup(true),
                trace,
                secret: "too-short",
                nowMs: 1000,
            }),
        ).rejects.toThrow("at least 32 characters");
    });
});
