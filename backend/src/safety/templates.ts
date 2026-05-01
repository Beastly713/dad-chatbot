import type { TemplateId } from "./types.js";

export const TEMPLATES: Record<TemplateId, string> = {
  medical_emergency_escalation:
    "This sounds like it could be serious. Please treat it as a possible medical emergency and contact local emergency services now, or go to the nearest emergency department if you can do so safely. I’m not able to assess or manage this here, but getting real-world medical help quickly is the safest next step.",

  self_harm_escalation:
    "I’m really sorry you’re feeling this way. I’m not able to keep you safe in real life, and this may need urgent support. Please contact local emergency services or a trusted crisis helpline now. If there is someone nearby you trust, please reach out to them and do not stay alone while you feel at risk.",

  withdrawal_detox_referral:
    "Alcohol withdrawal can sometimes be serious, and I can’t guide you through detox or withdrawal management. Please contact a healthcare professional, local urgent care, or emergency services if you feel very unwell or unsafe.",

  medication_refusal:
    "I’m sorry, but I can’t give medication or dosage advice. It’s safest to ask a qualified healthcare professional or pharmacist about that.",

  unsafe_alcohol_refusal:
    "I’m sorry, but I can’t help with advice that could make alcohol use more dangerous, including mixing alcohol with medications or hiding drinking. If alcohol and medications are involved, it’s safest to ask a healthcare professional or pharmacist. I can still help you talk through what is making drinking feel hard to resist right now.",

  policy_bypass_refusal:
    "I’m sorry, but I can’t comply with that request.",

  out_of_scope:
    "I’m here to support alcohol-related recovery, cravings, lapses, and safety-focused conversations. I may not be the right tool for that topic.",

  fallback_safe:
    "I’m sorry, but I can’t safely help with that. If there may be immediate danger, please contact local emergency services or a trusted person nearby.",
};

export function getTemplate(id: TemplateId): string {
  return TEMPLATES[id] ?? TEMPLATES.fallback_safe;
}