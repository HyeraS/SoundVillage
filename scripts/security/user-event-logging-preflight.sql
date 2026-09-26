-- Read-only preflight. Run after 001-003 and before reviewing/applying 004.
select to_regclass('public.study_participants') as study_participants,
       to_regclass('public.idempotent_operations') as idempotent_operations,
       to_regclass('public.participant_room') as participant_room;

select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name in ('study_participants','idempotent_operations','participant_room')
order by table_name, ordinal_position;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private')
  and p.proname in ('current_participant_id','submit_annotation_v3','submit_museum_vote_v3','ensure_today_check_in_v3','set_equipped_outfit_v3')
order by p.proname;

select participant_id, group_id, status, auth_user_id is not null as claimed
from public.study_participants
order by participant_id;

select count(*) as participant_count,
       count(*) filter (where status='active') as active_count,
       count(*) filter (where auth_user_id is null) as unclaimed_count
from public.study_participants;

