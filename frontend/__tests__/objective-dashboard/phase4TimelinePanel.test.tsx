import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4TimelinePanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4TimelinePanel";

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

function renderTimelinePanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4TimelinePanel />);
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

describe("ObjectivePhase4TimelinePanel", () => {
  const timelinePanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4TimelinePanel.tsx",
  );
  const timelineLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "sessionTimelineNotes.ts",
  );
  const combinedTimelineComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveSessionTimelineSummaryNotes.tsx",
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

  it("renders static clinician-safe interpretation and quality timelines", () => {
    const { container, unmount } = renderTimelinePanel();

    expect(container.textContent).toContain("Timeline");
    expect(container.textContent).toContain("Clinician-safe event timeline");
    expect(container.textContent).toContain("Static demo timeline");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");
    expect(container.textContent).toContain("Interpretation timeline");
    expect(container.textContent).toContain("Quality timeline");

    for (const label of [
      "Baseline review window",
      "Elevated arousal evidence period",
      "Motion-confounded window",
      "Cooldown period",
      "ECG",
      "GSR",
      "Motion",
      "PPG",
    ]) {
      expect(container.textContent).toContain(label);
    }

    unmount();
  });

  it("does not render final summary metrics or clinician notes yet", () => {
    const { container, unmount } = renderTimelinePanel();

    for (const notRenderedYet of [
      "Safe session summary",
      "Clinician notes",
      "Clinician-authored note",
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
      "Clinician note placeholder",
      "Created",
      "Linked context",
    ]) {
      expect(container.textContent).not.toContain(notRenderedYet);
    }

    unmount();
  });

  it("keeps timeline copy bounded and non-clinical", () => {
    const { container, unmount } = renderTimelinePanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "static demo timeline records",
      "interpretation and technical quality context",
      "clinician review",
      "not persisted",
      "do not call backend services",
      "do not affect chatbot responses",
      "source-bound",
      "final summary metrics",
      "clinician-authored notes",
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
    const { container, unmount } = renderTimelinePanel();
    const renderedText = container.textContent ?? "";
    const sourceText = `${read(timelinePanel)}\n${read(timelineLib)}`;

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

  it("does not import the combined timeline summary notes component", () => {
    const panelContent = read(timelinePanel);

    expectNoText(
      panelContent,
      "ObjectiveSessionTimelineSummaryNotes",
      timelinePanel,
    );
    expect(fs.existsSync(combinedTimelineComponent)).toBe(true);
  });

  it("does not introduce backend, live stream, Supabase, hardware, timer, final-summary, or note persistence behavior", () => {
    const combined = `${read(timelinePanel)}\n${read(timelineLib)}\n${read(shellFile)}`;

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
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
    ]) {
      expectNoMatch(combined, pattern, timelinePanel);
    }

    for (const forbidden of [
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoFinalSummary",
      "persistClinicianNote",
      "saveClinicianNote",
      "createClinicianNote",
    ]) {
      expectNoText(combined, forbidden, timelinePanel);
    }
  });
});
