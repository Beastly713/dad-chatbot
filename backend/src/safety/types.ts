export type RiskCategory =
  | "self_harm_or_immediate_danger"
  | "possible_medical_emergency"
  | "withdrawal_or_detox_concern"
  | "medication_or_dosage_request"
  | "unsafe_alcohol_request"
  | "alcohol_craving"
  | "lapse_or_relapse"
  | "general_support"
  | "prompt_injection_or_policy_bypass"
  | "out_of_scope";

export const RISK_CATEGORY_PRIORITY: RiskCategory[] = [
  "self_harm_or_immediate_danger",
  "possible_medical_emergency",
  "withdrawal_or_detox_concern",
  "medication_or_dosage_request",
  "unsafe_alcohol_request",
  "alcohol_craving",
  "lapse_or_relapse",
  "general_support",
  "prompt_injection_or_policy_bypass",
  "out_of_scope",
];

export type ResponseMode =
  | "self_harm_escalation"
  | "medical_emergency_escalation"
  | "withdrawal_detox_referral"
  | "medical_refusal"
  | "unsafe_alcohol_refusal"
  | "craving_support"
  | "lapse_support"
  | "general_support"
  | "policy_bypass_refusal"
  | "out_of_scope_refusal";

export type TemplateId =
  | "self_harm_escalation"
  | "medical_emergency_escalation"
  | "withdrawal_detox_referral"
  | "medication_refusal"
  | "unsafe_alcohol_refusal"
  | "policy_bypass_refusal"
  | "out_of_scope"
  | "fallback_safe";

export type KBFilter = {
  source: "internal_kb";
  substance: "alcohol";
  riskCategory: "general_support" | "alcohol_craving" | "lapse_or_relapse";
  userVisible: boolean;
  approved: boolean;
};

export type ResponsePolicy = {
  category: RiskCategory;
  mode: ResponseMode;
  useTemplateOnly: boolean;
  allowRAG: boolean;
  kbFilter?: KBFilter;
  templateId?: TemplateId;
  required: string[];
  forbidden: string[];
  maxWords: number;
};

export type TriageResult = {
  category: RiskCategory;
  confidence: number;
  matchedRules: string[];
  needsTemplate: boolean;
  allowRAG: boolean;
};

export type GuardAction =
  | "allow"
  | "replace_with_refusal"
  | "replace_with_escalation"
  | "replace_with_fallback";

export type GuardResult = {
  action: GuardAction;
  finalText: string;
  triggeredRules: string[];
};

export type SafetyDebugLog = {
  timestamp: string;
  threadId?: string;
  category: RiskCategory;
  responseMode: ResponseMode;
  path: "template" | "rag";
  retrievedDocCount?: number;
  templateId?: TemplateId;
  guardAction: GuardAction;
  triggeredRules: string[];
};