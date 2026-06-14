"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getNextPhase4DemoElapsedSeconds,
  getPhase4DemoPlaybackSnapshot,
  PHASE4_DEMO_PLAYBACK_SCENARIOS,
  PHASE4_DEMO_DURATION_SECONDS,
  type Phase4DemoPipelineStageSnapshot,
  type Phase4DemoPlaybackStatus,
} from "../_lib/phase4DemoPlayback";
import {
  formatPhase4DemoTime,
  getPhase4CurrentStreamState,
  PHASE4_VISIBLE_WINDOW_SECONDS,
  type Phase4DisplayStreamFrame,
} from "../_lib/phase4DemoStream";
import {
  PHASE4_DEFAULT_DEMO_SCENARIO_ID,
  type Phase4DemoScenarioId,
} from "../_lib/phase4DemoScenarios";

type Phase4ReviewTab = "Stream" | "Features" | "Timeline" | "Summary" | "Safety";
type Phase4PlaybackSpeed = 1 | 2 | 4 | 8;
type Phase4ChartKey =
  | "ecgDisplayAmplitude"
  | "conductanceTrend"
  | "pulseWaveform"
  | "movementMagnitude"
  | "temperatureContactDelta";

const REVIEW_TABS = [
  "Stream",
  "Features",
  "Timeline",
  "Summary",
  "Safety",
] as const satisfies readonly Phase4ReviewTab[];

const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const satisfies readonly Phase4PlaybackSpeed[];

const CHARTS = [
  {
    key: "ecgDisplayAmplitude",
    title: "ECG display amplitude",
    scale: "Normalized display scale",
    colorClass: "stroke-emerald-300",
    fillClass: "fill-emerald-300/10",
  },
  {
    key: "conductanceTrend",
    title: "Conductance trend",
    scale: "Normalized conductance display",
    colorClass: "stroke-cyan-300",
    fillClass: "fill-cyan-300/10",
  },
  {
    key: "pulseWaveform",
    title: "Pulse waveform",
    scale: "Normalized pulse display",
    colorClass: "stroke-sky-300",
    fillClass: "fill-sky-300/10",
  },
  {
    key: "movementMagnitude",
    title: "Movement magnitude",
    scale: "Movement display scale",
    colorClass: "stroke-violet-300",
    fillClass: "fill-violet-300/10",
  },
  {
    key: "temperatureContactDelta",
    title: "Temperature/contact delta",
    scale: "Contact delta display",
    colorClass: "stroke-amber-300",
    fillClass: "fill-amber-300/10",
  },
] as const satisfies readonly {
  key: Phase4ChartKey;
  title: string;
  scale: string;
  colorClass: string;
  fillClass: string;
}[];

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

function frameValue(frame: Phase4DisplayStreamFrame, key: Phase4ChartKey): number {
  return frame[key];
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

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function buildLinePath(
  frames: readonly Phase4DisplayStreamFrame[],
  key: Phase4ChartKey,
): string {
  if (frames.length === 0) {
    return "";
  }

  return frames
    .map((frame, index) => {
      const x = frames.length === 1 ? 0 : (index / (frames.length - 1)) * 100;
      const y = 82 - frameValue(frame, key) * 0.64;
      const command = index === 0 ? "M" : "L";
      return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(
  frames: readonly Phase4DisplayStreamFrame[],
  key: Phase4ChartKey,
): string {
  const linePath = buildLinePath(frames, key);
  if (!linePath || frames.length === 0) {
    return "";
  }

  return `${linePath} L100 86 L0 86 Z`;
}

function chartXForSecond(
  frames: readonly Phase4DisplayStreamFrame[],
  timeSeconds: number,
): number {
  if (frames.length <= 1) {
    return 0;
  }

  const first = frames[0].timeSeconds;
  const last = frames[frames.length - 1].timeSeconds;
  const span = Math.max(last - first, 1);
  return ((timeSeconds - first) / span) * 100;
}

function ObjectivePhase4SignalChart({
  title,
  scale,
  colorClass,
  fillClass,
  chartKey,
  frames,
  currentFrame,
  evidenceStartSecond,
  evidenceEndSecond,
}: {
  title: string;
  scale: string;
  colorClass: string;
  fillClass: string;
  chartKey: Phase4ChartKey;
  frames: readonly Phase4DisplayStreamFrame[];
  currentFrame: Phase4DisplayStreamFrame;
  evidenceStartSecond: number;
  evidenceEndSecond: number;
}) {
  const firstTime = frames[0]?.timeSeconds ?? 0;
  const lastTime = frames[frames.length - 1]?.timeSeconds ?? 0;
  const evidenceStartX = chartXForSecond(frames, evidenceStartSecond);
  const evidenceEndX = chartXForSecond(frames, evidenceEndSecond);
  const evidenceWidth = Math.max(evidenceEndX - evidenceStartX, 0);

  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="mt-1 text-[11px] text-slate-500">{scale}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Latest value
          </p>
          <p className="text-lg font-semibold text-cyan-100">
            {frameValue(currentFrame, chartKey).toFixed(1)}
          </p>
        </div>
      </div>

      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${title} chart with axes, grid, cursor, and evidence annotation`}
        className="mt-3 h-44 w-full overflow-visible"
      >
        <rect x="0" y="0" width="100" height="100" className="fill-slate-950" />
        {[20, 40, 60, 80].map((line) => (
          <path
            key={`h-${line}`}
            d={`M0 ${line} H100`}
            className="stroke-white/10"
            strokeWidth="0.4"
          />
        ))}
        {[20, 40, 60, 80].map((line) => (
          <path
            key={`v-${line}`}
            d={`M${line} 0 V88`}
            className="stroke-white/10"
            strokeWidth="0.4"
          />
        ))}
        <rect
          x="0"
          y="36"
          width="100"
          height="22"
          className="fill-white/[0.03]"
        />
        {evidenceWidth > 0 && (
          <rect
            x={evidenceStartX}
            y="0"
            width={evidenceWidth}
            height="88"
            className="fill-cyan-300/10"
          />
        )}
        {frames.some((frame) => frame.qualityLabel === "Limited") && (
          <rect x="0" y="0" width="100" height="88" className="fill-amber-300/5" />
        )}
        <path
          d={buildAreaPath(frames, chartKey)}
          className={fillClass}
          strokeWidth="0"
        />
        <path
          d={buildLinePath(frames, chartKey)}
          className={colorClass}
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0 88 H100 M0 0 V88"
          className="stroke-white/30"
          strokeWidth="0.7"
          fill="none"
        />
        <path
          d="M100 0 V88"
          className="stroke-cyan-200"
          strokeWidth="0.7"
          strokeDasharray="2 2"
        />
        <circle
          cx="100"
          cy={82 - frameValue(currentFrame, chartKey) * 0.64}
          r="1.6"
          className="fill-cyan-100"
        />
        <text x="1" y="97" className="fill-slate-500 text-[4px]">
          {formatPhase4DemoTime(firstTime)}
        </text>
        <text x="41" y="97" className="fill-slate-500 text-[4px]">
          Time ticks
        </text>
        <text x="87" y="97" className="fill-slate-500 text-[4px]">
          {formatPhase4DemoTime(lastTime)}
        </text>
        <text x="3" y="8" className="fill-cyan-100 text-[4px]">
          Evidence annotation
        </text>
        <text x="3" y="55" className="fill-slate-500 text-[4px]">
          Baseline/reference band
        </text>
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
  const [activeTab, setActiveTab] = useState<Phase4ReviewTab>("Stream");
  const [playbackSpeed, setPlaybackSpeed] = useState<Phase4PlaybackSpeed>(1);

  const snapshot = useMemo(
    () =>
      getPhase4DemoPlaybackSnapshot({
        scenarioId: selectedScenarioId,
        status,
        elapsedSeconds,
      }),
    [elapsedSeconds, selectedScenarioId, status],
  );

  const streamState = useMemo(
    () =>
      getPhase4CurrentStreamState({
        scenarioId: selectedScenarioId,
        elapsedSeconds,
      }),
    [elapsedSeconds, selectedScenarioId],
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
          playbackSpeed,
        ),
      );
    }, 700);

    return () => clearInterval(intervalId);
  }, [playbackSpeed, status]);

  useEffect(() => {
    if (status === "running" && elapsedSeconds >= PHASE4_DEMO_DURATION_SECONDS) {
      setStatus("complete");
    }
  }, [elapsedSeconds, status]);

  function selectScenario(id: Phase4DemoScenarioId) {
    setSelectedScenarioId(id);
    setElapsedSeconds(0);
    setStatus("ready");
    setActiveTab("Stream");
  }

  function startPlayback() {
    if (status === "complete") {
      setElapsedSeconds(0);
    }
    setStatus("running");
  }

  function pausePlayback() {
    setStatus("paused");
  }

  function resetPlayback() {
    setElapsedSeconds(0);
    setStatus("ready");
    setActiveTab("Stream");
  }

  function scrubTo(value: string) {
    const nextElapsed = Number(value);
    setElapsedSeconds(nextElapsed);
    setStatus(nextElapsed >= PHASE4_DEMO_DURATION_SECONDS ? "complete" : "paused");
  }

  const activeStage = snapshot.pipelineStages.find(
    (stage) => stage.status === "active",
  );

  const evidenceWindow = streamState.scenario.evidenceWindow;

  return (
    <section
      aria-labelledby="objective-phase4-cockpit-title"
      data-testid="phase4-demo-cockpit"
      className="min-h-[calc(100vh-6rem)] max-w-none rounded-none border border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-2xl"
    >
      <header className="rounded-lg border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/70 p-4">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
          <div className="flex max-w-3xl flex-wrap gap-2">
            <CockpitBadge>Clinician-only</CockpitBadge>
            <CockpitBadge>Simulator demo</CockpitBadge>
            <CockpitBadge>Non-diagnostic</CockpitBadge>
            <CockpitBadge>Frontend-only</CockpitBadge>
            <CockpitBadge>No chatbot update</CockpitBadge>
            <CockpitBadge>No backend connection</CockpitBadge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SessionChip label="Demo patient" value="demo-patient-001" />
          <SessionChip label="Mode" value="Phase 4 P0" />
          <SessionChip label="Runtime" value="Local demo playback" />
          <SessionChip label="Window" value={`${PHASE4_VISIBLE_WINDOW_SECONDS}s visible`} />
          <SessionChip label="Status" value={statusLabel(status)} />
        </div>
      </header>

      <div className="mt-4 grid min-h-[34rem] gap-4 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
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
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Playback speed
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    aria-pressed={playbackSpeed === speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={[
                      "rounded-md border px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
                      playbackSpeed === speed
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/10 bg-slate-950/50 text-slate-400 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span data-testid="phase4-playback-time">
                  {formatPhase4DemoTime(snapshot.elapsedSeconds)} /{" "}
                  {formatPhase4DemoTime(snapshot.durationSeconds)}
                </span>
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
              <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Scrubber
                <input
                  aria-label="Demo playback scrubber"
                  data-testid="phase4-playback-scrubber"
                  type="range"
                  min={0}
                  max={PHASE4_DEMO_DURATION_SECONDS}
                  step={1}
                  value={snapshot.elapsedSeconds}
                  onChange={(event) => scrubTo(event.currentTarget.value)}
                  className="mt-2 block w-full accent-cyan-300"
                />
              </label>
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">
                Signal visualization workspace
              </p>
              <h3
                data-testid="phase4-selected-scenario-title"
                className="mt-1 text-xl font-semibold text-white"
              >
                {streamState.scenario.title}
              </h3>
              <p
                data-testid="phase4-scenario-focus"
                className="mt-1 text-sm text-slate-400"
              >
                {streamState.scenario.focus}
              </p>
            </div>
            <div className="grid gap-2 text-right sm:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Current stage
                </p>
                <p data-testid="phase4-current-stage" className="text-sm font-semibold">
                  {activeStage?.label ?? snapshot.currentStage}
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {evidenceWindow.label}
                </p>
                <p className="text-sm font-semibold text-cyan-100">
                  {streamState.scenario.interpretationLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {CHARTS.map((chart) => (
              <ObjectivePhase4SignalChart
                key={chart.key}
                title={chart.title}
                scale={chart.scale}
                colorClass={chart.colorClass}
                fillClass={chart.fillClass}
                chartKey={chart.key}
                frames={streamState.visibleFrames}
                currentFrame={streamState.currentFrame}
                evidenceStartSecond={evidenceWindow.startSecond}
                evidenceEndSecond={evidenceWindow.endSecond}
              />
            ))}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-semibold text-white">Session state</h3>
            <div className="mt-3 grid gap-2">
              <MetricCard
                label="Status"
                value={statusLabel(status)}
                detail="Local frontend playback only."
              />
              <MetricCard
                label="Signal quality"
                value={streamState.currentFrame.qualityLabel}
                detail="Quality label for the current demo stream frame."
              />
              <MetricCard
                label="Current frame"
                value={formatPhase4DemoTime(streamState.currentFrame.timeSeconds)}
                detail="Source frame time from simulated frontend demo."
              />
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-semibold text-white">
              Interpretation snapshot
            </h3>
            <div className="mt-3 grid gap-2">
              <MetricCard
                label="Pattern"
                value={streamState.scenario.interpretationLabel}
                detail={streamState.scenario.confidenceDetail}
              />
              <MetricCard
                label="Agreement"
                value={streamState.scenario.confidenceLabel}
                detail={streamState.scenario.agreementSummary}
              />
              <MetricCard
                label="Limitation"
                value="Bounded review"
                detail={streamState.scenario.limitationText}
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

        <div className="mt-3 min-h-[13rem]" data-testid="phase4-active-review-panel">
          {activeTab === "Stream" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Stream inspector
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Source: Simulated frontend demo. Values are safe display stream
                values for the dashboard.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="grid gap-2 rounded-md border border-white/10 bg-slate-950/50 p-3">
                  <MetricCard
                    label="Source frame time"
                    value={formatPhase4DemoTime(streamState.currentFrame.timeSeconds)}
                    detail="Current demo stream frame."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard
                      label="ECG display amplitude"
                      value={streamState.currentFrame.ecgDisplayAmplitude.toFixed(1)}
                      detail="Safe display value."
                    />
                    <MetricCard
                      label="Conductance trend"
                      value={streamState.currentFrame.conductanceTrend.toFixed(1)}
                      detail="Safe display value."
                    />
                    <MetricCard
                      label="Pulse waveform"
                      value={streamState.currentFrame.pulseWaveform.toFixed(1)}
                      detail="Safe display value."
                    />
                    <MetricCard
                      label="Movement magnitude"
                      value={streamState.currentFrame.movementMagnitude.toFixed(1)}
                      detail="Safe display value."
                    />
                    <MetricCard
                      label="Temperature/contact delta"
                      value={streamState.currentFrame.temperatureContactDelta.toFixed(1)}
                      detail="Safe display value."
                    />
                    <MetricCard
                      label="Signal quality"
                      value={streamState.currentFrame.qualityLabel}
                      detail={streamState.currentFrame.stageId}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border border-white/10">
                  <h4 className="bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200">
                    Recent frames
                  </h4>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.06] text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">ECG display</th>
                        <th className="px-3 py-2 font-medium">Conductance</th>
                        <th className="px-3 py-2 font-medium">Pulse</th>
                        <th className="px-3 py-2 font-medium">Movement</th>
                        <th className="px-3 py-2 font-medium">Temp/contact</th>
                        <th className="px-3 py-2 font-medium">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {streamState.recentFrames.map((frame) => (
                        <tr key={frame.timeSeconds} className="bg-slate-950/40">
                          <td className="px-3 py-2 text-slate-300">
                            {formatPhase4DemoTime(frame.timeSeconds)}
                          </td>
                          <td className="px-3 py-2">{frame.ecgDisplayAmplitude.toFixed(1)}</td>
                          <td className="px-3 py-2">{frame.conductanceTrend.toFixed(1)}</td>
                          <td className="px-3 py-2">{frame.pulseWaveform.toFixed(1)}</td>
                          <td className="px-3 py-2">{frame.movementMagnitude.toFixed(1)}</td>
                          <td className="px-3 py-2">{frame.temperatureContactDelta.toFixed(1)}</td>
                          <td className="px-3 py-2">{frame.qualityLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Features" && (
            <div>
              <h3 className="text-sm font-semibold text-white">
                Display-window feature summaries
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {streamState.featureSummaries.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    detail={metric.detail}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === "Timeline" && (
            <div>
              <h3 className="text-sm font-semibold text-white">Timeline</h3>
              <ol className="mt-3 grid gap-2 lg:grid-cols-2">
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
                        {formatPhase4DemoTime(event.atSecond)}
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
                    {streamState.scenario.summaryHeadline}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {streamState.scenario.summaryDetail}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <MetricCard
                      label="Visible session duration"
                      value={formatPhase4DemoTime(snapshot.elapsedSeconds)}
                      detail="Local demo playback duration."
                    />
                    <MetricCard
                      label="Interpretable window coverage"
                      value={streamState.featureSummaries[5]?.value ?? "0%"}
                      detail="Visible frame quality coverage."
                    />
                    <MetricCard
                      label="Modality availability"
                      value="5/5"
                      detail="Display channels visible in the cockpit."
                    />
                    <MetricCard
                      label="Bounded interpretation label"
                      value={streamState.scenario.interpretationLabel}
                      detail="Clinician-reviewable only."
                    />
                  </div>
                </>
              ) : (
                <div className="mt-3 rounded-md border border-white/10 bg-slate-950/60 p-4">
                  <p
                    data-testid="phase4-summary-locked"
                    className="text-sm font-semibold text-slate-100"
                  >
                    Summary unlocks after review window completes
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Scrub near the end or complete local playback to view the
                    bounded demo summary.
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
