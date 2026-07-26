import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000800_objective_rls_views.sql";

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

describe("Commit 16 objective RLS and clinician-safe views migration", () => {
  it("revokes objective schema access from public, anon, authenticated, and service role before granting safe usage", () => {
    const sql = readMigration();

    expect(sql).toContain("revoke all on schema objective from public");
    expect(sql).toContain("revoke all on schema objective from anon");
    expect(sql).toContain("revoke all on schema objective from authenticated");
    expect(sql).toContain("revoke all on schema objective from service_role");
    expect(sql).toContain("grant usage on schema objective to authenticated");
  });

  it("adds helper functions for clinician role and assignment checks", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function objective.current_app_role()");
    expect(sql).toContain(
      "create or replace function objective.current_clinician_id()",
    );
    expect(sql).toContain(
      "create or replace function objective.is_current_clinician()",
    );
    expect(sql).toContain(
      "create or replace function objective.is_assigned_clinician",
    );
    expect(sql).toContain("assignment.assignment_status = 'active'");
    expect(sql).toContain("assignment.patient_visible = false");
    expect(sql).toContain("assignment.chatbot_visible = false");
  });

  it("enables RLS on objective tables", () => {
    const sql = readMigration();

    for (const tableName of [
      "objective.objective_sessions",
      "objective.objective_session_segments",
      "objective.raw_batches",
      "objective.raw_frame_chunks",
      "objective.quarantined_raw_frames",
      "objective.feature_windows",
      "objective.ml_inferences",
      "objective.interpretation_records",
      "objective.session_interpretation_summaries",
      "objective.clinician_notes",
      "objective.clinician_patient_assignments",
      "objective.audit_events",
    ]) {
      expect(sql).toContain(`alter table ${tableName} enable row level security`);
    }
  });

  it("adds assigned-clinician read policies only for safe clinician-facing tables", () => {
    const sql = readMigration();

    for (const policyName of [
      "objective_sessions_assigned_clinician_read",
      "objective_session_segments_assigned_clinician_read",
      "feature_windows_assigned_clinician_read",
      "ml_inferences_assigned_clinician_read",
      "interpretation_records_assigned_clinician_read",
      "session_interpretation_summaries_assigned_clinician_read",
      "clinician_notes_assigned_clinician_read",
      "clinician_patient_assignments_self_read",
    ]) {
      expect(sql).toContain(`create policy ${policyName}`);
    }

    expect(sql).toContain("to authenticated");
    expect(sql).toContain("objective.is_assigned_clinician");
    expect(sql).toContain("patient_visible = false");
    expect(sql).toContain("chatbot_visible = false");
  });

  it("does not add direct read policies for raw storage or audit tables", () => {
    const sql = readMigration();

    expect(sql).not.toContain("raw_batches_assigned_clinician_read");
    expect(sql).not.toContain("raw_frame_chunks_assigned_clinician_read");
    expect(sql).not.toContain("quarantined_raw_frames_assigned_clinician_read");
    expect(sql).not.toContain("audit_events_assigned_clinician_read");
  });

  it("creates the expected clinician-safe views", () => {
    const sql = readMigration();

    for (const viewName of [
      "objective.clinician_session_list",
      "objective.clinician_interpretation_timeline",
      "objective.clinician_session_summary",
      "objective.clinician_chart_safe_data",
      "objective.clinician_quality_timeline",
    ]) {
      expect(sql).toContain(`create or replace view ${viewName}`);
    }
  });

  it("keeps chart-safe and quality views away from raw payload columns", () => {
    const sql = readMigration();

    const chartViewStart = sql.indexOf(
      "create or replace view objective.clinician_chart_safe_data",
    );
    const qualityViewStart = sql.indexOf(
      "create or replace view objective.clinician_quality_timeline",
    );

    expect(chartViewStart).toBeGreaterThanOrEqual(0);
    expect(qualityViewStart).toBeGreaterThanOrEqual(0);

    const chartAndQualitySql = sql.slice(chartViewStart);

    expect(chartAndQualitySql).not.toContain("raw_payload");
    expect(chartAndQualitySql).not.toContain("objective.raw_frame_chunks");
    expect(chartAndQualitySql).not.toContain("objective.raw_batches");
  });

  it("grants select only on clinician-safe views to authenticated users", () => {
    const sql = readMigration();

    for (const viewName of [
      "objective.clinician_session_list",
      "objective.clinician_interpretation_timeline",
      "objective.clinician_session_summary",
      "objective.clinician_chart_safe_data",
      "objective.clinician_quality_timeline",
    ]) {
      expect(sql).toContain(`grant select on ${viewName} to authenticated`);
    }

    expect(sql).not.toContain("grant select on objective.raw_batches");
    expect(sql).not.toContain("grant select on objective.raw_frame_chunks");
    expect(sql).not.toContain("grant select on objective.audit_events");
    expect(sql).not.toContain(
      "grant select on objective.objective_sessions to authenticated",
    );
  });

  it("does not grant objective access to anon or service role", () => {
    const sql = readMigration();

    expect(sql).not.toContain("grant usage on schema objective to anon");
    expect(sql).not.toContain("grant usage on schema objective to service_role");
    expect(sql).not.toContain(" to anon");
    expect(sql).not.toContain(" to service_role");
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

  it("does not add APIs, streaming, dashboard, or chatbot integration", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("notify");
    expect(sql).not.toContain("frontend");
    expect(sql).not.toContain("langgraph");
    expect(sql).not.toContain("chatbot integration");
    expect(sql).not.toContain("chatbot route");
    expect(sql).not.toContain("chatbot api");
  });
});
