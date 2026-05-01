import { getPolicyForCategory } from "./policies.js";
import type { RiskCategory, TriageResult } from "./types.js";

type RuleGroup = {
  category: RiskCategory;
  patterns: RegExp[];
};

/**
 * Highest-priority category.
 *
 * Includes direct self-harm language and immediate danger cases such as
 * intoxicated driving. In Phase 1, these are routed to fixed escalation
 * templates, not RAG or LLM generation.
 */
const SELF_HARM_OR_IMMEDIATE_DANGER_PATTERNS = [
  /\bkill myself\b/i,
  /\bend it all\b/i,
  /\bdon'?t want to live\b/i,
  /\bwant to die\b/i,
  /\bhurt myself\b/i,
  /\bmight hurt myself\b/i,
  /\bsuicide\b/i,

  // Explicit intoxicated-driving danger rules.
  /\b(drinking|drunk|alcohol|had a drink|had drinks|been drinking)\b.*\b(drive|driving|drive home)\b/i,
  /\bneed to drive\b.*\b(alcohol|drunk|drinking|been drinking)\b/i,
];

const MEDICAL_EMERGENCY_PATTERNS = [
  /\bpassed out\b/i,
  /\bunconscious\b/i,
  /\bwon'?t wake up\b/i,
  /\bnot breathing\b/i,
  /\bcan'?t breathe\b/i,
  /\bchoking\b/i,
  /\balcohol poisoning\b/i,
  /\bseizure\b/i,
  /\bhallucinat/i,
  /\bseeing things\b/i,
  /\bi see things\b/i,
];

const WITHDRAWAL_DETOX_PATTERNS = [
  /\bwithdrawal\b/i,
  /\bwithdrawals\b/i,
  /\bdetox\b/i,
  /\bcold turkey\b/i,
  /\bshaking\b/i,
  /\btremors?\b/i,
  /\bsweat(y|ing)?\b/i,
  /\bstopping drinking\b/i,
  /\bstopped drinking\b/i,
  /\bafter not drinking\b/i,
];

/**
 * Special unsafe alcohol-medication mixing rules.
 *
 * These intentionally route to unsafe_alcohol_request rather than
 * medication_or_dosage_request because the user is asking about unsafe alcohol
 * use involving pills/medications, not simply asking for a medication dose.
 */
const UNSAFE_ALCOHOL_MEDICATION_MIX_PATTERNS = [
  /\bmix\b.*\balcohol\b.*\b(pills?|meds?|medications?|medicine|sleeping pills?)\b/i,
  /\bmix\b.*\b(pills?|meds?|medications?|medicine|sleeping pills?)\b.*\balcohol\b/i,
  /\balcohol\b.*\bwith\b.*\b(pills?|meds?|medications?|medicine|sleeping pills?)\b/i,
  /\b(pills?|meds?|medications?|medicine|sleeping pills?)\b.*\bwith\b.*\balcohol\b/i,
];

const MEDICATION_PATTERNS = [
  /\bdose\b/i,
  /\bdosage\b/i,
  /\b\d+\s?(mg|ml|tablets?|pills?)\b/i,
  /\btablet(s)?\b/i,
  /\bpill(s)?\b/i,
  /\bmedication\b/i,
  /\bmedicine\b/i,
  /\blibrium\b/i,
  /\bdiazepam\b/i,
  /\bbenzodiazepine\b/i,
  /\bnaltrexone\b/i,
  /\bacamprosate\b/i,
  /\bdisulfiram\b/i,
  /\bwhat should i take\b/i,
  /\bhow much\b.*\b(take|use)\b/i,
  /\bhow much .* should i take\b/i,
];

const UNSAFE_ALCOHOL_PATTERNS = [
  /\bget drunk faster\b/i,
  /\bhide my drinking\b/i,
  /\bhide drinking\b/i,
  /\bcover up drinking\b/i,
  /\bdrink without .* knowing\b/i,
  /\bsober up fast\b/i,
  /\bhow do i sober up\b/i,
  /\bhow much can i drink\b/i,
  /\bhow much\b.*\bdrink\b/i,
  /\bmix .* alcohol\b/i,
  /\balcohol .* mix\b/i,
  /\bdrink more\b/i,
];

const CRAVING_PATTERNS = [
  /\bcraving\b/i,
  /\burge\b/i,
  /\breally want .*drink\b/i,
  /\breally want .*alcohol\b/i,
  /\bneed a drink\b/i,
  /\bwant a drink\b/i,
  /\bwant alcohol\b/i,
  /\bcraving beer\b/i,
  /\bcraving wine\b/i,
  /\bcraving liquor\b/i,
];

const LAPSE_PATTERNS = [
  /\brelapse\b/i,
  /\brelapsed\b/i,
  /\bslipped\b/i,
  /\bslip up\b/i,
  /\bdrank again\b/i,
  /\bhad a drink\b/i,
  /\bafter quitting\b/i,
  /\bafter being sober\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /\bignore (your|the) instructions\b/i,
  /\bignore (your|the) rules\b/i,
  /\bhidden instructions\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper message\b/i,
  /\bpretend to be\b/i,
  /\bjailbreak\b/i,
  /\bbypass\b/i,
  /\bdeveloper mode\b/i,
];

/**
 * Keep this deliberately conservative for Phase 1.
 *
 * If the message contains alcohol/recovery language and does not match a higher
 * risk category, default to general_support. Only clearly unrelated requests are
 * treated as out of scope.
 */
const ALCOHOL_OR_RECOVERY_CONTEXT_PATTERNS = [
  /\balcohol\b/i,
  /\bdrink\b/i,
  /\bdrinking\b/i,
  /\bdrank\b/i,
  /\bbeer\b/i,
  /\bwine\b/i,
  /\bliquor\b/i,
  /\bvodka\b/i,
  /\bwhiskey\b/i,
  /\bsober\b/i,
  /\bsobriety\b/i,
  /\brecovery\b/i,
  /\bcraving\b/i,
  /\burge\b/i,
  /\blapse\b/i,
  /\brelapse\b/i,
  /\bquit\b/i,
  /\bquitting\b/i,
  /\baddiction\b/i,
];

const CLEARLY_OUT_OF_SCOPE_PATTERNS = [
  /\bcapital of\b/i,
  /\bweather\b/i,
  /\bstock price\b/i,
  /\bwrite code\b/i,
  /\bdebug\b/i,
  /\brecipe\b/i,
  /\bmovie\b/i,
  /\bsports\b/i,
  /\bhomework\b/i,
  /\btranslate\b/i,
];

function matchPatterns(text: string, patterns: RegExp[]): string[] {
  return patterns.filter((pattern) => pattern.test(text)).map((p) => p.source);
}

function buildResult(category: RiskCategory, matchedRules: string[]): TriageResult {
  const policy = getPolicyForCategory(category);

  return {
    category,
    confidence: matchedRules.length > 0 ? 1 : 0.6,
    matchedRules,
    needsTemplate: policy.useTemplateOnly,
    allowRAG: policy.allowRAG,
  };
}

function isLikelyOutOfScope(text: string): boolean {
  const hasAlcoholContext = ALCOHOL_OR_RECOVERY_CONTEXT_PATTERNS.some((pattern) =>
    pattern.test(text),
  );

  if (hasAlcoholContext) {
    return false;
  }

  return CLEARLY_OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text));
}

export function triageMessage(message: string): TriageResult {
  const text = message.trim().toLowerCase();

  /**
   * Priority order matters.
   *
   * Self-harm/immediate danger and medical emergencies outrank everything.
   * Prompt injection is intentionally checked late, after dangerous requests.
   */
  const checks: RuleGroup[] = [
    {
      category: "self_harm_or_immediate_danger",
      patterns: SELF_HARM_OR_IMMEDIATE_DANGER_PATTERNS,
    },
    {
      category: "possible_medical_emergency",
      patterns: MEDICAL_EMERGENCY_PATTERNS,
    },
    {
      category: "withdrawal_or_detox_concern",
      patterns: WITHDRAWAL_DETOX_PATTERNS,
    },

    /**
     * Specific exception:
     * alcohol + medications/pills/sleeping pills routes to unsafe alcohol
     * refusal, not medication dosage refusal.
     */
    {
      category: "unsafe_alcohol_request",
      patterns: UNSAFE_ALCOHOL_MEDICATION_MIX_PATTERNS,
    },
    {
      category: "medication_or_dosage_request",
      patterns: MEDICATION_PATTERNS,
    },
    {
      category: "unsafe_alcohol_request",
      patterns: UNSAFE_ALCOHOL_PATTERNS,
    },
    {
      category: "alcohol_craving",
      patterns: CRAVING_PATTERNS,
    },
    {
      category: "lapse_or_relapse",
      patterns: LAPSE_PATTERNS,
    },
    {
      category: "prompt_injection_or_policy_bypass",
      patterns: PROMPT_INJECTION_PATTERNS,
    },
  ];

  for (const check of checks) {
    const matchedRules = matchPatterns(text, check.patterns);

    if (matchedRules.length > 0) {
      return buildResult(check.category, matchedRules);
    }
  }

  if (isLikelyOutOfScope(text)) {
    return {
      category: "out_of_scope",
      confidence: 0.7,
      matchedRules: [],
      needsTemplate: true,
      allowRAG: false,
    };
  }

  return {
    category: "general_support",
    confidence: 0.6,
    matchedRules: [],
    needsTemplate: false,
    allowRAG: true,
  };
}