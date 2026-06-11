import {
  getObjectiveConnectionStatusCopy,
  getObjectiveLiveStatusCopy,
  getObjectiveSessionStatusLabel,
  getObjectiveSourceBannerCopy,
  OBJECTIVE_LIVE_NO_DATA_DETAIL,
  OBJECTIVE_LIVE_SCOPE_NOTE,
} from "../../app/(clinician)/clinician/objective/_lib/liveMonitoringCopy";

function expectSafeCopy(copy: string): void {
  const lower = copy.toLowerCase();

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

describe("objective live monitoring shell copy", () => {
  it("clearly marks simulated source data", () => {
    const copy = getObjectiveSourceBannerCopy("simulator");

    expect(copy.label).toBe("Simulated data");
    expect(copy.description.toLowerCase()).toContain("simulator-generated");
    expect(copy.description.toLowerCase()).toContain("engineering review");

    expectSafeCopy(copy.label);
    expectSafeCopy(copy.description);
  });

  it("provides bounded connection status copy", () => {
    for (const status of [
      "not_connected",
      "connecting",
      "connected",
      "reconnecting",
      "closed",
    ] as const) {
      const copy = getObjectiveConnectionStatusCopy(status);

      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
      expectSafeCopy(copy.label);
      expectSafeCopy(copy.description);
    }
  });

  it("provides live, degraded, and no-data states without unsafe wording", () => {
    for (const status of ["live", "degraded", "no_data"] as const) {
      const copy = getObjectiveLiveStatusCopy(status);

      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
      expectSafeCopy(copy.label);
      expectSafeCopy(copy.description);
    }

    expect(getObjectiveLiveStatusCopy("degraded").label).toBe("Degraded");
    expect(getObjectiveLiveStatusCopy("no_data").label).toBe("No data yet");
  });

  it("has safe session status labels", () => {
    expect(getObjectiveSessionStatusLabel("created")).toBe("Created");
    expect(getObjectiveSessionStatusLabel("active")).toBe("Active");
    expect(getObjectiveSessionStatusLabel("paused")).toBe("Paused");
    expect(getObjectiveSessionStatusLabel("stopped")).toBe("Stopped");
    expect(getObjectiveSessionStatusLabel("unknown")).toBe("Unknown");
  });

  it("keeps scope and no-data copy non-diagnostic", () => {
    expect(OBJECTIVE_LIVE_SCOPE_NOTE).toContain("clinician-only");
    expect(OBJECTIVE_LIVE_SCOPE_NOTE).toContain("non-diagnostic");
    expect(OBJECTIVE_LIVE_NO_DATA_DETAIL).toContain("later commits");

    expectSafeCopy(OBJECTIVE_LIVE_SCOPE_NOTE);
    expectSafeCopy(OBJECTIVE_LIVE_NO_DATA_DETAIL);
  });
});
