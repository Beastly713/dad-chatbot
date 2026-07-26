import {
    OBJECTIVE_AUDIT_EVENT_TYPES,
    ObjectiveAuditMetadataRejectedError,
    createInMemoryObjectiveAuditLogger,
    createSafeObjectiveAuditMetadata,
    normalizeAuditActorRole,
} from "../src/audit.js";
import type { ObjectiveAuditReadyEvent } from "../src/auth.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

describe("objective audit logger", () => {
    it("defines the bounded objective audit event types", () => {
        expect(OBJECTIVE_AUDIT_EVENT_TYPES).toEqual([
            "session_created",
            "session_started",
            "session_paused",
            "session_resumed",
            "session_stopped",
            "ingest_accepted",
            "ingest_rejected",
            "stream_token_issued",
            "stream_denied",
            "access_denied",
            "forbidden_label_blocked",
            "serializer_blocked",
            "interpretation_created",
            "interpretation_suppressed",
        ]);

        expect(OBJECTIVE_AUDIT_EVENT_TYPES).not.toContain("raw_payload_logged");
        expect(OBJECTIVE_AUDIT_EVENT_TYPES).not.toContain(
            "clinical_alert_created",
        );
    });

    it("records structured audit events to a sink", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const record = await logger.record({
            eventType: "session_created",
            actorId: "service-1",
            actorRole: "service",
            patientId: "patient-1",
            sessionId: "session-1",
            trace,
            occurredAt: new Date("2026-06-02T10:00:00.000Z"),
            metadata: {
                source_type: "simulator",
                accepted: true,
                frame_count: 0,
            },
        });

        expect(record).toEqual({
            audit_event_key: expect.any(String),
            event_type: "session_created",
            actor_id: "service-1",
            actor_role: "service",
            patient_id: "patient-1",
            session_id: "session-1",
            assignment_id: undefined,
            occurred_at: "2026-06-02T10:00:00.000Z",
            request_id: "request-1",
            trace_id: "trace-1",
            metadata: {
                source_type: "simulator",
                accepted: true,
                frame_count: 0,
            },
        });

        expect(sink.getRecords()).toEqual([record]);
    });

    it("records audit-ready access denied guard results", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const auditReadyEvent: ObjectiveAuditReadyEvent = {
            event_type: "access_denied",
            actor_id: "clinician-1",
            actor_role: "clinician",
            patient_id: "patient-1",
            reason: "unassigned_clinician",
            request_id: "request-1",
            trace_id: "trace-1",
        };

        await logger.recordAccessDenied(auditReadyEvent);

        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "access_denied",
                actor_id: "clinician-1",
                actor_role: "clinician",
                patient_id: "patient-1",
                request_id: "request-1",
                trace_id: "trace-1",
                metadata: {
                    reason: "unassigned_clinician",
                },
            }),
        ]);
    });

    it("normalizes unknown audit actor roles to service for safe internal logging", () => {
        expect(normalizeAuditActorRole("clinician")).toBe("clinician");
        expect(normalizeAuditActorRole("developer")).toBe("developer");
        expect(normalizeAuditActorRole("service")).toBe("service");
        expect(normalizeAuditActorRole("patient")).toBe("service");
        expect(normalizeAuditActorRole("chatbot")).toBe("service");
        expect(normalizeAuditActorRole(undefined)).toBe("service");
    });

    it("rejects unsupported audit event types", async () => {
        const { logger } = createInMemoryObjectiveAuditLogger();

        await expect(
            logger.record({
                eventType: "unsupported_event" as never,
                actorRole: "service",
                trace,
            }),
        ).rejects.toThrow(ObjectiveAuditMetadataRejectedError);
    });

    it("allows only primitive bounded audit metadata", () => {
        expect(
            createSafeObjectiveAuditMetadata({
                accepted: true,
                count: 2,
                source_type: "simulator",
                optional: null,
            }),
        ).toEqual({
            accepted: true,
            count: 2,
            source_type: "simulator",
            optional: null,
        });
    });

    it("rejects raw physiological metadata keys", () => {
        for (const key of [
            "raw_payload",
            "rawPayload",
            "frame",
            "frames",
            "ecg_raw",
            "gsr_raw",
            "max_red",
            "max_ir",
            "max_green",
            "accel_x",
            "gyro_z",
            "mpu_temp_c",
            "tmp117_temp_c",
        ]) {
            expect(() =>
                createSafeObjectiveAuditMetadata({
                    [key]: 1234,
                }),
            ).toThrow(ObjectiveAuditMetadataRejectedError);
        }
    });

    it("rejects sensitive free-text payload keys", () => {
        for (const key of [
            "note_text",
            "summary",
            "summary_text",
            "prompt",
            "response",
            "message",
            "messages",
            "finalResponse",
            "draftResponse",
            "user_input",
        ]) {
            expect(() =>
                createSafeObjectiveAuditMetadata({
                    [key]: "sensitive free text should not be logged here",
                }),
            ).toThrow(ObjectiveAuditMetadataRejectedError);
        }
    });

    it("rejects long strings to avoid accidental free-text audit logging", () => {
        expect(() =>
            createSafeObjectiveAuditMetadata({
                reason: "x".repeat(161),
            }),
        ).toThrow(ObjectiveAuditMetadataRejectedError);
    });

    it("rejects nested objects and arrays in audit metadata", () => {
        expect(() =>
            createSafeObjectiveAuditMetadata({
                nested: {
                    value: true,
                },
            }),
        ).toThrow(ObjectiveAuditMetadataRejectedError);

        expect(() =>
            createSafeObjectiveAuditMetadata({
                values: [1, 2, 3],
            }),
        ).toThrow(ObjectiveAuditMetadataRejectedError);
    });

    it("does not store raw values when unsafe metadata is rejected", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        await expect(
            logger.record({
                eventType: "ingest_rejected",
                actorRole: "service",
                trace,
                metadata: {
                    ecg_raw: 3000,
                },
            }),
        ).rejects.toThrow(ObjectiveAuditMetadataRejectedError);

        expect(sink.getRecords()).toEqual([]);
    });
});
