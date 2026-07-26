export type ObjectiveDashboardSourceType =
  | "simulator"
  | "public_dataset_replay"
  | "prototype_hardware"
  | "unknown";

export type ObjectiveDashboardConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export type ObjectiveDashboardLiveStatus = "no_data" | "live" | "degraded";

export type ObjectiveDashboardSessionStatus =
  | "created"
  | "active"
  | "paused"
  | "stopped"
  | "unknown";

export type ObjectiveDashboardBannerCopy = {
  label: string;
  description: string;
};

export function getObjectiveSourceBannerCopy(
  sourceType: ObjectiveDashboardSourceType,
): ObjectiveDashboardBannerCopy {
  switch (sourceType) {
    case "simulator":
      return {
        label: "Simulated data",
        description:
          "This session source is simulator-generated for engineering review. It is not a direct person measurement.",
      };

    case "public_dataset_replay":
      return {
        label: "Public dataset replay",
        description:
          "This session source is replayed from a research-style dataset context. Treat it as source-bound engineering evidence.",
      };

    case "prototype_hardware":
      return {
        label: "Prototype hardware source",
        description:
          "This session source is from prototype acquisition. Treat it as source-bound engineering evidence.",
      };

    case "unknown":
    default:
      return {
        label: "Source not confirmed",
        description:
          "The source context is unavailable. Treat this view as limited until source metadata is available.",
      };
  }
}

export function getObjectiveConnectionStatusCopy(
  status: ObjectiveDashboardConnectionStatus,
): ObjectiveDashboardBannerCopy {
  switch (status) {
    case "connecting":
      return {
        label: "Connecting",
        description:
          "The clinician live view is preparing to receive clinician-safe stream events.",
      };

    case "connected":
      return {
        label: "Connected",
        description:
          "The clinician live view can receive clinician-safe stream events for this session.",
      };

    case "reconnecting":
      return {
        label: "Reconnecting",
        description:
          "The clinician live view is attempting to restore the stream and may show latest safe state.",
      };

    case "closed":
      return {
        label: "Closed",
        description:
          "The live stream is closed. Reopen the session view when access and source context are available.",
      };

    case "not_connected":
    default:
      return {
        label: "Not connected",
        description:
          "No live stream connection has been opened from this shell yet.",
      };
  }
}

export function getObjectiveLiveStatusCopy(
  status: ObjectiveDashboardLiveStatus,
): ObjectiveDashboardBannerCopy {
  switch (status) {
    case "live":
      return {
        label: "Live",
        description:
          "Clinician-safe stream events are available for this session view.",
      };

    case "degraded":
      return {
        label: "Degraded",
        description:
          "Some expected stream context is missing or delayed. Review source and quality context before interpreting.",
      };

    case "no_data":
    default:
      return {
        label: "No data yet",
        description:
          "No clinician-safe stream data has been received for this session view.",
      };
  }
}

export function getObjectiveSessionStatusLabel(
  status: ObjectiveDashboardSessionStatus,
): string {
  switch (status) {
    case "created":
      return "Created";
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "stopped":
      return "Stopped";
    case "unknown":
    default:
      return "Unknown";
  }
}

export const OBJECTIVE_LIVE_SCOPE_NOTE =
  "This live objective view is clinician-only, non-diagnostic, and limited to source-bound physiological monitoring context.";

export const OBJECTIVE_LIVE_NO_DATA_DETAIL =
  "Charts, signal-quality cards, interpretation cards, timelines, and clinician notes are intentionally added in later commits.";
