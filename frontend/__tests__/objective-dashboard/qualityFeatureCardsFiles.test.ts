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

describe("objective quality and feature summary dashboard files", () => {
  const routeRoot = appPath("(clinician)", "clinician", "objective");
  const qualityLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "qualityFeatureCards.ts",
  );
  const qualityComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveQualityFeatureCards.tsx",
  );
  const liveShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveLiveMonitoringShell.tsx",
  );

  it("adds quality and feature summary files and wires them into the live shell", () => {
    expect(fs.existsSync(qualityLib)).toBe(true);
    expect(fs.existsSync(qualityComponent)).toBe(true);

    expect(read(liveShell)).toContain("ObjectiveQualityFeatureCards");
  });

  it("contains all required card labels", () => {
    const combined = `${read(qualityLib)}\n${read(qualityComponent)}`;

    for (const required of [
      "ECG quality",
      "GSR quality",
      "PPG quality",
      "Motion/activity context",
      "Temperature/contact context",
      "Timing quality",
      "Baseline state",
      "Missingness",
      "Quality and feature summary cards",
      "Technical limitations",
      "Feature summary",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("shows quality issues as technical limitations only", () => {
    const combined =
      `${read(qualityLib)}\n${read(qualityComponent)}`.toLowerCase();

    expect(combined).toContain("technical limitations");
    expect(combined).toContain("signal usability");
    expect(combined).toContain("baseline readiness");
    expect(combined).toContain("missingness");

    for (const forbidden of [
      "clinical warning",
      "medical warning",
      "danger sign",
      "danger level",
      "risk score",
      "emergency",
      "alert",
    ]) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it("does not expose raw schema field names in dashboard quality cards", () => {
    const files = [qualityLib, qualityComponent, liveShell];

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

  it("keeps dashboard card copy free of unsafe clinical and route language", () => {
    const files = [qualityLib, qualityComponent, liveShell];

    for (const file of files) {
      const content = read(file).toLowerCase();

      for (const forbidden of [
        "risk score",
        "emergency",
        "alert",
        "diagnose the patient",
        "clinical decision-maker",
        "sobriety status",
        "patient is safe",
        "patient is stable",
        "patient is lying",
        "craving detected",
        "relapse risk",
        "withdrawal risk",
        "intoxication",
        "treatment need",
        "detox need",
        "medication need",
        "ciwa",
      ]) {
        expectNoText(content, forbidden, file);
      }
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
