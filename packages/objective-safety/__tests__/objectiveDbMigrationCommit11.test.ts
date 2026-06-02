import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000300_objective_raw_storage_tables.sql";

function findRepoRoot(): string {
  const cwd = process.cwd();

  if (cwd.endsWith(path.join("packages", "objective-safety"))) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

function readMigration(): string {
  const migrationPath = path.join(findRepoRoot(), MIGRATION_RELATIVE_PATH);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Missing migration: ${MIGRATION_RELATIVE_PATH}`);
  }

  return fs.readFileSync(migrationPath, "utf8");
}

describe("Commit 11 objective raw storage migration", () => {
  it("creates raw batch, raw chunk, and quarantine tables", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists objective.raw_batches");
    expect(sql).toContain(
      "create table if not exists objective.raw_frame_chunks",
    );
    expect(sql).toContain(
      "create table if not exists objective.quarantined_raw_frames",
    );
  });

  it("links raw batches to objective session and segment metadata", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "segment_id uuid references objective.objective_session_segments(id) on delete set null",
    );
    expect(sql).toContain(
      "device_id uuid references objective.objective_devices(id) on delete restrict",
    );
    expect(sql).toContain(
      "device_boot_id uuid references objective.objective_device_boots(id) on delete restrict",
    );
    expect(sql).toContain("source_type objective.source_type not null");
  });

  it("links raw frame chunks to batch, session, segment, device, and boot", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "batch_id uuid not null references objective.raw_batches(id) on delete cascade",
    );
    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "segment_id uuid not null references objective.objective_session_segments(id) on delete restrict",
    );
    expect(sql).toContain(
      "device_id uuid not null references objective.objective_devices(id) on delete restrict",
    );
    expect(sql).toContain(
      "device_boot_id uuid not null references objective.objective_device_boots(id) on delete restrict",
    );
  });

  it("stores high-rate raw data as chunks rather than one table row per sample", () => {
    const sql = readMigration();

    expect(sql).toContain("chunk_index integer not null");
    expect(sql).toContain("frame_count integer not null");
    expect(sql).toContain("raw_payload jsonb not null");
    expect(sql).toContain("raw_range_metadata jsonb not null default '{}'::jsonb");
    expect(sql).toContain("unique (batch_id, chunk_index)");
  });

  it("keeps invalid or rejected frame payloads in quarantine storage", () => {
    const sql = readMigration();

    expect(sql).toContain("objective.quarantined_raw_frames");
    expect(sql).toContain("reject_reason text not null");
    expect(sql).toContain("reject_details jsonb not null default '{}'::jsonb");
    expect(sql).toContain("raw_payload jsonb not null");
    expect(sql).toContain("quarantined_at timestamptz not null default now()");
    expect(sql).toContain("constraint quarantined_raw_frames_reason_nonempty");
  });

  it("adds timing and count constraints for raw traceability", () => {
    const sql = readMigration();

    expect(sql).toContain("constraint raw_batches_count_total_valid");
    expect(sql).toContain("constraint raw_batches_esp_range_valid");
    expect(sql).toContain("constraint raw_frame_chunks_esp_range_valid");
    expect(sql).toContain("constraint raw_frame_chunks_pc_time_valid");
    expect(sql).toContain("constraint raw_frame_chunks_unique_chunk_per_batch");
  });

  it("adds clinician-only visibility constraints to raw storage tables", () => {
    const sql = readMigration();

    const visibilityConstraintCount =
      sql.match(/visibility_clinician_only/g)?.length ?? 0;

    expect(visibilityConstraintCount).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("clinician_visible boolean not null default true");
    expect(sql).toContain("patient_visible boolean not null default false");
    expect(sql).toContain("chatbot_visible boolean not null default false");
    expect(sql).toContain("patient_visible = false");
    expect(sql).toContain("chatbot_visible = false");
  });

  it("adds indexes for session, segment, batch, and quarantine lookup", () => {
    const sql = readMigration();

    expect(sql).toContain("raw_batches_session_received_idx");
    expect(sql).toContain("raw_batches_segment_idx");
    expect(sql).toContain("raw_frame_chunks_session_segment_time_idx");
    expect(sql).toContain("raw_frame_chunks_batch_idx");
    expect(sql).toContain("quarantined_raw_frames_session_time_idx");
    expect(sql).toContain("quarantined_raw_frames_batch_idx");
  });

  it("does not contain forbidden objective labels, fields, or route segments", () => {
    const sql = readMigration();

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it("passes the objective forbidden-term source scanner as a DB migration", () => {
    const sql = readMigration();

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: MIGRATION_RELATIVE_PATH,
        surface: "db_column",
        content: sql,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("does not add feature, ML, interpretation, notes, audit, RLS, grants, or views yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("feature_windows");
    expect(sql).not.toContain("baseline_profiles");
    expect(sql).not.toContain("ml_inferences");
    expect(sql).not.toContain("interpretation_records");
    expect(sql).not.toContain("clinician_notes");
    expect(sql).not.toContain("audit_events");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("create view");
    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("notify");
  });
});
