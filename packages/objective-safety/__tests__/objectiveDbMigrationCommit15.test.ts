import fs from "fs";
import path from "path";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000700_objective_audit_assignment_tables.sql";

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

describe("Commit 15 objective audit and assignment migration", () => {
  it("creates clinician-patient assignment and audit event tables", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "create table if not exists objective.clinician_patient_assignments",
    );
    expect(sql).toContain("create table if not exists objective.audit_events");
  });

  it("requires active clinician-patient assignment metadata", () => {
    const sql = readMigration();

    expect(sql).toContain("clinician_id uuid not null");
    expect(sql).toContain("patient_id uuid not null");
    expect(sql).toContain("assignment_status text not null default 'active'");
    expect(sql).toContain(
      "constraint clinician_patient_assignments_status_allowed",
    );
    expect(sql).toContain("'active'");
    expect(sql).toContain("'revoked'");
  });

  it("prevents duplicate active assignments for the same clinician and patient", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "create unique index if not exists clinician_patient_assignments_one_active_idx",
    );
    expect(sql).toContain(
      "on objective.clinician_patient_assignments (clinician_id, patient_id)",
    );
    expect(sql).toContain("where assignment_status = 'active'");
  });

  it("keeps assignment metadata clinician-only by default", () => {
    const sql = readMigration();

    expect(sql).toContain("clinician_visible boolean not null default true");
    expect(sql).toContain("patient_visible boolean not null default false");
    expect(sql).toContain("chatbot_visible boolean not null default false");
    expect(sql).toContain(
      "constraint clinician_patient_assignments_visibility_clinician_only",
    );
    expect(sql).toContain("patient_visible = false");
    expect(sql).toContain("chatbot_visible = false");
  });

  it("creates bounded audit event fields and event types", () => {
    const sql = readMigration();

    expect(sql).toContain("audit_event_key text not null unique");
    expect(sql).toContain("event_type text not null");
    expect(sql).toContain("actor_role text not null");
    expect(sql).toContain("metadata jsonb not null default '{}'::jsonb");
    expect(sql).toContain("constraint audit_events_type_allowed");
    expect(sql).toContain("constraint audit_events_actor_role_allowed");

    for (const eventType of [
      "session_created",
      "session_started",
      "session_paused",
      "session_resumed",
      "session_stopped",
      "ingest_accepted",
      "ingest_rejected",
      "stream_token_issued",
      "stream_denied",
      "access_denied",
      "forbidden_label_blocked",
      "serializer_blocked",
      "interpretation_created",
      "interpretation_suppressed",
    ]) {
      expect(sql).toContain(`'${eventType}'`);
    }
  });

  it("links audit events to sessions and assignments without cascading deletion", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "session_id uuid references objective.objective_sessions(id) on delete set null",
    );
    expect(sql).toContain(
      "assignment_id uuid references objective.clinician_patient_assignments(id) on delete set null",
    );
  });

  it("adds append-only protection for audit events", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "create or replace function objective.prevent_audit_event_update()",
    );
    expect(sql).toContain("raise exception 'objective audit events are append-only'");
    expect(sql).toContain("create trigger prevent_audit_event_update");
    expect(sql).toContain("before update or delete on objective.audit_events");
  });

  it("adds indexes for assignment and audit lookup", () => {
    const sql = readMigration();

    expect(sql).toContain("clinician_patient_assignments_patient_status_idx");
    expect(sql).toContain("clinician_patient_assignments_clinician_status_idx");
    expect(sql).toContain("audit_events_occurred_idx");
    expect(sql).toContain("audit_events_type_occurred_idx");
    expect(sql).toContain("audit_events_actor_idx");
    expect(sql).toContain("audit_events_session_idx");
    expect(sql).toContain("audit_events_patient_idx");
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

  it("does not add RLS policies, grants, views, APIs, or stream behavior yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("create view");
    expect(sql).not.toContain("websocket");
    expect(sql).not.toContain("notify");
    expect(sql).not.toContain("jwt");
    expect(sql).not.toContain("auth.uid");
  });
});
