import { requireAssignedClinician } from "../src/assignments.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

const clinicianActor: ObjectiveActor = {
    actorId: "clinician-1",
    role: "clinician",
};

function makeLookup(active: boolean): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!active) {
                return null;
            }

            return {
                assignmentId: "assignment-1",
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

describe("objective backend assignment checks", () => {
    it("allows assigned clinicians", async () => {
        const result = await requireAssignedClinician(
            clinicianActor,
            "patient-1",
            makeLookup(true),
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected assigned clinician to allow");
        }

        expect(result.value.assignment.assignmentId).toBe("assignment-1");
        expect(result.auditEvent).toBeNull();
    });

    it("denies unassigned clinicians and produces audit-ready denial", async () => {
        const result = await requireAssignedClinician(
            clinicianActor,
            "patient-1",
            makeLookup(false),
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected unassigned clinician to deny");
        }

        expect(result.statusCode).toBe(403);
        expect(result.code).toBe("objective_assignment_required");
        expect(result.auditEvent).toEqual(
            expect.objectContaining({
                event_type: "access_denied",
                actor_id: "clinician-1",
                actor_role: "clinician",
                patient_id: "patient-1",
                reason: "unassigned_clinician",
            }),
        );
    });

    it("denies non-clinician actors for patient-scoped access", async () => {
        const serviceActor: ObjectiveActor = {
            actorId: "service-1",
            role: "service",
        };

        const result = await requireAssignedClinician(
            serviceActor,
            "patient-1",
            makeLookup(true),
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected service actor to deny patient-scoped access");
        }

        expect(result.code).toBe("objective_clinician_required");
    });
});
