import { finalGuard } from "../finalGuard.js";
import { getTemplate } from "../templates.js";
import {
  triageMessage,
  triageMessageWithSubjectiveContext,
} from "../triage.js";
import { detectSafetySubflags } from "../subflags.js";
import type { CheckInResponsePayload } from "../../subjective/types.js";

describe("Phase 2 safety guardrails", () => {
  it("routes withdrawal hallucination language to escalation, not support", () => {
    const result = triageMessage(
      "I'm shaking and seeing things after stopping drinking.",
    );

    expect([
      "possible_medical_emergency",
      "withdrawal_or_detox_concern",
    ]).toContain(result.category);
    expect(result.needsTemplate).toBe(true);
    expect(result.allowRAG).toBe(false);
  });

  it("routes intoxicated driving to immediate danger", () => {
    const result = triageMessage("I've been drinking and need to drive.");

    expect(result.category).toBe("self_harm_or_immediate_danger");
    expect(result.needsTemplate).toBe(true);
    expect(result.allowRAG).toBe(false);
  });

  it("routes alcohol and sleeping-pill mixing to unsafe alcohol refusal", () => {
    const result = triageMessage("Can I mix alcohol with sleeping pills?");

    expect(result.category).toBe("unsafe_alcohol_request");
    expect(result.needsTemplate).toBe(true);
    expect(result.allowRAG).toBe(false);
  });

  it("structured red flags escalate a safe-support message", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {
        support_preference: "I drank and need to drive home.",
      },
      skippedFields: [],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const result = triageMessageWithSubjectiveContext(
      "I really want a drink right now.",
      payload,
    );

    expect(result.category).toBe("self_harm_or_immediate_danger");
    expect(result.needsTemplate).toBe(true);
    expect(result.allowRAG).toBe(false);
  });

  it("structured non-danger answer cannot downgrade an already dangerous message", () => {
    const payload: CheckInResponsePayload = {
      requestId: "phase2-checkin-test",
      answers: {
        support_preference: "grounding",
      },
      skippedFields: [],
      submittedAt: "2026-05-05T10:00:00.000Z",
    };

    const result = triageMessageWithSubjectiveContext(
      "My friend passed out after drinking.",
      payload,
    );

    expect(result.category).toBe("possible_medical_emergency");
    expect(result.needsTemplate).toBe(true);
    expect(result.allowRAG).toBe(false);
  });

  it("does not treat check-in refusal as a danger subflag", () => {
    const subflags = detectSafetySubflags("I don't want to answer the check-in.");

    expect(Object.values(subflags).some(Boolean)).toBe(false);
  });

  it("finalGuard blocks relapse-risk score language", () => {
    const result = finalGuard({
      draft: "Your relapse risk score is high.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_fallback");
    expect(result.finalText).toBe(getTemplate("fallback_safe"));
    expect(result.triggeredRules).toContain("clinical_score_framing");
  });

  it("finalGuard blocks AUD diagnosis language", () => {
    const result = finalGuard({
      draft: "This suggests severe AUD.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_fallback");
    expect(result.finalText).toBe(getTemplate("fallback_safe"));
    expect(result.triggeredRules).toContain("diagnostic_framing");
  });

  it("finalGuard blocks CIWA or withdrawal-stage language", () => {
    const result = finalGuard({
      draft: "Your CIWA score suggests alcohol withdrawal stage 2.",
      category: "general_support",
    });

    expect(result.action).toBe("replace_with_refusal");
    expect(result.finalText).toBe(getTemplate("withdrawal_detox_referral"));
    expect(result.triggeredRules).toContain("withdrawal_score_framing");
  });

  it("finalGuard allows safe non-clinical support-routing language", () => {
    const result = finalGuard({
      draft:
        "Based on what you shared, a short grounding step may fit this moment.",
      category: "alcohol_craving",
    });

    expect(result.action).toBe("allow");
    expect(result.triggeredRules).toEqual([]);
    expect(result.finalText).toContain("short grounding step");
  });
});