// packages/objective-safety/__tests__/sourceScanner.test.ts

import {
  assertNoForbiddenObjectiveTermViolations,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

describe("objective source forbidden-term scanner", () => {
  it("passes safe objective source, schema, route, and UI copy", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-schemas/src/derivedRecords.ts",
        surface: "api_field",
        content: `
          export const target =
            "baseline_relative_elevated_physiological_arousal_evidence";
          export const label =
            "elevated_physiological_arousal_evidence";
        `,
      },
      {
        path: "frontend/app/(clinician)/objective/live/page.tsx",
        surface: "ui_copy",
        content: `
          export const copy = "Clinician-reviewable non-diagnostic physiological evidence";
        `,
      },
      {
        path: "services/objective-backend/src/routes/session.ts",
        surface: "route",
        content: `
          export const route = "/clinician/objective/sessions/[sessionId]";
        `,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("catches forbidden ML target strings in executable source", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-schemas/src/mlTargets.ts",
        surface: "ml_target",
        content: `
          export const target = "relapse_risk";
        `,
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: "packages/objective-schemas/src/mlTargets.ts",
        term: "relapse_risk",
        surface: "ml_target",
      }),
    ]);
  });

  it("catches forbidden interpretation labels", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-interpretation/src/labels.ts",
        surface: "interpretation_label",
        content: `
          export const label = "withdrawal_risk";
        `,
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        term: "withdrawal_risk",
        surface: "interpretation_label",
      }),
    ]);
  });

  it("catches forbidden route segments", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "frontend/app/(clinician)/relapse-risk/page.tsx",
        surface: "route",
        content: `
          export const routeSegment = "relapse-risk";
        `,
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        term: "relapse-risk",
        surface: "route",
      }),
    ]);
  });

  it("catches forbidden database column names", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "supabase/migrations/0001_objective.sql",
        surface: "db_column",
        content: `
          create table objective.ml_inferences (
            CIWA_score integer
          );
        `,
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        term: "CIWA_score",
        surface: "db_column",
      }),
    ]);
  });

  it("catches forbidden API fields and dashboard copy constants", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "services/objective-backend/src/dto.ts",
        surface: "api_field",
        content: `
          export type UnsafeDto = {
            patientTruthfulness: string;
          };
        `,
      },
      {
        path: "frontend/components/objective-copy.ts",
        surface: "ui_copy",
        content: `
          export const title = "patient_is_safe";
        `,
      },
    ]);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          term: "patientTruthfulness",
          surface: "api_field",
        }),
        expect.objectContaining({
          term: "patient_is_safe",
          surface: "ui_copy",
        }),
      ]),
    );
  });

  it("allows forbidden terms inside the safety registry itself", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-safety/src/registries.ts",
        content: `
          export const FORBIDDEN_OBJECTIVE_LABELS = ["craving_detected"];
        `,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("allows forbidden terms inside explicit negative test fixtures", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-safety/__tests__/scanner.test.ts",
        content: `
          expect(findForbiddenObjectiveTerms("relapse_risk")).toHaveLength(1);
        `,
      },
      {
        path: "backend/src/retrieval_graph/__tests__/phase3NoLeakBoundaries.test.ts",
        content: `
          const unsafe = "craving_detected";
        `,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("supports an inline test-only allow marker for rare fixtures", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "tests/objective/fixtures/unsafe-fixture.ts",
        content: `
          const fixture = "intoxication_detected"; // @objective-safety-allow-forbidden-term
        `,
      },
    ]);

    expect(violations).toEqual([]);
  });

  it("throws a useful error with file and surface context", () => {
    expect(() =>
      assertNoForbiddenObjectiveTermViolations([
        {
          path: "packages/objective-schemas/src/unsafe.ts",
          surface: "api_field",
          content: `
            export const field = "detox_need";
          `,
        },
      ]),
    ).toThrow("packages/objective-schemas/src/unsafe.ts");
  });

  it("infers common surfaces from file paths when surface is omitted", () => {
    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "frontend/app/(clinician)/ciwa/page.tsx",
        content: `
          export const segment = "ciwa";
        `,
      },
      {
        path: "supabase/migrations/0002.sql",
        content: `
          alter table objective_sessions add column sobriety_status text;
        `,
      },
      {
        path: "frontend/components/objective-card.tsx",
        content: `
          export const copy = "stress_proven";
        `,
      },
    ]);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          term: "ciwa",
          surface: "route",
        }),
        expect.objectContaining({
          term: "sobriety_status",
          surface: "db_column",
        }),
        expect.objectContaining({
          term: "stress_proven",
          surface: "ui_copy",
        }),
      ]),
    );
  });
});
