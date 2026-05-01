import type { ResponsePolicy, RiskCategory } from "./types.js";

export const RESPONSE_POLICIES: Record<RiskCategory, ResponsePolicy> = {
  self_harm_or_immediate_danger: {
    category: "self_harm_or_immediate_danger",
    mode: "self_harm_escalation",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "self_harm_escalation",
    required: [
      "empathy",
      "local emergency/crisis support",
      "do not stay alone if unsafe",
    ],
    forbidden: ["methods", "minimization", "false reassurance"],
    maxWords: 120,
  },

  possible_medical_emergency: {
    category: "possible_medical_emergency",
    mode: "medical_emergency_escalation",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "medical_emergency_escalation",
    required: ["urgent medical help", "local emergency services"],
    forbidden: ["medical diagnosis", "home treatment", "wait it out"],
    maxWords: 100,
  },

  withdrawal_or_detox_concern: {
    category: "withdrawal_or_detox_concern",
    mode: "withdrawal_detox_referral",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "withdrawal_detox_referral",
    required: ["withdrawal can be serious", "professional help"],
    forbidden: ["detox steps", "dosage", "diagnosis"],
    maxWords: 100,
  },

  medication_or_dosage_request: {
    category: "medication_or_dosage_request",
    mode: "medical_refusal",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "medication_refusal",
    required: [
      "cannot give medication/dosage advice",
      "healthcare professional",
    ],
    forbidden: ["drug dose", "medicine recommendation"],
    maxWords: 80,
  },

  unsafe_alcohol_request: {
    category: "unsafe_alcohol_request",
    mode: "unsafe_alcohol_refusal",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "unsafe_alcohol_refusal",
    required: ["cannot help with unsafe request", "safe redirect"],
    forbidden: [
      "tips for drinking",
      "hiding drinking",
      "evading detection",
      "mixing advice",
    ],
    maxWords: 90,
  },

  alcohol_craving: {
    category: "alcohol_craving",
    mode: "craving_support",
    useTemplateOnly: false,
    allowRAG: true,
    kbFilter: {
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
    },
    required: ["validate urge", "coping step", "short next action"],
    forbidden: ["permission to drink", "shame", "medical advice"],
    maxWords: 180,
  },

  lapse_or_relapse: {
    category: "lapse_or_relapse",
    mode: "lapse_support",
    useTemplateOnly: false,
    allowRAG: true,
    kbFilter: {
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
    },
    required: ["nonjudgmental tone", "encouragement", "next safe step"],
    forbidden: [
      "shame",
      "permission to continue drinking",
      "medical advice",
    ],
    maxWords: 180,
  },

  general_support: {
    category: "general_support",
    mode: "general_support",
    useTemplateOnly: false,
    allowRAG: true,
    kbFilter: {
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
    },
    required: ["empathy", "supportive response"],
    forbidden: ["diagnosis", "medical advice", "unsafe alcohol guidance"],
    maxWords: 180,
  },

  prompt_injection_or_policy_bypass: {
    category: "prompt_injection_or_policy_bypass",
    mode: "policy_bypass_refusal",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "policy_bypass_refusal",
    required: ["refusal"],
    forbidden: ["policy details", "jailbreak compliance"],
    maxWords: 50,
  },

  out_of_scope: {
    category: "out_of_scope",
    mode: "out_of_scope_refusal",
    useTemplateOnly: true,
    allowRAG: false,
    templateId: "out_of_scope",
    required: ["brief scope statement"],
    forbidden: ["extended unrelated answer"],
    maxWords: 60,
  },
};

export function getPolicyForCategory(category: RiskCategory): ResponsePolicy {
  return RESPONSE_POLICIES[category];
}