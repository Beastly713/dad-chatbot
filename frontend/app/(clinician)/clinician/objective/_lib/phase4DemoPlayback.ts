import {
  getPhase4DemoScenarioById,
  PHASE4_DEMO_SCENARIO_IDS,
  type Phase4DemoInterpretationLabel,
  type Phase4DemoScenarioId,
} from "./phase4DemoScenarios";

export type Phase4DemoPlaybackStatus =
  | "ready"
  | "running"
  | "paused"
  | "complete";

export type Phase4DemoPipelineStageStatus =
  | "pending"
  | "active"
  | "complete";

export type Phase4DemoSignalChannel = Readonly<{
  label: string;
  detail: string;
  values: readonly number[];
  accentClass: string;
}>;

export type Phase4DemoMetric = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

export type Phase4DemoTimelineEvent = Readonly<{
  atSecond: number;
  label: string;
  detail: string;
}>;

export type Phase4DemoPipelineStage = Readonly<{
  label: string;
  thresholdPercent: number;
}>;

export type Phase4DemoPipelineStageSnapshot = Phase4DemoPipelineStage &
  Readonly<{
    status: Phase4DemoPipelineStageStatus;
  }>;

export type Phase4DemoScenarioPlayback = Readonly<{
  id: Phase4DemoScenarioId;
  title: string;
  shortLabel: string;
  focus: string;
  interpretationLabel: Phase4DemoInterpretationLabel;
  supportingLabels: readonly Phase4DemoInterpretationLabel[];
  readinessLabel: string;
  readinessDetail: string;
  confidenceLabel: string;
  confidenceDetail: string;
  signalChannels: readonly Phase4DemoSignalChannel[];
  qualityMetrics: readonly Phase4DemoMetric[];
  featureMetrics: readonly Phase4DemoMetric[];
  interpretationMetrics: readonly Phase4DemoMetric[];
  summaryMetrics: readonly Phase4DemoMetric[];
  timelineEvents: readonly Phase4DemoTimelineEvent[];
  summaryHeadline: string;
  summaryDetail: string;
}>;

export type Phase4DemoPlaybackSnapshot = Readonly<{
  scenario: Phase4DemoScenarioPlayback;
  status: Phase4DemoPlaybackStatus;
  elapsedSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  currentStage: string;
  pipelineStages: readonly Phase4DemoPipelineStageSnapshot[];
  visibleTimelineEvents: readonly Phase4DemoTimelineEvent[];
  summaryUnlocked: boolean;
}>;

export const PHASE4_DEMO_DURATION_SECONDS = 72;
export const PHASE4_DEMO_TICK_SECONDS = 4;

export const PHASE4_DEMO_PIPELINE_STAGES = [
  { label: "Demo source", thresholdPercent: 0 },
  { label: "Ingestion boundary", thresholdPercent: 12 },
  { label: "Timing alignment", thresholdPercent: 24 },
  { label: "Segment preparation", thresholdPercent: 36 },
  { label: "Feature-window preparation", thresholdPercent: 48 },
  { label: "Baseline-relative context", thresholdPercent: 60 },
  { label: "Bounded interpretation", thresholdPercent: 72 },
  { label: "Clinician review", thresholdPercent: 84 },
  { label: "Session summary", thresholdPercent: 94 },
] as const satisfies readonly Phase4DemoPipelineStage[];

const BASE_ECG = [48, 50, 49, 78, 42, 48, 50, 49, 76, 43, 49, 51, 48, 75, 44, 49];
const ELEVATED_ECG = [55, 58, 57, 84, 48, 59, 62, 60, 88, 47, 62, 65, 61, 90, 49, 63];
const COOLDOWN_ECG = [64, 66, 63, 88, 48, 61, 62, 58, 82, 45, 55, 57, 53, 76, 44, 50];
const LIMITED_ECG = [50, 52, 51, 70, 45, 0, 0, 49, 72, 44, 48, 0, 0, 68, 43, 50];

function channel(
  label: string,
  detail: string,
  values: readonly number[],
  accentClass: string,
): Phase4DemoSignalChannel {
  return { label, detail, values, accentClass };
}

function metric(
  label: string,
  value: string,
  detail: string,
): Phase4DemoMetric {
  return { label, value, detail };
}

function timeline(
  atSecond: number,
  label: string,
  detail: string,
): Phase4DemoTimelineEvent {
  return { atSecond, label, detail };
}

const SCENARIO_PLAYBACK_BY_ID = {
  baseline_review_pattern: {
    id: "baseline_review_pattern",
    title: "Baseline review pattern",
    shortLabel: "Baseline",
    focus: "Stable baseline-relative evidence with review-ready quality.",
    interpretationLabel: "low_or_baseline_arousal_evidence",
    supportingLabels: ["cross_signal_agreement", "simulated_data_notice"],
    readinessLabel: "Review-ready",
    readinessDetail: "Technical quality supports bounded clinician review.",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "Signals agree within simulator demo context.",
    signalChannels: [
      channel("ECG-like preview", "Steady repeating waveform.", BASE_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Low drift near baseline.", [28, 29, 28, 30, 29, 31, 30, 30, 31, 30, 29, 30], "stroke-cyan-300"),
      channel("PPG-like preview", "Consistent pulse-waveform context.", [45, 53, 62, 54, 46, 52, 63, 55, 47, 53, 61, 54], "stroke-sky-300"),
      channel("Motion/activity context", "Low movement context.", [12, 14, 13, 15, 14, 16, 15, 13, 14, 15, 13, 14], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact trend stable.", [62, 63, 63, 64, 64, 65, 65, 65, 66, 66, 66, 67], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Ready", "Sufficient technical context."),
      metric("Signal quality distribution", "High", "Most windows reviewable."),
      metric("Missingness/contact/timing", "Low", "No major demo limitation."),
      metric("Baseline state", "Available", "Baseline-relative context present."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Near baseline", "Stable simulator trend."),
      metric("Skin-conductance trend", "Low drift", "No forced conclusion."),
      metric("Pulse-waveform context", "Consistent", "Usable preview shape."),
      metric("Motion confound context", "Low", "Movement context is limited."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "low_or_baseline_arousal_evidence", "Allowed frontend demo label."),
      metric("Evidence level", "Low/baseline", "Source-bound review context."),
      metric("Confidence", "Moderate", "Signals align in demo data."),
      metric("Uncertainty", "Present", "Clinician review remains required."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "92%", "Demo windows with enough quality."),
      metric("Suppressed windows", "8%", "Suppressed for technical context."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "Low", "Movement context remains low."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Simulator demo context selected."),
      timeline(10, "Ingestion boundary checked", "Frontend-only boundary remains closed."),
      timeline(22, "Signal window prepared", "Preview channels align for display."),
      timeline(38, "Quality gate updated", "Quality/readiness context is review-ready."),
      timeline(52, "Bounded interpretation shown", "Label remains non-diagnostic."),
      timeline(64, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Baseline-relative review is ready.",
    summaryDetail: "Demo evidence remains source-bound, low/baseline, and clinician-reviewable.",
  },
  elevated_arousal_evidence: {
    id: "elevated_arousal_evidence",
    title: "Elevated physiological arousal evidence",
    shortLabel: "Elevated",
    focus: "Baseline-relative elevation without diagnostic framing.",
    interpretationLabel: "elevated_physiological_arousal_evidence",
    supportingLabels: ["stress_like_autonomic_activation_evidence", "simulated_data_notice"],
    readinessLabel: "Review-ready",
    readinessDetail: "Quality supports cautious source-bound review.",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "Autonomic-like channels move together in the demo.",
    signalChannels: [
      channel("ECG-like preview", "Faster, sharper simulator waveform.", ELEVATED_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Rising conductance-like trend.", [30, 34, 38, 43, 48, 54, 58, 63, 67, 70, 73, 75], "stroke-cyan-300"),
      channel("PPG-like preview", "Tighter pulse-waveform spacing.", [48, 59, 68, 55, 49, 62, 72, 57, 50, 64, 74, 58], "stroke-sky-300"),
      channel("Motion/activity context", "Movement remains limited.", [16, 18, 17, 18, 20, 19, 18, 20, 19, 17, 18, 19], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact trend stable.", [63, 63, 64, 65, 65, 66, 66, 67, 67, 68, 68, 69], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Ready", "Technical quality is sufficient."),
      metric("Signal quality distribution", "High", "Preview windows remain usable."),
      metric("Missingness/contact/timing", "Low", "No major dropout context."),
      metric("Baseline state", "Available", "Elevation is baseline-relative."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Elevated", "Baseline-relative rise."),
      metric("Skin-conductance trend", "Elevated", "Conductance-like rise."),
      metric("Pulse-waveform context", "Changed", "Waveform context shifts."),
      metric("Motion confound context", "Low", "Motion does not dominate."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "elevated_physiological_arousal_evidence", "Allowed frontend demo label."),
      metric("Evidence level", "Elevated", "Source-bound evidence only."),
      metric("Confidence", "Moderate", "Quality is adequate."),
      metric("Uncertainty", "Present", "No diagnostic conclusion."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "88%", "Most demo windows reviewable."),
      metric("Suppressed windows", "12%", "Technical suppressions retained."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "Low", "Motion context remains limited."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Elevated evidence scenario selected."),
      timeline(12, "Ingestion boundary checked", "No backend route is called."),
      timeline(24, "Signal window prepared", "Autonomic-like preview rises."),
      timeline(40, "Quality gate updated", "Readiness remains review-ready."),
      timeline(54, "Bounded interpretation shown", "Elevation label is source-bound."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Elevated evidence is ready for clinician review.",
    summaryDetail: "The demo shows elevation as review context, not a diagnosis or automated action.",
  },
  recovery_cooldown_trend: {
    id: "recovery_cooldown_trend",
    title: "Recovery/cooldown trend",
    shortLabel: "Cooldown",
    focus: "Trend returns toward baseline-relative context.",
    interpretationLabel: "recovery_cooldown_trend",
    supportingLabels: ["cross_signal_agreement", "simulated_data_notice"],
    readinessLabel: "Review-ready",
    readinessDetail: "Trend context is suitable for cautious review.",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "Signal direction is consistent in the demo.",
    signalChannels: [
      channel("ECG-like preview", "Waveform settles over time.", COOLDOWN_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Downward conductance-like trend.", [72, 69, 65, 61, 56, 52, 48, 44, 40, 37, 34, 32], "stroke-cyan-300"),
      channel("PPG-like preview", "Pulse context becomes steadier.", [64, 72, 60, 56, 62, 68, 58, 53, 57, 63, 55, 50], "stroke-sky-300"),
      channel("Motion/activity context", "Low movement context.", [18, 17, 16, 15, 16, 15, 14, 13, 14, 13, 12, 12], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact trend stable.", [66, 66, 65, 65, 65, 64, 64, 64, 63, 63, 63, 62], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Ready", "Technical context supports review."),
      metric("Signal quality distribution", "High", "Most windows are usable."),
      metric("Missingness/contact/timing", "Low", "No major limitation."),
      metric("Baseline state", "Available", "Return trend is baseline-relative."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Returning", "Moves toward baseline."),
      metric("Skin-conductance trend", "Cooling", "Conductance-like trend lowers."),
      metric("Pulse-waveform context", "Settling", "Preview shape stabilizes."),
      metric("Motion confound context", "Low", "Movement context remains low."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "recovery_cooldown_trend", "Allowed frontend demo label."),
      metric("Evidence level", "Trend-based", "Review context only."),
      metric("Confidence", "Moderate", "Direction is consistent."),
      metric("Uncertainty", "Present", "No outcome claim is made."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "90%", "Most demo windows reviewable."),
      metric("Suppressed windows", "10%", "Suppressions remain visible."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "Low", "Movement context remains limited."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Cooldown scenario selected."),
      timeline(10, "Ingestion boundary checked", "Frontend-only demo path confirmed."),
      timeline(24, "Signal window prepared", "Trend moves toward baseline."),
      timeline(38, "Quality gate updated", "Readiness remains usable."),
      timeline(54, "Bounded interpretation shown", "Cooldown label stays bounded."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Cooldown trend is ready for review.",
    summaryDetail: "The demo shows a return trend without claiming treatment response.",
  },
  motion_activity_confound: {
    id: "motion_activity_confound",
    title: "Motion/activity-like confound",
    shortLabel: "Motion",
    focus: "Movement context limits confidence.",
    interpretationLabel: "movement_activity_like_confound",
    supportingLabels: ["signal_quality_limitation", "simulated_data_notice"],
    readinessLabel: "Qualified",
    readinessDetail: "Review is possible with motion context highlighted.",
    confidenceLabel: "Low confidence",
    confidenceDetail: "Movement-like signal limits interpretation.",
    signalChannels: [
      channel("ECG-like preview", "Waveform has movement-like disturbance.", [50, 67, 45, 82, 36, 70, 42, 85, 38, 72, 40, 78], "stroke-emerald-300"),
      channel("GSR trend", "Uneven conductance-like trend.", [35, 38, 44, 42, 50, 47, 53, 49, 57, 52, 55, 50], "stroke-cyan-300"),
      channel("PPG-like preview", "Pulse context is less stable.", [44, 69, 39, 66, 42, 70, 37, 65, 45, 68, 40, 64], "stroke-sky-300"),
      channel("Motion/activity context", "Movement context elevated.", [26, 35, 58, 74, 48, 72, 60, 82, 56, 77, 63, 70], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact changes slightly.", [62, 61, 60, 61, 59, 60, 58, 59, 58, 60, 59, 60], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Qualified", "Motion context affects review."),
      metric("Signal quality distribution", "Mixed", "Several windows limited."),
      metric("Missingness/contact/timing", "Moderate", "Contact and motion context visible."),
      metric("Baseline state", "Available", "Baseline exists but confidence is reduced."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Confounded", "Movement context overlaps."),
      metric("Skin-conductance trend", "Uneven", "Trend is not clean."),
      metric("Pulse-waveform context", "Variable", "Preview shape is disturbed."),
      metric("Motion confound context", "Elevated", "Movement context is prominent."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "movement_activity_like_confound", "Allowed frontend demo label."),
      metric("Evidence level", "Qualified", "Motion context limits certainty."),
      metric("Confidence", "Low", "Suppression is possible."),
      metric("Uncertainty", "High", "Clinician review required."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "61%", "Some windows are usable."),
      metric("Suppressed windows", "39%", "Motion-limited windows suppressed."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "High", "Movement context dominates."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Motion context scenario selected."),
      timeline(12, "Ingestion boundary checked", "Frontend-only path confirmed."),
      timeline(24, "Signal window prepared", "Movement context is visible."),
      timeline(36, "Quality gate updated", "Readiness becomes qualified."),
      timeline(52, "Bounded interpretation shown", "Confound label limits certainty."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Motion context limits interpretation.",
    summaryDetail: "The demo highlights technical confounding without patient-status claims.",
  },
  signal_quality_limitation: {
    id: "signal_quality_limitation",
    title: "Signal quality limitation",
    shortLabel: "Quality",
    focus: "Contact and missingness limit review.",
    interpretationLabel: "signal_quality_limitation",
    supportingLabels: ["insufficient_reliable_data", "simulated_data_notice"],
    readinessLabel: "Limited",
    readinessDetail: "Technical quality limits interpretation.",
    confidenceLabel: "Low confidence",
    confidenceDetail: "Quality limitations suppress parts of the demo.",
    signalChannels: [
      channel("ECG-like preview", "Dropout-like gaps in waveform.", LIMITED_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Interrupted conductance-like trend.", [30, 31, 0, 0, 35, 36, 0, 39, 40, 0, 42, 43], "stroke-cyan-300"),
      channel("PPG-like preview", "Contact-limited pulse context.", [42, 55, 0, 0, 48, 60, 0, 52, 62, 0, 50, 59], "stroke-sky-300"),
      channel("Motion/activity context", "Low movement context.", [14, 15, 14, 16, 15, 15, 16, 14, 15, 15, 14, 15], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact quality unstable.", [60, 58, 48, 44, 55, 56, 46, 52, 54, 45, 53, 55], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Limited", "Contact and missingness constrain review."),
      metric("Signal quality distribution", "Low/mixed", "Several windows suppressed."),
      metric("Missingness/contact/timing", "High", "Missingness is visible."),
      metric("Baseline state", "Partial", "Baseline context is incomplete."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Limited", "Gaps reduce confidence."),
      metric("Skin-conductance trend", "Limited", "Missing windows present."),
      metric("Pulse-waveform context", "Limited", "Contact context is unstable."),
      metric("Motion confound context", "Low", "Motion does not explain all limits."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "signal_quality_limitation", "Allowed frontend demo label."),
      metric("Evidence level", "Limited", "Quality is the main finding."),
      metric("Confidence", "Low", "Suppression is emphasized."),
      metric("Uncertainty", "High", "No conclusion is forced."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "46%", "Many windows are limited."),
      metric("Suppressed windows", "54%", "Suppression remains visible."),
      metric("Modality availability", "Partial", "Contact context limits channels."),
      metric("Motion-limited windows", "Low", "Quality is the primary limitation."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Quality limitation scenario selected."),
      timeline(12, "Ingestion boundary checked", "Frontend-only path confirmed."),
      timeline(22, "Signal window prepared", "Gaps are visible in previews."),
      timeline(34, "Quality gate updated", "Readiness is limited."),
      timeline(50, "Bounded interpretation shown", "Quality label is emphasized."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Quality limitation is the primary context.",
    summaryDetail: "The demo suppresses certainty when technical readiness is limited.",
  },
  cross_signal_disagreement: {
    id: "cross_signal_disagreement",
    title: "Cross-signal disagreement",
    shortLabel: "Disagree",
    focus: "Signals diverge, so uncertainty remains central.",
    interpretationLabel: "cross_signal_disagreement",
    supportingLabels: ["simulated_data_notice"],
    readinessLabel: "Qualified",
    readinessDetail: "Quality is usable, but signal groups diverge.",
    confidenceLabel: "Low confidence",
    confidenceDetail: "Signals do not agree enough for stronger context.",
    signalChannels: [
      channel("ECG-like preview", "Heart-activity context rises.", ELEVATED_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Conductance-like trend remains flat.", [33, 33, 34, 33, 34, 34, 33, 34, 35, 34, 35, 34], "stroke-cyan-300"),
      channel("PPG-like preview", "Pulse context shifts mildly.", [45, 56, 62, 52, 46, 58, 64, 53, 46, 57, 63, 52], "stroke-sky-300"),
      channel("Motion/activity context", "Movement context low.", [12, 13, 12, 14, 13, 12, 14, 13, 12, 13, 12, 13], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact trend stable.", [63, 63, 63, 64, 64, 64, 65, 65, 65, 66, 66, 66], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Qualified", "Technical quality is usable."),
      metric("Signal quality distribution", "High", "Usable but divergent."),
      metric("Missingness/contact/timing", "Low", "No major dropout context."),
      metric("Baseline state", "Available", "Baseline context present."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Elevated", "One signal group rises."),
      metric("Skin-conductance trend", "Near baseline", "Another group stays flat."),
      metric("Pulse-waveform context", "Mild change", "Pulse context shifts less."),
      metric("Motion confound context", "Low", "Movement is not dominant."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "cross_signal_disagreement", "Allowed frontend demo label."),
      metric("Evidence level", "Mixed", "Evidence is uncertainty-bearing."),
      metric("Confidence", "Low", "Cross-signal disagreement is explicit."),
      metric("Uncertainty", "High", "No forced interpretation."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "84%", "Most windows usable."),
      metric("Suppressed windows", "16%", "Uncertain windows remain visible."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "Low", "Disagreement is not movement-led."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Disagreement scenario selected."),
      timeline(12, "Ingestion boundary checked", "Frontend-only path confirmed."),
      timeline(24, "Signal window prepared", "Signal groups diverge."),
      timeline(38, "Quality gate updated", "Quality remains usable."),
      timeline(54, "Bounded interpretation shown", "Disagreement label shown."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Cross-signal disagreement remains visible.",
    summaryDetail: "The demo highlights uncertainty instead of forcing a conclusion.",
  },
  insufficient_reliable_data: {
    id: "insufficient_reliable_data",
    title: "Insufficient reliable data",
    shortLabel: "Insufficient",
    focus: "Available data is not reliable enough for interpretation.",
    interpretationLabel: "insufficient_reliable_data",
    supportingLabels: ["signal_quality_limitation", "simulated_data_notice"],
    readinessLabel: "Not ready",
    readinessDetail: "Reliable data is insufficient for interpretation.",
    confidenceLabel: "Suppressed",
    confidenceDetail: "The demo suppresses interpretation context.",
    signalChannels: [
      channel("ECG-like preview", "Sparse preview with gaps.", [0, 0, 46, 0, 0, 55, 0, 0, 42, 0, 0, 50], "stroke-emerald-300"),
      channel("GSR trend", "Too sparse for trend context.", [0, 0, 28, 0, 0, 29, 0, 0, 30, 0, 0, 31], "stroke-cyan-300"),
      channel("PPG-like preview", "Pulse context mostly unavailable.", [0, 0, 48, 0, 0, 50, 0, 0, 52, 0, 0, 49], "stroke-sky-300"),
      channel("Motion/activity context", "Context incomplete.", [0, 15, 0, 16, 0, 15, 0, 16, 0, 15, 0, 16], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact is unreliable.", [40, 42, 38, 41, 39, 43, 38, 40, 39, 41, 38, 40], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Not ready", "Reliable data is insufficient."),
      metric("Signal quality distribution", "Low", "Most windows are suppressed."),
      metric("Missingness/contact/timing", "High", "Missingness dominates."),
      metric("Baseline state", "Unavailable", "Baseline context is not reliable."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Suppressed", "Not enough reliable windows."),
      metric("Skin-conductance trend", "Suppressed", "Trend context unavailable."),
      metric("Pulse-waveform context", "Suppressed", "Contact context is insufficient."),
      metric("Motion confound context", "Unknown", "Context is incomplete."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "insufficient_reliable_data", "Allowed frontend demo label."),
      metric("Evidence level", "Insufficient", "Interpretation is suppressed."),
      metric("Confidence", "Suppressed", "No bounded interpretation shown."),
      metric("Uncertainty", "High", "Technical reasons are explicit."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "18%", "Too few windows are reliable."),
      metric("Suppressed windows", "82%", "Suppression dominates."),
      metric("Modality availability", "Limited", "Channels are incomplete."),
      metric("Motion-limited windows", "Unknown", "Context is incomplete."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "Insufficient data scenario selected."),
      timeline(12, "Ingestion boundary checked", "Frontend-only path confirmed."),
      timeline(22, "Signal window prepared", "Sparse previews visible."),
      timeline(34, "Quality gate updated", "Readiness is not ready."),
      timeline(50, "Bounded interpretation suppressed", "No conclusion is shown."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Interpretation is suppressed.",
    summaryDetail: "The demo shows insufficient reliable data without inventing a conclusion.",
  },
  ml_unavailable: {
    id: "ml_unavailable",
    title: "ML unavailable",
    shortLabel: "ML unavailable",
    focus: "Model context unavailable without failing open.",
    interpretationLabel: "ml_unavailable",
    supportingLabels: ["signal_quality_limitation", "simulated_data_notice"],
    readinessLabel: "Quality visible",
    readinessDetail: "Technical panels remain useful without model context.",
    confidenceLabel: "Unavailable",
    confidenceDetail: "Model context is unavailable in the demo.",
    signalChannels: [
      channel("ECG-like preview", "Signal preview remains visible.", BASE_ECG, "stroke-emerald-300"),
      channel("GSR trend", "Conductance-like trend remains visible.", [31, 32, 32, 33, 33, 34, 35, 35, 35, 36, 36, 36], "stroke-cyan-300"),
      channel("PPG-like preview", "Pulse context remains visible.", [46, 54, 63, 54, 47, 55, 64, 55, 47, 56, 65, 55], "stroke-sky-300"),
      channel("Motion/activity context", "Movement context low.", [13, 14, 13, 15, 14, 14, 13, 15, 14, 13, 14, 13], "stroke-violet-300"),
      channel("Temperature/contact context", "Contact trend stable.", [63, 64, 64, 64, 65, 65, 65, 66, 66, 66, 67, 67], "stroke-amber-300"),
    ],
    qualityMetrics: [
      metric("Readiness", "Quality visible", "Quality panels remain usable."),
      metric("Signal quality distribution", "High", "Signals can still be reviewed."),
      metric("Missingness/contact/timing", "Low", "No major technical gap."),
      metric("Baseline state", "Available", "Baseline context is present."),
    ],
    featureMetrics: [
      metric("Heart-activity trend", "Visible", "Feature context remains available."),
      metric("Skin-conductance trend", "Visible", "Trend context remains available."),
      metric("Pulse-waveform context", "Visible", "Pulse preview remains available."),
      metric("Motion confound context", "Low", "Movement context remains low."),
    ],
    interpretationMetrics: [
      metric("Safe interpretation label", "ml_unavailable", "Allowed frontend demo label."),
      metric("Evidence level", "Unavailable", "Model context is not shown."),
      metric("Confidence", "Unavailable", "No fallback claim is created."),
      metric("Uncertainty", "High", "Unavailable model context is explicit."),
    ],
    summaryMetrics: [
      metric("Interpretable windows", "90%", "Signal review remains possible."),
      metric("Suppressed windows", "10%", "Model context unavailable."),
      metric("Modality availability", "5/5", "Demo channels visible."),
      metric("Motion-limited windows", "Low", "Movement context remains limited."),
    ],
    timelineEvents: [
      timeline(0, "Demo source loaded", "ML unavailable scenario selected."),
      timeline(12, "Ingestion boundary checked", "Frontend-only path confirmed."),
      timeline(24, "Signal window prepared", "Signal previews remain visible."),
      timeline(38, "Quality gate updated", "Quality panels remain useful."),
      timeline(54, "Model context unavailable", "No fallback claim is generated."),
      timeline(66, "Clinician review ready", "Summary unlock is near completion."),
    ],
    summaryHeadline: "Model context is unavailable.",
    summaryDetail: "The demo keeps signal and quality review visible without inventing conclusions.",
  },
} as const satisfies Record<Phase4DemoScenarioId, Phase4DemoScenarioPlayback>;

export const PHASE4_DEMO_PLAYBACK_SCENARIOS = PHASE4_DEMO_SCENARIO_IDS.map(
  (id) => SCENARIO_PLAYBACK_BY_ID[id],
);

export function getPhase4DemoPlaybackScenario(
  id: Phase4DemoScenarioId,
): Phase4DemoScenarioPlayback {
  getPhase4DemoScenarioById(id);
  return SCENARIO_PLAYBACK_BY_ID[id];
}

export function getPhase4DemoProgressPercent(
  elapsedSeconds: number,
  durationSeconds = PHASE4_DEMO_DURATION_SECONDS,
): number {
  const clampedElapsed = Math.min(Math.max(elapsedSeconds, 0), durationSeconds);
  return Math.round((clampedElapsed / durationSeconds) * 100);
}

export function getNextPhase4DemoElapsedSeconds(
  elapsedSeconds: number,
  durationSeconds = PHASE4_DEMO_DURATION_SECONDS,
): number {
  return Math.min(elapsedSeconds + PHASE4_DEMO_TICK_SECONDS, durationSeconds);
}

export function getPhase4DemoPlaybackSnapshot({
  scenarioId,
  status,
  elapsedSeconds,
  durationSeconds = PHASE4_DEMO_DURATION_SECONDS,
}: {
  scenarioId: Phase4DemoScenarioId;
  status: Phase4DemoPlaybackStatus;
  elapsedSeconds: number;
  durationSeconds?: number;
}): Phase4DemoPlaybackSnapshot {
  const scenario = getPhase4DemoPlaybackScenario(scenarioId);
  const progressPercent =
    status === "complete"
      ? 100
      : getPhase4DemoProgressPercent(elapsedSeconds, durationSeconds);

  const activeStage =
    [...PHASE4_DEMO_PIPELINE_STAGES]
      .reverse()
      .find((stage) => progressPercent >= stage.thresholdPercent) ??
    PHASE4_DEMO_PIPELINE_STAGES[0];

  const nextStage =
    PHASE4_DEMO_PIPELINE_STAGES.find(
      (stage) => stage.thresholdPercent > activeStage.thresholdPercent,
    ) ?? activeStage;

  const pipelineStages = PHASE4_DEMO_PIPELINE_STAGES.map((stage) => {
    let stageStatus: Phase4DemoPipelineStageStatus = "pending";

    if (progressPercent >= stage.thresholdPercent) {
      stageStatus =
        stage.label === activeStage.label && progressPercent < 100
          ? "active"
          : "complete";
    }

    if (status === "ready" && stage.thresholdPercent > 0) {
      stageStatus = "pending";
    }

    return {
      ...stage,
      status: stageStatus,
    };
  });

  return {
    scenario,
    status,
    elapsedSeconds: Math.min(elapsedSeconds, durationSeconds),
    durationSeconds,
    progressPercent,
    currentStage:
      status === "complete" ? "Session summary" : nextStage.label,
    pipelineStages,
    visibleTimelineEvents: scenario.timelineEvents.filter(
      (event) => event.atSecond <= elapsedSeconds || status === "complete",
    ),
    summaryUnlocked: progressPercent >= 88 || status === "complete",
  };
}
