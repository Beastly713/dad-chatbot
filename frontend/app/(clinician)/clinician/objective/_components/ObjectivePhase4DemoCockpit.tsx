"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getNextPhase4DemoElapsedSeconds,
  getPhase4DemoPlaybackSnapshot,
  PHASE4_DEMO_PLAYBACK_SCENARIOS,
  PHASE4_DEMO_DURATION_SECONDS,
  type Phase4DemoMetric,
  type Phase4DemoPipelineStageSnapshot,
  type Phase4DemoPlaybackStatus,
  type Phase4DemoSignalChannel,
} from "../_lib/phase4DemoPlayback";
import {
  PHASE4_DEFAULT_DEMO_SCENARIO_ID,
  type Phase4DemoScenarioId,
} from "../_lib/phase4DemoScenarios";

type Phase4ReviewTab =
  | "Quality"
  | "Features"
  | "Interpretation"
  | "Timeline"
  | "Summary"
  | "Safety";

const REVIEW_TABS = [
  "Quality",
  "Features",
  "Interpretation",
  "Timeline",
  "Summary",
  "Safety",
] as const satisfies readonly Phase4ReviewTab[];

function statusLabel(status: Phase4DemoPlaybackStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "complete":
      return "Complete";
  }
}

function CockpitBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-200">
      {children}
    </span>
  );
}

function SessionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-100">{value}</span>
    </span>
  );
}

function ControlButton({
  children,
  disabled = false,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-sm transition hover:border-cyan-200/40 hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function MetricCard({ metric }: { metric: Phase4DemoMetric }) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {metric.label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">
        {metric.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{metric.detail}</p>
    </article>
  );
}

function buildPolyline(values: readonly number[], progressPercent: number) {
  const visibleCount = Math.max(
    3,
    Math.ceil(values.length * Math.max(progressPercent, 14) * 0.01),
  );
  const visibleValues = values.slice(0, visibleCount);
  const max = Math.max(...visibleValues, 1);
  const min = Math.min(...visibleValues, 0);
  const span = Math.max(max - min, 1);

  return visibleValues
    .map((value, index) => {
      const x =
        visibleValues.length === 1
          ? 0
          : (index / (visibleValues.length - 1)) * 100;
      const y = 74 - ((value - min) / span) * 54;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function SignalPreview({
  channel,
  progressPercent,
  isRunning,
}: {
  channel: Phase4DemoSignalChannel;
  progressPercent: number;
  isRunning: boolean;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            {channel.label}
          </h4>
          <p className="text-xs text-slate-500">{channel.detail}</p>
        </div>
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",
            isRunning ? "animate-pulse bg-cyan-300" : "bg-slate-600",
          ].join(" ")}
          aria-hidden="true"
        />
      </div>
      <svg
        viewBox="0 0 100 80"
        role="img"
        aria-label={`${channel.label} waveform`}
        className="mt-3 h-20 w-full overflow-visible"
      >
        <path
          d="M0 74 H100"
          className="stroke-white/10"
          strokeWidth="1"
          fill="none"
        />
        <polyline
          points={buildPolyline(channel.values, progressPercent)}
          className={channel.accentClass}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </article>
  );
}

function PipelineStage({ stage }: { stage: Phase4DemoPipelineStageSnapshot }) {
  const statusClass =
    stage.status === "complete"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
      : stage.status === "active"
        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
        : "border-white/10 bg-white/[0.03] text-slate-500";

  return (
    <li className={`rounded-md border px-3 py-2 text-xs ${statusClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{stage.label}</span>
        <span className="capitalize">{stage.status}</span>
      </div>
    </li>
  );
}

export function ObjectivePhase4DemoCockpit() {
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<Phase4DemoScenarioId>(PHASE4_DEFAULT_DEMO_SCENARIO_ID);
  const [status, setStatus] = useState<Phase4DemoPlaybackStatus>("ready");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<Phase4ReviewTab>("Quality");

  const snapshot = useMemo(
    () =>
      getPhase4DemoPlaybackSnapshot({
        scenarioId: selectedScenarioId,
        status,
        elapsedSeconds,
      }),
    [elapsedSeconds, selectedScenarioId, status],
  );

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    const intervalId = setInterval(() => {
      setElapsedSeconds((current) =>
        getNextPhase4DemoElapsedSeconds(
          current,
          PHASE4_DEMO_DURATION_SECONDS,
        ),
      );
    }, 800);

    return () => clearInterval(intervalId);
  }, [status]);

  useEffect(() => {
    if (status === "running" && elapsedSeconds >= PHASE4_DEMO_DURATION_SECONDS) {
      setStatus("complete");
    }
  }, [elapsedSeconds, status]);

  function selectScenario(id: Phase4DemoScenarioId) {
    setSelectedScenarioId(id);
    setElapsedSeconds(0);
    setStatus("ready");
    setActiveTab("Quality");
  }

  function startPlayback() {
    setStatus("running");
  }

  function pausePlayback() {
    setStatus("paused");
  }

  function resetPlayback() {
    setElapsedSeconds(0);
    setStatus("ready");
    setActiveTab("Quality");
  }

  const activeStage = snapshot.pipelineStages.find(
    (stage) => stage.status === "active",
  );

  return (
    <section
      aria-labelledby="objective-phase4-cockpit-title"
      data-testid="phase4-demo-cockpit"
      className="min-h-[calc(100vh-11rem)] rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-2xl"
    >
      <header className="rounded-lg border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/70 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
              Clinician-only simulator demo
            </p>
            <h2
              id="objective-phase4-cockpit-title"
              className="mt-1 text-2xl font-semibold text-white"
            >
              Objective Monitoring Console
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Clinician-only simulator demo for source-bound physiological
              review
            </p>
          </div>
          <div className="flex max-w-2xl flex-wrap gap-2">
            <CockpitBadge>Clinician-only</CockpitBadge>
            <CockpitBadge>Simulator demo</CockpitBadge>
            <CockpitBadge>Non-diagnostic</CockpitBadge>
            <CockpitBadge>Frontend-only</CockpitBadge>
            <CockpitBadge>No chatbot update</CockpitBadge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SessionChip label="Demo patient" value="demo-patient-001" />
          <SessionChip label="Mode" value="Phase 4 P0" />
          <SessionChip label="Runtime" value="Local demo playback" />
          <SessionChip label="Status" value={statusLabel(status)} />
        </div>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Scenario setup</h3>
            <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100">
              Local
            </span>
          </div>

          <div className="mt-3 grid gap-2" data-testid="phase4-scenario-list">
            {PHASE4_DEMO_PLAYBACK_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                aria-pressed={selectedScenarioId === scenario.id}
                onClick={() => selectScenario(scenario.id)}
                className={[
                  "rounded-md border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
                  selectedScenarioId === scenario.id
                    ? "border-cyan-300/50 bg-cyan-300/15"
                    : "border-white/10 bg-slate-950/50 hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <span className="block text-xs font-semibold text-slate-100">
                  {scenario.title}
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  {scenario.shortLabel}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-white/10 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Playback controls
              </h3>
              <span
                data-testid="phase4-playback-status"
                className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200"
              >
                {statusLabel(status)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ControlButton
                disabled={status === "running"}
                onClick={startPlayback}
              >
                {status === "paused" ? "Resume" : "Start"}
              </ControlButton>
              <ControlButton
                disabled={status !== "running"}
                onClick={pausePlayback}
              >
                Pause
              </ControlButton>
              <ControlButton disabled={status === "ready"} onClick={resetPlayback}>
                Reset
              </ControlButton>
              <ControlButton
                disabled={status === "complete"}
                onClick={() => {
                  setElapsedSeconds(PHASE4_DEMO_DURATION_SECONDS);
                  setStatus("complete");
                }}
              >
                Complete
              </ControlButton>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{snapshot.elapsedSeconds}s elapsed</span>
                <span data-testid="phase4-playback-progress">
                  {snapshot.progressPercent}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-300 transition-all"
                  style={{ width: `${snapshot.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">
                Live-looking signal previews
              </p>
              <h3
                data-testid="phase4-selected-scenario-title"
                className="mt-1 text-xl font-semibold text-white"
              >
                {snapshot.scenario.title}
              </h3>
              <p
                data-testid="phase4-scenario-focus"
                className="mt-1 text-sm text-slate-400"
              >
                {snapshot.scenario.focus}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Current stage
              </p>
              <p data-testid="phase4-current-stage" className="text-sm font-semibold">
                {activeStage?.label ?? snapshot.currentStage}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {snapshot.scenario.signalChannels.map((channel) => (
              <SignalPreview
                key={channel.label}
                channel={channel}
                progressPercent={snapshot.progressPercent}
                isRunning={status === "running"}
              />
            ))}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-semibold text-white">Session status</h3>
            <div className="mt-3 grid gap-2">
              <MetricCard
                metric={{
                  label: "Status",
                  value: statusLabel(status),
                  detail: "Local frontend playback only.",
                }}
              />
              <MetricCard
                metric={{
                  label: "Readiness",
                  value: snapshot.scenario.readinessLabel,
                  detail: snapshot.scenario.readinessDetail,
                }}
              />
              <MetricCard
                metric={{
                  label: "Interpretation",
                  value: snapshot.scenario.interpretationLabel,
                  detail: snapshot.scenario.confidenceDetail,
                }}
              />
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-semibold text-white">
              Processing pipeline
            </h3>
            <ol className="mt-3 grid gap-2">
              {snapshot.pipelineStages.map((stage) => (
                <PipelineStage key={stage.label} stage={stage} />
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review tabs">
          {REVIEW_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
                activeTab === tab
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-slate-950/50 text-slate-400 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-[11rem]" data-testid="phase4-active-review-panel">
          {activeTab === "Quality" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Quality/readiness
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {snapshot.scenario.qualityMetrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "Features" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Feature-window context
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {snapshot.scenario.featureMetrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "Interpretation" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Interpretation context
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {snapshot.scenario.interpretationMetrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Bounded, non-diagnostic, source-bound, and
                clinician-reviewable.
              </p>
            </div>
          )}

          {activeTab === "Timeline" && (
            <div>
              <h3 className="text-sm font-semibold text-white">Timeline</h3>
              <ol className="mt-3 grid gap-2">
                {snapshot.visibleTimelineEvents.map((event) => (
                  <li
                    key={`${event.atSecond}:${event.label}`}
                    className="rounded-md border border-white/10 bg-slate-950/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-100">
                        {event.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {event.atSecond}s
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {event.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {activeTab === "Summary" && (
            <div>
              <h3 className="text-sm font-semibold text-white">Final summary</h3>
              {snapshot.summaryUnlocked ? (
                <>
                  <p
                    data-testid="phase4-summary-headline"
                    className="mt-3 text-lg font-semibold text-cyan-100"
                  >
                    {snapshot.scenario.summaryHeadline}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {snapshot.scenario.summaryDetail}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    {snapshot.scenario.summaryMetrics.map((metric) => (
                      <MetricCard key={metric.label} metric={metric} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 rounded-md border border-white/10 bg-slate-950/60 p-4">
                  <p
                    data-testid="phase4-summary-locked"
                    className="text-sm font-semibold text-slate-100"
                  >
                    Summary locked
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Complete more local playback to unlock the demo summary.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "Safety" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Safety boundaries
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  "Clinician-only",
                  "Simulator demo",
                  "Non-diagnostic",
                  "Source-bound physiological evidence",
                  "No chatbot update",
                  "No patient-facing output",
                  "No backend connection",
                  "No live hardware",
                  "No note persistence",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-medium text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-4 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-400">
        <span>clinician_visible=true</span>
        <span>patient_visible=false</span>
        <span>chatbot_visible=false</span>
        <span>Frontend-only</span>
        <span>No backend connection</span>
        <span>No live hardware</span>
        <span>No note persistence</span>
        <span>No persistence</span>
      </footer>
    </section>
  );
}
