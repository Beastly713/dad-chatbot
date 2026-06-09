import {
  createObjectiveInterpretationSummary,
  type ObjectiveInterpretationDecision
} from "../src/index.js";

function makeDecision(
  overrides: Partial<ObjectiveInterpretationDecision> = {}
): ObjectiveInterpretationDecision {
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
      segment_id: "segment-1"
    },
    visibility: {
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    },
    ...overrides
  };
}

describe("objective interpretation safe summary templates", () => {
  it("renders elevated arousal summary from deterministic template", () => {
    const summary = createObjectiveInterpretationSummary(makeDecision());

    expect(summary).toEqual(
      expect.objectContaining({
        summary_version: "objective-summary-template-v1",
        template_id: "elevated_arousal_summary",
        interpretation_label: "elevated_physiological_arousal_evidence",
        evidence_level: "moderate",
        confidence_label: "moderate_confidence",
        suppression_state: "not_suppressed",
        visibility: {
          clinician_visible: true,
          patient_visible: false,
          chatbot_visible: false
        }
      })
    );

    expect(summary.title).toBe("Elevated physiological arousal evidence");
    expect(summary.headline).toContain(
      "baseline-relative elevated physiological arousal evidence"
    );
    expect(summary.rendered_summary_text).toContain("Details:");
    expect(summary.rendered_summary_text).toContain("Cautions:");
    expect(summary.rendered_summary_text).toContain("Review focus:");
  });

  it("renders baseline or low arousal summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "baseline_or_low_arousal_evidence",
        evidence_level: "moderate",
        uncertainty_reasons: ["features_near_baseline"]
      })
    );

    expect(summary.template_id).toBe("baseline_or_low_arousal_summary");
    expect(summary.headline).toContain("baseline or low-arousal pattern");
  });

  it("renders recovery cooldown summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "recovery_cooldown_evidence",
        evidence_level: "low",
        confidence_label: "low_confidence",
        uncertainty_reasons: ["hr_below_baseline", "gsr_below_baseline"]
      })
    );

    expect(summary.template_id).toBe("recovery_cooldown_summary");
    expect(summary.title).toBe("Recovery or cooldown evidence");
  });

  it("renders insufficient reliable data summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "insufficient_reliable_data",
        evidence_level: "none",
        confidence_label: "insufficient_confidence",
        suppression_state: "suppressed_missing_data",
        uncertainty_reasons: ["ml_inference_unavailable"]
      })
    );

    expect(summary.template_id).toBe("insufficient_data_summary");
    expect(summary.caution_lines).toEqual(
      expect.arrayContaining(["The suppression state should limit use of this window."])
    );
  });

  it("renders quality suppression summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "suppressed_for_quality",
        evidence_level: "none",
        confidence_label: "insufficient_confidence",
        suppression_state: "suppressed_low_quality",
        excluded_modalities: ["ecg"],
        uncertainty_reasons: ["low_or_insufficient_signal_quality"]
      })
    );

    expect(summary.template_id).toBe("quality_suppressed_summary");
    expect(summary.title).toBe("Suppressed because signal quality is limited");
    expect(summary.rendered_summary_text).toContain("Excluded modalities: ecg.");
  });

  it("renders motion-confounded summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "motion_confounded_evidence",
        evidence_level: "none",
        confidence_label: "insufficient_confidence",
        suppression_state: "suppressed_motion_confound",
        uncertainty_reasons: ["motion_confound_present"]
      })
    );

    expect(summary.template_id).toBe("motion_confounded_summary");
    expect(summary.review_focus).toEqual(
      expect.arrayContaining([
        "Review motion context before relying on the physiological pattern."
      ])
    );
  });

  it("renders signal-conflict summary", () => {
    const summary = createObjectiveInterpretationSummary(
      makeDecision({
        interpretation_label: "signal_conflict_uncertain",
        evidence_level: "none",
        confidence_label: "insufficient_confidence",
        suppression_state: "suppressed_signal_conflict",
        uncertainty_reasons: ["signal_conflict_high"]
      })
    );

    expect(summary.template_id).toBe("signal_conflict_summary");
    expect(summary.review_focus).toEqual(
      expect.arrayContaining(["Review cross-signal disagreement before using this window."])
    );
  });

  it("rejects non-clinician-only decision visibility", () => {
    expect(() =>
      createObjectiveInterpretationSummary(
        makeDecision({
          visibility: {
            clinician_visible: true,
            patient_visible: true as false,
            chatbot_visible: false
          }
        })
      )
    ).toThrow("clinician-only");

    expect(() =>
      createObjectiveInterpretationSummary(
        makeDecision({
          visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: true as false
          }
        })
      )
    ).toThrow("clinician-only");
  });

  it("is deterministic for the same decision", () => {
    const decision = makeDecision();

    expect(createObjectiveInterpretationSummary(decision)).toEqual(
      createObjectiveInterpretationSummary(decision)
    );
  });
});
