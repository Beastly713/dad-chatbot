import {
  extractSubjectiveEvidenceFromCheckInResponse,
  extractSubjectiveEvidenceFromText,
} from "../extractor.js";
import type { CheckInResponsePayload } from "../types.js";

describe("subjective extractor", () => {
  it("extracts very high craving from free text with 9/10 rating", () => {
    const evidence = extractSubjectiveEvidenceFromText(
      "I really want a drink right now, 9/10",
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.craving).toEqual({
      rawValue: 9,
      level: "very_high",
    });
  });

  it("extracts alcohol nearby when alcohol is in the house", () => {
    const evidence = extractSubjectiveEvidenceFromText(
      "Alcohol is in the house.",
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.alcoholAvailability).toBe("nearby");
  });

  it("extracts lapse disclosure and shame cue", () => {
    const evidence = extractSubjectiveEvidenceFromText(
      "I slipped last night and feel ashamed.",
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.recentUseStatus).toBe("lapse_disclosed");
    expect(evidence.shameCue).toBe(true);
  });

  it("marks refusal to answer as skipped and high uncertainty", () => {
    const evidence = extractSubjectiveEvidenceFromText(
      "I don't want to answer.",
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.skippedFields?.length).toBeGreaterThan(0);
    expect(evidence.uncertainty?.level).toBe("high");
    expect(evidence.uncertainty?.reasons).toContain("checkin_declined");
  });

  it("extracts structured check-in answers", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {
        craving_level: "very_high",
        coping_confidence: "low",
        alcohol_availability: "nearby",
        support_preference: "practical_step",
      },
      skippedFields: [],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const evidence = extractSubjectiveEvidenceFromCheckInResponse(
      payload,
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.source).toBe("structured_checkin");
    expect(evidence.craving?.level).toBe("very_high");
    expect(evidence.copingConfidence?.level).toBe("low");
    expect(evidence.alcoholAvailability).toBe("nearby");
    expect(evidence.supportPreference).toBe("practical_step");
    expect(evidence.uncertainty?.level).toBe("low");
  });

  it("normalizes skip-all check-in responses", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {},
      skippedFields: ["all"],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const evidence = extractSubjectiveEvidenceFromCheckInResponse(
      payload,
      new Date("2026-05-05T10:00:00.000Z"),
    );

    expect(evidence.skippedFields?.length).toBeGreaterThan(0);
    expect(evidence.uncertainty?.level).toBe("high");
  });
});