import type {
  ResponseControl,
  SubjectiveState,
} from "../subjective/types.js";

function describeOrdinal(label: string, value: string): string | null {
  if (value === "unclear") return null;
  if (value === "none") return `${label}: none reported.`;
  return `${label}: ${value.replace("_", " ")}.`;
}

function describeSupportPreference(value: string): string | null {
  if (value === "unclear") return null;
  if (value === "skip") return "User skipped or declined extra check-in detail.";
  return `Preferred support: ${value.replace("_", " ")}.`;
}

function describeRecentUse(value: string): string | null {
  if (value === "none_disclosed" || value === "unclear") return null;
  return `Recent alcohol-use context: ${value.replace("_", " ")}.`;
}

function describeAlcoholAvailability(value: string): string | null {
  if (value === "unclear") return null;
  if (value === "nearby") return "Alcohol may be nearby.";
  if (value === "not_nearby") return "Alcohol is not reported nearby.";
  return null;
}

function describeSocialContext(value: string): string | null {
  if (value === "unclear") return null;
  return `Social context: ${value.replace("_", " ")}.`;
}

function sanitizeHint(hint: string): string | null {
  const lowered = hint.toLowerCase();

  const forbidden =
    lowered.includes("diagnosis") ||
    lowered.includes("score") ||
    lowered.includes("ciwa") ||
    lowered.includes("withdrawal stage") ||
    lowered.includes("treatment plan") ||
    lowered.includes("internal policy") ||
    lowered.includes("system prompt");

  if (forbidden) return null;

  return hint;
}

export function buildSubjectiveStateSummary(params: {
  subjectiveState?: SubjectiveState;
  responseControl?: ResponseControl;
}): string {
  const { subjectiveState, responseControl } = params;

  if (!subjectiveState) {
    return [
      "Current support context:",
      "- No fresh subjective check-in detail is available.",
      "- Use generic safe alcohol-support style.",
      "- Do not infer details that were not shared.",
    ].join("\n");
  }

  const lines: string[] = ["Current support context:"];

  const craving = describeOrdinal("User-reported craving", subjectiveState.cravingLevel);
  const distress = describeOrdinal("User-reported distress", subjectiveState.distressLevel);
  const confidence = describeOrdinal(
    "User-reported coping confidence",
    subjectiveState.copingConfidence,
  );
  const preference = describeSupportPreference(subjectiveState.supportPreference);
  const recentUse = describeRecentUse(subjectiveState.recentUseStatus);
  const availability = describeAlcoholAvailability(subjectiveState.alcoholAvailability);
  const social = describeSocialContext(subjectiveState.socialContext);

  for (const item of [
    craving,
    distress,
    confidence,
    preference,
    recentUse,
    availability,
    social,
  ]) {
    if (item) lines.push(`- ${item}`);
  }

  if (subjectiveState.shameCue) {
    lines.push("- Shame or self-blame may be present; use nonjudgmental language.");
  }

  if (subjectiveState.triggerContext.length > 0) {
    lines.push(
      `- Context tags: ${subjectiveState.triggerContext
        .map((tag) => tag.replace("_", " "))
        .join(", ")}.`,
    );
  }

  if (
    subjectiveState.uncertainty.level === "high" ||
    subjectiveState.skippedFields.length > 0 ||
    subjectiveState.vagueAnswer ||
    subjectiveState.contradictionHint
  ) {
    lines.push(
      "- Uncertainty is high or details are limited; avoid strong assumptions.",
    );
  }

  if (responseControl) {
    lines.push(
      `- Response strategy: ${responseControl.supportStrategy.replace("_", " ")}.`,
    );

    if (responseControl.promptStyleHints.length > 0) {
      for (const hint of responseControl.promptStyleHints) {
        const sanitized = sanitizeHint(hint);
        if (sanitized) lines.push(`- Style hint: ${sanitized}`);
      }
    }
  }

  if (lines.length === 1) {
    lines.push("- No specific subjective support details are available.");
    lines.push("- Use generic safe alcohol-support style.");
  }

  return lines.join("\n");
}