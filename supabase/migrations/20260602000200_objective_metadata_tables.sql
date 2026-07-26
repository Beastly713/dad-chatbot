-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 10: objective metadata tables.
--
-- This migration creates metadata tables only:
-- - sessions
-- - session segments
-- - devices and device boots
-- - producers
-- - simulator/public replay metadata
-- - prototype hardware profiles
--
-- No raw physiological samples, feature windows, ML outputs, interpretation
-- records, clinician notes, audit logs, RLS policies, grants, or views are
-- created in this commit.

create table if not exists objective.objective_producers (
  id uuid primary key default gen_random_uuid(),
  producer_key text not null unique,
  display_name text not null,
  source_type objective.source_type not null,
  created_at timestamptz not null default now(),

  constraint objective_producers_key_nonempty
    check (length(trim(producer_key)) > 0),

  constraint objective_producers_display_name_nonempty
    check (length(trim(display_name)) > 0)
);

create table if not exists objective.objective_devices (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  source_type objective.source_type not null,
  producer_id uuid references objective.objective_producers(id) on delete set null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint objective_devices_key_nonempty
    check (length(trim(device_key)) > 0),

  constraint objective_devices_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists objective.objective_device_boots (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references objective.objective_devices(id) on delete restrict,
  device_boot_key text not null,
  source_type objective.source_type not null,
  boot_started_at timestamptz,
  boot_started_esp_time_ms bigint not null default 0,
  created_at timestamptz not null default now(),

  constraint objective_device_boots_key_nonempty
    check (length(trim(device_boot_key)) > 0),

  constraint objective_device_boots_esp_time_nonnegative
    check (boot_started_esp_time_ms >= 0),

  constraint objective_device_boots_unique_per_device
    unique (device_id, device_boot_key)
);

create table if not exists objective.objective_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  source_type objective.source_type not null,
  status objective.session_status not null default 'created',
  device_id uuid references objective.objective_devices(id) on delete restrict,
  current_device_boot_id uuid references objective.objective_device_boots(id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  paused_at timestamptz,
  stopped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint objective_sessions_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint objective_sessions_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    ),

  constraint objective_sessions_started_after_created
    check (started_at is null or started_at >= created_at),

  constraint objective_sessions_paused_after_created
    check (paused_at is null or paused_at >= created_at),

  constraint objective_sessions_stopped_after_created
    check (stopped_at is null or stopped_at >= created_at)
);

create table if not exists objective.objective_session_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  device_boot_id uuid not null references objective.objective_device_boots(id) on delete restrict,
  source_type objective.source_type not null,
  reason text not null,
  start_esp_time_ms bigint not null,
  end_esp_time_ms bigint,
  start_pc_timestamp timestamptz,
  end_pc_timestamp timestamptz,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint objective_session_segments_reason_allowed
    check (
      reason in (
        'session_start',
        'manual_segment',
        'device_reset',
        'timing_gap',
        'source_change'
      )
    ),

  constraint objective_session_segments_start_time_nonnegative
    check (start_esp_time_ms >= 0),

  constraint objective_session_segments_end_time_valid
    check (end_esp_time_ms is null or end_esp_time_ms >= start_esp_time_ms),

  constraint objective_session_segments_pc_time_valid
    check (
      end_pc_timestamp is null
      or start_pc_timestamp is null
      or end_pc_timestamp >= start_pc_timestamp
    ),

  constraint objective_session_segments_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    ),

  constraint objective_session_segments_unique_start_per_boot
    unique (session_id, device_boot_id, start_esp_time_ms)
);

create table if not exists objective.simulator_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  source_type objective.source_type not null default 'simulator',
  scenario_id text not null,
  seed bigint not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  developer_labels_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint simulator_runs_source_type_simulator
    check (source_type = 'simulator'),

  constraint simulator_runs_scenario_nonempty
    check (length(trim(scenario_id)) > 0),

  constraint simulator_runs_seed_nonnegative
    check (seed >= 0),

  constraint simulator_runs_labels_hidden
    check (developer_labels_visible = false),

  constraint simulator_runs_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint simulator_runs_time_valid
    check (ended_at is null or ended_at >= started_at),

  constraint simulator_runs_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.dataset_replay_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  source_type objective.source_type not null default 'public_dataset_replay',
  dataset_key text not null,
  replay_profile jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint dataset_replay_runs_source_type_public_replay
    check (source_type = 'public_dataset_replay'),

  constraint dataset_replay_runs_dataset_key_nonempty
    check (length(trim(dataset_key)) > 0),

  constraint dataset_replay_runs_profile_object
    check (jsonb_typeof(replay_profile) = 'object'),

  constraint dataset_replay_runs_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint dataset_replay_runs_time_valid
    check (ended_at is null or ended_at >= started_at),

  constraint dataset_replay_runs_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.hardware_profiles (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references objective.objective_devices(id) on delete cascade,
  source_type objective.source_type not null default 'prototype_hardware',
  profile_key text not null unique,
  hardware_notes text,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint hardware_profiles_source_type_prototype
    check (source_type = 'prototype_hardware'),

  constraint hardware_profiles_key_nonempty
    check (length(trim(profile_key)) > 0),

  constraint hardware_profiles_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint hardware_profiles_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);
