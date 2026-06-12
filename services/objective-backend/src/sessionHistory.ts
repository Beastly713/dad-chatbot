import type {
    ObjectiveSessionRecord,
    ObjectiveSessionRepository,
} from "./sessionLifecycle.js";

export type ObjectiveSessionHistoryVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveSessionHistorySafeSummary = {
    label: string;
    detail: string;
};

export type ObjectiveSessionHistoryQualitySummary = {
    label: string;
    detail: string;
    limitations: string[];
};

export type ObjectiveSessionHistoryListItem = {
    session_id: string;
    patient_id: string;
    source_type: ObjectiveSessionRecord["source_type"];
    source_banner:
        | "simulated_data"
        | "public_dataset_replay"
        | "prototype_hardware";
    status: ObjectiveSessionRecord["status"];
    duration_ms: number | null;
    duration_label: string;
    created_at: string;
    started_at: string | null;
    stopped_at: string | null;
    safe_summary: ObjectiveSessionHistorySafeSummary;
    quality_summary: ObjectiveSessionHistoryQualitySummary;
    visibility: ObjectiveSessionHistoryVisibility;
};

export type ObjectiveSessionHistoryDetail = ObjectiveSessionHistoryListItem & {
    device_id: string | null;
    device_boot_id: string | null;
    history_scope_note: string;
};

export type ObjectiveSessionHistoryRepository = Pick<
    ObjectiveSessionRepository,
    "getSession"
> & {
    listSessionsForPatient(patientId: string): Promise<ObjectiveSessionRecord[]>;
};

function visibility(): ObjectiveSessionHistoryVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function sourceBanner(
    sourceType: ObjectiveSessionRecord["source_type"],
): ObjectiveSessionHistoryListItem["source_banner"] {
    switch (sourceType) {
        case "simulator":
            return "simulated_data";
        case "public_dataset_replay":
            return "public_dataset_replay";
        case "prototype_hardware":
            return "prototype_hardware";
    }
}

function parseTime(value: string | undefined): number | null {
    if (!value) {
        return null;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function calculateObjectiveSessionDurationMs(
    session: ObjectiveSessionRecord,
    now: () => Date = () => new Date(),
): number | null {
    const startMs = parseTime(session.started_at ?? session.created_at);
    if (startMs === null) {
        return null;
    }

    const endMs =
        parseTime(session.stopped_at) ??
        parseTime(session.paused_at) ??
        (session.status === "active" ? now().getTime() : null);

    if (endMs === null || endMs < startMs) {
        return null;
    }

    return endMs - startMs;
}

export function formatObjectiveDuration(durationMs: number | null): string {
    if (durationMs === null) {
        return "Duration unavailable";
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
}

function safeSummaryForSession(
    session: ObjectiveSessionRecord,
): ObjectiveSessionHistorySafeSummary {
    switch (session.status) {
        case "created":
            return {
                label: "Session created",
                detail:
                    "Session metadata exists, but no completed monitoring period is summarized yet.",
            };
        case "active":
            return {
                label: "Session active",
                detail:
                    "Session is active. History summary remains limited until completed windows are available.",
            };
        case "paused":
            return {
                label: "Session paused",
                detail:
                    "Session is paused. Review available source and quality context before interpreting.",
            };
        case "stopped":
            return {
                label: "Session stopped",
                detail:
                    "Session is stopped. Safe history metadata is available for clinician review.",
            };
        case "aborted":
            return {
                label: "Session aborted",
                detail:
                    "Session ended before a complete monitoring summary could be prepared.",
            };
    }
}

function qualitySummaryForSession(
    session: ObjectiveSessionRecord,
): ObjectiveSessionHistoryQualitySummary {
    return {
        label: "Quality summary pending",
        detail:
            "Detailed quality distribution is added through replay and final summary stages. This endpoint returns safe session-level metadata only.",
        limitations: [
            "No raw physiological samples are returned.",
            "No chart-ready replay payload is returned in this commit.",
            `Source context: ${session.source_type}.`,
        ],
    };
}

export function serializeObjectiveSessionHistoryListItem(
    session: ObjectiveSessionRecord,
    now: () => Date = () => new Date(),
): ObjectiveSessionHistoryListItem {
    const durationMs = calculateObjectiveSessionDurationMs(session, now);

    return {
        session_id: session.session_id,
        patient_id: session.patient_id,
        source_type: session.source_type,
        source_banner: sourceBanner(session.source_type),
        status: session.status,
        duration_ms: durationMs,
        duration_label: formatObjectiveDuration(durationMs),
        created_at: session.created_at,
        started_at: session.started_at ?? null,
        stopped_at: session.stopped_at ?? null,
        safe_summary: safeSummaryForSession(session),
        quality_summary: qualitySummaryForSession(session),
        visibility: visibility(),
    };
}

export function serializeObjectiveSessionHistoryDetail(
    session: ObjectiveSessionRecord,
    now: () => Date = () => new Date(),
): ObjectiveSessionHistoryDetail {
    return {
        ...serializeObjectiveSessionHistoryListItem(session, now),
        device_id: session.device_id ?? null,
        device_boot_id: session.device_boot_id ?? null,
        history_scope_note:
            "This history endpoint returns clinician-safe session metadata only. Historical replay data is added in a later commit.",
    };
}

export async function listObjectiveSessionHistoryForPatient(
    repository: ObjectiveSessionHistoryRepository,
    patientId: string,
    now: () => Date = () => new Date(),
): Promise<ObjectiveSessionHistoryListItem[]> {
    const sessions = await repository.listSessionsForPatient(patientId);
    return sessions.map((session) =>
        serializeObjectiveSessionHistoryListItem(session, now),
    );
}

export async function getObjectiveSessionHistoryDetail(
    repository: ObjectiveSessionHistoryRepository,
    sessionId: string,
    now: () => Date = () => new Date(),
): Promise<ObjectiveSessionHistoryDetail | null> {
    const session = await repository.getSession(sessionId);
    return session ? serializeObjectiveSessionHistoryDetail(session, now) : null;
}

export function createObjectiveSessionHistoryRepositoryFromSessions(
    sessions: ObjectiveSessionRepository,
): ObjectiveSessionHistoryRepository {
    return {
        getSession: sessions.getSession.bind(sessions),
        async listSessionsForPatient(patientId: string) {
            if (sessions.listSessionsForPatient) {
                return sessions.listSessionsForPatient(patientId);
            }

            return [];
        },
    };
}
