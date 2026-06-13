import {
  createObjectiveDemoQualityFeatureSummary,
  type ObjectiveFeatureSummaryCard,
} from "../_lib/qualityFeatureCards";

function FeatureWindowBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function FeatureWindowCard({ card }: { card: ObjectiveFeatureSummaryCard }) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source-bound feature context
          </p>
          <h4 className="mt-2 text-sm font-semibold tracking-tight">
            {card.title}
          </h4>
        </div>

        <p className="text-sm font-medium">{card.valueLabel}</p>

        <p className="text-sm leading-6 text-muted-foreground">
          {card.summary}
        </p>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source context
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {card.sourceContext}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ObjectivePhase4FeatureWindowPanel() {
  const summary = createObjectiveDemoQualityFeatureSummary();

  return (
    <section
      aria-labelledby="objective-phase4-feature-window-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source-bound feature context
          </p>
          <h3
            id="objective-phase4-feature-window-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Feature-window summary
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Static demo cards summarize chart-ready feature context after
            technical quality/readiness review. They do not compute live
            features, call backend services, create clinical conclusions, or
            affect chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FeatureWindowBadge>Feature context</FeatureWindowBadge>
          <FeatureWindowBadge>Clinician-only</FeatureWindowBadge>
          <FeatureWindowBadge>Non-diagnostic</FeatureWindowBadge>
          <FeatureWindowBadge>No backend connection</FeatureWindowBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {summary.featureCards.map((card) => (
          <FeatureWindowCard key={card.title} card={card} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Interpretation context, timeline events, and final summary behavior
        remain placeholders for later commits.
      </p>
    </section>
  );
}
