import {
  getObjectiveConnectionStatusCopy,
  getObjectiveLiveStatusCopy,
  getObjectiveSessionStatusLabel,
  getObjectiveSourceBannerCopy,
  OBJECTIVE_LIVE_NO_DATA_DETAIL,
  OBJECTIVE_LIVE_SCOPE_NOTE,
  type ObjectiveDashboardConnectionStatus,
  type ObjectiveDashboardLiveStatus,
  type ObjectiveDashboardSessionStatus,
  type ObjectiveDashboardSourceType,
} from "../_lib/liveMonitoringCopy";
import { ObjectiveQualityFeatureCards } from "./ObjectiveQualityFeatureCards";
import { ObjectiveRawSignalCharts } from "./ObjectiveRawSignalCharts";

export type ObjectiveLiveMonitoringShellProps = {
  sessionId: string;
  sourceType: ObjectiveDashboardSourceType;
  connectionStatus: ObjectiveDashboardConnectionStatus;
  liveStatus: ObjectiveDashboardLiveStatus;
  sessionStatus: ObjectiveDashboardSessionStatus;
  safeEventCount?: number;
  latestEventAt?: string | null;
};

function ObjectiveStatusPanel({
  eyebrow,
  label,
  description,
}: {
  eyebrow: string;
  label: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

export function ObjectiveLiveMonitoringShell({
  sessionId,
  sourceType,
  connectionStatus,
  liveStatus,
  sessionStatus,
  safeEventCount = 0,
  latestEventAt = null,
}: ObjectiveLiveMonitoringShellProps) {
  const sourceBanner = getObjectiveSourceBannerCopy(sourceType);
  const connectionBanner = getObjectiveConnectionStatusCopy(connectionStatus);
  const liveBanner = getObjectiveLiveStatusCopy(liveStatus);
  const sessionStatusLabel = getObjectiveSessionStatusLabel(sessionStatus);

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Live session shell
        </p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Session {sessionId}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Status: {sessionStatusLabel}
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Safe stream events: {safeEventCount}
            {latestEventAt ? ` - Latest event: ${latestEventAt}` : ""}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <ObjectiveStatusPanel
          eyebrow="Source"
          label={sourceBanner.label}
          description={sourceBanner.description}
        />
        <ObjectiveStatusPanel
          eyebrow="Connection"
          label={connectionBanner.label}
          description={connectionBanner.description}
        />
        <ObjectiveStatusPanel
          eyebrow="Live status"
          label={liveBanner.label}
          description={liveBanner.description}
        />
      </div>

      <section
        aria-labelledby="objective-live-scope-title"
        className="rounded-lg border bg-muted/30 p-5"
      >
        <h3
          id="objective-live-scope-title"
          className="text-lg font-semibold tracking-tight"
        >
          Scope note
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {OBJECTIVE_LIVE_SCOPE_NOTE}
        </p>
      </section>

      {liveStatus === "no_data" ? (
        <section
          aria-labelledby="objective-live-no-data-title"
          className="rounded-lg border border-dashed bg-background p-6"
        >
          <h3
            id="objective-live-no-data-title"
            className="text-lg font-semibold tracking-tight"
          >
            No clinician-safe stream data yet
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {OBJECTIVE_LIVE_NO_DATA_DETAIL}
          </p>
        </section>
      ) : null}

      <ObjectiveRawSignalCharts />

      <ObjectiveQualityFeatureCards />
    </section>
  );
}
