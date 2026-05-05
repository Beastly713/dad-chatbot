import type {
  AlcoholAvailability,
  CheckInAnswerValue,
  CheckInField,
  CheckInResponsePayload,
  OrdinalLevel,
  RecentUseStatus,
  SafetySubflags,
  SocialContext,
  SubjectiveEvidence,
  SupportPreference,
} from "./types.js";
import { createDefaultSafetySubflags } from "./types.js";
import { ALL_CHECKIN_FIELDS } from "./questions.js";

const ORDINAL_LEVELS: OrdinalLevel[] = [
  "none",
  "low",
  "moderate",
  "high",
  "very_high",
  "unclear",
];

const SUPPORT_PREFERENCES: SupportPreference[] = [
  "grounding",
  "practical_step",
  "reflection",
  "encouragement",
  "contact_someone",
  "skip",
  "unclear",
];

const RECENT_USE_STATUSES: RecentUseStatus[] = [
  "none_disclosed",
  "recent_drinking",
  "lapse_disclosed",
  "ongoing_drinking",
  "unclear",
];

const ALCOHOL_AVAILABILITY_VALUES: AlcoholAvailability[] = [
  "nearby",
  "not_nearby",
  "unclear",
];

const SOCIAL_CONTEXT_VALUES: SocialContext[] = [
  "alone",
  "with_supportive_person",
  "with_drinking_others",
  "feeling_pressure",
  "unclear",
];

function normalizeText(input: string): string {
  return input.toLowerCase().trim();
}

function isOrdinalLevel(value: string): value is OrdinalLevel {
  return ORDINAL_LEVELS.includes(value as OrdinalLevel);
}

function isSupportPreference(value: string): value is SupportPreference {
  return SUPPORT_PREFERENCES.includes(value as SupportPreference);
}

function isRecentUseStatus(value: string): value is RecentUseStatus {
  return RECENT_USE_STATUSES.includes(value as RecentUseStatus);
}

function isAlcoholAvailability(value: string): value is AlcoholAvailability {
  return ALCOHOL_AVAILABILITY_VALUES.includes(value as AlcoholAvailability);
}

function isSocialContext(value: string): value is SocialContext {
  return SOCIAL_CONTEXT_VALUES.includes(value as SocialContext);
}

export function numberToOrdinalLevel(value: number): OrdinalLevel {
  if (!Number.isFinite(value)) return "unclear";
  if (value <= 0) return "none";
  if (value <= 2) return "low";
  if (value <= 5) return "moderate";
  if (value <= 8) return "high";
  if (value <= 10) return "very_high";
  return "unclear";
}

export function answerValueToOrdinalLevel(
  value: CheckInAnswerValue,
): { rawValue?: number; level: OrdinalLevel } {
  if (typeof value === "number") {
    return {
      rawValue: value,
      level: numberToOrdinalLevel(value),
    };
  }

  if (typeof value !== "string") {
    return { level: "unclear" };
  }

  const normalized = normalizeText(value);

  const tenPointMatch = normalized.match(/\b(10|[0-9])\s*\/\s*10\b/);
  if (tenPointMatch) {
    const rawValue = Number(tenPointMatch[1]);
    return {
      rawValue,
      level: numberToOrdinalLevel(rawValue),
    };
  }

  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    return {
      rawValue: numeric,
      level: numberToOrdinalLevel(numeric),
    };
  }

  if (isOrdinalLevel(normalized)) {
    return { level: normalized };
  }

  if (/very\s+strong|very\s+high|intense|overwhelming/.test(normalized)) {
    return { level: "very_high" };
  }

  if (/strong|high|bad|a lot|really/.test(normalized)) {
    return { level: "high" };
  }

  if (/moderate|medium|some/.test(normalized)) {
    return { level: "moderate" };
  }

  if (/mild|low|little|not much/.test(normalized)) {
    return { level: "low" };
  }

  if (/none|no urge|no craving/.test(normalized)) {
    return { level: "none" };
  }

  return { level: "unclear" };
}

function extractTenPointRatingFromText(text: string): number | undefined {
  const match = text.match(/\b(10|[0-9])\s*\/\s*10\b/);
  if (!match) return undefined;

  return Number(match[1]);
}

function detectCraving(text: string): { rawValue?: number; level: OrdinalLevel } | undefined {
  const cravingCue =
    /\b(crav(e|ing)|urge|want a drink|need a drink|really want a drink|drink right now)\b/.test(
      text,
    );

  if (!cravingCue) return undefined;

  const rating = extractTenPointRatingFromText(text);
  if (rating !== undefined) {
    return {
      rawValue: rating,
      level: numberToOrdinalLevel(rating),
    };
  }

  if (/really|strong|bad|intense|right now/.test(text)) {
    return { level: "high" };
  }

  return { level: "moderate" };
}

function detectDistress(text: string): { rawValue?: number; level: OrdinalLevel } | undefined {
  const distressCue =
    /\b(overwhelmed|distressed|panic|anxious|stressed|upset|can'?t handle)\b/.test(
      text,
    );

  if (!distressCue) return undefined;

  const rating = extractTenPointRatingFromText(text);
  if (rating !== undefined) {
    return {
      rawValue: rating,
      level: numberToOrdinalLevel(rating),
    };
  }

  if (/panic|very|can'?t handle|overwhelmed/.test(text)) {
    return { level: "high" };
  }

  return { level: "moderate" };
}

function detectRecentUseStatus(text: string): RecentUseStatus | undefined {
  if (/\b(slipped|lapse|lapsed|relapsed)\b/.test(text)) {
    return "lapse_disclosed";
  }

  if (/\b(still drinking|keep drinking|currently drinking|drinking right now)\b/.test(text)) {
    return "ongoing_drinking";
  }

  if (/\b(drank|been drinking|had alcohol|had a drink)\b/.test(text)) {
    return "recent_drinking";
  }

  return undefined;
}

function detectAlcoholAvailability(text: string): AlcoholAvailability | undefined {
  if (
    /\b(no alcohol nearby|nothing nearby|not nearby|not in the house|away from alcohol)\b/.test(
      text,
    )
  ) {
    return "not_nearby";
  }

  if (
    /\b(alcohol|beer|wine|liquor|bottle|vodka|whiskey|whisky)\b/.test(text) &&
    /\b(in the house|at home|nearby|near me|right here|in my room|in the fridge)\b/.test(
      text,
    )
  ) {
    return "nearby";
  }

  if (/\balcohol is in the house\b/.test(text)) {
    return "nearby";
  }

  return undefined;
}

function detectSocialContext(text: string): SocialContext | undefined {
  if (/\balone\b/.test(text)) return "alone";

  if (/\b(friend|partner|family|sponsor|supportive person)\b/.test(text)) {
    return "with_supportive_person";
  }

  if (/\bparty|bar|drinking with|everyone is drinking\b/.test(text)) {
    return "with_drinking_others";
  }

  if (/\bpressure|pressuring me|pushing me to drink\b/.test(text)) {
    return "feeling_pressure";
  }

  return undefined;
}

function detectSupportPreference(text: string): SupportPreference | undefined {
  if (/\bground(ing)?\b/.test(text)) return "grounding";
  if (/\bpractical|one step|next step|what should i do\b/.test(text)) {
    return "practical_step";
  }
  if (/\breflect|talk through|understand why\b/.test(text)) return "reflection";
  if (/\bencouragement|encourage|reassure\b/.test(text)) return "encouragement";
  if (/\bcall someone|text someone|reach out|support person\b/.test(text)) {
    return "contact_someone";
  }
  if (/\bskip|don'?t want to answer|do not want to answer|rather not answer\b/.test(text)) {
    return "skip";
  }

  return undefined;
}

function detectTriggerContext(text: string): string[] {
  const triggers = new Set<string>();

  if (/\bstress|stressed|long day\b/.test(text)) triggers.add("stress");
  if (/\blonely|alone\b/.test(text)) triggers.add("loneliness");
  if (/\bargument|fight|conflict\b/.test(text)) triggers.add("conflict");
  if (/\bparty|bar|social\b/.test(text)) triggers.add("social_event");
  if (/\bhabit|routine|usual time\b/.test(text)) triggers.add("habit");
  if (/\bhome|house|room\b/.test(text)) triggers.add("place");

  return [...triggers];
}

function detectSkip(text: string): boolean {
  return /\b(skip|don'?t want to answer|do not want to answer|rather not answer|no questions)\b/.test(
    text,
  );
}

function detectVagueAnswer(text: string): boolean {
  return /\b(i don'?t know|idk|maybe|not sure|unsure|whatever)\b/.test(text);
}

function detectShameCue(text: string): boolean {
  return /\b(ashamed|shame|guilty|failure|failed|worthless|disappointed in myself)\b/.test(
    text,
  );
}

function detectContradictionHint(text: string): boolean {
  return (
    /\b(2|two|low|not much)\b.*\b(about to drink|going to drink|can'?t stop)\b/.test(
      text,
    ) ||
    /\b(no craving|not craving)\b.*\b(about to drink|going to drink)\b/.test(text)
  );
}

export function extractSubjectiveEvidenceFromText(
  rawText: string,
  now: Date = new Date(),
): SubjectiveEvidence {
  const text = normalizeText(rawText);

  const skipped = detectSkip(text);
  const vagueAnswer = detectVagueAnswer(text);
  const contradictionHint = detectContradictionHint(text);

  const craving = detectCraving(text);
  const distress = detectDistress(text);
  const recentUseStatus = detectRecentUseStatus(text);
  const alcoholAvailability = detectAlcoholAvailability(text);
  const socialContext = detectSocialContext(text);
  const supportPreference = detectSupportPreference(text);
  const triggerContext = detectTriggerContext(text);
  const shameCue = detectShameCue(text);

  return {
    source: "free_text",
    substance: "alcohol",
    observedAt: now.toISOString(),

    craving,
    distress,
    recentUseStatus,
    alcoholAvailability,
    socialContext,
    supportPreference,
    triggerContext,

    shameCue,
    skippedFields: skipped ? ALL_CHECKIN_FIELDS : [],
    vagueAnswer,
    contradictionHint,

    safetySubflags: createDefaultSafetySubflags(),
    uncertainty: {
      level: skipped || contradictionHint ? "high" : vagueAnswer ? "medium" : "medium",
      reasons: [
        ...(skipped ? ["checkin_declined"] : []),
        ...(vagueAnswer ? ["vague_answer"] : []),
        ...(contradictionHint ? ["contradiction_hint"] : []),
        "free_text_only",
      ],
    },
  };
}

function parseStructuredField(
  field: CheckInField,
  value: CheckInAnswerValue,
): Partial<SubjectiveEvidence> {
  if (field === "craving_level") {
    return {
      craving: answerValueToOrdinalLevel(value),
    };
  }

  if (field === "distress_level") {
    return {
      distress: answerValueToOrdinalLevel(value),
    };
  }

  if (field === "coping_confidence") {
    return {
      copingConfidence: answerValueToOrdinalLevel(value),
    };
  }

  if (field === "support_preference" && typeof value === "string") {
    const normalized = normalizeText(value);
    return {
      supportPreference: isSupportPreference(normalized)
        ? normalized
        : "unclear",
    };
  }

  if (field === "recent_use_status" && typeof value === "string") {
    const normalized = normalizeText(value);
    return {
      recentUseStatus: isRecentUseStatus(normalized)
        ? normalized
        : "unclear",
    };
  }

  if (field === "alcohol_availability" && typeof value === "string") {
    const normalized = normalizeText(value);
    return {
      alcoholAvailability: isAlcoholAvailability(normalized)
        ? normalized
        : "unclear",
    };
  }

  if (field === "social_context" && typeof value === "string") {
    const normalized = normalizeText(value);
    return {
      socialContext: isSocialContext(normalized) ? normalized : "unclear",
    };
  }

  if (field === "trigger_context" && typeof value === "string") {
    return {
      triggerContext: detectTriggerContext(normalizeText(value)),
    };
  }

  return {};
}

export function normalizeSkippedFields(
  skippedFields: CheckInResponsePayload["skippedFields"],
): CheckInField[] {
  if (skippedFields.length === 1 && skippedFields[0] === "all") {
    return ALL_CHECKIN_FIELDS;
  }

  return skippedFields as CheckInField[];
}

export function extractSubjectiveEvidenceFromCheckInResponse(
  payload: CheckInResponsePayload,
  now: Date = new Date(),
): SubjectiveEvidence {
  const skippedFields = normalizeSkippedFields(payload.skippedFields);
  const skippedAll =
  payload.skippedFields.length === 1 && payload.skippedFields[0] === "all";

  let evidence: SubjectiveEvidence = {
    source: "structured_checkin",
    substance: "alcohol",
    observedAt: now.toISOString(),
    skippedFields,
    safetySubflags: createDefaultSafetySubflags(),
    uncertainty: {
      level: skippedAll ? "high" : skippedFields.length > 0 ? "medium" : "low",
      reasons: [
        ...(skippedAll ? ["checkin_declined"] : []),
        ...(skippedFields.length > 0 && !skippedAll ? ["some_fields_skipped"] : []),
        "structured_checkin",
      ],
    },
  };

  for (const [field, value] of Object.entries(payload.answers) as [
    CheckInField,
    CheckInAnswerValue,
  ][]) {
    evidence = {
      ...evidence,
      ...parseStructuredField(field, value),
    };
  }

  const freeTextSafetySurface = Object.values(payload.answers)
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  if (freeTextSafetySurface.trim().length > 0) {
    const textEvidence = extractSubjectiveEvidenceFromText(
      freeTextSafetySurface,
      now,
    );

    evidence = {
      ...evidence,
      shameCue: evidence.shameCue ?? textEvidence.shameCue,
      vagueAnswer: evidence.vagueAnswer ?? textEvidence.vagueAnswer,
      contradictionHint:
        evidence.contradictionHint ?? textEvidence.contradictionHint,
      triggerContext: [
        ...(evidence.triggerContext ?? []),
        ...(textEvidence.triggerContext ?? []),
      ],
    };
  }

  return evidence;
}

export function extractSubjectiveEvidence(params: {
  query?: string;
  checkInResponse?: CheckInResponsePayload | null;
  now?: Date;
}): SubjectiveEvidence[] {
  const now = params.now ?? new Date();
  const evidence: SubjectiveEvidence[] = [];

  if (params.query && params.query.trim().length > 0) {
    evidence.push(extractSubjectiveEvidenceFromText(params.query, now));
  }

  if (params.checkInResponse) {
    evidence.push(
      extractSubjectiveEvidenceFromCheckInResponse(
        params.checkInResponse,
        now,
      ),
    );
  }

  return evidence;
}

export function mergeSafetySubflags(
  current: SafetySubflags,
  incoming?: Partial<SafetySubflags>,
): SafetySubflags {
  if (!incoming) return current;

  return {
    selfHarmConcern: current.selfHarmConcern || incoming.selfHarmConcern === true,
    immediateDanger: current.immediateDanger || incoming.immediateDanger === true,
    possibleMedicalEmergencyRedFlag:
      current.possibleMedicalEmergencyRedFlag ||
      incoming.possibleMedicalEmergencyRedFlag === true,
    possibleWithdrawalRedFlag:
      current.possibleWithdrawalRedFlag ||
      incoming.possibleWithdrawalRedFlag === true,
    unsafeDriving: current.unsafeDriving || incoming.unsafeDriving === true,
    alcoholMedicationMix:
      current.alcoholMedicationMix || incoming.alcoholMedicationMix === true,
    intoxicationUncertain:
      current.intoxicationUncertain || incoming.intoxicationUncertain === true,
    unsafeAlcoholRequest:
      current.unsafeAlcoholRequest || incoming.unsafeAlcoholRequest === true,
  };
}