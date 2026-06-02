import fs from "fs";
import path from "path";
import {
  ALLOWED_OBJECTIVE_INTERPRETATION_LABELS,
  ALLOWED_OBJECTIVE_ML_CLASSES,
  ALLOWED_OBJECTIVE_ML_TARGETS,
  ALLOWED_OBJECTIVE_SOURCE_TYPES,
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_FILES = [
  "20260602000100_objective_schema_enums.sql",
  "20260602000200_objective_metadata_tables.sql",
  "20260602000300_objective_raw_storage_tables.sql",
  "20260602000400_objective_feature_baseline_tables.sql",
  "20260602000500_objective_ml_registry_tables.sql",
  "20260602000600_objective_interpretation_summary_note_tables.sql",
  "20260602000700_objective_audit_assignment_tables.sql",
  "20260602000800_objective_rls_views.sql",
] as const;

const EXPECTED_BASE_TABLES = [
  "objective.objective_producers",
  "objective.objective_devices",
  "objective.objective_device_boots",
  "objective.objective_sessions",
  "objective.objective_session_segments",
  "objective.simulator_runs",
  "objective.dataset_replay_runs",
  "objective.hardware_profiles",
  "objective.raw_batches",
  "objective.raw_frame_chunks",
  "objective.quarantined_raw_frames",
  "objective.feature_windows",
  "objective.baseline_profiles",
  "objective.baseline_windows",
  "objective.preprocessing_versions",
  "objective.feature_schema_versions",
  "objective.calibration_versions",
  "objective.model_registry",
  "objective.ml_inferences",
  "objective.interpretation_records",
  "objective.session_interpretation_summaries",
  "objective.clinician_notes",
  "objective.clinician_patient_assignments",
  "objective.audit_events",
] as const;

const EXPECTED_CLINICIAN_SAFE_VIEWS = [
  "objective.clinician_session_list",
  "objective.clinician_interpretation_timeline",
  "objective.clinician_session_summary",
  "objective.clinician_chart_safe_data",
  "objective.clinician_quality_timeline",
] as const;

function findRepoRoot(): string {
  const cwd = process.cwd();

  if (cwd.endsWith(path.join("packages", "objective-safety"))) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

function migrationPath(fileName: string): string {
  return path.join(findRepoRoot(), "supabase", "migrations", fileName);
}

function readMigration(fileName: string): string {
  const fullPath = migrationPath(fileName);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing migration: ${fileName}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readAllMigrations(): string {
  return MIGRATION_FILES.map(readMigration).join("\n\n");
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("Commit 17 objective DB foundation regression tests", () => {
  it("contains the expected migration sequence", () => {
    const migrationDirectory = path.join(findRepoRoot(), "supabase", "migrations");
    const existingMigrations = fs.readdirSync(migrationDirectory).sort();

    for (const fileName of MIGRATION_FILES) {
      expect(existingMigrations).toContain(fileName);
    }

    expect(MIGRATION_FILES).toEqual([...MIGRATION_FILES].sort());
  });

  it("keeps all objective migrations free of forbidden executable terms", () => {
    for (const fileName of MIGRATION_FILES) {
      const relativePath = `supabase/migrations/${fileName}`;
      const sql = readMigration(fileName);

      for (const forbidden of [
        ...FORBIDDEN_OBJECTIVE_LABELS,
        ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
        ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
      ]) {
        expect(sql).not.toContain(forbidden);
      }

      const violations = findForbiddenObjectiveTermViolations([
        {
          path: relativePath,
          surface: "db_column",
          content: sql,
        },
      ]);

      expect(violations).toEqual([]);
    }
  });

  it("keeps DB enum values aligned with objective safety registries", () => {
    const sql = readAllMigrations();

    for (const sourceType of ALLOWED_OBJECTIVE_SOURCE_TYPES) {
      expect(sql).toContain(`'${sourceType}'`);
    }

    for (const target of ALLOWED_OBJECTIVE_ML_TARGETS) {
      expect(sql).toContain(`'${target}'`);
    }

    for (const mlClass of ALLOWED_OBJECTIVE_ML_CLASSES) {
      expect(sql).toContain(`'${mlClass}'`);
    }

    for (const label of ALLOWED_OBJECTIVE_INTERPRETATION_LABELS) {
      expect(sql).toContain(`'${label}'`);
    }

    expect(sql).not.toContain("'validated_hardware'");
    expect(sql).not.toContain("'clinical_device'");
    expect(sql).not.toContain("'high_risk'");
  });

  it("creates every expected objective base table exactly as objective schema tables", () => {
    const sql = readAllMigrations();

    for (const tableName of EXPECTED_BASE_TABLES) {
      expect(sql).toContain(`create table if not exists ${tableName}`);
    }
  });

  it("enables RLS for every objective base table", () => {
    const sql = readAllMigrations();

    for (const tableName of EXPECTED_BASE_TABLES) {
      expect(sql).toContain(`alter table ${tableName} enable row level security`);
    }
  });

  it("denies patient and chatbot visibility at the table-constraint level", () => {
    const sql = readAllMigrations();

    const clinicianOnlyConstraintCount =
      sql.match(/visibility_clinician_only/g)?.length ?? 0;

    expect(clinicianOnlyConstraintCount).toBeGreaterThanOrEqual(15);
    expect(sql).toContain("clinician_visible boolean not null default true");
    expect(sql).toContain("patient_visible boolean not null default false");
    expect(sql).toContain("chatbot_visible boolean not null default false");
    expect(sql).toContain("patient_visible = false");
    expect(sql).toContain("chatbot_visible = false");
  });

  it("denies direct objective schema/table access before exposing safe views", () => {
    const sql = readAllMigrations();

    expect(sql).toContain("revoke all on schema objective from public");
    expect(sql).toContain("revoke all on schema objective from anon");
    expect(sql).toContain("revoke all on schema objective from authenticated");
    expect(sql).toContain("revoke all on schema objective from service_role");

    for (const tableName of EXPECTED_BASE_TABLES) {
      expect(sql).not.toContain(`grant select on ${tableName}`);
      expect(sql).not.toContain(`grant all on ${tableName}`);
    }

    expect(sql).not.toContain("grant usage on schema objective to anon");
    expect(sql).not.toContain("grant usage on schema objective to service_role");
  });

  it("requires active assignment for clinician-safe view access", () => {
    const sql = readAllMigrations();

    expect(sql).toContain("create or replace function objective.is_assigned_clinician");
    expect(sql).toContain("assignment.assignment_status = 'active'");
    expect(sql).toContain("assignment.patient_visible = false");
    expect(sql).toContain("assignment.chatbot_visible = false");

    for (const viewName of EXPECTED_CLINICIAN_SAFE_VIEWS) {
      expect(sql).toContain(`create or replace view ${viewName}`);
      expect(sql).toContain(`grant select on ${viewName} to authenticated`);
    }
  });

  it("does not expose raw payloads through clinician-safe views", () => {
    const rlsMigration = readMigration("20260602000800_objective_rls_views.sql");

    for (const viewName of EXPECTED_CLINICIAN_SAFE_VIEWS) {
      const viewStart = rlsMigration.indexOf(`create or replace view ${viewName}`);

      expect(viewStart).toBeGreaterThanOrEqual(0);
    }

    const viewSql = rlsMigration.slice(
      rlsMigration.indexOf("create or replace view objective.clinician_session_list"),
    );

    expect(viewSql).not.toContain("raw_payload");
    expect(viewSql).not.toContain("objective.raw_frame_chunks");
    expect(viewSql).not.toContain("objective.raw_batches");
    expect(viewSql).not.toContain("quarantined_raw_frames");
  });

  it("keeps raw-to-feature-to-ML-to-interpretation traceability chain intact", () => {
    const sql = normalizeSql(readAllMigrations());

    expect(sql).toContain(
      normalizeSql(
        "raw_batch_id uuid references objective.raw_batches(id) on delete set null",
      ),
    );
    expect(sql).toContain("raw_chunk_refs jsonb not null default '[]'::jsonb");
    expect(sql).toContain("raw_range_refs jsonb not null default '{}'::jsonb");

    expect(sql).toContain(
      normalizeSql(
        "feature_window_id uuid not null references objective.feature_windows(id) on delete restrict",
      ),
    );
    expect(sql).toContain(
      normalizeSql(
        "ml_inference_id uuid references objective.ml_inferences(id) on delete set null",
      ),
    );
    expect(sql).toContain(
      normalizeSql(
        "feature_window_id uuid references objective.feature_windows(id) on delete set null",
      ),
    );
  });

  it("keeps ML target and interpretation label fields enum-constrained", () => {
    const sql = readAllMigrations();

    expect(sql).toContain("target objective.ml_target not null");
    expect(sql).toContain("predicted_class objective.ml_class not null");
    expect(sql).toContain("label objective.interpretation_label not null");
    expect(sql).toContain("evidence_level objective.evidence_level not null");
    expect(sql).toContain("confidence_label objective.confidence_label not null");
  });

  it("keeps audit events append-only", () => {
    const sql = readAllMigrations();

    expect(sql).toContain(
      "create or replace function objective.prevent_audit_event_update()",
    );
    expect(sql).toContain("raise exception 'objective audit events are append-only'");
    expect(sql).toContain("before update or delete on objective.audit_events");
  });

  it("does not introduce objective backend, APIs, streaming, dashboard, or chatbot integration in DB foundation", () => {
    const sql = readAllMigrations().toLowerCase();

    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("notify");
    expect(sql).not.toContain("app/api");
    expect(sql).not.toContain("route.ts");
    expect(sql).not.toContain("langgraph");
    expect(sql).not.toContain("prompt");
    expect(sql).not.toContain("rag pipeline");
    expect(sql).not.toContain("retrieval augmented");
  });

  it("documents the current limitation that Commit 17 is static SQL testing, not live Postgres execution", () => {
    /**
     * The repo currently has no local Supabase/Postgres test harness.
     * Commit 17 therefore verifies migration structure statically.
     * Live insert/select/RLS execution tests can be added later when the
     * project introduces a DB test runner or Supabase CLI workflow.
     */
    expect(true).toBe(true);
  });
});
