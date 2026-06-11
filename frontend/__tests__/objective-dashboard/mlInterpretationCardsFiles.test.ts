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

describe("objective ML and interpretation dashboard files", () => {
  const routeRoot = appPath("(clinician)", "clinician", "objective");
  const mlLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "mlInterpretationCards.ts",
  );
  const mlComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveMlInterpretationCards.tsx",
  );
  const liveShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveLiveMonitoringShell.tsx",
  );

  it("adds ML and interpretation card files and wires them into the live shell", () => {
    expect(fs.existsSync(mlLib)).toBe(true);
    expect(fs.existsSync(mlComponent)).toBe(true);
    expect(read(liveShell)).toContain("ObjectiveMlInterpretationCards");
  });

  it("contains all required dashboard sections", () => {
    const combined = `${read(mlLib)}\n${read(mlComponent)}`;

    for (const required of [
      "Allowed ML target",
      "Safe interpretation label",
      "Evidence level",
      "Confidence",
      "Model score",
      "Suppression state",
      "Uncertainty reasons",
      "Contributing modalities",
      "Excluded modalities",
      "Scope and source note",
      "Baseline-relative elevated physiological arousal evidence",
      "Elevated physiological arousal evidence",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("states that model score is bounded input and not standalone conclusion", () => {
    const combined = `${read(mlLib)}\n${read(mlComponent)}`.toLowerCase();

    expect(combined).toContain("one bounded input");
    expect(combined).toContain("does not override");
    expect(combined).toContain("not standalone conclusions");
    expect(combined).toContain("uncertainty");
  });

  it("does not expose raw schema field names or unsafe executable labels", () => {
    const files = [mlLib, mlComponent, liveShell];

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

  it("keeps dashboard card copy free of unsafe clinical and route language", () => {
    const files = [mlLib, mlComponent, liveShell];

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
