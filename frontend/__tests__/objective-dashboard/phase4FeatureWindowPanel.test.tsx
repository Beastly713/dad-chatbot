import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4FeatureWindowPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4FeatureWindowPanel";

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

function renderFeatureWindowPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4FeatureWindowPanel />);
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

describe("ObjectivePhase4FeatureWindowPanel", () => {
  const featurePanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4FeatureWindowPanel.tsx",
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

  it("renders static clinician-safe feature-window summary cards", () => {
    const { container, unmount } = renderFeatureWindowPanel();

    expect(container.textContent).toContain("Feature-window summary");

    for (const label of [
      "Heart-activity trend",
      "Skin-conductance trend",
      "Pulse-waveform context",
      "Motion confound context",
    ]) {
      expect(container.textContent).toContain(label);
    }

    expect(container.textContent).toContain("Feature context");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");
    expect(container.textContent).toContain("Source context");

    unmount();
  });

  it("does not render quality/readiness cards inside the feature-window panel", () => {
    const { container, unmount } = renderFeatureWindowPanel();

    for (const notRenderedHere of [
      "ECG quality",
      "GSR quality",
      "PPG quality",
      "Motion/activity context",
      "Temperature/contact context",
      "Timing quality",
      "Baseline state",
      "Missingness",
      "Technical limitations",
      "Supporting context",
    ]) {
      expect(container.textContent).not.toContain(notRenderedHere);
    }

    unmount();
  });

  it("keeps feature-window copy safe and non-clinical", () => {
    const { container, unmount } = renderFeatureWindowPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "source-bound feature context",
      "chart-ready feature context",
      "technical quality/readiness review",
      "do not compute live features",
      "do not compute live features, call backend services, create clinical conclusions, or affect chatbot responses",
      "interpretation context",
      "timeline events",
      "final summary behavior",
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
    const { container, unmount } = renderFeatureWindowPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = `${read(featurePanel)}\n${read(qualityLib)}`;

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
    const combined = `${read(featurePanel)}\n${read(qualityLib)}\n${read(shellFile)}`;

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
      expectNoMatch(combined, pattern, featurePanel);
    }

    for (const forbidden of [
      "ObjectiveQualityFeatureCards",
      "ObjectiveMlInterpretationCards",
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoMlInterpretationSummary",
      "createObjectiveDemoSessionTimelineNotesSummary",
    ]) {
      expectNoText(combined, forbidden, featurePanel);
    }
  });
});
