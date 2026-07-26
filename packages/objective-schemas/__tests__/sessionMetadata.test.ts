// packages/objective-schemas/__tests__/sessionMetadata.test.ts

import {
  OBJECTIVE_METADATA_SCHEMA_VERSION,
  OBJECTIVE_SEGMENT_REASONS,
  OBJECTIVE_SESSION_STATUSES,
  assertObjectiveSessionMetadata,
  validateObjectiveDeviceBootMetadata,
  validateObjectiveSessionMetadata,
  validateObjectiveSessionSegmentMetadata,
  validateObjectiveSimulatorRunMetadata,
  validateObjectiveSourceMetadata,
} from "../src/index.js";

const visibility = {
  clinician_visible: true,
  patient_visible: false,
  chatbot_visible: false,
};

describe("objective session and source metadata schemas", () => {
  it("defines bounded non-clinical session statuses and segment reasons", () => {
    expect(OBJECTIVE_SESSION_STATUSES).toEqual([
      "created",
      "active",
      "paused",
      "stopped",
      "aborted",
    ]);

    expect(OBJECTIVE_SEGMENT_REASONS).toEqual([
      "session_start",
      "manual_segment",
      "device_reset",
      "timing_gap",
      "source_change",
    ]);

    expect(OBJECTIVE_SESSION_STATUSES).not.toContain("high_risk");
    expect(OBJECTIVE_SEGMENT_REASONS).not.toContain("withdrawal_detected");
  });

  it("accepts source metadata with clinician-only visibility", () => {
    const result = validateObjectiveSourceMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      source_type: "simulator",
      source_id: "source-1",
      producer_id: "producer-1",
      source_label: "local simulator",
      visibility,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected source metadata to be valid");
    }

    expect(result.data.visibility).toEqual(visibility);
  });

  it("rejects source metadata with unsupported source type", () => {
    const result = validateObjectiveSourceMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      source_type: "clinical_device",
      source_id: "source-1",
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "source_type",
        }),
      ]),
    );
  });

  it("accepts objective device boot metadata", () => {
    const result = validateObjectiveDeviceBootMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      device_id: "device-1",
      device_boot_id: "boot-1",
      source_type: "prototype_hardware",
      boot_started_at: "2026-06-02T10:00:00.000Z",
      boot_started_esp_time_ms: 0,
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("accepts objective session metadata with clinician-only defaults when visibility is omitted", () => {
    const result = validateObjectiveSessionMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      session_id: "session-1",
      patient_id: "patient-1",
      source_type: "simulator",
      status: "created",
      device_id: "device-1",
      device_boot_id: "boot-1",
      created_at: "2026-06-02T10:00:00.000Z",
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected session metadata to be valid");
    }

    expect(result.data.visibility).toEqual(visibility);
  });

  it("rejects objective session metadata if patient visibility is true", () => {
    const result = validateObjectiveSessionMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      session_id: "session-1",
      patient_id: "patient-1",
      source_type: "simulator",
      status: "created",
      created_at: "2026-06-02T10:00:00.000Z",
      visibility: {
        clinician_visible: true,
        patient_visible: true,
        chatbot_visible: false,
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

  it("rejects objective session metadata if chatbot visibility is true", () => {
    const result = validateObjectiveSessionMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      session_id: "session-1",
      patient_id: "patient-1",
      source_type: "simulator",
      status: "created",
      created_at: "2026-06-02T10:00:00.000Z",
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

  it("rejects forbidden clinical fields in session metadata", () => {
    const result = validateObjectiveSessionMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      session_id: "session-1",
      patient_id: "patient-1",
      source_type: "simulator",
      status: "active",
      created_at: "2026-06-02T10:00:00.000Z",
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

  it("accepts objective session segment metadata", () => {
    const result = validateObjectiveSessionSegmentMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      segment_id: "segment-1",
      session_id: "session-1",
      device_boot_id: "boot-1",
      source_type: "simulator",
      reason: "session_start",
      start_esp_time_ms: 0,
      end_esp_time_ms: 1000,
      start_pc_timestamp: "2026-06-02T10:00:00.000Z",
      end_pc_timestamp: "2026-06-02T10:00:01.000Z",
      visibility,
    });

    expect(result.success).toBe(true);
  });

  it("rejects session segments whose end ESP time is before start ESP time", () => {
    const result = validateObjectiveSessionSegmentMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      segment_id: "segment-1",
      session_id: "session-1",
      device_boot_id: "boot-1",
      source_type: "simulator",
      reason: "timing_gap",
      start_esp_time_ms: 1000,
      end_esp_time_ms: 999,
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "end_esp_time_ms",
        }),
      ]),
    );
  });

  it("accepts simulator run metadata while keeping developer labels hidden", () => {
    const result = validateObjectiveSimulatorRunMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      simulator_run_id: "sim-run-1",
      session_id: "session-1",
      source_type: "simulator",
      scenario_id: "baseline_rest",
      seed: 1234,
      started_at: "2026-06-02T10:00:00.000Z",
      developer_labels_visible: false,
      visibility,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected simulator run metadata to be valid");
    }

    expect(result.data.developer_labels_visible).toBe(false);
    expect(result.data.visibility).toEqual(visibility);
  });

  it("rejects simulator run metadata that exposes developer labels", () => {
    const result = validateObjectiveSimulatorRunMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      simulator_run_id: "sim-run-1",
      session_id: "session-1",
      source_type: "simulator",
      scenario_id: "baseline_rest",
      seed: 1234,
      started_at: "2026-06-02T10:00:00.000Z",
      developer_labels_visible: true,
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "developer_labels_visible",
        }),
      ]),
    );
  });

  it("rejects simulator run metadata with a non-simulator source type", () => {
    const result = validateObjectiveSimulatorRunMetadata({
      schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
      simulator_run_id: "sim-run-1",
      session_id: "session-1",
      source_type: "prototype_hardware",
      scenario_id: "baseline_rest",
      seed: 1234,
      started_at: "2026-06-02T10:00:00.000Z",
      developer_labels_visible: false,
      visibility,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "source_type",
        }),
      ]),
    );
  });

  it("assert helper throws on invalid session metadata", () => {
    expect(() =>
      assertObjectiveSessionMetadata({
        schema_version: OBJECTIVE_METADATA_SCHEMA_VERSION,
        session_id: "session-1",
        patient_id: "patient-1",
        source_type: "simulator",
        status: "relapse_risk",
        created_at: "2026-06-02T10:00:00.000Z",
        visibility,
      }),
    ).toThrow("Invalid objective session metadata");
  });
});
