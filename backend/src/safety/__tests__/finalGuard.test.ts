import { finalGuard } from "../finalGuard.js";
import { getTemplate } from "../templates.js";

describe("finalGuard", () => {
  it("allows safe craving support", () => {
    const result = finalGuard({
      draft:
        "That sounds like a strong urge. Try creating a short pause by taking a few slow breaths and moving away from alcohol for the next 10 minutes.",
      category: "alcohol_craving",
    });

    expect(result.action).toBe("allow");
    expect(result.triggeredRules).toEqual([]);
    expect(result.finalText).toContain("strong urge");
  });

  it("replaces dosage advice with medication refusal", () => {
    const result = finalGuard({
      draft: "You should take 10 mg before bed.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_refusal");
    expect(result.finalText).toBe(getTemplate("medication_refusal"));
    expect(result.triggeredRules).toContain("dosage_or_medical_advice");
  });

  it("replaces explicit detox instructions with withdrawal referral", () => {
    const result = finalGuard({
      draft: "You can detox at home by tapering slowly.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_refusal");
    expect(result.finalText).toBe(getTemplate("withdrawal_detox_referral"));
    expect(result.triggeredRules).toContain("detox_instructions");
  });

  it("replaces unsafe alcohol guidance with unsafe alcohol refusal", () => {
    const result = finalGuard({
      draft: "You can sober up fast by drinking coffee and taking a cold shower.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_refusal");
    expect(result.finalText).toBe(getTemplate("unsafe_alcohol_refusal"));
    expect(result.triggeredRules).toContain("unsafe_alcohol_guidance");
  });

  it("replaces medical emergency draft that lacks escalation language", () => {
    const result = finalGuard({
      draft: "Try resting for a while and see how you feel.",
      category: "possible_medical_emergency",
    });

    expect(result.action).toBe("replace_with_escalation");
    expect(result.finalText).toBe(getTemplate("medical_emergency_escalation"));
    expect(result.triggeredRules).toContain("missing_medical_escalation");
  });

  it("replaces self-harm danger draft that lacks escalation language", () => {
    const result = finalGuard({
      draft: "Try distracting yourself and thinking positive thoughts.",
      category: "self_harm_or_immediate_danger",
    });

    expect(result.action).toBe("replace_with_escalation");
    expect(result.finalText).toBe(getTemplate("self_harm_escalation"));
    expect(result.triggeredRules).toContain("missing_self_harm_escalation");
  });

  it("replaces false reassurance in medical emergency with emergency escalation", () => {
    const result = finalGuard({
      draft: "You’ll be fine. It is probably nothing to worry about.",
      category: "possible_medical_emergency",
    });

    expect(result.action).toBe("replace_with_escalation");
    expect(result.finalText).toBe(getTemplate("medical_emergency_escalation"));
  });

  it("replaces internal policy leakage with fallback", () => {
    const result = finalGuard({
      draft:
        "According to my internal policy and triage category, I should refuse this.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_fallback");
    expect(result.finalText).toBe(getTemplate("fallback_safe"));
    expect(result.triggeredRules).toContain("internal_policy_leakage");
  });

  it("replaces empty draft with fallback", () => {
    const result = finalGuard({
      draft: "   ",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_fallback");
    expect(result.finalText).toBe(getTemplate("fallback_safe"));
    expect(result.triggeredRules).toContain("empty_draft");
  });

  it("allows fixed self-harm escalation template", () => {
    const result = finalGuard({
      draft: getTemplate("self_harm_escalation"),
      category: "self_harm_or_immediate_danger",
    });

    expect(result.action).toBe("allow");
    expect(result.finalText).toBe(getTemplate("self_harm_escalation"));
  });

  it("allows fixed medical emergency escalation template", () => {
    const result = finalGuard({
      draft: getTemplate("medical_emergency_escalation"),
      category: "possible_medical_emergency",
    });

    expect(result.action).toBe("allow");
    expect(result.finalText).toBe(getTemplate("medical_emergency_escalation"));
  });

  it("allows fixed withdrawal referral template", () => {
    const result = finalGuard({
      draft: getTemplate("withdrawal_detox_referral"),
      category: "withdrawal_or_detox_concern",
    });

    expect(result.action).toBe("allow");
    expect(result.finalText).toBe(getTemplate("withdrawal_detox_referral"));
  });

  it("allows fixed medication refusal template", () => {
    const result = finalGuard({
      draft: getTemplate("medication_refusal"),
      category: "medication_or_dosage_request",
    });

    expect(result.action).toBe("allow");
    expect(result.finalText).toBe(getTemplate("medication_refusal"));
  });

  it("allows fixed unsafe alcohol refusal template", () => {
    const result = finalGuard({
      draft: getTemplate("unsafe_alcohol_refusal"),
      category: "unsafe_alcohol_request",
    });

    expect(result.action).toBe("allow");
    expect(result.finalText).toBe(getTemplate("unsafe_alcohol_refusal"));
  });
});