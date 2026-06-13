import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "./_components/ObjectiveDashboardShell";
import { ObjectivePhase4ConsoleShell } from "./_components/ObjectivePhase4ConsoleShell";
import { getObjectiveDashboardAccessFromHeaders } from "./_lib/dashboardAccess";

export default async function ClinicianObjectivePage() {
  const access = getObjectiveDashboardAccessFromHeaders(headers());

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Objective Monitoring Console"
      description="Fixture-first clinician console for simulator-based objective monitoring review."
    >
      <ObjectivePhase4ConsoleShell />
    </ObjectiveDashboardShell>
  );
}
