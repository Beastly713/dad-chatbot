import type { ObjectiveFeatureWindowRecord } from "./featureStorage.js";
import type { ObjectiveInterpretationRecord } from "./interpretationStorage.js";
import type { ObjectiveMlInferenceRecord } from "./mlInferenceStorage.js";
import type { ObjectiveSessionRecord } from "./sessionLifecycle.js";

export type ObjectiveSessionSummaryVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveSessionSummaryFraction = {
    numerator: number;
    denominator: number;
    fraction: number;
};

export type ObjectiveSessionSummaryModalityAvailability = {
    modality: string;
    available_windows: number;
    total_windows: number;
    fraction_available: number;
};

export type ObjectiveSessionSummaryPeriod = {
    interpretation_id: string;
    feature_window_id: string;
    start_esp_time_ms: number | null;
    end_esp_time_ms: number | null;
    evidence_level: string;
    confidence_label: string;
    contributing_modalities: string[];
    limitations: string[];
};

export type ObjectiveSessionSummaryVersionMetadata = {
    summary_schema_version: "objective-final-session-summary-v1";
    preprocessing_versions: string[];
    feature_schema_versions: string[];
    interpretation_versions: string[];
    model_versions: string[];
    generated_at: string;
    regenerated_or_superseded_note: string;
};

export type ObjectiveFinalSessionSummary = {
    session_id: string;
    patient_id: string;
    source_type: ObjectiveSessionRecord["source_type"];
    summary_scope_note: string;
    total_windows: number;
    interpretable_fraction: ObjectiveSessionSummaryFraction;
    suppressed_fraction: ObjectiveSessionSummaryFraction;
    modality_availability: ObjectiveSessionSummaryModalityAvailability[];
    major_quality_issues: string[];
    evidence_periods: ObjectiveSessionSummaryPeriod[];
    cooldown_periods: ObjectiveSessionSummaryPeriod[];
    version_metadata: ObjectiveSessionSummaryVersionMetadata;
    visibility: ObjectiveSessionSummaryVisibility;
};

export type ObjectiveSessionSummaryRepository = {
    getSession(sessionId: string): Promise<ObjectiveSessionRecord | null>;
    listFeatureWindowsForSession(
        sessionId: string,
    ): Promise<ObjectiveFeatureWindowRecord[]>;
    listInterpretationsForSession(
        sessionId: string,
    ): Promise<ObjectiveInterpretationRecord[]>;
    listMlInferencesForSession(
        sessionId: string,
    ): Promise<ObjectiveMlInferenceRecord[]>;
};

function visibility(): ObjectiveSessionSummaryVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function safeFraction(numerator: number, denominator: number): number {
    if (denominator <= 0) {
        return 0;
    }

    return numerator / denominator;
}

function makeFraction(
    numerator: number,
    denominator: number,
): ObjectiveSessionSummaryFraction {
    return {
        numerator,
        denominator,
        fraction: safeFraction(numerator, denominator),
    };
}

function safeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function summarizeObjectiveTechnicalReason(reason: string): string {
    const normalized = reason.toLowerCase();

    if (normalized.includes("baseline")) {
        return "Baseline context limited";
    }

    if (normalized.includes("motion") || normalized.includes("artifact")) {
        return "Motion or artifact context reduced readiness";
    }

    if (normalized.includes("missing") || normalized.includes("unavailable")) {
        return "Missingness or unavailable signal context";
    }

    if (normalized.includes("quality") || normalized.includes("poor")) {
        return "Signal quality limitation";
    }

    if (normalized.includes("contact")) {
        return "Contact or placement limitation";
    }

    if (normalized.includes("dropout")) {
        return "Dropout or interrupted signal context";
    }

    if (normalized.includes("conflict") || normalized.includes("agreement")) {
        return "Cross-signal agreement limitation";
    }

    if (
        normalized.includes("timing") ||
        normalized.includes("gap") ||
        normalized.includes("segment")
    ) {
        return "Timing or segment continuity limitation";
    }

    if (normalized.includes("model") || normalized.includes("ml")) {
        return "Model availability or confidence limitation";
    }

    return "Technical limitation recorded";
}

function aggregateMajorQualityIssues(
    featureWindows: readonly ObjectiveFeatureWindowRecord[],
    interpretations: readonly ObjectiveInterpretationRecord[],
): string[] {
    const reasons = [
        ...featureWindows.flatMap((window) =>
            safeStringArray(window.uncertainty_reasons),
        ),
        ...interpretations.flatMap((interpretation) =>
            safeStringArray(interpretation.uncertainty_reasons),
        ),
    ];

    return unique(reasons.map(summarizeObjectiveTechnicalReason));
}

function aggregateModalityAvailability(
    featureWindows: readonly ObjectiveFeatureWindowRecord[],
): ObjectiveSessionSummaryModalityAvailability[] {
    const totals = new Map<string, { available: number; total: number }>();

    for (const window of featureWindows) {
        if (!isRecord(window.modality_availability)) {
            continue;
        }

        for (const [modality, available] of Object.entries(
            window.modality_availability,
        )) {
            const aggregate = totals.get(modality) ?? { available: 0, total: 0 };
            aggregate.total += 1;

            if (available === true) {
                aggregate.available += 1;
            }

            totals.set(modality, aggregate);
        }
    }

    return [...totals.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([modality, aggregate]) => ({
            modality,
            available_windows: aggregate.available,
            total_windows: aggregate.total,
            fraction_available: safeFraction(aggregate.available, aggregate.total),
        }));
}

function makeSummaryPeriod(
    interpretation: ObjectiveInterpretationRecord,
    featureWindowById: ReadonlyMap<string, ObjectiveFeatureWindowRecord>,
): ObjectiveSessionSummaryPeriod {
    const featureWindow = featureWindowById.get(interpretation.feature_window_id);

    return {
        interpretation_id: interpretation.id,
        feature_window_id: interpretation.feature_window_id,
        start_esp_time_ms: featureWindow?.start_esp_time_ms ?? null,
        end_esp_time_ms: featureWindow?.end_esp_time_ms ?? null,
        evidence_level: interpretation.evidence_level,
        confidence_label: interpretation.confidence_label,
        contributing_modalities: safeStringArray(
            interpretation.contributing_modalities,
        ),
        limitations: unique(
            safeStringArray(interpretation.uncertainty_reasons).map(
                summarizeObjectiveTechnicalReason,
            ),
        ),
    };
}

function isInterpretable(window: ObjectiveFeatureWindowRecord): boolean {
    return (
        window.window_status === "ready" &&
        window.suppression_state === "not_suppressed"
    );
}

function isSuppressed(window: ObjectiveFeatureWindowRecord): boolean {
    return window.suppression_state !== "not_suppressed";
}

export async function buildObjectiveFinalSessionSummary(
    repository: ObjectiveSessionSummaryRepository,
    sessionId: string,
    now: () => Date = () => new Date(),
): Promise<ObjectiveFinalSessionSummary | null> {
    const session = await repository.getSession(sessionId);
    if (!session) {
        return null;
    }

    const [featureWindows, interpretations, mlInferences] = await Promise.all([
        repository.listFeatureWindowsForSession(sessionId),
        repository.listInterpretationsForSession(sessionId),
        repository.listMlInferencesForSession(sessionId),
    ]);

    const sortedFeatureWindows = [...featureWindows].sort(
        (left, right) => left.start_esp_time_ms - right.start_esp_time_ms,
    );
    const featureWindowById = new Map(
        sortedFeatureWindows.map((window) => [window.id, window]),
    );
    const sortedInterpretations = [...interpretations].sort(
        (left, right) => left.created_at.localeCompare(right.created_at),
    );

    const totalWindows = sortedFeatureWindows.length;
    const interpretableWindows = sortedFeatureWindows.filter(isInterpretable);
    const suppressedWindows = sortedFeatureWindows.filter(isSuppressed);

    return {
        session_id: session.session_id,
        patient_id: session.patient_id,
        source_type: session.source_type,
        summary_scope_note:
            "This summary is clinician-only, non-diagnostic, and limited to source-bound objective monitoring records.",
        total_windows: totalWindows,
        interpretable_fraction: makeFraction(
            interpretableWindows.length,
            totalWindows,
        ),
        suppressed_fraction: makeFraction(suppressedWindows.length, totalWindows),
        modality_availability:
            aggregateModalityAvailability(sortedFeatureWindows),
        major_quality_issues: aggregateMajorQualityIssues(
            sortedFeatureWindows,
            sortedInterpretations,
        ),
        evidence_periods: sortedInterpretations
            .filter(
                (interpretation) =>
                    interpretation.interpretation_label ===
                    "elevated_physiological_arousal_evidence",
            )
            .map((interpretation) =>
                makeSummaryPeriod(interpretation, featureWindowById),
            ),
        cooldown_periods: sortedInterpretations
            .filter(
                (interpretation) =>
                    interpretation.interpretation_label ===
                    "recovery_cooldown_evidence",
            )
            .map((interpretation) =>
                makeSummaryPeriod(interpretation, featureWindowById),
            ),
        version_metadata: {
            summary_schema_version: "objective-final-session-summary-v1",
            preprocessing_versions: unique(
                sortedFeatureWindows.map((window) => window.preprocessing_version),
            ),
            feature_schema_versions: unique(
                sortedFeatureWindows.map((window) => window.feature_schema_version),
            ),
            interpretation_versions: unique(
                sortedInterpretations.map(
                    (interpretation) => interpretation.interpretation_version,
                ),
            ),
            model_versions: unique(
                mlInferences.map((inference) => inference.model_version),
            ),
            generated_at: now().toISOString(),
            regenerated_or_superseded_note:
                "If summary inputs are regenerated or superseded later, compare version metadata before comparing results.",
        },
        visibility: visibility(),
    };
}
