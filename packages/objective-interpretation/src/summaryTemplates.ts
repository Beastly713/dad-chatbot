import {
  OBJECTIVE_SUMMARY_TEMPLATE_VERSION,
  type ObjectiveInterpretationDecision,
  type ObjectiveInterpretationLabel,
  type ObjectiveInterpretationSummary,
  type ObjectiveSummaryTemplateId
} from "./types.js";

function clinicianOnlyVisibility() {
  return {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false
  } as const;
}

function templateForLabel(
  label: ObjectiveInterpretationLabel
): ObjectiveSummaryTemplateId {
  switch (label) {
    case "baseline_or_low_arousal_evidence":
      return "baseline_or_low_arousal_summary";
    case "elevated_physiological_arousal_evidence":
      return "elevated_arousal_summary";
    case "recovery_cooldown_evidence":
      return "recovery_cooldown_summary";
    case "suppressed_for_quality":
      return "quality_suppressed_summary";
    case "motion_confounded_evidence":
      return "motion_confounded_summary";
    case "signal_conflict_uncertain":
      return "signal_conflict_summary";
    case "insufficient_reliable_data":
      return "insufficient_data_summary";
  }
}

function titleForTemplate(templateId: ObjectiveSummaryTemplateId): string {
  switch (templateId) {
    case "baseline_or_low_arousal_summary":
      return "Baseline or low arousal evidence";
    case "elevated_arousal_summary":
      return "Elevated physiological arousal evidence";
    case "recovery_cooldown_summary":
      return "Recovery or cooldown evidence";
    case "quality_suppressed_summary":
      return "Suppressed because signal quality is limited";
    case "motion_confounded_summary":
      return "Motion-confounded physiological evidence";
    case "signal_conflict_summary":
      return "Uncertain evidence because signals conflict";
    case "insufficient_data_summary":
      return "Insufficient reliable data";
  }
}

function headlineForDecision(decision: ObjectiveInterpretationDecision): string {
  switch (decision.interpretation_label) {
    case "baseline_or_low_arousal_evidence":
      return "The current window is closest to the available baseline or low-arousal pattern.";
    case "elevated_physiological_arousal_evidence":
      return "The current window shows baseline-relative elevated physiological arousal evidence.";
    case "recovery_cooldown_evidence":
      return "The current window shows a recovery or cooldown pattern relative to the available baseline.";
    case "suppressed_for_quality":
      return "This window should not be used for evidence because signal quality is limited.";
    case "motion_confounded_evidence":
      return "This window is confounded by motion and should be reviewed cautiously.";
    case "signal_conflict_uncertain":
      return "This window contains conflicting signal evidence and should be treated as uncertain.";
    case "insufficient_reliable_data":
      return "There is not enough reliable information in this window to support a physiological evidence statement.";
  }
}

function detailLines(decision: ObjectiveInterpretationDecision): string[] {
  const lines = [
    `Evidence level: ${decision.evidence_level}.`,
    `Confidence: ${decision.confidence_label}.`,
    `Suppression state: ${decision.suppression_state}.`,
    `Source banner: ${decision.source_banner}.`
  ];

  if (decision.contributing_modalities.length > 0) {
    lines.push(
      `Contributing modalities: ${decision.contributing_modalities.join(", ")}.`
    );
  }

  if (decision.excluded_modalities.length > 0) {
    lines.push(`Excluded modalities: ${decision.excluded_modalities.join(", ")}.`);
  }

  return lines;
}

function cautionLines(decision: ObjectiveInterpretationDecision): string[] {
  const lines = [
    "Use this as bounded physiological evidence for clinician review.",
    "Do not treat this output as a standalone determination."
  ];

  if (decision.suppression_state !== "not_suppressed") {
    lines.push("The suppression state should limit use of this window.");
  }

  if (decision.uncertainty_reasons.length > 0) {
    lines.push(`Uncertainty reasons: ${decision.uncertainty_reasons.join(", ")}.`);
  }

  return lines;
}

function reviewFocus(decision: ObjectiveInterpretationDecision): string[] {
  const focus = ["Review baseline state, signal quality, and uncertainty reasons."];

  if (decision.excluded_modalities.length > 0) {
    focus.push("Review excluded modalities before comparing this window with others.");
  }

  if (decision.suppression_state === "suppressed_motion_confound") {
    focus.push("Review motion context before relying on the physiological pattern.");
  }

  if (decision.suppression_state === "suppressed_signal_conflict") {
    focus.push("Review cross-signal disagreement before using this window.");
  }

  if (decision.suppression_state === "suppressed_missing_baseline") {
    focus.push("Review whether enough baseline windows are available.");
  }

  return focus;
}

function renderSummaryText(options: {
  title: string;
  headline: string;
  detail_lines: string[];
  caution_lines: string[];
  review_focus: string[];
}): string {
  return [
    options.title,
    "",
    options.headline,
    "",
    "Details:",
    ...options.detail_lines.map((line) => `- ${line}`),
    "",
    "Cautions:",
    ...options.caution_lines.map((line) => `- ${line}`),
    "",
    "Review focus:",
    ...options.review_focus.map((line) => `- ${line}`)
  ].join("\n");
}

export function createObjectiveInterpretationSummary(
  decision: ObjectiveInterpretationDecision
): ObjectiveInterpretationSummary {
  if (
    decision.visibility.clinician_visible !== true ||
    decision.visibility.patient_visible !== false ||
    decision.visibility.chatbot_visible !== false
  ) {
    throw new Error("interpretation decision visibility must be clinician-only");
  }

  const templateId = templateForLabel(decision.interpretation_label);
  const title = titleForTemplate(templateId);
  const headline = headlineForDecision(decision);
  const details = detailLines(decision);
  const cautions = cautionLines(decision);
  const focus = reviewFocus(decision);

  return {
    summary_version: OBJECTIVE_SUMMARY_TEMPLATE_VERSION,
    template_id: templateId,
    interpretation_label: decision.interpretation_label,
    evidence_level: decision.evidence_level,
    confidence_label: decision.confidence_label,
    suppression_state: decision.suppression_state,
    title,
    headline,
    detail_lines: details,
    caution_lines: cautions,
    review_focus: focus,
    rendered_summary_text: renderSummaryText({
      title,
      headline,
      detail_lines: details,
      caution_lines: cautions,
      review_focus: focus
    }),
    trace: decision.trace,
    visibility: clinicianOnlyVisibility()
  };
}
