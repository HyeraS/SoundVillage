-- Read-only verification after 006 in local/staging.

select c.relname index_name,pg_get_indexdef(i.indexrelid) definition
from pg_index i join pg_class c on c.oid=i.indexrelid
where c.relname in ('annotations_one_normal_result_per_audio_round_uq','votes_one_result_per_audio_round_uq','study_sessions_one_active_round_uq')
order by c.relname;

select routine_schema,routine_name,security_type
from information_schema.routines where routine_schema in ('private','public') and routine_name in (
  'study_date_kst','study_day_start_kst','start_or_resume_study_session_v2','get_my_experiment_progress_v1',
  'get_my_completed_audio_v1','submit_annotation_v4','submit_museum_vote_v4','ensure_today_check_in_v4',
  'museum_candidate_expressions_v2','museum_annotation_counts_v2','museum_voted_audio_ids_v1'
) order by routine_schema,routine_name;

select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('submit_annotation_v4','submit_museum_vote_v4','ensure_today_check_in_v4','get_my_experiment_progress_v1')
order by p.proname;

select p.proname,pg_get_function_identity_arguments(p.oid) arguments,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'start_or_resume_study_session_v1','start_or_resume_study_session_v2',
  'submit_annotation_v3','submit_annotation_v4','submit_museum_vote_v3','submit_museum_vote_v4',
  'ensure_today_check_in_v3','ensure_today_check_in_v4'
) order by p.proname;

select id,participant_id,status,experiment_round,completion_annotation_id,completion_operation_key
from public.study_sessions where status='completed'
  and (completion_annotation_id is null or completion_operation_key is null);

select count(*) filter(where canonical_audio_id is null) annotation_missing_identity,
  count(*) filter(where experiment_round is null) annotation_missing_round from public.annotations;
select count(*) filter(where canonical_audio_id is null) vote_missing_identity,
  count(*) filter(where experiment_round is null) vote_missing_round from public.votes;

select private.study_date_kst('2026-09-10 14:59:59+00'::timestamptz) before_kst_midnight,
  private.study_date_kst('2026-09-10 15:00:00+00'::timestamptz) at_kst_midnight,
  private.study_day_start_kst('2026-09-11'::date) kst_day_start;
