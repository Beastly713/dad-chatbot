import {
  createObjectiveDemoChartSeries,
  downsampleObjectiveChartPoints,
  OBJECTIVE_CHART_MAX_POINTS,
} from "../../app/(clinician)/clinician/objective/_lib/chartReadySignals";

function expectSafeCopy(value: string): void {
  const lower = value.toLowerCase();

  for (const forbidden of [
    "risk score",
    "emergency",
    "alert",
    "diagnosis",
    "diagnose",
    "relapse risk",
    "withdrawal risk",
    "intoxication",
    "craving detected",
    "ciwa",
    "sobriety",
    "patient is safe",
    "patient is stable",
    "patient is lying",
    "treatment need",
    "detox need",
    "medication need",
  ]) {
    expect(lower).not.toContain(forbidden);
  }
}

describe("objective chart-ready signal helpers", () => {
  it("downsamples chart data to a bounded chart-ready size", () => {
    const points = Array.from({ length: 500 }, (_, index) => ({
      tMs: 500 - index,
      value: index,
    }));

    const downsampled = downsampleObjectiveChartPoints(points, 25);

    expect(downsampled).toHaveLength(25);
    expect(downsampled[0].tMs).toBeLessThanOrEqual(
      downsampled[downsampled.length - 1].tMs,
    );
  });

  it("removes invalid chart points during downsampling", () => {
    const downsampled = downsampleObjectiveChartPoints([
      { tMs: 0, value: 1 },
      { tMs: Number.NaN, value: 2 },
      { tMs: 2, value: Number.POSITIVE_INFINITY },
      { tMs: 3, value: 4 },
    ]);

    expect(downsampled).toEqual([
      { tMs: 0, value: 1 },
      { tMs: 3, value: 4 },
    ]);
  });

  it("creates all required raw chart-ready dashboard series", () => {
    const series = createObjectiveDemoChartSeries();

    expect(series.map((item) => item.kind)).toEqual([
      "ecg_preview",
      "gsr_trend",
      "ppg_preview",
      "motion_context",
      "tmp117_temperature_trend",
      "mpu_device_temperature",
    ]);

    for (const item of series) {
      expect(item.points.length).toBeGreaterThan(0);
      expect(item.points.length).toBeLessThanOrEqual(
        OBJECTIVE_CHART_MAX_POINTS,
      );
      expect(item.sourceNote.toLowerCase()).toMatch(
        /chart-ready|raw|prototype|simulated|device-health|technical|local/,
      );

      expectSafeCopy(item.title);
      expectSafeCopy(item.subtitle);
      expectSafeCopy(item.yLabel);
      expectSafeCopy(item.sourceNote);
    }
  });

  it("does not create oxygen-saturation wording for PPG preview", () => {
    const ppg = createObjectiveDemoChartSeries().find(
      (item) => item.kind === "ppg_preview",
    );

    expect(ppg).toBeDefined();
    const combined =
      `${ppg?.title} ${ppg?.subtitle} ${ppg?.yLabel} ${ppg?.sourceNote}`.toLowerCase();

    expect(combined).not.toContain("spo2");
    expect(combined).not.toContain("spo₂");
    expect(combined).not.toContain("oxygen saturation");
    expect(combined).toContain("ppg intensity");
  });

  it("labels MPU temperature as device-health only", () => {
    const mpu = createObjectiveDemoChartSeries().find(
      (item) => item.kind === "mpu_device_temperature",
    );

    expect(mpu).toBeDefined();
    const combined =
      `${mpu?.title} ${mpu?.subtitle} ${mpu?.sourceNote}`.toLowerCase();

    expect(combined).toContain("device-health");
    expect(combined).toContain("not a physiological temperature signal");
  });

  it("labels TMP117 as local temperature context, not core temperature", () => {
    const tmp117 = createObjectiveDemoChartSeries().find(
      (item) => item.kind === "tmp117_temperature_trend",
    );

    expect(tmp117).toBeDefined();
    const combined =
      `${tmp117?.title} ${tmp117?.subtitle} ${tmp117?.sourceNote}`.toLowerCase();

    expect(combined).toContain("local");
    expect(combined).not.toContain("core temperature");
  });
});
