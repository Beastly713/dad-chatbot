import http from "http";
import type { AddressInfo } from "net";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import { createObjectiveHttpServer } from "../src/server.js";
import { InMemoryObjectiveSessionRepository } from "../src/sessionLifecycle.js";

type HttpResponse = {
    statusCode: number;
    body: Record<string, unknown>;
};

function makeAssignments(active: boolean): ObjectiveAssignmentLookup {
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

function listen(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address() as AddressInfo;
            resolve(address.port);
        });
    });
}

function close(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function requestJson(
    port: number,
    method: "GET" | "POST",
    path: string,
    body: Record<string, unknown> | null,
    headers: Record<string, string>,
): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const serialized = body ? JSON.stringify(body) : undefined;

        const request = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path,
                method,
                headers: {
                    "content-type": "application/json",
                    "x-request-id": "request-1",
                    "x-trace-id": "trace-1",
                    ...headers,
                },
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                response.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");

                    resolve({
                        statusCode: response.statusCode ?? 0,
                        body: JSON.parse(text) as Record<string, unknown>,
                    });
                });
            },
        );

        request.on("error", reject);

        if (serialized) {
            request.write(serialized);
        }

        request.end();
    });
}

describe("objective session lifecycle routes", () => {
    it("denies patient and chatbot roles", async () => {
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: makeAssignments(true),
        });
        const port = await listen(server);

        try {
            for (const role of ["patient", "chatbot"]) {
                const response = await requestJson(
                    port,
                    "POST",
                    "/api/objective/sessions",
                    {
                        patient_id: "patient-1",
                        source_type: "simulator",
                    },
                    {
                        "x-objective-role": role,
                        "x-objective-actor-id": `${role}-1`,
                    },
                );

                expect(response.statusCode).toBe(403);
                expect(JSON.stringify(response.body)).toContain(
                    `objective_${role}_denied`,
                );
            }
        } finally {
            await close(server);
        }
    });

    it("allows assigned clinician create, start, pause, resume, stop, and status", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(
                () => new Date("2026-06-02T10:00:00.000Z"),
            ),
            assignments: makeAssignments(true),
            auditLogger: logger,
            now: () => new Date("2026-06-02T10:00:01.000Z"),
        });
        const port = await listen(server);

        try {
            const headers = {
                "x-objective-role": "clinician",
                "x-objective-actor-id": "clinician-1",
            };

            const created = await requestJson(
                port,
                "POST",
                "/api/objective/sessions",
                {
                    patient_id: "patient-1",
                    source_type: "simulator",
                },
                headers,
            );

            expect(created.statusCode).toBe(201);

            const session = (created.body.session ?? {}) as Record<string, unknown>;
            const sessionId = String(session.session_id);

            expect(session.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });

            for (const action of ["start", "pause", "resume", "stop"]) {
                const response = await requestJson(
                    port,
                    "POST",
                    `/api/objective/sessions/${sessionId}/${action}`,
                    null,
                    headers,
                );

                expect(response.statusCode).toBe(200);
            }

            const status = await requestJson(
                port,
                "GET",
                `/api/objective/sessions/${sessionId}/status`,
                null,
                headers,
            );

            expect(status.statusCode).toBe(200);
            expect(JSON.stringify(status.body)).toContain("stopped");
            expect(sink.getRecords().map((record) => record.event_type)).toEqual([
                "session_created",
                "session_started",
                "session_paused",
                "session_resumed",
                "session_stopped",
            ]);
        } finally {
            await close(server);
        }
    });

    it("denies unassigned clinicians and writes audit denial", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: makeAssignments(false),
            auditLogger: logger,
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "POST",
                "/api/objective/sessions",
                {
                    patient_id: "patient-1",
                    source_type: "simulator",
                },
                {
                    "x-objective-role": "clinician",
                    "x-objective-actor-id": "clinician-1",
                },
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_assignment_required",
            );
            expect(sink.getRecords()).toEqual([
                expect.objectContaining({
                    event_type: "access_denied",
                    actor_id: "clinician-1",
                    actor_role: "clinician",
                    patient_id: "patient-1",
                    metadata: {
                        reason: "unassigned_clinician",
                    },
                }),
            ]);
        } finally {
            await close(server);
        }
    });

    it("allows service identity to create simulator sessions only", async () => {
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: makeAssignments(false),
        });
        const port = await listen(server);

        try {
            const headers = {
                "x-objective-role": "service",
                "x-objective-actor-id": "service-1",
            };

            const allowed = await requestJson(
                port,
                "POST",
                "/api/objective/sessions",
                {
                    patient_id: "patient-1",
                    source_type: "simulator",
                },
                headers,
            );

            expect(allowed.statusCode).toBe(201);

            const denied = await requestJson(
                port,
                "POST",
                "/api/objective/sessions",
                {
                    patient_id: "patient-1",
                    source_type: "prototype_hardware",
                },
                headers,
            );

            expect(denied.statusCode).toBe(403);
            expect(JSON.stringify(denied.body)).toContain(
                "objective_service_source_denied",
            );
        } finally {
            await close(server);
        }
    });
});
