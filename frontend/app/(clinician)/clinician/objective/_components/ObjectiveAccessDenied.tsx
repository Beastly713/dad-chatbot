import type { ObjectiveDashboardAccessDenied } from "../_lib/dashboardAccess";

export function ObjectiveAccessDenied({
  access,
}: {
  access: ObjectiveDashboardAccessDenied;
}) {
  return (
    <section
      aria-labelledby="objective-access-denied-title"
      className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12"
    >
      <div className="rounded-lg border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Clinician-only objective monitoring
        </p>
        <h1
          id="objective-access-denied-title"
          className="mt-3 text-2xl font-semibold tracking-tight"
        >
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {access.reason}
        </p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Objective physiological records are clinician-reviewable monitoring
          evidence only. They are not shown to patients or chatbot flows in
          Phase 3.
        </p>
      </div>
    </section>
  );
}
