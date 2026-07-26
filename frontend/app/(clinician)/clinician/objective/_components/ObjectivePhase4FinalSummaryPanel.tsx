import {
  createObjectiveDemoSessionTimelineNotesSummary,
  type ObjectiveSessionSummaryMetric,
} from "../_lib/sessionTimelineNotes";

function FinalSummaryBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function FinalSummaryMetricCard({
  metric,
}: {
  metric: ObjectiveSessionSummaryMetric;
}) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Technical session metric
          </p>
          <h4 className="mt-2 text-sm font-semibold tracking-tight">
            {metric.label}
          </h4>
        </div>

        <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>

        <p className="text-sm leading-6 text-muted-foreground">
          {metric.detail}
        </p>
      </div>
    </article>
  );
}

export function ObjectivePhase4FinalSummaryPanel() {
  const summary = createObjectiveDemoSessionTimelineNotesSummary();

  return (
    <section
      aria-labelledby="objective-phase4-final-summary-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Safe session summary
          </p>
          <h3
            id="objective-phase4-final-summary-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Final summary
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Static demo metrics summarize technical review context for the
            clinician console. They do not compute live session outcomes, save
            notes, call backend services, create clinical conclusions, or affect
            chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FinalSummaryBadge>Static demo summary</FinalSummaryBadge>
          <FinalSummaryBadge>Clinician-only</FinalSummaryBadge>
          <FinalSummaryBadge>Non-diagnostic</FinalSummaryBadge>
          <FinalSummaryBadge>No backend connection</FinalSummaryBadge>
          <FinalSummaryBadge>No note persistence</FinalSummaryBadge>
          <FinalSummaryBadge>No chatbot update</FinalSummaryBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {summary.sessionSummaryMetrics.map((metric) => (
          <FinalSummaryMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-5 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Automated summary scope
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This closing summary is limited to source-bound technical review
          context. It does not provide diagnosis, emergency detection, relapse
          prediction, withdrawal assessment, acute impairment classification,
          abstinence status, detox guidance, medication guidance, treatment
          guidance, or patient-facing output.
        </p>
      </div>
    </section>
  );
}
