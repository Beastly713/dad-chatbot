import type {
  ObjectiveBaselineFeatureSummary,
  ObjectiveBaselineQuality,
  ObjectiveBaselineRelativeFeatureSet,
  ObjectiveFeatureWindowFoundation,
  ObjectiveSessionBaselineProfile
} from "./types.js";
import { createObjectivePreprocessingVisibility } from "./windowing.js";

export type CreateObjectiveBaselineProfileOptions = {
  baseline_profile_id: string;
  windows: readonly ObjectiveFeatureWindowFoundation[];
  min_usable_windows?: number;
};

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function assertNonEmptyString(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function numericValues(
  windows: readonly ObjectiveFeatureWindowFoundation[],
  selector: (window: ObjectiveFeatureWindowFoundation) => number | null | undefined
): number[] {
  return windows
    .map(selector)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function sharedRequiredValue(
  windows: readonly ObjectiveFeatureWindowFoundation[],
  selector: (window: ObjectiveFeatureWindowFoundation) => string | undefined,
  name: string
): string {
  const values = [...new Set(windows.map(selector).filter(Boolean))] as string[];

  if (values.length !== 1) {
    throw new Error(`baseline windows must share one ${name}`);
  }

  return values[0];
}

function isUsableBaselineWindow(window: ObjectiveFeatureWindowFoundation): boolean {
  const ecgUsable =
    window.features.ecg !== undefined && !window.features.ecg.suppression.suppressed;
  const gsrUsable =
    window.features.gsr !== undefined && !window.features.gsr.suppression.suppressed;
  const ppgUsable =
    window.features.ppg !== undefined && !window.features.ppg.suppression.suppressed;
  const temperatureUsable =
    window.features.temperature !== undefined &&
    !window.features.temperature.suppression.suppressed;

  return (
    window.window_status === "ready" &&
    (ecgUsable || gsrUsable || ppgUsable || temperatureUsable)
  );
}

function calculateBaselineQuality(
  windows: readonly ObjectiveFeatureWindowFoundation[],
  usableWindows: readonly ObjectiveFeatureWindowFoundation[],
  minUsableWindows: number
): ObjectiveBaselineQuality {
  const usableFraction =
    windows.length === 0 ? 0 : usableWindows.length / windows.length;
  const enoughWindows = usableWindows.length >= minUsableWindows;

  const reasons = [
    ...(windows.length === 0 ? ["no_baseline_windows"] : []),
    ...(!enoughWindows ? ["limited_baseline_window_count"] : []),
    ...(usableFraction < 0.5 ? ["low_usable_baseline_fraction"] : [])
  ];

  const state =
    windows.length === 0
      ? "unavailable"
      : enoughWindows && usableFraction >= 0.5
        ? "available"
        : "limited";

  return {
    state,
    baseline_window_count: windows.length,
    usable_baseline_window_count: usableWindows.length,
    quality_score: roundTo(Math.min(1, usableFraction), 4),
    reasons
  };
}

function roundNullable(value: number | null, digits: number): number | null {
  return value === null ? null : roundTo(value, digits);
}

function buildBaselineFeatureSummary(
  usableWindows: readonly ObjectiveFeatureWindowFoundation[]
): ObjectiveBaselineFeatureSummary {
  return {
    ecg_median_hr_bpm: roundNullable(
      median(numericValues(usableWindows, (window) => window.features.ecg?.median_hr_bpm)),
      3
    ),
    ecg_mean_hr_bpm: roundNullable(
      mean(numericValues(usableWindows, (window) => window.features.ecg?.mean_hr_bpm)),
      3
    ),
    gsr_tonic_baseline_deviation_raw: roundNullable(
      mean(
        numericValues(
          usableWindows,
          (window) => window.features.gsr?.tonic_baseline_deviation_raw
        )
      ),
      3
    ),
    ppg_pulse_rate_bpm: roundNullable(
      median(numericValues(usableWindows, (window) => window.features.ppg?.pulse_rate_bpm)),
      3
    ),
    tmp117_trend_c_per_min: roundNullable(
      mean(
        numericValues(
          usableWindows,
          (window) => window.features.temperature?.tmp117_trend_c_per_min
        )
      ),
      5
    ),
    motion_magnitude_mean: roundNullable(
      mean(
        numericValues(
          usableWindows,
          (window) => window.features.imu?.motion_magnitude_mean
        )
      ),
      4
    )
  };
}

function delta(
  current: number | null | undefined,
  baseline: number | null,
  digits: number
): number | null {
  if (
    typeof current !== "number" ||
    !Number.isFinite(current) ||
    typeof baseline !== "number" ||
    !Number.isFinite(baseline)
  ) {
    return null;
  }

  return roundTo(current - baseline, digits);
}

function emptyBaselineRelative(
  reason: string,
  readinessConfidenceModifier: number
): ObjectiveBaselineRelativeFeatureSet {
  return {
    baseline_state: "unavailable",
    readiness_confidence_modifier: readinessConfidenceModifier,
    no_baseline_reason: reason,
    ecg_median_hr_delta_bpm: null,
    ecg_mean_hr_delta_bpm: null,
    gsr_tonic_baseline_deviation_delta_raw: null,
    ppg_pulse_rate_delta_bpm: null,
    tmp117_trend_delta_c_per_min: null,
    motion_magnitude_delta: null
  };
}

export function createObjectiveSessionBaselineProfile(
  options: CreateObjectiveBaselineProfileOptions
): ObjectiveSessionBaselineProfile {
  assertNonEmptyString(options.baseline_profile_id, "baseline_profile_id");

  if (options.windows.length === 0) {
    throw new Error("windows must contain at least one candidate baseline window");
  }

  const minUsableWindows = options.min_usable_windows ?? 2;
  const sessionId = sharedRequiredValue(
    options.windows,
    (window) => window.session_id,
    "session_id"
  );
  const sourceType = sharedRequiredValue(
    options.windows,
    (window) => window.source_type,
    "source_type"
  );
  const usableWindows = options.windows.filter(isUsableBaselineWindow);
  const baselineQuality = calculateBaselineQuality(
    options.windows,
    usableWindows,
    minUsableWindows
  );

  return {
    baseline_profile_id: options.baseline_profile_id,
    session_id: sessionId,
    source_type: sourceType,
    created_from_feature_window_ids: options.windows.map(
      (window) => window.feature_window_id
    ),
    baseline_features: buildBaselineFeatureSummary(usableWindows),
    baseline_quality: baselineQuality,
    visibility: createObjectivePreprocessingVisibility()
  };
}

export function applyObjectiveBaselineRelativeFeatures(
  window: ObjectiveFeatureWindowFoundation,
  baselineProfile?: ObjectiveSessionBaselineProfile
): ObjectiveFeatureWindowFoundation {
  if (!baselineProfile) {
    const baselineRelative = emptyBaselineRelative("baseline_unavailable", 0.6);

    return {
      ...window,
      baseline_relative: baselineRelative,
      uncertainty_reasons: [
        ...new Set([...window.uncertainty_reasons, "baseline_unavailable"])
      ]
    };
  }

  const baselineState = baselineProfile.baseline_quality.state;
  const baselineFeatures = baselineProfile.baseline_features;

  if (baselineState === "unavailable") {
    const baselineRelative = emptyBaselineRelative("baseline_unavailable", 0.6);

    return {
      ...window,
      baseline_relative: {
        ...baselineRelative,
        baseline_state: "unavailable",
        baseline_profile_id: baselineProfile.baseline_profile_id
      },
      uncertainty_reasons: [
        ...new Set([...window.uncertainty_reasons, "baseline_unavailable"])
      ]
    };
  }

  const readinessConfidenceModifier = baselineState === "available" ? 1 : 0.75;
  const baselineRelative: ObjectiveBaselineRelativeFeatureSet = {
    baseline_state: baselineState,
    baseline_profile_id: baselineProfile.baseline_profile_id,
    readiness_confidence_modifier: readinessConfidenceModifier,
    ...(baselineState === "limited"
      ? { no_baseline_reason: "baseline_limited" }
      : {}),
    ecg_median_hr_delta_bpm: delta(
      window.features.ecg?.median_hr_bpm,
      baselineFeatures.ecg_median_hr_bpm,
      3
    ),
    ecg_mean_hr_delta_bpm: delta(
      window.features.ecg?.mean_hr_bpm,
      baselineFeatures.ecg_mean_hr_bpm,
      3
    ),
    gsr_tonic_baseline_deviation_delta_raw: delta(
      window.features.gsr?.tonic_baseline_deviation_raw,
      baselineFeatures.gsr_tonic_baseline_deviation_raw,
      3
    ),
    ppg_pulse_rate_delta_bpm: delta(
      window.features.ppg?.pulse_rate_bpm,
      baselineFeatures.ppg_pulse_rate_bpm,
      3
    ),
    tmp117_trend_delta_c_per_min: delta(
      window.features.temperature?.tmp117_trend_c_per_min,
      baselineFeatures.tmp117_trend_c_per_min,
      5
    ),
    motion_magnitude_delta: delta(
      window.features.imu?.motion_magnitude_mean,
      baselineFeatures.motion_magnitude_mean,
      4
    )
  };

  return {
    ...window,
    baseline_relative: baselineRelative,
    uncertainty_reasons: [
      ...new Set([
        ...window.uncertainty_reasons,
        ...(baselineState === "limited" ? ["baseline_limited"] : [])
      ])
    ]
  };
}

export function applyObjectiveBaselineRelativeFeaturesForWindows(
  windows: readonly ObjectiveFeatureWindowFoundation[],
  baselineProfile?: ObjectiveSessionBaselineProfile
): ObjectiveFeatureWindowFoundation[] {
  return windows.map((window) =>
    applyObjectiveBaselineRelativeFeatures(window, baselineProfile)
  );
}
