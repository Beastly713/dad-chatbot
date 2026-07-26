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

describe("objective session timeline, summary, and notes dashboard files", () => {
  const routeRoot = appPath("(clinician)", "clinician", "objective");
  const timelineLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "sessionTimelineNotes.ts",
  );
  const timelineComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveSessionTimelineSummaryNotes.tsx",
  );
  const liveShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveLiveMonitoringShell.tsx",
  );

  it("adds timeline, summary, and notes files and wires them into the live shell", () => {
    expect(fs.existsSync(timelineLib)).toBe(true);
    expect(fs.existsSync(timelineComponent)).toBe(true);
    expect(read(liveShell)).toContain("ObjectiveSessionTimelineSummaryNotes");
  });

  it("contains all required dashboard sections", () => {
    const combined = `${read(timelineLib)}\n${read(timelineComponent)}`;

    for (const required of [
      "Interpretation timeline",
      "Quality timeline",
      "Safe session summary",
      "Clinician notes",
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
      "Automated objective records and clinician-authored notes are intentionally separated",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("keeps clinician notes separated from automated output and non-persistent", () => {
    const combined =
      `${read(timelineLib)}\n${read(timelineComponent)}`.toLowerCase();

    expect(combined).toContain("clinician-authored notes");
    expect(combined).toContain("automated objective records");
    expect(combined).toContain("do not rewrite");
    expect(combined).toContain("does not save notes");
    expect(combined).toContain("static clinician-only placeholder");

    for (const forbidden of [
      "onsubmit",
      "form action",
      "create note",
      "post note",
      "note api",
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it("does not expose raw schema field names or unsafe executable labels", () => {
    const files = [timelineLib, timelineComponent, liveShell];

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
        expectNoText(content, forbidden, file);
      }
    }
  });

  it("does not add forbidden clinical summary wording", () => {
    const files = [timelineLib, timelineComponent, liveShell];

    for (const file of files) {
      const content = read(file).toLowerCase();

      for (const forbidden of [
        "relapse risk summary",
        "withdrawal concern summary",
        "withdrawal risk summary",
        "intoxication summary",
        "craving summary",
        "clinical alert summary",
        "treatment-need score",
        "treatment need score",
        "risk score",
        "emergency alert",
        "clinical warning",
        "diagnose the patient",
        "clinical decision-maker",
      ]) {
        expectNoText(content, forbidden, file);
      }
    }
  });

  it("does not add frontend live-stream clients, API fetches, or backend coupling", () => {
    const files = collectFiles(routeRoot).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );

    for (const file of files) {
      const content = read(file);

      expectNoMatch(content, /new\s+WebSocket/, file);
      expectNoMatch(content, /EventSource/, file);
      expectNoMatch(content, /text\/event-stream/, file);
      expectNoMatch(content, /server-sent/i, file);
      expectNoMatch(content, /\/api\/objective\/sessions\/.*\/stream/, file);
      expectNoMatch(content, /\bfetch\s*\(/, file);
      expectNoMatch(content, /services\/objective-backend/, file);
      expectNoMatch(content, /services\/objective-ml/, file);
      expectNoMatch(content, /packages\/objective-interpretation/, file);
    }
  });

  it("does not import chatbot, LangGraph, safety, or subjective modules", () => {
    const files = collectFiles(routeRoot).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );

    for (const file of files) {
      const content = read(file);

      expectNoMatch(content, /app\/api\/chat/, file);
      expectNoMatch(content, /langgraph/i, file);
      expectNoMatch(content, /retrieval_graph/, file);
      expectNoMatch(content, /finalGuard/, file);
      expectNoMatch(content, /subjective/, file);
    }
  });

  it("still does not create patient or chatbot objective routes", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
    ]) {
      expect(fs.existsSync(forbiddenRoute)).toBe(false);
    }
  });
});
