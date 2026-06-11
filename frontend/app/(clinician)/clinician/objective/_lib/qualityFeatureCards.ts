export type ObjectiveQualityLevel =
  | "usable"
  | "limited"
  | "insufficient"
  | "not_available";

export type ObjectiveQualityCardKind =
  | "ecg_quality"
  | "gsr_quality"
  | "ppg_quality"
  | "motion_activity_context"
  | "temperature_contact_context"
  | "timing_quality"
  | "baseline_state"
  | "missingness";

export type ObjectiveQualityCard = {
  kind: ObjectiveQualityCardKind;
  title: string;
  level: ObjectiveQualityLevel;
  valueLabel: string;
  summary: string;
  technicalLimitations: string[];
  supportingDetails: string[];
};

export type ObjectiveFeatureSummaryCard = {
  title: string;
  valueLabel: string;
  summary: string;
  sourceContext: string;
};

export type ObjectiveQualityFeatureSummary = {
  qualityCards: ObjectiveQualityCard[];
  featureCards: ObjectiveFeatureSummaryCard[];
};

export function getObjectiveQualityLevelLabel(
  level: ObjectiveQualityLevel,
): string {
  switch (level) {
    case "usable":
      return "Usable";
    case "limited":
      return "Limited";
    case "insufficient":
      return "Insufficient";
    case "not_available":
    default:
      return "Not available";
  }
}

export function createObjectiveDemoQualityFeatureSummary(): ObjectiveQualityFeatureSummary {
  return {
    qualityCards: [
      {
        kind: "ecg_quality",
        title: "ECG quality",
        level: "usable",
        valueLabel: "R-peak structure visible",
        summary:
          "Heart-activity waveform quality is usable for chart review in this demo shell.",
        technicalLimitations: [
          "Movement can reduce confidence in short windows.",
          "This card summarizes signal usability, not heart health.",
        ],
        supportingDetails: [
          "Downsampled ECG preview is available.",
          "Timing is tied to session-relative milliseconds.",
        ],
      },
      {
        kind: "gsr_quality",
        title: "GSR quality",
        level: "usable",
        valueLabel: "Slow trend available",
        summary:
          "Skin-conductance trend quality is usable for source-bound arousal context.",
        technicalLimitations: [
          "GSR changes slowly and should be reviewed over longer windows.",
          "Contact shifts can make short-window changes less reliable.",
        ],
        supportingDetails: [
          "Trend-style review is more useful than isolated samples.",
          "Interpretation depends on baseline and context.",
        ],
      },
      {
        kind: "ppg_quality",
        title: "PPG quality",
        level: "limited",
        valueLabel: "Optical waveform preview",
        summary:
          "PPG preview is available as a secondary pulse-waveform context signal.",
        technicalLimitations: [
          "Motion and placement can reduce optical waveform reliability.",
          "This card does not estimate oxygen saturation.",
        ],
        supportingDetails: [
          "PPG is treated as redundancy/context, not a standalone conclusion.",
          "Agreement with other signals is reviewed later by feature logic.",
        ],
      },
      {
        kind: "motion_activity_context",
        title: "Motion/activity context",
        level: "limited",
        valueLabel: "Movement context present",
        summary:
          "Motion context is available to help identify artifact-sensitive windows.",
        technicalLimitations: [
          "Motion context is technical artifact context only.",
          "It should not be used to infer behavior or intent.",
        ],
        supportingDetails: [
          "Movement can explain changes in ECG or PPG preview quality.",
          "Stillness fraction and motion magnitude are reviewed as context.",
        ],
      },
      {
        kind: "temperature_contact_context",
        title: "Temperature/contact context",
        level: "usable",
        valueLabel: "Local trend available",
        summary:
          "Local temperature/contact context is available for source-quality review.",
        technicalLimitations: [
          "TMP117-style local temperature is not core temperature.",
          "MPU temperature is device-health context only.",
        ],
        supportingDetails: [
          "Local contact shifts can affect signal quality.",
          "Device heating is reviewed separately from physiology.",
        ],
      },
      {
        kind: "timing_quality",
        title: "Timing quality",
        level: "usable",
        valueLabel: "Session timing aligned",
        summary:
          "Session-relative timing is available for chart and feature-window alignment.",
        technicalLimitations: [
          "Laptop save time is contextual metadata, not the primary signal clock.",
          "Device resets or timing gaps should be treated as segmentation context.",
        ],
        supportingDetails: [
          "Session-relative milliseconds are used for chart alignment.",
          "Timing gaps are reviewed as technical traceability events.",
        ],
      },
      {
        kind: "baseline_state",
        title: "Baseline state",
        level: "limited",
        valueLabel: "Baseline context pending",
        summary:
          "Baseline-relative interpretation is limited until enough usable baseline context exists.",
        technicalLimitations: [
          "Without a stable baseline, evidence strength should be reduced.",
          "Baseline state is a readiness signal, not a clinical status.",
        ],
        supportingDetails: [
          "Baseline availability affects confidence in later interpretation.",
          "Within-person trend review is preferred over one-shot conclusions.",
        ],
      },
      {
        kind: "missingness",
        title: "Missingness",
        level: "usable",
        valueLabel: "No large gaps in demo preview",
        summary:
          "The demo shell has enough chart-ready points to show a bounded preview.",
        technicalLimitations: [
          "Missing samples reduce feature readiness.",
          "Suppressed or unavailable windows should be reviewed as data limitations.",
        ],
        supportingDetails: [
          "Missingness is reviewed per modality.",
          "No raw payload is exposed in this dashboard card.",
        ],
      },
    ],
    featureCards: [
      {
        title: "Heart-activity trend",
        valueLabel: "Preview available",
        summary:
          "ECG-derived trend context can support baseline-relative review after quality checks.",
        sourceContext: "Source-bound chart-ready ECG preview.",
      },
      {
        title: "Skin-conductance trend",
        valueLabel: "Trend available",
        summary:
          "GSR trend context can support slow autonomic arousal review after baseline checks.",
        sourceContext: "Source-bound chart-ready GSR trend.",
      },
      {
        title: "Pulse-waveform context",
        valueLabel: "Secondary context",
        summary:
          "PPG preview can provide redundant waveform context when optical quality is usable.",
        sourceContext: "Source-bound chart-ready optical waveform preview.",
      },
      {
        title: "Motion confound context",
        valueLabel: "Context present",
        summary:
          "Motion context can explain degraded ECG or PPG windows and reduce confidence.",
        sourceContext: "Technical artifact/context signal.",
      },
    ],
  };
}
