import { ObjectiveMlInterpretationCards } from "./ObjectiveMlInterpretationCards";

function InterpretationConfidenceBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function ObjectivePhase4InterpretationConfidencePanel() {
  return (
    <section
      aria-labelledby="objective-phase4-interpretation-confidence-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Confidence and uncertainty context
          </p>
          <h3
            id="objective-phase4-interpretation-confidence-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Interpretation context
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Static demo cards summarize bounded model context, safe
            interpretation labels, confidence, uncertainty, and suppression
            state for clinician review. They do not call live ML services,
            create clinical conclusions, or affect chatbot responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <InterpretationConfidenceBadge>
            Clinician-only
          </InterpretationConfidenceBadge>
          <InterpretationConfidenceBadge>
            Non-diagnostic
          </InterpretationConfidenceBadge>
          <InterpretationConfidenceBadge>
            No backend connection
          </InterpretationConfidenceBadge>
          <InterpretationConfidenceBadge>
            No chatbot update
          </InterpretationConfidenceBadge>
        </div>
      </div>

      <div className="mt-5">
        <ObjectiveMlInterpretationCards />
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Timeline events and final summary behavior remain placeholders for later
        commits.
      </p>
    </section>
  );
}
