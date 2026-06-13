import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ObjectivePhase4ConsoleShell } from "../../app/(clinician)/clinician/objective/_components/ObjectivePhase4ConsoleShell";

const TEST_GLOBAL = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

TEST_GLOBAL.IS_REACT_ACT_ENVIRONMENT = true;

function renderedText(container: HTMLElement): string {
  return container.textContent ?? "";
}

function renderConsole(): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ObjectivePhase4ConsoleShell />);
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

function expectRenderedText(container: HTMLElement, expected: string): void {
  expect(renderedText(container)).toContain(expected);
}

describe("Phase 4 objective console acceptance regression", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the complete Phase 4 P0 clinician console surface", () => {
    const { container, unmount } = renderConsole();

    for (const heading of [
      "Scenario setup",
      "Session status",
      "Sensor/device stack",
      "Signal previews",
      "Processing pipeline",
      "Quality/readiness",
      "Feature-window summary",
      "Interpretation context",
      "Timeline",
      "Final summary",
      "Safety boundaries",
    ]) {
      expectRenderedText(container, heading);
    }

    for (const supportingHeading of [
      "Chart-ready signal previews",
      "Interpretation timeline",
      "Quality timeline",
      "Evidence, confidence, and uncertainty cards",
    ]) {
      expectRenderedText(container, supportingHeading);
    }

    unmount();
  });

  it("keeps the scenario selector usable inside the complete console", () => {
    const { container, unmount } = renderConsole();

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("Baseline review pattern");

    act(() => {
      getScenarioRadio(container, "ML unavailable").click();
    });

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("ML unavailable");

    for (const scenario of [
      "Baseline review pattern",
      "Elevated physiological arousal evidence",
      "Recovery/cooldown trend",
      "Motion/activity-like confound",
      "Signal quality limitation",
      "Cross-signal disagreement",
      "Insufficient reliable data",
      "ML unavailable",
    ]) {
      expectRenderedText(container, scenario);
    }

    unmount();
  });

  it("keeps local demo session controls usable inside the complete console", () => {
    const { container, unmount } = renderConsole();

    expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
      "Ready",
    );

    act(() => {
      getButton(container, "Start demo session").click();
    });
    expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
      "Running",
    );

    act(() => {
      getButton(container, "Pause").click();
    });
    expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
      "Paused",
    );

    act(() => {
      getButton(container, "Resume").click();
    });
    expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
      "Running",
    );

    act(() => {
      getButton(container, "Reset").click();
    });
    expect(getByTestId(container, "phase4-demo-session-state").textContent).toBe(
      "Ready",
    );

    unmount();
  });

  it("renders the expected Phase 4 P0 review content across panels", () => {
    const { container, unmount } = renderConsole();

    for (const label of [
      "ECG preview",
      "GSR trend",
      "PPG preview",
      "Motion context",
      "Local temperature/contact trend",
      "Device temperature context",
      "Demo source",
      "Ingestion boundary",
      "Feature-window preparation",
      "Baseline-relative context",
      "Safe interpretation boundary",
      "ECG quality",
      "GSR quality",
      "PPG quality",
      "Motion/activity context",
      "Temperature/contact context",
      "Timing quality",
      "Baseline state",
      "Missingness",
      "Heart-activity trend",
      "Skin-conductance trend",
      "Pulse-waveform context",
      "Motion confound context",
      "Allowed ML target",
      "Safe interpretation label",
      "Evidence level",
      "Confidence",
      "Suppression state",
      "Baseline review window",
      "Elevated arousal evidence period",
      "Motion-confounded window",
      "Cooldown period",
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Motion-confounded fraction",
      "Clinician-only surface",
      "Patient and chatbot isolation",
      "Non-diagnostic review",
      "Source-bound evidence",
      "No automated escalation",
      "Demo and persistence boundary",
    ]) {
      expectRenderedText(container, label);
    }

    unmount();
  });

  it("keeps the complete rendered console free of placeholders, raw fields, and unsafe clinical claims", () => {
    const { container, unmount } = renderConsole();
    const text = renderedText(container);
    const normalized = text.toLowerCase();

    for (const required of [
      "clinician-only",
      "non-diagnostic",
      "simulator demo",
      "no backend connection",
      "no chatbot update",
      "no live hardware",
      "no note persistence",
      "not connected to chatbot responses",
      "patient and chatbot isolation",
      "safety boundaries",
      "source-bound",
    ]) {
      expect(normalized).toContain(required);
    }

    for (const forbidden of [
      "placeholder for",
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
      expect(normalized).not.toContain(forbidden);
    }

    unmount();
  });
});
