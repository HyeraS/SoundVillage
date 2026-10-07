-- Read-only remote-shaped preflight for 006.
-- It preserves the blocking checks from experiment-rules-preflight.sql while
-- avoiding row-level identifiers and tolerating the legacy absence of
-- participant_daily_quests.created_at (which 006 does not read or modify).
begin;
set transaction read only;

do $$
begin
  if exists (
    select 1 from public.study_sound_catalog
    where nullif(canonical_audio_id, '') is null
       or nullif(file_path, '') is null
       or nullif(source_dataset, '') is null
       or nullif(original_filename, '') is null
  ) then
    raise exception 'PREFLIGHT_REQUIRED: catalog canonical mapping is incomplete';
  end if;

  if exists (
    select canonical_audio_id from public.study_sound_catalog
    group by canonical_audio_id
    having count(distinct file_path) > 1
       or count(distinct source_dataset || ':' || original_filename) > 1
       or count(distinct zone) > 1
       or count(distinct coalesce(group_id, '*')) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: canonical audio mapping is ambiguous';
  end if;

  if exists (
    select source_dataset, original_filename from public.study_sound_catalog
    group by source_dataset, original_filename
    having count(distinct canonical_audio_id) > 1
  ) or exists (
    select file_path from public.study_sound_catalog
    group by file_path
    having count(distinct canonical_audio_id) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: one source maps to multiple canonical IDs';
  end if;

  if exists (
    select 1 from public.annotations a
    left join public.study_sound_catalog c on c.sound_id = a.sound_id
    where c.sound_id is null
  ) or exists (
    select 1 from public.votes v
    left join public.study_sound_catalog c on c.sound_id = v.sound_id
    where c.sound_id is null
  ) then
    raise exception 'PREFLIGHT_REQUIRED: result rows contain unknown sound IDs';
  end if;

  if exists (
    select a.participant_id, c.canonical_audio_id
    from public.annotations a
    join public.study_sound_catalog c on c.sound_id = a.sound_id
    where not coalesce(a.is_skipped, false)
    group by a.participant_id, c.canonical_audio_id
    having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: duplicate canonical annotations exist';
  end if;

  if exists (
    select v.participant_id, c.canonical_audio_id
    from public.votes v
    join public.study_sound_catalog c on c.sound_id = v.sound_id
    group by v.participant_id, c.canonical_audio_id
    having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: duplicate canonical votes exist';
  end if;

  if exists (
    select participant_id from public.study_sessions
    where status = 'active'
    group by participant_id
    having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: multiple active sessions exist';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'annotations'
      and column_name in ('difficulty', 'selected_features')
      and is_nullable = 'NO'
  ) then
    raise exception 'PREFLIGHT_REQUIRED: nullable annotation fields are required';
  end if;

  if exists (select 1 from public.study_sessions where status = 'completed') then
    raise exception 'PREFLIGHT_REQUIRED: completed sessions require reconciliation';
  end if;

  if exists (
    select 1
    from public.study_sessions s
    join public.study_participants p on p.participant_id = s.participant_id
    where s.status = 'active'
      and not exists (
        select c.canonical_audio_id from public.study_sound_catalog c
        where c.group_id is null or c.group_id = p.group_id or p.access_scope = 'all'
        except
        select c2.canonical_audio_id
        from public.annotations a
        join public.study_sound_catalog c2 on c2.sound_id = a.sound_id
        where a.participant_id = p.participant_id
          and not coalesce(a.is_skipped, false)
      )
  ) then
    raise exception 'PREFLIGHT_REQUIRED: an active session is already complete';
  end if;
end $$;

select metric, value
from (
  select 1 ord, 'catalog_rows' metric, count(*)::bigint value
  from public.study_sound_catalog
  union all
  select 2, 'catalog_canonical_alias_rows', count(*) - count(distinct canonical_audio_id)
  from public.study_sound_catalog
  union all
  select 3, 'attendance_kst_date_mismatches', count(*)
  from public.participant_attendance
  where check_in_date <> (created_at at time zone 'Asia/Seoul')::date
  union all
  select 4, 'quest_created_at_column_present', count(*)
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'participant_daily_quests'
    and column_name = 'created_at'
) summary
order by ord;

rollback;
