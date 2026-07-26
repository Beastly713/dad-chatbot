-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 13: ML inference and registry tables.
--
-- This migration adds model/version registry tables and bounded ML inference
-- records. ML output is limited to allowed physiological evidence targets and
-- classes defined in objective enum types.
--
-- No ML service, model artifact loading, interpretation records, notes, audit
-- logs, RLS policies, grants, views, or dashboard behavior are created here.

create table if not exists objective.preprocessing_versions (
  id uuid primary key default gen_random_uuid(),
  preprocessing_version_key text not null unique,
  display_name text not null,
  source_type objective.source_type,
  config jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint preprocessing_versions_key_nonempty
    check (length(trim(preprocessing_version_key)) > 0),

  constraint preprocessing_versions_display_name_nonempty
    check (length(trim(display_name)) > 0),

  constraint preprocessing_versions_config_object
    check (jsonb_typeof(config) = 'object'),

  constraint preprocessing_versions_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.feature_schema_versions (
  id uuid primary key default gen_random_uuid(),
  feature_schema_version_key text not null unique,
  display_name text not null,
  feature_names jsonb not null default '[]'::jsonb,
  schema_details jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint feature_schema_versions_key_nonempty
    check (length(trim(feature_schema_version_key)) > 0),

  constraint feature_schema_versions_display_name_nonempty
    check (length(trim(display_name)) > 0),

  constraint feature_schema_versions_feature_names_array
    check (jsonb_typeof(feature_names) = 'array'),

  constraint feature_schema_versions_schema_details_object
    check (jsonb_typeof(schema_details) = 'object'),

  constraint feature_schema_versions_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.calibration_versions (
  id uuid primary key default gen_random_uuid(),
  calibration_version_key text not null unique,
  display_name text not null,
  source_type objective.source_type,
  calibration_scope text not null,
  calibration_details jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint calibration_versions_key_nonempty
    check (length(trim(calibration_version_key)) > 0),

  constraint calibration_versions_display_name_nonempty
    check (length(trim(display_name)) > 0),

  constraint calibration_versions_scope_nonempty
    check (length(trim(calibration_scope)) > 0),

  constraint calibration_versions_details_object
    check (jsonb_typeof(calibration_details) = 'object'),

  constraint calibration_versions_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.model_registry (
  id uuid primary key default gen_random_uuid(),
  model_key text not null unique,
  display_name text not null,
  model_family text not null,
  target objective.ml_target not null,
  allowed_classes jsonb not null default '[]'::jsonb,
  preprocessing_version_id uuid references objective.preprocessing_versions(id) on delete set null,
  feature_schema_version_id uuid references objective.feature_schema_versions(id) on delete set null,
  calibration_version_id uuid references objective.calibration_versions(id) on delete set null,
  model_card jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint model_registry_key_nonempty
    check (length(trim(model_key)) > 0),

  constraint model_registry_display_name_nonempty
    check (length(trim(display_name)) > 0),

  constraint model_registry_family_nonempty
    check (length(trim(model_family)) > 0),

  constraint model_registry_allowed_classes_array
    check (jsonb_typeof(allowed_classes) = 'array'),

  constraint model_registry_model_card_object
    check (jsonb_typeof(model_card) = 'object'),

  constraint model_registry_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create table if not exists objective.ml_inferences (
  id uuid primary key default gen_random_uuid(),
  ml_inference_key text not null unique,
  feature_window_id uuid not null references objective.feature_windows(id) on delete restrict,
  session_id uuid not null references objective.objective_sessions(id) on delete cascade,
  model_id uuid references objective.model_registry(id) on delete restrict,
  model_key text not null,
  model_version text not null,
  target objective.ml_target not null,
  predicted_class objective.ml_class not null,
  confidence_label objective.confidence_label not null,
  probability double precision,
  uncertainty_reasons jsonb not null default '[]'::jsonb,
  suppression_state objective.suppression_state not null default 'not_suppressed',
  inference_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint ml_inferences_key_nonempty
    check (length(trim(ml_inference_key)) > 0),

  constraint ml_inferences_model_key_nonempty
    check (length(trim(model_key)) > 0),

  constraint ml_inferences_model_version_nonempty
    check (length(trim(model_version)) > 0),

  constraint ml_inferences_probability_range
    check (probability is null or (probability >= 0 and probability <= 1)),

  constraint ml_inferences_uncertainty_reasons_array
    check (jsonb_typeof(uncertainty_reasons) = 'array'),

  constraint ml_inferences_payload_object
    check (jsonb_typeof(inference_payload) = 'object'),

  constraint ml_inferences_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create index if not exists preprocessing_versions_key_idx
  on objective.preprocessing_versions (preprocessing_version_key);

create index if not exists feature_schema_versions_key_idx
  on objective.feature_schema_versions (feature_schema_version_key);

create index if not exists calibration_versions_key_idx
  on objective.calibration_versions (calibration_version_key);

create index if not exists model_registry_target_active_idx
  on objective.model_registry (target, is_active);

create index if not exists ml_inferences_session_created_idx
  on objective.ml_inferences (session_id, created_at);

create index if not exists ml_inferences_feature_window_idx
  on objective.ml_inferences (feature_window_id);

create index if not exists ml_inferences_target_class_idx
  on objective.ml_inferences (target, predicted_class);
