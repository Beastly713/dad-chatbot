import { buildSubjectiveStateSummary } from "../stateSummary.js";
import {
  createDefaultResponseControl,
  createDefaultSubjectiveState,
} from "../../subjective/types.js";

describe("buildSubjectiveStateSummary", () => {
  it("builds a safe subjective summary", () => {
    const state = createDefaultSubjectiveState();
    state.cravingLevel = "very_high";
    state.copingConfidence = "low";
    state.alcoholAvailability = "nearby";
    state.supportPreference = "practical_step";

    const control = createDefaultResponseControl();
    control.supportStrategy = "immediate_coping";
    control.promptStyleHints = ["Give one practical next step."];

    const summary = buildSubjectiveStateSummary({
      subjectiveState: state,
      responseControl: control,
    });

    expect(summary).toContain("User-reported craving: very high.");
    expect(summary).toContain("User-reported coping confidence: low.");
    expect(summary).toContain("Alcohol may be nearby.");
    expect(summary).toContain("Preferred support: practical step.");
    expect(summary).toContain("Response strategy: immediate coping.");
  });

  it("does not include raw safety subflags or internal rule names", () => {
    const state = createDefaultSubjectiveState();
    state.safetySubflags.unsafeDriving = true;
    state.safetySubflags.possibleWithdrawalRedFlag = true;

    const summary = buildSubjectiveStateSummary({
      subjectiveState: state,
    });

    expect(summary).not.toContain("unsafeDriving");
    expect(summary).not.toContain("possibleWithdrawalRedFlag");
    expect(summary).not.toContain("safetySubflags");
    expect(summary).not.toContain("internal policy");
  });

  it("does not include clinical or scoring language from style hints", () => {
    const state = createDefaultSubjectiveState();
    const control = createDefaultResponseControl();

    control.promptStyleHints = [
      "Give one practical next step.",
      "Mention diagnosis score.",
      "Use CIWA.",
      "Create treatment plan.",
    ];

    const summary = buildSubjectiveStateSummary({
      subjectiveState: state,
      responseControl: control,
    });

    expect(summary).toContain("Give one practical next step.");
    expect(summary).not.toContain("diagnosis score");
    expect(summary).not.toContain("CIWA");
    expect(summary).not.toContain("treatment plan");
  });

  it("generates low-assumption summary for skipped or unclear state", () => {
    const state = createDefaultSubjectiveState();
    state.skippedFields = ["craving_level"];
    state.uncertainty = {
      level: "high",
      reasons: ["checkin_skipped"],
    };

    const summary = buildSubjectiveStateSummary({
      subjectiveState: state,
    });

    expect(summary).toContain("Uncertainty is high");
    expect(summary).toContain("avoid strong assumptions");
  });
});