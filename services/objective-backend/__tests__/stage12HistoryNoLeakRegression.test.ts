import fs from "fs";
import path from "path";
import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveInterpretationRecord } from "../src/interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "../src/mlInferenceStorage.js";
import {
    serializeObjectiveSessionHistoryDetail,
    serializeObjectiveSessionHistoryListItem,
} from "../src/sessionHistory.js";
import { buildObjectiveSessionReplayPayload } from "../src/sessionReplay.js";
import { buildObjectiveFinalSessionSummary } from "../src/sessionSummary.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";
import type { ObjectiveSegmentRecord } from "../src/segmentManager.js";

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
            internal_feature_not_directly_summarized: 1,
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

function expectNoUnsafeStage12Output(value: unknown): void {
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
        "risk score",
        "relapse",
        "craving",
        "withdrawal",
        "intoxication",
        "diagnosis",
        "clinical alert",
        "treatment need",
        "detox need",
        "medication need",
        "ciwa",
        "sobriety",
        "truthfulness",
        "patient is safe",
        "patient is stable",
        "patient is lying",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

function collectFiles(directory: string): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}

function expectNoMatch(content: string, pattern: RegExp, file: string): void {
    if (pattern.test(content)) {
        throw new Error(`${file} unexpectedly matched ${pattern}`);
    }
}

describe("Stage 12 objective history no-leak regressions", () => {
    it("keeps session list and detail summaries safe", () => {
        const session = makeSession();

        const listItem = serializeObjectiveSessionHistoryListItem(session);
        const detail = serializeObjectiveSessionHistoryDetail(session);

        expect(listItem.source_banner).toBe("simulated_data");
        expect(listItem.safe_summary).toBeDefined();
        expect(listItem.quality_summary).toBeDefined();
        expect(detail.history_scope_note).toContain(
            "clinician-safe session metadata",
        );

        expectNoUnsafeStage12Output(listItem);
        expectNoUnsafeStage12Output(detail);
    });

    it("keeps replay non-live, source-bannered, versioned, and safe", async () => {
        const replay = await buildObjectiveSessionReplayPayload(
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

        expect(replay).not.toBeNull();
        if (!replay) {
            throw new Error("Expected replay");
        }

        expect(replay.replay_banner).toBe("historical_non_live_replay");
        expect(replay.replay_scope_note).toContain("historical, non-live replay");
        expect(replay.source_banner).toBe("simulated_data");
        expect(replay.chart_ready_samples).toEqual(expect.any(Array));
        expect(replay.feature_windows).toEqual(expect.any(Array));
        expect(replay.interpretation_timeline).toEqual(expect.any(Array));
        expect(replay.quality_timeline).toEqual(expect.any(Array));
        expect(replay.session_segments).toEqual(expect.any(Array));
        expect(replay.version_metadata.replay_mode).toBe("historical_non_live");
        expect(replay.version_metadata.regenerated_or_superseded_note).toContain(
            "regenerated or superseded",
        );

        expectNoUnsafeStage12Output(replay);
    });

    it("keeps final summary bounded to safe session-summary fields", async () => {
        const summary = await buildObjectiveFinalSessionSummary(
            {
                async getSession() {
                    return makeSession();
                },
                async listFeatureWindowsForSession() {
                    return [
                        makeFeatureWindow(),
                        makeFeatureWindow({
                            id: "feature-window-2",
                            feature_window_key: "session-1:31000:61000",
                            start_esp_time_ms: 31_000,
                            end_esp_time_ms: 61_000,
                            window_status: "suppressed",
                            suppression_state: "suppressed_low_quality",
                            uncertainty_reasons: ["motion_artifact"],
                            modality_availability: {
                                ecg: true,
                                gsr: false,
                                ppg: false,
                            },
                        }),
                    ];
                },
                async listInterpretationsForSession() {
                    return [
                        makeInterpretation(),
                        makeInterpretation({
                            id: "interpretation-2",
                            interpretation_key: "feature-window-2:interpretation",
                            feature_window_id: "feature-window-2",
                            feature_window_key: "session-1:31000:61000",
                            interpretation_label: "recovery_cooldown_evidence",
                            evidence_level: "low",
                            confidence_label: "low_confidence",
                            uncertainty_reasons: ["motion_artifact"],
                            created_at: "2026-06-02T10:02:01.000Z",
                        }),
                    ];
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
            throw new Error("Expected summary");
        }

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
        expect(summary.modality_availability).toEqual(expect.any(Array));
        expect(summary.major_quality_issues).toEqual([
            "Baseline context limited",
            "Motion or artifact context reduced readiness",
        ]);
        expect(summary.evidence_periods).toHaveLength(1);
        expect(summary.cooldown_periods).toHaveLength(1);
        expect(summary.version_metadata.model_versions).toEqual([
            "objective-ml-classical-v1",
        ]);

        expectNoUnsafeStage12Output(summary);
    });

    it("keeps history, replay, and summary code out of chatbot source", () => {
        const repoRoot = path.resolve(process.cwd(), "..", "..");
        const chatbotRoots = [
            path.join(repoRoot, "backend", "src", "retrieval_graph"),
            path.join(repoRoot, "backend", "src", "safety"),
            path.join(repoRoot, "backend", "src", "subjective"),
            path.join(repoRoot, "frontend", "app", "api", "chat"),
        ];

        for (const root of chatbotRoots) {
            if (!fs.existsSync(root)) {
                continue;
            }

            const files = collectFiles(root).filter((file) =>
                /\.(ts|tsx)$/.test(file),
            );

            for (const file of files) {
                const content = fs.readFileSync(file, "utf8");

                expectNoMatch(content, /sessionHistory/, file);
                expectNoMatch(content, /sessionReplay/, file);
                expectNoMatch(content, /sessionSummary/, file);
                expectNoMatch(content, /objective\/history/, file);
            }
        }
    });
});
