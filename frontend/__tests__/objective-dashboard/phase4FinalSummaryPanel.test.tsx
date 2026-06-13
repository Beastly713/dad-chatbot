import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4FinalSummaryPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4FinalSummaryPanel";

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

function renderFinalSummaryPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4FinalSummaryPanel />);
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

describe("ObjectivePhase4FinalSummaryPanel", () => {
  const finalSummaryPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4FinalSummaryPanel.tsx",
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

  it("renders static clinician-safe final session summary metrics", () => {
    const { container, unmount } = renderFinalSummaryPanel();

    expect(container.textContent).toContain("Final summary");

    for (const label of [
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
    ]) {
      expect(container.textContent).toContain(label);
    }

    expect(container.textContent).toContain("Safe session summary");
    expect(container.textContent).toContain("Static demo summary");
    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");
    expect(container.textContent).toContain("No note persistence");
    expect(container.textContent).toContain("No chatbot update");
    expect(container.textContent).toContain("Automated summary scope");

    unmount();
  });

  it("does not render clinician notes or note editing behavior", () => {
    const { container, unmount } = renderFinalSummaryPanel();

    for (const notRendered of [
      "Clinician notes",
      "Clinician-authored note",
      "Clinician note placeholder",
      "Created",
      "Linked context",
      "Unlinked placeholder",
      "Save note",
      "Edit note",
      "Delete note",
    ]) {
      expect(container.textContent).not.toContain(notRendered);
    }

    unmount();
  });

  it("keeps final summary copy bounded and non-clinical", () => {
    const { container, unmount } = renderFinalSummaryPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "static demo metrics",
      "technical review context",
      "clinician console",
      "do not compute live session outcomes",
      "do not compute live session outcomes, save notes, call backend services, create clinical conclusions, or affect chatbot responses",
      "source-bound technical review context",
      "does not provide diagnosis",
      "does not provide diagnosis, emergency detection, relapse prediction, withdrawal assessment, intoxication detection, sobriety status, detox guidance, medication guidance, treatment guidance, or patient-facing output",
    ]) {
      expect(renderedText).toContain(required);
    }

    for (const forbidden of [
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
      expect(renderedText).not.toContain(forbidden);
    }

    unmount();
  });

  it("does not expose raw sensor field names in rendered panel copy or source", () => {
    const { container, unmount } = renderFinalSummaryPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = `${read(finalSummaryPanel)}\n${read(timelineLib)}`;

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
    const panelContent = read(finalSummaryPanel);

    expectNoText(
      panelContent,
      "ObjectiveSessionTimelineSummaryNotes",
      finalSummaryPanel,
    );
    expect(fs.existsSync(combinedTimelineComponent)).toBe(true);
  });

  it("does not introduce backend, live stream, Supabase, hardware, timer, state, or note persistence behavior", () => {
    const combined = `${read(finalSummaryPanel)}\n${read(timelineLib)}\n${read(shellFile)}`;

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
      /useState/,
      /useEffect/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
    ]) {
      expectNoMatch(combined, pattern, finalSummaryPanel);
    }

    for (const forbidden of [
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "persistClinicianNote",
      "saveClinicianNote",
      "createClinicianNote",
      "updateClinicianNote",
      "deleteClinicianNote",
    ]) {
      expectNoText(combined, forbidden, finalSummaryPanel);
    }
  });
});
