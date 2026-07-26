import {
    parseObjectiveActorFromHeaders,
    requireClinicianActor,
    requireDeveloperActor,
    requireServiceActor,
} from "../src/auth.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

describe("objective backend auth guards", () => {
    it("denies missing auth", () => {
        const result = parseObjectiveActorFromHeaders({}, trace);

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected missing auth to deny");
        }

        expect(result.statusCode).toBe(401);
        expect(result.code).toBe("objective_missing_auth");
        expect(result.auditEvent).toEqual(
            expect.objectContaining({
                event_type: "access_denied",
                reason: "missing_auth",
                request_id: "request-1",
                trace_id: "trace-1",
            }),
        );
    });

    it("denies patient role explicitly", () => {
        const result = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "patient",
                "x-objective-actor-id": "patient-1",
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected patient role to deny");
        }

        expect(result.statusCode).toBe(403);
        expect(result.code).toBe("objective_patient_denied");
        expect(result.auditEvent?.reason).toBe("patient_denied");
    });

    it("denies chatbot role explicitly", () => {
        const result = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "chatbot",
                "x-objective-actor-id": "chatbot-1",
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected chatbot role to deny");
        }

        expect(result.statusCode).toBe(403);
        expect(result.code).toBe("objective_chatbot_denied");
        expect(result.auditEvent?.reason).toBe("chatbot_denied");
    });

    it("denies unsupported roles", () => {
        const result = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "admin",
                "x-objective-actor-id": "admin-1",
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected unsupported role to deny");
        }

        expect(result.statusCode).toBe(403);
        expect(result.code).toBe("objective_unsupported_role");
    });

    it("accepts clinician, service, and developer roles with actor IDs", () => {
        for (const role of ["clinician", "service", "developer"] as const) {
            const result = parseObjectiveActorFromHeaders(
                {
                    "x-objective-role": role,
                    "x-objective-actor-id": `${role}-1`,
                },
                trace,
            );

            expect(result.allowed).toBe(true);

            if (!result.allowed) {
                throw new Error(`Expected ${role} role to allow`);
            }

            expect(result.value).toEqual({
                role,
                actorId: `${role}-1`,
            });
            expect(result.auditEvent).toBeNull();
        }
    });

    it("requires actor ID for accepted roles", () => {
        const result = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "clinician",
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected missing actor ID to deny");
        }

        expect(result.statusCode).toBe(401);
        expect(result.code).toBe("objective_missing_actor_id");
    });

    it("applies role-specific guards", () => {
        const clinician = {
            role: "clinician" as const,
            actorId: "clinician-1",
        };
        const service = {
            role: "service" as const,
            actorId: "service-1",
        };
        const developer = {
            role: "developer" as const,
            actorId: "developer-1",
        };

        expect(requireClinicianActor(clinician, trace).allowed).toBe(true);
        expect(requireServiceActor(service, trace).allowed).toBe(true);
        expect(requireDeveloperActor(developer, trace).allowed).toBe(true);

        expect(requireClinicianActor(service, trace).allowed).toBe(false);
        expect(requireServiceActor(developer, trace).allowed).toBe(false);
        expect(requireDeveloperActor(clinician, trace).allowed).toBe(false);
    });
});
