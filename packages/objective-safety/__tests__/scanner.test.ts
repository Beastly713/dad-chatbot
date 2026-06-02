import {
  assertNoForbiddenObjectiveTerms,
  findForbiddenObjectiveTerms,
  hasForbiddenObjectiveTerms,
} from "../src/index.js";

describe("objective forbidden-term scanner", () => {
  it("passes clinician-safe bounded objective language", () => {
    const safeSource = `
      const target = "baseline_relative_elevated_physiological_arousal_evidence";
      const label = "stress_like_autonomic_activation_evidence";
      const evidence = "clinician-reviewable non-diagnostic physiological evidence";
      const visibility = {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false
      };
    `;

    expect(findForbiddenObjectiveTerms(safeSource)).toEqual([]);
    expect(hasForbiddenObjectiveTerms(safeSource)).toBe(false);
    expect(() => assertNoForbiddenObjectiveTerms(safeSource)).not.toThrow();
  });

  it("catches forbidden executable snake_case labels", () => {
    const unsafeSource = `
      const label = "craving_detected";
      const metric = "relapse_risk";
      const withdrawal = "withdrawal_risk";
    `;

    const matches = findForbiddenObjectiveTerms(unsafeSource);

    expect(matches).toEqual(
      expect.arrayContaining([
        { term: "craving_detected", category: "label" },
        { term: "relapse_risk", category: "label" },
        { term: "withdrawal_risk", category: "label" },
      ]),
    );
    expect(hasForbiddenObjectiveTerms(unsafeSource)).toBe(true);
  });

  it("catches forbidden executable camelCase fields", () => {
    const unsafeSource = `
      const dto = {
        relapseRisk: "high",
        ciwaScore: 12,
        patientIsLying: true
      };
    `;

    const matches = findForbiddenObjectiveTerms(unsafeSource);

    expect(matches).toEqual(
      expect.arrayContaining([
        { term: "relapseRisk", category: "field" },
        { term: "ciwaScore", category: "field" },
        { term: "patientIsLying", category: "field" },
      ]),
    );
  });

  it("catches forbidden route segments", () => {
    const unsafeSource = `
      const route = "/clinician/relapse-risk";
      const otherRoute = "/clinician/ciwa";
    `;

    const matches = findForbiddenObjectiveTerms(unsafeSource);

    expect(matches).toEqual(
      expect.arrayContaining([
        { term: "relapse-risk", category: "route_segment" },
        { term: "ciwa", category: "route_segment" },
      ]),
    );
  });

  it("throws with a useful error when forbidden terms are present", () => {
    expect(() =>
      assertNoForbiddenObjectiveTerms('const field = "intoxication_detected";'),
    ).toThrow("Forbidden objective terms found");
  });

  it("deduplicates repeated forbidden terms", () => {
    const matches = findForbiddenObjectiveTerms(`
      const a = "relapse_risk";
      const b = "relapse_risk";
    `);

    expect(matches.filter((match) => match.term === "relapse_risk")).toHaveLength(
      1,
    );
  });
});
