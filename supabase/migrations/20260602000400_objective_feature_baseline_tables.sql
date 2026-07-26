-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 12: feature window and baseline tables.
--
-- This migration adds preprocessing output storage only:
-- - feature windows
-- - baseline profiles
-- - baseline windows
--
-- Feature windows remain traceable to raw chunks/ranges and versioned by
-- preprocessing and feature schema versions. These tables do not store
-- diagnosis, treatment, medication, detox, scoring, crisis, sobriety, or
-- truthfulness fields.
--
-- No ML output, interpretation records, notes, audit logs, RLS policies,
-- grants, views, services, or dashboard behavior are created in this commit.

create table if not exists objective.feature_windows (
  id uuid primary key default gen_random_uuid(),
  feature_window_key text not null unique,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  segment_id uuid references objective.objective_session_segments(id) on delete set null,
  source_type objective.source_type not null,

  start_esp_time_ms bigint not null,
  end_esp_time_ms bigint not null,
  start_pc_timestamp timestamptz,
  end_pc_timestamp timestamptz,

  raw_batch_id uuid references objective.raw_batches(id) on delete set null,
  raw_chunk_refs jsonb not null default '[]'::jsonb,
  raw_range_refs jsonb not null default '{}'::jsonb,

  preprocessing_version text not null,
  feature_schema_version text not null,
  window_status text not null,
  suppression_state objective.suppression_state not null default 'not_suppressed',

  quality jsonb not null default '{}'::jsonb,
  missingness jsonb not null default '{}'::jsonb,
  modality_availability jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,

  baseline_profile_id uuid,
  baseline_relative jsonb not null default '{}'::jsonb,
  uncertainty_reasons jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint feature_windows_key_nonempty
    check (length(trim(feature_window_key)) > 0),

  constraint feature_windows_esp_range_valid
    check (end_esp_time_ms >= start_esp_time_ms),

  constraint feature_windows_pc_time_valid
    check (
      start_pc_timestamp is null
      or end_pc_timestamp is null
      or end_pc_timestamp >= start_pc_timestamp
    ),

  constraint feature_windows_preprocessing_version_nonempty
    check (length(trim(preprocessing_version)) > 0),

  constraint feature_windows_feature_schema_version_nonempty
    check (length(trim(feature_schema_version)) > 0),

  constraint feature_windows_status_allowed
    check (
      window_status in (
        'ready',
        'suppressed',
        'insufficient_data'
      )
    ),

  constraint feature_windows_raw_chunk_refs_array
    check (jsonb_typeof(raw_chunk_refs) = 'array'),

  constraint feature_windows_raw_range_refs_object
    check (jsonb_typeof(raw_range_refs) = 'object'),

  constraint feature_windows_quality_object
    check (jsonb_typeof(quality) = 'object'),

  constraint feature_windows_missingness_object
    check (jsonb_typeof(missingness) = 'object'),

  constraint feature_windows_modality_availability_object
    check (jsonb_typeof(modality_availability) = 'object'),

  constraint feature_windows_features_object
    check (jsonb_typeof(features) = 'object'),

  constraint feature_windows_baseline_relative_object
    check (jsonb_typeof(baseline_relative) = 'object'),

  constraint feature_windows_uncertainty_reasons_array
    check (jsonb_typeof(uncertainty_reasons) = 'array'),

  constraint feature_windows_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.baseline_profiles (
  id uuid primary key default gen_random_uuid(),
  baseline_profile_key text not null unique,
  session_id uuid references objective.objective_sessions(id) on delete cascade,
  patient_id uuid not null,
  source_type objective.source_type not null,

  profile_status text not null default 'building',
  baseline_method text not null,
  preprocessing_version text not null,
  feature_schema_version text not null,

  baseline_start_esp_time_ms bigint,
  baseline_end_esp_time_ms bigint,
  baseline_start_pc_timestamp timestamptz,
  baseline_end_pc_timestamp timestamptz,

  modality_availability jsonb not null default '{}'::jsonb,
  baseline_quality jsonb not null default '{}'::jsonb,
  baseline_features jsonb not null default '{}'::jsonb,
  uncertainty_reasons jsonb not null default '[]'::jsonb,

  developer_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint baseline_profiles_key_nonempty
    check (length(trim(baseline_profile_key)) > 0),

  constraint baseline_profiles_status_allowed
    check (
      profile_status in (
        'building',
        'ready',
        'limited',
        'unavailable',
        'superseded'
      )
    ),

  constraint baseline_profiles_method_nonempty
    check (length(trim(baseline_method)) > 0),

  constraint baseline_profiles_preprocessing_version_nonempty
    check (length(trim(preprocessing_version)) > 0),

  constraint baseline_profiles_feature_schema_version_nonempty
    check (length(trim(feature_schema_version)) > 0),

  constraint baseline_profiles_esp_range_valid
    check (
      baseline_start_esp_time_ms is null
      or baseline_end_esp_time_ms is null
      or baseline_end_esp_time_ms >= baseline_start_esp_time_ms
    ),

  constraint baseline_profiles_pc_time_valid
    check (
      baseline_start_pc_timestamp is null
      or baseline_end_pc_timestamp is null
      or baseline_end_pc_timestamp >= baseline_start_pc_timestamp
    ),

  constraint baseline_profiles_modality_availability_object
    check (jsonb_typeof(modality_availability) = 'object'),

  constraint baseline_profiles_quality_object
    check (jsonb_typeof(baseline_quality) = 'object'),

  constraint baseline_profiles_features_object
    check (jsonb_typeof(baseline_features) = 'object'),

  constraint baseline_profiles_uncertainty_reasons_array
    check (jsonb_typeof(uncertainty_reasons) = 'array'),

  constraint baseline_profiles_developer_metadata_object
    check (jsonb_typeof(developer_metadata) = 'object'),

  constraint baseline_profiles_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

alter table objective.feature_windows
  add constraint feature_windows_baseline_profile_fk
  foreign key (baseline_profile_id)
  references objective.baseline_profiles(id)
  on delete set null;

create table if not exists objective.baseline_windows (
  id uuid primary key default gen_random_uuid(),
  baseline_profile_id uuid not null references objective.baseline_profiles(id) on delete cascade,
  feature_window_id uuid not null references objective.feature_windows(id) on delete restrict,
  session_id uuid references objective.objective_sessions(id) on delete cascade,

  inclusion_state text not null default 'included',
  exclusion_reason text,
  window_weight double precision not null default 1.0,
  developer_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint baseline_windows_inclusion_state_allowed
    check (
      inclusion_state in (
        'included',
        'excluded',
        'candidate'
      )
    ),

  constraint baseline_windows_exclusion_reason_required
    check (
      inclusion_state <> 'excluded'
      or (
        exclusion_reason is not null
        and length(trim(exclusion_reason)) > 0
      )
    ),

  constraint baseline_windows_weight_nonnegative
    check (window_weight >= 0),

  constraint baseline_windows_developer_metadata_object
    check (jsonb_typeof(developer_metadata) = 'object'),

  constraint baseline_windows_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    ),

  constraint baseline_windows_unique_feature_per_profile
    unique (baseline_profile_id, feature_window_id)
);

create index if not exists feature_windows_session_time_idx
  on objective.feature_windows (
    session_id,
    start_esp_time_ms,
    end_esp_time_ms
  );

create index if not exists feature_windows_segment_idx
  on objective.feature_windows (segment_id);

create index if not exists feature_windows_raw_batch_idx
  on objective.feature_windows (raw_batch_id);

create index if not exists feature_windows_baseline_profile_idx
  on objective.feature_windows (baseline_profile_id);

create index if not exists baseline_profiles_patient_status_idx
  on objective.baseline_profiles (
    patient_id,
    profile_status,
    created_at
  );

create index if not exists baseline_profiles_session_idx
  on objective.baseline_profiles (session_id);

create index if not exists baseline_windows_profile_idx
  on objective.baseline_windows (baseline_profile_id);

create index if not exists baseline_windows_feature_window_idx
  on objective.baseline_windows (feature_window_id);
