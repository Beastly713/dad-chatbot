import type {
  ObjectiveCrossSignalFeatureSet,
  ObjectiveFeatureWindowFoundation
} from "./types.js";

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getBaselineDelta(
  window: ObjectiveFeatureWindowFoundation,
  key:
    | "ecg_median_hr_delta_bpm"
    | "ecg_mean_hr_delta_bpm"
    | "gsr_tonic_baseline_deviation_delta_raw"
): number | null {
  const relative = window.baseline_relative;

  if (!("baseline_state" in relative)) {
    return null;
  }

  const value = relative[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calculateHrGsrAgreementIndex(
  hrDelta: number | null,
  gsrDelta: number | null
): number | null {
  if (hrDelta === null || gsrDelta === null) {
    return null;
  }

  const hrDirection = Math.sign(hrDelta);
  const gsrDirection = Math.sign(gsrDelta);

  if (hrDirection === 0 || gsrDirection === 0) {
    return 0.5;
  }

  const sameDirection = hrDirection === gsrDirection;
  const hrStrength = Math.min(1, Math.abs(hrDelta) / 20);
  const gsrStrength = Math.min(1, Math.abs(gsrDelta) / 50);
  const strength = (hrStrength + gsrStrength) / 2;

  return sameDirection ? 0.5 + strength * 0.5 : 0.5 - strength * 0.5;
}

function hrGsrState(
  index: number | null
): ObjectiveCrossSignalFeatureSet["hr_gsr_agreement_state"] {
  if (index === null) {
    return "unavailable";
  }

  return index >= 0.55 ? "agreement" : "divergence";
}

function ecgPpgAgreementState(
  value: number | null | undefined
): ObjectiveCrossSignalFeatureSet["ecg_ppg_agreement_state"] {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unavailable";
  }

  return value >= 0.7 ? "agreement" : "disagreement";
}

function calculateSignalConflictScore(options: {
  hrGsrIndex: number | null;
  ecgPpgValue: number | null;
  highMotionConfoundPresent: boolean;
  baselineState: "available" | "limited" | "unavailable" | null;
}): number {
  let conflict = 0;

  if (options.hrGsrIndex !== null && options.hrGsrIndex < 0.45) {
    conflict += 0.35;
  }

  if (options.ecgPpgValue !== null && options.ecgPpgValue < 0.7) {
    conflict += 0.35;
  }

  if (options.highMotionConfoundPresent) {
    conflict += 0.2;
  }

  if (options.baselineState !== "available") {
    conflict += 0.1;
  }

  return roundTo(clamp01(conflict), 4);
}

export function extractObjectiveCrossSignalFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveFeatureWindowFoundation {
  const baselineState =
    "baseline_state" in window.baseline_relative
      ? window.baseline_relative.baseline_state
      : null;
  const hrDelta =
    getBaselineDelta(window, "ecg_median_hr_delta_bpm") ??
    getBaselineDelta(window, "ecg_mean_hr_delta_bpm");
  const gsrDelta = getBaselineDelta(
    window,
    "gsr_tonic_baseline_deviation_delta_raw"
  );
  const hrGsrAgreementIndex = calculateHrGsrAgreementIndex(hrDelta, gsrDelta);
  const highMotionConfoundPresent =
    (window.features.imu?.activity_like_confound_index ?? 0) >= 0.45;
  const motionConfoundIndex =
    window.features.imu?.activity_like_confound_index ?? 0;
  const ecgPpgAgreementValue =
    window.features.ppg?.ecg_ppg_pulse_interval_agreement ?? null;
  const ecgPpgState = ecgPpgAgreementState(ecgPpgAgreementValue);
  const signalConflictScore = calculateSignalConflictScore({
    hrGsrIndex: hrGsrAgreementIndex,
    ecgPpgValue: ecgPpgAgreementValue,
    highMotionConfoundPresent,
    baselineState
  });

  const uncertaintyReasons = [
    ...(hrGsrAgreementIndex === null ? ["hr_gsr_agreement_unavailable"] : []),
    ...(hrGsrAgreementIndex !== null && hrGsrAgreementIndex < 0.45
      ? ["hr_gsr_divergence"]
      : []),
    ...(ecgPpgState === "unavailable" ? ["ecg_ppg_agreement_unavailable"] : []),
    ...(ecgPpgState === "disagreement" ? ["ecg_ppg_disagreement"] : []),
    ...(highMotionConfoundPresent ? ["high_motion_confound"] : []),
    ...(baselineState !== "available" ? ["baseline_confidence_limited"] : [])
  ];

  const crossSignal: ObjectiveCrossSignalFeatureSet = {
    hr_gsr_agreement_index:
      hrGsrAgreementIndex === null ? null : roundTo(hrGsrAgreementIndex, 4),
    hr_gsr_agreement_state: hrGsrState(hrGsrAgreementIndex),
    high_motion_confound_present: highMotionConfoundPresent,
    motion_confound_index: roundTo(motionConfoundIndex, 4),
    ecg_ppg_agreement_state: ecgPpgState,
    ecg_ppg_agreement_value:
      ecgPpgAgreementValue === null ? null : roundTo(ecgPpgAgreementValue, 4),
    signal_conflict_score: signalConflictScore,
    uncertainty_reasons: uncertaintyReasons
  };

  return {
    ...window,
    cross_signal: crossSignal,
    uncertainty_reasons: [
      ...new Set([...window.uncertainty_reasons, ...uncertaintyReasons])
    ]
  };
}

export function extractObjectiveCrossSignalFeaturesForWindows(
  windows: readonly ObjectiveFeatureWindowFoundation[]
): ObjectiveFeatureWindowFoundation[] {
  return windows.map(extractObjectiveCrossSignalFeatures);
}
