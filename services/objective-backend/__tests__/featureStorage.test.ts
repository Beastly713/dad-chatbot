import {
    InMemoryObjectiveFeatureWindowRepository,
    type ObjectiveFeatureWindowPersistenceInput,
} from "../src/featureStorage.js";

function makeFeatureWindowInput(
    overrides: Partial<ObjectiveFeatureWindowPersistenceInput> = {},
): ObjectiveFeatureWindowPersistenceInput {
    return {
        feature_window_key: "simulator:session-1:segment-1:1000:1300",
        session_id: "session-1",
        segment_id: "segment-1",
        source_type: "simulator",
        start_esp_time_ms: 1000,
        end_esp_time_ms: 1300,
        start_pc_timestamp: "2026-05-30T13:56:10.000Z",
        end_pc_timestamp: "2026-05-30T13:56:10.300Z",
        raw_batch_id: "raw-batch-1",
        raw_chunk_refs: ["raw-chunk-1"],
        raw_range_refs: {
            first_global_frame_index: 0,
            last_global_frame_index: 2,
            first_esp_time_ms: 1000,
            last_esp_time_ms: 1200,
            frame_count: 3,
        },
        preprocessing_version: "objective-preprocessing-v1",
        feature_schema_version: "objective-feature-window-foundation-v1",
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: {
            window_frame_count: 3,
            expected_frame_count: 3,
            timing_gap_count: 0,
        },
        missingness: {
            ecg: {
                expected_sample_count: 3,
                present_sample_count: 3,
            },
        },
        modality_availability: {
            ecg: {
                state: "available",
            },
        },
        features: {
            ecg: {
                modality: "ecg",
                median_hr_bpm: 75,
            },
        },
        baseline_relative: {
            baseline_state: "available",
            readiness_confidence_modifier: 1,
        },
        uncertainty_reasons: [],
        ...overrides,
    };
}

describe("objective feature window storage", () => {
    it("persists a clinician-only feature window with version and traceability metadata", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository(
            () => new Date("2026-06-04T00:00:00.000Z"),
        );

        const record = await repository.saveFeatureWindow(makeFeatureWindowInput());

        expect(record).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                created_at: "2026-06-04T00:00:00.000Z",
                feature_window_key: "simulator:session-1:segment-1:1000:1300",
                session_id: "session-1",
                segment_id: "segment-1",
                source_type: "simulator",
                preprocessing_version: "objective-preprocessing-v1",
                feature_schema_version: "objective-feature-window-foundation-v1",
                raw_batch_id: "raw-batch-1",
                raw_chunk_refs: ["raw-chunk-1"],
                raw_range_refs: {
                    first_global_frame_index: 0,
                    last_global_frame_index: 2,
                    first_esp_time_ms: 1000,
                    last_esp_time_ms: 1200,
                    frame_count: 3,
                },
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        const fetched = await repository.getFeatureWindowByKey(
            "simulator:session-1:segment-1:1000:1300",
        );

        expect(fetched).toEqual(record);
    });

    it("stores feature windows immutably by unique feature_window_key", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await repository.saveFeatureWindow(makeFeatureWindowInput());

        await expect(
            repository.saveFeatureWindow(makeFeatureWindowInput()),
        ).rejects.toThrow("feature_window_key already exists");
    });

    it("saves multiple feature windows atomically when keys are unique", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        const records = await repository.saveFeatureWindows([
            makeFeatureWindowInput({
                feature_window_key: "simulator:session-1:segment-1:1000:1300",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 1300,
            }),
            makeFeatureWindowInput({
                feature_window_key: "simulator:session-1:segment-1:1300:1600",
                start_esp_time_ms: 1300,
                end_esp_time_ms: 1600,
            }),
        ]);

        expect(records).toHaveLength(2);
        expect(await repository.listAllFeatureWindows()).toHaveLength(2);
    });

    it("rejects duplicate keys within one batch without partial persistence", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await expect(
            repository.saveFeatureWindows([
                makeFeatureWindowInput({
                    feature_window_key: "duplicate-key",
                }),
                makeFeatureWindowInput({
                    feature_window_key: "duplicate-key",
                    start_esp_time_ms: 1300,
                    end_esp_time_ms: 1600,
                }),
            ]),
        ).rejects.toThrow("feature_window_key values must be unique");

        expect(await repository.listAllFeatureWindows()).toHaveLength(0);
    });

    it("lists feature windows for a session in time order", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await repository.saveFeatureWindows([
            makeFeatureWindowInput({
                feature_window_key: "window-2",
                start_esp_time_ms: 1300,
                end_esp_time_ms: 1600,
            }),
            makeFeatureWindowInput({
                feature_window_key: "window-1",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 1300,
            }),
            makeFeatureWindowInput({
                feature_window_key: "other-session-window",
                session_id: "session-2",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 1300,
            }),
        ]);

        const sessionWindows = await repository.listFeatureWindowsForSession({
            session_id: "session-1",
        });

        expect(sessionWindows.map((window) => window.feature_window_key)).toEqual([
            "window-1",
            "window-2",
        ]);
    });

    it("filters feature windows by segment", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await repository.saveFeatureWindows([
            makeFeatureWindowInput({
                feature_window_key: "segment-1-window",
                segment_id: "segment-1",
            }),
            makeFeatureWindowInput({
                feature_window_key: "segment-2-window",
                segment_id: "segment-2",
            }),
        ]);

        const segmentWindows = await repository.listFeatureWindowsForSession({
            session_id: "session-1",
            segment_id: "segment-2",
        });

        expect(segmentWindows.map((window) => window.feature_window_key)).toEqual([
            "segment-2-window",
        ]);
    });

    it("returns defensive copies so saved records cannot be mutated externally", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        const saved = await repository.saveFeatureWindow(makeFeatureWindowInput());
        saved.features.ecg = {
            modality: "ecg",
            median_hr_bpm: 999,
        };

        const fetched = await repository.getFeatureWindowByKey(
            "simulator:session-1:segment-1:1000:1300",
        );

        expect(fetched?.features).toEqual({
            ecg: {
                modality: "ecg",
                median_hr_bpm: 75,
            },
        });
    });

    it("rejects invalid feature-window visibility", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await expect(
            repository.saveFeatureWindow({
                ...makeFeatureWindowInput(),
                patient_visible: true as false,
            }),
        ).rejects.toThrow("patient_visible must remain false");

        await expect(
            repository.saveFeatureWindow({
                ...makeFeatureWindowInput(),
                chatbot_visible: true as false,
            }),
        ).rejects.toThrow("chatbot_visible must remain false");
    });

    it("rejects invalid feature-window shape before persistence", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        await expect(
            repository.saveFeatureWindow(
                makeFeatureWindowInput({
                    feature_window_key: "",
                }),
            ),
        ).rejects.toThrow("feature_window_key must be a non-empty string");

        await expect(
            repository.saveFeatureWindow(
                makeFeatureWindowInput({
                    end_esp_time_ms: 900,
                }),
            ),
        ).rejects.toThrow("end_esp_time_ms must be greater than or equal");

        await expect(
            repository.saveFeatureWindow(
                makeFeatureWindowInput({
                    preprocessing_version: "",
                }),
            ),
        ).rejects.toThrow("preprocessing_version must be a non-empty string");

        await expect(
            repository.saveFeatureWindow(
                makeFeatureWindowInput({
                    raw_range_refs: [] as never,
                }),
            ),
        ).rejects.toThrow("raw_range_refs must be a JSON object");

        await expect(
            repository.saveFeatureWindow(
                makeFeatureWindowInput({
                    uncertainty_reasons: ["baseline_unavailable", 123 as never],
                }),
            ),
        ).rejects.toThrow("uncertainty_reasons must be an array of strings");
    });

    it("does not create ML, interpretation, dashboard, patient, or chatbot output", async () => {
        const repository = new InMemoryObjectiveFeatureWindowRepository();

        const record = await repository.saveFeatureWindow(makeFeatureWindowInput());
        const serialized = JSON.stringify(record).toLowerCase();

        expect(serialized).not.toContain("predicted_class");
        expect(serialized).not.toContain("interpretation");
        expect(serialized).not.toContain("dashboard");
        expect(serialized).not.toContain("model_version");
        expect(serialized).not.toContain("chatbot_visible\":true");
        expect(serialized).not.toContain("patient_visible\":true");
    });
});
