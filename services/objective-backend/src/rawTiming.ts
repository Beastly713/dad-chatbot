export const DEFAULT_OBJECTIVE_MAX_INTER_FRAME_GAP_MS = 1000;

export const OBJECTIVE_RAW_TIMING_QUALITY = [
    "good",
    "limited",
    "invalid",
] as const;

export type ObjectiveRawTimingQuality =
    (typeof OBJECTIVE_RAW_TIMING_QUALITY)[number];

export type ObjectiveTimedFrame = {
    esp_time_ms: number;
};

export type ObjectiveRawTimingWarning =
    | "no_accepted_frames"
    | "out_of_order_esp_time"
    | "duplicate_esp_time"
    | "large_timing_gap";

export type ObjectiveRawTimingAnalysis = {
    frame_count: number;
    first_esp_time_ms?: number;
    last_esp_time_ms?: number;
    duration_ms?: number;
    max_gap_ms?: number;
    gap_count: number;
    duplicate_esp_time_count: number;
    out_of_order_count: number;
    segment_boundary_count: number;
    timing_quality: ObjectiveRawTimingQuality;
    warnings: ObjectiveRawTimingWarning[];
};

export type ObjectiveFramePartition<T extends ObjectiveTimedFrame> = {
    partition_index: number;
    frames: T[];
    first_esp_time_ms: number;
    last_esp_time_ms: number;
};

function uniqueWarnings(
    warnings: ObjectiveRawTimingWarning[],
): ObjectiveRawTimingWarning[] {
    return [...new Set(warnings)];
}

function sortedByEspTime<T extends ObjectiveTimedFrame>(frames: readonly T[]): T[] {
    return [...frames].sort((left, right) => left.esp_time_ms - right.esp_time_ms);
}

export function analyzeObjectiveRawTiming<T extends ObjectiveTimedFrame>(
    frames: readonly T[],
    maxInterFrameGapMs = DEFAULT_OBJECTIVE_MAX_INTER_FRAME_GAP_MS,
): ObjectiveRawTimingAnalysis {
    if (frames.length === 0) {
        return {
            frame_count: 0,
            gap_count: 0,
            duplicate_esp_time_count: 0,
            out_of_order_count: 0,
            segment_boundary_count: 0,
            timing_quality: "invalid",
            warnings: ["no_accepted_frames"],
        };
    }

    const warnings: ObjectiveRawTimingWarning[] = [];
    let outOfOrderCount = 0;

    for (let index = 1; index < frames.length; index += 1) {
        const previous = frames[index - 1];
        const current = frames[index];

        if (current.esp_time_ms < previous.esp_time_ms) {
            outOfOrderCount += 1;
        }
    }

    if (outOfOrderCount > 0) {
        warnings.push("out_of_order_esp_time");
    }

    const seenEspTimes = new Set<number>();
    let duplicateEspTimeCount = 0;

    for (const frame of frames) {
        if (seenEspTimes.has(frame.esp_time_ms)) {
            duplicateEspTimeCount += 1;
            continue;
        }

        seenEspTimes.add(frame.esp_time_ms);
    }

    if (duplicateEspTimeCount > 0) {
        warnings.push("duplicate_esp_time");
    }

    const sortedFrames = sortedByEspTime(frames);
    const firstFrame = sortedFrames[0];
    const lastFrame = sortedFrames[sortedFrames.length - 1];

    let maxGapMs = 0;
    let gapCount = 0;

    for (let index = 1; index < sortedFrames.length; index += 1) {
        const previous = sortedFrames[index - 1];
        const current = sortedFrames[index];
        const gap = current.esp_time_ms - previous.esp_time_ms;

        if (gap > maxGapMs) {
            maxGapMs = gap;
        }

        if (gap > maxInterFrameGapMs) {
            gapCount += 1;
        }
    }

    if (gapCount > 0) {
        warnings.push("large_timing_gap");
    }

    const timingQuality: ObjectiveRawTimingQuality =
        warnings.length === 0 ? "good" : "limited";

    return {
        frame_count: frames.length,
        first_esp_time_ms: firstFrame.esp_time_ms,
        last_esp_time_ms: lastFrame.esp_time_ms,
        duration_ms: lastFrame.esp_time_ms - firstFrame.esp_time_ms,
        max_gap_ms: maxGapMs,
        gap_count: gapCount,
        duplicate_esp_time_count: duplicateEspTimeCount,
        out_of_order_count: outOfOrderCount,
        segment_boundary_count: gapCount,
        timing_quality: timingQuality,
        warnings: uniqueWarnings(warnings),
    };
}

export function partitionObjectiveFramesByTimingGaps<
    T extends ObjectiveTimedFrame,
>(
    frames: readonly T[],
    maxInterFrameGapMs = DEFAULT_OBJECTIVE_MAX_INTER_FRAME_GAP_MS,
): ObjectiveFramePartition<T>[] {
    const sortedFrames = sortedByEspTime(frames);

    if (sortedFrames.length === 0) {
        return [];
    }

    const partitions: ObjectiveFramePartition<T>[] = [];
    let currentFrames: T[] = [sortedFrames[0]];

    for (let index = 1; index < sortedFrames.length; index += 1) {
        const previous = sortedFrames[index - 1];
        const current = sortedFrames[index];
        const gap = current.esp_time_ms - previous.esp_time_ms;

        if (gap > maxInterFrameGapMs) {
            const first = currentFrames[0];
            const last = currentFrames[currentFrames.length - 1];

            partitions.push({
                partition_index: partitions.length,
                frames: currentFrames,
                first_esp_time_ms: first.esp_time_ms,
                last_esp_time_ms: last.esp_time_ms,
            });

            currentFrames = [current];
            continue;
        }

        currentFrames.push(current);
    }

    const first = currentFrames[0];
    const last = currentFrames[currentFrames.length - 1];

    partitions.push({
        partition_index: partitions.length,
        frames: currentFrames,
        first_esp_time_ms: first.esp_time_ms,
        last_esp_time_ms: last.esp_time_ms,
    });

    return partitions;
}
