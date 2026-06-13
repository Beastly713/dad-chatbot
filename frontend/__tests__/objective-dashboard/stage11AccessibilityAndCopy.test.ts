import fs from "fs";
import path from "path";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
  return path.join(FRONTEND_ROOT, "app", ...segments);
}

function repoRelative(filePath: string): string {
  return path.relative(FRONTEND_ROOT, filePath).split(path.sep).join("/");
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function collectFiles(directory: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function objectiveRouteRoot(): string {
  return appPath("(clinician)", "clinician", "objective");
}

function objectiveSourceFiles(): string[] {
  return collectFiles(objectiveRouteRoot()).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
}

function combinedObjectiveSource(): string {
  return objectiveSourceFiles()
    .map((file) => read(file))
    .join("\n");
}

function expectPathMissing(filePath: string): void {
  if (fs.existsSync(filePath)) {
    throw new Error(`Expected path to be absent: ${repoRelative(filePath)}`);
  }
}

function expectNotContaining(
  content: string,
  forbidden: string,
  filePath: string,
): void {
  if (content.includes(forbidden)) {
    throw new Error(
      `Unexpected text "${forbidden}" in ${repoRelative(filePath)}`,
    );
  }
}

function expectNotMatching(
  content: string,
  pattern: RegExp,
  filePath: string,
): void {
  if (pattern.test(content)) {
    throw new Error(
      `Unexpected pattern ${pattern.toString()} in ${repoRelative(filePath)}`,
    );
  }
}

describe("Stage 11 clinician objective dashboard accessibility and copy regressions", () => {
  it("contains source banner and non-diagnostic scope note copy", () => {
    const combined = combinedObjectiveSource();

    expect(combined).toContain("Simulated data");
    expect(combined).toContain("simulator-generated");
    expect(combined).toContain("Scope note");
    expect(combined).toContain("non-diagnostic");
    expect(combined).toContain("clinician-only");
    expect(combined).toContain("source-bound");
  });

  it("contains all Stage 11 dashboard sections", () => {
    const combined = combinedObjectiveSource();

    for (const required of [
      "Live session shell",
      "Chart-ready signal previews",
      "Physiological and device-context preview cards",
      "Quality and feature summary cards",
      "Evidence, confidence, and uncertainty cards",
      "Interpretation timeline",
      "Quality timeline",
      "Safe session summary",
      "Clinician notes",
      "Timeline and separated clinician notes",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("contains the required safe summary names and note separation copy", () => {
    const combined = combinedObjectiveSource();

    for (const required of [
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
      "Automated objective records and clinician-authored notes are intentionally separated",
      "Notes do not rewrite model, feature, quality, or interpretation records",
      "does not save notes",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not contain risk-score, emergency-alert, or forbidden clinical dashboard copy", () => {
    const files = objectiveSourceFiles();

    for (const file of files) {
      const content = read(file).toLowerCase();

      for (const forbidden of [
        "risk score",
        "emergency alert",
        "clinical alert",
        "clinical warning",
        "medical warning",
        "danger sign",
        "danger level",
        "diagnose the patient",
        "clinical decision-maker",
        "relapse risk summary",
        "withdrawal concern summary",
        "withdrawal risk summary",
        "intoxication summary",
        "craving summary",
        "treatment-need score",
        "treatment need score",
        "sobriety status",
        "patient is safe",
        "patient is stable",
        "patient is lying",
      ]) {
        expectNotContaining(content, forbidden, file);
      }
    }
  });

  it("does not expose raw schema field names or forbidden executable labels in dashboard source", () => {
    const files = objectiveSourceFiles();

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
        expectNotContaining(content, forbidden, file);
      }
    }
  });

  it("keeps basic screen-reader section labeling in the dashboard shell", () => {
    const requiredFiles = [
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveAccessDenied.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveRawSignalCharts.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveLiveMonitoringShell.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveQualityFeatureCards.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveMlInterpretationCards.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveSessionTimelineSummaryNotes.tsx",
      ),
    ];

    for (const file of requiredFiles) {
      const content = read(file);

      if (!/aria-labelledby=|aria-label=/.test(content)) {
        throw new Error(
          `${repoRelative(file)} should include an accessible label relationship`,
        );
      }
    }
  });

  it("keeps chart SVG previews screen-reader labeled", () => {
    const chartPanel = appPath(
      "(clinician)",
      "clinician",
      "objective",
      "_components",
      "ObjectiveChartPanel.tsx",
    );

    const content = read(chartPanel);

    expect(content).toContain("role=\"img\"");
    expect(content).toContain("aria-label=");
  });

  it("keeps keyboard basics by avoiding click-only interactive controls in static dashboard files", () => {
    const phase4ScenarioSelector = appPath(
      "(clinician)",
      "clinician",
      "objective",
      "_components",
      "ObjectivePhase4ScenarioSelector.tsx",
    );
    const phase4SessionStatusPanel = appPath(
      "(clinician)",
      "clinician",
      "objective",
      "_components",
      "ObjectivePhase4SessionStatusPanel.tsx",
    );
    const phase4DemoCockpit = appPath(
      "(clinician)",
      "clinician",
      "objective",
      "_components",
      "ObjectivePhase4DemoCockpit.tsx",
    );
    const interactivePhase4Files = new Set([
      phase4ScenarioSelector,
      phase4SessionStatusPanel,
      phase4DemoCockpit,
    ]);
    const files = objectiveSourceFiles().filter(
      (file) => !interactivePhase4Files.has(file),
    );

    for (const file of files) {
      const content = read(file);

      expectNotMatching(content, /onClick=/, file);
      expectNotMatching(content, /onKeyDown=/, file);
      expectNotMatching(content, /tabIndex=/, file);
      expectNotMatching(content, /<button/, file);
      expectNotMatching(content, /<input/, file);
      expectNotMatching(content, /<textarea/, file);
      expectNotMatching(content, /<form/, file);
    }
  });

  it("does not add patient or chatbot objective routes during Stage 11 closeout", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
    ]) {
      expectPathMissing(forbiddenRoute);
    }
  });
});
