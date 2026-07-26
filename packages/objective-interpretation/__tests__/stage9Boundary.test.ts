import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  mapObjectiveInterpretation,
  OBJECTIVE_INTERPRETATION_LABELS,
  OBJECTIVE_INTERPRETATION_TARGET,
  type ObjectiveInterpretationMapperInput
} from "../src/index.js";

function makeSafeInput(): ObjectiveInterpretationMapperInput {
  return {
    feature_window: {
      feature_window_id: "feature-window-1",
      feature_window_key: "simulator:session-1:segment-1:1000:1300",
      session_id: "session-1",
      segment_id: "segment-1",
      source_type: "simulator",
      window_status: "ready",
      suppression_state: "not_suppressed",
      quality: {},
      missingness: {},
      modality_availability: {},
      features: {
        ecg: {
          suppression: {
            suppressed: false,
            reasons: []
          }
        },
        gsr: {
          suppression: {
            suppressed: false,
            reasons: []
          }
        }
      },
      baseline_relative: {
        baseline_state: "available",
        readiness_confidence_modifier: 1
      },
      cross_signal: {
        signal_conflict_score: 0,
        high_motion_confound_present: false
      },
      uncertainty_reasons: [],
      visibility: {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      }
    },
    ml_inference: {
      ml_inference_id: "ml-inference-1",
      model_version: "objective-ml-classical-tabular-v1",
      target: OBJECTIVE_INTERPRETATION_TARGET,
      predicted_class: "elevated_arousal_evidence",
      confidence_label: "moderate_confidence",
      probability: 0.72,
      uncertainty_reasons: ["hr_above_baseline", "gsr_above_baseline"],
      suppression_state: "not_suppressed",
      visibility: {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      }
    },
    artifact_state: {
      source_banner: "simulated_data",
      model_loaded: true
    }
  };
}

describe("Stage 9 interpretation boundary", () => {
  it("uses only allowed safe interpretation labels", () => {
    const decision = mapObjectiveInterpretation(makeSafeInput());

    expect(OBJECTIVE_INTERPRETATION_LABELS).toContain(decision.interpretation_label);
    expect(decision.target).toBe(OBJECTIVE_INTERPRETATION_TARGET);
  });

  it("keeps interpretation decisions clinician-only", () => {
    const decision = mapObjectiveInterpretation(makeSafeInput());

    expect(decision.visibility).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    });

    const serialized = JSON.stringify(decision);

    expect(serialized).not.toContain('patient_visible":true');
    expect(serialized).not.toContain('chatbot_visible":true');
  });

  it("does not create template text, dashboard events, routes, or persistence", () => {
    const decision = mapObjectiveInterpretation(makeSafeInput());
    const serialized = JSON.stringify(decision).toLowerCase();

    expect(serialized).not.toContain("summary_text");
    expect(serialized).not.toContain("template");
    expect(serialized).not.toContain("dashboard");
    expect(serialized).not.toContain("route");
    expect(serialized).not.toContain("persist");
    expect(serialized).not.toContain("insert");
    expect(serialized).not.toContain("supabase");
  });

  it("does not emit forbidden clinical labels or claims", () => {
    const decision = mapObjectiveInterpretation(makeSafeInput());
    const serialized = JSON.stringify(decision);
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
        path: "packages/objective-interpretation/src/mapper.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
