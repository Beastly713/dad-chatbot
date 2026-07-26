import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4SessionStatusPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4SessionStatusPanel";

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

function renderStatusPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4SessionStatusPanel />);
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

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button"));
  const match = buttons.find((button) => button.textContent === name);

  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${name}`);
  }

  return match;
}

function expectSessionState(container: HTMLElement, expected: string): void {
  expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
    expected,
  );
}

describe("ObjectivePhase4SessionStatusPanel", () => {
  const statusPanelFile = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SessionStatusPanel.tsx",
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

  it("renders local session status framing and safe controls", () => {
    const { container, unmount } = renderStatusPanel();

    expect(container.textContent).toContain("Session status");
    expect(container.textContent).toContain("Simulator demo");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");

    for (const button of [
      "Start demo session",
      "Pause",
      "Resume",
      "Reset",
    ]) {
      expect(getButton(container, button)).toBeInstanceOf(HTMLButtonElement);
    }

    unmount();
  });

  it("updates only local demo status through ready, running, and paused states", () => {
    const { container, unmount } = renderStatusPanel();

    expectSessionState(container, "Ready");

    act(() => {
      getButton(container, "Start demo session").click();
    });
    expectSessionState(container, "Running");

    act(() => {
      getButton(container, "Pause").click();
    });
    expectSessionState(container, "Paused");

    act(() => {
      getButton(container, "Resume").click();
    });
    expectSessionState(container, "Running");

    act(() => {
      getButton(container, "Reset").click();
    });
    expectSessionState(container, "Ready");

    unmount();
  });

  it("keeps rendered session status copy free of forbidden clinical claims and raw fields", () => {
    const { container, unmount } = renderStatusPanel();
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

  it("does not introduce backend, live stream, Supabase, hardware, timer, or future-module dependencies", () => {
    const combined = `${read(statusPanelFile)}\n${read(shellFile)}`;

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
      expectNoMatch(combined, pattern, statusPanelFile);
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
      expectNoText(combined, forbidden, statusPanelFile);
    }
  });
});
