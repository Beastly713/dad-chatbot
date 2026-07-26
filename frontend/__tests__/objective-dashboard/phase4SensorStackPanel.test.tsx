import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4SensorStackPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4SensorStackPanel";

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

function renderSensorStackPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4SensorStackPanel />);
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

describe("ObjectivePhase4SensorStackPanel", () => {
  const sensorStackFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SensorStackPanel.tsx",
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

  it("renders the static sensor and device stack telemetry panel", () => {
    const { container, unmount } = renderSensorStackPanel();

    expect(container.textContent).toContain("Sensor/device stack");

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

    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Simulator demo");
    expect(container.textContent).toContain("Non-diagnostic");

    unmount();
  });

  it("keeps sensor stack copy safe and non-clinical", () => {
    const { container, unmount } = renderSensorStackPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "source-bound signal context",
      "not oxygen saturation",
      "not core temperature",
      "device-health context",
      "not a physiological temperature signal",
      "not impairment classification",
      "not proof of stress",
      "not a cardiac diagnosis",
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
    const { container, unmount } = renderSensorStackPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = read(sensorStackFile);

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

  it("does not introduce chart, backend, live stream, Supabase, hardware, or future-module dependencies", () => {
    const combined = `${read(sensorStackFile)}\n${read(shellFile)}`;

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
      /recharts/i,
    ]) {
      expectNoMatch(combined, pattern, sensorStackFile);
    }

    for (const forbidden of [
      "ObjectiveRawSignalCharts",
      "ObjectiveQualityFeatureCards",
      "ObjectiveMlInterpretationCards",
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoChartSeries",
      "createObjectiveDemoQualityFeatureSummary",
      "createObjectiveDemoMlInterpretationSummary",
      "createObjectiveDemoSessionTimelineNotesSummary",
    ]) {
      expectNoText(combined, forbidden, sensorStackFile);
    }
  });
});
