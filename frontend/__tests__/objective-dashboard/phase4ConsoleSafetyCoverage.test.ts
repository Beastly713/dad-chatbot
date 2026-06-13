import fs from "fs";
import path from "path";

const FRONTEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

const PHASE4_SOURCE_FILES = [
  "app/(clinician)/clinician/objective/page.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectiveDashboardShell.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4ConsoleShell.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4ScenarioSelector.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4SessionStatusPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4SensorStackPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4SignalPreviewPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectiveRawSignalCharts.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectiveChartPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4PipelinePanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4QualityReadinessPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4FeatureWindowPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4InterpretationConfidencePanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectiveMlInterpretationCards.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4TimelinePanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4FinalSummaryPanel.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4SafetyBoundaryPanel.tsx",
  "app/(clinician)/clinician/objective/_lib/dashboardAccess.ts",
  "app/(clinician)/clinician/objective/_lib/phase4DemoScenarios.ts",
  "app/(clinician)/clinician/objective/_lib/chartReadySignals.ts",
  "app/(clinician)/clinician/objective/_lib/qualityFeatureCards.ts",
  "app/(clinician)/clinician/objective/_lib/mlInterpretationCards.ts",
  "app/(clinician)/clinician/objective/_lib/sessionTimelineNotes.ts",
] as const;

const APPROVED_LOCAL_STATE_FILES = new Set([
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4ScenarioSelector.tsx",
  "app/(clinician)/clinician/objective/_components/ObjectivePhase4SessionStatusPanel.tsx",
]);

function frontendPath(relativePath: string): string {
  return path.join(FRONTEND_ROOT, relativePath);
}

function repoPath(relativePath: string): string {
  return path.join(REPO_ROOT, relativePath);
}

function normalize(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function readFrontend(relativePath: string): string {
  return read(frontendPath(relativePath));
}

function expectNoText(
  content: string,
  forbidden: string,
  sourceLabel: string,
): void {
  if (content.includes(forbidden)) {
    throw new Error(`${sourceLabel} unexpectedly contains ${forbidden}`);
  }
}

function expectNoTextCaseInsensitive(
  content: string,
  forbidden: string,
  sourceLabel: string,
): void {
  expectNoText(content.toLowerCase(), forbidden.toLowerCase(), sourceLabel);
}

function expectNoMatch(
  content: string,
  pattern: RegExp,
  sourceLabel: string,
): void {
  if (pattern.test(content)) {
    throw new Error(`${sourceLabel} unexpectedly matched ${pattern}`);
  }
}

function readPhase4SourceSet(): string {
  return PHASE4_SOURCE_FILES.map((relativePath) =>
    readFrontend(relativePath),
  ).join("\n");
}

function collectTextFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".next",
          "dist",
          "build",
          "coverage",
          "__pycache__",
        ].includes(entry.name)
      ) {
        continue;
      }

      files.push(...collectTextFiles(absolutePath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

describe("Phase 4 console safety coverage", () => {
  const shellFile =
    "app/(clinician)/clinician/objective/_components/ObjectivePhase4ConsoleShell.tsx";

  it("keeps the expected Phase 4 console source set explicit and present", () => {
    for (const relativePath of PHASE4_SOURCE_FILES) {
      expect(fs.existsSync(frontendPath(relativePath))).toBe(true);
    }

    const shellContent = readFrontend(shellFile);

    for (const panel of [
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
      expect(shellContent).toContain(panel);
    }

    expectNoText(shellContent, "PHASE4_PLACEHOLDER_REGIONS", shellFile);
    expectNoText(shellContent, "ObjectiveConsoleRegion", shellFile);
    expectNoText(shellContent, "Placeholder for", shellFile);
  });

  it("keeps Phase 4 console source free of raw fields and unsafe executable labels", () => {
    const combined = readPhase4SourceSet();

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
      expectNoText(combined, forbidden, "Phase 4 source set");
    }

    for (const forbidden of [
      "craving_detected",
      "relapse_risk",
      "withdrawal_risk",
      "intoxication_detected",
      "AUD_severity",
      "emergency_detected",
      "treatment_need",
      "detox_need",
      "medication_need",
      "CIWA_score",
      "sobriety_status",
      "patient_truthfulness",
      "patient_is_lying",
      "patient_is_safe",
      "patient_is_stable",
      "stress_proven",
    ]) {
      expectNoText(combined, forbidden, "Phase 4 source set");
    }

    for (const forbidden of [
      "risk score",
      "clinical alert",
      "emergency detected",
      "aud severity",
      "sobriety status confirmed",
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
      expectNoTextCaseInsensitive(combined, forbidden, "Phase 4 source set");
    }
  });

  it("keeps the Phase 4 P0 console frontend-only, static, and persistence-free", () => {
    for (const relativePath of PHASE4_SOURCE_FILES) {
      const content = readFrontend(relativePath);

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
        /setInterval/,
        /setTimeout/,
        /Date\.now/,
        /performance\.now/,
        /localStorage/,
        /sessionStorage/,
        /indexedDB/,
      ]) {
        expectNoMatch(content, pattern, relativePath);
      }

      for (const forbidden of [
        "useEffect",
        "persistClinicianNote",
        "saveClinicianNote",
        "createClinicianNote",
        "updateClinicianNote",
        "deleteClinicianNote",
      ]) {
        expectNoText(content, forbidden, relativePath);
      }

      if (!APPROVED_LOCAL_STATE_FILES.has(relativePath)) {
        expectNoText(content, "useState", relativePath);
      }
    }
  });

  it("keeps Phase 4 objective UI modules out of patient, chatbot, dev, and backend-sensitive surfaces", () => {
    const sensitiveRoots = [
      path.join(FRONTEND_ROOT, "app", "api"),
      path.join(FRONTEND_ROOT, "app", "dev"),
      path.join(
        FRONTEND_ROOT,
        "app",
        "(clinician)",
        "clinician",
        "objective",
        "patients",
      ),
      path.join(
        FRONTEND_ROOT,
        "app",
        "(clinician)",
        "clinician",
        "objective",
        "chatbot",
      ),
      repoPath("backend/src/retrieval_graph"),
      repoPath("backend/src/safety"),
      repoPath("backend/src/subjective"),
    ];

    const frontendAppFilesOutsideClinicianObjective = collectTextFiles(
      path.join(FRONTEND_ROOT, "app"),
    ).filter((filePath) => {
      const normalizedPath = normalize(filePath);
      return !normalizedPath.includes(
        "app/(clinician)/clinician/objective/",
      );
    });

    const sensitiveFiles = [
      ...sensitiveRoots.flatMap(collectTextFiles),
      ...frontendAppFilesOutsideClinicianObjective,
    ];

    for (const filePath of sensitiveFiles) {
      const content = read(filePath);
      const sourceLabel = normalize(path.relative(REPO_ROOT, filePath));

      for (const forbiddenReference of [
        "ObjectivePhase4ConsoleShell",
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
        "phase4DemoScenarios",
        "PHASE4_DEMO_SCENARIOS",
      ]) {
        expectNoText(content, forbiddenReference, sourceLabel);
      }
    }
  });

  it("keeps Phase 4 console copy explicitly scoped to clinician review and chatbot isolation", () => {
    const combined = readPhase4SourceSet().toLowerCase();

    for (const required of [
      "clinician-only",
      "non-diagnostic",
      "source-bound",
      "simulator demo",
      "no chatbot update",
      "no backend connection",
      "no live hardware",
      "no note persistence",
      "not connected to chatbot responses",
      "not patient-facing",
      "patient and chatbot isolation",
      "safety boundaries",
    ]) {
      expect(combined).toContain(required);
    }
  });
});
