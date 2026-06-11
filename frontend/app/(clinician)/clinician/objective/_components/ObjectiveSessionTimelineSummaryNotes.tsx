import {
  createObjectiveDemoSessionTimelineNotesSummary,
  type ObjectiveClinicianNoteItem,
  type ObjectiveQualityTimelineItem,
  type ObjectiveSessionSummaryMetric,
  type ObjectiveSessionTimelineNotesSummary,
  type ObjectiveTimelineEvent,
} from "../_lib/sessionTimelineNotes";

function ObjectiveTimelineItemView({ item }: { item: ObjectiveTimelineEvent }) {
  return (
    <li className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.kind}
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">
            {item.title}
          </h3>
        </div>
        <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
          {item.timeLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {item.summary}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {item.sourceContext}
      </p>
    </li>
  );
}

function ObjectiveQualityTimelineItemView({
  item,
}: {
  item: ObjectiveQualityTimelineItem;
}) {
  return (
    <li className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quality timeline
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">
            {item.modality}
          </h3>
        </div>
        <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
          {item.qualityLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {item.detail}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Window: {item.timeLabel}
      </p>
    </li>
  );
}

function ObjectiveSessionSummaryMetricView({
  metric,
}: {
  metric: ObjectiveSessionSummaryMetric;
}) {
  return (
    <article className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Session summary
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight">
        {metric.label}
      </h3>
      <p className="mt-2 text-xl font-semibold tracking-tight">
        {metric.value}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {metric.detail}
      </p>
    </article>
  );
}

function ObjectiveClinicianNoteView({
  note,
}: {
  note: ObjectiveClinicianNoteItem;
}) {
  return (
    <article className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Clinician-authored note
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight">
        {note.authorLabel}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {note.noteText}
      </p>
      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <div>
          <dt className="font-medium">Created</dt>
          <dd>{note.createdAtLabel}</dd>
        </div>
        <div>
          <dt className="font-medium">Linked context</dt>
          <dd>{note.linkedContextLabel}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ObjectiveSessionTimelineSummaryNotes({
  summary = createObjectiveDemoSessionTimelineNotesSummary(),
}: {
  summary?: ObjectiveSessionTimelineNotesSummary;
}) {
  return (
    <section
      aria-labelledby="objective-session-timeline-summary-notes-title"
      className="flex flex-col gap-6"
    >
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Session timeline, summary, and notes
        </p>
        <h2
          id="objective-session-timeline-summary-notes-title"
          className="mt-2 text-2xl font-semibold tracking-tight"
        >
          Timeline and separated clinician notes
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This section separates automated objective timeline records from
          clinician-authored notes. Summary metrics are technical and
          non-diagnostic.
        </p>
      </div>

      <section
        aria-labelledby="objective-interpretation-timeline-title"
        className="flex flex-col gap-3"
      >
        <h3
          id="objective-interpretation-timeline-title"
          className="text-xl font-semibold tracking-tight"
        >
          Interpretation timeline
        </h3>
        <ol className="grid gap-3">
          {summary.interpretationTimeline.map((item) => (
            <ObjectiveTimelineItemView key={item.id} item={item} />
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="objective-quality-timeline-title"
        className="flex flex-col gap-3"
      >
        <h3
          id="objective-quality-timeline-title"
          className="text-xl font-semibold tracking-tight"
        >
          Quality timeline
        </h3>
        <ol className="grid gap-3 xl:grid-cols-2">
          {summary.qualityTimeline.map((item) => (
            <ObjectiveQualityTimelineItemView key={item.id} item={item} />
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="objective-session-summary-title"
        className="flex flex-col gap-3"
      >
        <h3
          id="objective-session-summary-title"
          className="text-xl font-semibold tracking-tight"
        >
          Safe session summary
        </h3>
        <div className="grid gap-3 xl:grid-cols-2">
          {summary.sessionSummaryMetrics.map((metric) => (
            <ObjectiveSessionSummaryMetricView
              key={metric.label}
              metric={metric}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="objective-clinician-notes-title"
        className="flex flex-col gap-3"
      >
        <h3
          id="objective-clinician-notes-title"
          className="text-xl font-semibold tracking-tight"
        >
          Clinician notes
        </h3>
        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {summary.automatedOutputSeparationNote}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {summary.clinicianNotesScopeNote}
          </p>
        </div>
        <div className="grid gap-3">
          {summary.clinicianNotes.map((note) => (
            <ObjectiveClinicianNoteView key={note.id} note={note} />
          ))}
        </div>
      </section>
    </section>
  );
}
