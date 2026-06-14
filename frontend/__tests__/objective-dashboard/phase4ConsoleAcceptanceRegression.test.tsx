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
  const match = buttons.find((button) =>
    (button.textContent ?? "").includes(name),
  );

  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${name}`);
  }

  return match;
}

function getInputByTestId(container: HTMLElement, testId: string): HTMLInputElement {
  const match = container.querySelector(`[data-testid="${testId}"]`);

  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`Missing input test id: ${testId}`);
  }

  return match;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function expectRenderedText(container: HTMLElement, expected: string): void {
  expect(renderedText(container)).toContain(expected);
}

describe("Phase 4 objective console acceptance regression", () => {
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders a compact interactive cockpit instead of the previous long document stack", () => {
    const { container, unmount } = renderConsole();

    for (const required of [
      "Objective Monitoring Console",
      "Clinician-only simulator demo for source-bound physiological review",
      "Clinician-only",
      "Simulator demo",
      "Non-diagnostic",
      "Frontend-only",
      "No chatbot update",
      "Demo patient: demo-patient-001",
      "Mode: Phase 4 P0",
      "Runtime: Local demo playback",
      "Scenario setup",
      "Playback controls",
      "Playback speed",
      "Scrubber",
      "Signal visualization workspace",
      "ECG display amplitude",
      "Conductance trend",
      "Pulse waveform",
      "Movement magnitude",
      "Temperature/contact delta",
      "Session state",
      "Processing pipeline",
      "Interpretation snapshot",
      "Stream",
      "Features",
      "Timeline",
      "Summary",
      "Safety",
      "Stream inspector",
      "Current frame",
      "Recent frames",
      "clinician_visible=true",
      "patient_visible=false",
      "chatbot_visible=false",
    ]) {
      expectRenderedText(container, required);
    }

    for (const removedStaticStackCopy of [
      "Console overview",
      "Static demo timeline",
      "Static demo summary",
      "Scenario data, signal previews, processing state, and review panels are intentionally added in later commits.",
      "placeholder",
    ]) {
      expect(renderedText(container).toLowerCase()).not.toContain(
        removedStaticStackCopy.toLowerCase(),
      );
    }

    unmount();
  });

  it("lets scenario selection drive visible cockpit state", () => {
    const { container, unmount } = renderConsole();

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("Baseline review pattern");
    expect(getByTestId(container, "phase4-scenario-focus").textContent).toBe(
      "Stable baseline-relative evidence with review-ready quality.",
    );

    act(() => {
      getButton(container, "ML unavailable").click();
    });

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("ML unavailable");
    expect(getByTestId(container, "phase4-scenario-focus").textContent).toBe(
      "Model context unavailable without failing open.",
    );
    expectRenderedText(container, "ml_unavailable");
    expectRenderedText(container, "No fallback model conclusion is generated.");

    act(() => {
      getButton(container, "Motion/activity-like confound").click();
    });

    expect(
      getByTestId(container, "phase4-selected-scenario-title").textContent,
    ).toBe("Motion/activity-like confound");
    expectRenderedText(container, "movement_activity_like_confound");
    expectRenderedText(container, "Movement magnitude spikes and limits interpretation confidence.");

    unmount();
  });

  it("advances playback progress, pipeline stages, and timeline events with local timers", () => {
    jest.useFakeTimers();
    const { container, unmount } = renderConsole();

    expect(getByTestId(container, "phase4-playback-status").textContent).toBe(
      "Ready",
    );
    expect(getByTestId(container, "phase4-playback-progress").textContent).toBe("0%");

    act(() => {
      getButton(container, "8x").click();
      getButton(container, "Start").click();
    });

    expect(getByTestId(container, "phase4-playback-status").textContent).toBe(
      "Running",
    );

    act(() => {
      jest.advanceTimersByTime(2100);
    });

    expect(getByTestId(container, "phase4-playback-progress").textContent).toBe(
      "13%",
    );
    expect(getByTestId(container, "phase4-current-stage").textContent).toBe(
      "Ingestion boundary",
    );

    act(() => {
      getButton(container, "Timeline").click();
    });

    expectRenderedText(container, "Demo source loaded");
    expectRenderedText(container, "Ingestion boundary checked");

    const scrubber = getInputByTestId(container, "phase4-playback-scrubber");
    act(() => {
      setInputValue(scrubber, "120");
    });

    expect(getByTestId(container, "phase4-playback-time").textContent).toContain(
      "02:00 / 03:00",
    );
    expect(getByTestId(container, "phase4-current-stage").textContent).toBe(
      "Bounded interpretation",
    );

    act(() => {
      getButton(container, "Pause").click();
    });

    expect(getByTestId(container, "phase4-playback-status").textContent).toBe(
      "Paused",
    );

    act(() => {
      getButton(container, "Complete").click();
    });

    expect(getByTestId(container, "phase4-playback-status").textContent).toBe(
      "Complete",
    );
    expect(getByTestId(container, "phase4-playback-progress").textContent).toBe(
      "100%",
    );

    act(() => {
      getButton(container, "Summary").click();
    });

    expectRenderedText(container, "Baseline-relative review window is complete.");
    expectRenderedText(container, "Visible session duration");
    expectRenderedText(container, "Interpretable window coverage");

    unmount();
  });

  it("switches the focused lower review tabs without showing every section at once", () => {
    const { container, unmount } = renderConsole();

    expect(getByTestId(container, "phase4-active-review-panel").textContent).toContain(
      "Stream inspector",
    );
    expect(getByTestId(container, "phase4-active-review-panel").textContent).not.toContain(
      "Display-window feature summaries",
    );

    act(() => {
      getButton(container, "Features").click();
    });
    expect(getByTestId(container, "phase4-active-review-panel").textContent).toContain(
      "Display-window feature summaries",
    );
    expectRenderedText(container, "Heart-activity display trend");
    expectRenderedText(container, "Conductance slope");

    act(() => {
      getButton(container, "Summary").click();
    });
    expectRenderedText(container, "Summary unlocks after review window completes");

    act(() => {
      getButton(container, "Safety").click();
    });
    expectRenderedText(container, "Safety boundaries");
    expectRenderedText(container, "No patient-facing output");
    expectRenderedText(container, "No backend connection");

    unmount();
  });

  it("keeps the rendered cockpit free of raw fields and unsafe clinical claims", () => {
    const { container, unmount } = renderConsole();
    const normalized = renderedText(container).toLowerCase();

    for (const required of [
      "clinician-only",
      "non-diagnostic",
      "simulator demo",
      "frontend-only",
      "no backend connection",
      "no chatbot update",
      "no live hardware",
      "no note persistence",
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
