import type { RiskCategory } from "../safety/types.js";
import type {
  CheckInField,
  CheckInPlan,
  SubjectiveState,
} from "./types.js";
import { createDefaultSubjectiveState } from "./types.js";
import { hasRecentSkip } from "./freshness.js";
import { selectAlcoholCheckInQuestions } from "./questions.js";

const SAFE_SUPPORT_CATEGORIES: RiskCategory[] = [
  "alcohol_craving",
  "lapse_or_relapse",
  "general_support",
];

function isSafeSupportCategory(category: RiskCategory): boolean {
  return SAFE_SUPPORT_CATEGORIES.includes(category);
}

function isHighLevel(level: SubjectiveState["cravingLevel"]): boolean {
  return level === "high" || level === "very_high";
}

function hasAnySafetySubflag(state: SubjectiveState): boolean {
  return Object.values(state.safetySubflags).some(Boolean);
}

function buildAskPlan(fields: CheckInField[], reason: string): CheckInPlan {
  return {
    action: "ask_checkin",
    questions: selectAlcoholCheckInQuestions(fields).slice(0, 3),
    reason,
  };
}

export function planSubjectiveCheckIn(params: {
  safetyCategory: RiskCategory;
  subjectiveState?: SubjectiveState;
  now?: Date;
}): CheckInPlan {
  const now = params.now ?? new Date();
  const state = params.subjectiveState ?? createDefaultSubjectiveState();

  if (!isSafeSupportCategory(params.safetyCategory)) {
    return {
      action: "skip_checkin",
      questions: [],
      reason: "template_only_category",
    };
  }

  if (hasAnySafetySubflag(state)) {
    return {
      action: "skip_checkin",
      questions: [],
      reason: "safety_subflag_present",
    };
  }

  if (hasRecentSkip(state, now) || state.supportPreference === "skip") {
    return {
      action: "skip_checkin",
      questions: [],
      reason: "recent_checkin_decline",
    };
  }

  if (params.safetyCategory === "alcohol_craving") {
    if (
      state.cravingLevel === "unclear" &&
      state.copingConfidence === "unclear" &&
      state.supportPreference === "unclear"
    ) {
      return buildAskPlan(
        ["craving_level", "coping_confidence", "support_preference"],
        "craving_support_needs_core_state",
      );
    }

    if (isHighLevel(state.cravingLevel) && state.alcoholAvailability === "unclear") {
      return buildAskPlan(
        ["alcohol_availability", "coping_confidence", "support_preference"],
        "high_craving_needs_availability_context",
      );
    }

    return {
      action: "continue",
      questions: [],
      reason: "enough_craving_state",
    };
  }

  if (params.safetyCategory === "lapse_or_relapse") {
    if (state.shameCue || state.recentUseStatus === "lapse_disclosed") {
      if (
        state.supportPreference === "unclear" ||
        state.distressLevel === "unclear"
      ) {
        return buildAskPlan(
          ["support_preference", "distress_level"],
          "lapse_or_shame_needs_support_preference",
        );
      }
    }

    return {
      action: "continue",
      questions: [],
      reason: "enough_lapse_state",
    };
  }

  if (params.safetyCategory === "general_support") {
    if (
      state.distressLevel === "unclear" &&
      state.supportPreference === "unclear"
    ) {
      return buildAskPlan(
        ["distress_level", "support_preference"],
        "general_support_needs_light_context",
      );
    }

    return {
      action: "continue",
      questions: [],
      reason: "enough_general_state",
    };
  }

  return {
    action: "continue",
    questions: [],
    reason: "default_continue",
  };
}