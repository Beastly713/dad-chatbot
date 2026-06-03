import {
    InMemoryObjectiveRawStorageRepository,
    buildObjectiveRawStorageWrite,
    toClinicianSafeChunkTraceability,
} from "../src/rawStorage.js";
import type { ObjectiveRawStorageIngestionResult } from "../src/rawStorage.js";

const visibility = {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false,
} as const;

function ingestionResult(): ObjectiveRawStorageIngestionResult {
    return {
        batch_id: "batch-1",
        session_id: "session-1",
        accepted_frame_count: 2,
        quarantined_frame_count: 1,
        timing: {
            frame_count: 2,
            first_esp_time_ms: 1000,
            last_esp_time_ms: 5000,
            duration_ms: 4000,
            max_gap_ms: 3995,
            gap_count: 1,
            duplicate_esp_time_count: 0,
            out_of_order_count: 0,
            segment_boundary_count: 1,
            timing_quality: "limited",
            warnings: ["large_timing_gap"],
        },
        chunks: [
            {
                raw_chunk_id: "chunk-1",
                batch_id: "batch-1",
                session_id: "session-1",
                source_type: "simulator",
                device_id: "device-1",
                device_boot_id: "boot-1",
                segment_id: "segment-1",
                chunk_index: 0,
                frame_count: 2,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 5000,
                timing: {
                    frame_count: 2,
                    first_esp_time_ms: 1000,
                    last_esp_time_ms: 5000,
                    duration_ms: 4000,
                    max_gap_ms: 3995,
                    gap_count: 1,
                    duplicate_esp_time_count: 0,
                    out_of_order_count: 0,
                    segment_boundary_count: 1,
                    timing_quality: "limited",
                    warnings: ["large_timing_gap"],
                },
                frames: [
                    {
                        pc_timestamp: "2026-06-02T10:00:00.000Z",
                        esp_time_ms: 1000,
                        ecg_raw: 2900,
                        gsr_raw: 2405,
                    },
                    {
                        pc_timestamp: "2026-06-02T10:00:04.000Z",
                        esp_time_ms: 5000,
                        ecg_raw: 2920,
                        gsr_raw: 2407,
                    },
                ],
                ...visibility,
            },
        ],
        quarantined: [
            {
                quarantine_id: "quarantine-1",
                batch_id: "batch-1",
                session_id: "session-1",
                source_type: "simulator",
                device_id: "device-1",
                device_boot_id: "boot-1",
                segment_id: "segment-1",
                frame_index: 2,
                esp_time_ms: 5005,
                pc_timestamp: "2026-06-02T10:00:04.005Z",
                reject_reason: "invalid_raw_frame",
                reject_details: ["ecg_raw must be a finite number when provided"],
                raw_payload_shape: "object",
                ...visibility,
            },
        ],
        ...visibility,
    };
}

describe("objective raw storage", () => {
    it("builds normalized raw batch, chunk, and quarantine storage records", () => {
        const write = buildObjectiveRawStorageWrite(ingestionResult(), () =>
            new Date("2026-06-02T10:00:10.000Z"),
        );

        expect(write.batch).toEqual({
            raw_batch_id: "raw-batch:batch-1",
            batch_id: "batch-1",
            session_id: "session-1",
            source_type: "simulator",
            schema_version: "objective_raw_frame.v1",
            frame_count: 3,
            accepted_frame_count: 2,
            quarantined_frame_count: 1,
            first_esp_time_ms: 1000,
            last_esp_time_ms: 5000,
            raw_range_metadata: {
                timing_quality: "limited",
                warnings: ["large_timing_gap"],
                gap_count: 1,
                duplicate_esp_time_count: 0,
                out_of_order_count: 0,
                segment_boundary_count: 1,
                max_gap_ms: 3995,
            },
            stored_at: "2026-06-02T10:00:10.000Z",
            ...visibility,
        });

        expect(write.chunks).toHaveLength(1);
        expect(write.chunks[0]).toEqual(
            expect.objectContaining({
                raw_chunk_id: "chunk-1",
                raw_batch_id: "raw-batch:batch-1",
                batch_id: "batch-1",
                session_id: "session-1",
                segment_id: "segment-1",
                source_type: "simulator",
                schema_version: "objective_raw_frame.v1",
                device_id: "device-1",
                device_boot_id: "boot-1",
                chunk_index: 0,
                frame_count: 2,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 5000,
                ...visibility,
            }),
        );
        expect(write.chunks[0].raw_payload).toHaveLength(2);

        expect(write.quarantined).toHaveLength(1);
        expect(write.quarantined[0]).toEqual(
            expect.objectContaining({
                quarantine_id: "quarantine-1",
                raw_batch_id: "raw-batch:batch-1",
                batch_id: "batch-1",
                session_id: "session-1",
                reject_reason: "invalid_raw_frame",
                raw_payload_shape: "object",
                ...visibility,
            }),
        );
    });

    it("persists normalized records in memory with session traceability", async () => {
        const repository = new InMemoryObjectiveRawStorageRepository(() =>
            new Date("2026-06-02T10:00:10.000Z"),
        );

        await repository.saveIngestionResult(ingestionResult());

        expect(await repository.getRawBatch("batch-1")).toEqual(
            expect.objectContaining({
                batch_id: "batch-1",
                session_id: "session-1",
                accepted_frame_count: 2,
                quarantined_frame_count: 1,
            }),
        );

        expect(await repository.listRawChunksForSession("session-1")).toEqual([
            expect.objectContaining({
                raw_chunk_id: "chunk-1",
                session_id: "session-1",
                segment_id: "segment-1",
                raw_payload: expect.any(Array),
            }),
        ]);

        expect(await repository.listQuarantinedFramesForSession("session-1")).toEqual(
            [
                expect.objectContaining({
                    quarantine_id: "quarantine-1",
                    reject_reason: "invalid_raw_frame",
                }),
            ],
        );
    });

    it("provides clinician-safe traceability without raw payload exposure", async () => {
        const repository = new InMemoryObjectiveRawStorageRepository();

        await repository.saveIngestionResult(ingestionResult());

        const traceability =
            await repository.listClinicianSafeChunkTraceability("session-1");

        expect(traceability).toEqual([
            {
                raw_chunk_id: "chunk-1",
                raw_batch_id: "raw-batch:batch-1",
                batch_id: "batch-1",
                session_id: "session-1",
                segment_id: "segment-1",
                source_type: "simulator",
                schema_version: "objective_raw_frame.v1",
                device_id: "device-1",
                device_boot_id: "boot-1",
                chunk_index: 0,
                frame_count: 2,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 5000,
                raw_range_metadata: {
                    timing_quality: "limited",
                    warnings: ["large_timing_gap"],
                    gap_count: 1,
                    duplicate_esp_time_count: 0,
                    out_of_order_count: 0,
                    segment_boundary_count: 1,
                    max_gap_ms: 3995,
                },
                visibility,
            },
        ]);

        expect(JSON.stringify(traceability)).not.toContain("raw_payload");
        expect(JSON.stringify(traceability)).not.toContain("ecg_raw");
        expect(JSON.stringify(traceability)).not.toContain("gsr_raw");
        expect(JSON.stringify(traceability)).not.toContain("patient_visible\":true");
        expect(JSON.stringify(traceability)).not.toContain("chatbot_visible\":true");
    });

    it("strips raw payloads from explicit traceability conversion", () => {
        const write = buildObjectiveRawStorageWrite(ingestionResult());
        const safe = toClinicianSafeChunkTraceability(write.chunks[0]);

        expect(safe).not.toHaveProperty("raw_payload");
        expect(JSON.stringify(safe)).not.toContain("ecg_raw");
        expect(JSON.stringify(safe)).not.toContain("gsr_raw");
    });
});
