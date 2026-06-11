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

export default async function ClinicianObjectiveLiveSessionPage({
  params,
}: PageProps) {
  const { sessionId } = await params;
  const access = getObjectiveDashboardAccessFromHeaders(headers());

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Live objective session"
      description="Clinician-only placeholder for future live monitoring over the objective stream."
    >
      <ObjectiveRoutePlaceholder
        heading="Live monitoring placeholder"
        detail={`Future live monitoring shell for session reference: ${sessionId}.`}
      />
    </ObjectiveDashboardShell>
  );
}
