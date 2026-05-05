import { createDefaultSubjectiveState } from "../types.js";
import { reduceSubjectiveState } from "../reducer.js";
import type { SubjectiveEvidence } from "../types.js";

describe("subjective reducer", () => {
  it("lets structured answers outrank free-text guesses", () => {
    const now = new Date("2026-05-05T10:00:00.000Z");

    const freeText: SubjectiveEvidence = {
      source: "free_text",
      substance: "alcohol",
      observedAt: now.toISOString(),
      craving: {
        level: "high",
      },
    };

    const structured: SubjectiveEvidence = {
      source: "structured_checkin",
      substance: "alcohol",
      observedAt: now.toISOString(),
      craving: {
        level: "low",
      },
    };

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence: [freeText, structured],
      now,
    });

    expect(state.cravingLevel).toBe("low");
  });

  it("never downgrades existing safety subflags", () => {
    const current = createDefaultSubjectiveState();
    current.safetySubflags.unsafeDriving = true;

    const evidence: SubjectiveEvidence = {
      source: "structured_checkin",
      substance: "alcohol",
      observedAt: "2026-05-05T10:00:00.000Z",
      safetySubflags: {
        unsafeDriving: false,
      },
    };

    const state = reduceSubjectiveState({
      currentState: current,
      evidence: [evidence],
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(state.safetySubflags.unsafeDriving).toBe(true);
  });

  it("skips increase uncertainty but do not block support state", () => {
    const evidence: SubjectiveEvidence = {
      source: "structured_checkin",
      substance: "alcohol",
      observedAt: "2026-05-05T10:00:00.000Z",
      supportPreference: "skip",
      skippedFields: ["craving_level", "support_preference"],
      uncertainty: {
        level: "high",
        reasons: ["checkin_declined"],
      },
    };

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence: [evidence],
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(state.supportPreference).toBe("skip");
    expect(state.uncertainty.level).toBe("high");
    expect(state.uncertainty.reasons).toContain("checkin_skipped");
  });

  it("contradictions increase uncertainty", () => {
    const evidence: SubjectiveEvidence = {
      source: "free_text",
      substance: "alcohol",
      observedAt: "2026-05-05T10:00:00.000Z",
      contradictionHint: true,
    };

    const state = reduceSubjectiveState({
      currentState: createDefaultSubjectiveState(),
      evidence: [evidence],
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(state.contradictionHint).toBe(true);
    expect(state.uncertainty.level).toBe("high");
    expect(state.uncertainty.reasons).toContain("contradiction_hint");
  });

  it("marks stale state uncertain when no new evidence exists", () => {
    const current = createDefaultSubjectiveState();
    current.updatedAt = "2026-05-05T09:00:00.000Z";
    current.uncertainty = {
      level: "low",
      reasons: ["fresh_subjective_evidence"],
    };

    const state = reduceSubjectiveState({
      currentState: current,
      evidence: [],
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(state.uncertainty.level).toBe("high");
    expect(state.uncertainty.reasons).toContain("stale_subjective_state");
  });
});