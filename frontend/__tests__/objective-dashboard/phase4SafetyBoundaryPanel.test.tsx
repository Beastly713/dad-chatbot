import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4SafetyBoundaryPanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4SafetyBoundaryPanel";

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

function renderSafetyBoundaryPanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4SafetyBoundaryPanel />);
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

describe("ObjectivePhase4SafetyBoundaryPanel", () => {
  const safetyBoundaryPanel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4SafetyBoundaryPanel.tsx",
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

  it("renders the Phase 4 objective safety boundary panel", () => {
    const { container, unmount } = renderSafetyBoundaryPanel();

    expect(container.textContent).toContain("Safety boundaries");

    for (const label of [
      "Clinician-only surface",
      "Patient and chatbot isolation",
      "Non-diagnostic review",
      "Source-bound evidence",
      "No automated escalation",
      "Demo and persistence boundary",
    ]) {
      expect(container.textContent).toContain(label);
    }

    for (const badge of [
      "Clinician-only",
      "Non-diagnostic",
      "No chatbot update",
      "No backend connection",
      "No live hardware",
      "No note persistence",
    ]) {
      expect(container.textContent).toContain(badge);
    }

    unmount();
  });

  it("states the no-leakage and clinician-only boundaries explicitly", () => {
    const { container, unmount } = renderSafetyBoundaryPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "clinician-only",
      "not a patient-facing experience",
      "not used to alter chatbot behavior",
      "no objective data is sent to chatbot prompts",
      "retrieval",
      "memory",
      "triage",
      "final guard",
      "check-in state",
      "patient-visible objective summaries",
      "isolated from chatbot and patient-facing surfaces",
    ]) {
      expect(renderedText).toContain(required);
    }

    unmount();
  });

  it("keeps clinical and automation boundaries safe", () => {
    const { container, unmount } = renderSafetyBoundaryPanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "does not diagnose",
      "does not predict relapse",
      "assess withdrawal",
      "determine intoxication",
      "infer sobriety",
      "treatment guidance",
      "detox guidance",
      "medication guidance",
      "emergency instructions",
      "no emergency routing is triggered",
      "no chatbot update or patient message is produced",
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
    const { container, unmount } = renderSafetyBoundaryPanel();
    const renderedText = container.textContent ?? "";
    const sourceText = read(safetyBoundaryPanel);

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

  it("does not introduce backend, live stream, Supabase, hardware, timer, state, or note persistence behavior", () => {
    const combined = `${read(safetyBoundaryPanel)}\n${read(shellFile)}`;

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
      expectNoMatch(combined, pattern, safetyBoundaryPanel);
    }

    for (const forbidden of [
      "DevObjectiveSimulatorPanel",
      "persistClinicianNote",
      "saveClinicianNote",
      "createClinicianNote",
      "updateClinicianNote",
      "deleteClinicianNote",
    ]) {
      expectNoText(combined, forbidden, safetyBoundaryPanel);
    }
  });
});
