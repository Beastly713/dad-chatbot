import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "../../../_components/ObjectiveDashboardShell";
import { ObjectiveRoutePlaceholder } from "../../../_components/ObjectiveRoutePlaceholder";
import { getObjectiveDashboardAccessFromHeaders } from "../../../_lib/dashboardAccess";

type PageProps = {
  params:
    | {
        patientId: string;
      }
    | Promise<{
        patientId: string;
      }>;
};

export default async function ClinicianObjectivePatientSessionsPage({
  params,
}: PageProps) {
  const { patientId } = await params;
  const access = getObjectiveDashboardAccessFromHeaders(headers(), {
    requiredPatientId: patientId,
  });

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Patient objective sessions"
      description="Clinician-only placeholder for sessions linked to an assigned patient."
    >
      <ObjectiveRoutePlaceholder
        heading="Patient session list placeholder"
        detail={`Future safe session list for assigned patient reference: ${patientId}.`}
      />
    </ObjectiveDashboardShell>
  );
}
