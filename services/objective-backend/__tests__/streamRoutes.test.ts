import { EventEmitter } from "events";
import type { IncomingMessage } from "http";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import {
    createObjectiveHeartbeatStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
} from "../src/streamEvents.js";
import {
    handleObjectiveStreamUpgrade,
    type ObjectiveStreamRouteDependencies,
} from "../src/streamRoutes.js";
import { generateObjectiveStreamToken } from "../src/streamTokens.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const secret = "objective-stream-token-test-secret-32-chars";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

const clinicianActor: ObjectiveActor = {
    actorId: "clinician-1",
    role: "clinician",
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

function makeDependencies(
    streamHub: InMemoryObjectiveClinicianStreamHub =
        new InMemoryObjectiveClinicianStreamHub(),
    activeAssignment = true,
): ObjectiveStreamRouteDependencies {
    return {
        streamTokenSecret: secret,
        streamHub,
        assignmentLookup: makeLookup(activeAssignment),
        assignmentRecheckIntervalMs: 0,
    };
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
            "x-request-id": "request-1",
            "x-trace-id": "trace-1",
            ...headers,
        },
    } as unknown as IncomingMessage;
}

async function issueToken(
    overrides: {
        sessionId?: string;
        allowedEventScopes?: Parameters<
            typeof generateObjectiveStreamToken
        >[0]["allowedEventScopes"];
    } = {},
): Promise<string> {
    const issued = await generateObjectiveStreamToken({
        actor: clinicianActor,
        patientId: "patient-1",
        sessionId: overrides.sessionId ?? "session-1",
        assignmentLookup: makeLookup(true),
        trace,
        secret,
        nowMs: Date.now(),
        ttlMs: 300_000,
        allowedEventScopes: overrides.allowedEventScopes,
    });

    if (!issued.allowed) {
        throw new Error("Expected stream token issuance to succeed");
    }

    return issued.value.token;
}

describe("objective clinician WebSocket stream route", () => {
    it("accepts a valid clinician stream token and sends an initial heartbeat", async () => {
        const token = await issueToken();
        const socket = new MockSocket();
        const hub = new InMemoryObjectiveClinicianStreamHub();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(hub),
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("101 Switching Protocols");
        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).toContain('"session_id":"session-1"');
        expect(socket.text()).toContain('"patient_visible":false');
        expect(socket.text()).toContain('"chatbot_visible":false');
        expect(hub.subscriberCount("session-1")).toBe(1);
    });

    it("delivers published safe events to subscribed clinician sockets", async () => {
        const token = await issueToken();
        const socket = new MockSocket();
        const hub = new InMemoryObjectiveClinicianStreamHub();

        await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(hub),
        );

        const deliveredCount = hub.publish(
            createObjectiveHeartbeatStreamEvent("session-1"),
        );

        expect(deliveredCount).toBe(1);
        expect(socket.text()).toContain('"event_type":"heartbeat"');
    });

    it("filters events by granted token scopes", async () => {
        const token = await issueToken({
            allowedEventScopes: ["heartbeat"],
        });
        const socket = new MockSocket();
        const hub = new InMemoryObjectiveClinicianStreamHub();

        await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(hub),
        );

        const heartbeatDelivered = hub.publish(
            createObjectiveHeartbeatStreamEvent("session-1"),
        );

        expect(heartbeatDelivered).toBe(1);
    });

    it("rejects missing stream token", async () => {
        const socket = new MockSocket();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest("/api/objective/sessions/session-1/stream"),
            socket as never,
            Buffer.alloc(0),
            {
                ...makeDependencies(),
                auditLogger: logger,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("401 Unauthorized");
        expect(socket.text()).toContain("objective_stream_token_required");
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "stream_denied",
                session_id: "session-1",
                metadata: {
                    reason: "missing_stream_token",
                },
            }),
        ]);
    });

    it("rejects patient and chatbot role headers before subscription", async () => {
        const token = await issueToken();

        for (const role of ["patient", "chatbot"] as const) {
            const socket = new MockSocket();

            const handled = await handleObjectiveStreamUpgrade(
                makeUpgradeRequest(
                    `/api/objective/sessions/session-1/stream?token=${token}`,
                    {
                        "x-objective-role": role,
                        "x-objective-actor-id": `${role}-1`,
                    },
                ),
                socket as never,
                Buffer.alloc(0),
                makeDependencies(),
            );

            expect(handled).toBe(true);
            expect(socket.text()).toContain("403 Forbidden");
            expect(socket.text()).toContain("objective_stream_role_denied");
        }
    });

    it("rejects tampered or wrong-session tokens", async () => {
        const token = await issueToken({ sessionId: "session-1" });
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-2/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(),
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("403 Forbidden");
        expect(socket.text()).toContain("objective_stream_token_context_mismatch");
    });

    it("rejects tokens when assignment is no longer active at connect time", async () => {
        const token = await issueToken();
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(new InMemoryObjectiveClinicianStreamHub(), false),
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("403 Forbidden");
        expect(socket.text()).toContain("objective_stream_assignment_inactive");
    });

    it("returns false for non-stream upgrade paths", async () => {
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest("/api/objective/other"),
            socket as never,
            Buffer.alloc(0),
            makeDependencies(),
        );

        expect(handled).toBe(false);
        expect(socket.text()).toBe("");
    });
});
