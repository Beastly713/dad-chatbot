import {
  getObjectiveDashboardAccessFromHeaders,
  resolveObjectiveDashboardAccess,
  type ReadonlyHeadersLike,
} from "../../app/(clinician)/clinician/objective/_lib/dashboardAccess";

function makeHeaders(
  values: Record<string, string | undefined>,
): ReadonlyHeadersLike {
  return {
    get(name: string): string | null {
      return values[name] ?? null;
    },
  };
}

describe("clinician objective dashboard access scaffold", () => {
  it("fails closed when role is missing", () => {
    const access = resolveObjectiveDashboardAccess({});

    expect(access.allowed).toBe(false);
    if (access.allowed) {
      throw new Error("Expected dashboard access to fail closed");
    }

    expect(access.code).toBe("objective_dashboard_clinician_required");
  });

  it("denies patient and chatbot roles", () => {
    for (const role of ["patient", "chatbot"] as const) {
      const access = resolveObjectiveDashboardAccess({
        role,
        actorId: `${role}-1`,
        assignmentStatus: "active",
      });

      expect(access.allowed).toBe(false);
      if (access.allowed) {
        throw new Error(`Expected ${role} dashboard access to be denied`);
      }

      expect(access.code).toBe("objective_dashboard_clinician_required");
    }
  });

  it("denies clinicians without an actor id", () => {
    const access = resolveObjectiveDashboardAccess({
      role: "clinician",
      assignmentStatus: "active",
    });

    expect(access.allowed).toBe(false);
    if (access.allowed) {
      throw new Error("Expected missing clinician actor id to be denied");
    }

    expect(access.code).toBe("objective_dashboard_actor_required");
  });

  it("denies clinicians without active assignment status", () => {
    const access = resolveObjectiveDashboardAccess({
      role: "clinician",
      actorId: "clinician-1",
      assignmentStatus: "revoked",
    });

    expect(access.allowed).toBe(false);
    if (access.allowed) {
      throw new Error("Expected inactive assignment to be denied");
    }

    expect(access.code).toBe("objective_dashboard_assignment_required");
  });

  it("allows clinician with active assignment scaffold headers", () => {
    const access = resolveObjectiveDashboardAccess({
      role: "clinician",
      actorId: "clinician-1",
      assignmentStatus: "active",
      assignedPatientIds: ["patient-1"],
    });

    expect(access.allowed).toBe(true);
    if (!access.allowed) {
      throw new Error("Expected assigned clinician access");
    }

    expect(access.actorId).toBe("clinician-1");
    expect(access.assignedPatientIds).toEqual(["patient-1"]);
  });

  it("requires patient assignment for patient-scoped route skeletons", () => {
    const denied = resolveObjectiveDashboardAccess({
      role: "clinician",
      actorId: "clinician-1",
      assignmentStatus: "active",
      assignedPatientIds: ["patient-1"],
      requiredPatientId: "patient-2",
    });

    expect(denied.allowed).toBe(false);
    if (denied.allowed) {
      throw new Error("Expected patient-scoped dashboard route to be denied");
    }

    expect(denied.code).toBe(
      "objective_dashboard_patient_assignment_required",
    );

    const allowed = resolveObjectiveDashboardAccess({
      role: "clinician",
      actorId: "clinician-1",
      assignmentStatus: "active",
      assignedPatientIds: ["patient-1"],
      requiredPatientId: "patient-1",
    });

    expect(allowed.allowed).toBe(true);
  });

  it("parses access from request headers", () => {
    const access = getObjectiveDashboardAccessFromHeaders(
      makeHeaders({
        "x-objective-role": "clinician",
        "x-objective-actor-id": "clinician-1",
        "x-objective-assignment-status": "active",
        "x-objective-assigned-patient-ids": "patient-1, patient-2",
      }),
      {
        requiredPatientId: "patient-2",
      },
    );

    expect(access.allowed).toBe(true);
    if (!access.allowed) {
      throw new Error("Expected header-derived dashboard access");
    }

    expect(access.assignedPatientIds).toEqual(["patient-1", "patient-2"]);
  });
});
