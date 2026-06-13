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
  const shellFile = appPath(
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

  it("uses the interactive dark cockpit as the main console presentation", () => {
    const shellContent = read(shellFile);
    const cockpitContent = read(demoCockpit);

    expect(shellContent).toContain("ObjectivePhase4DemoCockpit");

    for (const required of [
      "bg-slate-950",
      "shadow-2xl",
      "xl:grid-cols-[280px_minmax(0,1fr)_320px]",
      "role=\"tablist\"",
      "Live-looking signal previews",
      "Playback controls",
      "Processing pipeline",
      "Safety boundaries",
      "data-testid=\"phase4-demo-cockpit\"",
      "data-testid=\"phase4-playback-progress\"",
      "data-testid=\"phase4-active-review-panel\"",
    ]) {
      expect(cockpitContent).toContain(required);
    }
  });

  it("keeps the cockpit frontend-only while allowing only local demo playback timers", () => {
    const combined = `${read(shellFile)}\n${read(demoCockpit)}\n${read(playbackRuntime)}`;

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
      /Date\.now/,
      /performance\.now/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
    ]) {
      expectNoMatch(combined, pattern, demoCockpit);
    }

    expect(read(demoCockpit)).toContain("setInterval");
    expect(read(demoCockpit)).toContain("useEffect");
    expect(read(demoCockpit)).toContain("useState");
    expectNoText(read(shellFile), "useState", shellFile);
    expectNoText(read(playbackRuntime), "setInterval", playbackRuntime);
  });

  it("keeps cockpit copy free of raw fields and unsafe clinical claims", () => {
    const content = `${read(demoCockpit)}\n${read(playbackRuntime)}`.toLowerCase();

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
      expectNoText(content, forbidden, demoCockpit);
    }
  });
});
