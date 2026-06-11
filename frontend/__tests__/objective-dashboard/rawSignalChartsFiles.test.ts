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

describe("objective raw chart-ready signal panel files", () => {
  const routeRoot = appPath("(clinician)", "clinician", "objective");
  const chartReadySignals = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "chartReadySignals.ts",
  );
  const chartPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveChartPanel.tsx",
  );
  const rawSignalCharts = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveRawSignalCharts.tsx",
  );
  const liveShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveLiveMonitoringShell.tsx",
  );

  it("adds the required chart-ready signal panel files", () => {
    for (const file of [chartReadySignals, chartPanel, rawSignalCharts]) {
      expect(fs.existsSync(file)).toBe(true);
    }

    expect(read(liveShell)).toContain("ObjectiveRawSignalCharts");
  });

  it("contains all required chart panel labels", () => {
    const combined = `${read(chartReadySignals)}\n${read(chartPanel)}\n${read(
      rawSignalCharts,
    )}`;

    for (const required of [
      "ECG preview",
      "GSR trend",
      "PPG preview",
      "Motion context",
      "TMP117 local temperature trend",
      "MPU device temperature",
      "device-health",
      "downsampled",
      "chart-ready",
      "raw/prototype/simulated",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not add oxygen-saturation or clinical-risk chart wording", () => {
    const files = [chartReadySignals, chartPanel, rawSignalCharts, liveShell];

    for (const file of files) {
      const content = read(file).toLowerCase();

      for (const forbidden of [
        "spo2",
        "spo₂",
        "oxygen saturation",
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

  it("does not expose raw schema field names in dashboard copy or props", () => {
    const files = [chartReadySignals, chartPanel, rawSignalCharts, liveShell];

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

  it("does not add frontend live-stream clients or backend fetches yet", () => {
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
    }
  });

  it("does not create patient or chatbot objective routes", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
    ]) {
      expect(fs.existsSync(forbiddenRoute)).toBe(false);
    }
  });
});
