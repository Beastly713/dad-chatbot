type Phase4SensorStackItem = Readonly<{
  label: string;
  role: string;
  limitation: string;
  status: string;
}>;

const PHASE4_SENSOR_STACK_ITEMS: readonly Phase4SensorStackItem[] = [
  {
    label: "ECG preview",
    role: "Heart-activity signal-shape context for later chart-ready review.",
    limitation:
      "Presented as source-bound signal context only, not a cardiac diagnosis or care decision.",
    status: "Preview context",
  },
  {
    label: "GSR trend",
    role: "Skin-conductance trend context for baseline-relative arousal evidence review.",
    limitation:
      "Presented as a slow trend only, not proof of stress, craving, relapse, or withdrawal.",
    status: "Trend context",
  },
  {
    label: "PPG preview",
    role: "Optical pulse-waveform context for later chart-ready preview panels.",
    limitation:
      "Presented as optical waveform context only, not oxygen saturation or clinical oxygenation.",
    status: "Preview context",
  },
  {
    label: "Motion context",
    role: "Activity-like context for artifact review and signal quality interpretation.",
    limitation:
      "Presented as technical motion context only, not impairment classification, behavior, or intent.",
    status: "Artifact context",
  },
  {
    label: "Local temperature/contact trend",
    role: "Local skin/contact trend context for later review of signal conditions.",
    limitation:
      "Presented as local contact context only, not core temperature, fever, or medical status.",
    status: "Contact context",
  },
  {
    label: "Device temperature context",
    role: "Device-health context for monitoring sensor operating conditions.",
    limitation:
      "Presented as device-health context only, not a physiological temperature signal.",
    status: "Device-health context",
  },
];

function SensorStackStatusBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function SensorStackCard({ item }: { item: Phase4SensorStackItem }) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Signal/device context
            </p>
            <h4 className="mt-2 text-sm font-semibold tracking-tight">
              {item.label}
            </h4>
          </div>
          <SensorStackStatusBadge>{item.status}</SensorStackStatusBadge>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{item.role}</p>
        <p className="rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
          {item.limitation}
        </p>
      </div>
    </article>
  );
}

export function ObjectivePhase4SensorStackPanel() {
  return (
    <section
      aria-labelledby="objective-phase4-sensor-stack-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Telemetry source map
          </p>
          <h3
            id="objective-phase4-sensor-stack-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Sensor/device stack
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This static Phase 4 panel explains the clinician-safe signal and
            device context that later chart-ready previews will use. It does not
            start hardware, open a backend connection, or provide clinical
            conclusions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SensorStackStatusBadge>Clinician-only</SensorStackStatusBadge>
          <SensorStackStatusBadge>Simulator demo</SensorStackStatusBadge>
          <SensorStackStatusBadge>Non-diagnostic</SensorStackStatusBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PHASE4_SENSOR_STACK_ITEMS.map((item) => (
          <SensorStackCard key={item.label} item={item} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Signal visualization, chart playback, processing progress, and
        interpretation behavior remain placeholders for later commits.
      </p>
    </section>
  );
}
