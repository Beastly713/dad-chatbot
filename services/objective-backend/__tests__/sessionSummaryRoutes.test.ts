import http from "http";
import type { AddressInfo } from "net";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "../src/mlInferenceStorage.js";
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

function makeFeatureWindow(
    overrides: Partial<ObjectiveFeatureWindowRecord> = {},
): ObjectiveFeatureWindowRecord {
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
            ppg: false,
        },
        features: {
            internal_feature_not_summarized: 1,
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
        ...overrides,
    };
}

function makeInterpretation(
    overrides: Partial<ObjectiveInterpretationRecord> = {},
): ObjectiveInterpretationRecord {
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
        ...overrides,
    };
}

function makeMlInference(): ObjectiveMlInferenceRecord {
    return {
        id: "ml-1",
        inference_key: "feature-window-1:objective-ml-classical-tabular-v1",
        feature_window_id: "feature-window-1",
        feature_window_key: "session-1:1000:31000",
        session_id: "session-1",
        segment_id: "segment-1",
        model_version: "objective-ml-classical-tabular-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        predicted_class: "elevated_arousal_evidence",
        confidence_label: "moderate_confidence",
        probability: 0.72,
        uncertainty_reasons: ["baseline_context_limited"],
        suppression_state: "not_suppressed",
        inference_response: {
            target: "baseline_relative_elevated_physiological_arousal_evidence",
            predicted_class: "elevated_arousal_evidence",
            confidence_label: "moderate_confidence",
            probability: 0.72,
            uncertainty_reasons: ["baseline_context_limited"],
            suppression_state: "not_suppressed",
            model_version: "objective-ml-classical-tabular-v1",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
        created_at: "2026-06-02T10:01:00.500Z",
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
    const assignments = options.assignments ?? makeAssignments();

    return {
        history: {
            async getSession() {
                return session;
            },
            async listSessionsForPatient() {
                return session ? [session] : [];
            },
        },
        assignments,
        auditLogger: options.auditLogger,
        now: () => new Date("2026-06-02T11:00:00.000Z"),
        summary: {
            summary: {
                async getSession() {
                    return session;
                },
                async listFeatureWindowsForSession() {
                    return session
                        ? [
                              makeFeatureWindow(),
                              makeFeatureWindow({
                                  id: "feature-window-2",
                                  feature_window_key: "session-1:31000:61000",
                                  start_esp_time_ms: 31_000,
                                  end_esp_time_ms: 61_000,
                                  window_status: "suppressed",
                                  suppression_state: "suppressed_low_quality",
                                  modality_availability: {
                                      ecg: true,
                                      gsr: false,
                                      ppg: false,
                                  },
                                  uncertainty_reasons: ["poor signal quality"],
                              }),
                          ]
                        : [];
                },
                async listInterpretationsForSession() {
                    return session
                        ? [
                              makeInterpretation(),
                              makeInterpretation({
                                  id: "interpretation-2",
                                  interpretation_key:
                                      "feature-window-2:interpretation",
                                  feature_window_id: "feature-window-2",
                                  interpretation_label:
                                      "recovery_cooldown_evidence",
                                  evidence_level: "low",
                                  confidence_label: "low_confidence",
                                  created_at: "2026-06-02T10:02:01.000Z",
                              }),
                          ]
                        : [];
                },
                async listMlInferencesForSession() {
                    return session ? [makeMlInference()] : [];
                },
            },
            assignments,
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

function expectNoUnsafeSummaryOutput(value: unknown): void {
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
        "features",
        "inference_response",
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

describe("objective session summary routes", () => {
    it("allows assigned clinician to read final session summary", async () => {
        const server = makeServer(makeHistoryDependencies());
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/session-1/summary",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(200);
            const summary = response.body.summary as Record<string, unknown>;

            expect(summary.summary_scope_note).toEqual(
                expect.stringContaining("non-diagnostic"),
            );
            expect(summary.total_windows).toBe(2);
            expect(summary.interpretable_fraction).toEqual({
                numerator: 1,
                denominator: 2,
                fraction: 0.5,
            });
            expect(summary.suppressed_fraction).toEqual({
                numerator: 1,
                denominator: 2,
                fraction: 0.5,
            });
            expect(summary.modality_availability).toEqual([
                {
                    modality: "ecg",
                    available_windows: 2,
                    total_windows: 2,
                    fraction_available: 1,
                },
                {
                    modality: "gsr",
                    available_windows: 1,
                    total_windows: 2,
                    fraction_available: 0.5,
                },
                {
                    modality: "ppg",
                    available_windows: 0,
                    total_windows: 2,
                    fraction_available: 0,
                },
            ]);
            expect(summary.major_quality_issues).toEqual([
                "Baseline context limited",
                "Signal quality limitation",
            ]);
            expect(summary.evidence_periods).toEqual(expect.any(Array));
            expect(summary.cooldown_periods).toEqual(expect.any(Array));
            expect(
                (summary.version_metadata as Record<string, unknown>)
                    .summary_schema_version,
            ).toBe("objective-final-session-summary-v1");
            expect(
                (summary.version_metadata as Record<string, unknown>).model_versions,
            ).toEqual(["objective-ml-classical-tabular-v1"]);
            expect(summary.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
            expectNoUnsafeSummaryOutput(response.body);
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
                    "/api/objective/history/sessions/session-1/summary",
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
                "/api/objective/history/sessions/session-1/summary",
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

    it("checks summary assignment against the session patient", async () => {
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
                "/api/objective/history/sessions/session-1/summary",
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

    it("returns safe not found response for missing summary session", async () => {
        const server = makeServer(makeHistoryDependencies({ session: null }));
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/missing-session/summary",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({
                error: expect.objectContaining({
                    code: "objective_session_not_found",
                    message: "Objective session was not found.",
                }),
            });
            expectNoUnsafeSummaryOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("does not expose summary endpoint for non-GET methods", async () => {
        const server = makeServer(makeHistoryDependencies());
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "POST",
                "/api/objective/history/sessions/session-1/summary",
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
