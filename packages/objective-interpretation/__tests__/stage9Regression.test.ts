import {
  createObjectiveInterpretationSummary,
  mapObjectiveInterpretation,
  OBJECTIVE_INTERPRETATION_LABELS,
  OBJECTIVE_INTERPRETATION_TARGET,
  type ObjectiveInterpretationDecision,
  type ObjectiveInterpretationMapperInput,
  type ObjectiveMapperFeatureWindowInput,
  type ObjectiveMapperMlInferenceInput
} from "../src/index.js";

function makeFeatureWindow(
  overrides: Partial<ObjectiveMapperFeatureWindowInput> = {}
): ObjectiveMapperFeatureWindowInput {
  return {
    feature_window_id: "feature-window-1",
    feature_window_key: "simulator:session-1:segment-1:1000:1300",
    session_id: "session-1",
    segment_id: "segment-1",
    source_type: "simulator",
    window_status: "ready",
    suppression_state: "not_suppressed",
    quality: {
      window_frame_count: 100,
      expected_frame_count: 100
    },
    missingness: {},
    modality_availability: {},
    features: {
      ecg: {
        r_peak_quality_score: 0.9,
        suppression: {
          suppressed: false,
          reasons: []
        }
      },
      gsr: {
        gsr_quality_score: 0.9,
        suppression: {
          suppressed: false,
          reasons: []
        }
      },
      ppg: {
        waveform_quality_score: 0.8,
        suppression: {
          suppressed: false,
          reasons: []
        }
      },
      imu: {
        activity_like_confound_index: 0.1,
        suppression: {
          suppressed: false,
          reasons: []
        }
      },
      temperature: {
        local_temperature_quality_score: 0.9,
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
      high_motion_confound_present: false,
      motion_confound_index: 0.1
    },
    uncertainty_reasons: [],
    visibility: {
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    },
    ...overrides
  };
}

function makeMlInference(
  overrides: Partial<ObjectiveMapperMlInferenceInput> = {}
): ObjectiveMapperMlInferenceInput {
  return {
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
    },
    ...overrides
  };
}

function makeInput(
  overrides: Partial<ObjectiveInterpretationMapperInput> = {}
): ObjectiveInterpretationMapperInput {
  return {
    feature_window: makeFeatureWindow(),
    ml_inference: makeMlInference(),
    artifact_state: {
      source_banner: "simulated_data",
      model_loaded: true,
      model_version: "objective-ml-classical-tabular-v1",
      preprocessing_version: "objective-preprocessing-v1",
      feature_schema_version: "objective-feature-window-foundation-v1"
    },
    ...overrides
  };
}

function expectClinicianOnly(decision: ObjectiveInterpretationDecision): void {
  expect(decision.visibility).toEqual({
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false
  });
}

function expectSafeSurface(payload: unknown): void {
  const serialized = JSON.stringify(payload).toLowerCase();

  for (const forbidden of [
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
    "alert",
    "dashboard",
    "api/",
    "text/event-stream",
    "eventsource",
    "server-sent",
    "chatbot_visible\":true",
    "patient_visible\":true"
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe("Stage 9 interpretation regression coverage", () => {
  it("maps every ML class to an allowed safe interpretation label", () => {
    const cases: Array<{
      name: string;
      ml: ObjectiveMapperMlInferenceInput;
      expectedLabel: string;
      expectedEvidence: string;
      expectedSuppression: string;
    }> = [
      {
        name: "baseline",
        ml: makeMlInference({
          predicted_class: "low_or_baseline_arousal_evidence",
          probability: 0.66,
          uncertainty_reasons: ["features_near_baseline"]
        }),
        expectedLabel: "baseline_or_low_arousal_evidence",
        expectedEvidence: "moderate",
        expectedSuppression: "not_suppressed"
      },
      {
        name: "elevated",
        ml: makeMlInference({
          predicted_class: "elevated_arousal_evidence",
          probability: 0.72,
          uncertainty_reasons: ["hr_above_baseline", "gsr_above_baseline"]
        }),
        expectedLabel: "elevated_physiological_arousal_evidence",
        expectedEvidence: "moderate",
        expectedSuppression: "not_suppressed"
      },
      {
        name: "cooldown",
        ml: makeMlInference({
          predicted_class: "recovery_cooldown",
          probability: 0.62,
          confidence_label: "low_confidence",
          uncertainty_reasons: ["hr_below_baseline", "gsr_below_baseline"]
        }),
        expectedLabel: "recovery_cooldown_evidence",
        expectedEvidence: "low",
        expectedSuppression: "not_suppressed"
      },
      {
        name: "insufficient",
        ml: makeMlInference({
          predicted_class: "insufficient_reliable_data",
          probability: 0,
          confidence_label: "insufficient_confidence",
          suppression_state: "suppressed_missing_data",
          uncertainty_reasons: ["classical_pipeline_suppressed"]
        }),
        expectedLabel: "insufficient_reliable_data",
        expectedEvidence: "none",
        expectedSuppression: "suppressed_missing_data"
      }
    ];

    for (const entry of cases) {
      const decision = mapObjectiveInterpretation(
        makeInput({
          ml_inference: entry.ml
        })
      );

      expect(OBJECTIVE_INTERPRETATION_LABELS).toContain(
        decision.interpretation_label
      );
      expect(decision.interpretation_label).toBe(entry.expectedLabel);
      expect(decision.evidence_level).toBe(entry.expectedEvidence);
      expect(decision.suppression_state).toBe(entry.expectedSuppression);
      expectClinicianOnly(decision);
      expectSafeSurface(decision);
    }
  });

  it("never emits high confidence even with very high model probability", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        ml_inference: makeMlInference({
          probability: 0.999,
          confidence_label: "moderate_confidence"
        })
      })
    );

    const summary = createObjectiveInterpretationSummary(decision);
    const serialized = JSON.stringify({ decision, summary }).toLowerCase();

    expect(decision.confidence_label).toBe("moderate_confidence");
    expect(decision.evidence_level).toBe("moderate");
    expect(serialized).not.toContain("high_confidence");
    expect(serialized).not.toContain("high evidence");
    expectSafeSurface({ decision, summary });
  });

  it("baseline unavailability suppresses even when ML probability is strong", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          baseline_relative: {
            baseline_state: "unavailable",
            readiness_confidence_modifier: 0.6
          },
          uncertainty_reasons: ["baseline_unavailable"]
        }),
        ml_inference: makeMlInference({
          probability: 0.99
        })
      })
    );

    expect(decision.interpretation_label).toBe("insufficient_reliable_data");
    expect(decision.evidence_level).toBe("none");
    expect(decision.suppression_state).toBe("suppressed_missing_baseline");
    expect(decision.uncertainty_reasons).toEqual(
      expect.arrayContaining(["baseline_not_available"])
    );
    expectSafeSurface(decision);
  });

  it("low ECG or GSR quality suppresses interpretation and summary", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          features: {
            ...makeFeatureWindow().features,
            gsr: {
              gsr_quality_score: 0.1,
              suppression: {
                suppressed: true,
                reasons: ["gsr_quality_low"]
              }
            }
          },
          uncertainty_reasons: ["gsr_quality_low"]
        })
      })
    );
    const summary = createObjectiveInterpretationSummary(decision);

    expect(decision.interpretation_label).toBe("suppressed_for_quality");
    expect(decision.suppression_state).toBe("suppressed_low_quality");
    expect(decision.evidence_level).toBe("none");
    expect(decision.confidence_label).toBe("insufficient_confidence");
    expect(decision.excluded_modalities).toContain("gsr");
    expect(summary.template_id).toBe("quality_suppressed_summary");
    expectSafeSurface({ decision, summary });
  });

  it("motion and conflict suppress without validating either signal side", () => {
    const motionDecision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          cross_signal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: true,
            motion_confound_index: 0.9
          },
          uncertainty_reasons: ["high_motion_confound"]
        })
      })
    );

    const conflictDecision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          cross_signal: {
            signal_conflict_score: 0.9,
            high_motion_confound_present: false,
            motion_confound_index: 0.1
          },
          uncertainty_reasons: ["signal_conflict_high"]
        })
      })
    );

    expect(motionDecision.interpretation_label).toBe(
      "motion_confounded_evidence"
    );
    expect(motionDecision.suppression_state).toBe("suppressed_motion_confound");
    expect(motionDecision.evidence_level).toBe("none");

    expect(conflictDecision.interpretation_label).toBe(
      "signal_conflict_uncertain"
    );
    expect(conflictDecision.suppression_state).toBe(
      "suppressed_signal_conflict"
    );
    expect(conflictDecision.evidence_level).toBe("none");

    expectSafeSurface({ motionDecision, conflictDecision });
  });

  it("summary templates are deterministic for all interpretation labels", () => {
    const decisions = [
      mapObjectiveInterpretation(
        makeInput({
          ml_inference: makeMlInference({
            predicted_class: "low_or_baseline_arousal_evidence",
            probability: 0.66,
            uncertainty_reasons: ["features_near_baseline"]
          })
        })
      ),
      mapObjectiveInterpretation(makeInput()),
      mapObjectiveInterpretation(
        makeInput({
          ml_inference: makeMlInference({
            predicted_class: "recovery_cooldown",
            confidence_label: "low_confidence",
            probability: 0.62,
            uncertainty_reasons: ["hr_below_baseline"]
          })
        })
      ),
      mapObjectiveInterpretation(
        makeInput({
          ml_inference: undefined
        })
      ),
      mapObjectiveInterpretation(
        makeInput({
          feature_window: makeFeatureWindow({
            features: {
              ...makeFeatureWindow().features,
              ecg: {
                suppression: {
                  suppressed: true,
                  reasons: ["ecg_quality_low"]
                }
              }
            }
          })
        })
      ),
      mapObjectiveInterpretation(
        makeInput({
          feature_window: makeFeatureWindow({
            cross_signal: {
              signal_conflict_score: 0.1,
              high_motion_confound_present: true
            }
          })
        })
      ),
      mapObjectiveInterpretation(
        makeInput({
          feature_window: makeFeatureWindow({
            cross_signal: {
              signal_conflict_score: 0.9,
              high_motion_confound_present: false
            }
          })
        })
      )
    ];

    for (const decision of decisions) {
      const first = createObjectiveInterpretationSummary(decision);
      const second = createObjectiveInterpretationSummary(decision);

      expect(first).toEqual(second);
      expect(first.visibility).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      });
      expect(first.rendered_summary_text).toContain("Details:");
      expect(first.rendered_summary_text).toContain("Cautions:");
      expect(first.rendered_summary_text).toContain("Review focus:");
      expectSafeSurface(first);
    }
  });

  it("regression snapshot preserves high-level safe output shape", () => {
    const decision = mapObjectiveInterpretation(makeInput());
    const summary = createObjectiveInterpretationSummary(decision);

    expect({
      interpretation_label: decision.interpretation_label,
      evidence_level: decision.evidence_level,
      confidence_label: decision.confidence_label,
      suppression_state: decision.suppression_state,
      template_id: summary.template_id,
      source_banner: decision.source_banner,
      clinician_visible: decision.visibility.clinician_visible,
      patient_visible: decision.visibility.patient_visible,
      chatbot_visible: decision.visibility.chatbot_visible
    }).toEqual({
      interpretation_label: "elevated_physiological_arousal_evidence",
      evidence_level: "moderate",
      confidence_label: "moderate_confidence",
      suppression_state: "not_suppressed",
      template_id: "elevated_arousal_summary",
      source_banner: "simulated_data",
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false
    });

    expectSafeSurface({ decision, summary });
  });
});
