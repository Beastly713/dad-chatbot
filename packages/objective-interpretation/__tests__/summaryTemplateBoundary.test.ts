import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  createObjectiveInterpretationSummary,
  type ObjectiveInterpretationDecision
} from "../src/index.js";

function makeDecision(): ObjectiveInterpretationDecision {
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
      ml_inference_id: "ml-inference-1",
      model_version: "objective-ml-classical-tabular-v1",
      session_id: "session-1"
    },
    visibility: {
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    }
  };
}

describe("safe summary template boundary", () => {
  it("keeps rendered summary clinician-only", () => {
    const summary = createObjectiveInterpretationSummary(makeDecision());

    expect(summary.visibility).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    });

    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain('patient_visible":true');
    expect(serialized).not.toContain('chatbot_visible":true');
  });

  it("does not create routes persistence dashboard or chatbot state", () => {
    const summary = createObjectiveInterpretationSummary(makeDecision());
    const serialized = JSON.stringify(summary).toLowerCase();

    for (const forbidden of [
      "api/",
      "route",
      "dashboard",
      "persist",
      "insert",
      "supabase",
      "websocket",
      "text/event-stream",
      "eventsource",
      "server-sent",
      'chatbot_visible":true',
      'patient_visible":true'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not emit forbidden clinical or unsafe labels", () => {
    const summary = createObjectiveInterpretationSummary(makeDecision());
    const serialized = JSON.stringify(summary);
    const lower = serialized.toLowerCase();

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    for (const forbiddenPhrase of [
      "craving",
      "relapse",
      "withdrawal",
      "intoxication",
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
      "emergency",
      "alert"
    ]) {
      expect(lower).not.toContain(forbiddenPhrase);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-interpretation/src/summaryTemplates.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("uses bounded template text, not model-generated freeform copy", () => {
    const first = createObjectiveInterpretationSummary(makeDecision());
    const second = createObjectiveInterpretationSummary(makeDecision());

    expect(first.rendered_summary_text).toBe(second.rendered_summary_text);
    expect(first.rendered_summary_text).toContain(
      "Use this as bounded physiological evidence for clinician review."
    );
    expect(first.rendered_summary_text).toContain(
      "Do not treat this output as a standalone determination."
    );
  });
});
