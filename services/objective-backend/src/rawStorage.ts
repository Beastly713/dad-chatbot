export type ObjectiveRawStorageVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectiveRawStorageTiming = {
    frame_count: number;
    first_esp_time_ms?: number;
    last_esp_time_ms?: number;
    duration_ms?: number;
    max_gap_ms?: number;
    gap_count: number;
    duplicate_esp_time_count: number;
    out_of_order_count: number;
    segment_boundary_count: number;
    timing_quality: "good" | "limited" | "invalid";
    warnings: string[];
};

export type ObjectiveRawStorageFrame = {
    pc_timestamp: string;
    esp_time_ms: number;
    [key: string]: string | number | boolean | null | undefined;
};

export type ObjectiveRawStorageAcceptedChunkInput = {
    raw_chunk_id: string;
    batch_id: string;
    session_id: string;
    source_type: "simulator" | "public_dataset_replay" | "prototype_hardware";
    device_id: string;
    device_boot_id: string;
    segment_id?: string;
    chunk_index: number;
    frame_count: number;
    first_esp_time_ms: number;
    last_esp_time_ms: number;
    timing: ObjectiveRawStorageTiming;
    frames: ObjectiveRawStorageFrame[];
} & ObjectiveRawStorageVisibility;

export type ObjectiveRawStorageQuarantineInput = {
    quarantine_id: string;
    batch_id: string;
    session_id: string;
    source_type?: "simulator" | "public_dataset_replay" | "prototype_hardware";
    device_id?: string;
    device_boot_id?: string;
    segment_id?: string;
    frame_index: number;
    esp_time_ms?: number;
    pc_timestamp?: string;
    reject_reason: string;
    reject_details: string[];
    raw_payload_shape: "object" | "array" | "primitive" | "null";
} & ObjectiveRawStorageVisibility;

export type ObjectiveRawStorageIngestionResult = {
    batch_id: string;
    session_id: string;
    accepted_frame_count: number;
    quarantined_frame_count: number;
    timing: ObjectiveRawStorageTiming;
    chunks: ObjectiveRawStorageAcceptedChunkInput[];
    quarantined: ObjectiveRawStorageQuarantineInput[];
} & ObjectiveRawStorageVisibility;

export type ObjectiveStoredRawBatch = {
    raw_batch_id: string;
    batch_id: string;
    session_id: string;
    source_type?: "simulator" | "public_dataset_replay" | "prototype_hardware";
    schema_version: "objective_raw_frame.v1";
    frame_count: number;
    accepted_frame_count: number;
    quarantined_frame_count: number;
    first_esp_time_ms?: number;
    last_esp_time_ms?: number;
    raw_range_metadata: {
        timing_quality: ObjectiveRawStorageTiming["timing_quality"];
        warnings: string[];
        gap_count: number;
        duplicate_esp_time_count: number;
        out_of_order_count: number;
        segment_boundary_count: number;
        max_gap_ms?: number;
    };
    stored_at: string;
} & ObjectiveRawStorageVisibility;

export type ObjectiveStoredRawFrameChunk = {
    raw_chunk_id: string;
    raw_batch_id: string;
    batch_id: string;
    session_id: string;
    segment_id?: string;
    source_type: "simulator" | "public_dataset_replay" | "prototype_hardware";
    schema_version: "objective_raw_frame.v1";
    device_id: string;
    device_boot_id: string;
    chunk_index: number;
    frame_count: number;
    first_esp_time_ms: number;
    last_esp_time_ms: number;
    raw_payload: ObjectiveRawStorageFrame[];
    raw_range_metadata: {
        timing_quality: ObjectiveRawStorageTiming["timing_quality"];
        warnings: string[];
        gap_count: number;
        duplicate_esp_time_count: number;
        out_of_order_count: number;
        segment_boundary_count: number;
        max_gap_ms?: number;
    };
    stored_at: string;
} & ObjectiveRawStorageVisibility;

export type ObjectiveStoredQuarantinedRawFrame = {
    quarantine_id: string;
    raw_batch_id: string;
    batch_id: string;
    session_id: string;
    segment_id?: string;
    source_type?: "simulator" | "public_dataset_replay" | "prototype_hardware";
    device_id?: string;
    device_boot_id?: string;
    frame_index: number;
    esp_time_ms?: number;
    pc_timestamp?: string;
    reject_reason: string;
    reject_details: string[];
    raw_payload_shape: "object" | "array" | "primitive" | "null";
    stored_at: string;
} & ObjectiveRawStorageVisibility;

export type ObjectiveRawChunkTraceability = {
    raw_chunk_id: string;
    raw_batch_id: string;
    batch_id: string;
    session_id: string;
    segment_id?: string;
    source_type: "simulator" | "public_dataset_replay" | "prototype_hardware";
    schema_version: "objective_raw_frame.v1";
    device_id: string;
    device_boot_id: string;
    chunk_index: number;
    frame_count: number;
    first_esp_time_ms: number;
    last_esp_time_ms: number;
    raw_range_metadata: ObjectiveStoredRawFrameChunk["raw_range_metadata"];
    visibility: ObjectiveRawStorageVisibility;
};

export type ObjectiveRawStorageWrite = {
    batch: ObjectiveStoredRawBatch;
    chunks: ObjectiveStoredRawFrameChunk[];
    quarantined: ObjectiveStoredQuarantinedRawFrame[];
};

export type ObjectiveRawStorageRepository = {
    saveIngestionResult(
        result: ObjectiveRawStorageIngestionResult,
    ): Promise<void>;

    getIngestionResults(
        sessionId: string,
    ): Promise<ObjectiveRawStorageIngestionResult[]>;

    getRawBatch(batchId: string): Promise<ObjectiveStoredRawBatch | null>;

    listRawChunksForSession(
        sessionId: string,
    ): Promise<ObjectiveStoredRawFrameChunk[]>;

    listQuarantinedFramesForSession(
        sessionId: string,
    ): Promise<ObjectiveStoredQuarantinedRawFrame[]>;

    listClinicianSafeChunkTraceability(
        sessionId: string,
    ): Promise<ObjectiveRawChunkTraceability[]>;
};

function visibility(): ObjectiveRawStorageVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function timingMetadata(timing: ObjectiveRawStorageTiming): {
    timing_quality: ObjectiveRawStorageTiming["timing_quality"];
    warnings: string[];
    gap_count: number;
    duplicate_esp_time_count: number;
    out_of_order_count: number;
    segment_boundary_count: number;
    max_gap_ms?: number;
} {
    return {
        timing_quality: timing.timing_quality,
        warnings: timing.warnings,
        gap_count: timing.gap_count,
        duplicate_esp_time_count: timing.duplicate_esp_time_count,
        out_of_order_count: timing.out_of_order_count,
        segment_boundary_count: timing.segment_boundary_count,
        max_gap_ms: timing.max_gap_ms,
    };
}

export function buildObjectiveRawStorageWrite(
    result: ObjectiveRawStorageIngestionResult,
    now: () => Date = () => new Date(),
): ObjectiveRawStorageWrite {
    const storedAt = now().toISOString();
    const rawBatchId = `raw-batch:${result.batch_id}`;

    const batch: ObjectiveStoredRawBatch = {
        raw_batch_id: rawBatchId,
        batch_id: result.batch_id,
        session_id: result.session_id,
        source_type: result.chunks[0]?.source_type ?? result.quarantined[0]?.source_type,
        schema_version: "objective_raw_frame.v1",
        frame_count: result.accepted_frame_count + result.quarantined_frame_count,
        accepted_frame_count: result.accepted_frame_count,
        quarantined_frame_count: result.quarantined_frame_count,
        first_esp_time_ms: result.timing.first_esp_time_ms,
        last_esp_time_ms: result.timing.last_esp_time_ms,
        raw_range_metadata: timingMetadata(result.timing),
        stored_at: storedAt,
        ...visibility(),
    };

    const chunks: ObjectiveStoredRawFrameChunk[] = result.chunks.map((chunk) => ({
        raw_chunk_id: chunk.raw_chunk_id,
        raw_batch_id: rawBatchId,
        batch_id: chunk.batch_id,
        session_id: chunk.session_id,
        segment_id: chunk.segment_id,
        source_type: chunk.source_type,
        schema_version: "objective_raw_frame.v1",
        device_id: chunk.device_id,
        device_boot_id: chunk.device_boot_id,
        chunk_index: chunk.chunk_index,
        frame_count: chunk.frame_count,
        first_esp_time_ms: chunk.first_esp_time_ms,
        last_esp_time_ms: chunk.last_esp_time_ms,
        raw_payload: chunk.frames,
        raw_range_metadata: timingMetadata(chunk.timing),
        stored_at: storedAt,
        ...visibility(),
    }));

    const quarantined: ObjectiveStoredQuarantinedRawFrame[] =
        result.quarantined.map((frame) => ({
            quarantine_id: frame.quarantine_id,
            raw_batch_id: rawBatchId,
            batch_id: frame.batch_id,
            session_id: frame.session_id,
            segment_id: frame.segment_id,
            source_type: frame.source_type,
            device_id: frame.device_id,
            device_boot_id: frame.device_boot_id,
            frame_index: frame.frame_index,
            esp_time_ms: frame.esp_time_ms,
            pc_timestamp: frame.pc_timestamp,
            reject_reason: frame.reject_reason,
            reject_details: frame.reject_details,
            raw_payload_shape: frame.raw_payload_shape,
            stored_at: storedAt,
            ...visibility(),
        }));

    return {
        batch,
        chunks,
        quarantined,
    };
}

export function toClinicianSafeChunkTraceability(
    chunk: ObjectiveStoredRawFrameChunk,
): ObjectiveRawChunkTraceability {
    return {
        raw_chunk_id: chunk.raw_chunk_id,
        raw_batch_id: chunk.raw_batch_id,
        batch_id: chunk.batch_id,
        session_id: chunk.session_id,
        segment_id: chunk.segment_id,
        source_type: chunk.source_type,
        schema_version: chunk.schema_version,
        device_id: chunk.device_id,
        device_boot_id: chunk.device_boot_id,
        chunk_index: chunk.chunk_index,
        frame_count: chunk.frame_count,
        first_esp_time_ms: chunk.first_esp_time_ms,
        last_esp_time_ms: chunk.last_esp_time_ms,
        raw_range_metadata: chunk.raw_range_metadata,
        visibility: visibility(),
    };
}

export class InMemoryObjectiveRawStorageRepository
    implements ObjectiveRawStorageRepository
{
    private readonly ingestionResults: ObjectiveRawStorageIngestionResult[] = [];
    private readonly batches = new Map<string, ObjectiveStoredRawBatch>();
    private readonly chunks: ObjectiveStoredRawFrameChunk[] = [];
    private readonly quarantined: ObjectiveStoredQuarantinedRawFrame[] = [];

    constructor(private readonly now: () => Date = () => new Date()) {}

    async saveIngestionResult(
        result: ObjectiveRawStorageIngestionResult,
    ): Promise<void> {
        const write = buildObjectiveRawStorageWrite(result, this.now);

        this.ingestionResults.push(result);
        this.batches.set(result.batch_id, write.batch);
        this.chunks.push(...write.chunks);
        this.quarantined.push(...write.quarantined);
    }

    async getIngestionResults(
        sessionId: string,
    ): Promise<ObjectiveRawStorageIngestionResult[]> {
        return this.ingestionResults.filter(
            (result) => result.session_id === sessionId,
        );
    }

    async getRawBatch(batchId: string): Promise<ObjectiveStoredRawBatch | null> {
        return this.batches.get(batchId) ?? null;
    }

    async listRawChunksForSession(
        sessionId: string,
    ): Promise<ObjectiveStoredRawFrameChunk[]> {
        return this.chunks.filter((chunk) => chunk.session_id === sessionId);
    }

    async listQuarantinedFramesForSession(
        sessionId: string,
    ): Promise<ObjectiveStoredQuarantinedRawFrame[]> {
        return this.quarantined.filter((frame) => frame.session_id === sessionId);
    }

    async listClinicianSafeChunkTraceability(
        sessionId: string,
    ): Promise<ObjectiveRawChunkTraceability[]> {
        const chunks = await this.listRawChunksForSession(sessionId);

        return chunks.map(toClinicianSafeChunkTraceability);
    }

    clear(): void {
        this.ingestionResults.length = 0;
        this.batches.clear();
        this.chunks.length = 0;
        this.quarantined.length = 0;
    }
}
