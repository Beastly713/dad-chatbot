import fs from "fs";
import path from "path";
import {
  OBJECTIVE_DEV_ONLY_LABELS,
  OBJECTIVE_DEV_SIMULATOR_CONTROLS,
  OBJECTIVE_DEV_SIMULATOR_ROUTE,
  OBJECTIVE_DEV_SIMULATOR_SCENARIOS,
  resolveObjectiveDevSimulatorAccess,
} from "../../app/dev/objective-simulator/_lib/devObjectiveSimulatorConfig";

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

function expectFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${repoRelative(filePath)}`);
  }
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

function devSimulatorRoot(): string {
  return appPath("dev", "objective-simulator");
}

function devSimulatorFiles(): string[] {
  return collectFiles(devSimulatorRoot()).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
}

function clinicianObjectiveRoot(): string {
  return appPath("(clinician)", "clinician", "objective");
}

function clinicianObjectiveFiles(): string[] {
  return collectFiles(clinicianObjectiveRoot()).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
}

describe("Stage 15 developer objective simulator control panel", () => {
  it("adds the intended developer-only route files", () => {
    expect(OBJECTIVE_DEV_SIMULATOR_ROUTE).toBe("/dev/objective-simulator");

    for (const file of [
      appPath("dev", "objective-simulator", "page.tsx"),
      appPath(
        "dev",
        "objective-simulator",
        "_components",
        "DevObjectiveSimulatorPanel.tsx",
      ),
      appPath(
        "dev",
        "objective-simulator",
        "_lib",
        "devObjectiveSimulatorConfig.ts",
      ),
    ]) {
      expectFileExists(file);
    }
  });

  it("fails closed unless server-side developer debug config is enabled", () => {
    expect(resolveObjectiveDevSimulatorAccess({})).toEqual({
      allowed: false,
      code: "objective_dev_simulator_disabled",
      banner:
        "Developer objective simulator is disabled. Set OBJECTIVE_DEV_SIMULATOR_ENABLED=true in a local debug environment.",
    });

    for (const role of ["patient", "chatbot", "clinician", "service"] as const) {
      const access = resolveObjectiveDevSimulatorAccess({
        enabledFlag: "true",
        role,
      });

      expect(access.allowed).toBe(false);
      if (access.allowed) {
        throw new Error(`Expected ${role} access to be denied`);
      }

      expect(access.code).toBe("objective_dev_simulator_developer_required");
    }

    expect(
      resolveObjectiveDevSimulatorAccess({
        enabledFlag: "true",
        role: "developer",
      }),
    ).toEqual({
      allowed: true,
      mode: "developer_debug",
      banner:
        "Developer objective simulator is enabled for local engineering checks only.",
    });
  });

  it("contains scenario, seed, stream, artifact, and developer-label controls", () => {
    expect(OBJECTIVE_DEV_SIMULATOR_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "baseline_rest",
      "elevated_arousal_pattern",
      "recovery_cooldown",
      "motion_artifact",
      "poor_contact",
      "sensor_dropout",
      "signal_conflict",
      "device_reset_or_timing_gap",
    ]);

    expect(OBJECTIVE_DEV_SIMULATOR_CONTROLS.map((control) => control.id)).toEqual([
      "choose_scenario",
      "choose_seed",
      "start_stream",
      "stop_stream",
      "inject_artifact",
      "view_developer_only_labels",
    ]);

    expect(OBJECTIVE_DEV_ONLY_LABELS.map((label) => label.id)).toEqual([
      "timeline_phase_labels",
      "injection_coverage_labels",
      "source_banner",
    ]);

    const combined = devSimulatorFiles().map((file) => read(file)).join("\n");

    for (const required of [
      "Choose scenario",
      "Choose seed",
      "Start stream",
      "Stop stream",
      "Inject artifact",
      "Developer-only labels",
      "local engineering checks only",
      "This scaffold does not write to backend ingestion routes",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not add patient, chatbot, or clinician simulator routes", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective-simulator"),
      appPath("chat", "objective-simulator"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
      appPath("clinician", "objective-simulator"),
      appPath("(clinician)", "clinician", "objective-simulator"),
    ]) {
      expectPathMissing(forbiddenRoute);
    }
  });

  it("keeps clinician dashboard files free of developer simulator labels and route wiring", () => {
    for (const file of clinicianObjectiveFiles()) {
      const content = read(file);

      for (const forbidden of [
        "/dev/objective-simulator",
        "OBJECTIVE_DEV_SIMULATOR",
        "Developer-only labels",
        "objective-simulator",
        "synthetic ground truth",
        "Synthetic simulator data for engineering and safety testing only",
      ]) {
        expectNotContaining(content, forbidden, file);
      }
    }
  });

  it("keeps developer simulator route isolated from chatbot, backend services, and live network clients", () => {
    for (const file of devSimulatorFiles()) {
      const content = read(file);

      expectNotMatching(content, /app\/api\/chat/, file);
      expectNotMatching(content, /langgraph/i, file);
      expectNotMatching(content, /retrieval_graph/, file);
      expectNotMatching(content, /finalGuard/, file);
      expectNotMatching(content, /subjective/, file);
      expectNotMatching(content, /services\/objective-backend/, file);
      expectNotMatching(content, /services\/objective-ml/, file);
      expectNotMatching(content, /new\s+WebSocket/, file);
      expectNotMatching(content, /EventSource/, file);
      expectNotMatching(content, /\bfetch\s*\(/, file);
      expectNotMatching(content, /\/api\/objective\/ingest/, file);
      expectNotMatching(content, /\/api\/objective\/sessions\/.*\/stream/, file);
    }
  });

  it("keeps raw schema fields and unsafe executable labels out of the developer route source", () => {
    for (const file of devSimulatorFiles()) {
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
});
