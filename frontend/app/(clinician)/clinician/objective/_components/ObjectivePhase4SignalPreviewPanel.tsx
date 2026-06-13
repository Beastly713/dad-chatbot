import { ObjectiveRawSignalCharts } from "./ObjectiveRawSignalCharts";

function SignalPreviewBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function ObjectivePhase4SignalPreviewPanel() {
  return (
    <section
      aria-labelledby="objective-phase4-signal-preview-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chart-ready signal previews
          </p>
          <h3
            id="objective-phase4-signal-preview-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Signal previews
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Deterministic frontend preview cards show source-bound physiological
            and device-context patterns for clinician review. They are static in
            this milestone and do not start playback, backend services, hardware
            streams, or chatbot updates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SignalPreviewBadge>Simulator demo</SignalPreviewBadge>
          <SignalPreviewBadge>Clinician-only</SignalPreviewBadge>
          <SignalPreviewBadge>Non-diagnostic</SignalPreviewBadge>
          <SignalPreviewBadge>No playback engine</SignalPreviewBadge>
        </div>
      </div>

      <div className="mt-5">
        <ObjectiveRawSignalCharts />
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Scenario-specific chart variation, playback progression, processing
        pipeline updates, quality/readiness logic, interpretation context,
        timeline events, and final summary behavior remain placeholders for
        later commits.
      </p>
    </section>
  );
}
