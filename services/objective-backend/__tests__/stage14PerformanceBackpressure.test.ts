import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import { HttpObjectiveMlClient } from "../src/mlInferenceClient.js";
import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlInferenceRequest,
} from "../src/mlInferenceContract.js";
import {
    ingestObjectiveRawBatch,
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    type ObjectiveRawBatchInput,
    type ObjectiveRawSensorFrame,
} from "../src/rawIngestion.js";
import { InMemoryObjectiveSegmentManager } from "../src/segmentManager.js";
import {
    createObjectiveChartSamplesStreamEvent,
    createObjectiveHeartbeatStreamEvent,
    createObjectiveQualityUpdateStreamEvent,
    createObjectiveSessionStatusStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
} from "../src/streamEvents.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    updateObjectiveSessionLifecycle,
    type ObjectiveSessionRecord,
} from "../src/sessionLifecycle.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "stage14-perf-request",
    traceId: "stage14-perf-trace",
};

const serviceActor: ObjectiveActor = {
    actorId: "service-stage14-perf",
    role: "service",
};

function noAssignments(): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment() {
            return null;
        },
    };
}

function fixedNow(): Date {
    return new Date("2026-06-02T13:00:00.000Z");
}

function expectClinicianOnlyVisibility(value: {
    clinician_visible: boolean;
    patient_visible: boolean;
    chatbot_visible: boolean;
}): void {
    expect({
        clinician_visible: value.clinician_visible,
        patient_visible: value.patient_visible,
        chatbot_visible: value.chatbot_visible,
    }).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
}

function expectNestedClinicianOnlyVisibility(value: {
    visibility: {
        clinician_visible: boolean;
        patient_visible: boolean;
        chatbot_visible: boolean;
    };
}): void {
    expect(value.visibility).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
}

function expectNoUnsafeSurface(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
        "raw_payload",
        "rawpayload",
        "\"raw_frame\":",
        "\"rawframe\":",
        "\"raw_frames\":",
        "\"rawframes\":",
        "frame\":",
        "frames\":",
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
        "developer_labels",
        "synthetic_ground_truth",
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
        "relapse risk",
        "withdrawal risk",
        "intoxication detected",
        "craving score",
        "risk score",
        "clinical alert",
        "emergency alert",
        "diagnosis",
        "chatbot_visible\":true",
        "patient_visible\":true",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

function validFrame(espTimeMs: number): ObjectiveRawSensorFrame {
    return {
        pc_timestamp: new Date(1_765_000_000_000 + espTimeMs).toISOString(),
        esp_time_ms: espTimeMs,
        ecg_raw: 2900 + (espTimeMs % 17),
        gsr_raw: 2400 + (espTimeMs % 11),
        max_red: 120 + (espTimeMs % 7),
        max_ir: 260 + (espTimeMs % 13),
        max_green: 90 + (espTimeMs % 5),
        accel_x: 0.01,
        accel_y: 0.02,
        accel_z: 9.81,
        gyro_x: 0.001,
        gyro_y: 0.002,
        gyro_z: 0.003,
        mpu_temp_c: 34.1,
        tmp117_temp_c: 32.2,
    };
}

function makeBatch(
    sessionId: string,
    frames: unknown[],
    overrides: Partial<ObjectiveRawBatchInput> = {},
): ObjectiveRawBatchInput {
    return {
        batch_id: overrides.batch_id ?? "stage14-perf-batch",
        session_id: sessionId,
        source_type: "simulator",
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: "device-stage14-perf",
        device_boot_id: "boot-stage14-perf",
        frames,
        ...overrides,
    };
}

async function createActiveSimulatorSession() {
    const sessions = new InMemoryObjectiveSessionRepository(fixedNow);

    const created = await createObjectiveSession(
        serviceActor,
        {
            patient_id: "patient-stage14-perf",
            source_type: "simulator",
            device_id: "device-stage14-perf",
            device_boot_id: "boot-stage14-perf",
        },
        {
            sessions,
            assignments: noAssignments(),
            now: fixedNow,
        },
        trace,
    );

    if (!created.allowed) {
        throw new Error(`Expected session creation to succeed: ${created.code}`);
    }

    const started = await updateObjectiveSessionLifecycle(
        serviceActor,
        created.value.session_id,
        "start",
        {
            sessions,
            assignments: noAssignments(),
            now: () => new Date("2026-06-02T13:00:01.000Z"),
        },
        trace,
    );

    if (!started.allowed) {
        throw new Error(`Expected session start to succeed: ${started.code}`);
    }

    return {
        sessions,
        session: started.value,
    };
}

function makeSessionRecord(
    status: ObjectiveSessionRecord["status"],
): ObjectiveSessionRecord {
    return {
        session_id: "session-stage14-stream",
        patient_id: "patient-stage14-stream",
        source_type: "simulator",
        status,
        device_id: "device-stage14-stream",
        device_boot_id: "boot-stage14-stream",
        created_at: "2026-06-02T13:00:00.000Z",
        started_at: "2026-06-02T13:00:01.000Z",
        stopped_at:
            status === "stopped" ? "2026-06-02T13:10:01.000Z" : undefined,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeMlRequest(): ObjectiveMlInferenceRequest {
    return {
        request_id: "stage14-perf-ml-request",
        feature_window_id: "feature-window-stage14-perf",
        session_id: "session-stage14-perf",
        target: OBJECTIVE_ML_ALLOWED_TARGET,
        feature_schema_version: "objective-feature-window-foundation-v1",
        preprocessing_version: "objective-preprocessing-v1",
        features: {
            ecg: {
                suppression: {
                    suppressed: false,
                    reasons: [],
                },
            },
            gsr: {
                suppression: {
                    suppressed: false,
                    reasons: [],
                },
            },
        },
        baseline_relative: {
            baseline_state: "available",
            heart_activity_trend: 0.2,
            skin_conductance_trend: 0.15,
        },
        quality: {
            signal_quality_state: "usable",
        },
        missingness: {
            ecg: 0,
            gsr: 0,
        },
        modality_availability: {
            ecg: true,
            gsr: true,
        },
        cross_signal: {
            signal_conflict_score: 0,
            high_motion_confound_present: false,
        },
        uncertainty_reasons: [],
        timeout_ms: 10,
    };
}

describe("Stage 14 basic streaming, latency, and backpressure safety", () => {
    it("handles high-rate simulator ingestion as chunked raw storage while exposing only safe traceability", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const { sessions, session } = await createActiveSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository(fixedNow);
        const segmentManager = new InMemoryObjectiveSegmentManager(fixedNow);

        const frames = Array.from({ length: 600 }, (_, index) =>
            validFrame(1_000 + index * 20),
        );

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            makeBatch(session.session_id, frames),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
                auditLogger: logger,
                now: fixedNow,
            },
            trace,
        );

        expect(result.allowed).toBe(true);
        if (!result.allowed) {
            throw new Error(`Expected high-rate ingestion to succeed: ${result.code}`);
        }

        expect(result.value.accepted_frame_count).toBe(600);
        expect(result.value.quarantined_frame_count).toBe(0);
        expect(result.value.chunks).toHaveLength(1);
        expect(result.value.timing).toEqual(
            expect.objectContaining({
                frame_count: 600,
                gap_count: 0,
                duplicate_esp_time_count: 0,
                out_of_order_count: 0,
                timing_quality: "good",
            }),
        );

        const storedChunks = await rawIngestion.listRawChunksForSession(
            session.session_id,
        );

        expect(storedChunks).toHaveLength(1);
        expect(storedChunks[0].raw_payload).toHaveLength(600);
        expectClinicianOnlyVisibility(storedChunks[0]);

        const traceability =
            await rawIngestion.listClinicianSafeChunkTraceability(
                session.session_id,
            );

        expect(traceability).toHaveLength(1);
        expectNestedClinicianOnlyVisibility(traceability[0]);
        expect(traceability[0]).toEqual(
            expect.objectContaining({
                frame_count: 600,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 12980,
            }),
        );

        expectNoUnsafeSurface({
            traceability,
            auditRecords: sink.getRecords(),
            safeIngestionSummary: {
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
    });

    it("quarantines dropped or malformed frames without exposing unsafe partial output in safe summaries", async () => {
        const { sessions, session } = await createActiveSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository(fixedNow);
        const segmentManager = new InMemoryObjectiveSegmentManager(fixedNow);

        const frames: unknown[] = Array.from({ length: 80 }, (_, index) => {
            const espTimeMs = 1_000 + index * 50;

            if (index % 10 === 0) {
                return {
                    pc_timestamp: new Date(
                        1_765_000_000_000 + espTimeMs,
                    ).toISOString(),
                    esp_time_ms: espTimeMs,
                    ecg_raw: Number.NaN,
                    relapse_risk: "high",
                };
            }

            return validFrame(espTimeMs);
        });

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            makeBatch(session.session_id, frames, {
                batch_id: "stage14-dropped-frame-batch",
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
                now: fixedNow,
            },
            trace,
        );

        expect(result.allowed).toBe(true);
        if (!result.allowed) {
            throw new Error(`Expected degraded ingestion to succeed: ${result.code}`);
        }

        expect(result.value.accepted_frame_count).toBe(72);
        expect(result.value.quarantined_frame_count).toBe(8);
        expect(result.value.quarantined).toHaveLength(8);

        for (const quarantined of result.value.quarantined) {
            expect(quarantined).toEqual(
                expect.objectContaining({
                    reject_reason: "invalid_raw_frame",
                    raw_payload_shape: "object",
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                }),
            );
            expect(quarantined).not.toHaveProperty("raw_payload");
            expect(quarantined).not.toHaveProperty("frame");
            expect(quarantined.reject_details.join(" ")).toContain(
                "forbidden field",
            );
        }

        const traceability =
            await rawIngestion.listClinicianSafeChunkTraceability(
                session.session_id,
            );

        const safeRouteLikeSummary = {
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
            traceability,
        };

        expectNoUnsafeSurface(safeRouteLikeSummary);
    });

    it("keeps timing-gap chunk pressure and session-duration boundaries clinician-safe", async () => {
        const { sessions, session } = await createActiveSimulatorSession();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository(fixedNow);
        const segmentManager = new InMemoryObjectiveSegmentManager(fixedNow);

        const firstBurst = Array.from({ length: 120 }, (_, index) =>
            validFrame(1_000 + index * 20),
        );
        const secondBurst = Array.from({ length: 120 }, (_, index) =>
            validFrame(10_000 + index * 20),
        );

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            makeBatch(session.session_id, [...firstBurst, ...secondBurst], {
                batch_id: "stage14-timing-pressure-batch",
            }),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                segmentManager,
                now: fixedNow,
            },
            trace,
        );

        expect(result.allowed).toBe(true);
        if (!result.allowed) {
            throw new Error(`Expected timing-gap ingestion to succeed: ${result.code}`);
        }

        expect(result.value.accepted_frame_count).toBe(240);
        expect(result.value.quarantined_frame_count).toBe(0);
        expect(result.value.chunks).toHaveLength(2);
        expect(result.value.timing).toEqual(
            expect.objectContaining({
                timing_quality: "limited",
                gap_count: 1,
                segment_boundary_count: 1,
                warnings: expect.arrayContaining(["large_timing_gap"]),
            }),
        );

        const segments = await segmentManager.listSegmentsForSession(
            session.session_id,
        );

        expect(segments).toHaveLength(2);
        expect(segments.map((segment) => segment.reason)).toEqual([
            "session_start",
            "timing_gap",
        ]);

        const stopped = await updateObjectiveSessionLifecycle(
            serviceActor,
            session.session_id,
            "stop",
            {
                sessions,
                assignments: noAssignments(),
                now: () => new Date("2026-06-02T13:10:01.000Z"),
            },
            trace,
        );

        expect(stopped.allowed).toBe(true);
        if (!stopped.allowed) {
            throw new Error(`Expected session stop to succeed: ${stopped.code}`);
        }

        expect(stopped.value.started_at).toBe("2026-06-02T13:00:01.000Z");
        expect(stopped.value.stopped_at).toBe("2026-06-02T13:10:01.000Z");
        expectClinicianOnlyVisibility(stopped.value);

        const traceability =
            await rawIngestion.listClinicianSafeChunkTraceability(
                session.session_id,
            );

        expect(traceability).toHaveLength(2);
        expectNoUnsafeSurface({
            segments,
            traceability,
            session: stopped.value,
        });
    });

    it("bounds latest-event replay for dashboard reconnect and filters stream scopes safely", () => {
        const hub = new InMemoryObjectiveClinicianStreamHub();

        for (const status of [
            "active",
            "paused",
            "active",
            "stopped",
        ] as const) {
            hub.publish(createObjectiveSessionStatusStreamEvent(makeSessionRecord(status)));
        }

        for (let index = 0; index < 25; index += 1) {
            hub.publish(
                createObjectiveChartSamplesStreamEvent("session-stage14-stream", [
                    {
                        t_ms: 1_000 + index * 100,
                        relative_time_ms: index * 100,
                        values: {
                            heart_activity_trend: index / 100,
                            skin_conductance_trend: index / 200,
                            motion_confound_index: 0.05,
                        },
                        quality: {
                            overall: "usable",
                        },
                    },
                ]),
            );
        }

        hub.publish(
            createObjectiveQualityUpdateStreamEvent("session-stage14-stream", {
                buffer_state: "bounded_latest_only",
                dropped_frame_count: 12,
                quality_notice: "technical limitation",
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            }),
        );
        hub.publish(createObjectiveHeartbeatStreamEvent("session-stage14-stream"));

        const replayedEvents: string[] = [];
        const replayedPayloads: unknown[] = [];

        const replayCount = hub.replayLatest("session-stage14-stream", {
            allowedScopes: new Set([
                "session.status",
                "chart.samples",
                "quality.update",
            ]),
            send(event) {
                replayedEvents.push(event.event_type);
                replayedPayloads.push(event);
            },
        });

        expect(replayCount).toBe(3);
        expect(replayedEvents.sort()).toEqual([
            "chart.samples",
            "quality.update",
            "session.status",
        ]);

        const heartbeatOnlyReplay = hub.getReplaySnapshot(
            "session-stage14-stream",
            new Set(["heartbeat"]),
        );

        expect(heartbeatOnlyReplay.event_count).toBe(1);
        expect(heartbeatOnlyReplay.events[0].event_type).toBe("heartbeat");
        expectNestedClinicianOnlyVisibility(heartbeatOnlyReplay);
        expectNoUnsafeSurface({
            replayedPayloads,
            heartbeatOnlyReplay,
        });
    });

    it("rejects unsafe stream payloads before partial events can be delivered", () => {
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const delivered: unknown[] = [];

        hub.subscribe("session-stage14-stream", {
            allowedScopes: new Set(["quality.update"]),
            send(event) {
                delivered.push(event);
            },
        });

        expect(() =>
            hub.publish(
                createObjectiveQualityUpdateStreamEvent("session-stage14-stream", {
                    raw_payload: [validFrame(1000)],
                }),
            ),
        ).toThrow("Unsafe stream payload key");

        expect(() =>
            hub.publish(
                createObjectiveQualityUpdateStreamEvent("session-stage14-stream", {
                    nested: {
                        clinician_visible: true,
                        patient_visible: true,
                        chatbot_visible: false,
                    },
                }),
            ),
        ).toThrow("clinician-only");

        expect(delivered).toEqual([]);
    });

    it("treats ML timeout as a safe degraded state without unsafe partial inference output", async () => {
        const fetchMock = jest.fn(
            async (_url: string | URL | Request, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    const signal = init?.signal;

                    if (signal?.aborted) {
                        reject(new Error("AbortError: objective ML request aborted safely"));
                        return;
                    }

                    signal?.addEventListener("abort", () => {
                        reject(
                            new Error("AbortError: objective ML request aborted safely"),
                        );
                    });
                }),
        );

        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            timeout_ms: 1,
            fetch_impl: fetchMock,
        });

        await expect(client.infer(makeMlRequest())).rejects.toThrow("AbortError");

        const safeTimeoutFallback = validateObjectiveMlInferenceResponse({
            target: OBJECTIVE_ML_ALLOWED_TARGET,
            predicted_class: "insufficient_reliable_data",
            confidence_label: "insufficient_confidence",
            probability: 0,
            uncertainty_reasons: ["ml_timeout", "technical_limitation"],
            suppression_state: "suppressed_missing_data",
            model_version: "objective-ml-timeout-safe-test-v1",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        });

        expect(safeTimeoutFallback.predicted_class).toBe(
            "insufficient_reliable_data",
        );
        expect(safeTimeoutFallback.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
        expectNoUnsafeSurface({
            safeTimeoutFallback,
            fetchCallCount: fetchMock.mock.calls.length,
        });
    });
});
