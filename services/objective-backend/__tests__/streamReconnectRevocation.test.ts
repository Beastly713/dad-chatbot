import { EventEmitter } from "events";
import type { IncomingMessage } from "http";
import { createInMemoryObjectiveAuditLogger } from "../src/audit.js";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";
import {
    createObjectiveChartSamplesStreamEvent,
    createObjectiveHeartbeatStreamEvent,
    createObjectiveSessionStatusStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
} from "../src/streamEvents.js";
import { handleObjectiveStreamUpgrade } from "../src/streamRoutes.js";
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

function makeMutableLookup(state: { active: boolean }): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!state.active) {
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

function makeSession(): ObjectiveSessionRecord {
    return {
        session_id: "session-1",
        patient_id: "patient-1",
        source_type: "simulator",
        status: "active",
        device_id: "device-1",
        device_boot_id: "boot-1",
        created_at: "2026-06-02T10:00:00.000Z",
        started_at: "2026-06-02T10:00:01.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

async function issueToken(): Promise<string> {
    const issued = await generateObjectiveStreamToken({
        actor: clinicianActor,
        patientId: "patient-1",
        sessionId: "session-1",
        assignmentLookup: makeMutableLookup({ active: true }),
        trace,
        secret,
        nowMs: Date.now(),
        ttlMs: 300_000,
    });

    if (!issued.allowed) {
        throw new Error("Expected stream token issuance to succeed");
    }

    return issued.value.token;
}

describe("objective stream reconnect, replay, and assignment revocation", () => {
    it("replays latest clinician-safe stream state on reconnect when requested", async () => {
        const token = await issueToken();
        const hub = new InMemoryObjectiveClinicianStreamHub();

        hub.publish(createObjectiveSessionStatusStreamEvent(makeSession()));
        hub.publish(
            createObjectiveChartSamplesStreamEvent("session-1", [
                {
                    t_ms: 1000,
                    relative_time_ms: 0,
                    values: {
                        heart_activity_trend: 0.2,
                        skin_conductance_trend: 0.1,
                        motion_confound_index: 0.05,
                    },
                    quality: {
                        overall: "usable",
                    },
                },
            ]),
        );

        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?replay=latest&token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: hub,
                assignmentLookup: makeMutableLookup({ active: true }),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(handled).toBe(true);

        const output = socket.text();
        expect(output).toContain("101 Switching Protocols");
        expect(output).toContain('"event_type":"heartbeat"');
        expect(output).toContain('"event_type":"session.status"');
        expect(output).toContain('"event_type":"chart.samples"');
        expect(output).toContain('"clinician_visible":true');
        expect(output).toContain('"patient_visible":false');
        expect(output).toContain('"chatbot_visible":false');

        for (const forbidden of [
            "ecg_raw",
            "gsr_raw",
            "max_red",
            "max_ir",
            "max_green",
            "accel_x",
            "accel_y",
            "gyro_x",
            "gyro_y",
            "tmp117_temp_c",
            "relapse_risk",
            "withdrawal_risk",
            "intoxication_detected",
            "craving_detected",
            "ciwa_score",
        ]) {
            expect(output.toLowerCase()).not.toContain(forbidden);
        }
    });

    it("does not replay latest state when replay mode is none", async () => {
        const token = await issueToken();
        const hub = new InMemoryObjectiveClinicianStreamHub();

        hub.publish(createObjectiveSessionStatusStreamEvent(makeSession()));

        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?replay=none&token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: hub,
                assignmentLookup: makeMutableLookup({ active: true }),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).not.toContain('"event_type":"session.status"');
    });

    it("rejects unsupported replay modes", async () => {
        const token = await issueToken();
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?replay=everything&token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: new InMemoryObjectiveClinicianStreamHub(),
                assignmentLookup: makeMutableLookup({ active: true }),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("400 Bad Request");
        expect(socket.text()).toContain("objective_stream_invalid_replay_mode");
    });

    it("terminates live stream when clinician assignment is revoked", async () => {
        const token = await issueToken();
        const assignmentState = { active: true };
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const socket = new MockSocket();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(`/api/objective/sessions/session-1/stream?token=${token}`),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: hub,
                assignmentLookup: makeMutableLookup(assignmentState),
                assignmentRecheckIntervalMs: 0,
                auditLogger: logger,
            },
        );

        expect(handled).toBe(true);
        expect(hub.subscriberCount("session-1")).toBe(1);

        assignmentState.active = false;

        const closedCount = await hub.recheckSubscriptions();

        expect(closedCount).toBe(1);
        expect(hub.subscriberCount("session-1")).toBe(0);
        expect(socket.destroyed).toBe(true);
        expect(socket.text()).toContain("objective_stream_assignment_revoked");
        expect(socket.text()).toContain('"patient_visible":false');
        expect(socket.text()).toContain('"chatbot_visible":false');
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "stream_denied",
                session_id: "session-1",
                metadata: {
                    reason: "assignment_revoked_after_connect",
                },
            }),
        ]);
    });

    it("audits stream denial when assignment is inactive at connect time", async () => {
        const token = await issueToken();
        const socket = new MockSocket();
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(`/api/objective/sessions/session-1/stream?token=${token}`),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: new InMemoryObjectiveClinicianStreamHub(),
                assignmentLookup: makeMutableLookup({ active: false }),
                assignmentRecheckIntervalMs: 0,
                auditLogger: logger,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("403 Forbidden");
        expect(socket.text()).toContain("objective_stream_assignment_inactive");
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "stream_denied",
                session_id: "session-1",
                metadata: {
                    reason: "inactive_or_revoked_assignment",
                },
            }),
        ]);
    });

    it("keeps replay scoped by granted event scopes", async () => {
        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeMutableLookup({ active: true }),
            trace,
            secret,
            nowMs: Date.now(),
            ttlMs: 300_000,
            allowedEventScopes: ["heartbeat"],
        });

        if (!issued.allowed) {
            throw new Error("Expected stream token issuance to succeed");
        }

        const hub = new InMemoryObjectiveClinicianStreamHub();
        hub.publish(createObjectiveSessionStatusStreamEvent(makeSession()));
        hub.publish(createObjectiveHeartbeatStreamEvent("session-1"));

        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?replay=latest&token=${issued.value.token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: hub,
                assignmentLookup: makeMutableLookup({ active: true }),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).not.toContain('"event_type":"session.status"');
    });
});
