import {
  getNextPhase4DemoElapsedSeconds,
  getPhase4DemoPlaybackScenario,
  getPhase4DemoPlaybackSnapshot,
  getPhase4DemoProgressPercent,
  PHASE4_DEMO_PLAYBACK_SCENARIOS,
  PHASE4_DEMO_DURATION_SECONDS,
} from "../../app/(clinician)/clinician/objective/_lib/phase4DemoPlayback";
import { PHASE4_DEMO_SCENARIO_IDS } from "../../app/(clinician)/clinician/objective/_lib/phase4DemoScenarios";

describe("Phase 4 demo playback runtime", () => {
  it("defines playback data for every safe demo scenario", () => {
    expect(PHASE4_DEMO_PLAYBACK_SCENARIOS.map((scenario) => scenario.id)).toEqual(
      PHASE4_DEMO_SCENARIO_IDS,
    );

    for (const scenarioId of PHASE4_DEMO_SCENARIO_IDS) {
      const scenario = getPhase4DemoPlaybackScenario(scenarioId);

      expect(scenario.signalChannels).toHaveLength(5);
      expect(scenario.qualityMetrics.length).toBeGreaterThan(0);
      expect(scenario.featureMetrics.length).toBeGreaterThan(0);
      expect(scenario.interpretationMetrics.length).toBeGreaterThan(0);
      expect(scenario.summaryMetrics.length).toBeGreaterThan(0);
      expect(scenario.timelineEvents.length).toBeGreaterThan(0);
    }
  });

  it("computes deterministic progress and clamps elapsed time", () => {
    expect(getPhase4DemoProgressPercent(0)).toBe(0);
    expect(getPhase4DemoProgressPercent(PHASE4_DEMO_DURATION_SECONDS / 2)).toBe(
      50,
    );
    expect(getPhase4DemoProgressPercent(PHASE4_DEMO_DURATION_SECONDS + 10)).toBe(
      100,
    );
    expect(getNextPhase4DemoElapsedSeconds(70)).toBe(
      PHASE4_DEMO_DURATION_SECONDS,
    );
  });

  it("unlocks stages, timeline events, and final summary by progress", () => {
    const early = getPhase4DemoPlaybackSnapshot({
      scenarioId: "baseline_review_pattern",
      status: "running",
      elapsedSeconds: 12,
    });

    expect(early.progressPercent).toBe(17);
    expect(early.pipelineStages.some((stage) => stage.status === "active")).toBe(
      true,
    );
    expect(early.visibleTimelineEvents.map((event) => event.label)).toContain(
      "Ingestion boundary checked",
    );
    expect(early.summaryUnlocked).toBe(false);

    const complete = getPhase4DemoPlaybackSnapshot({
      scenarioId: "baseline_review_pattern",
      status: "complete",
      elapsedSeconds: PHASE4_DEMO_DURATION_SECONDS,
    });

    expect(complete.progressPercent).toBe(100);
    expect(complete.currentStage).toBe("Session summary");
    expect(complete.summaryUnlocked).toBe(true);
    expect(complete.visibleTimelineEvents).toHaveLength(
      complete.scenario.timelineEvents.length,
    );
  });
});
