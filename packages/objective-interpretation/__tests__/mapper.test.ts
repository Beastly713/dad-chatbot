import {
  mapObjectiveInterpretation,
  OBJECTIVE_INTERPRETATION_TARGET,
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
      window_frame_count: 100
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

describe("objective interpretation evidence/confidence mapper", () => {
  it("maps elevated ML evidence into moderate clinician-only interpretation", () => {
    const decision = mapObjectiveInterpretation(makeInput());

    expect(decision).toEqual(
      expect.objectContaining({
        interpretation_version: "objective-interpretation-v1",
        target: OBJECTIVE_INTERPRETATION_TARGET,
        interpretation_label: "elevated_physiological_arousal_evidence",
        evidence_level: "moderate",
        confidence_label: "moderate_confidence",
        suppression_state: "not_suppressed",
        source_banner: "simulated_data",
        visibility: {
          clinician_visible: true,
          patient_visible: false,
          chatbot_visible: false
        }
      })
    );

    expect(decision.uncertainty_reasons).toEqual(
      expect.arrayContaining(["hr_above_baseline", "gsr_above_baseline"])
    );
    expect(decision.contributing_modalities).toEqual(
      expect.arrayContaining(["ecg", "gsr", "ppg", "imu", "temperature"])
    );
  });

  it("maps low baseline ML evidence safely", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        ml_inference: makeMlInference({
          predicted_class: "low_or_baseline_arousal_evidence",
          probability: 0.66,
          uncertainty_reasons: ["features_near_baseline"]
        })
      })
    );

    expect(decision.interpretation_label).toBe("baseline_or_low_arousal_evidence");
    expect(decision.evidence_level).toBe("moderate");
    expect(decision.confidence_label).toBe("moderate_confidence");
  });

  it("maps recovery cooldown ML evidence safely", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        ml_inference: makeMlInference({
          predicted_class: "recovery_cooldown",
          probability: 0.62,
          confidence_label: "low_confidence",
          uncertainty_reasons: ["hr_below_baseline", "gsr_below_baseline"]
        })
      })
    );

    expect(decision.interpretation_label).toBe("recovery_cooldown_evidence");
    expect(decision.evidence_level).toBe("low");
    expect(decision.confidence_label).toBe("low_confidence");
  });

  it("does not let high model probability alone create high confidence", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        ml_inference: makeMlInference({
          predicted_class: "elevated_arousal_evidence",
          probability: 0.99,
          confidence_label: "moderate_confidence"
        })
      })
    );

    expect(decision.evidence_level).toBe("moderate");
    expect(decision.confidence_label).toBe("moderate_confidence");
    expect(JSON.stringify(decision)).not.toContain("high_confidence");
  });

  it("downgrades when baseline is unavailable", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          baseline_relative: {
            baseline_state: "unavailable",
            readiness_confidence_modifier: 0.6
          },
          uncertainty_reasons: ["baseline_unavailable"]
        })
      })
    );

    expect(decision.suppression_state).toBe("suppressed_missing_baseline");
    expect(decision.interpretation_label).toBe("insufficient_reliable_data");
    expect(decision.evidence_level).toBe("none");
    expect(decision.confidence_label).toBe("low_confidence");
    expect(decision.uncertainty_reasons).toEqual(
      expect.arrayContaining(["baseline_unavailable", "baseline_not_available"])
    );
  });

  it("suppresses when low signal quality is present", () => {
    const decision = mapObjectiveInterpretation(
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
          },
          uncertainty_reasons: ["ecg_quality_low"]
        })
      })
    );

    expect(decision.suppression_state).toBe("suppressed_low_quality");
    expect(decision.interpretation_label).toBe("suppressed_for_quality");
    expect(decision.evidence_level).toBe("none");
    expect(decision.confidence_label).toBe("insufficient_confidence");
    expect(decision.excluded_modalities).toContain("ecg");
  });

  it("suppresses motion-confounded evidence", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          cross_signal: {
            signal_conflict_score: 0.2,
            high_motion_confound_present: true,
            motion_confound_index: 0.8
          },
          uncertainty_reasons: ["high_motion_confound"]
        })
      })
    );

    expect(decision.suppression_state).toBe("suppressed_motion_confound");
    expect(decision.interpretation_label).toBe("motion_confounded_evidence");
    expect(decision.evidence_level).toBe("none");
    expect(decision.uncertainty_reasons).toContain("motion_confound_present");
  });

  it("suppresses signal conflict instead of treating disagreement as truth", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        feature_window: makeFeatureWindow({
          cross_signal: {
            signal_conflict_score: 0.8,
            high_motion_confound_present: false
          },
          uncertainty_reasons: ["ecg_ppg_disagreement", "hr_gsr_divergence"]
        })
      })
    );

    expect(decision.suppression_state).toBe("suppressed_signal_conflict");
    expect(decision.interpretation_label).toBe("signal_conflict_uncertain");
    expect(decision.evidence_level).toBe("none");
    expect(decision.uncertainty_reasons).toContain("signal_conflict_high");
  });

  it("handles unavailable ML as insufficient reliable data", () => {
    const decision = mapObjectiveInterpretation(
      makeInput({
        ml_inference: undefined,
        artifact_state: {
          source_banner: "simulated_data",
          model_loaded: false
        }
      })
    );

    expect(decision.interpretation_label).toBe("insufficient_reliable_data");
    expect(decision.evidence_level).toBe("none");
    expect(decision.confidence_label).toBe("insufficient_confidence");
    expect(decision.suppression_state).toBe("suppressed_missing_data");
    expect(decision.uncertainty_reasons).toEqual(
      expect.arrayContaining(["ml_inference_unavailable", "model_artifact_unavailable"])
    );
  });

  it("rejects patient or chatbot visible inputs", () => {
    expect(() =>
      mapObjectiveInterpretation(
        makeInput({
          feature_window: makeFeatureWindow({
            visibility: {
              clinician_visible: true,
              patient_visible: true as false,
              chatbot_visible: false
            }
          })
        })
      )
    ).toThrow("patient_visible must remain false");

    expect(() =>
      mapObjectiveInterpretation(
        makeInput({
          ml_inference: makeMlInference({
            visibility: {
              clinician_visible: true,
              patient_visible: false,
              chatbot_visible: true as false
            }
          })
        })
      )
    ).toThrow("chatbot_visible must remain false");
  });
});
