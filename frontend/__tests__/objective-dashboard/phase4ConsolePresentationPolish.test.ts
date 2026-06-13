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

describe("Phase 4 console presentation polish", () => {
  const overviewRail = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleOverviewRail.tsx",
  );
  const shellFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleShell.tsx",
  );

  it("adds a static overview rail to the completed Phase 4 console", () => {
    const overviewContent = read(overviewRail);
    const shellContent = read(shellFile);

    expect(shellContent).toContain("ObjectivePhase4ConsoleOverviewRail");

    for (const required of [
      "Console overview",
      "Phase 4 P0 console overview",
      "P0 mentor demo",
      "Simulator demo",
      "Clinician-only",
      "Non-diagnostic",
      "No backend connection",
      "No live hardware",
      "No note persistence",
      "No chatbot update",
      "Not connected to chatbot responses",
    ]) {
      expect(overviewContent).toContain(required);
    }
  });

  it("keeps the overview rail static and frontend-only", () => {
    const combined = `${read(overviewRail)}\n${read(shellFile)}`;

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
      /useState/,
      /useEffect/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
    ]) {
      expectNoMatch(combined, pattern, overviewRail);
    }
  });

  it("keeps overview copy free of raw fields and unsafe clinical claims", () => {
    const content = read(overviewRail).toLowerCase();

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
      expectNoText(content, forbidden, overviewRail);
    }
  });
});
