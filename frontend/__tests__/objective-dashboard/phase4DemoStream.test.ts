import {
  formatPhase4DemoTime,
  getPhase4CurrentStreamState,
  getPhase4DisplayStreamFrames,
  getPhase4StreamScenario,
  PHASE4_DEMO_DURATION_SECONDS,
  PHASE4_STREAM_SCENARIOS,
  PHASE4_VISIBLE_WINDOW_SECONDS,
} from "../../app/(clinician)/clinician/objective/_lib/phase4DemoStream";
import { PHASE4_DEMO_SCENARIO_IDS } from "../../app/(clinician)/clinician/objective/_lib/phase4DemoScenarios";

describe("Phase 4 demo display stream", () => {
  it("generates deterministic display frames for every safe scenario", () => {
    expect(PHASE4_STREAM_SCENARIOS.map((scenario) => scenario.id)).toEqual(
      PHASE4_DEMO_SCENARIO_IDS,
    );

    for (const scenarioId of PHASE4_DEMO_SCENARIO_IDS) {
      const scenario = getPhase4StreamScenario(scenarioId);
      const frames = getPhase4DisplayStreamFrames(scenarioId);

      expect(scenario.interpretationLabel).toBeTruthy();
      expect(frames).toHaveLength(PHASE4_DEMO_DURATION_SECONDS + 1);
      expect(frames[0].timeSeconds).toBe(0);
      expect(frames[frames.length - 1].timeSeconds).toBe(
        PHASE4_DEMO_DURATION_SECONDS,
      );
      expect(frames[0]).toHaveProperty("ecgDisplayAmplitude");
      expect(frames[0]).toHaveProperty("conductanceTrend");
      expect(frames[0]).toHaveProperty("pulseWaveform");
      expect(frames[0]).toHaveProperty("movementMagnitude");
      expect(frames[0]).toHaveProperty("temperatureContactDelta");
    }
  });

  it("returns current frame, moving visible window, recent frames, and feature summaries", () => {
    const state = getPhase4CurrentStreamState({
      scenarioId: "elevated_arousal_evidence",
      elapsedSeconds: 90,
    });

    expect(state.currentFrame.timeSeconds).toBe(90);
    expect(state.visibleFrames.length).toBe(PHASE4_VISIBLE_WINDOW_SECONDS);
    expect(state.recentFrames.length).toBeLessThanOrEqual(10);
    expect(state.featureSummaries.map((summary) => summary.label)).toEqual([
      "Heart-activity display trend",
      "Conductance slope",
      "Pulse waveform stability",
      "Movement magnitude window",
      "Temperature/contact delta",
      "Signal quality coverage",
    ]);
  });

  it("formats demo time for cockpit displays", () => {
    expect(formatPhase4DemoTime(0)).toBe("00:00");
    expect(formatPhase4DemoTime(42)).toBe("00:42");
    expect(formatPhase4DemoTime(180)).toBe("03:00");
  });
});
