"use client";

import { useState } from "react";

type Phase4DemoSessionState = "ready" | "running" | "paused";

type SessionStateCopy = Readonly<{
  label: string;
  eyebrow: string;
  description: string;
}>;

const SESSION_STATE_COPY: Record<Phase4DemoSessionState, SessionStateCopy> = {
  ready: {
    label: "Ready",
    eyebrow: "Demo-ready state",
    description:
      "The local console shell is prepared. Starting the demo updates only this frontend status panel.",
  },
  running: {
    label: "Running",
    eyebrow: "Local demo in progress",
    description:
      "The demo status is active locally. Signal previews, processing progress, and timeline events are added in later commits.",
  },
  paused: {
    label: "Paused",
    eyebrow: "Local demo paused",
    description:
      "The local demo status is paused. No backend connection, hardware source, or chatbot update is involved.",
  },
};

function SessionStatusBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function SessionControlButton({
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
      className="rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ObjectivePhase4SessionStatusPanel() {
  const [sessionState, setSessionState] =
    useState<Phase4DemoSessionState>("ready");

  const stateCopy = SESSION_STATE_COPY[sessionState];

  return (
    <section
      aria-labelledby="objective-phase4-session-status-title"
      className="rounded-lg border bg-background/95 p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stateCopy.eyebrow}
          </p>
          <h3
            id="objective-phase4-session-status-title"
            className="mt-2 text-lg font-semibold tracking-tight"
          >
            Session status
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Local controls prepare the Phase 4 mentor demo flow without starting
            hardware, backend services, live streams, or chatbot updates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SessionStatusBadge>Simulator demo</SessionStatusBadge>
          <SessionStatusBadge>Clinician-only</SessionStatusBadge>
          <SessionStatusBadge>Non-diagnostic</SessionStatusBadge>
          <SessionStatusBadge>No backend connection</SessionStatusBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Demo session state
          </p>
          <p
            data-testid="phase4-demo-session-state"
            className="mt-2 text-2xl font-semibold tracking-tight"
          >
            {stateCopy.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {stateCopy.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SessionControlButton
            disabled={sessionState === "running"}
            onClick={() => setSessionState("running")}
          >
            Start demo session
          </SessionControlButton>
          <SessionControlButton
            disabled={sessionState !== "running"}
            onClick={() => setSessionState("paused")}
          >
            Pause
          </SessionControlButton>
          <SessionControlButton
            disabled={sessionState !== "paused"}
            onClick={() => setSessionState("running")}
          >
            Resume
          </SessionControlButton>
          <SessionControlButton
            disabled={sessionState === "ready"}
            onClick={() => setSessionState("ready")}
          >
            Reset
          </SessionControlButton>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        This control surface changes only local UI state. Scenario binding,
        signal preview updates, processing stages, interpretation context,
        timeline records, and final summary behavior remain placeholders for
        later commits.
      </p>
    </section>
  );
}
