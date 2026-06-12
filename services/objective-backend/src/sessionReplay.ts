import type { ObjectiveFeatureWindowRecord } from "./featureStorage.js";
import type { ObjectiveInterpretationRecord } from "./interpretationStorage.js";
import type { ObjectiveSegmentRecord } from "./segmentManager.js";
import type { ObjectiveSessionRecord } from "./sessionLifecycle.js";

export type ObjectiveReplayVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveReplaySourceBanner =
    | "simulated_data"
    | "public_dataset_replay"
    | "prototype_hardware";

export type ObjectiveReplayChartPoint = {
    t_ms: number;
    value: number;
};

export type ObjectiveReplayChartSeries = {
    series_id: string;
    label: string;
    unit_label: string;
    source_note: string;
    points: ObjectiveReplayChartPoint[];
};

export type ObjectiveReplayFeatureWindow = {
    feature_window_id: string;
    feature_window_key: string;
    start_esp_time_ms: number;
    end_esp_time_ms: number;
    window_status: string;
    suppression_state: string;
    quality: unknown;
    missingness: unknown;
    modality_availability: unknown;
    baseline_relative: unknown;
    uncertainty_reasons: string[];
    preprocessing_version: string;
    feature_schema_version: string;
    superseded_by_feature_window_id: string | null;
    replay_note: string;
};

export type ObjectiveReplayInterpretationTimelineItem = {
    interpretation_id: string;
    interpretation_key: string;
    feature_window_id: string;
    start_esp_time_ms: number | null;
    end_esp_time_ms: number | null;
    interpretation_label: string;
    evidence_level: string;
    confidence_label: string;
    suppression_state: string;
    uncertainty_reasons: string[];
    contributing_modalities: string[];
    excluded_modalities: string[];
    source_banner: string;
    superseded_by_interpretation_id: string | null;
    replay_note: string;
};

export type ObjectiveReplayQualityTimelineItem = {
    id: string;
    start_esp_time_ms: number;
    end_esp_time_ms: number;
    label: string;
    detail: string;
    limitations: string[];
};

export type ObjectiveReplaySegment = {
    segment_id: string;
    session_id: string;
    device_boot_id: string | null;
    reason: string;
    start_esp_time_ms: number;
    end_esp_time_ms: number | null;
    replay_note: string;
};

export type ObjectiveReplayVersionMetadata = {
    replay_schema_version: "objective-session-replay-v1";
    preprocessing_versions: string[];
    feature_schema_versions: string[];
    interpretation_versions: string[];
    generated_at: string;
    replay_mode: "historical_non_live";
    regenerated_or_superseded_note: string;
};

export type ObjectiveSessionReplayPayload = {
    session_id: string;
    patient_id: string;
    source_type: ObjectiveSessionRecord["source_type"];
    source_banner: ObjectiveReplaySourceBanner;
    replay_banner: "historical_non_live_replay";
    replay_scope_note: string;
    chart_ready_samples: ObjectiveReplayChartSeries[];
    feature_windows: ObjectiveReplayFeatureWindow[];
    interpretation_timeline: ObjectiveReplayInterpretationTimelineItem[];
    quality_timeline: ObjectiveReplayQualityTimelineItem[];
    session_segments: ObjectiveReplaySegment[];
    version_metadata: ObjectiveReplayVersionMetadata;
    visibility: ObjectiveReplayVisibility;
};

export type ObjectiveSessionReplayRepository = {
    getSession(sessionId: string): Promise<ObjectiveSessionRecord | null>;
    listFeatureWindowsForSession(
        sessionId: string,
    ): Promise<ObjectiveFeatureWindowRecord[]>;
    listInterpretationsForSession(
        sessionId: string,
    ): Promise<ObjectiveInterpretationRecord[]>;
    listSegmentsForSession(sessionId: string): Promise<ObjectiveSegmentRecord[]>;
};

export const OBJECTIVE_REPLAY_MAX_CHART_POINTS = 120;

function visibility(): ObjectiveReplayVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function sourceBanner(
    sourceType: ObjectiveSessionRecord["source_type"],
): ObjectiveReplaySourceBanner {
    switch (sourceType) {
        case "simulator":
            return "simulated_data";
        case "public_dataset_replay":
            return "public_dataset_replay";
        case "prototype_hardware":
            return "prototype_hardware";
    }
}

function finiteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function downsampleObjectiveReplayPoints(
    points: readonly ObjectiveReplayChartPoint[],
    maxPoints = OBJECTIVE_REPLAY_MAX_CHART_POINTS,
): ObjectiveReplayChartPoint[] {
    if (!Number.isInteger(maxPoints) || maxPoints <= 1) {
        throw new Error("maxPoints must be an integer greater than 1");
    }

    const sanitized = points
        .filter(
            (point) =>
                Number.isFinite(point.t_ms) && Number.isFinite(point.value),
        )
        .map((point) => ({
            t_ms: point.t_ms,
            value: point.value,
        }))
        .sort((left, right) => left.t_ms - right.t_ms);

    if (sanitized.length <= maxPoints) {
        return sanitized;
    }

    const result: ObjectiveReplayChartPoint[] = [];
    const lastIndex = sanitized.length - 1;

    for (let index = 0; index < maxPoints; index += 1) {
        const sourceIndex = Math.round((index * lastIndex) / (maxPoints - 1));
        result.push(sanitized[sourceIndex]);
    }

    return result;
}

function makeChartSeriesFromFeatureWindows(
    featureWindows: readonly ObjectiveFeatureWindowRecord[],
): ObjectiveReplayChartSeries[] {
    const heartActivityPoints: ObjectiveReplayChartPoint[] = [];
    const skinConductancePoints: ObjectiveReplayChartPoint[] = [];
    const motionPoints: ObjectiveReplayChartPoint[] = [];

    for (const window of featureWindows) {
        const baselineRelative =
            typeof window.baseline_relative === "object" &&
            window.baseline_relative !== null
                ? (window.baseline_relative as Record<string, unknown>)
                : {};

        const quality =
            typeof window.quality === "object" && window.quality !== null
                ? (window.quality as Record<string, unknown>)
                : {};

        const tMs = window.end_esp_time_ms;

        const heart =
            finiteNumber(baselineRelative.ecg_median_hr_delta_bpm) ??
            finiteNumber(baselineRelative.heart_activity_trend);

        const gsr =
            finiteNumber(baselineRelative.gsr_tonic_delta) ??
            finiteNumber(baselineRelative.skin_conductance_trend);

        const motion =
            finiteNumber(quality.motion_confound_index) ??
            finiteNumber(baselineRelative.motion_confound_index);

        if (heart !== null) {
            heartActivityPoints.push({ t_ms: tMs, value: heart });
        }

        if (gsr !== null) {
            skinConductancePoints.push({ t_ms: tMs, value: gsr });
        }

        if (motion !== null) {
            motionPoints.push({ t_ms: tMs, value: motion });
        }
    }

    return [
        {
            series_id: "heart_activity_trend",
            label: "Heart-activity trend",
            unit_label: "baseline-relative trend",
            source_note:
                "Historical chart-ready replay derived from feature windows, not raw ECG samples.",
            points: downsampleObjectiveReplayPoints(heartActivityPoints),
        },
        {
            series_id: "skin_conductance_trend",
            label: "Skin-conductance trend",
            unit_label: "baseline-relative trend",
            source_note:
                "Historical chart-ready replay derived from feature windows, not raw GSR samples.",
            points: downsampleObjectiveReplayPoints(skinConductancePoints),
        },
        {
            series_id: "motion_context",
            label: "Motion context",
            unit_label: "technical context index",
            source_note:
                "Historical chart-ready replay for artifact/context review only.",
            points: downsampleObjectiveReplayPoints(motionPoints),
        },
    ];
}

function serializeFeatureWindow(
    featureWindow: ObjectiveFeatureWindowRecord,
): ObjectiveReplayFeatureWindow {
    return {
        feature_window_id: featureWindow.id,
        feature_window_key: featureWindow.feature_window_key,
        start_esp_time_ms: featureWindow.start_esp_time_ms,
        end_esp_time_ms: featureWindow.end_esp_time_ms,
        window_status: featureWindow.window_status,
        suppression_state: featureWindow.suppression_state,
        quality: cloneJson(featureWindow.quality),
        missingness: cloneJson(featureWindow.missingness),
        modality_availability: cloneJson(featureWindow.modality_availability),
        baseline_relative: cloneJson(featureWindow.baseline_relative),
        uncertainty_reasons: safeStringArray(featureWindow.uncertainty_reasons),
        preprocessing_version: featureWindow.preprocessing_version,
        feature_schema_version: featureWindow.feature_schema_version,
        superseded_by_feature_window_id: null,
        replay_note:
            "Historical feature-window replay. Regenerated or superseded outputs must be reviewed by version metadata.",
    };
}

function serializeInterpretation(
    interpretation: ObjectiveInterpretationRecord,
    featureWindowById: ReadonlyMap<string, ObjectiveFeatureWindowRecord>,
): ObjectiveReplayInterpretationTimelineItem {
    const featureWindow = featureWindowById.get(interpretation.feature_window_id);

    return {
        interpretation_id: interpretation.id,
        interpretation_key: interpretation.interpretation_key,
        feature_window_id: interpretation.feature_window_id,
        start_esp_time_ms: featureWindow?.start_esp_time_ms ?? null,
        end_esp_time_ms: featureWindow?.end_esp_time_ms ?? null,
        interpretation_label: interpretation.interpretation_label,
        evidence_level: interpretation.evidence_level,
        confidence_label: interpretation.confidence_label,
        suppression_state: interpretation.suppression_state,
        uncertainty_reasons: safeStringArray(interpretation.uncertainty_reasons),
        contributing_modalities: safeStringArray(
            interpretation.contributing_modalities,
        ),
        excluded_modalities: safeStringArray(interpretation.excluded_modalities),
        source_banner: interpretation.source_banner,
        superseded_by_interpretation_id: null,
        replay_note:
            "Historical interpretation replay. Model and preprocessing versions must be reviewed before comparing regenerated outputs.",
    };
}

function qualityTimelineFromFeatureWindows(
    featureWindows: readonly ObjectiveFeatureWindowRecord[],
): ObjectiveReplayQualityTimelineItem[] {
    return featureWindows.map((window) => ({
        id: `${window.id}:quality`,
        start_esp_time_ms: window.start_esp_time_ms,
        end_esp_time_ms: window.end_esp_time_ms,
        label:
            window.suppression_state === "not_suppressed"
                ? "Quality usable"
                : "Quality limited",
        detail:
            window.suppression_state === "not_suppressed"
                ? "Feature window is available for clinician review with recorded quality metadata."
                : "Feature window is limited by suppression or readiness context.",
        limitations: safeStringArray(window.uncertainty_reasons),
    }));
}

function serializeSegment(segment: ObjectiveSegmentRecord): ObjectiveReplaySegment {
    return {
        segment_id: segment.segment_id,
        session_id: segment.session_id,
        device_boot_id: segment.device_boot_id ?? null,
        reason: segment.reason,
        start_esp_time_ms: segment.start_esp_time_ms,
        end_esp_time_ms: segment.end_esp_time_ms ?? null,
        replay_note:
            "Historical segment boundary for traceability and replay alignment.",
    };
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
}

export async function buildObjectiveSessionReplayPayload(
    repository: ObjectiveSessionReplayRepository,
    sessionId: string,
    now: () => Date = () => new Date(),
): Promise<ObjectiveSessionReplayPayload | null> {
    const session = await repository.getSession(sessionId);
    if (!session) {
        return null;
    }

    const [featureWindows, interpretations, segments] = await Promise.all([
        repository.listFeatureWindowsForSession(sessionId),
        repository.listInterpretationsForSession(sessionId),
        repository.listSegmentsForSession(sessionId),
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
    const sortedSegments = [...segments].sort(
        (left, right) => left.start_esp_time_ms - right.start_esp_time_ms,
    );

    const replayFeatureWindows = sortedFeatureWindows.map(serializeFeatureWindow);
    const replayInterpretations = sortedInterpretations.map((interpretation) =>
        serializeInterpretation(interpretation, featureWindowById),
    );

    return {
        session_id: session.session_id,
        patient_id: session.patient_id,
        source_type: session.source_type,
        source_banner: sourceBanner(session.source_type),
        replay_banner: "historical_non_live_replay",
        replay_scope_note:
            "This payload is a historical, non-live replay for assigned-clinician review. It is not a live stream and not a clinical decision record.",
        chart_ready_samples:
            makeChartSeriesFromFeatureWindows(sortedFeatureWindows),
        feature_windows: replayFeatureWindows,
        interpretation_timeline: replayInterpretations,
        quality_timeline: qualityTimelineFromFeatureWindows(sortedFeatureWindows),
        session_segments: sortedSegments.map(serializeSegment),
        version_metadata: {
            replay_schema_version: "objective-session-replay-v1",
            preprocessing_versions: unique(
                replayFeatureWindows.map((window) => window.preprocessing_version),
            ),
            feature_schema_versions: unique(
                replayFeatureWindows.map((window) => window.feature_schema_version),
            ),
            interpretation_versions: unique(
                sortedInterpretations.map(
                    (interpretation) => interpretation.interpretation_version,
                ),
            ),
            generated_at: now().toISOString(),
            replay_mode: "historical_non_live",
            regenerated_or_superseded_note:
                "If outputs are regenerated or superseded later, compare version metadata before comparing results.",
        },
        visibility: visibility(),
    };
}
