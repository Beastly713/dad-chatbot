import {
    calculateObjectiveSessionDurationMs,
    createObjectiveSessionHistoryRepositoryFromSessions,
    formatObjectiveDuration,
    serializeObjectiveSessionHistoryDetail,
    serializeObjectiveSessionHistoryListItem,
} from "../src/sessionHistory.js";
import { InMemoryObjectiveSessionRepository } from "../src/sessionLifecycle.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";

function makeSession(
    overrides: Partial<ObjectiveSessionRecord> = {},
): ObjectiveSessionRecord {
    return {
        session_id: "session-1",
        patient_id: "patient-1",
        source_type: "simulator",
        status: "stopped",
        created_at: "2026-06-02T10:00:00.000Z",
        started_at: "2026-06-02T10:00:10.000Z",
        stopped_at: "2026-06-02T10:02:15.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
        ...overrides,
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
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("objective session history serializers", () => {
    it("calculates and formats session duration", () => {
        const session = makeSession();

        expect(calculateObjectiveSessionDurationMs(session)).toBe(125_000);
        expect(formatObjectiveDuration(125_000)).toBe("2m 5s");
        expect(formatObjectiveDuration(42_000)).toBe("42s");
        expect(formatObjectiveDuration(null)).toBe("Duration unavailable");
    });

    it("uses active session time only when the session is still active", () => {
        const session = makeSession({
            status: "active",
            started_at: "2026-06-02T10:00:00.000Z",
            stopped_at: undefined,
            paused_at: undefined,
        });

        expect(
            calculateObjectiveSessionDurationMs(
                session,
                () => new Date("2026-06-02T10:03:00.000Z"),
            ),
        ).toBe(180_000);
    });

    it("serializes safe session list item", () => {
        const item = serializeObjectiveSessionHistoryListItem(makeSession());

        expect(item.session_id).toBe("session-1");
        expect(item.patient_id).toBe("patient-1");
        expect(item.source_type).toBe("simulator");
        expect(item.source_banner).toBe("simulated_data");
        expect(item.status).toBe("stopped");
        expect(item.duration_ms).toBe(125_000);
        expect(item.duration_label).toBe("2m 5s");
        expect(item.safe_summary.label).toBe("Session stopped");
        expect(item.quality_summary.label).toBe("Quality summary pending");
        expect(item.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });

        expectNoUnsafeHistoryOutput(item);
    });

    it("maps source banners without replay payloads", () => {
        expect(
            serializeObjectiveSessionHistoryListItem(
                makeSession({ source_type: "public_dataset_replay" }),
            ).source_banner,
        ).toBe("public_dataset_replay");
        expect(
            serializeObjectiveSessionHistoryListItem(
                makeSession({ source_type: "prototype_hardware" }),
            ).source_banner,
        ).toBe("prototype_hardware");
    });

    it("serializes safe session detail", () => {
        const detail = serializeObjectiveSessionHistoryDetail(
            makeSession({
                device_id: "device-1",
                device_boot_id: "boot-1",
            }),
        );

        expect(detail.device_id).toBe("device-1");
        expect(detail.device_boot_id).toBe("boot-1");
        expect(detail.history_scope_note).toContain(
            "clinician-safe session metadata",
        );
        expect(detail).not.toHaveProperty("samples");
        expect(detail).not.toHaveProperty("feature_windows");
        expect(detail).not.toHaveProperty("timeline");
        expectNoUnsafeHistoryOutput(detail);
    });

    it("adapts session repository list support safely", async () => {
        const session = makeSession();
        const repo = createObjectiveSessionHistoryRepositoryFromSessions({
            async createSession() {
                return session;
            },
            async getSession() {
                return session;
            },
            async updateSessionStatus() {
                return session;
            },
            async listSessionsForPatient() {
                return [session];
            },
        });

        await expect(repo.listSessionsForPatient("patient-1")).resolves.toHaveLength(
            1,
        );
    });

    it("falls back to an empty list when repository cannot list", async () => {
        const session = makeSession();
        const repo = createObjectiveSessionHistoryRepositoryFromSessions({
            async createSession() {
                return session;
            },
            async getSession() {
                return session;
            },
            async updateSessionStatus() {
                return session;
            },
        });

        await expect(repo.listSessionsForPatient("patient-1")).resolves.toEqual([]);
    });

    it("lists in-memory patient sessions newest first", async () => {
        let now = new Date("2026-06-02T10:00:00.000Z");
        const repository = new InMemoryObjectiveSessionRepository(() => now);
        const older = await repository.createSession({
            patient_id: "patient-1",
            source_type: "simulator",
        });
        now = new Date("2026-06-02T10:01:00.000Z");
        const newer = await repository.createSession({
            patient_id: "patient-1",
            source_type: "simulator",
        });
        await repository.createSession({
            patient_id: "patient-2",
            source_type: "simulator",
        });
        await repository.updateSessionStatus(older.session_id, "stopped", {
            stopped_at: "2026-06-02T10:00:30.000Z",
        });
        await repository.updateSessionStatus(newer.session_id, "stopped", {
            stopped_at: "2026-06-02T10:01:30.000Z",
        });

        const listed = await repository.listSessionsForPatient("patient-1");

        expect(listed.map((session) => session.session_id)).toEqual([
            newer.session_id,
            older.session_id,
        ]);
    });
});
