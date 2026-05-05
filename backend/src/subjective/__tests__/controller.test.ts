import { deriveResponseControl } from "../controller.js";
import { createDefaultSubjectiveState } from "../types.js";

describe("subjective response controller", () => {
  it("maps high craving and low confidence to immediate coping control", () => {
    const state = createDefaultSubjectiveState();
    state.cravingLevel = "very_high";
    state.copingConfidence = "low";

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("immediate_coping");
    expect(control.allowedResponseInfluence).toBe("style_plus_coping");
    expect(control.maxWordsOverride).toBeLessThanOrEqual(100);
    expect(control.kbStateTags).toContain("high_craving");
    expect(control.kbStateTags).toContain("low_confidence");
  });

  it("maps high distress plus craving to grounding-first control", () => {
    const state = createDefaultSubjectiveState();
    state.cravingLevel = "high";
    state.distressLevel = "high";

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("grounding_first");
    expect(control.tone).toBe("grounding");
    expect(control.kbStateTags).toContain("grounding");
  });

  it("maps high craving with alcohol nearby to environment-change support", () => {
    const state = createDefaultSubjectiveState();
    state.cravingLevel = "very_high";
    state.copingConfidence = "moderate";
    state.alcoholAvailability = "nearby";

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("immediate_coping");
    expect(control.kbStateTags).toContain("alcohol_nearby");
    expect(control.kbStateTags).toContain("environment_change");
  });

  it("maps recent lapse with shame to nonjudgmental lapse support", () => {
    const state = createDefaultSubjectiveState();
    state.recentUseStatus = "lapse_disclosed";
    state.shameCue = true;

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("lapse_reflection");
    expect(control.promptStyleHints.join(" ")).toMatch(/nonjudgmental/i);
    expect(control.kbStateTags).toContain("shame_sensitive");
  });

  it("maps skipped or unclear answers to generic support", () => {
    const state = createDefaultSubjectiveState();
    state.skippedFields = ["craving_level"];
    state.uncertainty = {
      level: "high",
      reasons: ["checkin_skipped"],
    };

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("generic_support");
    expect(control.allowedResponseInfluence).toBe("style_only");
    expect(control.kbStateTags).toContain("uncertain_state");
  });

  it("keeps red-flag state in escalation-only control", () => {
    const state = createDefaultSubjectiveState();
    state.safetySubflags.possibleMedicalEmergencyRedFlag = true;
    state.supportPreference = "grounding";

    const control = deriveResponseControl(state);

    expect(control.supportStrategy).toBe("escalation_only");
    expect(control.allowedResponseInfluence).toBe("escalation_only");
    expect(control.kbStateTags).toEqual([]);
  });
});