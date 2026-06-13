export type ObjectiveChartSeriesKind =
  | "ecg_preview"
  | "gsr_trend"
  | "ppg_preview"
  | "motion_context"
  | "tmp117_temperature_trend"
  | "mpu_device_temperature";

export type ObjectiveChartPoint = {
  tMs: number;
  value: number;
};

export type ObjectiveChartSeries = {
  kind: ObjectiveChartSeriesKind;
  title: string;
  subtitle: string;
  yLabel: string;
  sourceNote: string;
  points: ObjectiveChartPoint[];
};

export const OBJECTIVE_CHART_MAX_POINTS = 48;

export function downsampleObjectiveChartPoints(
  points: readonly ObjectiveChartPoint[],
  maxPoints = OBJECTIVE_CHART_MAX_POINTS,
): ObjectiveChartPoint[] {
  if (!Number.isInteger(maxPoints) || maxPoints <= 1) {
    throw new Error("maxPoints must be an integer greater than 1");
  }

  const sanitized = points
    .map((point) => ({
      tMs: point.tMs,
      value: point.value,
    }))
    .filter(
      (point) => Number.isFinite(point.tMs) && Number.isFinite(point.value),
    )
    .sort((a, b) => a.tMs - b.tMs);

  if (sanitized.length <= maxPoints) {
    return sanitized;
  }

  const selected: ObjectiveChartPoint[] = [];
  const lastIndex = sanitized.length - 1;

  for (let i = 0; i < maxPoints; i += 1) {
    const sourceIndex = Math.round((i * lastIndex) / (maxPoints - 1));
    selected.push(sanitized[sourceIndex]);
  }

  return selected;
}

function makeWave(
  count: number,
  base: number,
  amplitude: number,
  period: number,
): ObjectiveChartPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const tMs = index * 250;
    const value =
      base +
      amplitude * Math.sin((2 * Math.PI * index) / period) +
      (index % 7 === 0 ? amplitude * 0.18 : 0);

    return {
      tMs,
      value: Math.round(value * 100) / 100,
    };
  });
}

function makeTrend(
  count: number,
  start: number,
  step: number,
  wobble: number,
): ObjectiveChartPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const tMs = index * 1000;
    const value =
      start +
      step * index +
      wobble * Math.sin((2 * Math.PI * index) / Math.max(8, count / 3));

    return {
      tMs,
      value: Math.round(value * 100) / 100,
    };
  });
}

export function createObjectiveDemoChartSeries(): ObjectiveChartSeries[] {
  return [
    {
      kind: "ecg_preview",
      title: "ECG preview",
      subtitle:
        "Chart-ready downsampled preview of heart-activity signal shape.",
      yLabel: "Raw ADC/count preview",
      sourceNote:
        "Shown as raw/prototype/simulated chart-ready data, not as care guidance or scoring.",
      points: downsampleObjectiveChartPoints(makeWave(96, 2100, 420, 10)),
    },
    {
      kind: "gsr_trend",
      title: "GSR trend",
      subtitle:
        "Chart-ready skin-conductance trend for autonomic arousal context.",
      yLabel: "Raw ADC/count trend",
      sourceNote:
        "Shown as raw/prototype/simulated chart-ready data. Slow trend only; not a clinical conclusion.",
      points: downsampleObjectiveChartPoints(makeTrend(96, 2380, 2.4, 18)),
    },
    {
      kind: "ppg_preview",
      title: "PPG preview",
      subtitle:
        "Chart-ready optical pulse-waveform preview from MAX30101-style signal context.",
      yLabel: "Raw optical count preview",
      sourceNote:
        "Shown as raw/prototype/simulated chart-ready PPG intensity data only.",
      points: downsampleObjectiveChartPoints(makeWave(96, 52000, 1200, 12)),
    },
    {
      kind: "motion_context",
      title: "Motion context",
      subtitle: "Chart-ready motion magnitude context for artifact review.",
      yLabel: "Motion context index",
      sourceNote:
        "Shown as technical motion/artifact context only, not behavioral or clinical interpretation.",
      points: downsampleObjectiveChartPoints(makeTrend(96, 0.12, 0.002, 0.08)),
    },
    {
      kind: "tmp117_temperature_trend",
      title: "Local temperature/contact trend",
      subtitle: "Chart-ready local skin/contact temperature context.",
      yLabel: "Local contact temperature context",
      sourceNote:
        "Shown as local temperature/contact context only, not core temperature, fever, or medical status.",
      points: downsampleObjectiveChartPoints(makeTrend(96, 32.4, 0.004, 0.05)),
    },
    {
      kind: "mpu_device_temperature",
      title: "Device temperature context",
      subtitle: "Chart-ready device-health temperature context.",
      yLabel: "Device temperature context",
      sourceNote:
        "Shown as device-health context only. This is not a physiological temperature signal.",
      points: downsampleObjectiveChartPoints(makeTrend(96, 30.2, 0.003, 0.04)),
    },
  ];
}
