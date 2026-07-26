import {
    createObjectiveInterpretationPersistenceInput,
    InMemoryObjectiveInterpretationRepository,
    type ObjectiveInterpretationSummaryInput,
} from "../src/interpretationStorage.js";

type DecisionInput = Parameters<
    typeof createObjectiveInterpretationPersistenceInput
>[0]["decision"];

const BASE_TRACE = {
    feature_window_id: "feature-window-1",
    feature_window_key: "simulator:session-1:segment-1:1000:1300",
    ml_inference_id: "ml-inference-1",
    model_version: "objective-ml-classical-tabular-v1",
    session_id: "session-1",
    segment_id: "segment-1",
};

function makeDecision(overrides: Partial<DecisionInput> = {}): DecisionInput {
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
        trace: BASE_TRACE,
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        },
        ...overrides,
    };
}

function makeSummary(
    overrides: Partial<ObjectiveInterpretationSummaryInput> = {},
): ObjectiveInterpretationSummaryInput {
    return {
        summary_version: "objective-summary-template-v1",
        template_id: "elevated_arousal_summary",
        title: "Elevated physiological arousal evidence",
        headline:
            "The current window shows baseline-relative elevated physiological arousal evidence.",
        detail_lines: [
            "Evidence level: moderate.",
            "Confidence: moderate_confidence.",
            "Suppression state: not_suppressed.",
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
        ...overrides,
    };
}

function makeInput(
    options: {
        interpretationKey?: string;
        decision?: DecisionInput;
        summary?: ObjectiveInterpretationSummaryInput;
    } = {},
) {
    return createObjectiveInterpretationPersistenceInput({
        ...(options.interpretationKey
            ? { interpretation_key: options.interpretationKey }
            : {}),
        decision: options.decision ?? makeDecision(),
        summary: options.summary ?? makeSummary(),
    });
}

function expectSafeSurface(payload: unknown): void {
    const serialized = JSON.stringify(payload).toLowerCase();

    for (const forbidden of [
        "chatbot_visible\":true",
        "patient_visible\":true",
        "dashboard",
        "api/",
        "text/event-stream",
        "eventsource",
        "server-sent",
        "diagnosis",
        "risk_score",
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

describe("objective interpretation persistence regression and safety boundary", () => {
    it("persists each allowed interpretation label without patient or chatbot visibility", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        const labels = [
            "baseline_or_low_arousal_evidence",
            "elevated_physiological_arousal_evidence",
            "recovery_cooldown_evidence",
            "insufficient_reliable_data",
            "suppressed_for_quality",
            "motion_confounded_evidence",
            "signal_conflict_uncertain",
        ] as const;

        for (const label of labels) {
            const record = await repository.saveInterpretation(
                makeInput({
                    interpretationKey: `feature-window-${label}:objective-interpretation-v1`,
                    decision: makeDecision({
                        interpretation_label: label,
                        trace: {
                            ...BASE_TRACE,
                            feature_window_id: `feature-window-${label}`,
                        },
                    }),
                }),
            );

            expect(record.interpretation_label).toBe(label);
            expect(record.clinician_visible).toBe(true);
            expect(record.patient_visible).toBe(false);
            expect(record.chatbot_visible).toBe(false);
            expectSafeSurface(record);
        }

        expect(await repository.listAllInterpretations()).toHaveLength(
            labels.length,
        );
    });

    it("persists suppressed decisions with none evidence and safe summaries", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        const record = await repository.saveInterpretation(
            makeInput({
                decision: makeDecision({
                    interpretation_label: "suppressed_for_quality",
                    evidence_level: "none",
                    confidence_label: "insufficient_confidence",
                    suppression_state: "suppressed_low_quality",
                    uncertainty_reasons: ["low_or_insufficient_signal_quality"],
                }),
                summary: makeSummary({
                    template_id: "quality_suppressed_summary",
                    title: "Suppressed because signal quality is limited",
                    headline:
                        "This window should not be used for evidence because signal quality is limited.",
                    rendered_summary_text:
                        "Suppressed because signal quality is limited\n\nThis window should not be used for evidence because signal quality is limited.",
                }),
            }),
        );

        expect(record.evidence_level).toBe("none");
        expect(record.confidence_label).toBe("insufficient_confidence");
        expect(record.suppression_state).toBe("suppressed_low_quality");
        expect(record.summary_payload?.template_id).toBe(
            "quality_suppressed_summary",
        );
        expectSafeSurface(record);
    });

    it("rejects unsafe visibility in decision payload or summary payload", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretation(
                makeInput({
                    decision: makeDecision({
                        visibility: {
                            clinician_visible: true,
                            patient_visible: true,
                            chatbot_visible: false,
                        },
                    }),
                }),
            ),
        ).rejects.toThrow("forbidden");

        await expect(
            repository.saveInterpretation(
                makeInput({
                    summary: makeSummary({
                        visibility: {
                            clinician_visible: true,
                            patient_visible: false,
                            chatbot_visible: true as false,
                        },
                    }),
                }),
            ),
        ).rejects.toThrow("chatbot_visible must remain false");
    });

    it("rejects forbidden clinical wording in decision and summary surfaces", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await expect(
            repository.saveInterpretation(
                makeInput({
                    decision: makeDecision({
                        unsafe_text: "diagnosis",
                    }),
                }),
            ),
        ).rejects.toThrow("forbidden");

        await expect(
            repository.saveInterpretation(
                makeInput({
                    summary: makeSummary({
                        rendered_summary_text: "This includes treatment advice.",
                    }),
                }),
            ),
        ).rejects.toThrow("forbidden");
    });

    it("preserves immutable defensive copies across list and fetch calls", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        const saved = await repository.saveInterpretation(makeInput());
        expect(saved.summary_payload).toBeDefined();

        if (!saved.summary_payload) {
            throw new Error("summary_payload should be present");
        }

        saved.summary_payload.title = "mutated";
        saved.decision_payload.interpretation_label = "insufficient_reliable_data";

        const fetched = await repository.getInterpretationByKey(
            "feature-window-1:objective-interpretation-v1",
        );
        const listed = await repository.listInterpretationsForSession({
            session_id: "session-1",
        });

        expect(fetched?.summary_payload?.title).toBe(
            "Elevated physiological arousal evidence",
        );
        expect(fetched?.decision_payload.interpretation_label).toBe(
            "elevated_physiological_arousal_evidence",
        );
        expect(listed[0].summary_payload?.title).toBe(
            "Elevated physiological arousal evidence",
        );
        expectSafeSurface(fetched);
        expectSafeSurface(listed);
    });

    it("keeps session segment and feature-window listing stable", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();

        await repository.saveInterpretations([
            makeInput(),
            makeInput({
                interpretationKey: "feature-window-2:objective-interpretation-v1",
                decision: makeDecision({
                    trace: {
                        ...BASE_TRACE,
                        feature_window_id: "feature-window-2",
                        segment_id: "segment-2",
                    },
                }),
            }),
            makeInput({
                interpretationKey: "other-session:objective-interpretation-v1",
                decision: makeDecision({
                    trace: {
                        ...BASE_TRACE,
                        feature_window_id: "feature-window-other",
                        session_id: "session-2",
                    },
                }),
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

    it("does not create route dashboard streaming patient or chatbot state", async () => {
        const repository = new InMemoryObjectiveInterpretationRepository();
        const record = await repository.saveInterpretation(makeInput());

        expectSafeSurface(record);
        expect(JSON.stringify(record).toLowerCase()).not.toContain("supabase");
        expect(JSON.stringify(record).toLowerCase()).not.toContain("insert");
        expect(JSON.stringify(record).toLowerCase()).not.toContain("websocket");
    });
});
