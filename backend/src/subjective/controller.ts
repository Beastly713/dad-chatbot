import type {
  ResponseControl,
  SubjectiveState,
  SupportPreference,
} from "./types.js";
import {
  createDefaultResponseControl,
  createDefaultSubjectiveState,
} from "./types.js";

function isHigh(level: SubjectiveState["cravingLevel"]): boolean {
  return level === "high" || level === "very_high";
}

function isLow(level: SubjectiveState["copingConfidence"]): boolean {
  return level === "low" || level === "none";
}

function hasAnySafetySubflag(state: SubjectiveState): boolean {
  return Object.values(state.safetySubflags).some(Boolean);
}

function controlFromPreference(
  preference: SupportPreference,
): ResponseControl | null {
  if (preference === "grounding") {
    return {
      tone: "grounding",
      maxWordsOverride: 120,
      supportStrategy: "grounding_first",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Start with grounding.",
        "Keep the response calm and immediate.",
      ],
      kbStateTags: ["grounding"],
    };
  }

  if (preference === "practical_step") {
    return {
      tone: "practical",
      maxWordsOverride: 100,
      supportStrategy: "immediate_coping",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Give one practical next step.",
        "Avoid long reflection.",
      ],
      kbStateTags: ["one_next_step"],
    };
  }

  if (preference === "reflection") {
    return {
      tone: "reflective",
      maxWordsOverride: 150,
      supportStrategy: "lapse_reflection",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_only",
      promptStyleHints: [
        "Use brief compassionate reflection.",
        "End with one safe next step.",
      ],
      kbStateTags: ["reflection"],
    };
  }

  if (preference === "encouragement") {
    return {
      tone: "encouraging",
      maxWordsOverride: 120,
      supportStrategy: "generic_support",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_only",
      promptStyleHints: ["Use warm encouragement without false reassurance."],
      kbStateTags: ["encouragement"],
    };
  }

  if (preference === "contact_someone") {
    return {
      tone: "practical",
      maxWordsOverride: 120,
      supportStrategy: "contact_support",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Suggest contacting one safe supportive person.",
        "Keep the suggestion concrete and low-pressure.",
      ],
      kbStateTags: ["contact_support"],
    };
  }

  return null;
}

export function deriveResponseControl(
  subjectiveState?: SubjectiveState,
): ResponseControl {
  const state = subjectiveState ?? createDefaultSubjectiveState();

  if (hasAnySafetySubflag(state)) {
    return {
      tone: "warm",
      maxWordsOverride: 120,
      supportStrategy: "escalation_only",
      shouldAskFollowup: false,
      allowedResponseInfluence: "escalation_only",
      promptStyleHints: [
        "Do not personalize normal support.",
        "Use the appropriate deterministic safety template.",
      ],
      kbStateTags: [],
    };
  }

  if (isHigh(state.distressLevel) && isHigh(state.cravingLevel)) {
    return {
      tone: "grounding",
      maxWordsOverride: 110,
      supportStrategy: "grounding_first",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Grounding first.",
        "Use simple language.",
        "Give one stabilizing step before reflection.",
      ],
      kbStateTags: ["high_distress", "high_craving", "grounding"],
    };
  }

  if (isHigh(state.cravingLevel) && state.alcoholAvailability === "nearby") {
    return {
      tone: "practical",
      maxWordsOverride: 100,
      supportStrategy: "immediate_coping",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Prioritize creating distance from alcohol.",
        "Suggest a short delay and a concrete environment change.",
        "Avoid abstract reflection.",
      ],
      kbStateTags: ["high_craving", "alcohol_nearby", "environment_change"],
    };
  }

  if (isHigh(state.cravingLevel) && isLow(state.copingConfidence)) {
    return {
      tone: "practical",
      maxWordsOverride: 90,
      supportStrategy: "immediate_coping",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Keep it very short.",
        "Offer one or two immediate coping steps.",
        "Reduce choices.",
      ],
      kbStateTags: ["high_craving", "low_confidence", "immediate_coping"],
    };
  }

  if (state.recentUseStatus === "lapse_disclosed" && state.shameCue) {
    return {
      tone: "warm",
      maxWordsOverride: 130,
      supportStrategy: "lapse_reflection",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_plus_coping",
      promptStyleHints: [
        "Use explicitly nonjudgmental language.",
        "Frame the lapse as information, not failure.",
        "Offer one stabilizing next step.",
      ],
      kbStateTags: ["lapse", "shame_sensitive", "nonjudgmental_reset"],
    };
  }

  const preferenceControl = controlFromPreference(state.supportPreference);
  if (preferenceControl) {
    return preferenceControl;
  }

  if (
    state.uncertainty.level === "high" ||
    state.vagueAnswer ||
    state.skippedFields.length > 0
  ) {
    return {
      tone: "warm",
      maxWordsOverride: 120,
      supportStrategy: "generic_support",
      shouldAskFollowup: false,
      allowedResponseInfluence: "style_only",
      promptStyleHints: [
        "Use generic support.",
        "Do not infer details.",
        "Keep assumptions low.",
      ],
      kbStateTags: ["generic_support", "uncertain_state"],
    };
  }

  return createDefaultResponseControl();
}