import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4ScenarioSelector } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4ScenarioSelector";
import { PHASE4_DEMO_SCENARIOS } from "../../app/(clinician)/clinician/objective/_lib/phase4DemoScenarios";

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

function renderSelector(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4ScenarioSelector />);
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

function getByTestId(container: HTMLElement, testId: string): HTMLElement {
  const match = container.querySelector(`[data-testid="${testId}"]`);

  if (!(match instanceof HTMLElement)) {
    throw new Error(`Missing test id: ${testId}`);
  }

  return match;
}

function getScenarioRadio(
  container: HTMLElement,
  title: string,
): HTMLInputElement {
  const selector = `input[aria-label="Select demo scenario: ${title}"]`;
  const match = container.querySelector(selector);

  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`Missing scenario radio: ${title}`);
  }

  return match;
}

describe("ObjectivePhase4ScenarioSelector", () => {
  const selectorFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4ScenarioSelector.tsx",
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

  it("renders the safe scenario selector and all scenario cards", () => {
    const { container, unmount } = renderSelector();

    expect(container.textContent).toContain("Scenario setup");
    expect(container.textContent).toContain("Simulator demo");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("Not patient-facing");

    for (const scenario of PHASE4_DEMO_SCENARIOS) {
      expect(getScenarioRadio(container, scenario.title)).toBeInstanceOf(
        HTMLInputElement,
      );
    }

    unmount();
  });

  it("updates the selected scenario preview locally without backend dependency", () => {
    const { container, unmount } = renderSelector();

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("Baseline review pattern");

    act(() => {
      getScenarioRadio(container, "ML unavailable").click();
    });

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("ML unavailable");

    unmount();
  });

  it("keeps rendered selector copy free of forbidden clinical claims and raw fields", () => {
    const { container, unmount } = renderSelector();
    const renderedText = container.textContent?.toLowerCase() ?? "";

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
      expect(renderedText).not.toContain(forbidden);
    }

    unmount();
  });

  it("does not introduce backend, live stream, Supabase, hardware, chart, or timeline dependencies", () => {
    const combined = `${read(selectorFile)}\n${read(shellFile)}`;

    for (const pattern of [
      /\bfetch\s*\(/,
      /new\s+WebSocket/,
      /EventSource/,
      /text\/event-stream/,
      /server-sent/i,
      /\/api\/objective/,
      /supabase/i,
      /prototypeHardware/,
    ]) {
      expectNoMatch(combined, pattern, selectorFile);
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
      expectNoText(combined, forbidden, selectorFile);
    }
  });
});
