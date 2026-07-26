import { headers } from "next/headers";
import { ObjectiveDashboardShell } from "../_components/ObjectiveDashboardShell";
import { ObjectiveRoutePlaceholder } from "../_components/ObjectiveRoutePlaceholder";
import { getObjectiveDashboardAccessFromHeaders } from "../_lib/dashboardAccess";

export default async function ClinicianObjectivePatientsPage() {
  const access = getObjectiveDashboardAccessFromHeaders(headers());

  return (
    <ObjectiveDashboardShell
      access={access}
      title="Assigned objective patients"
      description="Clinician-only placeholder for assigned objective monitoring records."
    >
      <ObjectiveRoutePlaceholder
        heading="Assigned patient list placeholder"
        detail="Assigned patient session listing is added later with safe history APIs."
      />
    </ObjectiveDashboardShell>
  );
}
