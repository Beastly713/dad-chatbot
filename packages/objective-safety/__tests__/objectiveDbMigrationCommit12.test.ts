import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000400_objective_feature_baseline_tables.sql";

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

describe("Commit 12 objective feature window and baseline migration", () => {
  it("creates feature window and baseline tables", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists objective.feature_windows");
    expect(sql).toContain("create table if not exists objective.baseline_profiles");
    expect(sql).toContain("create table if not exists objective.baseline_windows");
  });

  it("links feature windows to sessions, segments, raw batches, and raw ranges", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "segment_id uuid references objective.objective_session_segments(id) on delete set null",
    );
    expect(sql).toContain(
      "raw_batch_id uuid references objective.raw_batches(id) on delete set null",
    );
    expect(sql).toContain("raw_chunk_refs jsonb not null default '[]'::jsonb");
    expect(sql).toContain("raw_range_refs jsonb not null default '{}'::jsonb");
  });

  it("stores preprocessing and feature schema version metadata", () => {
    const sql = readMigration();

    expect(sql).toContain("preprocessing_version text not null");
    expect(sql).toContain("feature_schema_version text not null");
    expect(sql).toContain("constraint feature_windows_preprocessing_version_nonempty");
    expect(sql).toContain("constraint feature_windows_feature_schema_version_nonempty");
    expect(sql).toContain("constraint baseline_profiles_preprocessing_version_nonempty");
    expect(sql).toContain("constraint baseline_profiles_feature_schema_version_nonempty");
  });

  it("stores quality, missingness, modality availability, features, and uncertainty as JSON objects or arrays", () => {
    const sql = readMigration();

    expect(sql).toContain("quality jsonb not null default '{}'::jsonb");
    expect(sql).toContain("missingness jsonb not null default '{}'::jsonb");
    expect(sql).toContain(
      "modality_availability jsonb not null default '{}'::jsonb",
    );
    expect(sql).toContain("features jsonb not null default '{}'::jsonb");
    expect(sql).toContain(
      "uncertainty_reasons jsonb not null default '[]'::jsonb",
    );
    expect(sql).toContain("constraint feature_windows_features_object");
    expect(sql).toContain("constraint feature_windows_uncertainty_reasons_array");
  });

  it("constrains feature window statuses and suppression state", () => {
    const sql = readMigration();

    expect(sql).toContain("window_status text not null");
    expect(sql).toContain("suppression_state objective.suppression_state not null");
    expect(sql).toContain("'ready'");
    expect(sql).toContain("'suppressed'");
    expect(sql).toContain("'insufficient_data'");
  });

  it("adds baseline profiles and baseline windows with safe engineering fields only", () => {
    const sql = readMigration();

    expect(sql).toContain("baseline_profile_key text not null unique");
    expect(sql).toContain("profile_status text not null default 'building'");
    expect(sql).toContain("baseline_method text not null");
    expect(sql).toContain("baseline_features jsonb not null default '{}'::jsonb");
    expect(sql).toContain("developer_metadata jsonb not null default '{}'::jsonb");
    expect(sql).toContain("inclusion_state text not null default 'included'");
    expect(sql).toContain("window_weight double precision not null default 1.0");
    expect(sql).toContain("unique (baseline_profile_id, feature_window_id)");
  });

  it("isolates developer metadata and keeps it structured", () => {
    const sql = readMigration();

    const developerMetadataCount =
      sql.match(/developer_metadata jsonb not null default '\{\}'::jsonb/g)
        ?.length ?? 0;

    expect(developerMetadataCount).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("constraint baseline_profiles_developer_metadata_object");
    expect(sql).toContain("constraint baseline_windows_developer_metadata_object");
  });

  it("adds clinician-only visibility constraints to all new tables", () => {
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

  it("adds indexes for feature and baseline lookup", () => {
    const sql = readMigration();

    expect(sql).toContain("feature_windows_session_time_idx");
    expect(sql).toContain("feature_windows_segment_idx");
    expect(sql).toContain("feature_windows_raw_batch_idx");
    expect(sql).toContain("feature_windows_baseline_profile_idx");
    expect(sql).toContain("baseline_profiles_patient_status_idx");
    expect(sql).toContain("baseline_profiles_session_idx");
    expect(sql).toContain("baseline_windows_profile_idx");
    expect(sql).toContain("baseline_windows_feature_window_idx");
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

  it("does not add ML, interpretation, notes, audit, RLS, grants, or views yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("ml_inferences");
    expect(sql).not.toContain("model_registry");
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
