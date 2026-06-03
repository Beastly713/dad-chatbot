import { randomUUID } from "crypto";

export const OBJECTIVE_SEGMENT_REASONS = [
    "session_start",
    "manual_segment",
    "device_reset",
    "timing_gap",
    "source_change",
] as const;

export type ObjectiveSegmentReason =
    (typeof OBJECTIVE_SEGMENT_REASONS)[number];

export type ObjectiveSegmentRecord = {
    segment_id: string;
    session_id: string;
    device_boot_id: string;
    reason: ObjectiveSegmentReason;
    start_esp_time_ms: number;
    end_esp_time_ms?: number;
    created_at: string;
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveSegmentBoundaryInput = {
    sessionId: string;
    deviceBootId: string;
    firstEspTimeMs: number;
    lastEspTimeMs: number;
    reason: ObjectiveSegmentReason;
};

export type ObjectiveSegmentManager = {
    assignSegment(
        input: ObjectiveSegmentBoundaryInput,
    ): Promise<ObjectiveSegmentRecord>;
    getCurrentSegment(sessionId: string): Promise<ObjectiveSegmentRecord | null>;
    listSegmentsForSession(sessionId: string): Promise<ObjectiveSegmentRecord[]>;
};

function visibility() {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    } as const;
}

export class InMemoryObjectiveSegmentManager
    implements ObjectiveSegmentManager
{
    private readonly segmentsBySession = new Map<string, ObjectiveSegmentRecord[]>();

    constructor(private readonly now: () => Date = () => new Date()) {}

    async assignSegment(
        input: ObjectiveSegmentBoundaryInput,
    ): Promise<ObjectiveSegmentRecord> {
        const existing = this.segmentsBySession.get(input.sessionId) ?? [];
        const current = existing[existing.length - 1] ?? null;

        const shouldReuseCurrent =
            current !== null &&
            current.device_boot_id === input.deviceBootId &&
            current.reason !== "device_reset" &&
            input.reason !== "timing_gap" &&
            input.reason !== "device_reset";

        if (shouldReuseCurrent) {
            const updated: ObjectiveSegmentRecord = {
                ...current,
                end_esp_time_ms: Math.max(
                    current.end_esp_time_ms ?? current.start_esp_time_ms,
                    input.lastEspTimeMs,
                ),
            };

            existing[existing.length - 1] = updated;
            this.segmentsBySession.set(input.sessionId, existing);
            return updated;
        }

        const segment: ObjectiveSegmentRecord = {
            segment_id: `segment:${randomUUID()}`,
            session_id: input.sessionId,
            device_boot_id: input.deviceBootId,
            reason: existing.length === 0 ? "session_start" : input.reason,
            start_esp_time_ms: input.firstEspTimeMs,
            end_esp_time_ms: input.lastEspTimeMs,
            created_at: this.now().toISOString(),
            ...visibility(),
        };

        this.segmentsBySession.set(input.sessionId, [...existing, segment]);
        return segment;
    }

    async getCurrentSegment(
        sessionId: string,
    ): Promise<ObjectiveSegmentRecord | null> {
        const existing = this.segmentsBySession.get(sessionId) ?? [];
        return existing[existing.length - 1] ?? null;
    }

    async listSegmentsForSession(
        sessionId: string,
    ): Promise<ObjectiveSegmentRecord[]> {
        return [...(this.segmentsBySession.get(sessionId) ?? [])];
    }

    clear(): void {
        this.segmentsBySession.clear();
    }
}

export function inferSegmentReason(
    currentSegment: ObjectiveSegmentRecord | null,
    nextDeviceBootId: string,
    partitionIndex: number,
): ObjectiveSegmentReason {
    if (!currentSegment) {
        return "session_start";
    }

    if (currentSegment.device_boot_id !== nextDeviceBootId) {
        return "device_reset";
    }

    if (partitionIndex > 0) {
        return "timing_gap";
    }

    return "manual_segment";
}
