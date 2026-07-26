import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    type ObjectiveMlInferenceRequest,
} from "../src/mlInferenceContract.js";
import {
    HttpObjectiveMlClient,
    createObjectiveMlInferenceRequestFromFeatureWindow,
} from "../src/mlInferenceClient.js";
import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";

function makeRequest(): ObjectiveMlInferenceRequest {
    return {
        request_id: "request-1",
        feature_window_id: "feature-window-1",
        session_id: "session-1",
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
            readiness_confidence_modifier: 1,
            ecg_median_hr_delta_bpm: 22,
            gsr_tonic_baseline_deviation_delta_raw: 50,
            ppg_pulse_rate_delta_bpm: 18,
        },
        quality: {},
        missingness: {},
        modality_availability: {},
        cross_signal: {
            signal_conflict_score: 0,
            high_motion_confound_present: false,
        },
        uncertainty_reasons: [],
        timeout_ms: 1000,
    };
}

function makeFeatureWindowRecord(): ObjectiveFeatureWindowRecord {
    return {
        id: "feature-window-1",
        created_at: "2026-06-04T00:00:00.000Z",
        feature_window_key: "simulator:session-1:segment-1:1000:1300",
        session_id: "session-1",
        segment_id: "segment-1",
        source_type: "simulator",
        start_esp_time_ms: 1000,
        end_esp_time_ms: 1300,
        raw_chunk_refs: [],
        raw_range_refs: {
            first_esp_time_ms: 1000,
            last_esp_time_ms: 1200,
            frame_count: 3,
        },
        preprocessing_version: "objective-preprocessing-v1",
        feature_schema_version: "objective-feature-window-foundation-v1",
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: {},
        missingness: {},
        modality_availability: {},
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
            readiness_confidence_modifier: 1,
            ecg_median_hr_delta_bpm: 22,
            gsr_tonic_baseline_deviation_delta_raw: 50,
            ppg_pulse_rate_delta_bpm: 18,
        },
        uncertainty_reasons: [],
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

describe("objective ML inference client", () => {
    it("builds a validated ML request from a feature-window record", () => {
        const request = createObjectiveMlInferenceRequestFromFeatureWindow(
            makeFeatureWindowRecord(),
            {
                request_id: "request-1",
                timeout_ms: 1500,
            },
        );

        expect(request).toEqual(
            expect.objectContaining({
                request_id: "request-1",
                feature_window_id: "feature-window-1",
                session_id: "session-1",
                target: OBJECTIVE_ML_ALLOWED_TARGET,
                preprocessing_version: "objective-preprocessing-v1",
                feature_schema_version: "objective-feature-window-foundation-v1",
                timeout_ms: 1500,
            }),
        );
    });

    it("posts validated requests to the ML service and validates the response", async () => {
        const calls: Array<{ url: string; init: RequestInit }> = [];

        const fetchMock = jest.fn(
            async (url: string | URL | Request, init?: RequestInit) => {
                calls.push({ url: String(url), init: init ?? {} });

                return new Response(
                    JSON.stringify({
                        ok: true,
                        inference: {
                            target: OBJECTIVE_ML_ALLOWED_TARGET,
                            predicted_class: "elevated_arousal_evidence",
                            confidence_label: "moderate_confidence",
                            probability: 0.72,
                            uncertainty_reasons: [
                                "hr_above_baseline",
                                "gsr_above_baseline",
                            ],
                            suppression_state: "not_suppressed",
                            model_version: "objective-ml-classical-tabular-v1",
                            visibility: {
                                clinician_visible: true,
                                patient_visible: false,
                                chatbot_visible: false,
                            },
                        },
                        db_write_enabled: false,
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    },
                );
            },
        );

        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            timeout_ms: 1000,
            fetch_impl: fetchMock,
        });

        const response = await client.infer(makeRequest());

        expect(response.predicted_class).toBe("elevated_arousal_evidence");
        expect(response.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(calls[0].url).toBe("http://127.0.0.1:8091/infer");
        expect(calls[0].init.method).toBe("POST");
        expect(calls[0].init.headers).toEqual({
            "content-type": "application/json",
        });

        const postedBody = JSON.parse(String(calls[0].init.body));

        expect(postedBody.target).toBe(OBJECTIVE_ML_ALLOWED_TARGET);
    });

    it("rejects invalid ML request before calling fetch", async () => {
        const fetchMock = jest.fn();
        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: fetchMock as never,
        });

        await expect(
            client.infer({
                ...makeRequest(),
                target: "unsupported_arousal_target" as never,
            }),
        ).rejects.toThrow("target is not allowed");

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects non-ok ML service responses", async () => {
        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: jest.fn(async () => {
                return new Response(JSON.stringify({ ok: false }), {
                    status: 500,
                    headers: {
                        "content-type": "application/json",
                    },
                });
            }),
        });

        await expect(client.infer(makeRequest())).rejects.toThrow(
            "ML inference request failed with HTTP 500",
        );
    });

    it("rejects malformed ML service envelopes", async () => {
        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: jest.fn(async () => {
                return new Response(
                    JSON.stringify({
                        ok: true,
                        inference: {
                            target: OBJECTIVE_ML_ALLOWED_TARGET,
                            predicted_class: "elevated_arousal_evidence",
                            confidence_label: "moderate_confidence",
                            probability: 0.72,
                            uncertainty_reasons: [],
                            suppression_state: "not_suppressed",
                            model_version: "objective-ml-classical-tabular-v1",
                            visibility: {
                                clinician_visible: true,
                                patient_visible: false,
                                chatbot_visible: true,
                            },
                        },
                        db_write_enabled: false,
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    },
                );
            }),
        });

        await expect(client.infer(makeRequest())).rejects.toThrow(
            "visibility must be clinician-only",
        );
    });

    it("rejects ML service envelopes that claim DB writes", async () => {
        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: jest.fn(async () => {
                return new Response(
                    JSON.stringify({
                        ok: true,
                        inference: {
                            target: OBJECTIVE_ML_ALLOWED_TARGET,
                            predicted_class: "insufficient_reliable_data",
                            confidence_label: "insufficient_confidence",
                            probability: 0,
                            uncertainty_reasons: ["classical_pipeline_suppressed"],
                            suppression_state: "suppressed_missing_data",
                            model_version: "objective-ml-classical-tabular-v1",
                            visibility: {
                                clinician_visible: true,
                                patient_visible: false,
                                chatbot_visible: false,
                            },
                        },
                        db_write_enabled: true,
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    },
                );
            }),
        });

        await expect(client.infer(makeRequest())).rejects.toThrow(
            "db_write_enabled false",
        );
    });

    it("does not expose patient or chatbot output in client responses", async () => {
        const fetchMock = jest.fn(async () => {
            return new Response(
                JSON.stringify({
                    ok: true,
                    inference: {
                        target: OBJECTIVE_ML_ALLOWED_TARGET,
                        predicted_class: "low_or_baseline_arousal_evidence",
                        confidence_label: "moderate_confidence",
                        probability: 0.66,
                        uncertainty_reasons: ["features_near_baseline"],
                        suppression_state: "not_suppressed",
                        model_version: "objective-ml-classical-tabular-v1",
                        visibility: {
                            clinician_visible: true,
                            patient_visible: false,
                            chatbot_visible: false,
                        },
                    },
                    db_write_enabled: false,
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                    },
                },
            );
        });

        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: fetchMock,
        });

        const response = await client.infer(makeRequest());
        const serialized = JSON.stringify(response).toLowerCase();

        expect(serialized).not.toContain("chatbot_visible\":true");
        expect(serialized).not.toContain("patient_visible\":true");
        expect(serialized).not.toContain("interpretation");
        expect(serialized).not.toContain("dashboard");
        expect(serialized).not.toContain("diagnosis");
    });
});
