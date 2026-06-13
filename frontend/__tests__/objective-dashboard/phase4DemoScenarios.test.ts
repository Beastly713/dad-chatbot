import fs from "fs";
import path from "path";
import {
  getPhase4DemoScenarioById,
  isPhase4DemoInterpretationLabel,
  PHASE4_ALLOWED_INTERPRETATION_LABELS,
  PHASE4_DEFAULT_DEMO_SCENARIO_ID,
  PHASE4_DEMO_SCENARIO_IDS,
  PHASE4_DEMO_SCENARIOS,
  PHASE4_DEMO_SOURCE,
  PHASE4_DEMO_VISIBILITY,
} from "../../app/(clinician)/clinician/objective/_lib/phase4DemoScenarios";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
  return path.join(FRONTEND_ROOT, "app", ...segments);
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function repoRelative(filePath: string): string {
  return path.relative(FRONTEND_ROOT, filePath).split(path.sep).join("/");
}

function expectNoText(content: string, forbidden: string, file: string): void {
  if (content.includes(forbidden)) {
    throw new Error(`${repoRelative(file)} unexpectedly contains ${forbidden}`);
  }
}

function expectNoMatch(content: string, pattern: RegExp, file: string): void {
  if (pattern.test(content)) {
    throw new Error(`${repoRelative(file)} unexpectedly matched ${pattern}`);
  }
}

describe("Phase 4 safe demo scenario fixtures", () => {
  const fixtureFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "phase4DemoScenarios.ts",
  );
  const pageFile = appPath("(clinician)", "clinician", "objective", "page.tsx");
  const shellFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleShell.tsx",
  );

  it("uses the repo-verified Phase 3 objective interpretation labels", () => {
    expect(PHASE4_ALLOWED_INTERPRETATION_LABELS).toEqual([
      "low_or_baseline_arousal_evidence",
      "elevated_physiological_arousal_evidence",
      "stress_like_autonomic_activation_evidence",
      "recovery_cooldown_trend",
      "movement_activity_like_confound",
      "signal_quality_limitation",
      "cross_signal_agreement",
      "cross_signal_disagreement",
      "insufficient_reliable_data",
      "ml_unavailable",
      "simulated_data_notice",
    ]);

    expect(isPhase4DemoInterpretationLabel("recovery_cooldown_trend")).toBe(
      true,
    );
    expect(isPhase4DemoInterpretationLabel("recovery_cooldown_evidence")).toBe(
      false,
    );
    expect(
      isPhase4DemoInterpretationLabel("recovery_or_cooldown_evidence"),
    ).toBe(false);
  });

  it("defines simulator-only source metadata and objective visibility defaults", () => {
    expect(PHASE4_DEMO_SOURCE).toEqual({
      sourceType: "simulator",
      banner: "Simulator demo",
      description:
        "Deterministic frontend demo data for clinician-only objective monitoring review.",
    });

    expect(PHASE4_DEMO_VISIBILITY).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });
  });

  it("defines unique safe scenario ids and retrievable scenario records", () => {
    expect(PHASE4_DEMO_SCENARIOS).toHaveLength(
      PHASE4_DEMO_SCENARIO_IDS.length,
    );
    expect(new Set(PHASE4_DEMO_SCENARIO_IDS).size).toBe(
      PHASE4_DEMO_SCENARIO_IDS.length,
    );

    for (const id of PHASE4_DEMO_SCENARIO_IDS) {
      const scenario = getPhase4DemoScenarioById(id);

      expect(scenario.id).toBe(id);
      expect(scenario.source.sourceType).toBe("simulator");
      expect(scenario.visibility).toEqual(PHASE4_DEMO_VISIBILITY);
      expect(
        isPhase4DemoInterpretationLabel(scenario.primaryInterpretationLabel),
      ).toBe(true);
      expect(scenario.reviewFocus.length).toBeGreaterThan(0);
    }

    expect(getPhase4DemoScenarioById(PHASE4_DEFAULT_DEMO_SCENARIO_ID).id).toBe(
      PHASE4_DEFAULT_DEMO_SCENARIO_ID,
    );
  });

  it("keeps clinician-visible scenario copy free of forbidden clinical claims", () => {
    const visibleScenarioCopy = PHASE4_DEMO_SCENARIOS.map((scenario) =>
      [
        scenario.id,
        scenario.title,
        scenario.eyebrow,
        scenario.description,
        ...scenario.reviewFocus,
      ].join("\n"),
    )
      .join("\n")
      .toLowerCase();

    for (const forbidden of [
      "risk score",
      "clinical alert",
      "emergency detected",
      "diagnose the patient",
      "aud severity",
      "sobriety status",
      "patient is safe",
      "patient is stable",
      "patient is lying",
      "craving detected",
      "relapse risk",
      "withdrawal risk",
      "intoxication detected",
      "treatment needed",
      "detox needed",
      "medication needed",
      "ciwa score",
      "stress proven",
    ]) {
      expect(visibleScenarioCopy).not.toContain(forbidden);
    }
  });

  it("does not expose raw sensor field names in fixture source", () => {
    const content = read(fixtureFile);

    for (const forbidden of [
      "ecg_raw",
      "gsr_raw",
      "max_red",
      "max_ir",
      "max_green",
      "accel_x",
      "accel_y",
      "accel_z",
      "gyro_x",
      "gyro_y",
      "gyro_z",
      "mpu_temp_c",
      "tmp117_temp_c",
      "raw_payload",
    ]) {
      expectNoText(content, forbidden, fixtureFile);
    }
  });

  it("does not introduce backend, live stream, Supabase, hardware, or package registry imports", () => {
    const content = read(fixtureFile);

    for (const pattern of [
      /\bfetch\s*\(/,
      /new\s+WebSocket/,
      /EventSource/,
      /text\/event-stream/,
      /server-sent/i,
      /\/api\/objective/,
      /supabase/i,
      /prototypeHardware/,
      /@dad-chatbot\/objective-safety/,
      /packages\/objective-safety/,
    ]) {
      expectNoMatch(content, pattern, fixtureFile);
    }
  });

  it("wires scenario fixtures only through the Phase 4 scenario selector", () => {
    const selectorFile = appPath(
      "(clinician)",
      "clinician",
      "objective",
      "_components",
      "ObjectivePhase4ScenarioSelector.tsx",
    );

    const pageContent = read(pageFile);
    const shellContent = read(shellFile);
    const selectorContent = read(selectorFile);

    expect(shellContent).toContain("ObjectivePhase4ScenarioSelector");
    expect(selectorContent).toContain("PHASE4_DEMO_SCENARIOS");

    for (const forbidden of [
      "PHASE4_DEMO_SCENARIOS",
      "PHASE4_DEMO_SCENARIO_IDS",
      "getPhase4DemoScenarioById",
      "phase4DemoScenarios",
    ]) {
      expectNoText(pageContent, forbidden, pageFile);
    }
  });
});
