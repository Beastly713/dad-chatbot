import { alcoholPhase2Docs } from "../seed/alcoholPhase2.js";

const SAFE_RAG_CATEGORIES = [
  "alcohol_craving",
  "lapse_or_relapse",
  "general_support",
];

const FORBIDDEN_KB_PATTERNS = [
  /\bdetox\b/i,
  /\btaper\b/i,
  /\bwithdrawal management\b/i,
  /\bmedication\b/i,
  /\bdosage\b/i,
  /\bmg\b/i,
  /\bciwa\b/i,
  /\bdiagnos(e|is)\b/i,
  /\btreatment plan\b/i,
  /\bsafe amount to drink\b/i,
];

describe("Phase 2 alcohol KB seed documents", () => {
  it("contains Phase 2 alcohol support documents", () => {
    expect(alcoholPhase2Docs.length).toBeGreaterThanOrEqual(8);
  });

  it("uses approved internal alcohol KB metadata", () => {
    for (const doc of alcoholPhase2Docs) {
      expect(doc.metadata.source).toBe("internal_kb");
      expect(doc.metadata.substance).toBe("alcohol");
      expect(doc.metadata.approved).toBe(true);
      expect(doc.metadata.userVisible).toBe(true);
      expect(doc.metadata.version).toBe("phase2-v1");
    }
  });

  it("uses only safe RAG risk categories", () => {
    for (const doc of alcoholPhase2Docs) {
      expect(SAFE_RAG_CATEGORIES).toContain(doc.metadata.riskCategory);
    }
  });

  it("includes Phase 2 state metadata tags", () => {
    for (const doc of alcoholPhase2Docs) {
      expect(doc.metadata.supportNeed).toBeTruthy();
      expect(doc.metadata.stateTag).toBeTruthy();
      expect(doc.metadata.deliveryStyle).toBeTruthy();
    }
  });

  it("does not include detox, medication, diagnosis, scoring, or unsafe alcohol guidance", () => {
    for (const doc of alcoholPhase2Docs) {
      for (const pattern of FORBIDDEN_KB_PATTERNS) {
        expect(doc.pageContent).not.toMatch(pattern);
      }
    }
  });
});