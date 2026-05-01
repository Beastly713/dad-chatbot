import type { ResponsePolicy } from "../safety/types.js";

export type InternalAlcoholKbFilter = {
  source: "internal_kb";
  substance: "alcohol";
  riskCategory: "general_support" | "alcohol_craving" | "lapse_or_relapse";
  userVisible: true;
  approved: true;
};

export function buildKbFilterForPolicy(
  policy: ResponsePolicy,
): InternalAlcoholKbFilter | null {
  if (!policy.allowRAG || !policy.kbFilter) {
    return null;
  }

  return {
    source: "internal_kb",
    substance: "alcohol",
    riskCategory: policy.kbFilter.riskCategory,
    userVisible: true,
    approved: true,
  };
}