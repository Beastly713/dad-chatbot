// packages/objective-schemas/__tests__/derivedRecords.test.ts

import {
  OBJECTIVE_AUDIT_EVENT_TYPES,
  OBJECTIVE_DASHBOARD_EVENT_TYPES,
  OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
  OBJECTIVE_FEATURE_WINDOW_STATUSES,
  OBJECTIVE_SUPPRESSION_STATES,
  assertObjectiveInterpretationRecord,
  validateObjectiveAuditEventRecord,
  validateObjectiveDashboardStreamEvent,
  validateObjectiveFeatureWindowRecord,
  validateObjectiveInterpretationRecord,
  validateObjectiveMlInferenceRecord,
  validateObjectiveSessionSummaryRecord,
} from "../src/index.js";

const visibility = {
  clinician_visible: true,
  patient_visible: false,
  chatbot_visible: false,
};

const validFeatureWindow = {
  schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
  feature_window_id: "feature-window-1",
  session_id: "session-1",
  segment_id: "segment-1",
  source_type: "simulator",
  start_esp_time_ms: 1000,
  end_esp_time_ms: 60000,
  raw_range_refs: ["raw-chunk-1"],
  preprocessing_version: "preprocessing-v1",
  feature_schema_version: "features-v1",
  status: "ready",
  suppression_state: "not_suppressed",
  quality: {
    ecg_quality: 0.95,
    gsr_quality: 0.88,
    ppg_quality: 0.7,
    motion_quality: 0.9,
    temperature_quality: 0.75,
    timing_quality: 1,
  },
  missingness: {
    ecg: 0,
    gsr: 0,
    ppg: 0.1,
  },
  modality_availability: {
    ecg: true,
    gsr: true,
    ppg: true,
    imu: true,
    temperature: true,
  },
  features: {
    mean_hr: 82,
    rmssd: 42,
    gsr_tonic_trend: 0.12,
    motion_magnitude: 0.2,
    tmp117_temp_trend: "stable",
    ecg_ppg_agreement: true,
  },
  visibility,
};

describe("objective derived record schemas", () => {
  it("defines bounded feature statuses, suppression states, dashboard events, and audit events", () => {
    expect(OBJECTIVE_FEATURE_WINDOW_STATUSES).toEqual([
      "ready",
      "suppressed",
      "insufficient_data",
    ]);

    expect(OBJECTIVE_SUPPRESSION_STATES).toEqual([
      "not_suppressed",
      "suppressed_low_quality",
      "suppressed_missing_baseline",
      "suppressed_motion_confound",
      "suppressed_signal_conflict",
      "suppressed_missing_data",
    ]);

    expect(OBJECTIVE_DASHBOARD_EVENT_TYPES).toEqual([
      "heartbeat",
      "session.status",
      "session.segment",
      "chart.samples",
      "quality.update",
      "feature.window",
      "ml.inference",
      "interpretation.record",
      "interpretation.suppressed",
      "session.summary.partial",
      "error",
    ]);

    expect(OBJECTIVE_AUDIT_EVENT_TYPES).toEqual([
      "session_created",
      "session_started",
      "session_paused",
      "session_resumed",
      "session_stopped",
      "ingest_accepted",
      "ingest_rejected",
      "stream_token_issued",
      "stream_denied",
      "access_denied",
      "forbidden_label_blocked",
      "serializer_blocked",
      "interpretation_created",
      "interpretation_suppressed",
    ]);

    expect(OBJECTIVE_DASHBOARD_EVENT_TYPES).not.toContain("emergency.alert");
    expect(OBJECTIVE_AUDIT_EVENT_TYPES).not.toContain("relapse_risk_created");
  });

  it("accepts a clinician-only feature window record", () => {
    const result = validateObjectiveFeatureWindowRecord(validFeatureWindow);

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected feature window to be valid");
    }

    expect(result.data.visibility).toEqual(visibility);
    expect(result.data.features.mean_hr).toBe(82);
  });

  it("rejects feature windows with patient or chatbot visibility", () => {
    const result = validateObjectiveFeatureWindowRecord({
      ...validFeatureWindow,
      visibility: {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: true,
      },
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "visibility",
        }),
      ]),
    );
  });

  it("rejects forbidden clinical fields in feature objects", () => {
    const result = validateObjectiveFeatureWindowRecord({
      ...validFeatureWindow,
      features: {
        ...validFeatureWindow.features,
        relapse_risk: "high",
      },
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "features.relapse_risk",
        }),
      ]),
    );
  });

  it("accepts ML inference only for the allowed Phase 3 target and classes", () => {
    const result = validateObjectiveMlInferenceRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      ml_inference_id: "ml-1",
      feature_window_id: "feature-window-1",
      session_id: "session-1",
      model_id: "model-1",
      model_version: "model-v1",
      target: "baseline_relative_elevated_physiological_arousal_evidence",
      predicted_class: "elevated_arousal_evidence",
      confidence_label: "moderate_confidence",
      probability: 0.72,
      uncertainty_reasons: ["baseline still limited"],
      suppression_state: "not_suppressed",
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("rejects forbidden ML targets and unsupported classes", () => {
    const result = validateObjectiveMlInferenceRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      ml_inference_id: "ml-1",
      feature_window_id: "feature-window-1",
      session_id: "session-1",
      model_id: "model-1",
      model_version: "model-v1",
      target: "relapse_risk",
      predicted_class: "craving_detected",
      confidence_label: "high_confidence",
      probability: 0.9,
      uncertainty_reasons: [],
      suppression_state: "not_suppressed",
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "target",
        }),
        expect.objectContaining({
          path: "predicted_class",
        }),
      ]),
    );
  });

  it("rejects ML probabilities outside 0 to 1", () => {
    const result = validateObjectiveMlInferenceRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      ml_inference_id: "ml-1",
      feature_window_id: "feature-window-1",
      session_id: "session-1",
      model_id: "model-1",
      model_version: "model-v1",
      target: "baseline_relative_elevated_physiological_arousal_evidence",
      predicted_class: "elevated_arousal_evidence",
      confidence_label: "moderate_confidence",
      probability: 1.2,
      uncertainty_reasons: [],
      suppression_state: "not_suppressed",
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "probability",
        }),
      ]),
    );
  });

  it("accepts clinician-safe interpretation labels", () => {
    const result = validateObjectiveInterpretationRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      interpretation_id: "interpretation-1",
      session_id: "session-1",
      feature_window_id: "feature-window-1",
      ml_inference_id: "ml-1",
      label: "elevated_physiological_arousal_evidence",
      evidence_level: "elevated",
      confidence_label: "moderate_confidence",
      summary:
        "Elevated physiological arousal evidence relative to available baseline.",
      uncertainty_reasons: ["motion was low", "baseline window limited"],
      contributing_modalities: ["ecg", "gsr"],
      excluded_modalities: ["ppg"],
      suppression_state: "not_suppressed",
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("rejects forbidden interpretation labels", () => {
    const result = validateObjectiveInterpretationRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      interpretation_id: "interpretation-1",
      session_id: "session-1",
      label: "withdrawal_risk",
      evidence_level: "elevated",
      confidence_label: "moderate_confidence",
      summary: "Unsafe label should not be accepted.",
      uncertainty_reasons: [],
      contributing_modalities: ["ecg"],
      excluded_modalities: [],
      suppression_state: "not_suppressed",
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "label",
        }),
      ]),
    );
  });

  it("assert helper throws on invalid interpretation labels", () => {
    expect(() =>
      assertObjectiveInterpretationRecord({
        schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
        interpretation_id: "interpretation-1",
        session_id: "session-1",
        label: "craving_detected",
        evidence_level: "elevated",
        confidence_label: "moderate_confidence",
        summary: "Unsafe label should not be accepted.",
        uncertainty_reasons: [],
        contributing_modalities: ["ecg"],
        excluded_modalities: [],
        suppression_state: "not_suppressed",
        visibility,
      }),
    ).toThrow("Invalid objective interpretation record");
  });

  it("accepts clinician-safe dashboard stream events", () => {
    const result = validateObjectiveDashboardStreamEvent({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      event_id: "event-1",
      event_type: "interpretation.record",
      session_id: "session-1",
      emitted_at: "2026-06-02T10:00:00.000Z",
      payload: {
        interpretation_id: "interpretation-1",
        label: "elevated_physiological_arousal_evidence",
      },
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("rejects forbidden clinical fields in dashboard event payloads", () => {
    const result = validateObjectiveDashboardStreamEvent({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      event_id: "event-1",
      event_type: "interpretation.record",
      session_id: "session-1",
      emitted_at: "2026-06-02T10:00:00.000Z",
      payload: {
        relapse_risk: "high",
      },
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "payload.relapse_risk",
        }),
      ]),
    );
  });

  it("accepts safe session summary records without clinical risk fields", () => {
    const result = validateObjectiveSessionSummaryRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      session_summary_id: "summary-1",
      session_id: "session-1",
      total_windows: 100,
      interpretable_fraction: 0.82,
      suppressed_fraction: 0.18,
      modality_availability: {
        ecg: 0.9,
        gsr: 0.95,
      },
      quality_distribution: {
        good: 0.7,
        limited: 0.3,
      },
      evidence_period_count: 3,
      cooldown_period_count: 2,
      motion_confounded_fraction: 0.15,
      preprocessing_version: "preprocessing-v1",
      model_version: "model-v1",
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("rejects forbidden clinical fields in session summaries", () => {
    const result = validateObjectiveSessionSummaryRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      session_summary_id: "summary-1",
      session_id: "session-1",
      total_windows: 100,
      interpretable_fraction: 0.82,
      suppressed_fraction: 0.18,
      modality_availability: {
        ecg: 0.9,
      },
      quality_distribution: {
        good: 0.7,
      },
      evidence_period_count: 3,
      cooldown_period_count: 2,
      motion_confounded_fraction: 0.15,
      relapse_risk: "high",
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "relapse_risk",
        }),
      ]),
    );
  });

  it("accepts audit events without raw physiological values or unsafe clinical metadata", () => {
    const result = validateObjectiveAuditEventRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      audit_event_id: "audit-1",
      event_type: "ingest_accepted",
      actor_id: "service-1",
      actor_role: "service",
      session_id: "session-1",
      patient_id: "patient-1",
      occurred_at: "2026-06-02T10:00:00.000Z",
      metadata: {
        batch_id: "batch-1",
        frame_count: 50,
        accepted: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects forbidden clinical metadata inside audit events", () => {
    const result = validateObjectiveAuditEventRecord({
      schema_version: OBJECTIVE_DERIVED_RECORD_SCHEMA_VERSION,
      audit_event_id: "audit-1",
      event_type: "ingest_accepted",
      actor_role: "service",
      occurred_at: "2026-06-02T10:00:00.000Z",
      metadata: {
        CIWA_score: 12,
      },
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "metadata.CIWA_score",
        }),
      ]),
    );
  });
});
