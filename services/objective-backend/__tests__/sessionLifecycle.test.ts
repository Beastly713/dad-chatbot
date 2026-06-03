import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    nextSessionStatusForAction,
    parseCreateSessionInput,
    requireSessionAccess,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

const clinician: ObjectiveActor = {
    actorId: "clinician-1",
    role: "clinician",
};

const service: ObjectiveActor = {
    actorId: "service-1",
    role: "service",
};

const developer: ObjectiveActor = {
    actorId: "developer-1",
    role: "developer",
};

function assignedLookup(active: boolean): ObjectiveAssignmentLookup {
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

describe("objective session lifecycle", () => {
    it("parses valid create-session payloads", () => {
        const result = parseCreateSessionInput({
            patient_id: "patient-1",
            source_type: "simulator",
            device_id: "device-1",
            device_boot_id: "boot-1",
        });

        expect(result.allowed).toBe(true);
    });

    it("rejects invalid create-session payloads", () => {
        expect(parseCreateSessionInput({ source_type: "simulator" }).allowed).toBe(
            false,
        );
        expect(
            parseCreateSessionInput({
                patient_id: "patient-1",
                source_type: "clinical_device",
            }).allowed,
        ).toBe(false);
    });

    it("allows assigned clinicians to create sessions", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const sessions = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );

        const result = await createObjectiveSession(
            clinician,
            {
                patient_id: "patient-1",
                source_type: "prototype_hardware",
            },
            {
                sessions,
                assignments: assignedLookup(true),
                auditLogger: logger,
            },
            trace,
        );

        expect(result.allowed).toBe(true);

        if (!result.allowed) {
            throw new Error("Expected session create to allow");
        }

        expect(result.value).toEqual(
            expect.objectContaining({
                patient_id: "patient-1",
                source_type: "prototype_hardware",
                status: "created",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "session_created",
                actor_id: "clinician-1",
                actor_role: "clinician",
                patient_id: "patient-1",
            }),
        ]);
    });

    it("denies unassigned clinicians", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();

        const result = await createObjectiveSession(
            clinician,
            {
                patient_id: "patient-1",
                source_type: "simulator",
            },
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected unassigned clinician to deny");
        }

        expect(result.code).toBe("objective_assignment_required");
        expect(result.auditEvent?.reason).toBe("unassigned_clinician");
    });

    it("allows service identity to create simulator sessions only", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();

        const allowed = await createObjectiveSession(
            service,
            {
                patient_id: "patient-1",
                source_type: "simulator",
            },
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        expect(allowed.allowed).toBe(true);

        const denied = await createObjectiveSession(
            service,
            {
                patient_id: "patient-1",
                source_type: "prototype_hardware",
            },
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        expect(denied.allowed).toBe(false);

        if (denied.allowed) {
            throw new Error("Expected service non-simulator create to deny");
        }

        expect(denied.code).toBe("objective_service_source_denied");
    });

    it("denies developer session creation", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();

        const result = await createObjectiveSession(
            developer,
            {
                patient_id: "patient-1",
                source_type: "simulator",
            },
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        expect(result.allowed).toBe(false);
    });

    it("validates session lifecycle transitions", () => {
        expect(nextSessionStatusForAction("created", "start")).toEqual(
            expect.objectContaining({
                allowed: true,
                value: "active",
            }),
        );

        expect(nextSessionStatusForAction("active", "pause")).toEqual(
            expect.objectContaining({
                allowed: true,
                value: "paused",
            }),
        );

        expect(nextSessionStatusForAction("paused", "resume")).toEqual(
            expect.objectContaining({
                allowed: true,
                value: "active",
            }),
        );

        expect(nextSessionStatusForAction("active", "stop")).toEqual(
            expect.objectContaining({
                allowed: true,
                value: "stopped",
            }),
        );

        expect(nextSessionStatusForAction("stopped", "start").allowed).toBe(false);
    });

    it("updates lifecycle status and writes audit events", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const sessions = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );

        const created = await createObjectiveSession(
            clinician,
            {
                patient_id: "patient-1",
                source_type: "simulator",
            },
            {
                sessions,
                assignments: assignedLookup(true),
                auditLogger: logger,
            },
            trace,
        );

        if (!created.allowed) {
            throw new Error("Expected create to allow");
        }

        const started = await updateObjectiveSessionLifecycle(
            clinician,
            created.value.session_id,
            "start",
            {
                sessions,
                assignments: assignedLookup(true),
                auditLogger: logger,
                now: () => new Date("2026-06-02T10:00:01.000Z"),
            },
            trace,
        );

        expect(started.allowed).toBe(true);

        if (!started.allowed) {
            throw new Error("Expected start to allow");
        }

        expect(started.value.status).toBe("active");
        expect(started.value.started_at).toBe("2026-06-02T10:00:01.000Z");
        expect(sink.getRecords().map((record) => record.event_type)).toEqual([
            "session_created",
            "session_started",
        ]);
    });

    it("requires assignment for status access", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();

        const created = await createObjectiveSession(
            service,
            {
                patient_id: "patient-1",
                source_type: "simulator",
            },
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        if (!created.allowed) {
            throw new Error("Expected service create to allow");
        }

        const denied = await requireSessionAccess(
            clinician,
            created.value.session_id,
            {
                sessions,
                assignments: assignedLookup(false),
            },
            trace,
        );

        expect(denied.allowed).toBe(false);
    });
});
