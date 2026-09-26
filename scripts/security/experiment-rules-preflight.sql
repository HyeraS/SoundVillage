-- Read-only stage 7 preflight. Run before 006; it never changes data.

select sound_id,zone,group_id,canonical_audio_id,file_path,source_dataset,original_filename
from public.study_sound_catalog
where nullif(canonical_audio_id,'') is null or nullif(file_path,'') is null
   or nullif(source_dataset,'') is null or nullif(original_filename,'') is null
order by sound_id;

select canonical_audio_id,array_agg(sound_id order by sound_id) alias_ids,
  array_agg(distinct file_path) file_paths,array_agg(distinct sub_category) sub_categories,
  array_agg(distinct zone) zones,array_agg(distinct group_id) groups
from public.study_sound_catalog
group by canonical_audio_id having count(*)>1
order by canonical_audio_id;

select canonical_audio_id,array_agg(distinct file_path) file_paths,
  array_agg(distinct source_dataset||':'||original_filename) source_keys,
  array_agg(distinct zone) zones,array_agg(distinct coalesce(group_id,'*')) groups
from public.study_sound_catalog group by canonical_audio_id
having count(distinct file_path)>1 or count(distinct source_dataset||':'||original_filename)>1
  or count(distinct zone)>1 or count(distinct coalesce(group_id,'*'))>1;

select source_dataset,original_filename,array_agg(distinct canonical_audio_id) canonical_ids
from public.study_sound_catalog group by source_dataset,original_filename
having count(distinct canonical_audio_id)>1;

select file_path,array_agg(distinct canonical_audio_id) canonical_ids
from public.study_sound_catalog group by file_path
having count(distinct canonical_audio_id)>1;

select 'annotation_unknown_sound' issue,a.id::text row_id,a.participant_id,a.sound_id
from public.annotations a left join public.study_sound_catalog c on c.sound_id=a.sound_id where c.sound_id is null
union all
select 'vote_unknown_sound',v.id::text,v.participant_id,v.sound_id
from public.votes v left join public.study_sound_catalog c on c.sound_id=v.sound_id where c.sound_id is null
order by issue,participant_id,sound_id;

-- Duplicate normal annotations: review every returned group before 006.
select a.participant_id,c.canonical_audio_id,count(*) row_count,array_agg(a.id order by a.created_at) row_ids,
  array_agg(a.sound_id order by a.created_at) submitted_sound_ids
from public.annotations a join public.study_sound_catalog c on c.sound_id=a.sound_id
where not coalesce(a.is_skipped,false)
group by a.participant_id,c.canonical_audio_id having count(*)>1
order by a.participant_id,c.canonical_audio_id;

-- Duplicate museum votes: review every returned group before 006.
select v.participant_id,c.canonical_audio_id,count(*) row_count,array_agg(v.id order by v.created_at) row_ids,
  array_agg(v.sound_id order by v.created_at) submitted_sound_ids
from public.votes v join public.study_sound_catalog c on c.sound_id=v.sound_id
group by v.participant_id,c.canonical_audio_id having count(*)>1
order by v.participant_id,c.canonical_audio_id;

select participant_id,1 experiment_round,count(*) active_sessions,array_agg(id order by started_at) session_ids
from public.study_sessions where status='active'
group by participant_id having count(*)>1;

-- Legacy completion cannot be linked retrospectively without a reviewed decision.
select id,participant_id,status,started_at,completed_at,completion_reason
from public.study_sessions where status='completed'
order by completed_at,participant_id;

-- Active sessions whose assigned work is already complete need explicit reconciliation.
select s.id,s.participant_id,s.started_at
from public.study_sessions s join public.study_participants p on p.participant_id=s.participant_id
where s.status='active' and not exists (
  select c.canonical_audio_id from public.study_sound_catalog c
  where c.group_id is null or c.group_id=p.group_id or p.access_scope='all'
  except
  select c2.canonical_audio_id from public.annotations a
  join public.study_sound_catalog c2 on c2.sound_id=a.sound_id
  where a.participant_id=p.participant_id and not coalesce(a.is_skipped,false)
)
order by s.started_at,s.participant_id;

select table_name,column_name,is_nullable,data_type
from information_schema.columns where table_schema='public'
  and ((table_name='annotations' and column_name in ('difficulty','selected_features','sound_id','is_skipped'))
    or (table_name='votes' and column_name in ('sound_id','annotation_id')))
order by table_name,column_name;

-- Existing UTC-day rows that may collide conceptually with KST dates. Review only;
-- do not rewrite their assigned/check-in dates automatically.
select participant_id,check_in_date,created_at,
  (created_at at time zone 'Asia/Seoul')::date kst_created_date
from public.participant_attendance
where check_in_date<>(created_at at time zone 'Asia/Seoul')::date
order by participant_id,created_at;

select participant_id,assigned_date,created_at,
  (created_at at time zone 'Asia/Seoul')::date kst_created_date,count(*) over(partition by participant_id,quest_template_id,(created_at at time zone 'Asia/Seoul')::date) kst_day_rows
from public.participant_daily_quests
where assigned_date<>(created_at at time zone 'Asia/Seoul')::date
order by participant_id,created_at;
