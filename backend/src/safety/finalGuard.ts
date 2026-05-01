import { getTemplate } from "./templates.js";
import type { GuardResult, RiskCategory } from "./types.js";

const DOSAGE_OR_MEDICAL_ADVICE = [
  /\b\d+\s?(mg|ml|tablets?|pills?)\b/i,
  /\btake\b.*\b\d+\s?(mg|ml|tablets?|pills?)\b/i,
  /\byou should take\b/i,
  /\bi recommend taking\b/i,
  /\bsafe dose\b/i,
  /\bprescribe\b/i,
  /\bdiagnose\b/i,
];

const DETOX_INSTRUCTIONS = [
  /\bdetox at home\b/i,
  /\byou can detox\b/i,
  /\bdetox safely by\b/i,
  /\btaper by\b/i,
  /\breduce by\b/i,
  /\bcut down by\b.*\b(day|daily|week|weekly)\b/i,
  /\bstep 1\b.*\bdetox\b/i,
];

const UNSAFE_ALCOHOL_GUIDANCE = [
  /\bdrink more\b/i,
  /\bget drunk faster\b/i,
  /\bsober up fast by\b/i,
  /\bhide your drinking by\b/i,
  /\bcover up drinking by\b/i,
  /\bsafe amount\b.*\balcohol\b/i,
  /\byou can mix\b.*\balcohol\b/i,
  /\btry mixing\b.*\balcohol\b/i,
];

const FALSE_REASSURANCE = [
  /\byou'?ll be fine\b/i,
  /\byou will be fine\b/i,
  /\bnothing to worry about\b/i,
  /\bit'?s not serious\b/i,
  /\bnot a big deal\b/i,
];

const INTERNAL_POLICY_LEAKAGE = [
  /\binternal policy\b/i,
  /\binternal rule\b/i,
  /\bsafety classifier\b/i,
  /\btriage category\b/i,
  /\brisk category\b/i,
  /\bresponse policy\b/i,
  /\bsystem instruction\b/i,
  /\bdeveloper message\b/i,
];

function collectTriggeredRules(draft: string): string[] {
  const triggered: string[] = [];

  const check = (name: string, patterns: RegExp[]) => {
    if (patterns.some((pattern) => pattern.test(draft))) {
      triggered.push(name);
    }
  };

  check("dosage_or_medical_advice", DOSAGE_OR_MEDICAL_ADVICE);
  check("detox_instructions", DETOX_INSTRUCTIONS);
  check("unsafe_alcohol_guidance", UNSAFE_ALCOHOL_GUIDANCE);
  check("false_reassurance", FALSE_REASSURANCE);
  check("internal_policy_leakage", INTERNAL_POLICY_LEAKAGE);

  return triggered;
}

function hasSelfHarmEscalationLanguage(draft: string): boolean {
  return /emergency|crisis|trusted person|trusted crisis|help now|urgent support/i.test(
    draft,
  );
}

function hasMedicalEscalationLanguage(draft: string): boolean {
  return /emergency|medical help|urgent|emergency department|local emergency services/i.test(
    draft,
  );
}

export function finalGuard({
  draft,
  category,
}: {
  draft: string;
  category: RiskCategory;
}): GuardResult {
  const normalizedDraft = draft.trim();

  if (!normalizedDraft) {
    return {
      action: "replace_with_fallback",
      finalText: getTemplate("fallback_safe"),
      triggeredRules: ["empty_draft"],
    };
  }

  if (
    category === "self_harm_or_immediate_danger" &&
    !hasSelfHarmEscalationLanguage(normalizedDraft)
  ) {
    return {
      action: "replace_with_escalation",
      finalText: getTemplate("self_harm_escalation"),
      triggeredRules: ["missing_self_harm_escalation"],
    };
  }

  if (
    category === "possible_medical_emergency" &&
    !hasMedicalEscalationLanguage(normalizedDraft)
  ) {
    return {
      action: "replace_with_escalation",
      finalText: getTemplate("medical_emergency_escalation"),
      triggeredRules: ["missing_medical_escalation"],
    };
  }

  const triggeredRules = collectTriggeredRules(normalizedDraft);

  if (triggeredRules.length === 0) {
    return {
      action: "allow",
      finalText: normalizedDraft,
      triggeredRules: [],
    };
  }

  if (triggeredRules.includes("dosage_or_medical_advice")) {
    return {
      action: "replace_with_refusal",
      finalText: getTemplate("medication_refusal"),
      triggeredRules,
    };
  }

  if (triggeredRules.includes("detox_instructions")) {
    return {
      action: "replace_with_refusal",
      finalText: getTemplate("withdrawal_detox_referral"),
      triggeredRules,
    };
  }

  if (triggeredRules.includes("unsafe_alcohol_guidance")) {
    return {
      action: "replace_with_refusal",
      finalText: getTemplate("unsafe_alcohol_refusal"),
      triggeredRules,
    };
  }

  if (
    triggeredRules.includes("false_reassurance") &&
    category === "possible_medical_emergency"
  ) {
    return {
      action: "replace_with_escalation",
      finalText: getTemplate("medical_emergency_escalation"),
      triggeredRules,
    };
  }

  if (
    triggeredRules.includes("false_reassurance") &&
    category === "self_harm_or_immediate_danger"
  ) {
    return {
      action: "replace_with_escalation",
      finalText: getTemplate("self_harm_escalation"),
      triggeredRules,
    };
  }

  return {
    action: "replace_with_fallback",
    finalText: getTemplate("fallback_safe"),
    triggeredRules,
  };
}