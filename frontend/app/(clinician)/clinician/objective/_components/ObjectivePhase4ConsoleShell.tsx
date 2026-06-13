import { ObjectivePhase4FeatureWindowPanel } from "./ObjectivePhase4FeatureWindowPanel";
import { ObjectivePhase4FinalSummaryPanel } from "./ObjectivePhase4FinalSummaryPanel";
import { ObjectivePhase4InterpretationConfidencePanel } from "./ObjectivePhase4InterpretationConfidencePanel";
import { ObjectivePhase4PipelinePanel } from "./ObjectivePhase4PipelinePanel";
import { ObjectivePhase4QualityReadinessPanel } from "./ObjectivePhase4QualityReadinessPanel";
import { ObjectivePhase4ScenarioSelector } from "./ObjectivePhase4ScenarioSelector";
import { ObjectivePhase4SignalPreviewPanel } from "./ObjectivePhase4SignalPreviewPanel";
import { ObjectivePhase4SensorStackPanel } from "./ObjectivePhase4SensorStackPanel";
import { ObjectivePhase4SessionStatusPanel } from "./ObjectivePhase4SessionStatusPanel";
import { ObjectivePhase4TimelinePanel } from "./ObjectivePhase4TimelinePanel";

function ObjectiveConsoleBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
      {label}
    </span>
  );
}

export function ObjectivePhase4ConsoleShell() {
  return (
    <section
      aria-labelledby="objective-phase4-console-title"
      className="flex flex-col gap-6"
    >
      <section className="overflow-hidden rounded-lg border bg-gradient-to-br from-slate-50 via-background to-zinc-100 p-6 shadow-sm dark:from-slate-950 dark:via-background dark:to-zinc-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Phase 4 mentor demo shell
            </p>
            <h2
              id="objective-phase4-console-title"
              className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            >
              Objective Monitoring Console
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">
              A fixture-first clinician console for reviewing Source-bound physiological evidence in a calm medical telemetry layout. This shell is
              Non-diagnostic, simulator demo framed, and Not connected to
              chatbot responses.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            <ObjectiveConsoleBadge label="Clinician-only" />
            <ObjectiveConsoleBadge label="Simulator demo" />
            <ObjectiveConsoleBadge label="Non-diagnostic" />
            <ObjectiveConsoleBadge label="Not connected to chatbot responses" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source context
            </p>
            <p className="mt-2 text-sm font-medium">Simulator demo</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Demo source framing only. No live hardware or backend stream is
              used in this shell.
            </p>
          </div>

          <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review boundary
            </p>
            <p className="mt-2 text-sm font-medium">
              Clinician-reviewable evidence
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Outputs remain Uncertainty-bearing and source-bound physiological
              evidence, not diagnostic conclusions.
            </p>
          </div>

          <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo-ready state
            </p>
            <p className="mt-2 text-sm font-medium">
              Console foundation prepared
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Scenario data, signal previews, processing state, and review
              panels are intentionally added in later commits.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <section className="rounded-lg border bg-muted/30 p-5 xl:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Safety boundaries
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            Clinician-safe objective surface
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This console is not patient-facing and does not provide chatbot
            context. It prepares a clinician-only review workspace for
            source-bound physiological evidence.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Objective outputs are source-bound, uncertainty-bearing, and
            clinician-reviewable only.
          </p>
          <dl className="mt-4 grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
              <dt>clinician_visible=true</dt>
              <dd className="font-medium text-foreground">true</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
              <dt>patient_visible=false</dt>
              <dd className="font-medium text-foreground">false</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
              <dt>chatbot_visible=false</dt>
              <dd className="font-medium text-foreground">false</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:col-span-3">
          <div className="md:col-span-2">
            <ObjectivePhase4ScenarioSelector />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4SessionStatusPanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4SensorStackPanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4SignalPreviewPanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4PipelinePanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4QualityReadinessPanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4FeatureWindowPanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4InterpretationConfidencePanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4TimelinePanel />
          </div>

          <div className="md:col-span-2">
            <ObjectivePhase4FinalSummaryPanel />
          </div>
        </section>
      </section>
    </section>
  );
}
