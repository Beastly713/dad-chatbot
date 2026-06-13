import {
  createObjectiveDemoSessionTimelineNotesSummary,
  type ObjectiveQualityTimelineItem,
  type ObjectiveTimelineEvent,
} from "../_lib/sessionTimelineNotes";

function TimelineBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function InterpretationTimelineCard({ item }: { item: ObjectiveTimelineEvent }) {
  return (
    <li className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.kind}
          </p>
          <h4 className="mt-2 text-sm font-semibold tracking-tight">
            {item.title}
          </h4>
        </div>

        <TimelineBadge>{item.timeLabel}</TimelineBadge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {item.summary}
      </p>

      <div className="mt-3 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Source context
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {item.sourceContext}
        </p>
      </div>
    </li>
  );
}

function QualityTimelineCard({ item }: { item: ObjectiveQualityTimelineItem }) {
  return (
    <li className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Technical quality timeline
          </p>
          <h4 className="mt-2 text-sm font-semibold tracking-tight">
            {item.modality}
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          <TimelineBadge>{item.qualityLabel}</TimelineBadge>
          <TimelineBadge>{item.timeLabel}</TimelineBadge>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {item.detail}
      </p>
    </li>
  );
}

export function ObjectivePhase4TimelinePanel() {
  const summary = createObjectiveDemoSessionTimelineNotesSummary();

  return (
    <section
      aria-labelledby="objective-phase4-timeline-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Clinician-safe event timeline
          </p>
          <h3
            id="objective-phase4-timeline-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Timeline
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Static demo timeline records show interpretation and technical
            quality context for clinician review. They are not persisted, do not
            call backend services, and do not affect chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TimelineBadge>Static demo timeline</TimelineBadge>
          <TimelineBadge>Clinician-only</TimelineBadge>
          <TimelineBadge>Non-diagnostic</TimelineBadge>
          <TimelineBadge>No backend connection</TimelineBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="objective-phase4-interpretation-timeline-title">
          <h4
            id="objective-phase4-interpretation-timeline-title"
            className="text-base font-semibold tracking-tight"
          >
            Interpretation timeline
          </h4>
          <ol className="mt-3 grid gap-3">
            {summary.interpretationTimeline.map((item) => (
              <InterpretationTimelineCard key={item.id} item={item} />
            ))}
          </ol>
        </section>

        <section aria-labelledby="objective-phase4-quality-timeline-title">
          <h4
            id="objective-phase4-quality-timeline-title"
            className="text-base font-semibold tracking-tight"
          >
            Quality timeline
          </h4>
          <ol className="mt-3 grid gap-3">
            {summary.qualityTimeline.map((item) => (
              <QualityTimelineCard key={item.id} item={item} />
            ))}
          </ol>
        </section>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Final summary metrics, clinician-authored notes, note persistence, and
        session history behavior remain placeholders for later commits.
      </p>
    </section>
  );
}
