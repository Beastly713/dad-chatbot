import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4SignalPreviewPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4SignalPreviewPanel";

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

function renderSignalPreviewPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4SignalPreviewPanel />);
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

describe("ObjectivePhase4SignalPreviewPanel", () => {
  const signalPreviewPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SignalPreviewPanel.tsx",
  );
  const rawSignalCharts = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveRawSignalCharts.tsx",
  );
  const chartPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveChartPanel.tsx",
  );
  const chartReadySignals = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "chartReadySignals.ts",
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

  it("renders the Phase 4 chart-ready signal preview panel", () => {
    const { container, unmount } = renderSignalPreviewPanel();

    expect(container.textContent).toContain("Signal previews");
    expect(container.textContent).toContain("Chart-ready signal previews");

    for (const label of [
      "ECG preview",
      "GSR trend",
      "PPG preview",
      "Motion context",
      "Local temperature/contact trend",
      "Device temperature context",
    ]) {
      expect(container.textContent).toContain(label);
    }

    expect(container.textContent).toContain("Simulator demo");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No playback engine");

    unmount();
  });

  it("keeps signal preview copy safe and non-clinical", () => {
    const { container, unmount } = renderSignalPreviewPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "source-bound",
      "clinician review",
      "not clinical decisions",
      "not core temperature",
      "not a physiological temperature signal",
      "not behavioral or clinical interpretation",
      "non-diagnostic",
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
      "oxygen saturation",
      "spo2",
      "spo₂",
    ]) {
      expect(renderedText).not.toContain(forbidden);
    }

    unmount();
  });

  it("does not expose raw sensor field names in rendered panel copy or source", () => {
    const { container, unmount } = renderSignalPreviewPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = [
      signalPreviewPanel,
      rawSignalCharts,
      chartPanel,
      chartReadySignals,
    ]
      .map(read)
      .join("\n");

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
    const combined = [
      signalPreviewPanel,
      rawSignalCharts,
      chartPanel,
      chartReadySignals,
      shellFile,
    ]
      .map(read)
      .join("\n");

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
      expectNoMatch(combined, pattern, signalPreviewPanel);
    }

    for (const forbidden of [
      "ObjectiveQualityFeatureCards",
      "ObjectiveMlInterpretationCards",
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoQualityFeatureSummary",
      "createObjectiveDemoMlInterpretationSummary",
      "createObjectiveDemoSessionTimelineNotesSummary",
    ]) {
      expectNoText(combined, forbidden, signalPreviewPanel);
    }
  });
});
