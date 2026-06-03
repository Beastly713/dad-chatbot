import http from "http";
import type { AddressInfo } from "net";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import { OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION } from "../src/rawIngestion.js";
import { InMemoryObjectiveRawStorageRepository } from "../src/rawStorage.js";
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
                    resolve({
                        statusCode: response.statusCode ?? 0,
                        body: JSON.parse(
                            Buffer.concat(chunks).toString("utf8"),
                        ) as Record<string, unknown>,
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

function validBatch(sessionId: string) {
    return {
        batch_id: "batch-1",
        session_id: sessionId,
        source_type: "simulator",
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: "device-1",
        device_boot_id: "boot-1",
        frames: [
            {
                pc_timestamp: "2026-06-02T10:00:00.000Z",
                esp_time_ms: 1000,
                ecg_raw: 2900,
                gsr_raw: 2405,
            },
            {
                pc_timestamp: "2026-06-02T10:00:04.000Z",
                esp_time_ms: 5000,
                ecg_raw: 2920,
                gsr_raw: 2407,
            },
            {
                pc_timestamp: "2026-06-02T10:00:04.005Z",
                esp_time_ms: 5005,
                ecg_raw: Number.NaN,
                relapse_risk: "high",
            },
        ],
    };
}

async function createStartedSessionAndIngest(
    port: number,
    headers: Record<string, string>,
): Promise<string> {
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

    const session = (created.body.session ?? {}) as Record<string, unknown>;
    const sessionId = String(session.session_id);

    await requestJson(
        port,
        "POST",
        `/api/objective/sessions/${sessionId}/start`,
        null,
        headers,
    );

    await requestJson(
        port,
        "POST",
        `/api/objective/sessions/${sessionId}/ingest`,
        validBatch(sessionId),
        headers,
    );

    return sessionId;
}

describe("objective raw traceability routes", () => {
    it("returns clinician-safe raw chunk traceability without raw payload exposure", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();
        const rawIngestion = new InMemoryObjectiveRawStorageRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
            },
            {
                sessions,
                assignments: makeAssignments(true),
                rawIngestion,
            },
        );
        const port = await listen(server);

        try {
            const headers = {
                "x-objective-role": "clinician",
                "x-objective-actor-id": "clinician-1",
            };

            const sessionId = await createStartedSessionAndIngest(port, headers);

            const response = await requestJson(
                port,
                "GET",
                `/api/objective/sessions/${sessionId}/raw/traceability`,
                null,
                headers,
            );

            expect(response.statusCode).toBe(200);
            expect(response.body.raw_traceability).toEqual(
                expect.objectContaining({
                    session_id: sessionId,
                    chunk_count: expect.any(Number),
                    visibility: {
                        clinician_visible: true,
                        patient_visible: false,
                        chatbot_visible: false,
                    },
                }),
            );

            const serialized = JSON.stringify(response.body);

            expect(serialized).toContain("raw_chunk_id");
            expect(serialized).toContain("raw_range_metadata");
            expect(serialized).not.toContain("raw_payload");
            expect(serialized).not.toContain("ecg_raw");
            expect(serialized).not.toContain("gsr_raw");
            expect(serialized).not.toContain("relapse_risk");
            expect(serialized).not.toContain('patient_visible":true');
            expect(serialized).not.toContain('chatbot_visible":true');
        } finally {
            await close(server);
        }
    });

    it("returns safe quarantine summary counts without reject details or raw fields", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();
        const rawIngestion = new InMemoryObjectiveRawStorageRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
            },
            {
                sessions,
                assignments: makeAssignments(true),
                rawIngestion,
            },
        );
        const port = await listen(server);

        try {
            const headers = {
                "x-objective-role": "clinician",
                "x-objective-actor-id": "clinician-1",
            };

            const sessionId = await createStartedSessionAndIngest(port, headers);

            const response = await requestJson(
                port,
                "GET",
                `/api/objective/sessions/${sessionId}/raw/quarantine-summary`,
                null,
                headers,
            );

            expect(response.statusCode).toBe(200);
            expect(response.body.quarantine_summary).toEqual({
                session_id: sessionId,
                total_quarantined_frames: 1,
                by_reject_reason: {
                    invalid_raw_frame: 1,
                },
                by_payload_shape: {
                    object: 1,
                },
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            });

            const serialized = JSON.stringify(response.body);

            expect(serialized).not.toContain("reject_details");
            expect(serialized).not.toContain("ecg_raw");
            expect(serialized).not.toContain("gsr_raw");
            expect(serialized).not.toContain("relapse_risk");
        } finally {
            await close(server);
        }
    });

    it("denies patient and chatbot roles", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();
        const rawIngestion = new InMemoryObjectiveRawStorageRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
            },
            {
                sessions,
                assignments: makeAssignments(true),
                rawIngestion,
            },
        );
        const port = await listen(server);

        try {
            for (const role of ["patient", "chatbot"]) {
                const response = await requestJson(
                    port,
                    "GET",
                    "/api/objective/sessions/session-1/raw/traceability",
                    null,
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

    it("denies unassigned clinicians", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();
        const rawIngestion = new InMemoryObjectiveRawStorageRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
            },
            {
                sessions,
                assignments: makeAssignments(true),
                rawIngestion,
            },
            {
                sessions,
                assignments: makeAssignments(false),
                rawIngestion,
            },
        );
        const port = await listen(server);

        try {
            const headers = {
                "x-objective-role": "clinician",
                "x-objective-actor-id": "clinician-1",
            };

            const sessionId = await createStartedSessionAndIngest(port, headers);

            const response = await requestJson(
                port,
                "GET",
                `/api/objective/sessions/${sessionId}/raw/traceability`,
                null,
                headers,
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_assignment_required",
            );
        } finally {
            await close(server);
        }
    });
});
