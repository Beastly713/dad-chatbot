import type {
  CheckInResponsePayload,
  SafetySubflags,
} from "../subjective/types.js";
import { createDefaultSafetySubflags } from "../subjective/types.js";

export type SafetySubflagInput =
  | string
  | CheckInResponsePayload
  | null
  | undefined;

function normalizeText(input: string): string {
  return input.toLowerCase().trim();
}

function isCheckInResponsePayload(
  input: SafetySubflagInput,
): input is CheckInResponsePayload {
  return (
    typeof input === "object" &&
    input !== null &&
    "answers" in input &&
    "skippedFields" in input
  );
}

export function safetySubflagInputToText(input: SafetySubflagInput): string {
  if (!input) return "";

  if (typeof input === "string") {
    return input;
  }

  if (isCheckInResponsePayload(input)) {
    return Object.values(input.answers)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
      .join(" ");
  }

  return "";
}

function hasAlcoholContext(text: string): boolean {
  return /\b(alcohol|drink|drinking|drank|drunk|beer|wine|liquor|vodka|whiskey|whisky)\b/.test(
    text,
  );
}

function hasMedicationContext(text: string): boolean {
  return /\b(medication|medicine|pill|pills|sleeping pill|sleeping pills|librium|xanax|valium|benzodiazepine|benzo|opioid|painkiller|antidepressant)\b/.test(
    text,
  );
}

function detectSelfHarmConcern(text: string): boolean {
  return /\b(kill myself|suicide|end my life|hurt myself|harm myself|don'?t want to live|can't stay safe|cannot stay safe)\b/.test(
    text,
  );
}

function detectPossibleMedicalEmergency(text: string): boolean {
  return /\b(passed out|pass out|unconscious|can'?t wake|cannot wake|seizure|seizing|trouble breathing|can'?t breathe|cannot breathe|blue lips|slow breathing|very slow heart|clammy|cold skin|confused|confusion|alcohol poisoning|overdose|vomiting and can'?t stay awake|vomiting and cannot stay awake)\b/.test(
    text,
  );
}

function detectPossibleWithdrawalRedFlag(text: string): boolean {
  const withdrawalContext =
    /\b(withdrawal|detox|stopping drinking|stopped drinking|after stopping|after not drinking|not drinking|quit drinking)\b/.test(
      text,
    );

  const redFlagSymptom =
    /\b(shaking|shake|tremor|tremors|seizure|seizing|hallucination|hallucinations|seeing things|hearing things|sweating|sweats|confused|confusion)\b/.test(
      text,
    );

  return withdrawalContext && redFlagSymptom;
}

function detectUnsafeDriving(text: string): boolean {
  const drinkingThenDriving =
    /\b(drinking|drank|drunk|alcohol|beer|wine|liquor)\b/.test(text) &&
    /\b(drive|driving|drive home|get behind the wheel)\b/.test(text);

  const needToDriveWithAlcohol =
    /\b(need to drive|have to drive|must drive|drive home)\b/.test(text) &&
    /\b(drinking|drank|drunk|alcohol)\b/.test(text);

  return drinkingThenDriving || needToDriveWithAlcohol;
}

function detectAlcoholMedicationMix(text: string): boolean {
  const explicitMix =
    /\b(mix|mixed|combine|combined|take|took|with)\b/.test(text) &&
    hasAlcoholContext(text) &&
    hasMedicationContext(text);

  const directPhrase =
    /\b(alcohol with|drinking with|drank with)\b/.test(text) &&
    hasMedicationContext(text);

  return explicitMix || directPhrase;
}

function detectIntoxicationUncertain(text: string): boolean {
  return /\b(blackout|blacked out|too drunk|very drunk|intoxicated|can'?t think clearly|cannot think clearly)\b/.test(
    text,
  );
}

function detectUnsafeAlcoholRequest(text: string): boolean {
  const hideDrinking = /\b(hide my drinking|hide drinking|cover up drinking)\b/.test(
    text,
  );

  const soberUpFast =
    /\b(sober up fast|sober up quickly|drive after drinking|sleep it off)\b/.test(
      text,
    );

  const safeAmount =
    /\b(safe amount|how much can i drink|how many drinks can i have)\b/.test(
      text,
    );

  const medicationMix = detectAlcoholMedicationMix(text);

  return hideDrinking || soberUpFast || safeAmount || medicationMix;
}

export function detectSafetySubflags(
  input: SafetySubflagInput,
): SafetySubflags {
  const text = normalizeText(safetySubflagInputToText(input));
  const subflags = createDefaultSafetySubflags();

  if (!text) {
    return subflags;
  }

  subflags.selfHarmConcern = detectSelfHarmConcern(text);
  subflags.immediateDanger =
    subflags.selfHarmConcern || detectUnsafeDriving(text);
  subflags.possibleMedicalEmergencyRedFlag =
    detectPossibleMedicalEmergency(text) ||
    /\b(seeing things|hearing things|hallucination|hallucinations)\b/.test(
      text,
    );
  subflags.possibleWithdrawalRedFlag = detectPossibleWithdrawalRedFlag(text);
  subflags.unsafeDriving = detectUnsafeDriving(text);
  subflags.alcoholMedicationMix = detectAlcoholMedicationMix(text);
  subflags.intoxicationUncertain = detectIntoxicationUncertain(text);
  subflags.unsafeAlcoholRequest = detectUnsafeAlcoholRequest(text);

  return subflags;
}

export function hasAnySafetySubflag(subflags: SafetySubflags): boolean {
  return Object.values(subflags).some(Boolean);
}

export function getTriggeredSafetySubflagNames(
  subflags: SafetySubflags,
): string[] {
  return Object.entries(subflags)
    .filter(([, value]) => value)
    .map(([key]) => key);
}