import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import {
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    ingestObjectiveRawBatch,
} from "../src/rawIngestion.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

const clinician: ObjectiveActor = {
    actorId: "clinician-1",
    role: "clinician",
};

const service: ObjectiveActor = {
    actorId: "service-1",
    role: "service",
};

function assignedLookup(active: boolean): ObjectiveAssignmentLookup {
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

function validBatch(sessionId: string) {
    return {
        batch_id: "batch-1",
        session_id: sessionId,
        source_type: "simulator",
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: "device-1",
        device_boot_id: "boot-1",
        frames: [
            {
                pc_timestamp: "2026-06-02T10:00:00.000Z",
                esp_time_ms: 1000,
                ecg_raw: 2900,
                gsr_raw: 2405,
            },
            {
                pc_timestamp: "2026-06-02T10:00:00.005Z",
                esp_time_ms: 1005,
                ecg_raw: 2910,
                gsr_raw: 2406,
            },
        ],
    };
}

async function createActiveSession(actor: ObjectiveActor) {
    const sessions = new InMemoryObjectiveSessionRepository(
        () => new Date("2026-06-02T10:00:00.000Z"),
    );

    const created = await createObjectiveSession(
        actor,
        {
            patient_id: "patient-1",
            source_type: "simulator",
        },
        {
            sessions,
            assignments: assignedLookup(true),
        },
        trace,
    );

    if (!created.allowed) {
        throw new Error("Expected session creation to succeed");
    }

    await updateObjectiveSessionLifecycle(
        actor,
        created.value.session_id,
        "start",
        {
            sessions,
            assignments: assignedLookup(true),
            now: () => new Date("2026-06-02T10:00:01.000Z"),
        },
        trace,
    );

    return {
        sessions,
        session: created.value,
    };
}

describe("objective raw ingestion", () => {
    it("accepts valid raw batches and stores accepted chunks", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const { sessions, session } = await createActiveSession(clinician);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            clinician,
            validBatch(session.session_id),
            {
                sessions,
                assignments: assignedLookup(true),
                rawIngestion,
                auditLogger: logger,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected ingestion to succeed");
        }

        expect(result.value.accepted_frame_count).toBe(2);
        expect(result.value.quarantined_frame_count).toBe(0);
        expect(result.value.chunks).toHaveLength(1);
        expect(result.value.chunks[0]).toEqual(
            expect.objectContaining({
                frame_count: 2,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 1005,
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        expect(
            await rawIngestion.getIngestionResults(session.session_id),
        ).toHaveLength(1);
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "ingest_accepted",
                metadata: {
                    batch_id: "batch-1",
                    accepted_frame_count: 2,
                    quarantined_frame_count: 0,
                    chunk_count: 1,
                },
            }),
        ]);
        expect(JSON.stringify(sink.getRecords())).not.toContain("ecg_raw");
        expect(JSON.stringify(sink.getRecords())).not.toContain("gsr_raw");
    });

    it("quarantines invalid frames instead of silently dropping them", async () => {
        const { sessions, session } = await createActiveSession(clinician);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const batch = validBatch(session.session_id);
        batch.frames.push({
            pc_timestamp: "2026-06-02T10:00:00.010Z",
            esp_time_ms: 1010,
            ecg_raw: Number.NaN,
            relapse_risk: "high",
        } as never);

        const result = await ingestObjectiveRawBatch(
            clinician,
            batch,
            {
                sessions,
                assignments: assignedLookup(true),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected ingestion with quarantine to succeed");
        }

        expect(result.value.accepted_frame_count).toBe(2);
        expect(result.value.quarantined_frame_count).toBe(1);
        expect(result.value.quarantined[0]).toEqual(
            expect.objectContaining({
                frame_index: 2,
                reject_reason: "invalid_raw_frame",
                raw_payload_shape: "object",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );
        expect(result.value.quarantined[0].reject_details.join(" ")).toContain(
            "forbidden field",
        );
    });

    it("denies unassigned clinicians", async () => {
        const { sessions, session } = await createActiveSession(service);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            clinician,
            validBatch(session.session_id),
            {
                sessions,
                assignments: assignedLookup(false),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected unassigned clinician to deny");
        }

        expect(result.code).toBe("objective_assignment_required");
    });

    it("rejects batch source mismatch", async () => {
        const { sessions, session } = await createActiveSession(clinician);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            clinician,
            {
                ...validBatch(session.session_id),
                source_type: "prototype_hardware",
            },
            {
                sessions,
                assignments: assignedLookup(true),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected source mismatch to deny");
        }

        expect(result.code).toBe("objective_batch_source_mismatch");
    });

    it("rejects invalid batch envelopes before storing anything", async () => {
        const { sessions, session } = await createActiveSession(clinician);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            clinician,
            {
                ...validBatch(session.session_id),
                frames: [],
            },
            {
                sessions,
                assignments: assignedLookup(true),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);
        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
    });
});
