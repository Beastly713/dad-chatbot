import {
  PHASE4_DEMO_SCENARIO_IDS,
  type Phase4DemoInterpretationLabel,
  type Phase4DemoScenarioId,
} from "./phase4DemoScenarios";

export type Phase4DisplayQualityLabel = "High" | "Medium" | "Limited";

export type Phase4DisplayStreamFrame = Readonly<{
  timeSeconds: number;
  ecgDisplayAmplitude: number;
  conductanceTrend: number;
  pulseWaveform: number;
  movementMagnitude: number;
  temperatureContactDelta: number;
  qualityLabel: Phase4DisplayQualityLabel;
  stageId: string;
}>;

export type Phase4EvidenceWindow = Readonly<{
  startSecond: number;
  endSecond: number;
  label: string;
}>;

export type Phase4StreamScenarioConfig = Readonly<{
  id: Phase4DemoScenarioId;
  title: string;
  shortLabel: string;
  focus: string;
  interpretationLabel: Phase4DemoInterpretationLabel;
  confidenceLabel: string;
  confidenceDetail: string;
  agreementSummary: string;
  limitationText: string;
  evidenceWindow: Phase4EvidenceWindow;
  summaryHeadline: string;
  summaryDetail: string;
}>;

export type Phase4DisplayFeatureSummary = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

export type Phase4CurrentStreamState = Readonly<{
  scenario: Phase4StreamScenarioConfig;
  frames: readonly Phase4DisplayStreamFrame[];
  visibleFrames: readonly Phase4DisplayStreamFrame[];
  recentFrames: readonly Phase4DisplayStreamFrame[];
  currentFrame: Phase4DisplayStreamFrame;
  featureSummaries: readonly Phase4DisplayFeatureSummary[];
}>;

export const PHASE4_DEMO_DURATION_SECONDS = 180;
export const PHASE4_VISIBLE_WINDOW_SECONDS = 42;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function windowRamp(timeSeconds: number, startSecond: number, endSecond: number) {
  if (timeSeconds <= startSecond) {
    return 0;
  }

  if (timeSeconds >= endSecond) {
    return 1;
  }

  return (timeSeconds - startSecond) / (endSecond - startSecond);
}

function windowPulse(timeSeconds: number, startSecond: number, endSecond: number) {
  const ramp = windowRamp(timeSeconds, startSecond, endSecond);
  if (ramp <= 0 || ramp >= 1) {
    return 0;
  }

  return Math.sin(ramp * Math.PI);
}

function stageIdForTime(timeSeconds: number): string {
  if (timeSeconds < 10) return "demo_source";
  if (timeSeconds < 25) return "ingestion_boundary";
  if (timeSeconds < 40) return "timing_alignment";
  if (timeSeconds < 60) return "segment_preparation";
  if (timeSeconds < 85) return "feature_window_preparation";
  if (timeSeconds < 110) return "baseline_relative_context";
  if (timeSeconds < 135) return "bounded_interpretation";
  if (timeSeconds < 160) return "clinician_review";
  return "session_summary";
}

export function formatPhase4DemoTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const PHASE4_STREAM_SCENARIOS = [
  {
    id: "baseline_review_pattern",
    title: "Baseline review pattern",
    shortLabel: "Baseline",
    focus: "Stable baseline-relative evidence with review-ready quality.",
    interpretationLabel: "low_or_baseline_arousal_evidence",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "ECG display, conductance trend, and pulse waveform stay aligned.",
    agreementSummary: "Agreement: ECG display, conductance trend, and pulse waveform align.",
    limitationText: "Limitation: review-only simulator context.",
    evidenceWindow: {
      startSecond: 42,
      endSecond: 92,
      label: "Evidence window: 00:42-01:32",
    },
    summaryHeadline: "Baseline-relative review window is complete.",
    summaryDetail: "Display stream remains stable, source-bound, and clinician-reviewable.",
  },
  {
    id: "elevated_arousal_evidence",
    title: "Elevated physiological arousal evidence",
    shortLabel: "Elevated",
    focus: "Conductance, ECG display, and pulse waveform rise in the evidence window.",
    interpretationLabel: "elevated_physiological_arousal_evidence",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "Several display channels partially align during the annotated window.",
    agreementSummary: "Agreement: ECG display, conductance trend, and pulse waveform partially align.",
    limitationText: "Limitation: source-bound review only; no chatbot response update.",
    evidenceWindow: {
      startSecond: 48,
      endSecond: 120,
      label: "Evidence window: 00:48-02:00",
    },
    summaryHeadline: "Elevated evidence window is ready for review.",
    summaryDetail: "The demo shows bounded elevation as review context, not a clinical conclusion.",
  },
  {
    id: "recovery_cooldown_trend",
    title: "Recovery/cooldown trend",
    shortLabel: "Cooldown",
    focus: "Display values trend back toward baseline-relative context.",
    interpretationLabel: "recovery_cooldown_trend",
    confidenceLabel: "Moderate confidence",
    confidenceDetail: "The visible window shows a return trend across display channels.",
    agreementSummary: "Agreement: conductance trend and pulse waveform move toward baseline.",
    limitationText: "Limitation: trend display does not claim an outcome.",
    evidenceWindow: {
      startSecond: 36,
      endSecond: 132,
      label: "Evidence window: 00:36-02:12",
    },
    summaryHeadline: "Cooldown trend window is complete.",
    summaryDetail: "The demo shows a return trend without generating a care action.",
  },
  {
    id: "motion_activity_confound",
    title: "Motion/activity-like confound",
    shortLabel: "Motion",
    focus: "Movement magnitude spikes and limits interpretation confidence.",
    interpretationLabel: "movement_activity_like_confound",
    confidenceLabel: "Limited confidence",
    confidenceDetail: "Movement magnitude dominates part of the evidence window.",
    agreementSummary: "Agreement: movement magnitude explains why other display channels are qualified.",
    limitationText: "Limitation: movement/activity-like confound; bounded interpretation is qualified.",
    evidenceWindow: {
      startSecond: 58,
      endSecond: 105,
      label: "Evidence window: 00:58-01:45",
    },
    summaryHeadline: "Movement context limits this review window.",
    summaryDetail: "The demo highlights technical confounding without patient-status claims.",
  },
  {
    id: "signal_quality_limitation",
    title: "Signal quality limitation",
    shortLabel: "Quality",
    focus: "Quality overlays and gaps show contact/readiness limitations.",
    interpretationLabel: "signal_quality_limitation",
    confidenceLabel: "Low confidence",
    confidenceDetail: "Quality coverage is limited inside the evidence window.",
    agreementSummary: "Agreement: quality limitation is shared across several display channels.",
    limitationText: "Limitation: several windows are marked limited for review readiness.",
    evidenceWindow: {
      startSecond: 40,
      endSecond: 110,
      label: "Evidence window: 00:40-01:50",
    },
    summaryHeadline: "Quality limitation is the primary review context.",
    summaryDetail: "The demo suppresses certainty when technical readiness is limited.",
  },
  {
    id: "cross_signal_disagreement",
    title: "Cross-signal disagreement",
    shortLabel: "Disagree",
    focus: "One display channel shifts while others remain closer to baseline.",
    interpretationLabel: "cross_signal_disagreement",
    confidenceLabel: "Low confidence",
    confidenceDetail: "Display channels do not align enough for stronger context.",
    agreementSummary: "Agreement: limited; ECG display shifts while conductance remains flatter.",
    limitationText: "Limitation: disagreement remains uncertainty-bearing.",
    evidenceWindow: {
      startSecond: 54,
      endSecond: 128,
      label: "Evidence window: 00:54-02:08",
    },
    summaryHeadline: "Cross-signal disagreement remains visible.",
    summaryDetail: "The demo highlights uncertainty instead of forcing a conclusion.",
  },
  {
    id: "insufficient_reliable_data",
    title: "Insufficient reliable data",
    shortLabel: "Insufficient",
    focus: "Sparse display values and limited quality suppress interpretation.",
    interpretationLabel: "insufficient_reliable_data",
    confidenceLabel: "Suppressed",
    confidenceDetail: "Reliable display coverage is not enough for bounded interpretation.",
    agreementSummary: "Agreement: insufficient reliable display coverage.",
    limitationText: "Limitation: interpretation is suppressed for technical reasons.",
    evidenceWindow: {
      startSecond: 34,
      endSecond: 142,
      label: "Evidence window: 00:34-02:22",
    },
    summaryHeadline: "Interpretation remains suppressed.",
    summaryDetail: "The demo shows insufficient reliable data without inventing conclusions.",
  },
  {
    id: "ml_unavailable",
    title: "ML unavailable",
    shortLabel: "ML unavailable",
    focus: "Model context unavailable without failing open.",
    interpretationLabel: "ml_unavailable",
    confidenceLabel: "Unavailable",
    confidenceDetail: "No fallback model conclusion is generated.",
    agreementSummary: "Agreement: signal display remains visible; model context is unavailable.",
    limitationText: "Limitation: model context unavailable; review stays technical.",
    evidenceWindow: {
      startSecond: 50,
      endSecond: 130,
      label: "Evidence window: 00:50-02:10",
    },
    summaryHeadline: "Model context is unavailable.",
    summaryDetail: "The demo keeps signal and quality review visible without inventing conclusions.",
  },
] as const satisfies readonly Phase4StreamScenarioConfig[];

export function getPhase4StreamScenario(
  scenarioId: Phase4DemoScenarioId,
): Phase4StreamScenarioConfig {
  const scenario = PHASE4_STREAM_SCENARIOS.find(
    (candidate) => candidate.id === scenarioId,
  );

  if (!scenario) {
    throw new Error(`Unsupported Phase 4 stream scenario: ${scenarioId}`);
  }

  return scenario;
}

function qualityForScenario(
  scenarioId: Phase4DemoScenarioId,
  timeSeconds: number,
): Phase4DisplayQualityLabel {
  if (scenarioId === "signal_quality_limitation") {
    return timeSeconds >= 40 && timeSeconds <= 110 ? "Limited" : "Medium";
  }

  if (scenarioId === "insufficient_reliable_data") {
    return timeSeconds % 4 === 0 || (timeSeconds >= 34 && timeSeconds <= 142)
      ? "Limited"
      : "Medium";
  }

  if (scenarioId === "motion_activity_confound") {
    return timeSeconds >= 58 && timeSeconds <= 105 ? "Medium" : "High";
  }

  return "High";
}

function generateFrame(
  scenarioId: Phase4DemoScenarioId,
  timeSeconds: number,
): Phase4DisplayStreamFrame {
  const basePulse = Math.sin(timeSeconds * 1.92) * 18;
  const ecgWave =
    48 +
    Math.sin(timeSeconds * 4.7) * 15 +
    Math.sin(timeSeconds * 9.4) * 5;
  const ppgWave = 48 + Math.sin(timeSeconds * 1.65) * 14;
  const slowDrift = Math.sin(timeSeconds / 26) * 4;

  let ecgDisplayAmplitude = ecgWave;
  let conductanceTrend = 30 + slowDrift;
  let pulseWaveform = ppgWave + basePulse * 0.2;
  let movementMagnitude = 12 + Math.sin(timeSeconds / 8) * 3;
  let temperatureContactDelta = 50 + Math.sin(timeSeconds / 35) * 4;

  const elevatedRamp = windowRamp(timeSeconds, 48, 120);
  const cooldownFall = 1 - windowRamp(timeSeconds, 36, 132);
  const motionSpike = windowPulse(timeSeconds, 58, 105);
  const qualityLimit = windowPulse(timeSeconds, 40, 110);
  const sparseLimit = timeSeconds % 5 === 0 || timeSeconds % 7 === 0 ? 1 : 0;

  switch (scenarioId) {
    case "baseline_review_pattern":
      conductanceTrend += 2;
      movementMagnitude = 10 + Math.sin(timeSeconds / 10) * 2;
      break;
    case "elevated_arousal_evidence":
      ecgDisplayAmplitude += elevatedRamp * 16;
      conductanceTrend += elevatedRamp * 45;
      pulseWaveform += elevatedRamp * 18;
      movementMagnitude = 13 + Math.sin(timeSeconds / 9) * 2;
      temperatureContactDelta += elevatedRamp * 7;
      break;
    case "recovery_cooldown_trend":
      ecgDisplayAmplitude += cooldownFall * 18;
      conductanceTrend += cooldownFall * 42;
      pulseWaveform += cooldownFall * 16;
      movementMagnitude = 12 + Math.sin(timeSeconds / 11) * 2;
      temperatureContactDelta += cooldownFall * 5;
      break;
    case "motion_activity_confound":
      movementMagnitude += motionSpike * 78;
      ecgDisplayAmplitude += motionSpike * Math.sin(timeSeconds * 5.5) * 22;
      pulseWaveform += motionSpike * Math.sin(timeSeconds * 4.4) * 16;
      conductanceTrend += motionSpike * 12;
      temperatureContactDelta -= motionSpike * 9;
      break;
    case "signal_quality_limitation":
      ecgDisplayAmplitude = qualityLimit > 0.1 ? ecgDisplayAmplitude * 0.45 : ecgDisplayAmplitude;
      conductanceTrend += qualityLimit * -14;
      pulseWaveform = qualityLimit > 0.1 ? pulseWaveform * 0.55 : pulseWaveform;
      temperatureContactDelta -= qualityLimit * 22;
      movementMagnitude = 12 + Math.sin(timeSeconds / 10) * 3;
      break;
    case "cross_signal_disagreement":
      ecgDisplayAmplitude += elevatedRamp * 20;
      conductanceTrend += Math.sin(timeSeconds / 45) * 3;
      pulseWaveform += elevatedRamp * 8;
      movementMagnitude = 11 + Math.sin(timeSeconds / 13) * 2;
      break;
    case "insufficient_reliable_data":
      ecgDisplayAmplitude = sparseLimit ? ecgDisplayAmplitude * 0.18 : ecgDisplayAmplitude * 0.55;
      conductanceTrend = sparseLimit ? 18 : 28 + Math.sin(timeSeconds / 15) * 2;
      pulseWaveform = sparseLimit ? 20 : pulseWaveform * 0.5;
      movementMagnitude = sparseLimit ? 8 : 16;
      temperatureContactDelta = sparseLimit ? 24 : 38;
      break;
    case "ml_unavailable":
      conductanceTrend += 4 + Math.sin(timeSeconds / 28) * 4;
      movementMagnitude = 11 + Math.sin(timeSeconds / 10) * 2;
      break;
  }

  return {
    timeSeconds,
    ecgDisplayAmplitude: roundOne(clamp(ecgDisplayAmplitude)),
    conductanceTrend: roundOne(clamp(conductanceTrend)),
    pulseWaveform: roundOne(clamp(pulseWaveform)),
    movementMagnitude: roundOne(clamp(movementMagnitude)),
    temperatureContactDelta: roundOne(clamp(temperatureContactDelta)),
    qualityLabel: qualityForScenario(scenarioId, timeSeconds),
    stageId: stageIdForTime(timeSeconds),
  };
}

export function getPhase4DisplayStreamFrames(
  scenarioId: Phase4DemoScenarioId,
): readonly Phase4DisplayStreamFrame[] {
  if (!PHASE4_DEMO_SCENARIO_IDS.includes(scenarioId)) {
    throw new Error(`Unsupported Phase 4 display stream scenario: ${scenarioId}`);
  }

  return Array.from({ length: PHASE4_DEMO_DURATION_SECONDS + 1 }, (_, index) =>
    generateFrame(scenarioId, index),
  );
}

function average(
  frames: readonly Phase4DisplayStreamFrame[],
  selector: (frame: Phase4DisplayStreamFrame) => number,
): number {
  if (frames.length === 0) {
    return 0;
  }

  return roundOne(
    frames.reduce((total, frame) => total + selector(frame), 0) / frames.length,
  );
}

function slope(
  frames: readonly Phase4DisplayStreamFrame[],
  selector: (frame: Phase4DisplayStreamFrame) => number,
): string {
  if (frames.length < 2) {
    return "Flat";
  }

  const delta = selector(frames[frames.length - 1]) - selector(frames[0]);
  if (delta > 8) return "Rising";
  if (delta < -8) return "Cooling";
  return "Stable";
}

function qualityCoverage(frames: readonly Phase4DisplayStreamFrame[]): string {
  if (frames.length === 0) {
    return "0%";
  }

  const usable = frames.filter((frame) => frame.qualityLabel !== "Limited").length;
  return `${Math.round((usable / frames.length) * 100)}%`;
}

export function getPhase4FeatureSummaries(
  frames: readonly Phase4DisplayStreamFrame[],
): readonly Phase4DisplayFeatureSummary[] {
  return [
    {
      label: "Heart-activity display trend",
      value: slope(frames, (frame) => frame.ecgDisplayAmplitude),
      detail: `Window average ${average(frames, (frame) => frame.ecgDisplayAmplitude)}`,
    },
    {
      label: "Conductance slope",
      value: slope(frames, (frame) => frame.conductanceTrend),
      detail: `Window average ${average(frames, (frame) => frame.conductanceTrend)}`,
    },
    {
      label: "Pulse waveform stability",
      value: slope(frames, (frame) => frame.pulseWaveform),
      detail: `Window average ${average(frames, (frame) => frame.pulseWaveform)}`,
    },
    {
      label: "Movement magnitude window",
      value: `${average(frames, (frame) => frame.movementMagnitude)}`,
      detail: "Displayed as movement context only.",
    },
    {
      label: "Temperature/contact delta",
      value: `${average(frames, (frame) => frame.temperatureContactDelta)}`,
      detail: "Technical contact context.",
    },
    {
      label: "Signal quality coverage",
      value: qualityCoverage(frames),
      detail: "Share of visible frames not marked limited.",
    },
  ];
}

export function getPhase4CurrentStreamState({
  scenarioId,
  elapsedSeconds,
}: {
  scenarioId: Phase4DemoScenarioId;
  elapsedSeconds: number;
}): Phase4CurrentStreamState {
  const scenario = getPhase4StreamScenario(scenarioId);
  const frames = getPhase4DisplayStreamFrames(scenarioId);
  const currentSecond = Math.round(
    clamp(elapsedSeconds, 0, PHASE4_DEMO_DURATION_SECONDS),
  );
  const currentFrame = frames[currentSecond] ?? frames[0];
  const windowStart = Math.max(
    0,
    currentSecond - PHASE4_VISIBLE_WINDOW_SECONDS + 1,
  );
  const visibleFrames = frames.filter(
    (frame) =>
      frame.timeSeconds >= windowStart && frame.timeSeconds <= currentSecond,
  );
  const recentFrames = visibleFrames.slice(-10);

  return {
    scenario,
    frames,
    currentFrame,
    visibleFrames,
    recentFrames,
    featureSummaries: getPhase4FeatureSummaries(visibleFrames),
  };
}
