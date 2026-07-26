import { EventEmitter } from "events";
import type { IncomingMessage } from "http";
import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";
import {
    createObjectiveChartSamplesStreamEvent,
    createObjectiveHeartbeatStreamEvent,
    createObjectiveQualityUpdateStreamEvent,
    createObjectiveSessionStatusStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
} from "../src/streamEvents.js";
import { handleObjectiveStreamUpgrade } from "../src/streamRoutes.js";
import { generateObjectiveStreamToken } from "../src/streamTokens.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const secret = "objective-stream-token-stage10-test-secret-32-chars";

const trace: ObjectiveTraceContext = {
    requestId: "request-stage10",
    traceId: "trace-stage10",
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

function makeMutableLookup(state: {
    active: boolean;
    assignmentId?: string;
}): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (!state.active) {
                return null;
            }

            return {
                assignmentId: state.assignmentId ?? "assignment-1",
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
            "x-request-id": "request-stage10",
            "x-trace-id": "trace-stage10",
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

async function issueToken(
    overrides: {
        patientId?: string;
        sessionId?: string;
        assignmentLookup?: ObjectiveAssignmentLookup;
        nowMs?: number;
        ttlMs?: number;
        allowedEventScopes?: Parameters<
            typeof generateObjectiveStreamToken
        >[0]["allowedEventScopes"];
    } = {},
): Promise<string> {
    const issued = await generateObjectiveStreamToken({
        actor: clinicianActor,
        patientId: overrides.patientId ?? "patient-1",
        sessionId: overrides.sessionId ?? "session-1",
        assignmentLookup:
            overrides.assignmentLookup ?? makeMutableLookup({ active: true }),
        trace,
        secret,
        nowMs: overrides.nowMs ?? Date.now(),
        ttlMs: overrides.ttlMs ?? 300_000,
        allowedEventScopes: overrides.allowedEventScopes,
    });

    if (!issued.allowed) {
        throw new Error(`Expected token issuance to succeed: ${issued.code}`);
    }

    return issued.value.token;
}

function expectNoStreamLeaks(output: string): void {
    const lower = output.toLowerCase();

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
        "developer_labels",
        "synthetic_ground_truth",
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
    ]) {
        expect(lower).not.toContain(forbidden);
    }
}

describe("Stage 10 objective WebSocket auth, filtering, and no-leak regressions", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("allows assigned clinicians to subscribe and receive clinician-only heartbeat", async () => {
        const token = await issueToken();
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
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
        expect(socket.text()).toContain("101 Switching Protocols");
        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).toContain('"clinician_visible":true');
        expect(socket.text()).toContain('"patient_visible":false');
        expect(socket.text()).toContain('"chatbot_visible":false');
        expect(hub.subscriberCount("session-1")).toBe(1);
        expectNoStreamLeaks(socket.text());
    });

    it("denies patient and chatbot subscribe attempts even when a token is present", async () => {
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
                {
                    streamTokenSecret: secret,
                    streamHub: new InMemoryObjectiveClinicianStreamHub(),
                    assignmentLookup: makeMutableLookup({ active: true }),
                    assignmentRecheckIntervalMs: 0,
                },
            );

            expect(handled).toBe(true);
            expect(socket.text()).toContain("403 Forbidden");
            expect(socket.text()).toContain("objective_stream_role_denied");
            expect(socket.text()).not.toContain("101 Switching Protocols");
            expectNoStreamLeaks(socket.text());
        }
    });

    it("denies unassigned clinicians at token issuance and at stream connection", async () => {
        const unassignedIssue = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: "patient-1",
            sessionId: "session-1",
            assignmentLookup: makeMutableLookup({ active: false }),
            trace,
            secret,
            nowMs: 1000,
        });

        expect(unassignedIssue.allowed).toBe(false);

        if (unassignedIssue.allowed) {
            throw new Error("Expected unassigned token issuance to be denied");
        }

        expect(unassignedIssue.code).toBe("objective_assignment_required");

        const staleToken = await issueToken({
            assignmentLookup: makeMutableLookup({ active: true }),
        });
        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${staleToken}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: new InMemoryObjectiveClinicianStreamHub(),
                assignmentLookup: makeMutableLookup({ active: false }),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(handled).toBe(true);
        expect(socket.text()).toContain("403 Forbidden");
        expect(socket.text()).toContain("objective_stream_assignment_inactive");
        expect(socket.text()).not.toContain("101 Switching Protocols");
        expectNoStreamLeaks(socket.text());
    });

    it("denies expired stream tokens", async () => {
        const token = await issueToken({
            nowMs: 1000,
            ttlMs: 1000,
        });

        jest.spyOn(Date, "now").mockReturnValue(3001);

        const socket = new MockSocket();

        const handled = await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
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
        expect(socket.text()).toContain("401 Unauthorized");
        expect(socket.text()).toContain("objective_stream_token_expired");
        expect(socket.text()).not.toContain("101 Switching Protocols");
        expectNoStreamLeaks(socket.text());
    });

    it("filters live events by token allowed_event_scopes", async () => {
        const token = await issueToken({
            allowedEventScopes: ["heartbeat"],
        });
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const socket = new MockSocket();

        await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
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

        const statusDelivered = hub.publish(
            createObjectiveSessionStatusStreamEvent(makeSession()),
        );
        const heartbeatDelivered = hub.publish(
            createObjectiveHeartbeatStreamEvent("session-1"),
        );

        expect(statusDelivered).toBe(0);
        expect(heartbeatDelivered).toBe(1);
        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).not.toContain('"event_type":"session.status"');
        expectNoStreamLeaks(socket.text());
    });

    it("filters replay events by token allowed_event_scopes", async () => {
        const token = await issueToken({
            allowedEventScopes: ["heartbeat"],
        });
        const hub = new InMemoryObjectiveClinicianStreamHub();

        hub.publish(createObjectiveSessionStatusStreamEvent(makeSession()));
        hub.publish(createObjectiveHeartbeatStreamEvent("session-1"));

        const socket = new MockSocket();

        await handleObjectiveStreamUpgrade(
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

        expect(socket.text()).toContain('"event_type":"heartbeat"');
        expect(socket.text()).not.toContain('"event_type":"session.status"');
        expectNoStreamLeaks(socket.text());
    });

    it("blocks developer-only and synthetic fields from stream events", () => {
        expect(() =>
            createObjectiveQualityUpdateStreamEvent("session-1", {
                developer_labels: ["internal-debug-only"],
            } as never),
        ).toThrow();

        expect(() =>
            createObjectiveQualityUpdateStreamEvent("session-1", {
                synthetic_ground_truth: {
                    scenario: "debug-only",
                },
            } as never),
        ).toThrow();
    });

    it("keeps chart stream output free of raw sensor field names and clinical-risk labels", () => {
        const event = createObjectiveChartSamplesStreamEvent("session-1", [
            {
                t_ms: 1000,
                relative_time_ms: 0,
                values: {
                    heart_activity_trend: 0.2,
                    skin_conductance_trend: 0.1,
                    ppg_pulse_trend: 0.12,
                    motion_confound_index: 0.05,
                    local_temperature_trend: 0.01,
                },
                quality: {
                    overall: "usable",
                },
            },
        ]);

        const serialized = JSON.stringify(event);

        expect(serialized).toContain("heart_activity_trend");
        expect(serialized).toContain("skin_conductance_trend");
        expect(serialized).toContain("motion_confound_index");
        expect(serialized).toContain('"clinician_visible":true');
        expect(serialized).toContain('"patient_visible":false');
        expect(serialized).toContain('"chatbot_visible":false');
        expectNoStreamLeaks(serialized);
    });

    it("closes active stream when assignment is revoked after subscription", async () => {
        const assignmentState = { active: true };
        const token = await issueToken({
            assignmentLookup: makeMutableLookup(assignmentState),
        });
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const socket = new MockSocket();

        await handleObjectiveStreamUpgrade(
            makeUpgradeRequest(
                `/api/objective/sessions/session-1/stream?token=${token}`,
            ),
            socket as never,
            Buffer.alloc(0),
            {
                streamTokenSecret: secret,
                streamHub: hub,
                assignmentLookup: makeMutableLookup(assignmentState),
                assignmentRecheckIntervalMs: 0,
            },
        );

        expect(hub.subscriberCount("session-1")).toBe(1);

        assignmentState.active = false;

        const closedCount = await hub.recheckSubscriptions();

        expect(closedCount).toBe(1);
        expect(hub.subscriberCount("session-1")).toBe(0);
        expect(socket.destroyed).toBe(true);
        expect(socket.text()).toContain("objective_stream_assignment_revoked");
        expect(socket.text()).toContain('"patient_visible":false');
        expect(socket.text()).toContain('"chatbot_visible":false');
        expectNoStreamLeaks(socket.text());
    });
});
