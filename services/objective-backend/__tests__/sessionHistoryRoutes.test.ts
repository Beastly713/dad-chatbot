import http from "http";
import type { AddressInfo } from "net";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import { createObjectiveHttpServer } from "../src/server.js";
import {
    InMemoryObjectiveSessionRepository,
    type ObjectiveSessionRecord,
} from "../src/sessionLifecycle.js";

type HttpResponse = {
    statusCode: number;
    body: Record<string, unknown>;
};

function makeAssignments(
    activePatientIds: string[] = ["patient-1"],
): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!activePatientIds.includes(patientId)) {
                return null;
            }

            return {
                assignmentId: `assignment-${patientId}`,
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
    headers: Record<string, string>,
): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
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
        request.end();
    });
}

async function seedStoppedSession(
    repository: InMemoryObjectiveSessionRepository,
    patientId = "patient-1",
): Promise<ObjectiveSessionRecord> {
    const session = await repository.createSession({
        patient_id: patientId,
        source_type: "simulator",
        device_id: "device-1",
        device_boot_id: "boot-1",
    });

    await repository.updateSessionStatus(session.session_id, "active", {
        started_at: "2026-06-02T10:00:10.000Z",
    });
    const stopped = await repository.updateSessionStatus(session.session_id, "stopped", {
        stopped_at: "2026-06-02T10:02:15.000Z",
    });

    if (!stopped) {
        throw new Error("Expected seeded session to exist");
    }

    return stopped;
}

function clinicianHeaders(): Record<string, string> {
    return {
        "x-objective-role": "clinician",
        "x-objective-actor-id": "clinician-1",
    };
}

function expectNoUnsafeHistoryOutput(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
        "ecg_raw",
        "gsr_raw",
        "max_red",
        "max_ir",
        "max_green",
        "accel_x",
        "accel_y",
        "accel_z",
        "gyro_x",
        "gyro_y",
        "gyro_z",
        "mpu_temp_c",
        "tmp117_temp_c",
        "relapse",
        "withdrawal",
        "intoxication",
        "craving",
        "diagnosis",
        "risk score",
        "treatment need",
        "detox need",
        "medication need",
        "ciwa",
        "sobriety",
        "truthfulness",
        "feature_windows",
        "chart_ready",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("objective session history routes", () => {
    it("allows assigned clinician to list patient sessions", async () => {
        const repository = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );
        await seedStoppedSession(repository);

        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: repository,
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/patients/patient-1/sessions",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(200);
            const history = response.body.history as Record<string, unknown>;
            const sessions = history.sessions as Record<string, unknown>[];

            expect(history.patient_id).toBe("patient-1");
            expect(history.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
            expect(sessions).toHaveLength(1);
            expect(sessions[0]).toEqual(
                expect.objectContaining({
                    patient_id: "patient-1",
                    source_type: "simulator",
                    source_banner: "simulated_data",
                    status: "stopped",
                    duration_ms: 125_000,
                    duration_label: "2m 5s",
                    visibility: {
                        clinician_visible: true,
                        patient_visible: false,
                        chatbot_visible: false,
                    },
                }),
            );
            expect(sessions[0].safe_summary).toEqual(
                expect.objectContaining({ label: "Session stopped" }),
            );
            expect(sessions[0].quality_summary).toEqual(
                expect.objectContaining({ label: "Quality summary pending" }),
            );
            expectNoUnsafeHistoryOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("allows assigned clinician to read session detail", async () => {
        const repository = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );
        const seeded = await seedStoppedSession(repository);

        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: repository,
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                `/api/objective/history/sessions/${seeded.session_id}`,
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(200);
            const history = response.body.history as Record<string, unknown>;
            const session = history.session as Record<string, unknown>;

            expect(history.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
            expect(session).toEqual(
                expect.objectContaining({
                    session_id: seeded.session_id,
                    patient_id: "patient-1",
                    source_type: "simulator",
                    status: "stopped",
                    duration_label: "2m 5s",
                    device_id: "device-1",
                    device_boot_id: "boot-1",
                }),
            );
            expect(String(session.history_scope_note)).toContain(
                "clinician-safe session metadata",
            );
            expectNoUnsafeHistoryOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("denies patient, chatbot, service, and developer roles", async () => {
        const repository = new InMemoryObjectiveSessionRepository();
        await seedStoppedSession(repository);

        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: repository,
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            for (const role of ["patient", "chatbot", "service", "developer"]) {
                const response = await requestJson(
                    port,
                    "GET",
                    "/api/objective/history/patients/patient-1/sessions",
                    {
                        "x-objective-role": role,
                        "x-objective-actor-id": `${role}-1`,
                    },
                );

                expect(response.statusCode).toBe(403);
            }
        } finally {
            await close(server);
        }
    });

    it("denies unassigned clinician and writes audit denial", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        const repository = new InMemoryObjectiveSessionRepository();
        await seedStoppedSession(repository);

        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: repository,
            assignments: makeAssignments([]),
            auditLogger: logger,
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/patients/patient-1/sessions",
                clinicianHeaders(),
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

    it("checks detail assignment against the session patient", async () => {
        const repository = new InMemoryObjectiveSessionRepository();
        const seeded = await seedStoppedSession(repository, "patient-2");

        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: repository,
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                `/api/objective/history/sessions/${seeded.session_id}`,
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_assignment_required",
            );
        } finally {
            await close(server);
        }
    });

    it("returns safe not found response for missing session detail", async () => {
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "GET",
                "/api/objective/history/sessions/missing-session",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({
                error: expect.objectContaining({
                    code: "objective_session_not_found",
                    message: "Objective session was not found.",
                }),
            });
            expectNoUnsafeHistoryOutput(response.body);
        } finally {
            await close(server);
        }
    });

    it("does not expose history endpoints for non-GET methods", async () => {
        const server = createObjectiveHttpServer(loadObjectiveBackendConfig({}), {
            sessions: new InMemoryObjectiveSessionRepository(),
            assignments: makeAssignments(["patient-1"]),
        });
        const port = await listen(server);

        try {
            const response = await requestJson(
                port,
                "POST",
                "/api/objective/history/patients/patient-1/sessions",
                clinicianHeaders(),
            );

            expect(response.statusCode).toBe(404);
            expect(JSON.stringify(response.body)).toContain(
                "objective_route_not_found",
            );
        } finally {
            await close(server);
        }
    });
});
