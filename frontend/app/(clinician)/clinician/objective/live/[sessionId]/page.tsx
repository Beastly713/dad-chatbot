import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "../../_components/ObjectiveDashboardShell";
import { ObjectiveLiveMonitoringShell } from "../../_components/ObjectiveLiveMonitoringShell";
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
      description="Clinician-only live monitoring shell for source-bound physiological evidence."
    >
      <ObjectiveLiveMonitoringShell
        sessionId={sessionId}
        sourceType="simulator"
        connectionStatus="not_connected"
        liveStatus="no_data"
        sessionStatus="unknown"
      />
    </ObjectiveDashboardShell>
  );
}
