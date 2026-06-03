import {
  assertObjectiveRawBatch,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope
} from "@dad-chatbot/objective-schemas";
import { objectiveRawCsvToBatches } from "./csv.js";
import { generateObjectiveRawFrameEnvelopes } from "./rawGenerators.js";
import { generateObjectiveScenarioTimeline } from "./timeline.js";

export type ObjectiveSimulatorStreamScenarioOptions = {
  scenario_id: string;
  seed: number;
  duration_ms: number;
  sample_interval_ms: number;
  batch_size_frames: number;
  session_id: string;
  device_id: string;
  device_boot_id: string;
  segment_id?: string;
  start_esp_time_ms?: number;
  start_pc_timestamp?: string;
  batch_id_prefix?: string;
};

export type ObjectiveSimulatorHttpStreamOptions = {
  backend_url: string;
  ingest_path?: string;
  service_actor_id: string;
  request_timeout_ms?: number;
  delay_between_batches_ms?: number;
  dry_run?: boolean;
  fetch_impl?: typeof fetch;
  on_batch?: (event: ObjectiveSimulatorBatchEvent) => void | Promise<void>;
};

export type ObjectiveSimulatorBatchEvent = {
  batch_id: string;
  batch_index: number;
  frame_count: number;
  status: "prepared" | "sent" | "dry_run";
  http_status?: number;
};

export type ObjectiveSimulatorStreamResult = {
  prepared_batches: number;
  sent_batches: number;
  dry_run: boolean;
  endpoint_url: string;
};

function assertNonEmptyString(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function assertNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return value;
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function normalizeBackendUrl(backendUrl: string, ingestPath: string): string {
  const base = backendUrl.replace(/\/+$/, "");
  const path = ingestPath.startsWith("/") ? ingestPath : `/${ingestPath}`;

  return `${base}${path}`;
}

function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createObjectiveSimulatorBatchesFromFrames(
  frames: readonly ObjectiveRawFrameEnvelope[],
  options: {
    batch_id_prefix: string;
    session_id: string;
    device_id: string;
    device_boot_id: string;
    segment_id?: string;
    batch_size_frames: number;
  }
): ObjectiveRawBatch[] {
  assertNonEmptyString(options.batch_id_prefix, "batch_id_prefix");
  assertNonEmptyString(options.session_id, "session_id");
  assertNonEmptyString(options.device_id, "device_id");
  assertNonEmptyString(options.device_boot_id, "device_boot_id");
  assertPositiveInteger(options.batch_size_frames, "batch_size_frames");

  return chunkArray(frames, options.batch_size_frames).map((chunk, index) => {
    const batch: ObjectiveRawBatch = {
      batch_id: `${options.batch_id_prefix}-${index + 1}`,
      session_id: options.session_id,
      source_type: "simulator",
      schema_version: chunk[0].schema_version,
      device_id: options.device_id,
      device_boot_id: options.device_boot_id,
      ...(options.segment_id ? { segment_id: options.segment_id } : {}),
      frames: chunk
    };

    return assertObjectiveRawBatch(batch);
  });
}

export function createObjectiveSimulatorScenarioBatches(
  options: ObjectiveSimulatorStreamScenarioOptions
): ObjectiveRawBatch[] {
  assertNonNegativeInteger(options.seed, "seed");
  assertPositiveInteger(options.duration_ms, "duration_ms");
  assertPositiveInteger(options.sample_interval_ms, "sample_interval_ms");
  assertPositiveInteger(options.batch_size_frames, "batch_size_frames");

  const timeline = generateObjectiveScenarioTimeline({
    scenario_id: options.scenario_id,
    seed: options.seed,
    duration_ms: options.duration_ms,
    start_esp_time_ms: options.start_esp_time_ms ?? 0
  });

  const frames = generateObjectiveRawFrameEnvelopes({
    timeline,
    session_id: options.session_id,
    device_id: options.device_id,
    device_boot_id: options.device_boot_id,
    ...(options.segment_id ? { segment_id: options.segment_id } : {}),
    sample_interval_ms: options.sample_interval_ms,
    ...(options.start_pc_timestamp
      ? { start_pc_timestamp: options.start_pc_timestamp }
      : {})
  });

  return createObjectiveSimulatorBatchesFromFrames(frames, {
    batch_id_prefix:
      options.batch_id_prefix ??
      `sim-${options.scenario_id}-${options.seed}-${Date.now()}`,
    session_id: options.session_id,
    device_id: options.device_id,
    device_boot_id: options.device_boot_id,
    ...(options.segment_id ? { segment_id: options.segment_id } : {}),
    batch_size_frames: options.batch_size_frames
  });
}

export function createObjectiveSimulatorBatchesFromCsv(
  csvText: string,
  options: {
    batch_id_prefix: string;
    session_id: string;
    device_id: string;
    device_boot_id: string;
    segment_id?: string;
    batch_size_frames: number;
  }
): ObjectiveRawBatch[] {
  return objectiveRawCsvToBatches(csvText, options);
}

export async function streamObjectiveSimulatorBatches(
  batches: readonly ObjectiveRawBatch[],
  options: ObjectiveSimulatorHttpStreamOptions
): Promise<ObjectiveSimulatorStreamResult> {
  assertNonEmptyString(options.backend_url, "backend_url");
  assertNonEmptyString(options.service_actor_id, "service_actor_id");

  const ingestPath = options.ingest_path ?? "/api/objective/ingest/batch";
  const endpointUrl = normalizeBackendUrl(options.backend_url, ingestPath);
  const dryRun = options.dry_run ?? false;
  const fetchImpl = options.fetch_impl ?? globalThis.fetch;

  if (!dryRun && !fetchImpl) {
    throw new Error("fetch is not available; pass fetch_impl or use Node 20+");
  }

  let sentBatches = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = assertObjectiveRawBatch(batches[index]);

    await options.on_batch?.({
      batch_id: batch.batch_id,
      batch_index: index,
      frame_count: batch.frames.length,
      status: dryRun ? "dry_run" : "prepared"
    });

    if (dryRun) {
      continue;
    }

    const controller = new AbortController();
    const timeoutMs = options.request_timeout_ms ?? 10000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(endpointUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-objective-role": "service",
          "x-objective-actor-id": options.service_actor_id
        },
        body: JSON.stringify(batch),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Objective simulator batch ${batch.batch_id} was rejected with HTTP ${response.status}: ${body}`
        );
      }

      sentBatches += 1;

      await options.on_batch?.({
        batch_id: batch.batch_id,
        batch_index: index,
        frame_count: batch.frames.length,
        status: "sent",
        http_status: response.status
      });
    } finally {
      clearTimeout(timeout);
    }

    await sleep(options.delay_between_batches_ms ?? 0);
  }

  return {
    prepared_batches: batches.length,
    sent_batches: sentBatches,
    dry_run: dryRun,
    endpoint_url: endpointUrl
  };
}
