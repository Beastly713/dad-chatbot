-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 15: audit events and clinician-patient assignments.
--
-- This migration adds append-only-style audit storage and assignment metadata.
-- RLS policies, grants, clinician-safe views, auth helpers, API routes, and
-- backend guards are added in later commits.
--
-- Patient/client-facing objective access remains unsupported in Phase 3.

create table if not exists objective.clinician_patient_assignments (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null,
  patient_id uuid not null,

  assignment_status text not null default 'active',
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  assignment_reason text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  clinician_visible boolean not null default true,
  patient_visible boolean not null default false,
  chatbot_visible boolean not null default false,

  constraint clinician_patient_assignments_status_allowed
    check (
      assignment_status in (
        'active',
        'revoked'
      )
    ),

  constraint clinician_patient_assignments_revoked_at_required
    check (
      assignment_status <> 'revoked'
      or revoked_at is not null
    ),

  constraint clinician_patient_assignments_revoked_after_assigned
    check (
      revoked_at is null
      or revoked_at >= assigned_at
    ),

  constraint clinician_patient_assignments_metadata_object
    check (jsonb_typeof(metadata) = 'object'),

  constraint clinician_patient_assignments_visibility_clinician_only
    check (
      clinician_visible = true
      and patient_visible = false
      and chatbot_visible = false
    )
);

create unique index if not exists clinician_patient_assignments_one_active_idx
  on objective.clinician_patient_assignments (clinician_id, patient_id)
  where assignment_status = 'active';

create index if not exists clinician_patient_assignments_patient_status_idx
  on objective.clinician_patient_assignments (
    patient_id,
    assignment_status
  );

create index if not exists clinician_patient_assignments_clinician_status_idx
  on objective.clinician_patient_assignments (
    clinician_id,
    assignment_status
  );

create table if not exists objective.audit_events (
  id uuid primary key default gen_random_uuid(),
  audit_event_key text not null unique,

  event_type text not null,
  actor_id uuid,
  actor_role text not null,

  patient_id uuid,
  session_id uuid references objective.objective_sessions(id) on delete set null,
  assignment_id uuid references objective.clinician_patient_assignments(id) on delete set null,

  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint audit_events_key_nonempty
    check (length(trim(audit_event_key)) > 0),

  constraint audit_events_type_allowed
    check (
      event_type in (
        'session_created',
        'session_started',
        'session_paused',
        'session_resumed',
        'session_stopped',
        'ingest_accepted',
        'ingest_rejected',
        'stream_token_issued',
        'stream_denied',
        'access_denied',
        'forbidden_label_blocked',
        'serializer_blocked',
        'interpretation_created',
        'interpretation_suppressed'
      )
    ),

  constraint audit_events_actor_role_allowed
    check (
      actor_role in (
        'service',
        'clinician',
        'developer'
      )
    ),

  constraint audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_events_occurred_idx
  on objective.audit_events (occurred_at);

create index if not exists audit_events_type_occurred_idx
  on objective.audit_events (event_type, occurred_at);

create index if not exists audit_events_actor_idx
  on objective.audit_events (actor_role, actor_id, occurred_at);

create index if not exists audit_events_session_idx
  on objective.audit_events (session_id, occurred_at);

create index if not exists audit_events_patient_idx
  on objective.audit_events (patient_id, occurred_at);

create or replace function objective.prevent_audit_event_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'objective audit events are append-only';
end;
$$;

drop trigger if exists prevent_audit_event_update
  on objective.audit_events;

create trigger prevent_audit_event_update
before update or delete on objective.audit_events
for each row
execute function objective.prevent_audit_event_update();
