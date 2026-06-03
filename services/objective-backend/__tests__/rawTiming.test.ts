import {
    analyzeObjectiveRawTiming,
    partitionObjectiveFramesByTimingGaps,
} from "../src/rawTiming.js";

describe("objective raw timing analysis", () => {
    it("marks continuous monotonic frames as good timing quality", () => {
        const analysis = analyzeObjectiveRawTiming([
            { esp_time_ms: 1000 },
            { esp_time_ms: 1005 },
            { esp_time_ms: 1010 },
        ]);

        expect(analysis).toEqual({
            frame_count: 3,
            first_esp_time_ms: 1000,
            last_esp_time_ms: 1010,
            duration_ms: 10,
            max_gap_ms: 5,
            gap_count: 0,
            duplicate_esp_time_count: 0,
            out_of_order_count: 0,
            segment_boundary_count: 0,
            timing_quality: "good",
            warnings: [],
        });
    });

    it("detects out-of-order ESP timing", () => {
        const analysis = analyzeObjectiveRawTiming([
            { esp_time_ms: 1010 },
            { esp_time_ms: 1000 },
            { esp_time_ms: 1005 },
        ]);

        expect(analysis.timing_quality).toBe("limited");
        expect(analysis.out_of_order_count).toBe(1);
        expect(analysis.warnings).toContain("out_of_order_esp_time");
        expect(analysis.first_esp_time_ms).toBe(1000);
        expect(analysis.last_esp_time_ms).toBe(1010);
    });

    it("detects duplicate ESP timestamps", () => {
        const analysis = analyzeObjectiveRawTiming([
            { esp_time_ms: 1000 },
            { esp_time_ms: 1000 },
            { esp_time_ms: 1005 },
        ]);

        expect(analysis.timing_quality).toBe("limited");
        expect(analysis.duplicate_esp_time_count).toBe(1);
        expect(analysis.warnings).toContain("duplicate_esp_time");
    });

    it("detects large timing gaps", () => {
        const analysis = analyzeObjectiveRawTiming([
            { esp_time_ms: 1000 },
            { esp_time_ms: 1005 },
            { esp_time_ms: 5000 },
        ]);

        expect(analysis.timing_quality).toBe("limited");
        expect(analysis.gap_count).toBe(1);
        expect(analysis.segment_boundary_count).toBe(1);
        expect(analysis.max_gap_ms).toBe(3995);
        expect(analysis.warnings).toContain("large_timing_gap");
    });

    it("marks empty accepted frame sets as invalid", () => {
        const analysis = analyzeObjectiveRawTiming([]);

        expect(analysis).toEqual({
            frame_count: 0,
            gap_count: 0,
            duplicate_esp_time_count: 0,
            out_of_order_count: 0,
            segment_boundary_count: 0,
            timing_quality: "invalid",
            warnings: ["no_accepted_frames"],
        });
    });

    it("partitions frames across large timing gaps", () => {
        const partitions = partitionObjectiveFramesByTimingGaps([
            { esp_time_ms: 1000, value: "a" },
            { esp_time_ms: 1005, value: "b" },
            { esp_time_ms: 5000, value: "c" },
            { esp_time_ms: 5005, value: "d" },
        ]);

        expect(partitions).toEqual([
            {
                partition_index: 0,
                first_esp_time_ms: 1000,
                last_esp_time_ms: 1005,
                frames: [
                    { esp_time_ms: 1000, value: "a" },
                    { esp_time_ms: 1005, value: "b" },
                ],
            },
            {
                partition_index: 1,
                first_esp_time_ms: 5000,
                last_esp_time_ms: 5005,
                frames: [
                    { esp_time_ms: 5000, value: "c" },
                    { esp_time_ms: 5005, value: "d" },
                ],
            },
        ]);
    });

    it("sorts frames before partitioning", () => {
        const partitions = partitionObjectiveFramesByTimingGaps([
            { esp_time_ms: 5005 },
            { esp_time_ms: 1000 },
            { esp_time_ms: 5000 },
            { esp_time_ms: 1005 },
        ]);

        expect(partitions).toHaveLength(2);
        expect(partitions[0].first_esp_time_ms).toBe(1000);
        expect(partitions[0].last_esp_time_ms).toBe(1005);
        expect(partitions[1].first_esp_time_ms).toBe(5000);
        expect(partitions[1].last_esp_time_ms).toBe(5005);
    });
});
