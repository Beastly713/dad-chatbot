import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "../src/mlInferenceStorage.js";
import {
    buildObjectiveFinalSessionSummary,
    summarizeObjectiveTechnicalReason,
} from "../src/sessionSummary.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";

function makeSession(): ObjectiveSessionRecord {
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
        uncertainty_reasons: ["motion artifact detected"],
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

describe("objective final session summary generation", () => {
    it("maps technical reasons into bounded clinician-safe labels", () => {
        expect(summarizeObjectiveTechnicalReason("baseline context limited")).toBe(
            "Baseline context limited",
        );
        expect(summarizeObjectiveTechnicalReason("relapse risk high")).toBe(
            "Technical limitation recorded",
        );
        expect(summarizeObjectiveTechnicalReason("poor signal quality")).toBe(
            "Signal quality limitation",
        );
    });

    it("builds clinician-safe final summary from session records", async () => {
        const featureWindows = [
            makeFeatureWindow({
                id: "feature-window-1",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 31_000,
                preprocessing_version: "objective-preprocessing-v1",
                feature_schema_version: "objective-feature-schema-v1",
                uncertainty_reasons: ["baseline context limited"],
            }),
            makeFeatureWindow({
                id: "feature-window-2",
                feature_window_key: "session-1:31000:61000",
                start_esp_time_ms: 31_000,
                end_esp_time_ms: 61_000,
                window_status: "suppressed",
                suppression_state: "suppressed_motion_confound",
                preprocessing_version: "objective-preprocessing-v2",
                feature_schema_version: "objective-feature-schema-v1",
                modality_availability: {
                    ecg: true,
                    gsr: false,
                    ppg: false,
                },
                uncertainty_reasons: ["motion artifact detected"],
            }),
            makeFeatureWindow({
                id: "feature-window-3",
                feature_window_key: "session-1:61000:91000",
                start_esp_time_ms: 61_000,
                end_esp_time_ms: 91_000,
                window_status: "insufficient_data",
                suppression_state: "not_suppressed",
                modality_availability: {
                    ecg: false,
                    gsr: false,
                    ppg: false,
                },
                uncertainty_reasons: ["missing signal context"],
            }),
        ];

        const interpretations = [
            makeInterpretation({
                id: "interpretation-1",
                feature_window_id: "feature-window-1",
                interpretation_label: "elevated_physiological_arousal_evidence",
                interpretation_version: "objective-interpretation-v1",
                created_at: "2026-06-02T10:01:01.000Z",
            }),
            makeInterpretation({
                id: "interpretation-2",
                interpretation_key: "feature-window-2:interpretation",
                feature_window_id: "feature-window-2",
                interpretation_label: "recovery_cooldown_evidence",
                interpretation_version: "objective-interpretation-v2",
                evidence_level: "low",
                confidence_label: "low_confidence",
                uncertainty_reasons: ["cross signal agreement limited"],
                contributing_modalities: ["ECG"],
                created_at: "2026-06-02T10:02:01.000Z",
            }),
        ];

        const summary = await buildObjectiveFinalSessionSummary(
            {
                async getSession() {
                    return makeSession();
                },
                async listFeatureWindowsForSession() {
                    return featureWindows;
                },
                async listInterpretationsForSession() {
                    return interpretations;
                },
                async listMlInferencesForSession() {
                    return [makeMlInference()];
                },
            },
            "session-1",
            () => new Date("2026-06-02T11:00:00.000Z"),
        );

        expect(summary).not.toBeNull();
        if (!summary) {
            throw new Error("Expected session summary");
        }

        expect(summary.summary_scope_note).toContain("clinician-only");
        expect(summary.summary_scope_note).toContain("non-diagnostic");
        expect(summary.total_windows).toBe(3);
        expect(summary.interpretable_fraction).toEqual({
            numerator: 1,
            denominator: 3,
            fraction: 1 / 3,
        });
        expect(summary.suppressed_fraction).toEqual({
            numerator: 1,
            denominator: 3,
            fraction: 1 / 3,
        });
        expect(summary.modality_availability).toEqual([
            {
                modality: "ecg",
                available_windows: 2,
                total_windows: 3,
                fraction_available: 2 / 3,
            },
            {
                modality: "gsr",
                available_windows: 1,
                total_windows: 3,
                fraction_available: 1 / 3,
            },
            {
                modality: "ppg",
                available_windows: 0,
                total_windows: 3,
                fraction_available: 0,
            },
        ]);
        expect(summary.major_quality_issues).toEqual([
            "Baseline context limited",
            "Cross-signal agreement limitation",
            "Missingness or unavailable signal context",
            "Motion or artifact context reduced readiness",
        ]);
        expect(summary.evidence_periods).toEqual([
            expect.objectContaining({
                interpretation_id: "interpretation-1",
                feature_window_id: "feature-window-1",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 31_000,
            }),
        ]);
        expect(summary.cooldown_periods).toEqual([
            expect.objectContaining({
                interpretation_id: "interpretation-2",
                feature_window_id: "feature-window-2",
                start_esp_time_ms: 31_000,
                end_esp_time_ms: 61_000,
            }),
        ]);
        expect(summary.version_metadata).toEqual({
            summary_schema_version: "objective-final-session-summary-v1",
            preprocessing_versions: [
                "objective-preprocessing-v1",
                "objective-preprocessing-v2",
            ],
            feature_schema_versions: ["objective-feature-schema-v1"],
            interpretation_versions: [
                "objective-interpretation-v1",
                "objective-interpretation-v2",
            ],
            model_versions: ["objective-ml-classical-tabular-v1"],
            generated_at: "2026-06-02T11:00:00.000Z",
            regenerated_or_superseded_note:
                "If summary inputs are regenerated or superseded later, compare version metadata before comparing results.",
        });
        expect(summary.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
        expectNoUnsafeSummaryOutput(summary);
    });

    it("returns null for missing session", async () => {
        await expect(
            buildObjectiveFinalSessionSummary(
                {
                    async getSession() {
                        return null;
                    },
                    async listFeatureWindowsForSession() {
                        return [];
                    },
                    async listInterpretationsForSession() {
                        return [];
                    },
                    async listMlInferencesForSession() {
                        return [];
                    },
                },
                "missing-session",
            ),
        ).resolves.toBeNull();
    });
});
