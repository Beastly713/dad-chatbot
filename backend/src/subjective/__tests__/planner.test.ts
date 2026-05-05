import { createDefaultSubjectiveState } from "../types.js";
import { planSubjectiveCheckIn } from "../planner.js";

describe("subjective check-in planner", () => {
  it("asks craving, confidence, and preference for craving cases with no state", () => {
    const plan = planSubjectiveCheckIn({
      safetyCategory: "alcohol_craving",
      subjectiveState: createDefaultSubjectiveState(),
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(plan.action).toBe("ask_checkin");
    expect(plan.questions.map((question) => question.field)).toEqual([
      "craving_level",
      "coping_confidence",
      "support_preference",
    ]);
  });

  it("asks alcohol availability when craving is high and availability is unknown", () => {
    const state = createDefaultSubjectiveState();
    state.cravingLevel = "very_high";
    state.copingConfidence = "moderate";
    state.supportPreference = "practical_step";
    state.alcoholAvailability = "unclear";

    const plan = planSubjectiveCheckIn({
      safetyCategory: "alcohol_craving",
      subjectiveState: state,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(plan.action).toBe("ask_checkin");
    expect(plan.questions.map((question) => question.field)).toContain(
      "alcohol_availability",
    );
  });

  it("asks support preference or distress for lapse with shame, not craving battery", () => {
    const state = createDefaultSubjectiveState();
    state.recentUseStatus = "lapse_disclosed";
    state.shameCue = true;

    const plan = planSubjectiveCheckIn({
      safetyCategory: "lapse_or_relapse",
      subjectiveState: state,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    const fields = plan.questions.map((question) => question.field);

    expect(plan.action).toBe("ask_checkin");
    expect(fields).toContain("support_preference");
    expect(fields).toContain("distress_level");
    expect(fields).not.toContain("craving_level");
  });

  it("suppresses check-in after a recent skip", () => {
    const state = createDefaultSubjectiveState();
    state.skippedFields = ["craving_level"];
    state.updatedAt = "2026-05-05T09:55:00.000Z";

    const plan = planSubjectiveCheckIn({
      safetyCategory: "alcohol_craving",
      subjectiveState: state,
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(plan.action).toBe("skip_checkin");
    expect(plan.reason).toBe("recent_checkin_decline");
  });

  it("does not ask check-in for template-only categories", () => {
    const plan = planSubjectiveCheckIn({
      safetyCategory: "medication_or_dosage_request",
      subjectiveState: createDefaultSubjectiveState(),
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(plan.action).toBe("skip_checkin");
    expect(plan.questions).toEqual([]);
    expect(plan.reason).toBe("template_only_category");
  });
});