import { buildSafeResponsePrompt } from "../../src/retrieval_graph/prompts.js";

describe("Phase 2 safe response prompt", () => {
  it("includes safe subjective summary", () => {
    const prompt = buildSafeResponsePrompt({
      query: "I really want a drink right now.",
      context: "Approved support context.",
      mode: "craving_support",
      subjectiveStateSummary:
        "Current support context:\n- User-reported craving: very high.\n- Preferred support: practical step.",
    });

    expect(prompt).toContain("User-reported craving: very high.");
    expect(prompt).toContain("Preferred support: practical step.");
    expect(prompt).toContain("Treat subjective inputs as user-reported current experience");
  });

  it("forbids clinical scores and diagnosis", () => {
    const prompt = buildSafeResponsePrompt({
      query: "I answered the check-in.",
      context: "Approved support context.",
      mode: "general_support",
    });

    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Do not mention or create clinical scores");
    expect(prompt).toContain("CIWA");
    expect(prompt).toContain("treatment plans");
  });

  it("does not require subjective state", () => {
    const prompt = buildSafeResponsePrompt({
      query: "I had a long day.",
      context: "Approved support context.",
      mode: "general_support",
    });

    expect(prompt).toContain("No subjective-state summary is available");
  });
});