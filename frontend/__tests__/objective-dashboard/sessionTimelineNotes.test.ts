import { createObjectiveDemoSessionTimelineNotesSummary } from "../../app/(clinician)/clinician/objective/_lib/sessionTimelineNotes";

function expectSafeCopy(value: string): void {
  const lower = value.toLowerCase();

  for (const forbidden of [
    "risk score",
    "emergency",
    "alert",
    "diagnosis",
    "diagnose",
    "relapse risk",
    "withdrawal concern",
    "withdrawal risk",
    "intoxication",
    "craving summary",
    "craving detected",
    "ciwa",
    "sobriety",
    "patient is safe",
    "patient is stable",
    "patient is lying",
    "treatment need",
    "treatment-need",
    "detox need",
    "medication need",
    "clinical alert",
    "clinical warning",
  ]) {
    expect(lower).not.toContain(forbidden);
  }
}

describe("objective session timeline, summary, and notes helpers", () => {
  it("creates interpretation and quality timelines", () => {
    const summary = createObjectiveDemoSessionTimelineNotesSummary();

    expect(summary.interpretationTimeline.length).toBeGreaterThan(0);
    expect(summary.qualityTimeline.length).toBeGreaterThan(0);

    expect(summary.interpretationTimeline.map((item) => item.kind)).toEqual([
      "segment",
      "interpretation",
      "suppression",
      "cooldown",
    ]);

    expect(summary.qualityTimeline.map((item) => item.modality)).toEqual([
      "ECG",
      "GSR",
      "Motion",
      "PPG",
    ]);
  });

  it("creates only safe session summary metrics", () => {
    const summary = createObjectiveDemoSessionTimelineNotesSummary();

    expect(summary.sessionSummaryMetrics.map((metric) => metric.label)).toEqual([
      "Interpretable fraction",
      "Suppressed windows",
      "Signal quality distribution",
      "Modality availability",
      "Elevated arousal evidence periods",
      "Cooldown periods",
      "Motion-confounded fraction",
    ]);

    for (const metric of summary.sessionSummaryMetrics) {
      expect(metric.value.length).toBeGreaterThan(0);
      expect(metric.detail.length).toBeGreaterThan(0);

      expectSafeCopy(metric.label);
      expectSafeCopy(metric.value);
      expectSafeCopy(metric.detail);
    }
  });

  it("keeps timeline copy bounded and non-diagnostic", () => {
    const summary = createObjectiveDemoSessionTimelineNotesSummary();

    for (const item of summary.interpretationTimeline) {
      expect(item.timeLabel.length).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.summary.length).toBeGreaterThan(0);
      expect(item.sourceContext.length).toBeGreaterThan(0);

      expectSafeCopy(item.title);
      expectSafeCopy(item.summary);
      expectSafeCopy(item.sourceContext);
    }

    for (const item of summary.qualityTimeline) {
      expect(item.timeLabel.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);

      expectSafeCopy(item.modality);
      expectSafeCopy(item.qualityLabel);
      expectSafeCopy(item.detail);
    }
  });

  it("separates clinician notes from automated output", () => {
    const summary = createObjectiveDemoSessionTimelineNotesSummary();

    expect(summary.clinicianNotes.length).toBeGreaterThan(0);
    expect(summary.automatedOutputSeparationNote.toLowerCase()).toContain(
      "separated",
    );
    expect(summary.automatedOutputSeparationNote.toLowerCase()).toContain(
      "do not rewrite",
    );
    expect(summary.clinicianNotesScopeNote.toLowerCase()).toContain(
      "does not save notes",
    );
    expect(summary.clinicianNotesScopeNote.toLowerCase()).toContain("api");

    for (const note of summary.clinicianNotes) {
      expect(note.authorLabel.length).toBeGreaterThan(0);
      expect(note.noteText.length).toBeGreaterThan(0);
      expect(note.linkedContextLabel.length).toBeGreaterThan(0);

      expectSafeCopy(note.authorLabel);
      expectSafeCopy(note.createdAtLabel);
      expectSafeCopy(note.noteText);
      expectSafeCopy(note.linkedContextLabel);
    }
  });

  it("includes elevated arousal and cooldown summaries without forbidden clinical summaries", () => {
    const summary = createObjectiveDemoSessionTimelineNotesSummary();
    const combined = JSON.stringify(summary).toLowerCase();

    expect(combined).toContain("elevated arousal evidence");
    expect(combined).toContain("cooldown");
    expect(combined).toContain("motion-confounded");
    expectSafeCopy(combined);
  });
});
