import fs from "fs";
import path from "path";

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

describe("Phase 4 objective console shell", () => {
  const objectiveRouteRoot = appPath("(clinician)", "clinician", "objective");
  const page = appPath("(clinician)", "clinician", "objective", "page.tsx");
  const consoleShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleShell.tsx",
  );
  const scenarioSelector = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ScenarioSelector.tsx",
  );

  it("adds the Phase 4 console shell to the existing clinician objective route", () => {
    expect(fs.existsSync(page)).toBe(true);
    expect(fs.existsSync(consoleShell)).toBe(true);

    const pageContent = read(page);

    expect(pageContent).toContain("ObjectivePhase4ConsoleShell");
    expect(pageContent).toContain("Objective Monitoring Console");
    expect(pageContent).not.toContain("ObjectiveRoutePlaceholder");
    expect(pageContent).not.toContain("Dashboard route skeleton");
  });

  it("renders required shell-only module regions and safety framing", () => {
    const combined = `${read(page)}\n${read(consoleShell)}\n${read(scenarioSelector)}`;

    for (const required of [
      "Objective Monitoring Console",
      "Clinician-only",
      "Simulator demo",
      "Non-diagnostic",
      "Source-bound physiological evidence",
      "Clinician-reviewable evidence",
      "Uncertainty-bearing",
      "Quality/readiness context",
      "Not connected to chatbot responses",
      "Scenario setup",
      "Session status",
      "Signal previews",
      "Processing pipeline",
      "Quality/readiness",
      "Interpretation context",
      "Timeline",
      "Final summary",
      "Safety boundaries",
      "clinician_visible=true",
      "patient_visible=false",
      "chatbot_visible=false",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not introduce future Phase 4 module logic yet", () => {
    const files = [page, consoleShell];

    for (const file of files) {
      const content = read(file);

      for (const forbidden of [
        "useState",
        "useEffect",
        "ObjectiveRawSignalCharts",
        "ObjectiveQualityFeatureCards",
        "ObjectiveMlInterpretationCards",
        "ObjectiveSessionTimelineSummaryNotes",
        "DevObjectiveSimulatorPanel",
        "createObjectiveDemoChartSeries",
        "createObjectiveDemoQualityFeatureSummary",
        "createObjectiveDemoMlInterpretationSummary",
        "createObjectiveDemoSessionTimelineNotesSummary",
      ]) {
        expectNoText(content, forbidden, file);
      }
    }
  });

  it("does not introduce backend, live stream, Supabase, or hardware dependencies", () => {
    const files = [page, consoleShell];

    for (const file of files) {
      const content = read(file);

      for (const pattern of [
        /\bfetch\s*\(/,
        /new\s+WebSocket/,
        /EventSource/,
        /text\/event-stream/,
        /server-sent/i,
        /\/api\/objective/,
        /supabase/i,
        /prototypeHardware/,
      ]) {
        expectNoMatch(content, pattern, file);
      }
    }
  });

  it("keeps Phase 4 shell copy free of forbidden clinical wording", () => {
    const files = [page, consoleShell];

    for (const file of files) {
      const content = read(file).toLowerCase();

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
        expectNoText(content, forbidden, file);
      }
    }
  });

  it("does not expose raw sensor field names in the Phase 4 shell", () => {
    const files = [page, consoleShell];

    for (const file of files) {
      const content = read(file);

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
        expectNoText(content, forbidden, file);
      }
    }
  });

  it("does not add patient or chatbot objective routes", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
      path.join(objectiveRouteRoot, "chatbot"),
      path.join(objectiveRouteRoot, "patient"),
    ]) {
      expect(fs.existsSync(forbiddenRoute)).toBe(false);
    }
  });
});
