-- Read-only post-migration grants, policies, constraints, and function verification.
select table_name, is_insertable_into
from information_schema.tables
where table_schema='public' and table_name in ('study_sessions','user_events','user_event_names');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('study_sessions','user_events','user_event_names')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('study_sessions','user_events','user_event_names')
order by table_name, grantee, privilege_type;

select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) arguments,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in (
  'start_or_resume_study_session_v1','record_user_events_v1','complete_study_session_v1',
  'save_participant_room_v3','is_user_event_researcher'
)
order by p.proname;

select event_name, active from public.user_event_names order by event_name;

