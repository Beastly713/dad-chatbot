export const PHASE4_DEMO_VISIBILITY = {
  clinician_visible: true,
  patient_visible: false,
  chatbot_visible: false,
} as const;

export const PHASE4_DEMO_SOURCE = {
  sourceType: "simulator",
  banner: "Simulator demo",
  description:
    "Deterministic frontend demo data for clinician-only objective monitoring review.",
} as const;

export const PHASE4_ALLOWED_INTERPRETATION_LABELS = [
  "low_or_baseline_arousal_evidence",
  "elevated_physiological_arousal_evidence",
  "stress_like_autonomic_activation_evidence",
  "recovery_cooldown_trend",
  "movement_activity_like_confound",
  "signal_quality_limitation",
  "cross_signal_agreement",
  "cross_signal_disagreement",
  "insufficient_reliable_data",
  "ml_unavailable",
  "simulated_data_notice",
] as const;

export type Phase4DemoInterpretationLabel =
  (typeof PHASE4_ALLOWED_INTERPRETATION_LABELS)[number];

export const PHASE4_DEMO_SCENARIO_IDS = [
  "baseline_review_pattern",
  "elevated_arousal_evidence",
  "recovery_cooldown_trend",
  "motion_activity_confound",
  "signal_quality_limitation",
  "cross_signal_disagreement",
  "insufficient_reliable_data",
  "ml_unavailable",
] as const;

export type Phase4DemoScenarioId = (typeof PHASE4_DEMO_SCENARIO_IDS)[number];

export type Phase4DemoScenario = Readonly<{
  id: Phase4DemoScenarioId;
  title: string;
  eyebrow: string;
  description: string;
  primaryInterpretationLabel: Phase4DemoInterpretationLabel;
  reviewFocus: readonly string[];
  source: typeof PHASE4_DEMO_SOURCE;
  visibility: typeof PHASE4_DEMO_VISIBILITY;
}>;

export const PHASE4_DEMO_SCENARIOS = [
  {
    id: "baseline_review_pattern",
    title: "Baseline review pattern",
    eyebrow: "Stable source-bound pattern",
    description:
      "Shows a calm baseline-relative review state with low or baseline arousal evidence and clear clinician-only boundaries.",
    primaryInterpretationLabel: "low_or_baseline_arousal_evidence",
    reviewFocus: [
      "Baseline-relative evidence remains low.",
      "Quality/readiness context is suitable for review.",
      "Output remains clinician-reviewable and non-diagnostic.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "elevated_arousal_evidence",
    title: "Elevated physiological arousal evidence",
    eyebrow: "Baseline-relative elevation",
    description:
      "Shows how the console should present elevated physiological arousal evidence as a review item with uncertainty, not a clinical conclusion.",
    primaryInterpretationLabel: "elevated_physiological_arousal_evidence",
    reviewFocus: [
      "Baseline-relative pattern is elevated.",
      "Interpretation remains uncertainty-bearing.",
      "No diagnosis or risk-score framing is used.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "recovery_cooldown_trend",
    title: "Recovery/cooldown trend",
    eyebrow: "Return toward baseline",
    description:
      "Shows a source-bound cooldown pattern using the repo-verified recovery_cooldown_trend label.",
    primaryInterpretationLabel: "recovery_cooldown_trend",
    reviewFocus: [
      "Pattern moves toward baseline-relative context.",
      "Review copy stays cautious and non-diagnostic.",
      "The scenario does not imply treatment progress.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "motion_activity_confound",
    title: "Motion/activity-like confound",
    eyebrow: "Technical quality limitation",
    description:
      "Shows how movement context can limit signal usability and reduce confidence without making behavioral or clinical claims.",
    primaryInterpretationLabel: "movement_activity_like_confound",
    reviewFocus: [
      "Motion context is treated as a technical limitation.",
      "Confidence should be reduced or qualified.",
      "No intoxication or behavior claim is made.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "signal_quality_limitation",
    title: "Signal quality limitation",
    eyebrow: "Readiness-limited review",
    description:
      "Shows how poor contact or dropout-style limitations can be framed as quality/readiness context.",
    primaryInterpretationLabel: "signal_quality_limitation",
    reviewFocus: [
      "Technical readiness is limited.",
      "Interpretation may be suppressed or qualified.",
      "The limitation is not patient status.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "cross_signal_disagreement",
    title: "Cross-signal disagreement",
    eyebrow: "Uncertainty-bearing evidence",
    description:
      "Shows how disagreement across signal groups can be presented as source-bound uncertainty for clinician review.",
    primaryInterpretationLabel: "cross_signal_disagreement",
    reviewFocus: [
      "Signals do not fully agree.",
      "The console should surface uncertainty instead of forcing a conclusion.",
      "Agreement or disagreement is not confirmation of a clinical state.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "insufficient_reliable_data",
    title: "Insufficient reliable data",
    eyebrow: "Interpretation suppressed",
    description:
      "Shows the safe state where available evidence is not reliable enough for a bounded interpretation.",
    primaryInterpretationLabel: "insufficient_reliable_data",
    reviewFocus: [
      "Interpretation should be suppressed.",
      "The UI should explain technical reasons.",
      "No patient-facing or chatbot-facing output is produced.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
  {
    id: "ml_unavailable",
    title: "ML unavailable",
    eyebrow: "Model context unavailable",
    description:
      "Shows how the console should handle unavailable model context without failing open or inventing conclusions.",
    primaryInterpretationLabel: "ml_unavailable",
    reviewFocus: [
      "Model context is unavailable.",
      "The UI should remain useful with quality/readiness context.",
      "No fallback clinical claim is generated.",
    ],
    source: PHASE4_DEMO_SOURCE,
    visibility: PHASE4_DEMO_VISIBILITY,
  },
] as const satisfies readonly Phase4DemoScenario[];

export function isPhase4DemoInterpretationLabel(
  value: string,
): value is Phase4DemoInterpretationLabel {
  return PHASE4_ALLOWED_INTERPRETATION_LABELS.includes(
    value as Phase4DemoInterpretationLabel,
  );
}

export function getPhase4DemoScenarioById(
  id: Phase4DemoScenarioId,
): Phase4DemoScenario {
  const scenario = PHASE4_DEMO_SCENARIOS.find(
    (candidate) => candidate.id === id,
  );

  if (!scenario) {
    throw new Error(`Unsupported Phase 4 demo scenario: ${id}`);
  }

  return scenario;
}
