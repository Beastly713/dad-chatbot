import {
  createObjectiveDemoQualityFeatureSummary,
  getObjectiveQualityLevelLabel,
} from "../../app/(clinician)/clinician/objective/_lib/qualityFeatureCards";

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

describe("objective quality and feature summary card helpers", () => {
  it("creates all required quality cards", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    expect(summary.qualityCards.map((card) => card.kind)).toEqual([
      "ecg_quality",
      "gsr_quality",
      "ppg_quality",
      "motion_activity_context",
      "temperature_contact_context",
      "timing_quality",
      "baseline_state",
      "missingness",
    ]);
  });

  it("creates bounded feature summary cards", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    expect(summary.featureCards.map((card) => card.title)).toEqual([
      "Heart-activity trend",
      "Skin-conductance trend",
      "Pulse-waveform context",
      "Motion confound context",
    ]);

    for (const card of summary.featureCards) {
      expect(card.valueLabel.length).toBeGreaterThan(0);
      expect(card.summary.length).toBeGreaterThan(0);
      expect(card.sourceContext.length).toBeGreaterThan(0);

      expectSafeCopy(card.title);
      expectSafeCopy(card.valueLabel);
      expectSafeCopy(card.summary);
      expectSafeCopy(card.sourceContext);
    }
  });

  it("shows poor or limited quality as technical limitations, not clinical language", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    const limitedCards = summary.qualityCards.filter(
      (card) => card.level === "limited" || card.level === "insufficient",
    );

    expect(limitedCards.length).toBeGreaterThan(0);

    for (const card of limitedCards) {
      expect(card.technicalLimitations.length).toBeGreaterThan(0);

      const combined = [
        card.title,
        card.valueLabel,
        card.summary,
        ...card.technicalLimitations,
        ...card.supportingDetails,
      ].join(" ");

      expect(combined.toLowerCase()).toMatch(
        /technical|quality|context|baseline|missing|confidence|reliability|artifact|contact/,
      );
      expectSafeCopy(combined);
    }
  });

  it("keeps all quality card copy non-diagnostic and source-bounded", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    for (const card of summary.qualityCards) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.valueLabel.length).toBeGreaterThan(0);
      expect(card.summary.length).toBeGreaterThan(0);
      expect(card.technicalLimitations.length).toBeGreaterThan(0);
      expect(card.supportingDetails.length).toBeGreaterThan(0);

      const combined = [
        card.title,
        card.valueLabel,
        card.summary,
        ...card.technicalLimitations,
        ...card.supportingDetails,
      ].join(" ");

      expectSafeCopy(combined);
    }
  });

  it("labels TMP117 local context and MPU device-health context safely", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    const temperature = summary.qualityCards.find(
      (card) => card.kind === "temperature_contact_context",
    );

    expect(temperature).toBeDefined();

    const combined = [
      temperature?.title,
      temperature?.summary,
      ...(temperature?.technicalLimitations ?? []),
      ...(temperature?.supportingDetails ?? []),
    ]
      .join(" ")
      .toLowerCase();

    expect(combined).toContain("local temperature");
    expect(combined).toContain("not core temperature");
    expect(combined).toContain("device-health");
  });

  it("labels baseline as readiness/context, not a clinical status", () => {
    const summary = createObjectiveDemoQualityFeatureSummary();

    const baseline = summary.qualityCards.find(
      (card) => card.kind === "baseline_state",
    );

    expect(baseline).toBeDefined();

    const combined = [
      baseline?.title,
      baseline?.summary,
      ...(baseline?.technicalLimitations ?? []),
      ...(baseline?.supportingDetails ?? []),
    ]
      .join(" ")
      .toLowerCase();

    expect(combined).toContain("baseline");
    expect(combined).toContain("readiness");
    expect(combined).toContain("not a clinical status");
    expectSafeCopy(combined);
  });

  it("maps quality levels to display labels", () => {
    expect(getObjectiveQualityLevelLabel("usable")).toBe("Usable");
    expect(getObjectiveQualityLevelLabel("limited")).toBe("Limited");
    expect(getObjectiveQualityLevelLabel("insufficient")).toBe("Insufficient");
    expect(getObjectiveQualityLevelLabel("not_available")).toBe(
      "Not available",
    );
  });
});
