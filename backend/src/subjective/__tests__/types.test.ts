import {
  ACTIVE_SUBSTANCE_IDS,
  ALCOHOL_SUBSTANCE_ID,
  alcoholCheckInQuestions,
  createDefaultSubjectiveState,
} from "../index.js";

describe("Phase 2 subjective type system", () => {
  it("creates an alcohol-scoped default subjective state", () => {
    const state = createDefaultSubjectiveState();

    expect(state.substance).toBe("alcohol");
    expect(state.substance).toBe(ALCOHOL_SUBSTANCE_ID);
  });

  it("defaults to high uncertainty when no subjective evidence exists", () => {
    const state = createDefaultSubjectiveState();

    expect(state.evidenceCount).toBe(0);
    expect(state.uncertainty.level).toBe("high");
    expect(state.uncertainty.reasons).toContain("no_subjective_evidence");
  });

  it("exposes only alcohol-specific Phase 2 check-in questions", () => {
    const fields = alcoholCheckInQuestions.map((question) => question.field);

    expect(fields).toEqual([
      "craving_level",
      "distress_level",
      "coping_confidence",
      "alcohol_availability",
      "support_preference",
      "recent_use_status",
    ]);
  });

  it("does not expose clinical score or diagnosis fields", () => {
    const state = createDefaultSubjectiveState();

    expect(state).not.toHaveProperty("clinicalRiskScore");
    expect(state).not.toHaveProperty("relapseRiskScore");
    expect(state).not.toHaveProperty("withdrawalScore");
    expect(state).not.toHaveProperty("AUDSeverity");
    expect(state).not.toHaveProperty("diagnosis");
    expect(state).not.toHaveProperty("CIWAResult");
  });

  it("does not activate a second substance adapter", () => {
    expect(ACTIVE_SUBSTANCE_IDS).toEqual(["alcohol"]);
  });
});