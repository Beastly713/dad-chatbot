type Phase4SafetyBoundary = Readonly<{
  title: string;
  badge: string;
  description: string;
  details: readonly string[];
}>;

const PHASE4_SAFETY_BOUNDARIES: readonly Phase4SafetyBoundary[] = [
  {
    title: "Clinician-only surface",
    badge: "Access boundary",
    description:
      "The Phase 4 objective console is scoped to clinician review and is not a patient-facing experience.",
    details: [
      "Objective demo output remains inside the clinician route.",
      "The console copy stays review-oriented, uncertainty-bearing, and non-diagnostic.",
      "The panel does not create patient-facing instructions or chatbot-facing content.",
    ],
  },
  {
    title: "Patient and chatbot isolation",
    badge: "No leakage path",
    description:
      "Objective monitoring context is not used to alter chatbot behavior or check-in behavior.",
    details: [
      "No objective data is sent to chatbot prompts, retrieval, memory, triage, final guard, or response selection.",
      "No objective data is sent to check-in state, planning, or question surfaces.",
      "The console does not create patient-visible objective summaries.",
    ],
  },
  {
    title: "Non-diagnostic review",
    badge: "Clinical boundary",
    description:
      "Objective outputs are limited to source-bound technical review context and are not diagnostic conclusions.",
    details: [
      "The console does not diagnose, assign severity, or produce automated warning outputs.",
      "The console does not predict relapse, assess withdrawal, classify acute impairment, infer abstinence status, or label patient stability.",
      "The console does not provide treatment guidance, detox guidance, medication guidance, or emergency instructions.",
    ],
  },
  {
    title: "Source-bound evidence",
    badge: "Evidence boundary",
    description:
      "Rendered objective content is framed as technical signal, quality, feature, interpretation, timeline, and summary context.",
    details: [
      "Evidence is presented as baseline-relative, uncertainty-bearing, and clinician-reviewable.",
      "Quality and missingness limits are surfaced before interpretation context.",
      "Raw payloads and low-level sensor fields are not displayed in this safety panel.",
    ],
  },
  {
    title: "No automated escalation",
    badge: "Automation boundary",
    description:
      "The Phase 4 console does not convert objective patterns into automated care actions.",
    details: [
      "No emergency routing is triggered from objective demo context.",
      "No treatment, detox, medication, or care-plan action is generated from objective demo context.",
      "No chatbot update or patient message is produced from objective demo context.",
    ],
  },
  {
    title: "Demo and persistence boundary",
    badge: "Runtime boundary",
    description:
      "The P0 console remains a deterministic frontend demo surface, not a live production monitoring workflow.",
    details: [
      "No backend connection, live stream, database write, or hardware stream is started by this panel.",
      "No clinician notes are saved and no session history is persisted from this panel.",
      "Dynamic playback, scenario binding, and persistence behavior remain outside this commit.",
    ],
  },
];

function SafetyBoundaryBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function SafetyBoundaryCard({ boundary }: { boundary: Phase4SafetyBoundary }) {
  return (
    <article className="rounded-lg border bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Safety boundary
            </p>
            <h4 className="mt-2 text-sm font-semibold tracking-tight">
              {boundary.title}
            </h4>
          </div>

          <SafetyBoundaryBadge>{boundary.badge}</SafetyBoundaryBadge>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {boundary.description}
        </p>

        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {boundary.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ObjectivePhase4SafetyBoundaryPanel() {
  return (
    <section
      aria-labelledby="objective-phase4-safety-boundaries-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Safety and visibility scope
          </p>
          <h3
            id="objective-phase4-safety-boundaries-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Safety boundaries
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This static boundary panel makes the Phase 4 objective console scope
            explicit: clinician-only, non-diagnostic, source-bound,
            simulator-demo framed, and isolated from chatbot and patient-facing
            surfaces.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SafetyBoundaryBadge>Clinician-only</SafetyBoundaryBadge>
          <SafetyBoundaryBadge>Non-diagnostic</SafetyBoundaryBadge>
          <SafetyBoundaryBadge>No chatbot update</SafetyBoundaryBadge>
          <SafetyBoundaryBadge>No backend connection</SafetyBoundaryBadge>
          <SafetyBoundaryBadge>No live hardware</SafetyBoundaryBadge>
          <SafetyBoundaryBadge>No note persistence</SafetyBoundaryBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {PHASE4_SAFETY_BOUNDARIES.map((boundary) => (
          <SafetyBoundaryCard key={boundary.title} boundary={boundary} />
        ))}
      </div>

      <div className="mt-5 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Phase 4 P0 boundary reminder
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This console is a mentor-demo surface for objective monitoring review.
          It does not connect objective data to chatbot output, patient UI,
          check-in flows, care decisions, or persisted clinician note workflows.
        </p>
      </div>
    </section>
  );
}
