import { EventEmitter } from "events";
import type { IncomingMessage, ServerResponse } from "http";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "../src/mlInferenceStorage.js";
import { handleObjectiveSessionHistoryRoute } from "../src/sessionHistoryRoutes.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";
import type { ObjectiveSegmentRecord } from "../src/segmentManager.js";

type MockResponseBody = Record<string, unknown>;

class MockResponse extends EventEmitter {
    statusCode = 200;
    readonly headers = new Map<string, string | number | string[]>();
    readonly chunks: Buffer[] = [];

    setHeader(name: string, value: string | number | string[]): this {
        this.headers.set(name.toLowerCase(), value);
        return this;
    }

    getHeader(name: string): string | number | string[] | undefined {
        return this.headers.get(name.toLowerCase());
    }

    end(chunk?: string | Buffer): this {
        if (chunk) {
            this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        this.emit("finish");
        return this;
    }

    json(): MockResponseBody {
        const text = this.text();
        return text ? (JSON.parse(text) as MockResponseBody) : {};
    }

    text(): string {
        return Buffer.concat(this.chunks).toString("utf8");
    }
}

function makeRequest(
    url: string,
    headers: Record<string, string> = {},
): IncomingMessage {
    return {
        method: "GET",
        url,
        headers: {
            host: "localhost",
            "x-request-id": "request-stage12",
            "x-trace-id": "trace-stage12",
            ...headers,
        },
    } as unknown as IncomingMessage;
}

function clinicianHeaders(): Record<string, string> {
    return {
        "x-objective-role": "clinician",
        "x-objective-actor-id": "clinician-1",
    };
}

function roleHeaders(role: string): Record<string, string> {
    return {
        "x-objective-role": role,
        "x-objective-actor-id": `${role}-1`,
    };
}

function makeAssignmentLookup(active = true): ObjectiveAssignmentLookup {
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

function makeSession(
    overrides: Partial<ObjectiveSessionRecord> = {},
): ObjectiveSessionRecord {
    return {
        session_id: "session-1",
        patient_id: "patient-1",
        source_type: "simulator",
        status: "stopped",
        created_at: "2026-06-02T10:00:00.000Z",
        started_at: "2026-06-02T10:00:00.000Z",
        stopped_at: "2026-06-02T10:10:00.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
        ...overrides,
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
        raw_range_refs: {
            first_esp_time_ms: 1000,
            last_esp_time_ms: 31_000,
        },
        preprocessing_version: "objective-preprocessing-v1",
        feature_schema_version: "objective-feature-schema-v1",
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: {
            motion_confound_index: 0.1,
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
            internal_feature_not_exposed_directly: 1,
        },
        baseline_relative: {
            ecg_median_hr_delta_bpm: 7,
            gsr_tonic_delta: 0.3,
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
        feature_window_key: "session-1:1000:31000",
        ml_inference_id: "ml-1",
        session_id: "session-1",
        segment_id: "segment-1",
        interpretation_version: "objective-interpretation-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        interpretation_label: "elevated_physiological_arousal_evidence",
        evidence_level: "moderate",
        confidence_label: "moderate_confidence",
        suppression_state: "not_suppressed",
        uncertainty_reasons: ["baseline_context_limited"],
        contributing_modalities: ["ECG", "GSR"],
        excluded_modalities: ["PPG"],
        source_banner: "simulated_data",
        decision_payload: {
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
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
        inference_key: "feature-window-1:ml",
        feature_window_id: "feature-window-1",
        feature_window_key: "session-1:1000:31000",
        session_id: "session-1",
        segment_id: "segment-1",
        model_version: "objective-ml-classical-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        predicted_class: "elevated_arousal_evidence",
        confidence_label: "moderate_confidence",
        probability: 0.62,
        uncertainty_reasons: ["baseline_context_limited"],
        suppression_state: "not_suppressed",
        inference_response: {
            model_version: "objective-ml-classical-v1",
            target: "baseline_relative_elevated_physiological_arousal_evidence",
            predicted_class: "elevated_arousal_evidence",
            confidence_label: "moderate_confidence",
            probability: 0.62,
            uncertainty_reasons: ["baseline_context_limited"],
            suppression_state: "not_suppressed",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
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

function makeDependencies(activeAssignment = true) {
    const session = makeSession();
    const featureWindows = [makeFeatureWindow()];
    const interpretations = [makeInterpretation()];
    const mlInferences = [makeMlInference()];
    const segments = [makeSegment()];

    return {
        history: {
            async getSession(sessionId: string) {
                return sessionId === "session-1" ? session : null;
            },
            async listSessionsForPatient(patientId: string) {
                return patientId === "patient-1" ? [session] : [];
            },
        },
        assignments: makeAssignmentLookup(activeAssignment),
        now: () => new Date("2026-06-02T11:00:00.000Z"),
        replay: {
            replay: {
                async getSession(sessionId: string) {
                    return sessionId === "session-1" ? session : null;
                },
                async listFeatureWindowsForSession() {
                    return featureWindows;
                },
                async listInterpretationsForSession() {
                    return interpretations;
                },
                async listSegmentsForSession() {
                    return segments;
                },
            },
            assignments: makeAssignmentLookup(activeAssignment),
            now: () => new Date("2026-06-02T11:00:00.000Z"),
        },
        summary: {
            summary: {
                async getSession(sessionId: string) {
                    return sessionId === "session-1" ? session : null;
                },
                async listFeatureWindowsForSession() {
                    return featureWindows;
                },
                async listInterpretationsForSession() {
                    return interpretations;
                },
                async listMlInferencesForSession() {
                    return mlInferences;
                },
            },
            assignments: makeAssignmentLookup(activeAssignment),
            now: () => new Date("2026-06-02T11:00:00.000Z"),
        },
    };
}

async function hit(url: string, headers: Record<string, string>, active = true) {
    const response = new MockResponse();

    const handled = await handleObjectiveSessionHistoryRoute(
        makeRequest(url, headers),
        response as unknown as ServerResponse,
        makeDependencies(active),
    );

    return {
        handled,
        statusCode: response.statusCode,
        body: response.json(),
        text: response.text(),
    };
}

const STAGE12_ENDPOINTS = [
    "/api/objective/history/patients/patient-1/sessions",
    "/api/objective/history/sessions/session-1",
    "/api/objective/history/sessions/session-1/replay",
    "/api/objective/history/sessions/session-1/summary",
] as const;

describe("Stage 12 objective history access regressions", () => {
    it("allows assigned clinicians across list, detail, replay, and summary endpoints", async () => {
        for (const endpoint of STAGE12_ENDPOINTS) {
            const result = await hit(endpoint, clinicianHeaders());

            expect(result.handled).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.text).toContain('"clinician_visible":true');
            expect(result.text).toContain('"patient_visible":false');
            expect(result.text).toContain('"chatbot_visible":false');
        }
    });

    it("denies patient and chatbot roles across all Stage 12 history endpoints", async () => {
        for (const endpoint of STAGE12_ENDPOINTS) {
            for (const role of ["patient", "chatbot"] as const) {
                const result = await hit(endpoint, roleHeaders(role));

                expect(result.handled).toBe(true);
                expect(result.statusCode).toBe(403);
                expect(result.text).not.toContain('"history"');
                expect(result.text).not.toContain('"replay"');
                expect(result.text).not.toContain('"summary"');
            }
        }
    });

    it("denies service and developer roles for clinician history reads", async () => {
        for (const endpoint of STAGE12_ENDPOINTS) {
            for (const role of ["service", "developer"] as const) {
                const result = await hit(endpoint, roleHeaders(role));

                expect(result.handled).toBe(true);
                expect(result.statusCode).toBe(403);
            }
        }
    });

    it("denies unassigned clinicians across list, detail, replay, and summary endpoints", async () => {
        for (const endpoint of STAGE12_ENDPOINTS) {
            const result = await hit(endpoint, clinicianHeaders(), false);

            expect(result.handled).toBe(true);
            expect(result.statusCode).toBe(403);
            expect(result.text).toContain("objective_assignment_required");
        }
    });

    it("keeps not-found responses safe", async () => {
        for (const endpoint of [
            "/api/objective/history/sessions/missing-session",
            "/api/objective/history/sessions/missing-session/replay",
            "/api/objective/history/sessions/missing-session/summary",
        ]) {
            const result = await hit(endpoint, clinicianHeaders());

            expect(result.handled).toBe(true);
            expect(result.statusCode).toBe(404);
            expect(result.text).toContain("objective_session_not_found");
            expect(result.text).not.toContain("ecg_raw");
            expect(result.text).not.toContain("risk score");
        }
    });
});
