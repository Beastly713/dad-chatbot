import {
  createObjectiveDemoMlInterpretationSummary,
  formatObjectiveModelScore,
  getObjectiveConfidenceLabel,
  getObjectiveEvidenceLevelLabel,
  getObjectiveInterpretationLabel,
  getObjectiveMlTargetLabel,
  getObjectiveSuppressionStateLabel,
} from "../../app/(clinician)/clinician/objective/_lib/mlInterpretationCards";

function expectSafeCopy(value: string): void {
  const lower = value.toLowerCase();

  for (const forbidden of [
    "risk score",
    "emergency",
    "alert",
    "diagnosis",
    "diagnose",
    "relapse risk",
    "withdrawal risk",
    "intoxication",
    "craving detected",
    "ciwa",
    "sobriety",
    "patient is safe",
    "patient is stable",
    "patient is lying",
    "treatment need",
    "detox need",
    "medication need",
    "clinical warning",
  ]) {
    expect(lower).not.toContain(forbidden);
  }
}

describe("objective ML and interpretation dashboard helpers", () => {
  it("creates bounded ML and interpretation summary content", () => {
    const summary = createObjectiveDemoMlInterpretationSummary();

    expect(summary.mlTarget).toBe(
      "baseline_relative_elevated_physiological_arousal_evidence",
    );
    expect(summary.interpretationLabel).toBe(
      "elevated_physiological_arousal_evidence",
    );
    expect(summary.evidenceLevel).toBe("moderate");
    expect(summary.confidenceLabel).toBe("moderate_confidence");
    expect(summary.modelScore).toBe(0.62);
    expect(summary.uncertaintyReasons.length).toBeGreaterThan(0);
    expect(summary.contributingModalities.length).toBeGreaterThan(0);
    expect(summary.excludedModalities.length).toBeGreaterThan(0);
    expect(summary.suppressionState).toBe("not_suppressed");
  });

  it("maps labels to safe display copy", () => {
    expect(
      getObjectiveMlTargetLabel(
        "baseline_relative_elevated_physiological_arousal_evidence",
      ),
    ).toBe("Baseline-relative elevated physiological arousal evidence");

    expect(
      getObjectiveInterpretationLabel(
        "elevated_physiological_arousal_evidence",
      ),
    ).toBe("Elevated physiological arousal evidence");

    expect(getObjectiveEvidenceLevelLabel("moderate")).toBe(
      "Moderate evidence",
    );
    expect(getObjectiveConfidenceLabel("moderate_confidence")).toBe(
      "Moderate confidence",
    );
    expect(getObjectiveSuppressionStateLabel("not_suppressed")).toBe(
      "Not suppressed",
    );
  });

  it("formats model score but does not let it stand alone as conclusion", () => {
    expect(formatObjectiveModelScore(0.62)).toBe("62% model score");
    expect(formatObjectiveModelScore(null)).toBe("Unavailable");
    expect(formatObjectiveModelScore(Number.NaN)).toBe("Unavailable");
    expect(formatObjectiveModelScore(2)).toBe("100% model score");
    expect(formatObjectiveModelScore(-1)).toBe("0% model score");

    const summary = createObjectiveDemoMlInterpretationSummary();

    expect(summary.modelScoreNote.toLowerCase()).toContain(
      "one bounded input",
    );
    expect(summary.modelScoreNote.toLowerCase()).toContain(
      "does not override",
    );
    expect(summary.modelScoreNote.toLowerCase()).toContain("uncertainty");
    expectSafeCopy(summary.modelScoreNote);
  });

  it("keeps all generated copy safe and non-diagnostic", () => {
    const summary = createObjectiveDemoMlInterpretationSummary();

    const allCopy = [
      getObjectiveMlTargetLabel(summary.mlTarget),
      getObjectiveInterpretationLabel(summary.interpretationLabel),
      getObjectiveEvidenceLevelLabel(summary.evidenceLevel),
      getObjectiveConfidenceLabel(summary.confidenceLabel),
      getObjectiveSuppressionStateLabel(summary.suppressionState),
      summary.modelScoreNote,
      ...summary.uncertaintyReasons,
      ...summary.contributingModalities,
      ...summary.excludedModalities.flatMap((item) => [
        item.modality,
        item.reason,
      ]),
      summary.scopeNote,
      summary.sourceNote,
    ];

    for (const copy of allCopy) {
      expectSafeCopy(copy);
    }
  });

  it("keeps uncertainty, contributing modalities, and excluded modalities explicit", () => {
    const summary = createObjectiveDemoMlInterpretationSummary();

    expect(summary.uncertaintyReasons.join(" ").toLowerCase()).toContain(
      "baseline",
    );
    expect(summary.uncertaintyReasons.join(" ").toLowerCase()).toContain(
      "motion",
    );
    expect(summary.contributingModalities).toContain("ECG");
    expect(summary.contributingModalities).toContain("GSR");

    const excluded = summary.excludedModalities
      .map((item) => `${item.modality} ${item.reason}`)
      .join(" ")
      .toLowerCase();

    expect(excluded).toContain("ppg");
    expect(excluded).toContain("limited");
    expect(excluded).toContain("local temperature");
  });

  it("labels suppression as data-quality or readiness context, not status about the person", () => {
    const summary = createObjectiveDemoMlInterpretationSummary();

    expect(summary.suppressionState).toBe("not_suppressed");
    expect(summary.scopeNote.toLowerCase()).toContain("clinician-only");
    expect(summary.scopeNote.toLowerCase()).toContain("non-diagnostic");
    expect(summary.sourceNote.toLowerCase()).toContain(
      "static dashboard scaffolding",
    );
  });
});
