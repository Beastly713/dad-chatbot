-- Phase 3 Objective Physiological Monitoring Layer
-- Commit 16: RLS policies and clinician-safe views.
--
-- This migration adds database-level access boundaries. Base objective tables
-- are fail-closed for app users. Clinician access is exposed only through
-- filtered, safe views and requires an active assignment.
--
-- No backend APIs, dashboard components, stream tokens, ingestion services, or
-- assistant integrations are created in this commit.

revoke all on schema objective from public;
revoke all on schema objective from anon;
revoke all on schema objective from authenticated;
revoke all on schema objective from service_role;

grant usage on schema objective to authenticated;

create or replace function objective.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() ->> 'role', ''),
    ''
  );
$$;

create or replace function objective.current_clinician_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function objective.is_current_clinician()
returns boolean
language sql
stable
as $$
  select objective.current_app_role() = 'clinician'
    and objective.current_clinician_id() is not null;
$$;

create or replace function objective.is_assigned_clinician(target_patient_id uuid)
returns boolean
language sql
stable
as $$
  select objective.is_current_clinician()
    and exists (
      select 1
      from objective.clinician_patient_assignments assignment
      where assignment.clinician_id = objective.current_clinician_id()
        and assignment.patient_id = target_patient_id
        and assignment.assignment_status = 'active'
        and assignment.patient_visible = false
        and assignment.chatbot_visible = false
    );
$$;

alter table objective.objective_producers enable row level security;
alter table objective.objective_devices enable row level security;
alter table objective.objective_device_boots enable row level security;
alter table objective.objective_sessions enable row level security;
alter table objective.objective_session_segments enable row level security;
alter table objective.simulator_runs enable row level security;
alter table objective.dataset_replay_runs enable row level security;
alter table objective.hardware_profiles enable row level security;
alter table objective.raw_batches enable row level security;
alter table objective.raw_frame_chunks enable row level security;
alter table objective.quarantined_raw_frames enable row level security;
alter table objective.feature_windows enable row level security;
alter table objective.baseline_profiles enable row level security;
alter table objective.baseline_windows enable row level security;
alter table objective.preprocessing_versions enable row level security;
alter table objective.feature_schema_versions enable row level security;
alter table objective.calibration_versions enable row level security;
alter table objective.model_registry enable row level security;
alter table objective.ml_inferences enable row level security;
alter table objective.interpretation_records enable row level security;
alter table objective.session_interpretation_summaries enable row level security;
alter table objective.clinician_notes enable row level security;
alter table objective.clinician_patient_assignments enable row level security;
alter table objective.audit_events enable row level security;

create policy objective_sessions_assigned_clinician_read
  on objective.objective_sessions
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and objective.is_assigned_clinician(patient_id)
  );

create policy objective_session_segments_assigned_clinician_read
  on objective.objective_session_segments
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = objective_session_segments.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy feature_windows_assigned_clinician_read
  on objective.feature_windows
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = feature_windows.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy ml_inferences_assigned_clinician_read
  on objective.ml_inferences
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = ml_inferences.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy interpretation_records_assigned_clinician_read
  on objective.interpretation_records
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = interpretation_records.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy session_interpretation_summaries_assigned_clinician_read
  on objective.session_interpretation_summaries
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = session_interpretation_summaries.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy clinician_notes_assigned_clinician_read
  on objective.clinician_notes
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and clinician_id = objective.current_clinician_id()
    and exists (
      select 1
      from objective.objective_sessions session
      where session.id = clinician_notes.session_id
        and objective.is_assigned_clinician(session.patient_id)
    )
  );

create policy clinician_patient_assignments_self_read
  on objective.clinician_patient_assignments
  for select
  to authenticated
  using (
    clinician_visible = true
    and patient_visible = false
    and chatbot_visible = false
    and clinician_id = objective.current_clinician_id()
    and assignment_status = 'active'
  );

create or replace view objective.clinician_session_list as
select
  session.id as session_id,
  session.patient_id,
  session.source_type,
  session.status,
  session.created_at,
  session.started_at,
  session.paused_at,
  session.stopped_at,
  session.device_id,
  session.current_device_boot_id
from objective.objective_sessions session
where session.clinician_visible = true
  and session.patient_visible = false
  and session.chatbot_visible = false
  and objective.is_assigned_clinician(session.patient_id);

create or replace view objective.clinician_interpretation_timeline as
select
  interpretation.id as interpretation_id,
  interpretation.session_id,
  session.patient_id,
  interpretation.feature_window_id,
  interpretation.ml_inference_id,
  interpretation.label,
  interpretation.evidence_level,
  interpretation.confidence_label,
  interpretation.suppression_state,
  interpretation.summary,
  interpretation.uncertainty_reasons,
  interpretation.contributing_modalities,
  interpretation.excluded_modalities,
  interpretation.created_at
from objective.interpretation_records interpretation
join objective.objective_sessions session
  on session.id = interpretation.session_id
where interpretation.clinician_visible = true
  and interpretation.patient_visible = false
  and interpretation.chatbot_visible = false
  and session.patient_visible = false
  and session.chatbot_visible = false
  and objective.is_assigned_clinician(session.patient_id);

create or replace view objective.clinician_session_summary as
select
  summary.id as summary_id,
  summary.session_id,
  session.patient_id,
  summary.total_windows,
  summary.interpretable_fraction,
  summary.suppressed_fraction,
  summary.modality_availability,
  summary.quality_distribution,
  summary.evidence_period_count,
  summary.cooldown_period_count,
  summary.motion_confounded_fraction,
  summary.summary_text,
  summary.preprocessing_version,
  summary.model_version,
  summary.generated_at
from objective.session_interpretation_summaries summary
join objective.objective_sessions session
  on session.id = summary.session_id
where summary.clinician_visible = true
  and summary.patient_visible = false
  and summary.chatbot_visible = false
  and session.patient_visible = false
  and session.chatbot_visible = false
  and objective.is_assigned_clinician(session.patient_id);

create or replace view objective.clinician_chart_safe_data as
select
  feature.id as feature_window_id,
  feature.session_id,
  session.patient_id,
  feature.segment_id,
  feature.source_type,
  feature.start_esp_time_ms,
  feature.end_esp_time_ms,
  feature.start_pc_timestamp,
  feature.end_pc_timestamp,
  feature.window_status,
  feature.suppression_state,
  feature.quality,
  feature.missingness,
  feature.modality_availability,
  feature.baseline_relative,
  feature.uncertainty_reasons
from objective.feature_windows feature
join objective.objective_sessions session
  on session.id = feature.session_id
where feature.clinician_visible = true
  and feature.patient_visible = false
  and feature.chatbot_visible = false
  and session.patient_visible = false
  and session.chatbot_visible = false
  and objective.is_assigned_clinician(session.patient_id);

create or replace view objective.clinician_quality_timeline as
select
  feature.id as feature_window_id,
  feature.session_id,
  session.patient_id,
  feature.segment_id,
  feature.start_esp_time_ms,
  feature.end_esp_time_ms,
  feature.window_status,
  feature.suppression_state,
  feature.quality,
  feature.missingness,
  feature.modality_availability,
  feature.uncertainty_reasons
from objective.feature_windows feature
join objective.objective_sessions session
  on session.id = feature.session_id
where feature.clinician_visible = true
  and feature.patient_visible = false
  and feature.chatbot_visible = false
  and session.patient_visible = false
  and session.chatbot_visible = false
  and objective.is_assigned_clinician(session.patient_id);

revoke all on objective.clinician_session_list from public;
revoke all on objective.clinician_interpretation_timeline from public;
revoke all on objective.clinician_session_summary from public;
revoke all on objective.clinician_chart_safe_data from public;
revoke all on objective.clinician_quality_timeline from public;

grant select on objective.clinician_session_list to authenticated;
grant select on objective.clinician_interpretation_timeline to authenticated;
grant select on objective.clinician_session_summary to authenticated;
grant select on objective.clinician_chart_safe_data to authenticated;
grant select on objective.clinician_quality_timeline to authenticated;
