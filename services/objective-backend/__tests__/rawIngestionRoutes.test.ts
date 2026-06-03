import http from "http";
import type { AddressInfo } from "net";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import {
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
} from "../src/rawIngestion.js";
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
                        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
                            string,
                            unknown
                        >,
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
        ],
    };
}

describe("objective raw ingestion routes", () => {
    it("denies patient and chatbot roles for ingestion", async () => {
        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions: new InMemoryObjectiveSessionRepository(),
                assignments: makeAssignments(true),
            },
            {
                sessions: new InMemoryObjectiveSessionRepository(),
                assignments: makeAssignments(true),
                rawIngestion: new InMemoryObjectiveRawIngestionRepository(),
            },
        );
        const port = await listen(server);

        try {
            for (const role of ["patient", "chatbot"]) {
                const response = await requestJson(
                    port,
                    "POST",
                    "/api/objective/sessions/session-1/ingest",
                    validBatch("session-1"),
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

    it("accepts valid ingestion for an assigned clinician session", async () => {
        const sessions = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
                auditLogger: logger,
            },
            {
                sessions,
                assignments: makeAssignments(true),
                rawIngestion,
                auditLogger: logger,
            },
        );
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

            const session = (created.body.session ?? {}) as Record<string, unknown>;
            const sessionId = String(session.session_id);

            await requestJson(
                port,
                "POST",
                `/api/objective/sessions/${sessionId}/start`,
                null,
                headers,
            );

            const ingested = await requestJson(
                port,
                "POST",
                `/api/objective/sessions/${sessionId}/ingest`,
                validBatch(sessionId),
                headers,
            );

            expect(ingested.statusCode).toBe(202);
            expect(ingested.body.ingestion).toEqual({
                batch_id: "batch-1",
                session_id: sessionId,
                accepted_frame_count: 1,
                quarantined_frame_count: 0,
                chunk_count: 1,
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            });

            expect(await rawIngestion.getIngestionResults(sessionId)).toHaveLength(1);
            expect(sink.getRecords().map((record) => record.event_type)).toContain(
                "ingest_accepted",
            );
            expect(JSON.stringify(sink.getRecords())).not.toContain("ecg_raw");
            expect(JSON.stringify(sink.getRecords())).not.toContain("gsr_raw");
        } finally {
            await close(server);
        }
    });

    it("quarantines invalid frames and returns safe counts only", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

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
            const batch = validBatch(sessionId);

            batch.frames.push({
                pc_timestamp: "2026-06-02T10:00:00.005Z",
                esp_time_ms: 1005,
                ecg_raw: Number.NaN,
                craving_detected: true,
            } as never);

            const response = await requestJson(
                port,
                "POST",
                `/api/objective/sessions/${sessionId}/ingest`,
                batch,
                headers,
            );

            expect(response.statusCode).toBe(202);
            expect(response.body.ingestion).toEqual(
                expect.objectContaining({
                    accepted_frame_count: 1,
                    quarantined_frame_count: 1,
                    chunk_count: 1,
                }),
            );
            expect(JSON.stringify(response.body)).not.toContain("ecg_raw");
            expect(JSON.stringify(response.body)).not.toContain("craving_detected");
        } finally {
            await close(server);
        }
    });

    it("denies unassigned clinician ingestion", async () => {
        const sessions = new InMemoryObjectiveSessionRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: makeAssignments(true),
            },
            {
                sessions,
                assignments: makeAssignments(false),
                rawIngestion: new InMemoryObjectiveRawIngestionRepository(),
            },
        );
        const port = await listen(server);

        try {
            const createResponse = await requestJson(
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

            const session = (createResponse.body.session ?? {}) as Record<
                string,
                unknown
            >;
            const sessionId = String(session.session_id);

            const ingestResponse = await requestJson(
                port,
                "POST",
                `/api/objective/sessions/${sessionId}/ingest`,
                validBatch(sessionId),
                {
                    "x-objective-role": "clinician",
                    "x-objective-actor-id": "clinician-1",
                },
            );

            expect(ingestResponse.statusCode).toBe(403);
            expect(JSON.stringify(ingestResponse.body)).toContain(
                "objective_assignment_required",
            );
        } finally {
            await close(server);
        }
    });
});
