import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveSegmentRecord } from "../src/segmentManager.js";
import {
    buildObjectiveSessionReplayPayload,
    downsampleObjectiveReplayPoints,
} from "../src/sessionReplay.js";
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
            ppg: true,
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

describe("objective session historical replay serialization", () => {
    it("downsamples chart-ready replay points", () => {
        const points = Array.from({ length: 500 }, (_, index) => ({
            t_ms: index,
            value: index * 2,
        }));

        expect(downsampleObjectiveReplayPoints(points, 50)).toHaveLength(50);
        expect(downsampleObjectiveReplayPoints(points, 50)[0]).toEqual({
            t_ms: 0,
            value: 0,
        });
    });

    it("builds clinician-safe historical non-live replay payload", async () => {
        const payload = await buildObjectiveSessionReplayPayload(
            {
                async getSession() {
                    return makeSession();
                },
                async listFeatureWindowsForSession() {
                    return [makeFeatureWindow()];
                },
                async listInterpretationsForSession() {
                    return [makeInterpretation()];
                },
                async listSegmentsForSession() {
                    return [makeSegment()];
                },
            },
            "session-1",
            () => new Date("2026-06-02T11:00:00.000Z"),
        );

        expect(payload).not.toBeNull();
        if (!payload) {
            throw new Error("Expected replay payload");
        }

        expect(payload.replay_banner).toBe("historical_non_live_replay");
        expect(payload.replay_scope_note).toContain("historical, non-live replay");
        expect(payload.source_banner).toBe("simulated_data");
        expect(payload.chart_ready_samples.length).toBeGreaterThan(0);
        expect(payload.feature_windows).toHaveLength(1);
        expect(payload.feature_windows[0]).not.toHaveProperty("features");
        expect(payload.feature_windows[0]).not.toHaveProperty("raw_chunk_refs");
        expect(payload.interpretation_timeline).toHaveLength(1);
        expect(payload.quality_timeline).toHaveLength(1);
        expect(payload.session_segments).toHaveLength(1);
        expect(payload.version_metadata.replay_mode).toBe("historical_non_live");
        expect(payload.version_metadata.preprocessing_versions).toEqual([
            "objective-preprocessing-v1",
        ]);
        expect(payload.version_metadata.feature_schema_versions).toEqual([
            "objective-feature-schema-v1",
        ]);
        expect(payload.version_metadata.interpretation_versions).toEqual([
            "objective-interpretation-v1",
        ]);
        expect(payload.version_metadata.regenerated_or_superseded_note).toContain(
            "regenerated or superseded",
        );
        expect(payload.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });

        expectNoUnsafeReplayOutput(payload);
    });

    it("returns null for missing session", async () => {
        await expect(
            buildObjectiveSessionReplayPayload(
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
                    async listSegmentsForSession() {
                        return [];
                    },
                },
                "missing-session",
            ),
        ).resolves.toBeNull();
    });
});
