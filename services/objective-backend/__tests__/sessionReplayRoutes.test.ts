import http from "http";
import type { AddressInfo } from "net";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveSegmentRecord } from "../src/segmentManager.js";
import type { ObjectiveSessionHistoryRouteDependencies } from "../src/sessionHistoryRoutes.js";
import { createObjectiveHttpServer } from "../src/server.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import {
    InMemoryObjectiveSessionRepository,
    type ObjectiveSessionRecord,
} from "../src/sessionLifecycle.js";

type HttpResponse = {
    statusCode: number;
    body: Record<string, unknown>;
};

function makeAssignments(
    activePatientIds: string[] = ["patient-1"],
): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!activePatientIds.includes(patientId)) {
                return null;
            }

            return {
                assignmentId: `assignment-${patientId}`,
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

function listen(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address() as AddressInfo;
            resolve(address.port);
        });
    });
}

function close(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function requestJson(
    port: number,
    method: "GET" | "POST",
    path: string,
    headers: Record<string, string>,
): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path,
                method,
                headers: {
                    "content-type": "application/json",
                    "x-request-id": "request-1",
                    "x-trace-id": "trace-1",
                    ...headers,
                },
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                response.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");

                    resolve({
                        statusCode: response.statusCode ?? 0,
                        body: JSON.parse(text) as Record<string, unknown>,
                    });
                });
            },
        );

        request.on("error", reject);
        request.end();
    });
}

function clinicianHeaders(): Record<string, string> {
    return {
        "x-objective-role": "clinician",
        "x-objective-actor-id": "clinician-1",
    };
}

function makeSession(patientId = "patient-1"): ObjectiveSessionRecord {
    return {
        session_id: "session-1",
        patient_id: patientId,
        source_type: "simulator",
        status: "stopped",
        created_at: "2026-06-02T10:00:00.000Z",
        started_at: "2026-06-02T10:00:00.000Z",
        stopped_at: "2026-06-02T10:10:00.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeFeatureWindow(): ObjectiveFeatureWindowRecord {
    return {
        id: "feature-window-1",
        feature_window_key: "session-1:1000:31000",
        session_id: "session-1",
        segment_id: "segment-1",
        source_type: "simulator",
        start_esp_time_ms: 1000,
        end_esp_time_ms: 31_000,
        raw_chunk_refs: ["chunk-1"],
        raw_range_refs: {},
        preprocessing_version: "objective-preprocessing-v1",
        feature_schema_version: "objective-feature-schema-v1",
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: {
            motion_confound_index: 0.12,
        },
        missingness: {
            ecg: 0.01,
        },
        modality_availability: {
            ecg: true,
            gsr: true,
        },
        features: {
            internal_feature_not_replayed: 1,
        },
        baseline_relative: {
            ecg_median_hr_delta_bpm: 8,
            gsr_tonic_delta: 0.4,
        },
        uncertainty_reasons: ["baseline_context_limited"],
        created_at: "2026-06-02T10:01:00.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeInterpretation(): ObjectiveInterpretationRecord {
    return {
        id: "interpretation-1",
        interpretation_key: "feature-window-1:interpretation",
        feature_window_id: "feature-window-1",
        session_id: "session-1",
        interpretation_version: "objective-interpretation-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        interpretation_label: "elevated_physiological_arousal_evidence",
        evidence_level: "moderate",
        confidence_label: "moderate_confidence",
        suppression_state: "not_suppressed",
        uncertainty_reasons: ["baseline_context_limited"],
        contributing_modalities: ["ECG", "GSR"],
        excluded_modalities: [],
        source_banner: "simulated_data",
        decision_payload: {},
        created_at: "2026-06-02T10:01:01.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeSegment(): ObjectiveSegmentRecord {
    return {
        segment_id: "segment-1",
        session_id: "session-1",
        device_boot_id: "boot-1",
        reason: "session_start",
        start_esp_time_ms: 0,
        end_esp_time_ms: 60_000,
        created_at: "2026-06-02T10:00:00.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeHistoryDependencies(options: {
    session?: ObjectiveSessionRecord | null;
    assignments?: ObjectiveAssignmentLookup;
    auditLogger?: ObjectiveSessionHistoryRouteDependencies["auditLogger"];
} = {}): ObjectiveSessionHistoryRouteDependencies {
    const session = options.session === undefined ? makeSession() : options.session;

    return {
        history: {
            async getSession() {
                return session;
            },
            async listSessionsForPatient() {
                return session ? [session] : [];
            },
        },
        assignments: options.assignments ?? makeAssignments(),
        auditLogger: options.auditLogger,
        now: () => new Date("2026-06-02T11:00:00.000Z"),
        replay: {
            replay: {
                async getSession() {
                    return session;
                },
                async listFeatureWindowsForSession() {
                    return session ? [makeFeatureWindow()] : [];
                },
                async listInterpretationsForSession() {
                    return session ? [makeInterpretation()] : [];
                },
                async listSegmentsForSession() {
                    return session ? [makeSegment()] : [];
                },
            },
            assignments: options.assignments ?? makeAssignments(),
            auditLogger: options.auditLogger,
            now: () => new Date("2026-06-02T11:00:00.000Z"),
        },
    };
}

function makeServer(
    historyDependencies: ObjectiveSessionHistoryRouteDependencies,
): http.Server {
    return createObjectiveHttpServer(
        loadObjectiveBackendConfig({}),
        {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: historyDependencies.assignments,
        },
        undefined,
        undefined,
        undefined,
        historyDependencies,
    );
}

function expectNoUnsafeReplayOutput(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
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
        "raw_payload",
        "relapse",
        "withdrawal",
        "intoxication",
        "craving",
        "diagnosis",
        "risk score",
        "treatment need",
        "detox need",
        "medication need",
        "ciwa",
        "sobriety",
        "truthfulness",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("objective session replay routes", () => {
    it("allows assigned clinician to read historical replay", async () => {
        const server = makeServer(makeHistoryDependencies());
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/session-1/replay",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(200);
            const replay = response.body.replay as Record<string, unknown>;

            expect(replay.replay_banner).toBe("historical_non_live_replay");
            expect(String(replay.replay_scope_note)).toContain("non-live replay");
            expect(replay.source_banner).toBe("simulated_data");
            expect(replay.chart_ready_samples).toEqual(expect.any(Array));
            expect(replay.feature_windows).toEqual(expect.any(Array));
            expect(replay.interpretation_timeline).toEqual(expect.any(Array));
            expect(replay.quality_timeline).toEqual(expect.any(Array));
            expect(replay.session_segments).toEqual(expect.any(Array));
            expect((replay.version_metadata as Record<string, unknown>).replay_mode).toBe(
                "historical_non_live",
            );
            expect(
                String(
                    (replay.version_metadata as Record<string, unknown>)
                        .regenerated_or_superseded_note,
                ),
            ).toContain("regenerated or superseded");
            expect(replay.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
            expectNoUnsafeReplayOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("denies patient, chatbot, service, and developer roles", async () => {
        const server = makeServer(makeHistoryDependencies());
        const port = await listen(server);

        try {
            for (const role of ["patient", "chatbot", "service", "developer"]) {
                const response = await requestJson(
                    port,
                    "GET",
                    "/api/objective/history/sessions/session-1/replay",
                    {
                        "x-objective-role": role,
                        "x-objective-actor-id": `${role}-1`,
                    },
                );

                expect(response.statusCode).toBe(403);
            }
        } finally {
            await close(server);
        }
    });

    it("denies unassigned clinicians and writes audit denial", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const assignments = makeAssignments([]);
        const server = makeServer(
            makeHistoryDependencies({ assignments, auditLogger: logger }),
        );
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/session-1/replay",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_assignment_required",
            );
            expect(sink.getRecords()).toEqual([
                expect.objectContaining({
                    event_type: "access_denied",
                    actor_id: "clinician-1",
                    actor_role: "clinician",
                    patient_id: "patient-1",
                    metadata: {
                        reason: "unassigned_clinician",
                    },
                }),
            ]);
        } finally {
            await close(server);
        }
    });

    it("checks replay assignment against the session patient", async () => {
        const server = makeServer(
            makeHistoryDependencies({
                session: makeSession("patient-2"),
                assignments: makeAssignments(["patient-1"]),
            }),
        );
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/session-1/replay",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_assignment_required",
            );
        } finally {
            await close(server);
        }
    });

    it("returns safe not found response for missing replay session", async () => {
        const server = makeServer(makeHistoryDependencies({ session: null }));
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/missing-session/replay",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({
                error: expect.objectContaining({
                    code: "objective_session_not_found",
                    message: "Objective session was not found.",
                }),
            });
            expectNoUnsafeReplayOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("does not expose replay endpoint for non-GET methods", async () => {
        const server = makeServer(makeHistoryDependencies());
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "POST",
                "/api/objective/history/sessions/session-1/replay",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(404);
            expect(JSON.stringify(response.body)).toContain(
                "objective_route_not_found",
            );
        } finally {
            await close(server);
        }
    });
});
