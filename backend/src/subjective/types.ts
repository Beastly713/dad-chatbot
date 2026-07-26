export type SubstanceId = "alcohol" | (string & Record<never, never>);

export type OrdinalLevel =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "very_high"
  | "unclear";

export type SubjectiveUncertaintyLevel = "low" | "medium" | "high";

export type SupportPreference =
  | "grounding"
  | "practical_step"
  | "reflection"
  | "encouragement"
  | "contact_someone"
  | "skip"
  | "unclear";

export type RecentUseStatus =
  | "none_disclosed"
  | "recent_drinking"
  | "lapse_disclosed"
  | "ongoing_drinking"
  | "unclear";

export type AlcoholAvailability = "nearby" | "not_nearby" | "unclear";

export type SocialContext =
  | "alone"
  | "with_supportive_person"
  | "with_drinking_others"
  | "feeling_pressure"
  | "unclear";

export type TrendDirection = "rising" | "falling" | "stable" | "unclear";

export type AllowedResponseInfluence =
  | "none"
  | "style_only"
  | "style_plus_coping"
  | "escalation_only";

export type CheckInField =
  | "craving_level"
  | "distress_level"
  | "coping_confidence"
  | "alcohol_availability"
  | "support_preference"
  | "recent_use_status"
  | "social_context"
  | "trigger_context";

export type SubjectiveEvidenceSource =
  | "free_text"
  | "structured_checkin"
  | "carry_forward"
  | "default";

export type SubjectiveNumericEvidence = {
  rawValue?: number;
  level: OrdinalLevel;
};

export type SafetySubflags = {
  selfHarmConcern: boolean;
  immediateDanger: boolean;
  possibleMedicalEmergencyRedFlag: boolean;
  possibleWithdrawalRedFlag: boolean;
  unsafeDriving: boolean;
  alcoholMedicationMix: boolean;
  intoxicationUncertain: boolean;
  unsafeAlcoholRequest: boolean;
};

export type SubjectiveUncertainty = {
  level: SubjectiveUncertaintyLevel;
  reasons: string[];
};

export type SubjectiveState = {
  substance: SubstanceId;

  cravingLevel: OrdinalLevel;
  cravingRawValue?: number;

  distressLevel: OrdinalLevel;
  distressRawValue?: number;

  copingConfidence: OrdinalLevel;
  copingConfidenceRawValue?: number;

  supportPreference: SupportPreference;
  recentUseStatus: RecentUseStatus;
  alcoholAvailability: AlcoholAvailability;
  socialContext: SocialContext;

  triggerContext: string[];

  shameCue: boolean;
  skippedFields: CheckInField[];
  contradictionHint: boolean;
  vagueAnswer: boolean;

  safetySubflags: SafetySubflags;
  uncertainty: SubjectiveUncertainty;

  cravingTrend: TrendDirection;
  distressTrend: TrendDirection;
  copingConfidenceTrend: TrendDirection;

  allowedResponseInfluence: AllowedResponseInfluence;

  evidenceCount: number;
  updatedAt?: string;
};

export type SubjectiveEvidence = {
  source: SubjectiveEvidenceSource;
  substance: SubstanceId;
  observedAt: string;

  craving?: SubjectiveNumericEvidence;
  distress?: SubjectiveNumericEvidence;
  copingConfidence?: SubjectiveNumericEvidence;

  supportPreference?: SupportPreference;
  recentUseStatus?: RecentUseStatus;
  alcoholAvailability?: AlcoholAvailability;
  socialContext?: SocialContext;

  triggerContext?: string[];

  shameCue?: boolean;
  skippedFields?: CheckInField[];
  vagueAnswer?: boolean;
  contradictionHint?: boolean;

  safetySubflags?: Partial<SafetySubflags>;
  uncertainty?: SubjectiveUncertainty;
};

export type SubjectiveHistoryEntry = {
  id: string;
  state: SubjectiveState;
  evidence: SubjectiveEvidence[];
  createdAt: string;
};

export type CheckInOption = {
  label: string;
  value: string;
};

export type CheckInQuestion = {
  field: CheckInField;
  prompt: string;
  helperText?: string;
  inputType: "chips" | "text";
  options?: CheckInOption[];
  required: boolean;
  allowSkip: boolean;
};

export type CheckInPlan = {
  action: "ask_checkin" | "continue" | "skip_checkin";
  questions: CheckInQuestion[];
  reason: string;
};

export type PendingCheckInRequest = {
  requestId: string;
  substance: SubstanceId;
  questions: CheckInQuestion[];
  reason: string;
  createdAt: string;
};

export type CheckInAnswerValue = string | number | boolean | null;

export type CheckInResponsePayload = {
  requestId: string;
  answers: Partial<Record<CheckInField, CheckInAnswerValue>>;
  skippedFields: CheckInField[] | ["all"];
  submittedAt: string;
};

export type ResponseControl = {
  tone: "warm" | "grounding" | "practical" | "reflective" | "encouraging";
  maxWordsOverride?: number;
  supportStrategy:
    | "generic_support"
    | "grounding_first"
    | "immediate_coping"
    | "lapse_reflection"
    | "contact_support"
    | "escalation_only";
  shouldAskFollowup: boolean;
  allowedResponseInfluence: AllowedResponseInfluence;
  promptStyleHints: string[];
  kbStateTags: string[];
};

export type UIAction =
  | {
      type: "subjective_checkin";
      request: PendingCheckInRequest;
    }
  | null;

export function createDefaultSafetySubflags(): SafetySubflags {
  return {
    selfHarmConcern: false,
    immediateDanger: false,
    possibleMedicalEmergencyRedFlag: false,
    possibleWithdrawalRedFlag: false,
    unsafeDriving: false,
    alcoholMedicationMix: false,
    intoxicationUncertain: false,
    unsafeAlcoholRequest: false,
  };
}

export function createDefaultSubjectiveState(): SubjectiveState {
  return {
    substance: "alcohol",

    cravingLevel: "unclear",
    distressLevel: "unclear",
    copingConfidence: "unclear",

    supportPreference: "unclear",
    recentUseStatus: "none_disclosed",
    alcoholAvailability: "unclear",
    socialContext: "unclear",

    triggerContext: [],

    shameCue: false,
    skippedFields: [],
    contradictionHint: false,
    vagueAnswer: false,

    safetySubflags: createDefaultSafetySubflags(),

    uncertainty: {
      level: "high",
      reasons: ["no_subjective_evidence"],
    },

    cravingTrend: "unclear",
    distressTrend: "unclear",
    copingConfidenceTrend: "unclear",

    allowedResponseInfluence: "none",

    evidenceCount: 0,
  };
}

export function createDefaultResponseControl(): ResponseControl {
  return {
    tone: "warm",
    supportStrategy: "generic_support",
    shouldAskFollowup: false,
    allowedResponseInfluence: "none",
    promptStyleHints: [],
    kbStateTags: [],
  };
}
