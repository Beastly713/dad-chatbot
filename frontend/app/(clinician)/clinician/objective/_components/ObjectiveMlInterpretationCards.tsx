import type { ReactNode } from "react";
import {
  createObjectiveDemoMlInterpretationSummary,
  formatObjectiveModelScore,
  getObjectiveConfidenceLabel,
  getObjectiveEvidenceLevelLabel,
  getObjectiveInterpretationLabel,
  getObjectiveMlTargetLabel,
  getObjectiveSuppressionStateLabel,
  type ObjectiveMlInterpretationSummary,
} from "../_lib/mlInterpretationCards";

function ObjectiveInfoCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border bg-background p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </article>
  );
}

export function ObjectiveMlInterpretationCards({
  summary = createObjectiveDemoMlInterpretationSummary(),
}: {
  summary?: ObjectiveMlInterpretationSummary;
}) {
  return (
    <section
      aria-labelledby="objective-ml-interpretation-cards-title"
      className="flex flex-col gap-6"
    >
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          ML and interpretation review
        </p>
        <h2
          id="objective-ml-interpretation-cards-title"
          className="mt-2 text-2xl font-semibold tracking-tight"
        >
          Evidence, confidence, and uncertainty cards
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          These cards show bounded model and interpretation context for clinician
          review. They are not standalone conclusions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ObjectiveInfoCard
          eyebrow="Allowed ML target"
          title={getObjectiveMlTargetLabel(summary.mlTarget)}
        >
          <p>
            The target is baseline-relative and physiological. It is not a
            diagnostic or treatment-planning target.
          </p>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Safe interpretation label"
          title={getObjectiveInterpretationLabel(summary.interpretationLabel)}
        >
          <p>
            The label is bounded to clinician-reviewable physiological evidence.
          </p>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Evidence level"
          title={getObjectiveEvidenceLevelLabel(summary.evidenceLevel)}
        >
          <p>
            Evidence level is interpreted together with quality, baseline,
            modality availability, and uncertainty context.
          </p>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Confidence"
          title={getObjectiveConfidenceLabel(summary.confidenceLabel)}
        >
          <p>
            Confidence is reduced when quality, baseline, motion, missingness,
            or signal agreement context is limited.
          </p>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Model score"
          title={formatObjectiveModelScore(summary.modelScore)}
        >
          <p>{summary.modelScoreNote}</p>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Suppression state"
          title={getObjectiveSuppressionStateLabel(summary.suppressionState)}
        >
          <p>
            Suppression and downgrade states represent data-quality or readiness
            limits, not clinical status.
          </p>
        </ObjectiveInfoCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ObjectiveInfoCard
          eyebrow="Uncertainty reasons"
          title="Review before use"
        >
          <ul className="list-disc space-y-1 pl-5">
            {summary.uncertaintyReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Contributing modalities"
          title="Included evidence context"
        >
          <ul className="list-disc space-y-1 pl-5">
            {summary.contributingModalities.map((modality) => (
              <li key={modality}>{modality}</li>
            ))}
          </ul>
        </ObjectiveInfoCard>

        <ObjectiveInfoCard
          eyebrow="Excluded modalities"
          title="Excluded or limited context"
        >
          <ul className="list-disc space-y-1 pl-5">
            {summary.excludedModalities.map((item) => (
              <li key={`${item.modality}:${item.reason}`}>
                <span className="font-medium">{item.modality}:</span>{" "}
                {item.reason}
              </li>
            ))}
          </ul>
        </ObjectiveInfoCard>
      </div>

      <section className="rounded-lg border bg-muted/30 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Scope and source note
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {summary.scopeNote}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {summary.sourceNote}
        </p>
      </section>
    </section>
  );
}
