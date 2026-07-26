import {
    OBJECTIVE_ML_ALLOWED_CLASSES,
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlClass,
    type ObjectiveMlInferenceRequest,
    type ObjectiveMlInferenceResponse,
} from "../src/mlInferenceContract.js";
import { HttpObjectiveMlClient } from "../src/mlInferenceClient.js";
import {
    InMemoryObjectiveMlInferenceRepository,
    createObjectiveMlInferencePersistenceInput,
} from "../src/mlInferenceStorage.js";

function makeResponse(
    predictedClass: ObjectiveMlClass,
    overrides: Partial<ObjectiveMlInferenceResponse> = {},
): ObjectiveMlInferenceResponse {
    const insufficient = predictedClass === "insufficient_reliable_data";
    const response = {
        target: OBJECTIVE_ML_ALLOWED_TARGET,
        predicted_class: predictedClass,
        confidence_label: insufficient
            ? "insufficient_confidence"
            : "moderate_confidence",
        probability: insufficient ? 0 : 0.66,
        uncertainty_reasons: insufficient
            ? ["classical_pipeline_suppressed"]
            : ["features_near_baseline"],
        suppression_state: insufficient
            ? "suppressed_missing_data"
            : "not_suppressed",
        model_version: "objective-ml-classical-tabular-v1",
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
        ...overrides,
    };

    return validateObjectiveMlInferenceResponse(response);
}

function makeServiceEnvelope(response: unknown) {
    return {
        ok: true,
        inference: response,
        db_write_enabled: false,
    };
}

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
            ecg_median_hr_delta_bpm: 0,
            gsr_tonic_baseline_deviation_delta_raw: 0,
            ppg_pulse_rate_delta_bpm: 0,
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

function expectNoUnsafeSurface(payload: unknown): void {
    const serialized = JSON.stringify(payload).toLowerCase();

    for (const forbidden of [
        'chatbot_visible":true',
        'patient_visible":true',
        "interpretation",
        "dashboard",
        "diagnosis",
        "treatment",
        "detox",
        "medication",
        "ciwa",
        "sobriety",
        "truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("objective ML inference regression safety", () => {
    it("accepts only allowlisted ML classes from validated responses", () => {
        for (const className of OBJECTIVE_ML_ALLOWED_CLASSES) {
            const response = makeResponse(className);

            expect(response.target).toBe(OBJECTIVE_ML_ALLOWED_TARGET);
            expect(response.predicted_class).toBe(className);
            expect(OBJECTIVE_ML_ALLOWED_CLASSES).toContain(response.predicted_class);
            expectNoUnsafeSurface(response);
        }
    });

    it("rejects unsupported response classes and patient or chatbot visibility", () => {
        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeResponse("low_or_baseline_arousal_evidence"),
                predicted_class: "unsupported_arousal_evidence",
            }),
        ).toThrow("predicted_class is not allowed");

        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeResponse("low_or_baseline_arousal_evidence"),
                visibility: {
                    clinician_visible: true,
                    patient_visible: true,
                    chatbot_visible: false,
                },
            }),
        ).toThrow("visibility must be clinician-only");

        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeResponse("low_or_baseline_arousal_evidence"),
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: true,
                },
            }),
        ).toThrow("visibility must be clinician-only");
    });

    it("client validates each allowed ML class envelope", async () => {
        for (const className of OBJECTIVE_ML_ALLOWED_CLASSES) {
            const response = makeResponse(className);
            const client = new HttpObjectiveMlClient({
                base_url: "http://127.0.0.1:8091",
                fetch_impl: jest.fn(async () => {
                    return new Response(JSON.stringify(makeServiceEnvelope(response)), {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    });
                }),
            });

            await expect(client.infer(makeRequest())).resolves.toEqual(response);
        }
    });

    it("storage persists only validated clinician-only ML records for each allowed class", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository(
            () => new Date("2026-06-04T00:00:00.000Z"),
        );

        for (const className of OBJECTIVE_ML_ALLOWED_CLASSES) {
            const response = makeResponse(className);
            const record = await repository.saveMlInference(
                createObjectiveMlInferencePersistenceInput({
                    inference_key: `feature-window-${className}:objective-ml-classical-tabular-v1`,
                    feature_window_id: `feature-window-${className}`,
                    session_id: "session-1",
                    response,
                    request_metadata: {
                        request_id: `request-${className}`,
                    },
                }),
            );

            expect(record.predicted_class).toBe(className);
            expect(record.clinician_visible).toBe(true);
            expect(record.patient_visible).toBe(false);
            expect(record.chatbot_visible).toBe(false);
            expectNoUnsafeSurface(record);
        }

        expect(await repository.listAllMlInferences()).toHaveLength(
            OBJECTIVE_ML_ALLOWED_CLASSES.length,
        );
    });

    it("storage rejects records when summary fields do not match validated response", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();
        const response = makeResponse("elevated_arousal_evidence");
        const input = createObjectiveMlInferencePersistenceInput({
            feature_window_id: "feature-window-1",
            session_id: "session-1",
            response,
        });

        await expect(
            repository.saveMlInference({
                ...input,
                predicted_class: "recovery_cooldown",
            }),
        ).rejects.toThrow("predicted_class must match");

        await expect(
            repository.saveMlInference({
                ...input,
                confidence_label: "low_confidence",
            }),
        ).rejects.toThrow("confidence_label must match");

        await expect(
            repository.saveMlInference({
                ...input,
                suppression_state: "suppressed_missing_data",
            }),
        ).rejects.toThrow("suppression_state must match");
    });

    it("client rejects service envelopes that attempt unsafe surfaces", async () => {
        const client = new HttpObjectiveMlClient({
            base_url: "http://127.0.0.1:8091",
            fetch_impl: jest.fn(async () => {
                return new Response(
                    JSON.stringify(
                        makeServiceEnvelope({
                            ...makeResponse("low_or_baseline_arousal_evidence"),
                            visibility: {
                                clinician_visible: true,
                                patient_visible: false,
                                chatbot_visible: true,
                            },
                        }),
                    ),
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

    it("does not create interpretation dashboard patient or chatbot state", async () => {
        const response = makeResponse("low_or_baseline_arousal_evidence");
        const repository = new InMemoryObjectiveMlInferenceRepository();
        const record = await repository.saveMlInference(
            createObjectiveMlInferencePersistenceInput({
                feature_window_id: "feature-window-1",
                session_id: "session-1",
                response,
            }),
        );

        expectNoUnsafeSurface(response);
        expectNoUnsafeSurface(record);
    });
});
