import {
  assertObjectiveRawBatch,
  assertObjectiveRawFrameEnvelope
} from "@dad-chatbot/objective-schemas";
import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  createObjectiveSimulatorScenarioBatches,
  objectiveRawBatchesToCsv,
  objectiveRawCsvToBatches,
  objectiveRawCsvToFrameEnvelopes
} from "../src/index.js";

describe("objective simulator CSV export and replay", () => {
  it("exports generated simulator batches to CSV with raw sensor columns", () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "baseline_rest",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 5,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const csv = objectiveRawBatchesToCsv(batches);
    const [header] = csv.trim().split(/\r?\n/);

    expect(header).toBe(
      "pc_timestamp,esp_time_ms,ecg_raw,gsr_raw,max_red,max_ir,max_green,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mpu_temp_c,tmp117_temp_c"
    );
    expect(csv).toContain("2026-");
    expect(csv).not.toContain("scenario_id");
    expect(csv).not.toContain("phase_type");
    expect(csv).not.toContain("developer_labels_visible");
  });

  it("replays exported CSV into schema-valid frame envelopes", () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "elevated_arousal_pattern",
      seed: 42,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 5,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const csv = objectiveRawBatchesToCsv(batches);
    const frames = objectiveRawCsvToFrameEnvelopes(csv, {
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1"
    });

    expect(frames.length).toBeGreaterThan(0);

    for (const frame of frames) {
      expect(() => assertObjectiveRawFrameEnvelope(frame)).not.toThrow();
      expect(frame.source_type).toBe("simulator");
      expect(frame.frame.pc_timestamp).toBeTruthy();
      expect(Number.isFinite(frame.frame.esp_time_ms)).toBe(true);
    }
  });

  it("replays CSV into schema-valid raw batches", () => {
    const csv = [
      "pc_timestamp,esp_time_ms,ecg_raw,gsr_raw,max_red,max_ir,max_green,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,mpu_temp_c,tmp117_temp_c",
      "2026-05-30T13:56:10.124Z,15040,2900,2405,213,261,44,-8.798691,-3.97337,-1.577779,-0.032242,0.024248,0.00794,28.106,25.571",
      "2026-05-30T13:56:10.224Z,15140,2800,2410,214,262,45,-8.7,-3.8,-1.5,-0.03,0.02,0.007,28.107,25.572"
    ].join("\n");

    const batches = objectiveRawCsvToBatches(csv, {
      batch_id_prefix: "csv-replay",
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_size_frames: 1
    });

    expect(batches).toHaveLength(2);

    for (const batch of batches) {
      expect(() => assertObjectiveRawBatch(batch)).not.toThrow();
      expect(batch.source_type).toBe("simulator");
      expect(batch.frames).toHaveLength(1);
    }
  });

  it("allows public-dataset-like CSV files with extra columns while keeping simulator source type", () => {
    const csv = [
      "participant_id,label,pc_timestamp,esp_time_ms,ecg_raw,gsr_raw",
      "p01,ignored,2026-05-30T13:56:10.124Z,15040,2900,2405",
      "p01,ignored,2026-05-30T13:56:10.224Z,15140,2800,2410"
    ].join("\n");

    const batches = objectiveRawCsvToBatches(csv, {
      batch_id_prefix: "csv-replay",
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_size_frames: 10
    });

    expect(batches).toHaveLength(1);
    expect(batches[0].source_type).toBe("simulator");
    expect(batches[0].frames[0].frame.ecg_raw).toBe(2900);
    expect(JSON.stringify(batches)).not.toContain("participant_id");
    expect(JSON.stringify(batches)).not.toContain("label");
  });

  it("does not emit forbidden labels or clinical claims in CSV helpers", () => {
    const batches = createObjectiveSimulatorScenarioBatches({
      scenario_id: "signal_conflict",
      seed: 77,
      duration_ms: 1000,
      sample_interval_ms: 100,
      batch_size_frames: 10,
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_id_prefix: "batch"
    });

    const csv = objectiveRawBatchesToCsv(batches);
    const replayed = objectiveRawCsvToBatches(csv, {
      batch_id_prefix: "csv-replay",
      session_id: "session-1",
      device_id: "device-1",
      device_boot_id: "boot-1",
      batch_size_frames: 10
    });

    const serialized = JSON.stringify({ csv, replayed });

    for (const forbidden of [
      ...FORBIDDEN_OBJECTIVE_LABELS,
      ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
      ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(serialized).not.toContain("heart_rate");
    expect(serialized).not.toContain("spo2");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("risk_score");

    const violations = findForbiddenObjectiveTermViolations([
      {
        path: "packages/objective-simulator/src/csv.ts",
        surface: "source",
        content: serialized
      }
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects CSV without timing columns", () => {
    expect(() =>
      objectiveRawCsvToBatches("ecg_raw,gsr_raw\n2900,2405", {
        batch_id_prefix: "csv-replay",
        session_id: "session-1",
        device_id: "device-1",
        device_boot_id: "boot-1",
        batch_size_frames: 10
      })
    ).toThrow("CSV header must include pc_timestamp and esp_time_ms");
  });
});
