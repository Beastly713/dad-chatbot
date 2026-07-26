import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    type ObjectiveMlInferenceResponse,
} from "../src/mlInferenceContract.js";
import {
    InMemoryObjectiveMlInferenceRepository,
    createObjectiveMlInferencePersistenceInput,
} from "../src/mlInferenceStorage.js";

function makeResponse(
    overrides: Partial<ObjectiveMlInferenceResponse> = {},
): ObjectiveMlInferenceResponse {
    return {
        target: OBJECTIVE_ML_ALLOWED_TARGET,
        predicted_class: "elevated_arousal_evidence",
        confidence_label: "moderate_confidence",
        probability: 0.72,
        uncertainty_reasons: ["hr_above_baseline", "gsr_above_baseline"],
        suppression_state: "not_suppressed",
        model_version: "objective-ml-classical-tabular-v1",
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
        ...overrides,
    };
}

function makeInput() {
    const response = makeResponse();

    return createObjectiveMlInferencePersistenceInput({
        feature_window_id: "feature-window-1",
        feature_window_key: "simulator:session-1:segment-1:1000:1300",
        session_id: "session-1",
        segment_id: "segment-1",
        response,
        request_metadata: {
            request_id: "request-1",
            timeout_ms: 1000,
        },
    });
}

describe("objective ML inference storage", () => {
    it("persists clinician-only validated ML inference records", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository(
            () => new Date("2026-06-04T00:00:00.000Z"),
        );

        const record = await repository.saveMlInference(makeInput());

        expect(record).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                created_at: "2026-06-04T00:00:00.000Z",
                inference_key: "feature-window-1:objective-ml-classical-tabular-v1",
                feature_window_id: "feature-window-1",
                feature_window_key: "simulator:session-1:segment-1:1000:1300",
                session_id: "session-1",
                segment_id: "segment-1",
                model_version: "objective-ml-classical-tabular-v1",
                target: OBJECTIVE_ML_ALLOWED_TARGET,
                predicted_class: "elevated_arousal_evidence",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        const fetched = await repository.getMlInferenceByKey(record.inference_key);

        expect(fetched).toEqual(record);
    });

    it("enforces immutable unique inference_key", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();

        await repository.saveMlInference(makeInput());

        await expect(repository.saveMlInference(makeInput())).rejects.toThrow(
            "inference_key already exists",
        );
    });

    it("saves multiple records atomically when keys are unique", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();

        const first = makeInput();
        const second = {
            ...makeInput(),
            inference_key: "feature-window-2:objective-ml-classical-tabular-v1",
            feature_window_id: "feature-window-2",
        };

        const records = await repository.saveMlInferences([first, second]);

        expect(records).toHaveLength(2);
        expect(await repository.listAllMlInferences()).toHaveLength(2);
    });

    it("rejects duplicate keys within one save operation without partial persistence", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();

        await expect(
            repository.saveMlInferences([makeInput(), makeInput()]),
        ).rejects.toThrow("inference_key values must be unique");

        expect(await repository.listAllMlInferences()).toHaveLength(0);
    });

    it("lists records by session, segment, and feature window", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();

        await repository.saveMlInferences([
            makeInput(),
            {
                ...makeInput(),
                inference_key: "feature-window-2:objective-ml-classical-tabular-v1",
                feature_window_id: "feature-window-2",
                segment_id: "segment-2",
            },
            {
                ...makeInput(),
                inference_key: "other-session:objective-ml-classical-tabular-v1",
                feature_window_id: "other-feature-window",
                session_id: "session-2",
            },
        ]);

        expect(
            (
                await repository.listMlInferencesForSession({
                    session_id: "session-1",
                })
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-1", "feature-window-2"]);

        expect(
            (
                await repository.listMlInferencesForSession({
                    session_id: "session-1",
                    segment_id: "segment-2",
                })
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-2"]);

        expect(
            (
                await repository.listMlInferencesForFeatureWindow("feature-window-1")
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-1"]);
    });

    it("returns defensive copies", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();
        const saved = await repository.saveMlInference(makeInput());

        saved.inference_response.predicted_class = "insufficient_reliable_data";

        const fetched = await repository.getMlInferenceByKey(
            "feature-window-1:objective-ml-classical-tabular-v1",
        );

        expect(fetched?.inference_response.predicted_class).toBe(
            "elevated_arousal_evidence",
        );
    });

    it("rejects mismatched persisted fields and non-clinician visibility", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();

        await expect(
            repository.saveMlInference({
                ...makeInput(),
                predicted_class: "recovery_cooldown",
            }),
        ).rejects.toThrow("predicted_class must match");

        await expect(
            repository.saveMlInference({
                ...makeInput(),
                model_version: "different-version",
            }),
        ).rejects.toThrow("model_version must match");

        await expect(
            repository.saveMlInference({
                ...makeInput(),
                patient_visible: true as false,
            }),
        ).rejects.toThrow("patient_visible must remain false");

        await expect(
            repository.saveMlInference({
                ...makeInput(),
                chatbot_visible: true as false,
            }),
        ).rejects.toThrow("chatbot_visible must remain false");
    });

    it("does not create interpretation dashboard patient or chatbot output", async () => {
        const repository = new InMemoryObjectiveMlInferenceRepository();
        const record = await repository.saveMlInference(makeInput());
        const serialized = JSON.stringify(record).toLowerCase();

        expect(serialized).not.toContain("interpretation");
        expect(serialized).not.toContain("dashboard");
        expect(serialized).not.toContain("chatbot_visible\":true");
        expect(serialized).not.toContain("patient_visible\":true");
        expect(serialized).not.toContain("diagnosis");
        expect(serialized).not.toContain("treatment");
        expect(serialized).not.toContain("detox");
        expect(serialized).not.toContain("medication");
        expect(serialized).not.toContain("ciwa");
    });
});
