-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 14: interpretation, session summary, and clinician note tables.
--
-- This migration adds clinician-facing interpretation records, session-level
-- interpretation summaries, and separated clinician notes.
--
-- Automated records and human notes are intentionally separate. These tables
-- do not store diagnosis, clinical scoring, treatment, medication, detox,
-- crisis, sobriety, or truthfulness fields.
--
-- No RLS policies, grants, views, API routes, services, or dashboard behavior
-- are created in this commit.

create table if not exists objective.interpretation_records (
  id uuid primary key default gen_random_uuid(),
  interpretation_key text not null unique,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  feature_window_id uuid references objective.feature_windows(id) on delete set null,
  ml_inference_id uuid references objective.ml_inferences(id) on delete set null,

  label objective.interpretation_label not null,
  evidence_level objective.evidence_level not null,
  confidence_label objective.confidence_label not null,
  suppression_state objective.suppression_state not null default 'not_suppressed',

  summary text not null,
  uncertainty_reasons jsonb not null default '[]'::jsonb,
  contributing_modalities jsonb not null default '[]'::jsonb,
  excluded_modalities jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint interpretation_records_key_nonempty
    check (length(trim(interpretation_key)) > 0),

  constraint interpretation_records_summary_nonempty
    check (length(trim(summary)) > 0),

  constraint interpretation_records_uncertainty_reasons_array
    check (jsonb_typeof(uncertainty_reasons) = 'array'),

  constraint interpretation_records_contributing_modalities_array
    check (jsonb_typeof(contributing_modalities) = 'array'),

  constraint interpretation_records_excluded_modalities_array
    check (jsonb_typeof(excluded_modalities) = 'array'),

  constraint interpretation_records_source_refs_object
    check (jsonb_typeof(source_refs) = 'object'),

  constraint interpretation_records_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.session_interpretation_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_key text not null unique,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,

  total_windows integer not null default 0,
  interpretable_fraction double precision not null default 0,
  suppressed_fraction double precision not null default 0,
  modality_availability jsonb not null default '{}'::jsonb,
  quality_distribution jsonb not null default '{}'::jsonb,
  evidence_period_count integer not null default 0,
  cooldown_period_count integer not null default 0,
  motion_confounded_fraction double precision not null default 0,

  summary_text text,
  preprocessing_version text,
  model_version text,
  source_refs jsonb not null default '{}'::jsonb,

  generated_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint session_interpretation_summaries_key_nonempty
    check (length(trim(summary_key)) > 0),

  constraint session_interpretation_summaries_total_windows_nonnegative
    check (total_windows >= 0),

  constraint session_interpretation_summaries_interpretable_fraction_range
    check (interpretable_fraction >= 0 and interpretable_fraction <= 1),

  constraint session_interpretation_summaries_suppressed_fraction_range
    check (suppressed_fraction >= 0 and suppressed_fraction <= 1),

  constraint session_interpretation_summaries_evidence_count_nonnegative
    check (evidence_period_count >= 0),

  constraint session_interpretation_summaries_cooldown_count_nonnegative
    check (cooldown_period_count >= 0),

  constraint session_interpretation_summaries_motion_fraction_range
    check (motion_confounded_fraction >= 0 and motion_confounded_fraction <= 1),

  constraint session_interpretation_summaries_modality_availability_object
    check (jsonb_typeof(modality_availability) = 'object'),

  constraint session_interpretation_summaries_quality_distribution_object
    check (jsonb_typeof(quality_distribution) = 'object'),

  constraint session_interpretation_summaries_source_refs_object
    check (jsonb_typeof(source_refs) = 'object'),

  constraint session_interpretation_summaries_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.clinician_notes (
  id uuid primary key default gen_random_uuid(),
  note_key text not null unique,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  clinician_id uuid not null,

  note_text text not null,
  linked_interpretation_id uuid references objective.interpretation_records(id) on delete set null,
  linked_feature_window_id uuid references objective.feature_windows(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint clinician_notes_key_nonempty
    check (length(trim(note_key)) > 0),

  constraint clinician_notes_text_nonempty
    check (length(trim(note_text)) > 0),

  constraint clinician_notes_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create index if not exists interpretation_records_session_created_idx
  on objective.interpretation_records (session_id, created_at);

create index if not exists interpretation_records_feature_window_idx
  on objective.interpretation_records (feature_window_id);

create index if not exists interpretation_records_ml_inference_idx
  on objective.interpretation_records (ml_inference_id);

create index if not exists interpretation_records_label_idx
  on objective.interpretation_records (label);

create index if not exists session_interpretation_summaries_session_generated_idx
  on objective.session_interpretation_summaries (session_id, generated_at);

create index if not exists clinician_notes_session_created_idx
  on objective.clinician_notes (session_id, created_at);

create index if not exists clinician_notes_clinician_idx
  on objective.clinician_notes (clinician_id);
