import {
  ALLOWED_OBJECTIVE_CONFIDENCE_LABELS,
  ALLOWED_OBJECTIVE_EVIDENCE_LEVELS,
  ALLOWED_OBJECTIVE_INTERPRETATION_LABELS,
  ALLOWED_OBJECTIVE_ML_CLASSES,
  ALLOWED_OBJECTIVE_ML_TARGETS,
  ALLOWED_OBJECTIVE_SOURCE_TYPES,
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  OBJECTIVE_VISIBILITY_DEFAULTS,
  assertAllowedObjectiveInterpretationLabel,
  assertAllowedObjectiveMlTarget,
  assertAllowedObjectiveSourceType,
  isAllowedObjectiveInterpretationLabel,
  isAllowedObjectiveMlClass,
  isAllowedObjectiveMlTarget,
  isAllowedObjectiveSourceType,
  isForbiddenObjectiveLabel,
} from "../src/index.js";

describe("objective safety registries", () => {
  it("allows only the bounded Phase 3 ML target language", () => {
    expect(ALLOWED_OBJECTIVE_ML_TARGETS).toEqual([
      "baseline_relative_elevated_physiological_arousal_evidence",
    ]);

    expect(
      isAllowedObjectiveMlTarget(
        "baseline_relative_elevated_physiological_arousal_evidence",
      ),
    ).toBe(true);

    expect(isAllowedObjectiveMlTarget("relapse_risk")).toBe(false);
    expect(isAllowedObjectiveMlTarget("craving_detected")).toBe(false);
    expect(isAllowedObjectiveMlTarget("withdrawal_risk")).toBe(false);
  });

  it("allows only bounded ML output classes", () => {
    expect(ALLOWED_OBJECTIVE_ML_CLASSES).toEqual([
      "low_or_baseline_arousal_evidence",
      "elevated_arousal_evidence",
      "recovery_cooldown",
      "insufficient_reliable_data",
    ]);

    expect(isAllowedObjectiveMlClass("elevated_arousal_evidence")).toBe(true);
    expect(isAllowedObjectiveMlClass("intoxication_detected")).toBe(false);
  });

  it("allows only clinician-safe interpretation labels", () => {
    expect(
      ALLOWED_OBJECTIVE_INTERPRETATION_LABELS.includes(
        "elevated_physiological_arousal_evidence",
      ),
    ).toBe(true);
    expect(
      ALLOWED_OBJECTIVE_INTERPRETATION_LABELS.includes(
        "stress_like_autonomic_activation_evidence",
      ),
    ).toBe(true);
    expect(
      isAllowedObjectiveInterpretationLabel("cross_signal_disagreement"),
    ).toBe(true);

    expect(isAllowedObjectiveInterpretationLabel("relapse_risk")).toBe(false);
    expect(isAllowedObjectiveInterpretationLabel("craving_detected")).toBe(
      false,
    );
    expect(isAllowedObjectiveInterpretationLabel("stress_proven")).toBe(false);
  });

  it("keeps evidence and confidence labels non-clinical", () => {
    expect(ALLOWED_OBJECTIVE_EVIDENCE_LEVELS).toEqual([
      "none_observed",
      "low",
      "moderate",
      "elevated",
      "insufficient_data",
    ]);

    expect(ALLOWED_OBJECTIVE_CONFIDENCE_LABELS).toEqual([
      "low_confidence",
      "moderate_confidence",
      "high_confidence",
      "not_available",
    ]);

    expect(ALLOWED_OBJECTIVE_EVIDENCE_LEVELS).not.toContain("high_risk");
    expect(ALLOWED_OBJECTIVE_CONFIDENCE_LABELS).not.toContain("diagnosed");
  });

  it("defines source types without implying validated hardware or clinical status", () => {
    expect(ALLOWED_OBJECTIVE_SOURCE_TYPES).toEqual([
      "simulator",
      "public_dataset_replay",
      "prototype_hardware",
    ]);

    expect(isAllowedObjectiveSourceType("simulator")).toBe(true);
    expect(isAllowedObjectiveSourceType("validated_hardware")).toBe(false);
    expect(isAllowedObjectiveSourceType("clinical_device")).toBe(false);
  });

  it("sets objective visibility defaults to clinician-only", () => {
    expect(OBJECTIVE_VISIBILITY_DEFAULTS).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });
  });

  it("centralizes forbidden labels, fields, and route segments", () => {
    expect(FORBIDDEN_OBJECTIVE_LABELS).toEqual(
      expect.arrayContaining([
        "craving_detected",
        "relapse_risk",
        "withdrawal_risk",
        "intoxication_detected",
        "AUD_severity",
        "emergency_detected",
        "treatment_need",
        "detox_need",
        "medication_need",
        "CIWA_score",
        "sobriety_status",
        "patient_truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
        "stress_proven",
      ]),
    );

    expect(FORBIDDEN_OBJECTIVE_FIELD_NAMES).toEqual(
      expect.arrayContaining(["relapseRisk", "ciwaScore", "patientIsLying"]),
    );

    expect(FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS).toEqual(
      expect.arrayContaining([
        "relapse-risk",
        "withdrawal-risk",
        "intoxication",
        "ciwa",
      ]),
    );

    expect(isForbiddenObjectiveLabel("relapse_risk")).toBe(true);
    expect(isForbiddenObjectiveLabel("elevated_arousal_evidence")).toBe(false);
  });

  it("throws on unsupported targets, labels, and source types", () => {
    expect(() =>
      assertAllowedObjectiveMlTarget(
        "baseline_relative_elevated_physiological_arousal_evidence",
      ),
    ).not.toThrow();

    expect(() => assertAllowedObjectiveMlTarget("relapse_risk")).toThrow(
      "Unsupported objective ML target",
    );

    expect(() =>
      assertAllowedObjectiveInterpretationLabel(
        "elevated_physiological_arousal_evidence",
      ),
    ).not.toThrow();

    expect(() =>
      assertAllowedObjectiveInterpretationLabel("craving_detected"),
    ).toThrow("Unsupported objective interpretation label");

    expect(() => assertAllowedObjectiveSourceType("simulator")).not.toThrow();

    expect(() =>
      assertAllowedObjectiveSourceType("validated_hardware"),
    ).toThrow("Unsupported objective source type");
  });
});
