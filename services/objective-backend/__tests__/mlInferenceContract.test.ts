import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceRequest,
    validateObjectiveMlInferenceResponse,
} from "../src/mlInferenceContract.js";

function makeValidRequest() {
    return {
        request_id: "request-1",
        feature_window_id: "feature-window-1",
        session_id: "session-1",
        feature_schema_version: "objective-feature-window-foundation-v1",
        preprocessing_version: "objective-preprocessing-v1",
        features: {
            ecg: {
                median_hr_bpm: 75,
            },
        },
        baseline_relative: {
            baseline_state: "available",
        },
        quality: {
            window_status: "ready",
        },
        missingness: {
            ecg: {
                missing_fraction: 0,
            },
        },
        modality_availability: {
            ecg: {
                state: "available",
            },
        },
        cross_signal: {
            signal_conflict_score: 0,
        },
        uncertainty_reasons: [],
        timeout_ms: 1000,
    };
}

function makeValidResponse() {
    return {
        target: OBJECTIVE_ML_ALLOWED_TARGET,
        predicted_class: "insufficient_reliable_data",
        confidence_label: "insufficient_confidence",
        probability: 0,
        uncertainty_reasons: ["ml_model_not_loaded"],
        suppression_state: "suppressed_missing_data",
        model_version: "objective-ml-no-model-scaffold-v1",
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
    };
}

describe("objective ML inference contract", () => {
    it("validates ML inference requests for feature-window payloads", () => {
        const result = validateObjectiveMlInferenceRequest(makeValidRequest());

        expect(result).toEqual(
            expect.objectContaining({
                request_id: "request-1",
                feature_window_id: "feature-window-1",
                session_id: "session-1",
                timeout_ms: 1000,
            }),
        );
    });

    it("rejects ML inference requests with forbidden wording", () => {
        expect(() =>
            validateObjectiveMlInferenceRequest({
                ...makeValidRequest(),
                features: {
                    relapse_risk: "high",
                },
            }),
        ).toThrow("forbidden");
    });

    it("rejects malformed ML inference requests", () => {
        expect(() =>
            validateObjectiveMlInferenceRequest({
                ...makeValidRequest(),
                features: [],
            }),
        ).toThrow("features must be a JSON object");

        expect(() =>
            validateObjectiveMlInferenceRequest({
                ...makeValidRequest(),
                timeout_ms: 0,
            }),
        ).toThrow("timeout_ms must be a positive integer");
    });

    it("validates bounded ML inference responses", () => {
        const result = validateObjectiveMlInferenceResponse(makeValidResponse());

        expect(result).toEqual({
            target: OBJECTIVE_ML_ALLOWED_TARGET,
            predicted_class: "insufficient_reliable_data",
            confidence_label: "insufficient_confidence",
            probability: 0,
            uncertainty_reasons: ["ml_model_not_loaded"],
            suppression_state: "suppressed_missing_data",
            model_version: "objective-ml-no-model-scaffold-v1",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        });
    });

    it("rejects forbidden ML target and unsupported class", () => {
        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeValidResponse(),
                target: "unsupported_safe_target",
            }),
        ).toThrow("target is not allowed");

        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeValidResponse(),
                predicted_class: "unsupported_safe_class",
            }),
        ).toThrow("predicted_class is not allowed");
    });

    it("rejects non-clinician-only ML response visibility", () => {
        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeValidResponse(),
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: true,
                },
            }),
        ).toThrow("visibility must be clinician-only");
    });

    it("rejects probability outside [0, 1]", () => {
        expect(() =>
            validateObjectiveMlInferenceResponse({
                ...makeValidResponse(),
                probability: 1.5,
            }),
        ).toThrow("probability must be between 0 and 1");
    });
});
