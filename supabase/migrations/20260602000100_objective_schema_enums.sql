-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 9: objective schema, enums, and source types.
--
-- This migration creates only the isolated objective namespace and safe enum
-- contracts. Tables, RLS, grants, views, and persistence are added in later
-- commits.
--
-- Safety boundary:
-- - Objective records are clinician-facing only in Phase 3.
-- - These enum names must stay non-diagnostic and non-clinical-outcome oriented.
-- - Do not add craving, relapse, withdrawal, acute substance-state, emergency,
--   AUD severity, CIWA, treatment, medication, detox, sobriety, or truthfulness
--   labels here.

create schema if not exists objective;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'source_type'
  ) then
    create type objective.source_type as enum (
      'simulator',
      'public_dataset_replay',
      'prototype_hardware'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'session_status'
  ) then
    create type objective.session_status as enum (
      'created',
      'active',
      'paused',
      'stopped',
      'aborted'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'evidence_level'
  ) then
    create type objective.evidence_level as enum (
      'none_observed',
      'low',
      'moderate',
      'elevated',
      'insufficient_data'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'confidence_label'
  ) then
    create type objective.confidence_label as enum (
      'low_confidence',
      'moderate_confidence',
      'high_confidence',
      'not_available'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'suppression_state'
  ) then
    create type objective.suppression_state as enum (
      'not_suppressed',
      'suppressed_low_quality',
      'suppressed_missing_baseline',
      'suppressed_motion_confound',
      'suppressed_signal_conflict',
      'suppressed_missing_data'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'interpretation_label'
  ) then
    create type objective.interpretation_label as enum (
      'low_or_baseline_arousal_evidence',
      'elevated_physiological_arousal_evidence',
      'stress_like_autonomic_activation_evidence',
      'recovery_cooldown_trend',
      'movement_activity_like_confound',
      'signal_quality_limitation',
      'cross_signal_agreement',
      'cross_signal_disagreement',
      'insufficient_reliable_data',
      'ml_unavailable',
      'simulated_data_notice'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'ml_target'
  ) then
    create type objective.ml_target as enum (
      'baseline_relative_elevated_physiological_arousal_evidence'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'objective'
      and t.typname = 'ml_class'
  ) then
    create type objective.ml_class as enum (
      'low_or_baseline_arousal_evidence',
      'elevated_arousal_evidence',
      'recovery_cooldown',
      'insufficient_reliable_data'
    );
  end if;
end $$;
