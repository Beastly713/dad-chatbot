import { randomUUID } from "crypto";
import type {
    ObjectiveMlJsonObject as JsonObject,
} from "./mlInferenceContract.js";

export type ObjectiveInterpretationVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveInterpretationEvidenceLevel = "none" | "low" | "moderate";

export type ObjectiveInterpretationConfidenceLabel =
    | "insufficient_confidence"
    | "low_confidence"
    | "moderate_confidence";

export type ObjectiveInterpretationSuppressionState =
    | "not_suppressed"
    | "suppressed_low_quality"
    | "suppressed_missing_baseline"
    | "suppressed_motion_confound"
    | "suppressed_signal_conflict"
    | "suppressed_missing_data";

export type ObjectiveInterpretationLabel =
    | "baseline_or_low_arousal_evidence"
    | "elevated_physiological_arousal_evidence"
    | "recovery_cooldown_evidence"
    | "insufficient_reliable_data"
    | "suppressed_for_quality"
    | "motion_confounded_evidence"
    | "signal_conflict_uncertain";

export type ObjectiveInterpretationSummaryInput = {
    summary_version: string;
    template_id: string;
    title: string;
    headline: string;
    detail_lines: string[];
    caution_lines: string[];
    review_focus: string[];
    rendered_summary_text: string;
    visibility?: Partial<ObjectiveInterpretationVisibility>;
};

export type ObjectiveInterpretationPersistenceInput = {
    interpretation_key: string;
    feature_window_id: string;
    feature_window_key?: string;
    ml_inference_id?: string;
    session_id: string;
    segment_id?: string;
    interpretation_version: string;
    target: string;
    interpretation_label: ObjectiveInterpretationLabel;
    evidence_level: ObjectiveInterpretationEvidenceLevel;
    confidence_label: ObjectiveInterpretationConfidenceLabel;
    suppression_state: ObjectiveInterpretationSuppressionState;
    uncertainty_reasons: string[];
    contributing_modalities: string[];
    excluded_modalities: string[];
    source_banner: "simulated_data" | "public_dataset_replay" | "prototype_hardware";
    decision_payload: JsonObject;
    summary_payload?: ObjectiveInterpretationSummaryInput;
    clinician_visible?: true;
    patient_visible?: false;
    chatbot_visible?: false;
};

export type ObjectiveInterpretationRecord =
    ObjectiveInterpretationPersistenceInput &
        ObjectiveInterpretationVisibility & {
            id: string;
            created_at: string;
        };

export type ObjectiveInterpretationListFilter = {
    session_id: string;
    segment_id?: string;
};

export type ObjectiveInterpretationStorageRepository = {
    saveInterpretation(
        input: ObjectiveInterpretationPersistenceInput,
    ): Promise<ObjectiveInterpretationRecord>;
    saveInterpretations(
        inputs: readonly ObjectiveInterpretationPersistenceInput[],
    ): Promise<ObjectiveInterpretationRecord[]>;
    getInterpretationByKey(
        interpretationKey: string,
    ): Promise<ObjectiveInterpretationRecord | null>;
    listInterpretationsForSession(
        filter: ObjectiveInterpretationListFilter,
    ): Promise<ObjectiveInterpretationRecord[]>;
    listInterpretationsForFeatureWindow(
        featureWindowId: string,
    ): Promise<ObjectiveInterpretationRecord[]>;
    listAllInterpretations(): Promise<ObjectiveInterpretationRecord[]>;
};

const ALLOWED_TARGET =
    "baseline_relative_elevated_physiological_arousal_evidence";

const ALLOWED_LABELS: readonly ObjectiveInterpretationLabel[] = [
    "baseline_or_low_arousal_evidence",
    "elevated_physiological_arousal_evidence",
    "recovery_cooldown_evidence",
    "insufficient_reliable_data",
    "suppressed_for_quality",
    "motion_confounded_evidence",
    "signal_conflict_uncertain",
];

const ALLOWED_EVIDENCE_LEVELS: readonly ObjectiveInterpretationEvidenceLevel[] = [
    "none",
    "low",
    "moderate",
];

const ALLOWED_CONFIDENCE_LABELS: readonly ObjectiveInterpretationConfidenceLabel[] =
    ["insufficient_confidence", "low_confidence", "moderate_confidence"];

const ALLOWED_SUPPRESSION_STATES: readonly ObjectiveInterpretationSuppressionState[] =
    [
        "not_suppressed",
        "suppressed_low_quality",
        "suppressed_missing_baseline",
        "suppressed_motion_confound",
        "suppressed_signal_conflict",
        "suppressed_missing_data",
    ];

const SOURCE_BANNERS = [
    "simulated_data",
    "public_dataset_replay",
    "prototype_hardware",
] as const;

const FORBIDDEN_TEXT_PATTERNS = [
    /craving/i,
    /relapse/i,
    /withdrawal/i,
    /intoxication/i,
    /diagnos/i,
    /risk_score/i,
    /treatment/i,
    /detox/i,
    /medication/i,
    /ciwa/i,
    /sobriety/i,
    /truthfulness/i,
    /patient_is_lying/i,
    /patient_is_safe/i,
    /patient_is_stable/i,
    /emergency/i,
];

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function assertNonEmptyString(value: string | undefined, name: string): string {
    if (!value || value.trim().length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return value;
}

function assertJsonObject(value: unknown, name: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${name} must be a JSON object`);
    }

    return value as JsonObject;
}

function assertStringArray(value: unknown, name: string): string[] {
    if (
        !Array.isArray(value) ||
        value.some((entry) => typeof entry !== "string")
    ) {
        throw new Error(`${name} must be an array of strings`);
    }

    return value;
}

function assertAllowedValue<T extends string>(
    value: string,
    allowed: readonly T[],
    name: string,
): T {
    if (!allowed.includes(value as T)) {
        throw new Error(`${name} is not allowed`);
    }

    return value as T;
}

function containsForbiddenText(value: unknown): boolean {
    if (typeof value === "string") {
        return FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(value));
    }

    if (Array.isArray(value)) {
        return value.some(containsForbiddenText);
    }

    if (typeof value === "object" && value !== null) {
        return Object.entries(value).some(
            ([key, entry]) =>
                containsForbiddenText(key) || containsForbiddenText(entry),
        );
    }

    return false;
}

function assertNoForbiddenText(value: unknown, name: string): void {
    if (containsForbiddenText(value)) {
        throw new Error(`${name} contains forbidden clinical or unsafe wording`);
    }
}

function assertClinicianOnlyVisibility(
    input:
        | Pick<
              ObjectiveInterpretationPersistenceInput,
              "clinician_visible" | "patient_visible" | "chatbot_visible"
          >
        | Partial<ObjectiveInterpretationVisibility>
        | undefined,
    name: string,
): ObjectiveInterpretationVisibility {
    if (
        input?.clinician_visible !== undefined &&
        input.clinician_visible !== true
    ) {
        throw new Error(`${name} clinician_visible must remain true`);
    }

    if (input?.patient_visible !== undefined && input.patient_visible !== false) {
        throw new Error(`${name} patient_visible must remain false`);
    }

    if (input?.chatbot_visible !== undefined && input.chatbot_visible !== false) {
        throw new Error(`${name} chatbot_visible must remain false`);
    }

    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function normalizeSummary(
    summary: ObjectiveInterpretationSummaryInput | undefined,
): ObjectiveInterpretationSummaryInput | undefined {
    if (!summary) {
        return undefined;
    }

    const normalized = {
        summary_version: assertNonEmptyString(
            summary.summary_version,
            "summary_version",
        ),
        template_id: assertNonEmptyString(summary.template_id, "template_id"),
        title: assertNonEmptyString(summary.title, "title"),
        headline: assertNonEmptyString(summary.headline, "headline"),
        detail_lines: assertStringArray(summary.detail_lines, "detail_lines"),
        caution_lines: assertStringArray(summary.caution_lines, "caution_lines"),
        review_focus: assertStringArray(summary.review_focus, "review_focus"),
        rendered_summary_text: assertNonEmptyString(
            summary.rendered_summary_text,
            "rendered_summary_text",
        ),
        ...assertClinicianOnlyVisibility(summary.visibility, "summary visibility"),
    };

    assertNoForbiddenText(normalized, "summary_payload");

    return normalized;
}

function normalizeInterpretationInput(
    input: ObjectiveInterpretationPersistenceInput,
): ObjectiveInterpretationPersistenceInput & ObjectiveInterpretationVisibility {
    if (input.target !== ALLOWED_TARGET) {
        throw new Error("target is not allowed");
    }

    const normalized = {
        interpretation_key: assertNonEmptyString(
            input.interpretation_key,
            "interpretation_key",
        ),
        feature_window_id: assertNonEmptyString(
            input.feature_window_id,
            "feature_window_id",
        ),
        ...(input.feature_window_key
            ? {
                  feature_window_key: assertNonEmptyString(
                      input.feature_window_key,
                      "feature_window_key",
                  ),
              }
            : {}),
        ...(input.ml_inference_id
            ? {
                  ml_inference_id: assertNonEmptyString(
                      input.ml_inference_id,
                      "ml_inference_id",
                  ),
              }
            : {}),
        session_id: assertNonEmptyString(input.session_id, "session_id"),
        ...(input.segment_id
            ? { segment_id: assertNonEmptyString(input.segment_id, "segment_id") }
            : {}),
        interpretation_version: assertNonEmptyString(
            input.interpretation_version,
            "interpretation_version",
        ),
        target: input.target,
        interpretation_label: assertAllowedValue(
            input.interpretation_label,
            ALLOWED_LABELS,
            "interpretation_label",
        ),
        evidence_level: assertAllowedValue(
            input.evidence_level,
            ALLOWED_EVIDENCE_LEVELS,
            "evidence_level",
        ),
        confidence_label: assertAllowedValue(
            input.confidence_label,
            ALLOWED_CONFIDENCE_LABELS,
            "confidence_label",
        ),
        suppression_state: assertAllowedValue(
            input.suppression_state,
            ALLOWED_SUPPRESSION_STATES,
            "suppression_state",
        ),
        uncertainty_reasons: assertStringArray(
            input.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        contributing_modalities: assertStringArray(
            input.contributing_modalities,
            "contributing_modalities",
        ),
        excluded_modalities: assertStringArray(
            input.excluded_modalities,
            "excluded_modalities",
        ),
        source_banner: assertAllowedValue(
            input.source_banner,
            SOURCE_BANNERS,
            "source_banner",
        ),
        decision_payload: assertJsonObject(input.decision_payload, "decision_payload"),
        ...(input.summary_payload
            ? { summary_payload: normalizeSummary(input.summary_payload) }
            : {}),
        ...assertClinicianOnlyVisibility(input, "interpretation visibility"),
    };

    assertNoForbiddenText(normalized, "interpretation record");

    return normalized;
}

function createInterpretationRecord(
    input: ObjectiveInterpretationPersistenceInput,
    now: () => Date,
): ObjectiveInterpretationRecord {
    const normalized = normalizeInterpretationInput(input);

    return {
        id: randomUUID(),
        created_at: now().toISOString(),
        ...cloneJson(normalized),
    };
}

export function createObjectiveInterpretationPersistenceInput(options: {
    interpretation_key?: string;
    decision: JsonObject;
    summary?: ObjectiveInterpretationSummaryInput;
}): ObjectiveInterpretationPersistenceInput {
    const trace = assertJsonObject(options.decision.trace, "decision.trace");
    const featureWindowId = assertNonEmptyString(
        trace.feature_window_id as string | undefined,
        "trace.feature_window_id",
    );
    const sessionId = assertNonEmptyString(
        trace.session_id as string | undefined,
        "trace.session_id",
    );
    const interpretationVersion = assertNonEmptyString(
        options.decision.interpretation_version as string | undefined,
        "interpretation_version",
    );

    const interpretationKey =
        options.interpretation_key ??
        `${featureWindowId}:${interpretationVersion}`;

    return {
        interpretation_key: interpretationKey,
        feature_window_id: featureWindowId,
        ...(typeof trace.feature_window_key === "string"
            ? { feature_window_key: trace.feature_window_key }
            : {}),
        ...(typeof trace.ml_inference_id === "string"
            ? { ml_inference_id: trace.ml_inference_id }
            : {}),
        session_id: sessionId,
        ...(typeof trace.segment_id === "string"
            ? { segment_id: trace.segment_id }
            : {}),
        interpretation_version: interpretationVersion,
        target: assertNonEmptyString(
            options.decision.target as string | undefined,
            "target",
        ),
        interpretation_label: options.decision
            .interpretation_label as ObjectiveInterpretationLabel,
        evidence_level: options.decision
            .evidence_level as ObjectiveInterpretationEvidenceLevel,
        confidence_label: options.decision
            .confidence_label as ObjectiveInterpretationConfidenceLabel,
        suppression_state: options.decision
            .suppression_state as ObjectiveInterpretationSuppressionState,
        uncertainty_reasons: assertStringArray(
            options.decision.uncertainty_reasons,
            "uncertainty_reasons",
        ),
        contributing_modalities: assertStringArray(
            options.decision.contributing_modalities,
            "contributing_modalities",
        ),
        excluded_modalities: assertStringArray(
            options.decision.excluded_modalities,
            "excluded_modalities",
        ),
        source_banner: options.decision
            .source_banner as ObjectiveInterpretationPersistenceInput["source_banner"],
        decision_payload: options.decision,
        ...(options.summary ? { summary_payload: options.summary } : {}),
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

export class InMemoryObjectiveInterpretationRepository
    implements ObjectiveInterpretationStorageRepository
{
    private readonly byKey = new Map<string, ObjectiveInterpretationRecord>();

    constructor(private readonly now: () => Date = () => new Date()) {}

    async saveInterpretation(
        input: ObjectiveInterpretationPersistenceInput,
    ): Promise<ObjectiveInterpretationRecord> {
        const [record] = await this.saveInterpretations([input]);

        return record;
    }

    async saveInterpretations(
        inputs: readonly ObjectiveInterpretationPersistenceInput[],
    ): Promise<ObjectiveInterpretationRecord[]> {
        const candidateRecords = inputs.map((input) =>
            createInterpretationRecord(input, this.now),
        );
        const candidateKeys = candidateRecords.map(
            (record) => record.interpretation_key,
        );
        const uniqueCandidateKeys = new Set(candidateKeys);

        if (uniqueCandidateKeys.size !== candidateKeys.length) {
            throw new Error(
                "interpretation_key values must be unique within one save operation",
            );
        }

        for (const key of candidateKeys) {
            if (this.byKey.has(key)) {
                throw new Error(`interpretation_key already exists: ${key}`);
            }
        }

        for (const record of candidateRecords) {
            this.byKey.set(record.interpretation_key, cloneJson(record));
        }

        return candidateRecords.map(cloneJson);
    }

    async getInterpretationByKey(
        interpretationKey: string,
    ): Promise<ObjectiveInterpretationRecord | null> {
        const key = assertNonEmptyString(interpretationKey, "interpretation_key");
        const record = this.byKey.get(key);

        return record ? cloneJson(record) : null;
    }

    async listInterpretationsForSession(
        filter: ObjectiveInterpretationListFilter,
    ): Promise<ObjectiveInterpretationRecord[]> {
        const sessionId = assertNonEmptyString(filter.session_id, "session_id");

        return [...this.byKey.values()]
            .filter((record) => record.session_id === sessionId)
            .filter((record) =>
                filter.segment_id ? record.segment_id === filter.segment_id : true,
            )
            .sort(
                (left, right) =>
                    left.created_at.localeCompare(right.created_at) ||
                    left.interpretation_key.localeCompare(right.interpretation_key),
            )
            .map(cloneJson);
    }

    async listInterpretationsForFeatureWindow(
        featureWindowId: string,
    ): Promise<ObjectiveInterpretationRecord[]> {
        const id = assertNonEmptyString(featureWindowId, "feature_window_id");

        return [...this.byKey.values()]
            .filter((record) => record.feature_window_id === id)
            .sort(
                (left, right) =>
                    left.created_at.localeCompare(right.created_at) ||
                    left.interpretation_key.localeCompare(right.interpretation_key),
            )
            .map(cloneJson);
    }

    async listAllInterpretations(): Promise<ObjectiveInterpretationRecord[]> {
        return [...this.byKey.values()]
            .sort((left, right) =>
                left.interpretation_key.localeCompare(right.interpretation_key),
            )
            .map(cloneJson);
    }
}
