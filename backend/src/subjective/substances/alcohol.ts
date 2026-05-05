import type { CheckInQuestion, SubstanceId } from "../types.js";

export const ALCOHOL_SUBSTANCE_ID: SubstanceId = "alcohol";

export const alcoholCheckInQuestions: CheckInQuestion[] = [
  {
    field: "craving_level",
    prompt: "How strong is the urge to drink right now?",
    helperText: "A quick estimate is enough. You can skip this.",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "Not much", value: "low" },
      { label: "Mild", value: "low" },
      { label: "Moderate", value: "moderate" },
      { label: "Strong", value: "high" },
      { label: "Very strong", value: "very_high" },
      { label: "Unsure", value: "unclear" },
    ],
  },
  {
    field: "distress_level",
    prompt: "How overwhelmed are you feeling right now?",
    helperText: "This is only to tailor support, not to diagnose anything.",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "Okay", value: "low" },
      { label: "A little overwhelmed", value: "moderate" },
      { label: "Moderate", value: "moderate" },
      { label: "Very overwhelmed", value: "high" },
      { label: "Unsure", value: "unclear" },
    ],
  },
  {
    field: "coping_confidence",
    prompt:
      "How confident do you feel about getting through the next few minutes safely?",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "High", value: "high" },
      { label: "Medium", value: "moderate" },
      { label: "Low", value: "low" },
      { label: "Unsure", value: "unclear" },
    ],
  },
  {
    field: "alcohol_availability",
    prompt: "Is alcohol nearby right now?",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "Nearby", value: "nearby" },
      { label: "Not nearby", value: "not_nearby" },
      { label: "Unsure", value: "unclear" },
    ],
  },
  {
    field: "support_preference",
    prompt: "What kind of support would help most right now?",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "Grounding", value: "grounding" },
      { label: "One practical step", value: "practical_step" },
      { label: "A bit of reflection", value: "reflection" },
      { label: "Encouragement", value: "encouragement" },
      { label: "Reach out to someone", value: "contact_someone" },
      { label: "Skip", value: "skip" },
    ],
  },
  {
    field: "recent_use_status",
    prompt: "Has there been any recent drinking or a lapse you want support around?",
    inputType: "chips",
    required: false,
    allowSkip: true,
    options: [
      { label: "No recent drinking", value: "none_disclosed" },
      { label: "Recent drinking", value: "recent_drinking" },
      { label: "A lapse happened", value: "lapse_disclosed" },
      { label: "Ongoing drinking", value: "ongoing_drinking" },
      { label: "Unsure", value: "unclear" },
    ],
  },
];

export const alcoholSafetySubflagLabels = {
  unsafe_driving: "Unsafe driving after drinking",
  alcohol_medication_mix: "Alcohol and medication mixing concern",
  possible_withdrawal_red_flag: "Possible alcohol withdrawal red flag",
  possible_medical_emergency_red_flag: "Possible medical emergency red flag",
} as const;