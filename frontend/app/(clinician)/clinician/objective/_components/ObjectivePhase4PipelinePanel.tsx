type Phase4PipelineStage = Readonly<{
  title: string;
  status: string;
  description: string;
}>;

const PHASE4_PIPELINE_STAGES: readonly Phase4PipelineStage[] = [
  {
    title: "Demo source",
    status: "Demo-ready",
    description:
      "The console starts from deterministic simulator-demo context, not live hardware or production persistence.",
  },
  {
    title: "Ingestion boundary",
    status: "Boundary only",
    description:
      "Future demo data enters through a clinician-safe boundary. This panel does not call backend ingestion.",
  },
  {
    title: "Timing alignment",
    status: "Prepared later",
    description:
      "Session-relative timing context is shown as a planned processing stage for later feature windows.",
  },
  {
    title: "Segment preparation",
    status: "Prepared later",
    description:
      "Segments will organize chart-ready context before feature-window summaries are introduced.",
  },
  {
    title: "Feature-window preparation",
    status: "Prepared later",
    description:
      "Feature windows will summarize source-bound patterns after quality/readiness context is available.",
  },
  {
    title: "Baseline-relative context",
    status: "Prepared later",
    description:
      "Baseline-relative review remains an uncertainty-bearing context, not a diagnostic conclusion.",
  },
  {
    title: "Bounded model context",
    status: "Prepared later",
    description:
      "Model context is planned as bounded review support only, with unavailable and suppressed states handled safely.",
  },
  {
    title: "Safe interpretation boundary",
    status: "Prepared later",
    description:
      "Interpretation will stay clinician-reviewable, source-bound, and non-diagnostic.",
  },
  {
    title: "Clinician review surface",
    status: "Review surface",
    description:
      "Objective outputs remain visible only in this clinician-scoped console and are not used by chatbot responses.",
  },
  {
    title: "Session summary",
    status: "Prepared later",
    description:
      "The final summary will describe technical review context without treatment, detox, medication, or care guidance.",
  },
];

function PipelineStatusBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function PipelineStageCard({
  stage,
  index,
}: {
  stage: Phase4PipelineStage;
  index: number;
}) {
  const stageNumber = String(index + 1).padStart(2, "0");

  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-xs font-semibold text-muted-foreground">
          {stageNumber}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h4 className="text-sm font-semibold tracking-tight">
              {stage.title}
            </h4>
            <PipelineStatusBadge>{stage.status}</PipelineStatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {stage.description}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ObjectivePhase4PipelinePanel() {
  return (
    <section
      aria-labelledby="objective-phase4-pipeline-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Static processing map
          </p>
          <h3
            id="objective-phase4-pipeline-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Processing pipeline
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This static Phase 4 map explains how simulator-demo context will
            move through objective monitoring review stages. It does not run a
            live pipeline, call backend services, open streams, or affect
            chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PipelineStatusBadge>Static map</PipelineStatusBadge>
          <PipelineStatusBadge>Clinician-only</PipelineStatusBadge>
          <PipelineStatusBadge>Non-diagnostic</PipelineStatusBadge>
          <PipelineStatusBadge>No backend connection</PipelineStatusBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {PHASE4_PIPELINE_STAGES.map((stage, index) => (
          <PipelineStageCard key={stage.title} stage={stage} index={index} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Dynamic progression, quality/readiness logic, interpretation context,
        timeline events, and final summary behavior remain placeholders for
        later commits.
      </p>
    </section>
  );
}
