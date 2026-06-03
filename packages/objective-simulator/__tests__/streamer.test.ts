import type { ObjectiveRawBatch } from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  createObjectiveSimulatorBatchesFromCsv,
  createObjectiveSimulatorScenarioBatches,
  streamObjectiveSimulatorBatches
} from "../src/index.js";

describe("objective simulator live REST streamer", () => {
  it("creates scenario batches with configurable seed scenario and duration", () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 5,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    expect(batches).toHaveLength(2);
    expect(batches[0].batch_id).toBe("batch-1");
    expect(batches[0].frames).toHaveLength(5);
    expect(batches[1].batch_id).toBe("batch-2");
    expect(batches[1].frames).toHaveLength(5);
  });

  it("posts batches to the canonical service-only ingestion endpoint", async () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 10,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = jest.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });

        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }
    );

    const result = await streamObjectiveSimulatorBatches(batches, {
      backend_url: "http://localhost:4310",
      service_actor_id: "objective-simulator-local",
      fetch_impl: fetchMock
    });

    expect(result).toEqual({
      prepared_batches: 1,
      sent_batches: 1,
      dry_run: false,
      endpoint_url: "http://localhost:4310/api/objective/ingest/batch"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe("http://localhost:4310/api/objective/ingest/batch");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      "content-type": "application/json",
      "x-objective-role": "service",
      "x-objective-actor-id": "objective-simulator-local"
    });

    const postedBatch = JSON.parse(String(calls[0].init.body)) as ObjectiveRawBatch;
    expect(postedBatch.source_type).toBe("simulator");
    expect(postedBatch.session_id).toBe("session-1");
  });

  it("supports dry-run mode without network calls", async () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "sensor_dropout",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 5,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const fetchMock = jest.fn();

    const result = await streamObjectiveSimulatorBatches(batches, {
      backend_url: "http://localhost:4310",
      service_actor_id: "objective-simulator-local",
      dry_run: true,
      fetch_impl: fetchMock as never
    });

    expect(result.prepared_batches).toBe(2);
    expect(result.sent_batches).toBe(0);
    expect(result.dry_run).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates replay batches from CSV-like data", () => {
    const csv = [
      "pc_timestamp,esp_time_ms,ecg_raw,gsr_raw",
      "2026-05-30T13:56:10.124Z,15040,2900,2405",
      "2026-05-30T13:56:10.224Z,15140,2800,2410"
    ].join("\n");

    const batches = createObjectiveSimulatorBatchesFromCsv(csv, {
      batch_id_prefix: "csv-replay",
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_size_frames: 1
    });

    expect(batches).toHaveLength(2);
    expect(batches[0].batch_id).toBe("csv-replay-1");
    expect(batches[1].batch_id).toBe("csv-replay-2");
    expect(batches[0].source_type).toBe("simulator");
  });

  it("surfaces backend rejection safely without exposing raw values in the error message", async () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 10,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ code: "objective_session_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    });

    await expect(
      streamObjectiveSimulatorBatches(batches, {
        backend_url: "http://localhost:4310",
        service_actor_id: "objective-simulator-local",
        fetch_impl: fetchMock
      })
    ).rejects.toThrow("Objective simulator batch batch-1 was rejected with HTTP 404");

    await expect(
      streamObjectiveSimulatorBatches(batches, {
        backend_url: "http://localhost:4310",
        service_actor_id: "",
        fetch_impl: fetchMock
      })
    ).rejects.toThrow("service_actor_id must be a non-empty string");
  });

  it("does not emit forbidden labels or clinical claims in streaming helpers", () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "device_reset_or_timing_gap",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 10,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const serialized = JSON.stringify({
      batchShape: batches.map((batch) => ({
        batch_id: batch.batch_id,
        source_type: batch.source_type,
        schema_version: batch.schema_version,
        frame_count: batch.frames.length
      }))
    });

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("risk_score");
    expect(serialized).not.toContain("ground_truth");

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/streamer.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });
});
