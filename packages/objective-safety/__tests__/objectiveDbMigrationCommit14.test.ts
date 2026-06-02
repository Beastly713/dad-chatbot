import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000600_objective_interpretation_summary_note_tables.sql";

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

describe("Commit 14 objective interpretation summary and note migration", () => {
  it("creates interpretation, session summary, and clinician note tables", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "create table if not exists objective.interpretation_records",
    );
    expect(sql).toContain(
      "create table if not exists objective.session_interpretation_summaries",
    );
    expect(sql).toContain("create table if not exists objective.clinician_notes");
  });

  it("constrains interpretation labels and bounded state fields to objective enums", () => {
    const sql = readMigration();

    expect(sql).toContain("label objective.interpretation_label not null");
    expect(sql).toContain("evidence_level objective.evidence_level not null");
    expect(sql).toContain("confidence_label objective.confidence_label not null");
    expect(sql).toContain(
      "suppression_state objective.suppression_state not null default 'not_suppressed'",
    );
  });

  it("links interpretation records to session, feature window, and ML inference records", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "session_id uuid not null references objective.objective_sessions(id) on delete cascade",
    );
    expect(sql).toContain(
      "feature_window_id uuid references objective.feature_windows(id) on delete set null",
    );
    expect(sql).toContain(
      "ml_inference_id uuid references objective.ml_inferences(id) on delete set null",
    );
  });

  it("keeps uncertainty, modality, and source reference fields structured", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "uncertainty_reasons jsonb not null default '[]'::jsonb",
    );
    expect(sql).toContain(
      "contributing_modalities jsonb not null default '[]'::jsonb",
    );
    expect(sql).toContain(
      "excluded_modalities jsonb not null default '[]'::jsonb",
    );
    expect(sql).toContain("source_refs jsonb not null default '{}'::jsonb");
    expect(sql).toContain(
      "constraint interpretation_records_uncertainty_reasons_array",
    );
    expect(sql).toContain("constraint interpretation_records_source_refs_object");
  });

  it("keeps session summaries safe and free of risk-score style fields", () => {
    const sql = readMigration();

    expect(sql).toContain("total_windows integer not null default 0");
    expect(sql).toContain(
      "interpretable_fraction double precision not null default 0",
    );
    expect(sql).toContain(
      "suppressed_fraction double precision not null default 0",
    );
    expect(sql).toContain(
      "modality_availability jsonb not null default '{}'::jsonb",
    );
    expect(sql).toContain(
      "quality_distribution jsonb not null default '{}'::jsonb",
    );
    expect(sql).toContain("evidence_period_count integer not null default 0");
    expect(sql).toContain("cooldown_period_count integer not null default 0");
    expect(sql).toContain(
      "motion_confounded_fraction double precision not null default 0",
    );

    expect(sql).not.toContain("risk_score");
    expect(sql).not.toContain("severity_score");
    expect(sql).not.toContain("clinical_score");
  });

  it("keeps clinician notes separate from automated interpretation outputs", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists objective.clinician_notes");
    expect(sql).toContain("note_text text not null");
    expect(sql).toContain(
      "linked_interpretation_id uuid references objective.interpretation_records(id) on delete set null",
    );
    expect(sql).toContain(
      "linked_feature_window_id uuid references objective.feature_windows(id) on delete set null",
    );

    expect(sql).not.toContain("clinician_note_text");
    expect(sql).not.toContain("note_text text not null, label");
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

  it("adds indexes for interpretation, summary, and note lookup", () => {
    const sql = readMigration();

    expect(sql).toContain("interpretation_records_session_created_idx");
    expect(sql).toContain("interpretation_records_feature_window_idx");
    expect(sql).toContain("interpretation_records_ml_inference_idx");
    expect(sql).toContain("interpretation_records_label_idx");
    expect(sql).toContain(
      "session_interpretation_summaries_session_generated_idx",
    );
    expect(sql).toContain("clinician_notes_session_created_idx");
    expect(sql).toContain("clinician_notes_clinician_idx");
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

  it("does not add audit, RLS, grants, views, APIs, or stream behavior yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("audit_events");
    expect(sql).not.toContain("clinician_patient_assignments");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("create view");
    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("notify");
  });
});
