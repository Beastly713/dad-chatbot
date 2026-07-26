export type ObjectiveTimelineEventKind =
  | "interpretation"
  | "quality"
  | "segment"
  | "suppression"
  | "cooldown";

export type ObjectiveTimelineEvent = {
  id: string;
  kind: ObjectiveTimelineEventKind;
  timeLabel: string;
  title: string;
  summary: string;
  sourceContext: string;
};

export type ObjectiveQualityTimelineItem = {
  id: string;
  timeLabel: string;
  modality: string;
  qualityLabel: "usable" | "limited" | "insufficient";
  detail: string;
};

export type ObjectiveSessionSummaryMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ObjectiveClinicianNoteItem = {
  id: string;
  authorLabel: string;
  createdAtLabel: string;
  noteText: string;
  linkedContextLabel: string;
};

export type ObjectiveSessionTimelineNotesSummary = {
  interpretationTimeline: ObjectiveTimelineEvent[];
  qualityTimeline: ObjectiveQualityTimelineItem[];
  sessionSummaryMetrics: ObjectiveSessionSummaryMetric[];
  clinicianNotes: ObjectiveClinicianNoteItem[];
  automatedOutputSeparationNote: string;
  clinicianNotesScopeNote: string;
};

export function createObjectiveDemoSessionTimelineNotesSummary(): ObjectiveSessionTimelineNotesSummary {
  return {
    interpretationTimeline: [
      {
        id: "timeline-1",
        kind: "segment",
        timeLabel: "00:00-02:00",
        title: "Baseline review window",
        summary:
          "Initial source-bound window used as preliminary baseline context for later comparison.",
        sourceContext:
          "Automated timeline item from session and feature-window context.",
      },
      {
        id: "timeline-2",
        kind: "interpretation",
        timeLabel: "02:00-04:00",
        title: "Elevated arousal evidence period",
        summary:
          "Baseline-relative physiological arousal evidence is present with moderate confidence in this demo shell.",
        sourceContext: "Automated interpretation timeline item.",
      },
      {
        id: "timeline-3",
        kind: "suppression",
        timeLabel: "04:00-05:00",
        title: "Motion-confounded window",
        summary:
          "This period is limited by motion context and should be treated as lower-readiness evidence.",
        sourceContext: "Automated suppression/readiness timeline item.",
      },
      {
        id: "timeline-4",
        kind: "cooldown",
        timeLabel: "05:00-07:00",
        title: "Cooldown period",
        summary:
          "Source-bound physiological trend returns closer to baseline-relative context in this demo shell.",
        sourceContext: "Automated interpretation timeline item.",
      },
    ],
    qualityTimeline: [
      {
        id: "quality-1",
        timeLabel: "00:00-02:00",
        modality: "ECG",
        qualityLabel: "usable",
        detail: "ECG preview quality is usable for chart review.",
      },
      {
        id: "quality-2",
        timeLabel: "02:00-04:00",
        modality: "GSR",
        qualityLabel: "usable",
        detail: "GSR trend is available for slow source-bound context.",
      },
      {
        id: "quality-3",
        timeLabel: "04:00-05:00",
        modality: "Motion",
        qualityLabel: "limited",
        detail: "Movement context limits confidence in this short window.",
      },
      {
        id: "quality-4",
        timeLabel: "05:00-07:00",
        modality: "PPG",
        qualityLabel: "limited",
        detail: "PPG is available as secondary optical waveform context only.",
      },
    ],
    sessionSummaryMetrics: [
      {
        label: "Interpretable fraction",
        value: "72%",
        detail:
          "Share of demo windows with enough technical quality for clinician review.",
      },
      {
        label: "Suppressed windows",
        value: "18%",
        detail:
          "Windows suppressed because of quality, baseline, motion, or missingness limits.",
      },
      {
        label: "Signal quality distribution",
        value: "Usable / limited mix",
        detail:
          "Quality state is summarized as technical readiness, not clinical status.",
      },
      {
        label: "Modality availability",
        value: "ECG, GSR, PPG, motion, local temperature",
        detail:
          "Available modalities are summarized for source-bound interpretation context.",
      },
      {
        label: "Elevated arousal evidence periods",
        value: "1 period",
        detail:
          "Count of baseline-relative elevated physiological arousal evidence periods in the demo shell.",
      },
      {
        label: "Cooldown periods",
        value: "1 period",
        detail: "Count of source-bound cooldown periods in the demo shell.",
      },
      {
        label: "Motion-confounded fraction",
        value: "12%",
        detail:
          "Share of windows where motion context reduces interpretation readiness.",
      },
    ],
    clinicianNotes: [
      {
        id: "note-1",
        authorLabel: "Clinician note placeholder",
        createdAtLabel: "Not persisted",
        noteText:
          "Clinician-authored notes are separate from automated objective outputs. Note persistence is added in a later history/notes stage.",
        linkedContextLabel: "Unlinked placeholder",
      },
    ],
    automatedOutputSeparationNote:
      "Automated objective records and clinician-authored notes are intentionally separated. Notes do not rewrite model, feature, quality, or interpretation records.",
    clinicianNotesScopeNote:
      "This panel is a static clinician-only placeholder. It does not save notes or send data to an API in this commit.",
  };
}
