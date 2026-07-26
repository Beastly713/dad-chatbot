import {
    createObjectiveInterpretationPersistenceInput,
    InMemoryObjectiveInterpretationRepository,
    type ObjectiveInterpretationSummaryInput,
} from "../src/interpretationStorage.js";

function makeDecision() {
    return {
        interpretation_version: "objective-interpretation-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        interpretation_label: "elevated_physiological_arousal_evidence",
        evidence_level: "moderate",
        confidence_label: "moderate_confidence",
        suppression_state: "not_suppressed",
        uncertainty_reasons: ["hr_above_baseline", "gsr_above_baseline"],
        contributing_modalities: ["ecg", "gsr", "ppg"],
        excluded_modalities: [],
        source_banner: "simulated_data",
        trace: {
            feature_window_id: "feature-window-1",
            feature_window_key: "simulator:session-1:segment-1:1000:1300",
            ml_inference_id: "ml-inference-1",
            model_version: "objective-ml-classical-tabular-v1",
            session_id: "session-1",
            segment_id: "segment-1",
        },
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
    };
}

function makeSummary(): ObjectiveInterpretationSummaryInput {
    return {
        summary_version: "objective-summary-template-v1",
        template_id: "elevated_arousal_summary",
        title: "Elevated physiological arousal evidence",
        headline:
            "The current window shows baseline-relative elevated physiological arousal evidence.",
        detail_lines: [
            "Evidence level: moderate.",
            "Confidence: moderate_confidence.",
        ],
        caution_lines: [
            "Use this as bounded physiological evidence for clinician review.",
            "Do not treat this output as a standalone determination.",
        ],
        review_focus: [
            "Review baseline state, signal quality, and uncertainty reasons.",
        ],
        rendered_summary_text:
            "Elevated physiological arousal evidence\n\nThe current window shows baseline-relative elevated physiological arousal evidence.",
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
    };
}

function makeInput() {
    return createObjectiveInterpretationPersistenceInput({
        decision: makeDecision(),
        summary: makeSummary(),
    });
}

describe("objective interpretation storage", () => {
    it("persists clinician-only interpretation records with summary payloads", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository(
            () => new Date("2026-06-04T00:00:00.000Z"),
        );

        const record = await repository.saveInterpretation(makeInput());

        expect(record).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                created_at: "2026-06-04T00:00:00.000Z",
                interpretation_key: "feature-window-1:objective-interpretation-v1",
                feature_window_id: "feature-window-1",
                feature_window_key: "simulator:session-1:segment-1:1000:1300",
                ml_inference_id: "ml-inference-1",
                session_id: "session-1",
                segment_id: "segment-1",
                interpretation_version: "objective-interpretation-v1",
                interpretation_label: "elevated_physiological_arousal_evidence",
                evidence_level: "moderate",
                confidence_label: "moderate_confidence",
                suppression_state: "not_suppressed",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        expect(record.summary_payload?.template_id).toBe(
            "elevated_arousal_summary",
        );

        const fetched = await repository.getInterpretationByKey(
            "feature-window-1:objective-interpretation-v1",
        );

        expect(fetched).toEqual(record);
    });

    it("enforces immutable unique interpretation keys", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await repository.saveInterpretation(makeInput());

        await expect(repository.saveInterpretation(makeInput())).rejects.toThrow(
            "interpretation_key already exists",
        );
    });

    it("saves multiple interpretations atomically when keys are unique", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        const first = makeInput();
        const second = createObjectiveInterpretationPersistenceInput({
            interpretation_key: "feature-window-2:objective-interpretation-v1",
            decision: {
                ...makeDecision(),
                trace: {
                    ...makeDecision().trace,
                    feature_window_id: "feature-window-2",
                },
            },
            summary: makeSummary(),
        });

        const records = await repository.saveInterpretations([first, second]);

        expect(records).toHaveLength(2);
        expect(await repository.listAllInterpretations()).toHaveLength(2);
    });

    it("rejects duplicate keys within one batch without partial persistence", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretations([makeInput(), makeInput()]),
        ).rejects.toThrow("interpretation_key values must be unique");

        expect(await repository.listAllInterpretations()).toHaveLength(0);
    });

    it("lists by session, segment, and feature window", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await repository.saveInterpretations([
            makeInput(),
            createObjectiveInterpretationPersistenceInput({
                interpretation_key: "feature-window-2:objective-interpretation-v1",
                decision: {
                    ...makeDecision(),
                    trace: {
                        ...makeDecision().trace,
                        feature_window_id: "feature-window-2",
                        segment_id: "segment-2",
                    },
                },
                summary: makeSummary(),
            }),
            createObjectiveInterpretationPersistenceInput({
                interpretation_key: "other-session:objective-interpretation-v1",
                decision: {
                    ...makeDecision(),
                    trace: {
                        ...makeDecision().trace,
                        feature_window_id: "other-feature-window",
                        session_id: "session-2",
                    },
                },
                summary: makeSummary(),
            }),
        ]);

        expect(
            (
                await repository.listInterpretationsForSession({
                    session_id: "session-1",
                })
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-1", "feature-window-2"]);

        expect(
            (
                await repository.listInterpretationsForSession({
                    session_id: "session-1",
                    segment_id: "segment-2",
                })
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-2"]);

        expect(
            (
                await repository.listInterpretationsForFeatureWindow(
                    "feature-window-1",
                )
            ).map((record) => record.feature_window_id),
        ).toEqual(["feature-window-1"]);
    });

    it("returns defensive copies", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();
        const saved = await repository.saveInterpretation(makeInput());

        saved.decision_payload.interpretation_label = "insufficient_reliable_data";

        const fetched = await repository.getInterpretationByKey(
            "feature-window-1:objective-interpretation-v1",
        );

        expect(fetched?.decision_payload.interpretation_label).toBe(
            "elevated_physiological_arousal_evidence",
        );
    });

    it("rejects non-clinician visibility", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                patient_visible: true as false,
            }),
        ).rejects.toThrow("patient_visible must remain false");

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                chatbot_visible: true as false,
            }),
        ).rejects.toThrow("chatbot_visible must remain false");

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                summary_payload: {
                    ...makeSummary(),
                    visibility: {
                        clinician_visible: true,
                        patient_visible: false,
                        chatbot_visible: true as false,
                    },
                },
            }),
        ).rejects.toThrow("chatbot_visible must remain false");
    });

    it("rejects invalid shape and unsupported labels", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                interpretation_key: "",
            }),
        ).rejects.toThrow("interpretation_key must be a non-empty string");

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                target: "unsupported_target",
            }),
        ).rejects.toThrow("target is not allowed");

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                interpretation_label: "unsupported_label" as never,
            }),
        ).rejects.toThrow("interpretation_label is not allowed");
    });

    it("rejects forbidden clinical or unsafe wording in records and summaries", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                decision_payload: {
                    ...makeDecision(),
                    unsafe: "relapse risk",
                },
            }),
        ).rejects.toThrow("forbidden");

        await expect(
            repository.saveInterpretation({
                ...makeInput(),
                summary_payload: {
                    ...makeSummary(),
                    rendered_summary_text: "This is a diagnosis.",
                },
            }),
        ).rejects.toThrow("forbidden");
    });

    it("does not create routes dashboard patient chatbot or persistence side effects", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();
        const record = await repository.saveInterpretation(makeInput());
        const serialized = JSON.stringify(record).toLowerCase();

        for (const forbidden of [
            "api/",
            "route",
            "dashboard",
            "websocket",
            "text/event-stream",
            "eventsource",
            "server-sent",
            "chatbot_visible\":true",
            "patient_visible\":true",
            "supabase",
            "insert into",
            "diagnosis",
            "risk_score",
            "treatment",
            "detox",
            "medication",
            "ciwa",
        ]) {
            expect(serialized).not.toContain(forbidden);
        }
    });
});
