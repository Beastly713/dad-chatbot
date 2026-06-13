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
  const demoCockpit = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4DemoCockpit.tsx",
  );
  const playbackRuntime = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "phase4DemoPlayback.ts",
  );

  it("wires the existing clinician objective route to the interactive cockpit", () => {
    expect(fs.existsSync(page)).toBe(true);
    expect(fs.existsSync(consoleShell)).toBe(true);
    expect(fs.existsSync(demoCockpit)).toBe(true);
    expect(fs.existsSync(playbackRuntime)).toBe(true);

    const pageContent = read(page);
    const shellContent = read(consoleShell);

    expect(pageContent).toContain("ObjectivePhase4ConsoleShell");
    expect(pageContent).toContain("Objective Monitoring Console");
    expect(shellContent).toContain("ObjectivePhase4DemoCockpit");
    expect(pageContent).not.toContain("ObjectiveRoutePlaceholder");
    expect(pageContent).not.toContain("Dashboard route skeleton");
  });

  it("renders required cockpit regions and safety framing", () => {
    const combined = `${read(page)}\n${read(consoleShell)}\n${read(demoCockpit)}\n${read(playbackRuntime)}`;

    for (const required of [
      "Objective Monitoring Console",
      "Clinician-only simulator demo for source-bound physiological",
      "Clinician-only",
      "Simulator demo",
      "Non-diagnostic",
      "Frontend-only",
      "No chatbot update",
      "Demo patient",
      "Mode",
      "Phase 4 P0",
      "Runtime",
      "Local demo playback",
      "Scenario setup",
      "Playback controls",
      "Live-looking signal previews",
      "Session status",
      "Processing pipeline",
      "Quality/readiness",
      "Feature-window context",
      "Interpretation context",
      "Timeline",
      "Final summary",
      "Safety boundaries",
      "ECG-like preview",
      "GSR trend",
      "PPG-like preview",
      "Motion/activity context",
      "Temperature/contact context",
      "Demo source",
      "Ingestion boundary",
      "Timing alignment",
      "Segment preparation",
      "Feature-window preparation",
      "Baseline-relative context",
      "Bounded interpretation",
      "Clinician review",
      "Session summary",
      "Heart-activity trend",
      "Skin-conductance trend",
      "Pulse-waveform context",
      "Motion confound context",
      "Safe interpretation label",
      "Evidence level",
      "Confidence",
      "Uncertainty",
      "Interpretable windows",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Source-bound physiological evidence",
      "No patient-facing output",
      "No backend connection",
      "No live hardware",
      "No note persistence",
      "clinician_visible=true",
      "patient_visible=false",
      "chatbot_visible=false",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not leave Phase 4 placeholder regions in the cockpit shell", () => {
    const combined = `${read(consoleShell)}\n${read(demoCockpit)}`;

    expectNoText(combined, "PHASE4_PLACEHOLDER_REGIONS", consoleShell);
    expectNoText(combined, "ObjectiveConsoleRegion", consoleShell);
    expectNoText(combined.toLowerCase(), "placeholder for", consoleShell);
  });

  it("does not reintroduce the old long vertical panel stack into the main shell", () => {
    const shellContent = read(consoleShell);

    for (const oldPanel of [
      "ObjectivePhase4ConsoleOverviewRail",
      "ObjectivePhase4ScenarioSelector",
      "ObjectivePhase4SessionStatusPanel",
      "ObjectivePhase4SensorStackPanel",
      "ObjectivePhase4SignalPreviewPanel",
      "ObjectivePhase4PipelinePanel",
      "ObjectivePhase4QualityReadinessPanel",
      "ObjectivePhase4FeatureWindowPanel",
      "ObjectivePhase4InterpretationConfidencePanel",
      "ObjectivePhase4TimelinePanel",
      "ObjectivePhase4FinalSummaryPanel",
      "ObjectivePhase4SafetyBoundaryPanel",
    ]) {
      expectNoText(shellContent, oldPanel, consoleShell);
    }
  });

  it("does not introduce backend, live stream, Supabase, hardware, or persistence dependencies", () => {
    const files = [page, consoleShell, demoCockpit, playbackRuntime];

    for (const file of files) {
      const content = read(file);

      for (const pattern of [
        /\bfetch\s*\(/,
        /new\s+WebSocket/,
        /EventSource/,
        /text\/event-stream/,
        /server-sent/i,
        /\/api\/objective/,
        /createClient/,
        /supabase/i,
        /prototypeHardware/,
        /localStorage/,
        /sessionStorage/,
        /indexedDB/,
      ]) {
        expectNoMatch(content, pattern, file);
      }
    }
  });

  it("keeps Phase 4 cockpit copy free of forbidden clinical wording", () => {
    const files = [page, consoleShell, demoCockpit, playbackRuntime];

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

  it("does not expose raw sensor field names in the Phase 4 cockpit", () => {
    const files = [page, consoleShell, demoCockpit, playbackRuntime];

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
