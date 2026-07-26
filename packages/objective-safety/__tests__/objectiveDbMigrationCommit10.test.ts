import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000200_objective_metadata_tables.sql";

const EXPECTED_TABLES = [
  "objective.objective_producers",
  "objective.objective_devices",
  "objective.objective_device_boots",
  "objective.objective_sessions",
  "objective.objective_session_segments",
  "objective.simulator_runs",
  "objective.dataset_replay_runs",
  "objective.hardware_profiles",
] as const;

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

describe("Commit 10 objective metadata tables migration", () => {
  it("creates only the expected objective metadata tables", () => {
    const sql = readMigration();

    for (const tableName of EXPECTED_TABLES) {
      expect(sql).toContain(`create table if not exists ${tableName}`);
    }

    expect(sql).not.toContain("raw_batches");
    expect(sql).not.toContain("raw_frame_chunks");
    expect(sql).not.toContain("quarantined_raw_frames");
    expect(sql).not.toContain("feature_windows");
    expect(sql).not.toContain("ml_inferences");
    expect(sql).not.toContain("interpretation_records");
    expect(sql).not.toContain("clinician_notes");
    expect(sql).not.toContain("audit_events");
  });

  it("requires objective sessions to have source type and constrained status", () => {
    const sql = readMigration();

    expect(sql).toContain("source_type objective.source_type not null");
    expect(sql).toContain(
      "status objective.session_status not null default 'created'",
    );
  });

  it("links session segments to sessions and device boots", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "device_boot_id uuid not null references objective.objective_device_boots(id) on delete restrict",
    );
    expect(sql).toContain(
      "unique (session_id, device_boot_id, start_esp_time_ms)",
    );
  });

  it("constrains segment reasons to the schema-approved engineering reasons", () => {
    const sql = readMigration();

    for (const reason of [
      "session_start",
      "manual_segment",
      "device_reset",
      "timing_gap",
      "source_change",
    ]) {
      expect(sql).toContain(`'${reason}'`);
    }

    expect(sql).not.toContain("withdrawal_detected");
    expect(sql).not.toContain("craving_detected");
  });

  it("keeps simulator runs source-bounded and hides developer labels", () => {
    const sql = readMigration();

    expect(sql).toContain("constraint simulator_runs_source_type_simulator");
    expect(sql).toContain("check (source_type = 'simulator')");
    expect(sql).toContain("developer_labels_visible boolean not null default false");
    expect(sql).toContain("constraint simulator_runs_labels_hidden");
    expect(sql).toContain("check (developer_labels_visible = false)");
  });

  it("keeps public replay and hardware profile sources bounded", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "constraint dataset_replay_runs_source_type_public_replay",
    );
    expect(sql).toContain("check (source_type = 'public_dataset_replay')");
    expect(sql).toContain("constraint hardware_profiles_source_type_prototype");
    expect(sql).toContain("check (source_type = 'prototype_hardware')");
    expect(sql).toContain("enabled boolean not null default false");
  });

  it("adds clinician-only visibility constraints to objective user-facing metadata tables", () => {
    const sql = readMigration();

    const visibilityConstraintCount =
      sql.match(/visibility_clinician_only/g)?.length ?? 0;

    expect(visibilityConstraintCount).toBeGreaterThanOrEqual(5);
    expect(sql).toContain("clinician_visible boolean not null default true");
    expect(sql).toContain("patient_visible boolean not null default false");
    expect(sql).toContain("chatbot_visible boolean not null default false");
    expect(sql).toContain("patient_visible = false");
    expect(sql).toContain("chatbot_visible = false");
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

  it("does not add RLS, grants, views, raw storage, ML, or interpretation behavior yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("create view");
    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("trigger");
    expect(sql).not.toContain("notify");
  });
});
