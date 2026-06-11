import type { ReactNode } from "react";
import type { ObjectiveDashboardAccess } from "../_lib/dashboardAccess";
import { ObjectiveAccessDenied } from "./ObjectiveAccessDenied";

export function ObjectiveDashboardShell({
  access,
  title,
  description,
  children,
}: {
  access: ObjectiveDashboardAccess;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (!access.allowed) {
    return <ObjectiveAccessDenied access={access} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Clinician objective monitoring
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div
          role="note"
          aria-label="Objective monitoring scope note"
          className="mt-5 rounded-md border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground"
        >
          This Phase 3 surface shows clinician-reviewable physiological evidence
          only. Outputs are baseline-relative, uncertainty-bearing, and
          non-diagnostic.
        </div>
      </header>

      {children}
    </main>
  );
}
