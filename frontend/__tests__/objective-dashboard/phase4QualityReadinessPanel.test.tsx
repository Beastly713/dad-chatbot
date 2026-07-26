import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4QualityReadinessPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4QualityReadinessPanel";

const FRONTEND_ROOT = process.cwd();
const TEST_GLOBAL = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

TEST_GLOBAL.IS_REACT_ACT_ENVIRONMENT = true;

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

function renderQualityReadinessPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4QualityReadinessPanel />);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("ObjectivePhase4QualityReadinessPanel", () => {
  const qualityPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4QualityReadinessPanel.tsx",
  );
  const qualityLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "qualityFeatureCards.ts",
  );
  const shellFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ConsoleShell.tsx",
  );

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders static clinician-safe quality/readiness cards", () => {
    const { container, unmount } = renderQualityReadinessPanel();

    expect(container.textContent).toContain("Quality/readiness");

    for (const label of [
      "ECG quality",
      "GSR quality",
      "PPG quality",
      "Motion/activity context",
      "Temperature/contact context",
      "Timing quality",
      "Baseline state",
      "Missingness",
    ]) {
      expect(container.textContent).toContain(label);
    }

    expect(container.textContent).toContain("Technical readiness");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");
    expect(container.textContent).toContain("Technical limitations");
    expect(container.textContent).toContain("Supporting context");

    unmount();
  });

  it("does not render feature-window summary cards yet", () => {
    const { container, unmount } = renderQualityReadinessPanel();

    for (const notYetRendered of [
      "Heart-activity trend",
      "Pulse-waveform context",
      "Motion confound context",
      "Feature summary",
      "Quality and feature summary cards",
      "Source-bound chart-ready GSR trend",
      "Source-bound chart-ready optical waveform preview",
      "Technical artifact/context signal",
    ]) {
      expect(container.textContent).not.toContain(notYetRendered);
    }

    unmount();
  });

  it("keeps quality/readiness copy safe and non-clinical", () => {
    const { container, unmount } = renderQualityReadinessPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "signal usability",
      "missingness",
      "timing alignment",
      "baseline readiness",
      "clinician review",
      "technical limitations",
      "not heart health",
      "not core temperature",
      "not a clinical status",
    ]) {
      expect(renderedText).toContain(required);
    }

    for (const forbidden of [
      "risk score",
      "clinical alert",
      "emergency detected",
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
      expect(renderedText).not.toContain(forbidden);
    }

    unmount();
  });

  it("does not expose raw sensor field names in rendered panel copy or source", () => {
    const { container, unmount } = renderQualityReadinessPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = `${read(qualityPanel)}\n${read(qualityLib)}`;

    for (const content of [renderedText, sourceText]) {
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
        expect(content).not.toContain(forbidden);
      }
    }

    unmount();
  });

  it("does not introduce backend, live stream, Supabase, hardware, timer, or later-module dependencies", () => {
    const combined = `${read(qualityPanel)}\n${read(qualityLib)}\n${read(shellFile)}`;

    for (const pattern of [
      /\bfetch\s*\(/,
      /new\s+WebSocket/,
      /EventSource/,
      /text\/event-stream/,
      /server-sent/i,
      /\/api\/objective/,
      /supabase/i,
      /prototypeHardware/,
      /setInterval/,
      /setTimeout/,
      /Date\.now/,
      /performance\.now/,
    ]) {
      expectNoMatch(combined, pattern, qualityPanel);
    }

    for (const forbidden of [
      "ObjectiveQualityFeatureCards",
      "ObjectiveMlInterpretationCards",
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoMlInterpretationSummary",
      "createObjectiveDemoSessionTimelineNotesSummary",
    ]) {
      expectNoText(combined, forbidden, qualityPanel);
    }
  });
});
