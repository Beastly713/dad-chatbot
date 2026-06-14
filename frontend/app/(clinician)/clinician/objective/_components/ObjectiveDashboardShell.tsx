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
    <main className="flex min-h-screen w-full max-w-none flex-col gap-4 bg-slate-950 px-4 py-4">
      <header className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">
              Clinician objective monitoring
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              {description}
            </p>
          </div>
          <div
            role="note"
            aria-label="Objective monitoring scope note"
            className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-100"
          >
            Scope note: clinician-reviewable, baseline-relative,
            uncertainty-bearing, source-bound, and non-diagnostic.
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
