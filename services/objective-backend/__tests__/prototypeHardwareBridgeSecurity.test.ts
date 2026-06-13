import { EventEmitter } from "events";
import http from "http";
import type { IncomingMessage } from "http";
import type { AddressInfo } from "net";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import { loadObjectiveBackendConfig } from "../src/config.js";
import {
    OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV,
    createObjectivePrototypeHardwareRawBatchContract,
    resolveObjectivePrototypeHardwareBridgeAccess,
    resolveObjectivePrototypeHardwareBridgeConfig,
} from "../src/prototypeHardwareBridge.js";
import {
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    ingestObjectiveRawBatch,
} from "../src/rawIngestion.js";
import { createObjectiveHttpServer } from "../src/server.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    type ObjectiveSourceType,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import { InMemoryObjectiveClinicianStreamHub } from "../src/streamEvents.js";
import {
    handleObjectiveStreamUpgrade,
    type ObjectiveStreamRouteDependencies,
} from "../src/streamRoutes.js";
import { generateObjectiveStreamToken } from "../src/streamTokens.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "hardware-security-request",
    traceId: "hardware-security-trace",
};

const serviceActor: ObjectiveActor = {
    actorId: "service-hardware-security",
    role: "service",
};

const clinicianActor: ObjectiveActor = {
    actorId: "clinician-hardware-security",
    role: "clinician",
};

const streamSecret = "objective-hardware-stream-secret-32-chars";

const originalHardwareFlag =
    process.env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV];

type HttpResponse = {
    statusCode: number;
    body: Record<string, unknown>;
};

class MockSocket extends EventEmitter {
    readonly chunks: Buffer[] = [];
    destroyed = false;

    write(chunk: string | Buffer): boolean {
        this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"));

        return true;
    }

    end(chunk?: string | Buffer): void {
        if (chunk) {
            this.write(chunk);
        }

        this.destroyed = true;
        this.emit("end");
    }

    destroy(): void {
        this.destroyed = true;
        this.emit("close");
    }

    text(): string {
        return Buffer.concat(this.chunks).toString("latin1");
    }
}

function restoreHardwareFlag(): void {
    if (originalHardwareFlag === undefined) {
        delete process.env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV];
        return;
    }

    process.env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV] =
        originalHardwareFlag;
}

function noAssignments(): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment() {
            return null;
        },
    };
}

function activeAssignmentLookup(): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            return {
                assignmentId: "assignment-hardware-security",
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

function validFrame(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        pc_timestamp: "2026-06-02T10:00:00.000Z",
        esp_time_ms: 1000,
        ecg_raw: 2900,
        gsr_raw: 2405,
        ...overrides,
    };
}

function validBatch(
    sessionId: string,
    sourceType: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        batch_id: "hardware-security-batch-1",
        session_id: sessionId,
        source_type: sourceType,
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: "esp32-device-1",
        device_boot_id: "esp32-boot-1",
        frames: [validFrame()],
        ...overrides,
    };
}

async function createStartedSession(sourceType: ObjectiveSourceType) {
    const sessions = new InMemoryObjectiveSessionRepository(
        () => new Date("2026-06-02T10:00:00.000Z"),
    );

    const created = await createObjectiveSession(
        serviceActor,
        {
            patient_id: "patient-hardware-security",
            source_type: sourceType,
            device_id: "esp32-device-1",
            device_boot_id: "esp32-boot-1",
        },
        {
            sessions,
            assignments: noAssignments(),
        },
        trace,
    );

    if (!created.allowed) {
        throw new Error(`Expected session creation to succeed: ${created.code}`);
    }

    const started = await updateObjectiveSessionLifecycle(
        serviceActor,
        created.value.session_id,
        "start",
        {
            sessions,
            assignments: noAssignments(),
            now: () => new Date("2026-06-02T10:00:01.000Z"),
        },
        trace,
    );

    if (!started.allowed) {
        throw new Error(`Expected session start to succeed: ${started.code}`);
    }

    return {
        sessions,
        session: started.value,
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
                    "x-request-id": "hardware-security-request",
                    "x-trace-id": "hardware-security-trace",
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

function makeUpgradeRequest(
    url: string,
    headers: Record<string, string> = {},
): IncomingMessage {
    return {
        method: "GET",
        url,
        headers: {
            host: "localhost",
            upgrade: "websocket",
            connection: "Upgrade",
            "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
            "sec-websocket-version": "13",
            "x-request-id": "hardware-security-request",
            "x-trace-id": "hardware-security-trace",
            ...headers,
        },
    } as unknown as IncomingMessage;
}

async function issueHardwareSessionToken(): Promise<string> {
    const issued = await generateObjectiveStreamToken({
        actor: clinicianActor,
        patientId: "patient-hardware-security",
        sessionId: "hardware-session-stream-1",
        assignmentLookup: activeAssignmentLookup(),
        trace,
        secret: streamSecret,
        nowMs: Date.now(),
        ttlMs: 300_000,
    });

    if (!issued.allowed) {
        throw new Error(`Expected stream token issuance to succeed: ${issued.code}`);
    }

    return issued.value.token;
}

function streamDependencies(): ObjectiveStreamRouteDependencies {
    return {
        streamTokenSecret: streamSecret,
        streamHub: new InMemoryObjectiveClinicianStreamHub(),
        assignmentLookup: activeAssignmentLookup(),
        assignmentRecheckIntervalMs: 0,
    };
}

function expectNoSafeSurfaceLeak(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
        "raw_payload",
        "rawpayload",
        "raw_frame",
        "rawframe",
        "raw_frames",
        "rawframes",
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
        "craving_detected",
        "relapse_risk",
        "withdrawal_risk",
        "intoxication_detected",
        "aud_severity",
        "emergency_detected",
        "treatment_need",
        "detox_need",
        "medication_need",
        "ciwa_score",
        "sobriety_status",
        "patient_truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
        "stress_proven",
        "risk score",
        "clinical alert",
        "emergency alert",
        "validated hardware",
        "clinical-grade",
        "medical device",
        "diagnostic device",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("prototype hardware disabled-by-default and source-spoofing security", () => {
    beforeEach(() => {
        delete process.env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV];
    });

    afterEach(() => {
        restoreHardwareFlag();
    });

    it("keeps prototype hardware bridge disabled unless an explicit server-side flag is set", () => {
        expect(resolveObjectivePrototypeHardwareBridgeConfig({}).enabled).toBe(false);

        expect(
            resolveObjectivePrototypeHardwareBridgeConfig({
                OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED: "true",
            }).enabled,
        ).toBe(true);

        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "service",
                enabled: false,
            }),
        ).toEqual({
            allowed: false,
            code: "objective_prototype_hardware_disabled",
            message:
                "Prototype hardware ingestion is disabled by default and requires an explicit server-side debug flag.",
        });

        for (const role of ["patient", "chatbot", "clinician"] as const) {
            expect(
                resolveObjectivePrototypeHardwareBridgeAccess({
                    role,
                    enabled: true,
                }).allowed,
            ).toBe(false);
        }
    });

    it("rejects direct prototype_hardware raw ingestion while the bridge flag is disabled", async () => {
        const sessions = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );
        const session = await sessions.createSession({
            patient_id: "patient-hardware-security",
            source_type: "prototype_hardware",
            device_id: "esp32-device-1",
            device_boot_id: "esp32-boot-1",
        });
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, "prototype_hardware"),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected disabled prototype hardware ingestion to fail");
        }

        expect(result.statusCode).toBe(403);
        expect(result.code).toBe("objective_prototype_hardware_disabled");
        expect(result.message).toBe(
            "Prototype hardware ingestion is disabled by default and requires an explicit server-side debug flag.",
        );
        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
        expectNoSafeSurfaceLeak(result);
    });

    it("keeps route-based prototype_hardware ingestion disabled by default", async () => {
        const sessions = new InMemoryObjectiveSessionRepository(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const server = createObjectiveHttpServer(
            loadObjectiveBackendConfig({}),
            {
                sessions,
                assignments: noAssignments(),
            },
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
            },
        );
        const port = await listen(server);

        try {
            const serviceHeaders = {
                "x-objective-role": "service",
                "x-objective-actor-id": "service-hardware-security",
            };

            const session = await sessions.createSession({
                patient_id: "patient-hardware-security",
                source_type: "prototype_hardware",
                device_id: "esp32-device-1",
                device_boot_id: "esp32-boot-1",
            });

            const response = await requestJson(
                port,
                "POST",
                "/api/objective/ingest/batch",
                validBatch(session.session_id, "prototype_hardware"),
                serviceHeaders,
            );

            expect(response.statusCode).toBe(403);
            expect(JSON.stringify(response.body)).toContain(
                "objective_prototype_hardware_disabled",
            );
            expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
                [],
            );
            expectNoSafeSurfaceLeak(response.body);
        } finally {
            await close(server);
        }
    });

    it("rejects unknown or spoofed hardware source types before session access or storage", async () => {
        const { sessions, session } = await createStartedSession("simulator");
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        for (const spoofedSourceType of [
            "clinical_device",
            "validated_hardware",
            "medical_device",
            "diagnostic_device",
            "clinical_grade_hardware",
        ]) {
            const result = await ingestObjectiveRawBatch(
                serviceActor,
                validBatch(session.session_id, spoofedSourceType, {
                    batch_id: `spoofed-${spoofedSourceType}`,
                }),
                {
                    sessions,
                    assignments: noAssignments(),
                    rawIngestion,
                    prototypeHardwareIngestionEnabled: true,
                },
                trace,
            );

            expect(result.allowed).toBe(false);

            if (result.allowed) {
                throw new Error(`Expected ${spoofedSourceType} to be rejected`);
            }

            expect(result.statusCode).toBe(400);
            expect(result.code).toBe("objective_invalid_source_type");
            expect(result.message).toBe(
                "Objective raw batch source_type is unsupported.",
            );
            expectNoSafeSurfaceLeak({
                code: result.code,
                message: result.message,
            });
        }

        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
    });

    it("rejects prototype_hardware source mismatch even when the explicit bridge flag is enabled", async () => {
        const { sessions, session } = await createStartedSession("simulator");
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository();

        const result = await ingestObjectiveRawBatch(
            serviceActor,
            validBatch(session.session_id, "prototype_hardware"),
            {
                sessions,
                assignments: noAssignments(),
                rawIngestion,
                prototypeHardwareIngestionEnabled: true,
            },
            trace,
        );

        expect(result.allowed).toBe(false);

        if (result.allowed) {
            throw new Error("Expected prototype hardware source mismatch to fail");
        }

        expect(result.statusCode).toBe(400);
        expect(result.code).toBe("objective_batch_source_mismatch");
        expect(result.message).toBe(
            "Objective raw batch source_type must match the session source_type.",
        );
        expect(await rawIngestion.getIngestionResults(session.session_id)).toEqual(
            [],
        );
        expectNoSafeSurfaceLeak({
            code: result.code,
            message: result.message,
        });
    });

    it("keeps the prototype raw batch contract empty and unable to spoof validated hardware", () => {
        const contract = createObjectivePrototypeHardwareRawBatchContract({
            batchId: "hardware-security-contract-batch",
            sessionId: "hardware-security-session",
            deviceId: "esp32-device-1",
            deviceBootId: "esp32-boot-1",
        });

        expect(contract.source_type).toBe("prototype_hardware");
        expect(contract.raw_batch_contract.source_type).toBe("prototype_hardware");
        expect(contract.raw_batch_contract.frames).toEqual([]);
        expect(contract.hardware_metadata.clinical_validation_claim).toBe(false);
        expect(contract.hardware_metadata.validated_hardware_claim).toBe(false);
        expect(contract.hardware_metadata.live_ingestion_enabled).toBe(false);
        expect(contract.hardware_metadata.serial_transport_enabled).toBe(false);
        expect(contract.hardware_metadata.bluetooth_transport_enabled).toBe(false);
        expect(contract.hardware_metadata.network_bridge_enabled).toBe(false);
        expect(contract.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
    });

    it("denies patient and chatbot hardware stream attempts before subscription", async () => {
        const token = await issueHardwareSessionToken();

        for (const role of ["patient", "chatbot"] as const) {
            const socket = new MockSocket();

            const handled = await handleObjectiveStreamUpgrade(
                makeUpgradeRequest(
                    `/api/objective/sessions/hardware-session-stream-1/stream?token=${token}`,
                    {
                        "x-objective-role": role,
                        "x-objective-actor-id": `${role}-hardware-security`,
                    },
                ),
                socket as never,
                Buffer.alloc(0),
                streamDependencies(),
            );

            expect(handled).toBe(true);
            expect(socket.text()).toContain("403 Forbidden");
            expect(socket.text()).toContain("objective_stream_role_denied");
            expect(socket.text()).not.toContain("101 Switching Protocols");
            expectNoSafeSurfaceLeak(socket.text());
        }
    });
});
