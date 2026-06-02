import fs from "fs";
import path from "path";
import {
  ALLOWED_OBJECTIVE_CONFIDENCE_LABELS,
  ALLOWED_OBJECTIVE_EVIDENCE_LEVELS,
  ALLOWED_OBJECTIVE_INTERPRETATION_LABELS,
  ALLOWED_OBJECTIVE_ML_CLASSES,
  ALLOWED_OBJECTIVE_ML_TARGETS,
  ALLOWED_OBJECTIVE_SOURCE_TYPES,
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const MIGRATION_RELATIVE_PATH =
  "supabase/migrations/20260602000100_objective_schema_enums.sql";

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

function expectSqlEnum(sql: string, enumName: string): void {
  expect(sql).toContain(`create type objective.${enumName} as enum`);
}

describe("Commit 9 objective DB schema and enum migration", () => {
  it("creates an isolated objective schema", () => {
    const sql = readMigration();

    expect(sql).toContain("create schema if not exists objective;");
  });

  it("creates the expected objective enum types", () => {
    const sql = readMigration();

    expectSqlEnum(sql, "source_type");
    expectSqlEnum(sql, "session_status");
    expectSqlEnum(sql, "evidence_level");
    expectSqlEnum(sql, "confidence_label");
    expectSqlEnum(sql, "suppression_state");
    expectSqlEnum(sql, "interpretation_label");
    expectSqlEnum(sql, "ml_target");
    expectSqlEnum(sql, "ml_class");
  });

  it("keeps source types aligned with the objective safety registry", () => {
    const sql = readMigration();

    for (const sourceType of ALLOWED_OBJECTIVE_SOURCE_TYPES) {
      expect(sql).toContain(`'${sourceType}'`);
    }

    expect(sql).not.toContain("'validated_hardware'");
    expect(sql).not.toContain("'clinical_device'");
  });

  it("keeps evidence and confidence enums aligned with safety registries", () => {
    const sql = readMigration();

    for (const evidenceLevel of ALLOWED_OBJECTIVE_EVIDENCE_LEVELS) {
      expect(sql).toContain(`'${evidenceLevel}'`);
    }

    for (const confidenceLabel of ALLOWED_OBJECTIVE_CONFIDENCE_LABELS) {
      expect(sql).toContain(`'${confidenceLabel}'`);
    }

    expect(sql).not.toContain("'diagnosed'");
    expect(sql).not.toContain("'high_risk'");
  });

  it("keeps interpretation labels aligned with the objective safety registry", () => {
    const sql = readMigration();

    for (const label of ALLOWED_OBJECTIVE_INTERPRETATION_LABELS) {
      expect(sql).toContain(`'${label}'`);
    }
  });

  it("keeps ML target and ML class enums aligned with safety registries", () => {
    const sql = readMigration();

    for (const target of ALLOWED_OBJECTIVE_ML_TARGETS) {
      expect(sql).toContain(`'${target}'`);
    }

    for (const mlClass of ALLOWED_OBJECTIVE_ML_CLASSES) {
      expect(sql).toContain(`'${mlClass}'`);
    }
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

  it("does not create tables, grants, policies, views, or RLS yet", () => {
    const sql = readMigration().toLowerCase();

    expect(sql).not.toContain("create table");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("alter table");
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("create view");
  });
});
