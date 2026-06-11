import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "./_components/ObjectiveDashboardShell";
import { ObjectiveRoutePlaceholder } from "./_components/ObjectiveRoutePlaceholder";
import { getObjectiveDashboardAccessFromHeaders } from "./_lib/dashboardAccess";

export default async function ClinicianObjectivePage() {
  const access = getObjectiveDashboardAccessFromHeaders(headers());

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Objective monitoring"
      description="Clinician-only entry point for reviewing objective physiological monitoring sessions."
    >
      <ObjectiveRoutePlaceholder
        heading="Dashboard route skeleton"
        detail="This page is a safe route boundary for the future clinician objective monitoring dashboard."
      />
    </ObjectiveDashboardShell>
  );
}
