import {
  createObjectiveDemoQualityFeatureSummary,
  getObjectiveQualityLevelLabel,
  type ObjectiveFeatureSummaryCard,
  type ObjectiveQualityCard,
  type ObjectiveQualityFeatureSummary,
} from "../_lib/qualityFeatureCards";

function ObjectiveQualityCardView({ card }: { card: ObjectiveQualityCard }) {
  return (
    <article className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Signal quality
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <h3 className="text-lg font-semibold tracking-tight">{card.title}</h3>
          <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
            {getObjectiveQualityLevelLabel(card.level)}
          </span>
        </div>
        <p className="text-sm font-medium">{card.valueLabel}</p>
        <p className="text-sm leading-6 text-muted-foreground">
          {card.summary}
        </p>
      </div>

      <div className="mt-4 rounded-md border bg-muted/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Technical limitations
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {card.technicalLimitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Supporting context
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {card.supportingDetails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function ObjectiveFeatureSummaryCardView({
  card,
}: {
  card: ObjectiveFeatureSummaryCard;
}) {
  return (
    <article className="rounded-lg border bg-background p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Feature summary
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {card.title}
      </h3>
      <p className="mt-2 text-sm font-medium">{card.valueLabel}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {card.summary}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {card.sourceContext}
      </p>
    </article>
  );
}

export function ObjectiveQualityFeatureCards({
  summary = createObjectiveDemoQualityFeatureSummary(),
}: {
  summary?: ObjectiveQualityFeatureSummary;
}) {
  return (
    <section
      aria-labelledby="objective-quality-feature-cards-title"
      className="flex flex-col gap-6"
    >
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Signal quality and feature readiness
        </p>
        <h2
          id="objective-quality-feature-cards-title"
          className="mt-2 text-2xl font-semibold tracking-tight"
        >
          Quality and feature summary cards
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          These cards describe technical usability, missingness, baseline readiness,
          and source-bound feature context. They do not make clinical conclusions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {summary.qualityCards.map((card) => (
          <ObjectiveQualityCardView key={card.kind} card={card} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {summary.featureCards.map((card) => (
          <ObjectiveFeatureSummaryCardView key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}
