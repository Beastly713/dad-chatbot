// packages/objective-schemas/__tests__/visibility.test.ts

import {
  assertClinicianOnlyObjectiveVisibility,
  createObjectiveVisibilityFlags,
  normalizeObjectiveVisibilityFlags,
  validateObjectiveVisibilityFlags,
} from "../src/index.js";

describe("objective visibility schemas", () => {
  it("creates clinician-only objective visibility flags by default", () => {
    expect(createObjectiveVisibilityFlags()).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });
  });

  it("normalizes missing visibility to clinician-only defaults", () => {
    expect(normalizeObjectiveVisibilityFlags(undefined)).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });

    expect(normalizeObjectiveVisibilityFlags(null)).toEqual({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });
  });

  it("accepts explicit clinician-only visibility", () => {
    const result = validateObjectiveVisibilityFlags({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects patient-visible objective records", () => {
    const result = validateObjectiveVisibilityFlags({
      clinician_visible: true,
      patient_visible: true,
      chatbot_visible: false,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "patient_visible",
        }),
      ]),
    );
  });

  it("rejects chatbot-visible objective records", () => {
    const result = validateObjectiveVisibilityFlags({
      clinician_visible: true,
      patient_visible: false,
      chatbot_visible: true,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "chatbot_visible",
        }),
      ]),
    );
  });

  it("rejects records that are not clinician-visible", () => {
    const result = validateObjectiveVisibilityFlags({
      clinician_visible: false,
      patient_visible: false,
      chatbot_visible: false,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "clinician_visible",
        }),
      ]),
    );
  });

  it("assert helper throws on non-clinician-only visibility", () => {
    expect(() =>
      assertClinicianOnlyObjectiveVisibility({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: true,
      }),
    ).toThrow("Invalid objective visibility flags");
  });
});
