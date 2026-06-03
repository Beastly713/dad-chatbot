import type {
  ObjectiveEcgFeatureSet,
  ObjectiveFeatureWindowFoundation,
  ObjectiveGsrFeatureSet,
  ObjectiveModalitySample
} from "./types.js";

type NumericSample = {
  esp_time_ms: number;
  value: number;
};

type Peak = {
  esp_time_ms: number;
  value: number;
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

function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const avg = mean(values);

  if (avg === null) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function linearSlopePerMinute(samples: readonly NumericSample[]): number | null {
  if (samples.length < 2) {
    return null;
  }

  const firstTime = samples[0].esp_time_ms;
  const xs = samples.map((sample) => (sample.esp_time_ms - firstTime) / 60000);
  const ys = samples.map((sample) => sample.value);
  const xMean = mean(xs);
  const yMean = mean(ys);

  if (xMean === null || yMean === null) {
    return null;
  }

  const numerator = xs.reduce(
    (sum, x, index) => sum + (x - xMean) * (ys[index] - yMean),
    0
  );
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function getNumericSamples(
  samples: readonly ObjectiveModalitySample[],
  fieldName: "ecg_raw" | "gsr_raw"
): NumericSample[] {
  return samples
    .map((sample) => {
      const value = sample.values[fieldName];

      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }

      return {
        esp_time_ms: sample.esp_time_ms,
        value
      };
    })
    .filter((sample): sample is NumericSample => sample !== null)
    .sort((left, right) => left.esp_time_ms - right.esp_time_ms);
}

function selectRefractoryPeaks(
  candidates: readonly Peak[],
  refractoryMs: number
): Peak[] {
  const selected: Peak[] = [];

  for (const candidate of candidates) {
    const previous = selected[selected.length - 1];

    if (!previous || candidate.esp_time_ms - previous.esp_time_ms >= refractoryMs) {
      selected.push(candidate);
      continue;
    }

    if (candidate.value > previous.value) {
      selected[selected.length - 1] = candidate;
    }
  }

  return selected;
}

function detectEcgRPeaks(samples: readonly NumericSample[]): Peak[] {
  if (samples.length < 3) {
    return [];
  }

  const values = samples.map((sample) => sample.value);
  const avg = mean(values);
  const std = standardDeviation(values);

  if (avg === null || std === null || std === 0) {
    return [];
  }

  const threshold = avg + std * 1.35;
  const candidates: Peak[] = [];

  for (let index = 1; index < samples.length - 1; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const next = samples[index + 1];

    if (
      current.value > previous.value &&
      current.value >= next.value &&
      current.value >= threshold
    ) {
      candidates.push(current);
    }
  }

  return selectRefractoryPeaks(candidates, 300);
}

function calculateRrIntervalsMs(peaks: readonly Peak[]): number[] {
  return peaks
    .slice(1)
    .map((peak, index) => peak.esp_time_ms - peaks[index].esp_time_ms);
}

function validRrIntervalsMs(rrIntervalsMs: readonly number[]): number[] {
  return rrIntervalsMs.filter((interval) => interval >= 300 && interval <= 2000);
}

function calculateRmssdMs(rrIntervalsMs: readonly number[]): number | null {
  if (rrIntervalsMs.length < 2) {
    return null;
  }

  const squaredDiffs = rrIntervalsMs
    .slice(1)
    .map((interval, index) => (interval - rrIntervalsMs[index]) ** 2);
  const avgSquaredDiff = mean(squaredDiffs);

  if (avgSquaredDiff === null) {
    return null;
  }

  return Math.sqrt(avgSquaredDiff);
}

function calculateBpmSeriesFromRr(rrIntervalsMs: readonly number[]): NumericSample[] {
  return rrIntervalsMs.map((interval, index) => ({
    esp_time_ms: index,
    value: 60000 / interval
  }));
}

function qualityFromAvailability(
  presentFraction: number,
  staleOrHeldFraction: number
): number {
  return Math.max(0, Math.min(1, presentFraction * (1 - staleOrHeldFraction)));
}

function extractEcgFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveEcgFeatureSet {
  const availability = window.modality_availability.ecg;
  const missingness = window.missingness.ecg;
  const samples = getNumericSamples(window.buffers.ecg.samples, "ecg_raw");
  const peaks = detectEcgRPeaks(samples);
  const rrIntervalsMs = calculateRrIntervalsMs(peaks);
  const validRr = validRrIntervalsMs(rrIntervalsMs);
  const bpmValues = validRr.map((interval) => 60000 / interval);
  const staleOrHeldFraction =
    missingness.expected_sample_count === 0
      ? 1
      : (missingness.stale_sample_count + missingness.held_sample_count) /
        missingness.expected_sample_count;

  const rrValidityFraction =
    rrIntervalsMs.length === 0 ? 0 : validRr.length / rrIntervalsMs.length;
  const peakDensityScore = Math.min(1, peaks.length / 4);
  const rPeakQualityScore =
    qualityFromAvailability(availability.present_fraction, staleOrHeldFraction) *
    rrValidityFraction *
    peakDensityScore;

  const suppressionReasons = [
    ...(availability.state === "unavailable" ? ["ecg_unavailable"] : []),
    ...(availability.state === "partial" ? ["ecg_partial_availability"] : []),
    ...(samples.length < 10 ? ["ecg_insufficient_samples"] : []),
    ...(peaks.length < 3 ? ["ecg_insufficient_r_peaks"] : []),
    ...(rrValidityFraction < 0.6 ? ["ecg_rr_validity_low"] : []),
    ...(rPeakQualityScore < 0.35 ? ["ecg_quality_low"] : [])
  ];

  const suppressed = suppressionReasons.length > 0;

  return {
    modality: "ecg",
    mean_hr_bpm:
      suppressed || bpmValues.length === 0 ? null : roundTo(mean(bpmValues) ?? 0, 2),
    median_hr_bpm:
      suppressed || bpmValues.length === 0
        ? null
        : roundTo(median(bpmValues) ?? 0, 2),
    hr_slope_bpm_per_min:
      suppressed || bpmValues.length < 2
        ? null
        : roundTo(linearSlopePerMinute(calculateBpmSeriesFromRr(validRr)) ?? 0, 4),
    rr_validity_fraction: roundTo(rrValidityFraction, 4),
    rmssd_ms:
      suppressed || validRr.length < 3
        ? null
        : roundTo(calculateRmssdMs(validRr) ?? 0, 2),
    sdnn_ms:
      suppressed || validRr.length < 3
        ? null
        : roundTo(standardDeviation(validRr) ?? 0, 2),
    r_peak_count: peaks.length,
    r_peak_quality_score: roundTo(rPeakQualityScore, 4),
    suppression: {
      suppressed,
      reasons: suppressionReasons
    }
  };
}

function estimateGsrBaseline(samples: readonly NumericSample[]): number | null {
  if (samples.length === 0) {
    return null;
  }

  const baselineCount = Math.max(1, Math.ceil(samples.length * 0.2));
  return mean(samples.slice(0, baselineCount).map((sample) => sample.value));
}

function calculatePositiveAreaRawSeconds(
  samples: readonly NumericSample[]
): number | null {
  if (samples.length < 2) {
    return null;
  }

  const baseline = estimateGsrBaseline(samples);

  if (baseline === null) {
    return null;
  }

  let area = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const deltaSeconds = Math.max(
      0,
      (current.esp_time_ms - previous.esp_time_ms) / 1000
    );
    const positiveAmplitude = Math.max(0, current.value - baseline);

    area += positiveAmplitude * deltaSeconds;
  }

  return area;
}

function countGsrScrLikeRises(samples: readonly NumericSample[]): number {
  if (samples.length < 3) {
    return 0;
  }

  const values = samples.map((sample) => sample.value);
  const std = standardDeviation(values) ?? 0;
  const riseThreshold = Math.max(8, std * 0.35);
  let count = 0;
  let inRise = false;

  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].value - samples[index - 1].value;

    if (!inRise && delta >= riseThreshold) {
      count += 1;
      inRise = true;
      continue;
    }

    if (delta <= 0) {
      inRise = false;
    }
  }

  return count;
}

function extractGsrFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveGsrFeatureSet {
  const availability = window.modality_availability.gsr;
  const missingness = window.missingness.gsr;
  const samples = getNumericSamples(window.buffers.gsr.samples, "gsr_raw");
  const baseline = estimateGsrBaseline(samples);
  const sampleValues = samples.map((sample) => sample.value);
  const sampleMean = mean(sampleValues);
  const durationMinutes =
    samples.length < 2
      ? null
      : (samples[samples.length - 1].esp_time_ms - samples[0].esp_time_ms) / 60000;
  const scrCount = countGsrScrLikeRises(samples);
  const staleOrHeldFraction =
    missingness.expected_sample_count === 0
      ? 1
      : (missingness.stale_sample_count + missingness.held_sample_count) /
        missingness.expected_sample_count;
  const gsrQualityScore = qualityFromAvailability(
    availability.present_fraction,
    staleOrHeldFraction
  );

  const suppressionReasons = [
    ...(availability.state === "unavailable" ? ["gsr_unavailable"] : []),
    ...(availability.state === "partial" ? ["gsr_partial_availability"] : []),
    ...(samples.length < 3 ? ["gsr_insufficient_samples"] : []),
    ...(gsrQualityScore < 0.35 ? ["gsr_quality_low"] : [])
  ];

  const suppressed = suppressionReasons.length > 0;

  return {
    modality: "gsr",
    tonic_trend_raw_per_min:
      suppressed || samples.length < 2
        ? null
        : roundTo(linearSlopePerMinute(samples) ?? 0, 4),
    tonic_baseline_deviation_raw:
      suppressed || baseline === null || sampleMean === null
        ? null
        : roundTo(sampleMean - baseline, 3),
    scr_count: suppressed ? 0 : scrCount,
    scr_rate_per_min:
      suppressed || durationMinutes === null || durationMinutes <= 0
        ? null
        : roundTo(scrCount / durationMinutes, 4),
    phasic_area_raw_seconds:
      suppressed || samples.length < 2
        ? null
        : roundTo(calculatePositiveAreaRawSeconds(samples) ?? 0, 3),
    gsr_quality_score: roundTo(gsrQualityScore, 4),
    suppression: {
      suppressed,
      reasons: suppressionReasons
    }
  };
}

export function extractEcgGsrFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveFeatureWindowFoundation {
  const ecg = extractEcgFeatures(window);
  const gsr = extractGsrFeatures(window);
  const uncertaintyReasons = [
    ...window.uncertainty_reasons,
    ...(ecg.suppression.suppressed ? ecg.suppression.reasons : []),
    ...(gsr.suppression.suppressed ? gsr.suppression.reasons : [])
  ];

  return {
    ...window,
    features: {
      ...window.features,
      ecg,
      gsr
    },
    uncertainty_reasons: [...new Set(uncertaintyReasons)]
  };
}

export function extractEcgGsrFeaturesForWindows(
  windows: readonly ObjectiveFeatureWindowFoundation[]
): ObjectiveFeatureWindowFoundation[] {
  return windows.map(extractEcgGsrFeatures);
}
