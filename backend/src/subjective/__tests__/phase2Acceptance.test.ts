import {
  deriveResponseControl,
  extractSubjectiveEvidence,
  planSubjectiveCheckIn,
  reduceSubjectiveState,
} from "../index.js";
import { createDefaultSubjectiveState } from "../types.js";
import type { CheckInResponsePayload } from "../types.js";

describe("Phase 2 subjective acceptance", () => {
  it("handles high craving with alcohol nearby as immediate coping evidence", () => {
    const evidence = extractSubjectiveEvidence({
      query: "I really want a drink right now, 9/10, and alcohol is in the house.",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const control = deriveResponseControl(state);

    expect(state.cravingLevel).toBe("very_high");
    expect(state.alcoholAvailability).toBe("nearby");
    expect(control.supportStrategy).toBe("immediate_coping");
    expect(control.kbStateTags).toContain("alcohol_nearby");
    expect(control.promptStyleHints.join(" ")).toMatch(/distance from alcohol/i);
  });

  it("handles lapse with shame as shame-sensitive lapse support", () => {
    const evidence = extractSubjectiveEvidence({
      query: "I slipped last night and feel ashamed.",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const control = deriveResponseControl(state);

    expect(state.recentUseStatus).toBe("lapse_disclosed");
    expect(state.shameCue).toBe(true);
    expect(control.supportStrategy).toBe("lapse_reflection");
    expect(control.kbStateTags).toContain("shame_sensitive");
    expect(control.promptStyleHints.join(" ")).toMatch(/nonjudgmental/i);
  });

  it("accepts skipped check-in and continues with high uncertainty", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {},
      skippedFields: ["all"],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const evidence = extractSubjectiveEvidence({
      query: "",
      checkInResponse: payload,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const control = deriveResponseControl(state);

    expect(state.uncertainty.level).toBe("high");
    expect(state.skippedFields.length).toBeGreaterThan(0);
    expect(control.supportStrategy).toBe("generic_support");
    expect(control.allowedResponseInfluence).toBe("style_only");
  });

  it("treats contradictory craving report conservatively", () => {
    const evidence = extractSubjectiveEvidence({
      query: "I said craving is 2 but I also said I'm about to drink.",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const control = deriveResponseControl(state);

    expect(state.contradictionHint).toBe(true);
    expect(state.uncertainty.level).toBe("high");
    expect(control.supportStrategy).toBe("generic_support");
    expect(control.allowedResponseInfluence).toBe("style_only");
  });

  it("can plan grounding support without escalation when no danger is present", () => {
    const state = createDefaultSubjectiveState();
    state.supportPreference = "grounding";

    const plan = planSubjectiveCheckIn({
      safetyCategory: "general_support",
      subjectiveState: state,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const control = deriveResponseControl(state);

    expect(plan.action).toBe("continue");
    expect(control.supportStrategy).toBe("grounding_first");
    expect(control.allowedResponseInfluence).toBe("style_plus_coping");
  });

  it("does not create clinical scores or diagnoses in subjective state", () => {
    const state = createDefaultSubjectiveState();

    expect(state).not.toHaveProperty("clinicalRiskScore");
    expect(state).not.toHaveProperty("relapseRiskScore");
    expect(state).not.toHaveProperty("withdrawalScore");
    expect(state).not.toHaveProperty("AUDSeverity");
    expect(state).not.toHaveProperty("diagnosis");
    expect(state).not.toHaveProperty("CIWAResult");
  });
});