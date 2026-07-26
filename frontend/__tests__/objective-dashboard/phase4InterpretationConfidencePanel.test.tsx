import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";
import { ObjectivePhase4InterpretationConfidencePanel } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4InterpretationConfidencePanel";

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

function renderInterpretationConfidencePanel(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4InterpretationConfidencePanel />);
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

describe("ObjectivePhase4InterpretationConfidencePanel", () => {
  const phase4Panel = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectivePhase4InterpretationConfidencePanel.tsx",
  );
  const mlComponent = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveMlInterpretationCards.tsx",
  );
  const mlLib = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "mlInterpretationCards.ts",
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

  it("renders static clinician-safe interpretation and confidence context", () => {
    const { container, unmount } = renderInterpretationConfidencePanel();

    expect(container.textContent).toContain("Interpretation context");
    expect(container.textContent).toContain(
      "Evidence, confidence, and uncertainty cards",
    );

    for (const label of [
      "Allowed ML target",
      "Safe interpretation label",
      "Evidence level",
      "Confidence",
      "Model score",
      "Suppression state",
      "Uncertainty reasons",
      "Contributing modalities",
      "Excluded modalities",
      "Scope and source note",
    ]) {
      expect(container.textContent).toContain(label);
    }

    expect(container.textContent).toContain("Clinician-only");
    expect(container.textContent).toContain("Non-diagnostic");
    expect(container.textContent).toContain("No backend connection");
    expect(container.textContent).toContain("No chatbot update");

    unmount();
  });

  it("uses repo-aligned safe interpretation labels", () => {
    const content = read(mlLib);

    for (const required of [
      "low_or_baseline_arousal_evidence",
      "elevated_physiological_arousal_evidence",
      "stress_like_autonomic_activation_evidence",
      "recovery_cooldown_trend",
      "movement_activity_like_confound",
      "signal_quality_limitation",
      "cross_signal_agreement",
      "cross_signal_disagreement",
      "insufficient_reliable_data",
      "ml_unavailable",
      "simulated_data_notice",
    ]) {
      expect(content).toContain(required);
    }

    for (const oldLabel of [
      "baseline_or_low_arousal_evidence",
      "recovery_or_cooldown_evidence",
      "motion_confounded_window",
      "poor_contact_or_dropout",
      "signal_conflict",
      "not_confident",
    ]) {
      expectNoText(content, oldLabel, mlLib);
    }
  });

  it("keeps interpretation copy bounded and non-clinical", () => {
    const { container, unmount } = renderInterpretationConfidencePanel();
    const renderedText = container.textContent?.toLowerCase() ?? "";

    for (const required of [
      "bounded model context",
      "safe interpretation labels",
      "confidence",
      "uncertainty",
      "suppression state",
      "clinician review",
      "not standalone conclusions",
      "not clinical status",
      "source-bound physiological evidence",
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
    const { container, unmount } = renderInterpretationConfidencePanel();
    const renderedText = container.textContent ?? "";
    const sourceText = `${read(phase4Panel)}\n${read(mlComponent)}\n${read(mlLib)}`;

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
    const combined = `${read(phase4Panel)}\n${read(mlComponent)}\n${read(mlLib)}\n${read(shellFile)}`;

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
      expectNoMatch(combined, pattern, phase4Panel);
    }

    for (const forbidden of [
      "ObjectiveSessionTimelineSummaryNotes",
      "DevObjectiveSimulatorPanel",
      "createObjectiveDemoSessionTimelineNotesSummary",
    ]) {
      expectNoText(combined, forbidden, phase4Panel);
    }
  });
});
