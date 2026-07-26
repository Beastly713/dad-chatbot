import type {
  ObjectiveFeatureWindowFoundation,
  ObjectiveImuFeatureSet,
  ObjectiveModalitySample,
  ObjectivePpgBestChannel,
  ObjectivePpgFeatureSet,
  ObjectiveTemperatureFeatureSet
} from "./types.js";

type NumericSample = {
  esp_time_ms: number;
  value: number;
};

type MultiAxisSample = {
  esp_time_ms: number;
  x: number;
  y: number;
  z: number;
};

type PpgChannelName = "max_red" | "max_ir" | "max_green";

type PpgChannelAnalysis = {
  channel: PpgChannelName;
  samples: NumericSample[];
  peaks: NumericSample[];
  quality: number;
  medianIntervalMs: number | null;
  pulseRateBpm: number | null;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function qualityFromAvailability(
  presentFraction: number,
  staleOrHeldFraction: number
): number {
  return clamp01(presentFraction * (1 - staleOrHeldFraction));
}

function getNumericSamples(
  samples: readonly ObjectiveModalitySample[],
  fieldName:
    | "max_red"
    | "max_ir"
    | "max_green"
    | "accel_x"
    | "accel_y"
    | "accel_z"
    | "gyro_x"
    | "gyro_y"
    | "gyro_z"
    | "tmp117_temp_c"
    | "mpu_temp_c"
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

function getAxisSamples(
  samples: readonly ObjectiveModalitySample[],
  xField: "accel_x" | "gyro_x",
  yField: "accel_y" | "gyro_y",
  zField: "accel_z" | "gyro_z"
): MultiAxisSample[] {
  return samples
    .map((sample) => {
      const x = sample.values[xField];
      const y = sample.values[yField];
      const z = sample.values[zField];

      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof z !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
      ) {
        return null;
      }

      return {
        esp_time_ms: sample.esp_time_ms,
        x,
        y,
        z
      };
    })
    .filter((sample): sample is MultiAxisSample => sample !== null)
    .sort((left, right) => left.esp_time_ms - right.esp_time_ms);
}

function magnitude(sample: Pick<MultiAxisSample, "x" | "y" | "z">): number {
  return Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
}

function selectRefractoryPeaks(
  candidates: readonly NumericSample[],
  refractoryMs: number
): NumericSample[] {
  const selected: NumericSample[] = [];

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

function localPeaks(samples: readonly NumericSample[]): NumericSample[] {
  if (samples.length < 3) {
    return [];
  }

  const values = samples.map((sample) => sample.value);
  const avg = mean(values);
  const std = standardDeviation(values);

  if (avg === null || std === null || std === 0) {
    return [];
  }

  const threshold = avg + std * 0.55;
  const candidates: NumericSample[] = [];

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

function intervalsMs(peaks: readonly NumericSample[]): number[] {
  return peaks
    .slice(1)
    .map((peak, index) => peak.esp_time_ms - peaks[index].esp_time_ms)
    .filter((interval) => interval >= 300 && interval <= 2000);
}

function analyzePpgChannel(
  channel: PpgChannelName,
  samples: readonly ObjectiveModalitySample[]
): PpgChannelAnalysis {
  const channelSamples = getNumericSamples(samples, channel);
  const peaks = localPeaks(channelSamples);
  const intervals = intervalsMs(peaks);
  const medianIntervalMs = median(intervals);
  const pulseRateBpm =
    medianIntervalMs === null || medianIntervalMs <= 0
      ? null
      : 60000 / medianIntervalMs;

  const values = channelSamples.map((sample) => sample.value);
  const std = standardDeviation(values) ?? 0;
  const peakDensityQuality = Math.min(1, peaks.length / 4);
  const intervalQuality = intervals.length === 0 ? 0 : Math.min(1, intervals.length / 4);
  const variationQuality = clamp01(std / 12);

  return {
    channel,
    samples: channelSamples,
    peaks,
    quality: clamp01((peakDensityQuality + intervalQuality + variationQuality) / 3),
    medianIntervalMs,
    pulseRateBpm
  };
}

function getBestPpgChannel(
  samples: readonly ObjectiveModalitySample[]
): PpgChannelAnalysis {
  const analyses = [
    analyzePpgChannel("max_red", samples),
    analyzePpgChannel("max_ir", samples),
    analyzePpgChannel("max_green", samples)
  ];

  return analyses.sort((left, right) => right.quality - left.quality)[0];
}

function getEcgMedianIntervalMs(
  window: ObjectiveFeatureWindowFoundation
): number | null {
  const ecg = window.features.ecg;

  if (!ecg || ecg.suppression.suppressed) {
    return null;
  }

  if (!ecg.median_hr_bpm || ecg.median_hr_bpm <= 0) {
    return null;
  }

  return 60000 / ecg.median_hr_bpm;
}

function calculateEcgPpgAgreement(
  ecgMedianIntervalMs: number | null,
  ppgMedianIntervalMs: number | null
): number | null {
  if (
    ecgMedianIntervalMs === null ||
    ppgMedianIntervalMs === null ||
    ecgMedianIntervalMs <= 0 ||
    ppgMedianIntervalMs <= 0
  ) {
    return null;
  }

  const difference = Math.abs(ecgMedianIntervalMs - ppgMedianIntervalMs);
  const denominator = Math.max(ecgMedianIntervalMs, ppgMedianIntervalMs);

  return clamp01(1 - difference / denominator);
}

function extractPpgFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectivePpgFeatureSet {
  const availability = window.modality_availability.ppg;
  const missingness = window.missingness.ppg;
  const staleOrHeldFraction =
    missingness.expected_sample_count === 0
      ? 1
      : (missingness.stale_sample_count + missingness.held_sample_count) /
        missingness.expected_sample_count;

  const bestChannel = getBestPpgChannel(window.buffers.ppg.samples);
  const availabilityQuality = qualityFromAvailability(
    availability.present_fraction,
    staleOrHeldFraction
  );
  const waveformQualityScore = availabilityQuality * bestChannel.quality;
  const ecgPpgAgreement = calculateEcgPpgAgreement(
    getEcgMedianIntervalMs(window),
    bestChannel.medianIntervalMs
  );

  const suppressionReasons = [
    ...(availability.state === "unavailable" ? ["ppg_unavailable"] : []),
    ...(availability.state === "partial" ? ["ppg_partial_availability"] : []),
    ...(bestChannel.samples.length < 10 ? ["ppg_insufficient_samples"] : []),
    ...(bestChannel.peaks.length < 3 ? ["ppg_insufficient_pulse_peaks"] : []),
    ...(waveformQualityScore < 0.25 ? ["ppg_waveform_quality_low"] : [])
  ];

  const suppressed = suppressionReasons.length > 0;
  const safeBestChannel: ObjectivePpgBestChannel = suppressed
    ? null
    : bestChannel.channel;

  return {
    modality: "ppg",
    best_channel: safeBestChannel,
    pulse_rate_bpm:
      suppressed || bestChannel.pulseRateBpm === null
        ? null
        : roundTo(bestChannel.pulseRateBpm, 2),
    pulse_interval_median_ms:
      suppressed || bestChannel.medianIntervalMs === null
        ? null
        : roundTo(bestChannel.medianIntervalMs, 2),
    waveform_quality_score: roundTo(waveformQualityScore, 4),
    ecg_ppg_pulse_interval_agreement:
      suppressed || ecgPpgAgreement === null ? null : roundTo(ecgPpgAgreement, 4),
    suppression: {
      suppressed,
      reasons: suppressionReasons
    }
  };
}

function calculateJerkMean(accelSamples: readonly MultiAxisSample[]): number | null {
  if (accelSamples.length < 2) {
    return null;
  }

  const jerkValues = accelSamples
    .slice(1)
    .map((sample, index) => {
      const previous = accelSamples[index];
      const deltaSeconds = (sample.esp_time_ms - previous.esp_time_ms) / 1000;

      if (deltaSeconds <= 0) {
        return null;
      }

      const deltaMagnitude = Math.abs(magnitude(sample) - magnitude(previous));

      return deltaMagnitude / deltaSeconds;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  return mean(jerkValues);
}

function extractImuFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveImuFeatureSet {
  const availability = window.modality_availability.imu;
  const missingness = window.missingness.imu;
  const accelSamples = getAxisSamples(
    window.buffers.imu.samples,
    "accel_x",
    "accel_y",
    "accel_z"
  );
  const gyroSamples = getAxisSamples(
    window.buffers.imu.samples,
    "gyro_x",
    "gyro_y",
    "gyro_z"
  );

  const accelMagnitudes = accelSamples.map(magnitude);
  const gyroMagnitudes = gyroSamples.map(magnitude);
  const motionMagnitudeMean = mean(accelMagnitudes);
  const motionMagnitudeMax =
    accelMagnitudes.length === 0 ? null : Math.max(...accelMagnitudes);
  const jerkMean = calculateJerkMean(accelSamples);
  const gyroMagnitudeMean = mean(gyroMagnitudes);
  const stillnessFraction =
    accelMagnitudes.length === 0
      ? null
      : accelMagnitudes.filter((value) => Math.abs(value - 9.81) < 0.35).length /
        accelMagnitudes.length;

  const staleOrHeldFraction =
    missingness.expected_sample_count === 0
      ? 1
      : (missingness.stale_sample_count + missingness.held_sample_count) /
        missingness.expected_sample_count;
  const availabilityQuality = qualityFromAvailability(
    availability.present_fraction,
    staleOrHeldFraction
  );

  const motionExcess =
    motionMagnitudeMean === null
      ? 0
      : Math.min(1, Math.abs(motionMagnitudeMean - 9.81) / 4);
  const gyroComponent =
    gyroMagnitudeMean === null ? 0 : Math.min(1, gyroMagnitudeMean / 0.6);
  const jerkComponent = jerkMean === null ? 0 : Math.min(1, jerkMean / 8);
  const activityLikeConfoundIndex =
    availabilityQuality *
    clamp01((motionExcess + gyroComponent + jerkComponent) / 3);

  const suppressionReasons = [
    ...(availability.state === "unavailable" ? ["imu_unavailable"] : []),
    ...(availability.state === "partial" ? ["imu_partial_availability"] : []),
    ...(accelSamples.length < 3 ? ["imu_insufficient_accel_samples"] : []),
    ...(gyroSamples.length < 3 ? ["imu_insufficient_gyro_samples"] : [])
  ];

  const suppressed = suppressionReasons.length > 0;

  return {
    modality: "imu",
    motion_magnitude_mean:
      suppressed || motionMagnitudeMean === null
        ? null
        : roundTo(motionMagnitudeMean, 4),
    motion_magnitude_max:
      suppressed || motionMagnitudeMax === null
        ? null
        : roundTo(motionMagnitudeMax, 4),
    jerk_mean:
      suppressed || jerkMean === null ? null : roundTo(jerkMean, 4),
    gyro_magnitude_mean:
      suppressed || gyroMagnitudeMean === null
        ? null
        : roundTo(gyroMagnitudeMean, 4),
    stillness_fraction:
      suppressed || stillnessFraction === null
        ? null
        : roundTo(stillnessFraction, 4),
    activity_like_confound_index: roundTo(activityLikeConfoundIndex, 4),
    suppression: {
      suppressed,
      reasons: suppressionReasons
    }
  };
}

function calculateContactShift(samples: readonly NumericSample[]): number | null {
  if (samples.length < 2) {
    return null;
  }

  const firstWindowCount = Math.max(1, Math.ceil(samples.length * 0.2));
  const lastWindowCount = Math.max(1, Math.ceil(samples.length * 0.2));
  const firstMean = mean(samples.slice(0, firstWindowCount).map((sample) => sample.value));
  const lastMean = mean(samples.slice(-lastWindowCount).map((sample) => sample.value));

  if (firstMean === null || lastMean === null) {
    return null;
  }

  return lastMean - firstMean;
}

function extractTemperatureFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveTemperatureFeatureSet {
  const availability = window.modality_availability.temperature;
  const missingness = window.missingness.temperature;
  const tmp117Samples = getNumericSamples(
    window.buffers.temperature.samples,
    "tmp117_temp_c"
  );
  const mpuTempSamples = getNumericSamples(
    window.buffers.temperature.samples,
    "mpu_temp_c"
  );

  const staleOrHeldFraction =
    missingness.expected_sample_count === 0
      ? 1
      : (missingness.stale_sample_count + missingness.held_sample_count) /
        missingness.expected_sample_count;
  const localTemperatureQualityScore = qualityFromAvailability(
    availability.present_fraction,
    staleOrHeldFraction
  );
  const boardTemperatureQualityScore =
    mpuTempSamples.length === 0
      ? 0
      : qualityFromAvailability(
          mpuTempSamples.length / Math.max(1, missingness.expected_sample_count),
          staleOrHeldFraction
        );

  const suppressionReasons = [
    ...(availability.state === "unavailable" ? ["temperature_unavailable"] : []),
    ...(availability.state === "partial" ||
    tmp117Samples.length < missingness.expected_sample_count
      ? ["temperature_partial_availability"]
      : []),
    ...(tmp117Samples.length < 3 ? ["tmp117_insufficient_samples"] : [])
  ];

  const suppressed = suppressionReasons.length > 0;

  return {
    modality: "temperature",
    tmp117_trend_c_per_min:
      suppressed || tmp117Samples.length < 2
        ? null
        : roundTo(linearSlopePerMinute(tmp117Samples) ?? 0, 5),
    tmp117_contact_shift_c:
      suppressed || tmp117Samples.length < 2
        ? null
        : roundTo(calculateContactShift(tmp117Samples) ?? 0, 4),
    mpu_board_heating_indicator_c_per_min:
      mpuTempSamples.length < 2
        ? null
        : roundTo(linearSlopePerMinute(mpuTempSamples) ?? 0, 5),
    local_temperature_quality_score: roundTo(localTemperatureQualityScore, 4),
    board_temperature_quality_score: roundTo(boardTemperatureQualityScore, 4),
    suppression: {
      suppressed,
      reasons: suppressionReasons
    }
  };
}

export function extractPpgImuTemperatureFeatures(
  window: ObjectiveFeatureWindowFoundation
): ObjectiveFeatureWindowFoundation {
  const ppg = extractPpgFeatures(window);
  const imu = extractImuFeatures(window);
  const temperature = extractTemperatureFeatures(window);

  const uncertaintyReasons = [
    ...window.uncertainty_reasons,
    ...(ppg.suppression.suppressed ? ppg.suppression.reasons : []),
    ...(imu.suppression.suppressed ? imu.suppression.reasons : []),
    ...(temperature.suppression.suppressed ? temperature.suppression.reasons : [])
  ];

  return {
    ...window,
    features: {
      ...window.features,
      ppg,
      imu,
      temperature
    },
    uncertainty_reasons: [...new Set(uncertaintyReasons)]
  };
}

export function extractPpgImuTemperatureFeaturesForWindows(
  windows: readonly ObjectiveFeatureWindowFoundation[]
): ObjectiveFeatureWindowFoundation[] {
  return windows.map(extractPpgImuTemperatureFeatures);
}
