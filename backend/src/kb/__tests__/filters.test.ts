import { buildKbFilterForPolicy } from "../filters.js";
import { getPolicyForCategory } from "../../safety/policies.js";

describe("buildKbFilterForPolicy", () => {
  it("builds alcohol craving KB filter for craving policy", () => {
    const policy = getPolicyForCategory("alcohol_craving");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toEqual({
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
    });
  });

  it("builds lapse KB filter for lapse policy", () => {
    const policy = getPolicyForCategory("lapse_or_relapse");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toEqual({
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
    });
  });

  it("builds general support KB filter for general support policy", () => {
    const policy = getPolicyForCategory("general_support");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toEqual({
      source: "internal_kb",
      substance: "alcohol",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
    });
  });

  it("returns null for template-only medication policy", () => {
    const policy = getPolicyForCategory("medication_or_dosage_request");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toBeNull();
  });

  it("returns null for template-only emergency policy", () => {
    const policy = getPolicyForCategory("possible_medical_emergency");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toBeNull();
  });

  it("returns null for template-only unsafe alcohol policy", () => {
    const policy = getPolicyForCategory("unsafe_alcohol_request");
    const filter = buildKbFilterForPolicy(policy);

    expect(filter).toBeNull();
  });
});