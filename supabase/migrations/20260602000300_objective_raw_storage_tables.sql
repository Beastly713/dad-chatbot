-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 11: raw batch, raw chunk, and quarantine tables.
--
-- This migration adds raw storage only. Incoming high-rate data is stored in
-- chunks rather than one row per sample. Invalid or rejected frame payloads
-- are preserved in quarantine tables for traceability.
--
-- No ingestion API, preprocessing, feature extraction, ML output,
-- interpretation records, notes, audit logs, RLS policies, grants, or views
-- are created in this commit.

create table if not exists objective.raw_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  segment_id uuid references objective.objective_session_segments(id) on delete set null,
  device_id uuid references objective.objective_devices(id) on delete restrict,
  device_boot_id uuid references objective.objective_device_boots(id) on delete restrict,
  source_type objective.source_type not null,
  schema_version text not null,
  frame_count integer not null,
  accepted_frame_count integer not null default 0,
  quarantined_frame_count integer not null default 0,
  first_esp_time_ms bigint,
  last_esp_time_ms bigint,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint raw_batches_key_nonempty
    check (length(trim(batch_key)) > 0),

  constraint raw_batches_schema_version_nonempty
    check (length(trim(schema_version)) > 0),

  constraint raw_batches_frame_count_nonnegative
    check (frame_count >= 0),

  constraint raw_batches_accepted_count_nonnegative
    check (accepted_frame_count >= 0),

  constraint raw_batches_quarantined_count_nonnegative
    check (quarantined_frame_count >= 0),

  constraint raw_batches_count_total_valid
    check (accepted_frame_count + quarantined_frame_count <= frame_count),

  constraint raw_batches_esp_range_valid
    check (
      first_esp_time_ms is null
      or last_esp_time_ms is null
      or last_esp_time_ms >= first_esp_time_ms
    ),

  constraint raw_batches_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint raw_batches_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.raw_frame_chunks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references objective.raw_batches(id) on delete cascade,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  segment_id uuid not null references objective.objective_session_segments(id) on delete restrict,
  device_id uuid not null references objective.objective_devices(id) on delete restrict,
  device_boot_id uuid not null references objective.objective_device_boots(id) on delete restrict,
  source_type objective.source_type not null,
  schema_version text not null,
  chunk_index integer not null,
  frame_count integer not null,
  first_esp_time_ms bigint not null,
  last_esp_time_ms bigint not null,
  first_pc_timestamp timestamptz,
  last_pc_timestamp timestamptz,
  raw_payload jsonb not null,
  raw_range_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint raw_frame_chunks_schema_version_nonempty
    check (length(trim(schema_version)) > 0),

  constraint raw_frame_chunks_index_nonnegative
    check (chunk_index >= 0),

  constraint raw_frame_chunks_frame_count_positive
    check (frame_count > 0),

  constraint raw_frame_chunks_esp_range_valid
    check (last_esp_time_ms >= first_esp_time_ms),

  constraint raw_frame_chunks_pc_time_valid
    check (
      first_pc_timestamp is null
      or last_pc_timestamp is null
      or last_pc_timestamp >= first_pc_timestamp
    ),

  constraint raw_frame_chunks_payload_object_or_array
    check (jsonb_typeof(raw_payload) in ('object', 'array')),

  constraint raw_frame_chunks_range_metadata_object
    check (jsonb_typeof(raw_range_metadata) = 'object'),

  constraint raw_frame_chunks_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    ),

  constraint raw_frame_chunks_unique_chunk_per_batch
    unique (batch_id, chunk_index)
);

create table if not exists objective.quarantined_raw_frames (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references objective.raw_batches(id) on delete set null,
  session_id uuid references objective.objective_sessions(id) on delete cascade,
  segment_id uuid references objective.objective_session_segments(id) on delete set null,
  device_id uuid references objective.objective_devices(id) on delete set null,
  device_boot_id uuid references objective.objective_device_boots(id) on delete set null,
  source_type objective.source_type,
  schema_version text,
  frame_index integer,
  esp_time_ms bigint,
  pc_timestamp timestamptz,
  reject_reason text not null,
  reject_details jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null,
  quarantined_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint quarantined_raw_frames_index_nonnegative
    check (frame_index is null or frame_index >= 0),

  constraint quarantined_raw_frames_esp_time_nonnegative
    check (esp_time_ms is null or esp_time_ms >= 0),

  constraint quarantined_raw_frames_reason_nonempty
    check (length(trim(reject_reason)) > 0),

  constraint quarantined_raw_frames_reject_details_object
    check (jsonb_typeof(reject_details) = 'object'),

  constraint quarantined_raw_frames_payload_object_or_array
    check (jsonb_typeof(raw_payload) in ('object', 'array')),

  constraint quarantined_raw_frames_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create index if not exists raw_batches_session_received_idx
  on objective.raw_batches (session_id, received_at);

create index if not exists raw_batches_segment_idx
  on objective.raw_batches (segment_id);

create index if not exists raw_frame_chunks_session_segment_time_idx
  on objective.raw_frame_chunks (
    session_id,
    segment_id,
    first_esp_time_ms,
    last_esp_time_ms
  );

create index if not exists raw_frame_chunks_batch_idx
  on objective.raw_frame_chunks (batch_id);

create index if not exists quarantined_raw_frames_session_time_idx
  on objective.quarantined_raw_frames (
    session_id,
    quarantined_at
  );

create index if not exists quarantined_raw_frames_batch_idx
  on objective.quarantined_raw_frames (batch_id);
