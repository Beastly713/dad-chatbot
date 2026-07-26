import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import {
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    ingestObjectiveRawBatch,
} from "../src/rawIngestion.js";
import { InMemoryObjectiveSegmentManager } from "../src/segmentManager.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "stage5-request",
    traceId: "stage5-trace",
};

const serviceActor: ObjectiveActor = {
    actorId: "service-1",
    role: "service",
};

function noAssignments(): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment() {
            return null;
        },
    };
}

function validFrame(
    espTimeMs: number,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        pc_timestamp: `2026-06-02T10:00:${String(
            Math.floor(espTimeMs / 1000),
        ).padStart(2, "0")}.000Z`,
        esp_time_ms: espTimeMs,
        ecg_raw: 2900,
        gsr_raw: 2405,
        ...overrides,
    };
}

function validBatch(
    sessionId: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        batch_id: "batch-1",
        session_id: sessionId,
        source_type: "simulator",
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: "device-1",
        device_boot_id: "boot-1",
        frames: [validFrame(1000), validFrame(1005)],
        ...overrides,
    };
}

async function createStartedSimulatorSession() {
    const sessions = new InMemoryObjectiveSessionRepository(
        () => new Date("2026-06-02T10:00:00.000Z"),
    );

    const created = await createObjectiveSession(
        serviceActor,
        {
            patient_id: "patient-1",
            source_type: "simulator",
        },
        {
            sessions,
            assignments: noAssignments(),
        },
        trace,
    );

    if (!created.allowed) {
        throw new Error("Expected service actor to create simulator session");
    }

    const started = await updateObjectiveSessionLifecycle(
        serviceActor,
        created.value.session_id,
        "start",
        {
            sessions,
            assignments: noAssignments(),
            now: () => new Date("2026-06-02T10:00:01.000Z"),
        },
        trace,
    );

    if (!started.allowed) {
        throw new Error("Expected service actor to start simulator session");
    }

    return {
        sessions,
        session: started.value,
    };
}

describe("Stage 5 ingestion closure", () => {
    it("accepts a valid service-produced simulator raw batch", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const segmentManager = new InMemoryObjectiveSegmentManager();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
                auditLogger: logger,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected valid batch to be accepted");
        }

        expect(result.value).toEqual(
            expect.objectContaining({
                batch_id: "batch-1",
                session_id: session.session_id,
                accepted_frame_count: 2,
                quarantined_frame_count: 0,
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        expect(result.value.chunks).toHaveLength(1);
        expect(result.value.chunks[0]).toEqual(
            expect.objectContaining({
                segment_id: expect.any(String),
                frame_count: 2,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 1005,
            }),
        );

        expect(
            await rawIngestion.getIngestionResults(session.session_id),
        ).toHaveLength(1);

        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "ingest_accepted",
                actor_id: "service-1",
                actor_role: "service",
                session_id: session.session_id,
                metadata: {
                    batch_id: "batch-1",
                    accepted_frame_count: 2,
                    quarantined_frame_count: 0,
                    chunk_count: 1,
                },
            }),
        ]);
    });

    it("rejects invalid raw schema versions before storing data", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                schema_version: "objective_raw_frame.v999",
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected invalid schema to be rejected");
        }

        expect(result.statusCode).toBe(400);
        expect(result.code).toBe("objective_invalid_raw_schema_version");
        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
    });

    it("rejects unsupported source types before storing data", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                source_type: "clinical_device",
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected unsupported source to be rejected");
        }

        expect(result.statusCode).toBe(400);
        expect(result.code).toBe("objective_invalid_source_type");
        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
    });

    it("quarantines frames missing esp_time_ms instead of silently dropping them", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                frames: [
                    validFrame(1000),
                    {
                        pc_timestamp: "2026-06-02T10:00:01.000Z",
                        ecg_raw: 2900,
                        gsr_raw: 2405,
                    },
                ],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                auditLogger: logger,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected batch with one invalid frame to be accepted");
        }

        expect(result.value.accepted_frame_count).toBe(1);
        expect(result.value.quarantined_frame_count).toBe(1);
        expect(result.value.quarantined[0]).toEqual(
            expect.objectContaining({
                frame_index: 1,
                reject_reason: "invalid_raw_frame",
                raw_payload_shape: "object",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );
        expect(result.value.quarantined[0].reject_details.join(" ")).toContain(
            "esp_time_ms",
        );

        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "ingest_accepted",
                metadata: {
                    batch_id: "batch-1",
                    accepted_frame_count: 1,
                    quarantined_frame_count: 1,
                    chunk_count: 1,
                },
            }),
        ]);
    });

    it("detects duplicate ESP timestamps as limited timing quality", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                frames: [validFrame(1000), validFrame(1000), validFrame(1005)],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected duplicate timestamps to be accepted with warning");
        }

        expect(result.value.timing).toEqual(
            expect.objectContaining({
                timing_quality: "limited",
                duplicate_esp_time_count: 1,
                warnings: expect.arrayContaining(["duplicate_esp_time"]),
            }),
        );
    });

    it("detects out-of-order frames and sorts accepted chunks by ESP time", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                frames: [validFrame(1010), validFrame(1000), validFrame(1005)],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected out-of-order frames to be accepted with warning");
        }

        expect(result.value.timing).toEqual(
            expect.objectContaining({
                timing_quality: "limited",
                out_of_order_count: 1,
                warnings: expect.arrayContaining(["out_of_order_esp_time"]),
            }),
        );
        expect(result.value.chunks[0]).toEqual(
            expect.objectContaining({
                first_esp_time_ms: 1000,
                last_esp_time_ms: 1010,
            }),
        );
    });

    it("segments large timing gaps into separate raw chunks and timing-gap segments", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const segmentManager = new InMemoryObjectiveSegmentManager();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                frames: [
                    validFrame(1000),
                    validFrame(1005),
                    validFrame(5000),
                    validFrame(5005),
                ],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected timing-gap batch to be accepted");
        }

        expect(result.value.accepted_frame_count).toBe(4);
        expect(result.value.chunks).toHaveLength(2);
        expect(result.value.timing).toEqual(
            expect.objectContaining({
                timing_quality: "limited",
                gap_count: 1,
                segment_boundary_count: 1,
                warnings: ["large_timing_gap"],
            }),
        );

        const segments = await segmentManager.listSegmentsForSession(
            session.session_id,
        );

        expect(segments.map((segment) => segment.reason)).toEqual([
            "session_start",
            "timing_gap",
        ]);
        expect(result.value.chunks.map((chunk) => chunk.segment_id)).toEqual([
            segments[0].segment_id,
            segments[1].segment_id,
        ]);
    });

    it("creates a device-reset segment when device boot changes across batches", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const segmentManager = new InMemoryObjectiveSegmentManager();

        const first = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                batch_id: "batch-1",
                device_boot_id: "boot-1",
                frames: [validFrame(1000), validFrame(1005)],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
            },
            trace,
        );

        expect(first.allowed).toBe(true);

        const second = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                batch_id: "batch-2",
                device_boot_id: "boot-2",
                frames: [validFrame(0), validFrame(5)],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
            },
            trace,
        );

        expect(second.allowed).toBe(true);

        const segments = await segmentManager.listSegmentsForSession(
            session.session_id,
        );

        expect(segments.map((segment) => segment.reason)).toEqual([
            "session_start",
            "device_reset",
        ]);

        if (!second.allowed) {
            throw new Error("Expected second batch to be accepted");
        }

        expect(second.value.chunks[0].segment_id).toBe(segments[1].segment_id);
    });

    it("audits fully rejected/quarantined batches without logging raw physiological values", async () => {
        const { sessions, session } = await createStartedSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, {
                frames: [
                    {
                        pc_timestamp: "2026-06-02T10:00:01.000Z",
                        ecg_raw: Number.NaN,
                        gsr_raw: 2405,
                    },
                    {
                        pc_timestamp: "2026-06-02T10:00:02.000Z",
                        esp_time_ms: -1,
                        ecg_raw: 2900,
                        gsr_raw: 2405,
                    },
                ],
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                auditLogger: logger,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected invalid-frame batch to be quarantined");
        }

        expect(result.value.accepted_frame_count).toBe(0);
        expect(result.value.quarantined_frame_count).toBe(2);
        expect(result.value.chunks).toEqual([]);
        expect(result.value.timing).toEqual(
            expect.objectContaining({
                timing_quality: "invalid",
                warnings: ["no_accepted_frames"],
            }),
        );

        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "ingest_rejected",
                actor_id: "service-1",
                actor_role: "service",
                session_id: session.session_id,
                metadata: {
                    batch_id: "batch-1",
                    accepted_frame_count: 0,
                    quarantined_frame_count: 2,
                    chunk_count: 0,
                },
            }),
        ]);

        const auditJson = JSON.stringify(sink.getRecords());

        expect(auditJson).not.toContain("ecg_raw");
        expect(auditJson).not.toContain("gsr_raw");
        expect(auditJson).not.toContain("raw_payload");
        expect(auditJson).not.toContain("pc_timestamp");
    });
});
