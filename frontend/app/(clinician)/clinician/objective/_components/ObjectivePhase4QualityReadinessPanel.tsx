import {
  createObjectiveDemoQualityFeatureSummary,
  getObjectiveQualityLevelLabel,
  type ObjectiveQualityCard,
} from "../_lib/qualityFeatureCards";

function QualityReadinessBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function QualityReadinessCard({ card }: { card: ObjectiveQualityCard }) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Technical readiness
            </p>
            <h4 className="mt-2 text-sm font-semibold tracking-tight">
              {card.title}
            </h4>
          </div>

          <QualityReadinessBadge>
            {getObjectiveQualityLevelLabel(card.level)}
          </QualityReadinessBadge>
        </div>

        <p className="text-sm font-medium">{card.valueLabel}</p>
        <p className="text-sm leading-6 text-muted-foreground">
          {card.summary}
        </p>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Technical limitations
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
            {card.technicalLimitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border bg-background/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Supporting context
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
            {card.supportingDetails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function ObjectivePhase4QualityReadinessPanel() {
  const summary = createObjectiveDemoQualityFeatureSummary();

  return (
    <section
      aria-labelledby="objective-phase4-quality-readiness-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Technical quality/readiness
          </p>
          <h3
            id="objective-phase4-quality-readiness-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Quality/readiness
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Static demo cards summarize signal usability, missingness, timing
            alignment, and baseline readiness for clinician review. They do not
            compute live quality state, call backend services, or create
            clinical conclusions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <QualityReadinessBadge>Technical readiness</QualityReadinessBadge>
          <QualityReadinessBadge>Clinician-only</QualityReadinessBadge>
          <QualityReadinessBadge>Non-diagnostic</QualityReadinessBadge>
          <QualityReadinessBadge>No backend connection</QualityReadinessBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {summary.qualityCards.map((card) => (
          <QualityReadinessCard key={card.kind} card={card} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Feature-window summaries, interpretation context, timeline events, and
        final summary behavior remain placeholders for later commits.
      </p>
    </section>
  );
}
