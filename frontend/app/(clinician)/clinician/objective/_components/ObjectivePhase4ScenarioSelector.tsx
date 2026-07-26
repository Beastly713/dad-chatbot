"use client";

import { useMemo, useState } from "react";
import {
  getPhase4DemoScenarioById,
  PHASE4_DEFAULT_DEMO_SCENARIO_ID,
  PHASE4_DEMO_SCENARIOS,
  type Phase4DemoInterpretationLabel,
  type Phase4DemoScenario,
  type Phase4DemoScenarioId,
} from "../_lib/phase4DemoScenarios";

function formatInterpretationLabel(label: Phase4DemoInterpretationLabel): string {
  return label
    .split("_")
    .map((part) => (part === "ml" ? "ML" : part))
    .join(" ");
}

function ScenarioStatusPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
}: {
  scenario: Phase4DemoScenario;
  isSelected: boolean;
  onSelect: (id: Phase4DemoScenarioId) => void;
}) {
  return (
    <label
      className={[
        "block cursor-pointer",
        "rounded-lg border p-4 text-left shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "border-slate-400 bg-slate-50/90 dark:border-slate-600 dark:bg-slate-900/70"
          : "bg-background/95 hover:bg-muted/40",
      ].join(" ")}
    >
      <input
        type="radio"
        name="phase4-demo-scenario"
        aria-label={`Select demo scenario: ${scenario.title}`}
        checked={isSelected}
        onChange={() => onSelect(scenario.id)}
        className="sr-only"
      />
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {scenario.eyebrow}
          </p>
          <h4 className="mt-2 text-sm font-semibold tracking-tight">
            {scenario.title}
          </h4>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {scenario.description}
        </p>

        <div className="flex flex-wrap gap-2">
          <ScenarioStatusPill>{scenario.source.banner}</ScenarioStatusPill>
          <ScenarioStatusPill>Clinician-only</ScenarioStatusPill>
        </div>
      </div>
    </label>
  );
}

export function ObjectivePhase4ScenarioSelector() {
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<Phase4DemoScenarioId>(PHASE4_DEFAULT_DEMO_SCENARIO_ID);

  const selectedScenario = useMemo(
    () => getPhase4DemoScenarioById(selectedScenarioId),
    [selectedScenarioId],
  );

  return (
    <section
      aria-labelledby="objective-phase4-scenario-selector-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phase 4 demo setup
          </p>
          <h3
            id="objective-phase4-scenario-selector-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Scenario setup
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Choose a deterministic simulator demo scenario for the clinician
            console shell. Selection stays local to this frontend surface and
            does not start monitoring, call backend services, or affect chatbot
            responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ScenarioStatusPill>Simulator demo</ScenarioStatusPill>
          <ScenarioStatusPill>Non-diagnostic</ScenarioStatusPill>
          <ScenarioStatusPill>Not patient-facing</ScenarioStatusPill>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PHASE4_DEMO_SCENARIOS.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            isSelected={scenario.id === selectedScenarioId}
            onSelect={setSelectedScenarioId}
          />
        ))}
      </div>

      <section className="mt-5 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected scenario preview
        </p>
        <h4
          data-testid="phase4-selected-scenario-title"
          className="mt-2 text-base font-semibold tracking-tight"
        >
          {selectedScenario.title}
        </h4>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {selectedScenario.description}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-background/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source context
            </p>
            <p className="mt-2 text-sm font-medium">
              {selectedScenario.source.banner}
            </p>
          </div>

          <div className="rounded-md border bg-background/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review label
            </p>
            <p className="mt-2 text-sm font-medium">
              {formatInterpretationLabel(
                selectedScenario.primaryInterpretationLabel,
              )}
            </p>
          </div>

          <div className="rounded-md border bg-background/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visibility
            </p>
            <p className="mt-2 text-sm font-medium">
              Clinician-only review surface
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Scenario selection prepares only the demo console context. Signal
          previews, processing progress, interpretation panels, timeline events,
          and final summary behavior are added in later commits.
        </p>
      </section>
    </section>
  );
}
