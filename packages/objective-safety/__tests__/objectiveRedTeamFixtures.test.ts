// packages/objective-safety/__tests__/objectiveRedTeamFixtures.test.ts

import {
  assertNoForbiddenObjectiveTermViolations,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

const redTeamUnsafeFixtures = [
  {
    name: "relapse-risk request",
    path: "services/objective-backend/src/redteamRelapseRisk.ts",
    surface: "source" as const,
    content: `
      export const unsafeObjectiveOutput = {
        relapse_risk: "high",
        relapseRiskDetected: true
      };
    `,
    expectedTerms: ["relapse_risk"],
  },
  {
    name: "craving-detector request",
    path: "services/objective-backend/src/redteamCravingDetector.ts",
    surface: "source" as const,
    content: `
      export const unsafeObjectiveOutput = {
        craving_detected: true
      };
    `,
    expectedTerms: ["craving_detected"],
  },
  {
    name: "lie-detector request",
    path: "services/objective-backend/src/redteamLieDetector.ts",
    surface: "source" as const,
    content: `
      export const unsafeObjectiveOutput = {
        patient_truthfulness: "low",
        patient_is_lying: true
      };
    `,
    expectedTerms: ["patient_truthfulness", "patient_is_lying"],
  },
  {
    name: "withdrawal or intoxication detector request",
    path: "services/objective-backend/src/redteamClinicalDetector.ts",
    surface: "api_field" as const,
    content: `
      export const unsafeObjectiveOutput = {
        withdrawal_risk: "severe",
        intoxication_detected: true,
        emergency_detected: true
      };
    `,
    expectedTerms: [
      "withdrawal_risk",
      "intoxication_detected",
      "emergency_detected",
    ],
  },
  {
    name: "treatment detox medication need request",
    path: "services/objective-backend/src/redteamTreatmentNeed.ts",
    surface: "api_field" as const,
    content: `
      export const unsafeObjectiveOutput = {
        treatment_need: true,
        detox_need: true,
        medication_need: true,
        CIWA_score: 18
      };
    `,
    expectedTerms: [
      "treatment_need",
      "detox_need",
      "medication_need",
      "CIWA_score",
    ],
  },
  {
    name: "unsafe route names",
    path: "frontend/app/(clinician)/clinician/withdrawal-risk/page.tsx#route-name",
    surface: "route" as const,
    content: "frontend/app/(clinician)/clinician/withdrawal-risk/page.tsx",
    expectedTerms: ["withdrawal-risk"],
  },
] as const;

const safeObjectiveOutputs = [
  {
    label: "baseline_or_low_arousal_evidence",
    summary:
      "Baseline or low arousal evidence is available for clinician review. This is source-bound and non-diagnostic.",
  },
  {
    label: "elevated_physiological_arousal_evidence",
    summary:
      "Baseline-relative elevated physiological arousal evidence is available for clinician review with uncertainty.",
  },
  {
    label: "recovery_cooldown_evidence",
    summary:
      "A recovery or cooldown trend is available as clinician-reviewable physiological evidence.",
  },
  {
    label: "motion_confounded_evidence",
    summary:
      "Motion or artifact context reduced readiness, so interpretation is limited.",
  },
  {
    label: "suppressed_for_quality",
    summary:
      "Interpretation suppressed because signal quality created a technical limitation.",
  },
  {
    label: "signal_conflict_uncertain",
    summary:
      "Cross-signal agreement limitation is present; interpretation remains uncertainty-bearing.",
  },
  {
    label: "insufficient_reliable_data",
    summary:
      "Insufficient reliable data is available for this objective review window.",
  },
] as const;

describe("objective red-team safety fixtures", () => {
  it.each(redTeamUnsafeFixtures)(
    "flags unsafe objective output for $name",
    (fixture) => {
      const violations = findForbiddenObjectiveTermViolations([
        {
          path: fixture.path,
          surface: fixture.surface,
          content: fixture.content,
        },
      ]);

      expect(violations.map((violation) => violation.term)).toEqual(
        expect.arrayContaining([...fixture.expectedTerms]),
      );
    },
  );

  it("throws on unsafe objective output instead of allowing executable labels", () => {
    expect(() =>
      assertNoForbiddenObjectiveTermViolations([
        {
          path: "services/objective-backend/src/unsafeObjectiveOutput.ts",
          surface: "source",
          content: `
            export const unsafe = {
              relapse_risk: "high",
              craving_detected: true,
              patient_is_safe: false
            };
          `,
        },
      ]),
    ).toThrow("Forbidden objective terms found");
  });

  it("allows only bounded non-diagnostic objective output language", () => {
    const content = JSON.stringify(
      {
        visibility: {
          clinician_visible: true,
          patient_visible: false,
          chatbot_visible: false,
        },
        outputs: safeObjectiveOutputs,
        safeVocabulary: [
          "evidence",
          "pattern",
          "review item",
          "quality notice",
          "signal note",
          "interpretation suppressed",
          "insufficient reliable data",
          "baseline-relative",
          "source context",
          "not diagnostic",
          "clinician-reviewable",
          "uncertainty-bearing",
          "technical limitation",
          "quality/readiness context",
        ],
      },
      null,
      2,
    );

    expect(
      findForbiddenObjectiveTermViolations([
        {
          path: "services/objective-backend/src/safeObjectiveOutputs.ts",
          surface: "source",
          content,
        },
      ]),
    ).toEqual([]);
  });
});
