import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "../../_components/ObjectiveDashboardShell";
import { ObjectiveRoutePlaceholder } from "../../_components/ObjectiveRoutePlaceholder";
import { getObjectiveDashboardAccessFromHeaders } from "../../_lib/dashboardAccess";

type PageProps = {
  params:
    | {
        sessionId: string;
      }
    | Promise<{
        sessionId: string;
      }>;
};

export default async function ClinicianObjectiveSessionPage({
  params,
}: PageProps) {
  const { sessionId } = await params;
  const access = getObjectiveDashboardAccessFromHeaders(headers());

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Objective session"
      description="Clinician-only placeholder for a non-live objective monitoring session view."
    >
      <ObjectiveRoutePlaceholder
        heading="Session detail placeholder"
        detail={`Future safe session detail for session reference: ${sessionId}.`}
      />
    </ObjectiveDashboardShell>
  );
}
