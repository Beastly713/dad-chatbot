import {
    inferSegmentReason,
    InMemoryObjectiveSegmentManager,
} from "../src/segmentManager.js";

describe("objective segment manager", () => {
    it("creates a session_start segment for the first session partition", async () => {
        const manager = new InMemoryObjectiveSegmentManager(
            () => new Date("2026-06-02T10:00:00.000Z"),
        );

        const segment = await manager.assignSegment({
            sessionId: "session-1",
            deviceBootId: "boot-1",
            firstEspTimeMs: 1000,
            lastEspTimeMs: 1010,
            reason: "manual_segment",
        });

        expect(segment).toEqual(
            expect.objectContaining({
                session_id: "session-1",
                device_boot_id: "boot-1",
                reason: "session_start",
                start_esp_time_ms: 1000,
                end_esp_time_ms: 1010,
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );
    });

    it("creates a timing_gap segment for later partition boundaries", async () => {
        const manager = new InMemoryObjectiveSegmentManager();

        await manager.assignSegment({
            sessionId: "session-1",
            deviceBootId: "boot-1",
            firstEspTimeMs: 1000,
            lastEspTimeMs: 1010,
            reason: "session_start",
        });

        const segment = await manager.assignSegment({
            sessionId: "session-1",
            deviceBootId: "boot-1",
            firstEspTimeMs: 5000,
            lastEspTimeMs: 5010,
            reason: "timing_gap",
        });

        expect(segment.reason).toBe("timing_gap");
        expect(await manager.listSegmentsForSession("session-1")).toHaveLength(2);
    });

    it("creates a device_reset segment when device boot changes", async () => {
        const manager = new InMemoryObjectiveSegmentManager();

        await manager.assignSegment({
            sessionId: "session-1",
            deviceBootId: "boot-1",
            firstEspTimeMs: 1000,
            lastEspTimeMs: 1010,
            reason: "session_start",
        });

        const segment = await manager.assignSegment({
            sessionId: "session-1",
            deviceBootId: "boot-2",
            firstEspTimeMs: 0,
            lastEspTimeMs: 10,
            reason: "device_reset",
        });

        expect(segment.reason).toBe("device_reset");
        expect(segment.device_boot_id).toBe("boot-2");
    });

    it("infers segment reasons from current state", () => {
        expect(inferSegmentReason(null, "boot-1", 0)).toBe("session_start");

        expect(
            inferSegmentReason(
                {
                    segment_id: "segment-1",
                    session_id: "session-1",
                    device_boot_id: "boot-1",
                    reason: "session_start",
                    start_esp_time_ms: 1000,
                    end_esp_time_ms: 1010,
                    created_at: "2026-06-02T10:00:00.000Z",
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
                "boot-2",
                0,
            ),
        ).toBe("device_reset");

        expect(
            inferSegmentReason(
                {
                    segment_id: "segment-1",
                    session_id: "session-1",
                    device_boot_id: "boot-1",
                    reason: "session_start",
                    start_esp_time_ms: 1000,
                    end_esp_time_ms: 1010,
                    created_at: "2026-06-02T10:00:00.000Z",
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
                "boot-1",
                1,
            ),
        ).toBe("timing_gap");
    });
});
