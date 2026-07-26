#!/usr/bin/env node
import fs from "fs/promises";
import process from "process";
import { objectiveRawBatchesToCsv } from "./csv.js";
import {
  createObjectiveSimulatorBatchesFromCsv,
  createObjectiveSimulatorScenarioBatches,
  streamObjectiveSimulatorBatches
} from "./streamer.js";

type CliArgs = Record<string, string | boolean>;

function printUsage(): void {
  console.log(`
Objective simulator CLI

Commands:
  export-csv   Generate simulator rows and write CSV.
  stream       Generate simulator batches and POST to objective ingestion.
  replay-csv   Read CSV rows and POST as simulator raw batches.

Examples:
  node dist/src/cli.js export-csv \\
    --scenario baseline_rest \\
    --seed 42 \\
    --duration-ms 1000 \\
    --sample-interval-ms 100 \\
    --batch-size-frames 10 \\
    --session-id session-1 \\
    --device-id device-1 \\
    --device-boot-id boot-1 \\
    --out /tmp/objective-sim.csv

  node dist/src/cli.js stream \\
    --backend-url http://localhost:4310 \\
    --scenario elevated_arousal_pattern \\
    --seed 42 \\
    --duration-ms 10000 \\
    --sample-interval-ms 100 \\
    --batch-size-frames 25 \\
    --session-id session-1 \\
    --device-id device-1 \\
    --device-boot-id boot-1 \\
    --service-actor-id objective-simulator-local

  node dist/src/cli.js replay-csv \\
    --backend-url http://localhost:4310 \\
    --csv /tmp/objective-sim.csv \\
    --batch-size-frames 25 \\
    --session-id session-1 \\
    --device-id device-1 \\
    --device-boot-id boot-1 \\
    --service-actor-id objective-simulator-local
`);
}

function parseArgs(argv: readonly string[]): { command: string; args: CliArgs } {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    return { command: "help", args: {} };
  }

  const args: CliArgs = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2).replaceAll("-", "_");
    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return { command, args };
}

function getString(args: CliArgs, key: string, fallback?: string): string {
  const value = args[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required option --${key.replaceAll("_", "-")}`);
}

function getOptionalString(args: CliArgs, key: string): string | undefined {
  const value = args[key];

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getNumber(args: CliArgs, key: string, fallback?: number): number {
  const value = args[key];

  if (typeof value !== "string") {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Missing required option --${key.replaceAll("_", "-")}`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Option --${key.replaceAll("_", "-")} must be numeric`);
  }

  return parsed;
}

function getBoolean(args: CliArgs, key: string): boolean {
  return args[key] === true || args[key] === "true";
}

function buildScenarioBatches(args: CliArgs) {
  return createObjectiveSimulatorScenarioBatches({
    scenario_id: getString(args, "scenario", "baseline_rest"),
    seed: getNumber(args, "seed", 1),
    duration_ms: getNumber(args, "duration_ms", 60000),
    sample_interval_ms: getNumber(args, "sample_interval_ms", 100),
    batch_size_frames: getNumber(args, "batch_size_frames", 50),
    session_id: getString(args, "session_id"),
    device_id: getString(args, "device_id"),
    device_boot_id: getString(args, "device_boot_id"),
    segment_id: getOptionalString(args, "segment_id"),
    start_esp_time_ms: getNumber(args, "start_esp_time_ms", 0),
    start_pc_timestamp: getOptionalString(args, "start_pc_timestamp"),
    batch_id_prefix: getOptionalString(args, "batch_id_prefix")
  });
}

async function handleExportCsv(args: CliArgs): Promise<void> {
  const outPath = getString(args, "out");
  const batches = buildScenarioBatches(args);
  const csv = objectiveRawBatchesToCsv(batches);

  await fs.writeFile(outPath, csv, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "export-csv",
        out: outPath,
        batches: batches.length,
        frames: batches.reduce((sum, batch) => sum + batch.frames.length, 0),
        source_type: "simulator",
        engineering_only: true,
        clinical_validation_claim: false
      },
      null,
      2
    )
  );
}

async function handleStream(args: CliArgs): Promise<void> {
  const batches = buildScenarioBatches(args);

  const result = await streamObjectiveSimulatorBatches(batches, {
    backend_url: getString(args, "backend_url"),
    service_actor_id: getString(args, "service_actor_id", "objective-simulator-local"),
    request_timeout_ms: getNumber(args, "request_timeout_ms", 10000),
    delay_between_batches_ms: getNumber(args, "delay_between_batches_ms", 0),
    dry_run: getBoolean(args, "dry_run"),
    on_batch: (event) => {
      console.log(JSON.stringify(event));
    }
  });

  console.log(JSON.stringify({ ok: true, command: "stream", ...result }, null, 2));
}

async function handleReplayCsv(args: CliArgs): Promise<void> {
  const csvPath = getString(args, "csv");
  const csv = await fs.readFile(csvPath, "utf8");
  const batches = createObjectiveSimulatorBatchesFromCsv(csv, {
    batch_id_prefix: getString(args, "batch_id_prefix", `csv-replay-${Date.now()}`),
    session_id: getString(args, "session_id"),
    device_id: getString(args, "device_id"),
    device_boot_id: getString(args, "device_boot_id"),
    segment_id: getOptionalString(args, "segment_id"),
    batch_size_frames: getNumber(args, "batch_size_frames", 50)
  });

  const result = await streamObjectiveSimulatorBatches(batches, {
    backend_url: getString(args, "backend_url"),
    service_actor_id: getString(args, "service_actor_id", "objective-simulator-local"),
    request_timeout_ms: getNumber(args, "request_timeout_ms", 10000),
    delay_between_batches_ms: getNumber(args, "delay_between_batches_ms", 0),
    dry_run: getBoolean(args, "dry_run"),
    on_batch: (event) => {
      console.log(JSON.stringify(event));
    }
  });

  console.log(JSON.stringify({ ok: true, command: "replay-csv", ...result }, null, 2));
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (command === "help") {
    printUsage();
    return;
  }

  if (command === "export-csv") {
    await handleExportCsv(args);
    return;
  }

  if (command === "stream") {
    await handleStream(args);
    return;
  }

  if (command === "replay-csv") {
    await handleReplayCsv(args);
    return;
  }

  throw new Error(`Unsupported objective simulator command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exitCode = 1;
});
