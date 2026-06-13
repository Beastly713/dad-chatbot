type Phase4OverviewItem = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

const PHASE4_OVERVIEW_ITEMS: readonly Phase4OverviewItem[] = [
  {
    label: "Demo mode",
    value: "P0 mentor demo",
    detail:
      "Static presentation surface for reviewing the completed Phase 4 console.",
  },
  {
    label: "Source context",
    value: "Simulator demo",
    detail: "Uses deterministic demo context and does not start live hardware.",
  },
  {
    label: "Visibility",
    value: "Clinician-only",
    detail: "Objective content remains inside the clinician-scoped console.",
  },
  {
    label: "Interpretation scope",
    value: "Non-diagnostic",
    detail: "Outputs stay source-bound, uncertainty-bearing, and review-oriented.",
  },
  {
    label: "Runtime",
    value: "No backend connection",
    detail: "The P0 console does not open live streams or call objective services.",
  },
  {
    label: "Persistence",
    value: "No note persistence",
    detail: "The demo does not save clinician notes or session history.",
  },
  {
    label: "Chatbot boundary",
    value: "No chatbot update",
    detail: "Not connected to chatbot responses or patient-facing output.",
  },
];

function OverviewBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function OverviewCard({ item }: { item: Phase4OverviewItem }) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {item.label}
      </p>
      <h4 className="mt-2 text-sm font-semibold tracking-tight">
        {item.value}
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {item.detail}
      </p>
    </article>
  );
}

export function ObjectivePhase4ConsoleOverviewRail() {
  return (
    <section
      aria-labelledby="objective-phase4-console-overview-title"
      className="rounded-xl border bg-muted/20 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phase 4 P0 console overview
          </p>
          <h3
            id="objective-phase4-console-overview-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Console overview
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This overview summarizes the objective monitoring demo surface
            before the detailed panels. It is clinician-only, non-diagnostic,
            simulator-demo framed, and not connected to chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <OverviewBadge>Clinician-only</OverviewBadge>
          <OverviewBadge>Non-diagnostic</OverviewBadge>
          <OverviewBadge>Simulator demo</OverviewBadge>
          <OverviewBadge>No backend connection</OverviewBadge>
          <OverviewBadge>No live hardware</OverviewBadge>
          <OverviewBadge>No note persistence</OverviewBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PHASE4_OVERVIEW_ITEMS.map((item) => (
          <OverviewCard key={`${item.label}:${item.value}`} item={item} />
        ))}
      </div>
    </section>
  );
}
