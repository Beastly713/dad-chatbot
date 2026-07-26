export type ObjectiveDashboardRole =
  | "clinician"
  | "patient"
  | "chatbot"
  | "service"
  | "developer"
  | "unknown";

export type ObjectiveDashboardAccessInput = {
  role?: string | null;
  actorId?: string | null;
  assignmentStatus?: string | null;
  assignedPatientIds?: readonly string[] | null;
  requiredPatientId?: string | null;
};

export type ObjectiveDashboardAccessAllowed = {
  allowed: true;
  role: "clinician";
  actorId: string;
  assignedPatientIds: readonly string[];
};

export type ObjectiveDashboardAccessDenied = {
  allowed: false;
  code:
    | "objective_dashboard_clinician_required"
    | "objective_dashboard_actor_required"
    | "objective_dashboard_assignment_required"
    | "objective_dashboard_patient_assignment_required";
  reason: string;
};

export type ObjectiveDashboardAccess =
  | ObjectiveDashboardAccessAllowed
  | ObjectiveDashboardAccessDenied;

export type ReadonlyHeadersLike = {
  get(name: string): string | null;
};

function normalizeRole(role: string | null | undefined): ObjectiveDashboardRole {
  switch (role?.trim()) {
    case "clinician":
      return "clinician";
    case "patient":
      return "patient";
    case "chatbot":
      return "chatbot";
    case "service":
      return "service";
    case "developer":
      return "developer";
    default:
      return "unknown";
  }
}

function parseAssignedPatientIds(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveObjectiveDashboardAccess(
  input: ObjectiveDashboardAccessInput,
): ObjectiveDashboardAccess {
  const role = normalizeRole(input.role);

  if (role !== "clinician") {
    return {
      allowed: false,
      code: "objective_dashboard_clinician_required",
      reason:
        "This objective monitoring surface is available only to assigned clinicians.",
    };
  }

  const actorId = input.actorId?.trim();
  if (!actorId) {
    return {
      allowed: false,
      code: "objective_dashboard_actor_required",
      reason:
        "Clinician identity is required before objective monitoring can be shown.",
    };
  }

  if (input.assignmentStatus !== "active") {
    return {
      allowed: false,
      code: "objective_dashboard_assignment_required",
      reason:
        "An active clinician assignment is required before objective monitoring can be shown.",
    };
  }

  const assignedPatientIds = [...(input.assignedPatientIds ?? [])];
  const requiredPatientId = input.requiredPatientId?.trim();

  if (requiredPatientId && !assignedPatientIds.includes(requiredPatientId)) {
    return {
      allowed: false,
      code: "objective_dashboard_patient_assignment_required",
      reason:
        "This clinician is not assigned to the requested objective monitoring record.",
    };
  }

  return {
    allowed: true,
    role: "clinician",
    actorId,
    assignedPatientIds,
  };
}

export function getObjectiveDashboardAccessFromHeaders(
  headers: ReadonlyHeadersLike,
  options: {
    requiredPatientId?: string | null;
  } = {},
): ObjectiveDashboardAccess {
  return resolveObjectiveDashboardAccess({
    role: headers.get("x-objective-role"),
    actorId: headers.get("x-objective-actor-id"),
    assignmentStatus: headers.get("x-objective-assignment-status"),
    assignedPatientIds: parseAssignedPatientIds(
      headers.get("x-objective-assigned-patient-ids"),
    ),
    requiredPatientId: options.requiredPatientId,
  });
}
