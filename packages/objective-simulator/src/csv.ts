import {
  OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
  RAW_SENSOR_FIELD_NAMES,
  assertObjectiveRawBatch,
  assertObjectiveRawFrameEnvelope,
  type ObjectiveRawBatch,
  type ObjectiveRawFrameEnvelope,
  type ObjectiveRawSensorFrame,
  type RawSensorFieldName
} from "@dad-chatbot/objective-schemas";

export const OBJECTIVE_SIMULATOR_CSV_COLUMNS = [...RAW_SENSOR_FIELD_NAMES] as const;

export type ObjectiveCsvExportOptions = {
  include_header?: boolean;
};

export type ObjectiveCsvReplayOptions = {
  batch_id_prefix: string;
  session_id: string;
  device_id: string;
  device_boot_id: string;
  segment_id?: string;
  batch_size_frames: number;
};

type ParsedCsvTable = {
  header: string[];
  rows: string[][];
};

function assertNonEmptyString(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function escapeCsvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);

  if (insideQuotes) {
    throw new Error("CSV row has an unterminated quoted value");
  }

  return cells;
}

function parseCsvTable(csvText: string): ParsedCsvTable {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV text is empty");
  }

  const header = parseCsvLine(lines[0]).map((cell) => cell.trim());

  if (!header.includes("pc_timestamp") || !header.includes("esp_time_ms")) {
    throw new Error("CSV header must include pc_timestamp and esp_time_ms");
  }

  const rows = lines.slice(1).map(parseCsvLine);

  return { header, rows };
}

function parseOptionalNumber(
  value: string,
  fieldName: RawSensorFieldName
): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV field ${fieldName} must be numeric when present`);
  }

  return parsed;
}

function parseRawFrameFromCsvRow(
  header: string[],
  row: string[]
): ObjectiveRawSensorFrame {
  const frame: Partial<ObjectiveRawSensorFrame> = {};

  for (const fieldName of OBJECTIVE_SIMULATOR_CSV_COLUMNS) {
    const columnIndex = header.indexOf(fieldName);

    if (columnIndex < 0) {
      continue;
    }

    const rawValue = row[columnIndex] ?? "";

    if (rawValue.trim().length === 0) {
      continue;
    }

    if (fieldName === "pc_timestamp") {
      frame.pc_timestamp = rawValue;
      continue;
    }

    if (fieldName === "esp_time_ms") {
      frame.esp_time_ms = parseOptionalNumber(rawValue, fieldName);
      continue;
    }

    frame[fieldName] = parseOptionalNumber(rawValue, fieldName) as never;
  }

  if (!frame.pc_timestamp) {
    throw new Error("CSV row is missing pc_timestamp");
  }

  if (frame.esp_time_ms === undefined) {
    throw new Error("CSV row is missing esp_time_ms");
  }

  return frame as ObjectiveRawSensorFrame;
}

function presentUpdatedFields(frame: ObjectiveRawSensorFrame): RawSensorFieldName[] {
  return RAW_SENSOR_FIELD_NAMES.filter(
    (fieldName) => frame[fieldName] !== undefined
  );
}

function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function objectiveRawFrameEnvelopesToCsv(
  frames: readonly ObjectiveRawFrameEnvelope[],
  options: ObjectiveCsvExportOptions = {}
): string {
  const includeHeader = options.include_header ?? true;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(OBJECTIVE_SIMULATOR_CSV_COLUMNS.join(","));
  }

  for (const envelope of frames) {
    lines.push(
      OBJECTIVE_SIMULATOR_CSV_COLUMNS.map((fieldName) =>
        escapeCsvCell(envelope.frame[fieldName])
      ).join(",")
    );
  }

  return `${lines.join("\n")}\n`;
}

export function objectiveRawBatchesToCsv(
  batches: readonly ObjectiveRawBatch[],
  options: ObjectiveCsvExportOptions = {}
): string {
  return objectiveRawFrameEnvelopesToCsv(
    batches.flatMap((batch) => batch.frames),
    options
  );
}

export function objectiveRawCsvToFrameEnvelopes(
  csvText: string,
  options: Omit<ObjectiveCsvReplayOptions, "batch_id_prefix" | "batch_size_frames">
): ObjectiveRawFrameEnvelope[] {
  assertNonEmptyString(options.session_id, "session_id");
  assertNonEmptyString(options.device_id, "device_id");
  assertNonEmptyString(options.device_boot_id, "device_boot_id");

  const table = parseCsvTable(csvText);

  return table.rows.map((row) => {
    const frame = parseRawFrameFromCsvRow(table.header, row);
    const envelope: ObjectiveRawFrameEnvelope = {
      session_id: options.session_id,
      source_type: "simulator",
      schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
      device_id: options.device_id,
      device_boot_id: options.device_boot_id,
      ...(options.segment_id ? { segment_id: options.segment_id } : {}),
      frame,
      updated_fields: presentUpdatedFields(frame),
      held_fields: [],
      stale_fields: []
    };

    return assertObjectiveRawFrameEnvelope(envelope);
  });
}

export function objectiveRawCsvToBatches(
  csvText: string,
  options: ObjectiveCsvReplayOptions
): ObjectiveRawBatch[] {
  assertNonEmptyString(options.batch_id_prefix, "batch_id_prefix");
  assertPositiveInteger(options.batch_size_frames, "batch_size_frames");

  const frames = objectiveRawCsvToFrameEnvelopes(csvText, options);

  return chunkArray(frames, options.batch_size_frames).map((chunk, index) => {
    const batch: ObjectiveRawBatch = {
      batch_id: `${options.batch_id_prefix}-${index + 1}`,
      session_id: options.session_id,
      source_type: "simulator",
      schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
      device_id: options.device_id,
      device_boot_id: options.device_boot_id,
      ...(options.segment_id ? { segment_id: options.segment_id } : {}),
      frames: chunk
    };

    return assertObjectiveRawBatch(batch);
  });
}
