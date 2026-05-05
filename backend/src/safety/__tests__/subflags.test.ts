import {
  detectSafetySubflags,
  hasAnySafetySubflag,
} from "../subflags.js";
import type { CheckInResponsePayload } from "../../subjective/types.js";

describe("detectSafetySubflags", () => {
  it("detects unsafe driving after drinking", () => {
    const subflags = detectSafetySubflags(
      "I've been drinking and need to drive home.",
    );

    expect(subflags.unsafeDriving).toBe(true);
    expect(subflags.immediateDanger).toBe(true);
    expect(hasAnySafetySubflag(subflags)).toBe(true);
  });

  it("detects withdrawal and medical red flags", () => {
    const subflags = detectSafetySubflags(
      "I'm shaking and seeing things after stopping drinking.",
    );

    expect(subflags.possibleWithdrawalRedFlag).toBe(true);
    expect(subflags.possibleMedicalEmergencyRedFlag).toBe(true);
  });

  it("detects alcohol-medication mixing", () => {
    const subflags = detectSafetySubflags(
      "Can I mix alcohol with sleeping pills?",
    );

    expect(subflags.alcoholMedicationMix).toBe(true);
    expect(subflags.unsafeAlcoholRequest).toBe(true);
  });

  it("does not treat refusal to answer as a danger subflag", () => {
    const subflags = detectSafetySubflags("I don't want to answer.");

    expect(hasAnySafetySubflag(subflags)).toBe(false);
  });

  it("detects red flags inside structured check-in answers", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {
        support_preference: "I drank and need to drive home.",
      },
      skippedFields: [],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const subflags = detectSafetySubflags(payload);

    expect(subflags.unsafeDriving).toBe(true);
    expect(subflags.immediateDanger).toBe(true);
  });
});