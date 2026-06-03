import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_SIMULATOR_SCENARIO_IDS,
  OBJECTIVE_SIMULATOR_SCENARIO_PROFILES,
  OBJECTIVE_SIMULATOR_SOURCE_TYPE,
  getObjectiveSimulatorScenarioProfile
} from "../src/index.js";

describe("objective simulator scenario profiles", () => {
  it("defines the initial Stage 6 simulator scenarios", () => {
    expect(OBJECTIVE_SIMULATOR_SCENARIO_IDS).toEqual([
      "baseline_rest",
      "elevated_arousal_pattern",
      "recovery_cooldown",
      "motion_artifact",
      "poor_contact",
      "sensor_dropout",
      "signal_conflict",
      "device_reset_or_timing_gap"
    ]);
  });

  it("keeps every scenario source as simulator and clinician-only", () => {
    for (const scenarioId of OBJECTIVE_SIMULATOR_SCENARIO_IDS) {
      const profile = getObjectiveSimulatorScenarioProfile(scenarioId);

      expect(profile.source_type).toBe(OBJECTIVE_SIMULATOR_SOURCE_TYPE);
      expect(profile.source_metadata.source_type).toBe(
        OBJECTIVE_SIMULATOR_SOURCE_TYPE
      );
      expect(profile.visibility).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
        developer_labels_visible: false
      });
      expect(profile.source_metadata.engineering_only).toBe(true);
      expect(profile.source_metadata.clinical_validation_claim).toBe(false);
    }
  });

  it("keeps baseline parameters non-clinical and finite", () => {
    for (const profile of Object.values(OBJECTIVE_SIMULATOR_SCENARIO_PROFILES)) {
      for (const value of Object.values(profile.baseline_parameters)) {
        expect(Number.isFinite(value)).toBe(true);
      }

      expect(profile.baseline_parameters.ecg_cycle_ms).toBeGreaterThan(0);
      expect(profile.baseline_parameters.gsr_tonic_raw).toBeGreaterThan(0);
      expect(profile.baseline_parameters.ppg_ir_baseline_raw).toBeGreaterThan(0);
      expect(profile.baseline_parameters.local_skin_temp_c).toBeGreaterThan(0);
      expect(profile.baseline_parameters.motion_baseline_mps2).toBeGreaterThan(0);
    }
  });

  it("does not use forbidden objective terms in scenario profile payloads", () => {
    const serializedProfiles = JSON.stringify(
      OBJECTIVE_SIMULATOR_SCENARIO_PROFILES
    );

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serializedProfiles).not.toContain(forbidden);
    }

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/scenarios.ts",
        surface: "source",
        content: serializedProfiles
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects unsupported scenario ids", () => {
    expect(() => getObjectiveSimulatorScenarioProfile("unknown_scenario")).toThrow(
      "Unsupported objective simulator scenario id"
    );
  });
});
