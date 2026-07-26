import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000500_objective_ml_registry_tables.sql";

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

describe("Commit 13 objective ML inference and registry migration", () => {
  it("creates preprocessing, feature schema, calibration, model, and ML inference tables", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "create table if not exists objective.preprocessing_versions",
    );
    expect(sql).toContain(
      "create table if not exists objective.feature_schema_versions",
    );
    expect(sql).toContain(
      "create table if not exists objective.calibration_versions",
    );
    expect(sql).toContain("create table if not exists objective.model_registry");
    expect(sql).toContain("create table if not exists objective.ml_inferences");
  });

  it("uses DB enum types for ML target, class, confidence, and suppression fields", () => {
    const sql = readMigration();

    expect(sql).toContain("target objective.ml_target not null");
    expect(sql).toContain("predicted_class objective.ml_class not null");
    expect(sql).toContain("confidence_label objective.confidence_label not null");
    expect(sql).toContain(
      "suppression_state objective.suppression_state not null default 'not_suppressed'",
    );
  });

  it("links ML inferences to feature windows and sessions", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "feature_window_id uuid not null references objective.feature_windows(id) on delete restrict",
    );
    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "model_id uuid references objective.model_registry(id) on delete restrict",
    );
  });

  it("stores model and version traceability", () => {
    const sql = readMigration();

    expect(sql).toContain("model_key text not null");
    expect(sql).toContain("model_version text not null");
    expect(sql).toContain("constraint ml_inferences_model_key_nonempty");
    expect(sql).toContain("constraint ml_inferences_model_version_nonempty");
    expect(sql).toContain("model_card jsonb not null default '{}'::jsonb");
    expect(sql).toContain("allowed_classes jsonb not null default '[]'::jsonb");
  });

  it("stores bounded uncertainty and probability fields", () => {
    const sql = readMigration();

    expect(sql).toContain("probability double precision");
    expect(sql).toContain("constraint ml_inferences_probability_range");
    expect(sql).toContain(
      "uncertainty_reasons jsonb not null default '[]'::jsonb",
    );
    expect(sql).toContain("constraint ml_inferences_uncertainty_reasons_array");
    expect(sql).toContain("inference_payload jsonb not null default '{}'::jsonb");
    expect(sql).toContain("constraint ml_inferences_payload_object");
  });

  it("adds clinician-only visibility constraints to all ML registry tables", () => {
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

  it("adds indexes for version, model, and inference lookup", () => {
    const sql = readMigration();

    expect(sql).toContain("preprocessing_versions_key_idx");
    expect(sql).toContain("feature_schema_versions_key_idx");
    expect(sql).toContain("calibration_versions_key_idx");
    expect(sql).toContain("model_registry_target_active_idx");
    expect(sql).toContain("ml_inferences_session_created_idx");
    expect(sql).toContain("ml_inferences_feature_window_idx");
    expect(sql).toContain("ml_inferences_target_class_idx");
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

  it("does not add interpretation, notes, audit, RLS, grants, or views yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("interpretation_records");
    expect(sql).not.toContain("session_interpretation_summaries");
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
