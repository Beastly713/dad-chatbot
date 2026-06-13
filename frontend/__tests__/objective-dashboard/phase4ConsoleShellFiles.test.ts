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
  const consoleOverviewRail = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleOverviewRail.tsx",
  );
  const scenarioSelector = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ScenarioSelector.tsx",
  );
  const sessionStatusPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SessionStatusPanel.tsx",
  );
  const sensorStackPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SensorStackPanel.tsx",
  );
  const signalPreviewPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SignalPreviewPanel.tsx",
  );
  const pipelinePanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4PipelinePanel.tsx",
  );
  const featureWindowPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4FeatureWindowPanel.tsx",
  );
  const finalSummaryPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4FinalSummaryPanel.tsx",
  );
  const safetyBoundaryPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SafetyBoundaryPanel.tsx",
  );
  const interpretationConfidencePanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4InterpretationConfidencePanel.tsx",
  );
  const timelinePanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4TimelinePanel.tsx",
  );
  const qualityFeatureLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "qualityFeatureCards.ts",
  );
  const mlInterpretationLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "mlInterpretationCards.ts",
  );
  const mlInterpretationComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveMlInterpretationCards.tsx",
  );
  const sessionTimelineLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "sessionTimelineNotes.ts",
  );
  const qualityReadinessPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4QualityReadinessPanel.tsx",
  );

  it("adds the Phase 4 console shell to the existing clinician objective route", () => {
    expect(fs.existsSync(page)).toBe(true);
    expect(fs.existsSync(consoleShell)).toBe(true);
    expect(fs.existsSync(consoleOverviewRail)).toBe(true);
    expect(fs.existsSync(sessionStatusPanel)).toBe(true);
    expect(fs.existsSync(sensorStackPanel)).toBe(true);
    expect(fs.existsSync(signalPreviewPanel)).toBe(true);
    expect(fs.existsSync(pipelinePanel)).toBe(true);
    expect(fs.existsSync(qualityReadinessPanel)).toBe(true);
    expect(fs.existsSync(featureWindowPanel)).toBe(true);
    expect(fs.existsSync(interpretationConfidencePanel)).toBe(true);
    expect(fs.existsSync(timelinePanel)).toBe(true);
    expect(fs.existsSync(finalSummaryPanel)).toBe(true);
    expect(fs.existsSync(safetyBoundaryPanel)).toBe(true);

    const pageContent = read(page);

    expect(pageContent).toContain("ObjectivePhase4ConsoleShell");
    expect(pageContent).toContain("Objective Monitoring Console");
    expect(pageContent).not.toContain("ObjectiveRoutePlaceholder");
    expect(pageContent).not.toContain("Dashboard route skeleton");
  });

  it("renders required shell-only module regions and safety framing", () => {
    const combined = `${read(page)}\n${read(consoleShell)}\n${read(consoleOverviewRail)}\n${read(scenarioSelector)}\n${read(sessionStatusPanel)}\n${read(sensorStackPanel)}\n${read(signalPreviewPanel)}\n${read(pipelinePanel)}\n${read(qualityReadinessPanel)}\n${read(featureWindowPanel)}\n${read(interpretationConfidencePanel)}\n${read(timelinePanel)}\n${read(finalSummaryPanel)}\n${read(safetyBoundaryPanel)}\n${read(qualityFeatureLib)}\n${read(mlInterpretationLib)}\n${read(mlInterpretationComponent)}\n${read(sessionTimelineLib)}`;

    for (const required of [
      "Objective Monitoring Console",
      "Console overview",
      "Phase 4 P0 console overview",
      "P0 mentor demo",
      "Clinician-only",
      "Simulator demo",
      "Non-diagnostic",
      "Source-bound physiological evidence",
      "Clinician-reviewable evidence",
      "Uncertainty-bearing",
      "Not connected to chatbot responses",
      "Scenario setup",
      "Session status",
      "Sensor/device stack",
      "ECG preview",
      "GSR trend",
      "PPG preview",
      "Motion context",
      "Local temperature/contact trend",
      "Device temperature context",
      "Signal previews",
      "Chart-ready signal previews",
      "Static processing map",
      "Processing pipeline",
      "Demo source",
      "Ingestion boundary",
      "Timing alignment",
      "Segment preparation",
      "Feature-window preparation",
      "Baseline-relative context",
      "Bounded model context",
      "Safe interpretation boundary",
      "Clinician review surface",
      "Session summary",
      "Technical quality/readiness",
      "Quality/readiness",
      "ECG quality",
      "GSR quality",
      "PPG quality",
      "Motion/activity context",
      "Temperature/contact context",
      "Timing quality",
      "Baseline state",
      "Missingness",
      "Technical limitations",
      "Supporting context",
      "Feature-window summary",
      "Source-bound feature context",
      "Heart-activity trend",
      "Skin-conductance trend",
      "Pulse-waveform context",
      "Motion confound context",
      "Feature context",
      "Confidence and uncertainty context",
      "Interpretation context",
      "Allowed ML target",
      "Safe interpretation label",
      "Evidence level",
      "Confidence",
      "Model score",
      "Suppression state",
      "Uncertainty reasons",
      "Contributing modalities",
      "Excluded modalities",
      "Clinician-safe event timeline",
      "Timeline",
      "Static demo timeline",
      "Interpretation timeline",
      "Quality timeline",
      "Baseline review window",
      "Elevated arousal evidence period",
      "Motion-confounded window",
      "Cooldown period",
      "Safe session summary",
      "Final summary",
      "Static demo summary",
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
      "Automated summary scope",
      "No note persistence",
      "Safety boundaries",
      "Safety and visibility scope",
      "Clinician-only surface",
      "Patient and chatbot isolation",
      "Non-diagnostic review",
      "Source-bound evidence",
      "No automated escalation",
      "Demo and persistence boundary",
      "Phase 4 P0 boundary reminder",
      "No live hardware",
      "clinician_visible=true",
      "patient_visible=false",
      "chatbot_visible=false",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not leave Phase 4 placeholder regions in the console shell", () => {
    const shellContent = read(consoleShell);

    expectNoText(shellContent, "PHASE4_PLACEHOLDER_REGIONS", consoleShell);
    expectNoText(shellContent, "ObjectiveConsoleRegion", consoleShell);
    expectNoText(shellContent, "Placeholder for", consoleShell);
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
