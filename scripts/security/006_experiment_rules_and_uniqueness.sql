-- Stage 7 experiment rules, canonical result identity, KST dates, and completion.
-- Review first. Never run automatically or directly against production.
-- Prerequisites: 001-005, then re-run register-study-data.mjs so every catalog
-- row has the source-backed identity columns introduced in the revised 001.
begin;

create or replace function private.study_date_kst(p_at timestamptz default now())
returns date language sql stable security definer set search_path = '' as $$
  select (p_at at time zone 'Asia/Seoul')::date
$$;
create or replace function private.study_day_start_kst(p_day date)
returns timestamptz language sql immutable security definer set search_path = '' as $$
  select p_day::timestamp at time zone 'Asia/Seoul'
$$;
revoke all on function private.study_date_kst(timestamptz) from public,anon,authenticated;
revoke all on function private.study_day_start_kst(date) from public,anon,authenticated;

alter table public.study_participants add column if not exists experiment_round integer not null default 1;
alter table public.study_participants drop constraint if exists study_participants_experiment_round_check;
alter table public.study_participants add constraint study_participants_experiment_round_check check (experiment_round > 0);

alter table public.study_sessions add column if not exists experiment_round integer not null default 1;
alter table public.study_sessions add column if not exists completion_operation_key uuid;
alter table public.study_sessions add column if not exists completion_annotation_id uuid;
alter table public.study_sessions drop constraint if exists study_sessions_completion_annotation_fk;
alter table public.study_sessions add constraint study_sessions_completion_annotation_fk
  foreign key (completion_annotation_id) references public.annotations(id);

alter table public.annotations add column if not exists experiment_round integer;
alter table public.annotations add column if not exists canonical_audio_id text;
alter table public.votes add column if not exists experiment_round integer;
alter table public.votes add column if not exists canonical_audio_id text;

do $$
begin
  if exists (
    select 1 from public.study_sound_catalog
    where nullif(canonical_audio_id,'') is null or nullif(file_path,'') is null
      or nullif(source_dataset,'') is null or nullif(original_filename,'') is null
  ) then
    raise exception 'PREFLIGHT_REQUIRED: catalog canonical mapping is incomplete; rerun register-study-data.mjs after revised 001';
  end if;
  if exists (
    select canonical_audio_id from public.study_sound_catalog
    group by canonical_audio_id
    having count(distinct file_path) > 1
       or count(distinct source_dataset || ':' || original_filename) > 1
       or count(distinct zone) > 1
       or count(distinct coalesce(group_id,'*')) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: one canonical_audio_id has ambiguous source or assignment mapping';
  end if;
  if exists (
    select source_dataset,original_filename from public.study_sound_catalog
    group by source_dataset,original_filename having count(distinct canonical_audio_id)>1
  ) or exists (
    select file_path from public.study_sound_catalog
    group by file_path having count(distinct canonical_audio_id)>1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: one source file maps to multiple canonical_audio_id values';
  end if;
  if exists (
    select 1 from public.annotations a
    left join public.study_sound_catalog c on c.sound_id=a.sound_id
    where c.sound_id is null
  ) or exists (
    select 1 from public.votes v
    left join public.study_sound_catalog c on c.sound_id=v.sound_id
    where c.sound_id is null
  ) then
    raise exception 'PREFLIGHT_REQUIRED: result rows contain sound IDs absent from study_sound_catalog';
  end if;
  if exists (
    select a.participant_id,c.canonical_audio_id
    from public.annotations a join public.study_sound_catalog c on c.sound_id=a.sound_id
    where not coalesce(a.is_skipped,false)
    group by a.participant_id,c.canonical_audio_id
    having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: duplicate normal annotations would violate canonical uniqueness';
  end if;
  if exists (
    select v.participant_id,c.canonical_audio_id
    from public.votes v join public.study_sound_catalog c on c.sound_id=v.sound_id
    group by v.participant_id,c.canonical_audio_id
    having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: duplicate votes would violate canonical uniqueness';
  end if;
  if exists (
    select participant_id,coalesce(experiment_round,1) from public.study_sessions
    where status='active' group by participant_id,coalesce(experiment_round,1) having count(*) > 1
  ) then
    raise exception 'PREFLIGHT_REQUIRED: multiple active study sessions exist for one participant round';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='annotations'
      and column_name in ('difficulty','selected_features') and is_nullable='NO'
  ) then
    raise exception 'PREFLIGHT_REQUIRED: annotations difficulty/selected_features must allow NULL before unmeasured values can be stored safely';
  end if;
  if exists (
    select 1 from public.study_sessions s
    where s.status='completed'
  ) then
    raise exception 'PREFLIGHT_REQUIRED: legacy completed sessions need explicit reconciliation before completion links can be enforced';
  end if;
  if exists (
    select 1 from public.study_sessions s
    join public.study_participants p on p.participant_id=s.participant_id
    where s.status='active' and s.experiment_round=p.experiment_round
      and not exists (
        select c.canonical_audio_id from public.study_sound_catalog c
        where c.group_id is null or c.group_id=p.group_id or p.access_scope='all'
        except
        select c2.canonical_audio_id from public.annotations a
        join public.study_sound_catalog c2 on c2.sound_id=a.sound_id
        where a.participant_id=p.participant_id and not coalesce(a.is_skipped,false)
      )
  ) then
    raise exception 'PREFLIGHT_REQUIRED: an active session already has every assigned annotation and needs explicit completion reconciliation';
  end if;
end $$;

update public.annotations a set
  canonical_audio_id=c.canonical_audio_id,
  experiment_round=coalesce(a.experiment_round,1)
from public.study_sound_catalog c where c.sound_id=a.sound_id
  and (a.canonical_audio_id is null or a.experiment_round is null);
update public.votes v set
  canonical_audio_id=c.canonical_audio_id,
  experiment_round=coalesce(v.experiment_round,1)
from public.study_sound_catalog c where c.sound_id=v.sound_id
  and (v.canonical_audio_id is null or v.experiment_round is null);

alter table public.study_sound_catalog alter column canonical_audio_id set not null;
alter table public.study_sound_catalog alter column file_path set not null;
alter table public.study_sound_catalog alter column source_dataset set not null;
alter table public.study_sound_catalog alter column original_filename set not null;
alter table public.annotations alter column canonical_audio_id set not null;
alter table public.annotations alter column experiment_round set not null;
alter table public.annotations alter column experiment_round set default 1;
alter table public.votes alter column canonical_audio_id set not null;
alter table public.votes alter column experiment_round set not null;
alter table public.votes alter column experiment_round set default 1;

create index if not exists study_sound_catalog_canonical_idx
  on public.study_sound_catalog(canonical_audio_id);
create unique index if not exists annotations_one_normal_result_per_audio_round_uq
  on public.annotations(participant_id,experiment_round,canonical_audio_id)
  where not is_skipped;
create unique index if not exists votes_one_result_per_audio_round_uq
  on public.votes(participant_id,experiment_round,canonical_audio_id);
create unique index if not exists study_sessions_one_active_round_uq
  on public.study_sessions(participant_id,experiment_round) where status='active';

create or replace function private.experiment_progress_v1(p_participant public.study_participants)
returns jsonb language sql stable security definer set search_path = '' as $$
  with assigned as (
    select distinct c.canonical_audio_id,c.zone
    from public.study_sound_catalog c
    where c.group_id is null or c.group_id=p_participant.group_id or p_participant.access_scope='all'
  ), completed as (
    select distinct a.canonical_audio_id
    from public.annotations a
    where a.participant_id=p_participant.participant_id
      and a.experiment_round=p_participant.experiment_round and not a.is_skipped
  ), zone_counts as (
    select x.zone,jsonb_build_object(
      'completed',count(*) filter(where d.canonical_audio_id is not null),
      'assigned',count(*)
    ) value
    from assigned x left join completed d using(canonical_audio_id) group by x.zone
  ), totals as (
    select count(*) assigned_count,count(*) filter(where d.canonical_audio_id is not null) completed_count
    from assigned x left join completed d using(canonical_audio_id)
  )
  select jsonb_build_object(
    'experimentRound',p_participant.experiment_round,
    'assignedCount',t.assigned_count,
    'completedCount',t.completed_count,
    'isComplete',t.assigned_count>0 and t.assigned_count=t.completed_count,
    'completedCanonicalAudioIds',coalesce((select jsonb_agg(canonical_audio_id order by canonical_audio_id) from completed),'[]'::jsonb),
    'zoneCounts',coalesce((select jsonb_object_agg(zone,value) from zone_counts),'{}'::jsonb)
  ) from totals t
$$;
revoke all on function private.experiment_progress_v1(public.study_participants) from public,anon,authenticated;

create or replace function public.get_my_experiment_progress_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_progress jsonb; v_status text;
begin
  v_participant:=private.require_current_participant();
  v_progress:=private.experiment_progress_v1(v_participant);
  select status into v_status from public.study_sessions
    where participant_id=v_participant.participant_id and experiment_round=v_participant.experiment_round
    order by case status when 'active' then 0 when 'completed' then 1 else 2 end,started_at desc limit 1;
  return v_progress || jsonb_build_object('sessionStatus',v_status);
end $$;

create or replace function public.get_my_completed_audio_v1(p_zone text default null)
returns table(canonical_audio_id text) language sql stable security definer set search_path = '' as $$
  select distinct a.canonical_audio_id from public.annotations a
  join public.study_participants p on p.participant_id=a.participant_id
  where p.auth_user_id=auth.uid() and p.status='active'
    and a.experiment_round=p.experiment_round and not a.is_skipped
    and (p_zone is null or a.zone=p_zone)
$$;

create or replace function public.start_or_resume_study_session_v2(
  p_resume_session_id uuid default null,p_client_instance_id uuid default null,
  p_initial_screen text default 'world',p_experiment_version text default null,
  p_user_agent text default null,p_viewport_width integer default null,
  p_viewport_height integer default null,p_locale text default null,p_timezone text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_session public.study_sessions%rowtype;
  v_resumed boolean:=false; v_collection boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_participant from public.study_participants
    where auth_user_id=auth.uid() and status='active' for update;
  if not found then raise exception 'PARTICIPANT_SESSION_REQUIRED'; end if;
  if p_client_instance_id is null then raise exception 'INVALID_CLIENT_INSTANCE'; end if;
  v_collection:=coalesce((select collection_enabled from private.user_event_settings where singleton),false);

  if p_resume_session_id is not null then
    select * into v_session from public.study_sessions where id=p_resume_session_id
      and auth_user_id=auth.uid() and participant_id=v_participant.participant_id
      and experiment_round=v_participant.experiment_round and status in ('active','completed') for update;
  end if;
  if v_session.id is null then
    select * into v_session from public.study_sessions where auth_user_id=auth.uid()
      and participant_id=v_participant.participant_id and experiment_round=v_participant.experiment_round
      and status='active' order by started_at desc limit 1 for update;
  end if;
  if v_session.id is null then
    select * into v_session from public.study_sessions where auth_user_id=auth.uid()
      and participant_id=v_participant.participant_id and experiment_round=v_participant.experiment_round
      and status='completed' order by completed_at desc limit 1;
  end if;
  if v_session.id is not null then
    v_resumed:=true;
    update public.study_sessions set last_activity_at=now() where id=v_session.id returning * into v_session;
  else
    insert into public.study_sessions(auth_user_id,participant_id,group_id,experiment_round,experiment_version,initial_screen,
      user_agent,viewport_width,viewport_height,locale,timezone)
    values(auth.uid(),v_participant.participant_id,v_participant.group_id,v_participant.experiment_round,left(p_experiment_version,64),
      left(p_initial_screen,64),left(p_user_agent,512),p_viewport_width,p_viewport_height,left(p_locale,32),left(p_timezone,64))
    returning * into v_session;
  end if;
  return jsonb_build_object('collectionEnabled',v_collection,'studySessionId',v_session.id,
    'participantId',v_session.participant_id,'groupId',v_session.group_id,'experimentRound',v_session.experiment_round,
    'status',v_session.status,'resumed',v_resumed,'startedAt',v_session.started_at,'completedAt',v_session.completed_at);
end $$;

-- Kept for the logger's final flush handshake. Stage 7 completion itself occurs
-- only inside submit_annotation_v4; this RPC can no longer complete work early.
create or replace function public.complete_study_session_v1(
  p_study_session_id uuid,p_completion_reason text default 'completed'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.study_sessions%rowtype;
begin
  select * into v_session from public.study_sessions
  where id=p_study_session_id and auth_user_id=auth.uid() and status='completed';
  if not found then raise exception 'EXPERIMENT_NOT_COMPLETED'; end if;
  return jsonb_build_object('studySessionId',v_session.id,'status',v_session.status,
    'completedAt',v_session.completed_at,'completionReason',v_session.completion_reason,
    'completionAnnotationId',v_session.completion_annotation_id,
    'completionOperationKey',v_session.completion_operation_key);
end $$;

create or replace function private.ensure_today_quests_v4(p_pid text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date:=private.study_date_kst(); v_category text;
begin
  select c.sub_category into v_category from public.study_sound_catalog c
  left join public.annotations a on a.participant_id=p_pid and a.canonical_audio_id=c.canonical_audio_id and not a.is_skipped
  where c.sub_category is not null group by c.sub_category order by count(distinct a.canonical_audio_id),c.sub_category limit 1;
  insert into public.participant_daily_quests(participant_id,quest_template_id,assigned_date,target_sub_category)
    select p_pid,t.id,v_today,case when t.type='category_participate' then v_category end
    from public.daily_quest_templates t where t.active
    on conflict(participant_id,quest_template_id,assigned_date) do nothing;
end $$;

create or replace function private.refresh_today_quests_v4(p_pid text,p_zone text,p_sub_category text,p_operation_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_today date:=private.study_date_kst(); v_start timestamptz:=private.study_day_start_kst(v_today);
  v_end timestamptz:=private.study_day_start_kst(v_today+1); v_annotations integer; v_votes integer; v_zone_count integer;
  q record; v_progress integer; v_reward jsonb; v_completed jsonb:='[]'::jsonb;
begin
  perform private.ensure_today_quests_v4(p_pid);
  select count(distinct canonical_audio_id) into v_annotations from public.annotations
    where participant_id=p_pid and not is_skipped and created_at>=v_start and created_at<v_end;
  select count(distinct canonical_audio_id) into v_votes from public.votes
    where participant_id=p_pid and created_at>=v_start and created_at<v_end;
  select count(distinct canonical_audio_id) into v_zone_count from public.annotations
    where participant_id=p_pid and zone=p_zone and not is_skipped and created_at>=v_start and created_at<v_end;
  for q in select pq.id,pq.target_sub_category,t.type,t.target_count,t.reward_currency
    from public.participant_daily_quests pq join public.daily_quest_templates t on t.id=pq.quest_template_id
    where pq.participant_id=p_pid and pq.assigned_date=v_today and not pq.completed for update of pq
  loop
    v_progress:=case q.type when 'collect_milestone' then v_annotations when 'vote_n_times' then v_votes
      when 'visit_zone' then case when v_zone_count>0 then q.target_count else 0 end
      when 'category_participate' then case when p_sub_category=q.target_sub_category then q.target_count else 0 end else 0 end;
    update public.participant_daily_quests set progress_count=v_progress,
      completed=(v_progress>=q.target_count),completed_at=case when v_progress>=q.target_count then now() else completed_at end
      where id=q.id and not completed;
    if found and v_progress>=q.target_count then
      v_reward:=private.credit_currency_v3(p_pid,'earn_quest',q.reward_currency,q.id::text,p_operation_key);
      v_completed:=v_completed||jsonb_build_array(jsonb_build_object('questId',q.id,'reward',v_reward));
    end if;
  end loop;
  return jsonb_build_object('completed',v_completed);
end $$;
revoke all on function private.ensure_today_quests_v4(text) from public,anon,authenticated;
revoke all on function private.refresh_today_quests_v4(text,text,text,uuid) from public,anon,authenticated;

create or replace function public.ensure_today_quests(p_known_sub_categories text[] default array[]::text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_today date:=private.study_date_kst();
begin
  v_participant:=private.require_current_participant();
  perform private.ensure_today_quests_v4(v_participant.participant_id);
  return (select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('template',to_jsonb(t))
    order by t.type,t.tier_index nulls last),'[]'::jsonb)
    from public.participant_daily_quests q join public.daily_quest_templates t on t.id=q.quest_template_id
    where q.participant_id=v_participant.participant_id and q.assigned_date=v_today);
end $$;

create or replace function public.get_attendance_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'templates',coalesce((select jsonb_agg(to_jsonb(t) order by t.day_index) from public.attendance_reward_templates t),'[]'::jsonb),
    'today',(select to_jsonb(a) from public.participant_attendance a
      where a.participant_id=private.current_participant_id() and a.check_in_date=private.study_date_kst())
  ) where private.current_participant_id() is not null
$$;

create or replace function public.ensure_today_check_in_v4(p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_existing jsonb; v_today date:=private.study_date_kst();
  v_last public.participant_attendance%rowtype; v_row public.participant_attendance%rowtype;
  v_day integer; v_reward integer; v_currency jsonb; v_new boolean:=false; v_result jsonb;
  v_type text:='attendance_claim:'||v_today::text;
begin
  v_participant:=private.require_current_participant();
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),v_type,p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
    and operation_type=v_type and idempotency_key=p_idempotency_key; return v_existing; end if;
  select * into v_row from public.participant_attendance where participant_id=v_participant.participant_id and check_in_date=v_today for update;
  if not found then
    select * into v_last from public.participant_attendance where participant_id=v_participant.participant_id order by check_in_date desc limit 1;
    v_day:=case when v_last.check_in_date=v_today-1 then (v_last.streak_day%7)+1 else 1 end;
    select reward_currency into v_reward from public.attendance_reward_templates where day_index=v_day;
    insert into public.participant_attendance(participant_id,check_in_date,streak_day,reward_currency)
      values(v_participant.participant_id,v_today,v_day,v_reward) on conflict(participant_id,check_in_date) do nothing returning * into v_row;
    if found then v_new:=true; v_currency:=private.credit_currency_v3(v_participant.participant_id,'earn_attendance',v_reward,v_row.id::text,p_idempotency_key);
    else select * into v_row from public.participant_attendance where participant_id=v_participant.participant_id and check_in_date=v_today; end if;
  end if;
  v_result:=jsonb_build_object('row',to_jsonb(v_row),'isNew',v_new,'reward',coalesce(v_currency,'{"awarded":0}'::jsonb));
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now() where auth_user_id=auth.uid()
    and operation_type=v_type and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.submit_annotation_v4(
  p_idempotency_key uuid,p_sound_id text,p_zone text,p_expression_text text default '',
  p_selected_features jsonb default null,p_confidence integer default null,p_difficulty integer default null,
  p_play_count integer default 0,p_listening_time_sec numeric default 0,p_is_skipped boolean default false,
  p_skip_reason text default '',p_device_info text default '',p_stage integer default 1,p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_catalog public.study_sound_catalog%rowtype;
  v_session public.study_sessions%rowtype; v_type text; v_existing jsonb; v_annotation_id public.annotations.id%type;
  v_inserted boolean:=false; v_reward jsonb; v_quests jsonb; v_progress jsonb; v_result jsonb; v_category_count integer;
begin
  v_participant:=private.require_current_participant();
  v_type:=case when p_is_skipped then 'annotation_skip' else 'annotation_submit' end;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),v_type,p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
      and operation_type=v_type and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  select * into v_catalog from public.study_sound_catalog where sound_id=p_sound_id;
  if not found or v_catalog.zone<>p_zone or not (v_catalog.group_id is null or v_catalog.group_id=v_participant.group_id or v_participant.access_scope='all')
    then raise exception 'INVALID_SOUND'; end if;
  if p_stage<>1 or p_selected_features is not null or p_difficulty is not null then raise exception 'INVALID_ANNOTATION'; end if;
  if not p_is_skipped and nullif(btrim(p_expression_text),'') is null then raise exception 'INVALID_ANNOTATION'; end if;
  select * into v_session from public.study_sessions where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and status in ('active','completed')
    order by case status when 'active' then 0 else 1 end,started_at desc limit 1 for update;
  if not found then raise exception 'STUDY_SESSION_REQUIRED'; end if;

  if v_session.status='completed' then
    if p_is_skipped then raise exception 'EXPERIMENT_COMPLETED'; end if;
    select id into v_annotation_id from public.annotations where participant_id=v_participant.participant_id
      and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id and not is_skipped;
    if v_annotation_id is null then raise exception 'EXPERIMENT_COMPLETED'; end if;
  else
    insert into public.annotations(participant_id,session_id,experiment_round,canonical_audio_id,sound_id,zone,source_type,sub_category,audioset_class,
      expression_text,selected_features,confidence,difficulty,play_count,listening_time_sec,is_skipped,skip_reason,device_info,stage,is_verified,vote_count,version)
    values(v_participant.participant_id,v_participant.group_id,v_participant.experiment_round,v_catalog.canonical_audio_id,p_sound_id,v_catalog.zone,
      v_catalog.source_type,v_catalog.sub_category,v_catalog.audioset_class,case when p_is_skipped then '' else btrim(p_expression_text) end,
      null,p_confidence,null,p_play_count,p_listening_time_sec,p_is_skipped,p_skip_reason,p_device_info,1,false,0,p_version)
    on conflict(participant_id,experiment_round,canonical_audio_id) where not is_skipped do nothing returning id into v_annotation_id;
    v_inserted:=v_annotation_id is not null;
    if not v_inserted and not p_is_skipped then
      select id into v_annotation_id from public.annotations where participant_id=v_participant.participant_id
        and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id and not is_skipped;
    end if;
  end if;
  if v_annotation_id is null then raise exception 'ANNOTATION_CONFLICT'; end if;

  if p_is_skipped or not v_inserted then
    v_reward:=jsonb_build_object('awarded',0); v_quests:=jsonb_build_object('completed','[]'::jsonb);
  else
    select count(distinct canonical_audio_id) into v_category_count from public.annotations
      where participant_id=v_participant.participant_id and sub_category=v_catalog.sub_category and not is_skipped;
    v_reward:=private.credit_currency_v3(v_participant.participant_id,'earn_annotation',5,v_catalog.canonical_audio_id,
      p_idempotency_key,p_listening_time_sec,v_catalog.sub_category,v_category_count,p_confidence);
    v_quests:=private.refresh_today_quests_v4(v_participant.participant_id,v_catalog.zone,v_catalog.sub_category,p_idempotency_key);
  end if;
  v_progress:=private.experiment_progress_v1(v_participant);
  if coalesce((v_progress->>'isComplete')::boolean,false) and v_session.status='active' then
    update public.study_sessions set status='completed',completed_at=now(),last_activity_at=now(),
      completion_reason='all_assigned_annotations_completed',completion_operation_key=p_idempotency_key,
      completion_annotation_id=v_annotation_id where id=v_session.id;
  end if;
  v_result:=jsonb_build_object('annotationId',v_annotation_id,'canonicalAudioId',v_catalog.canonical_audio_id,
    'reward',v_reward,'quests',v_quests,'skipped',p_is_skipped,'alreadyCompleted',not v_inserted,'progress',v_progress);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=auth.uid() and operation_type=v_type and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function private.is_vote_target_allowed_v2(p_annotation_id uuid,p_canonical_audio_id text,p_voter public.study_participants)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.annotations a join public.study_participants author on author.participant_id=a.participant_id
    where a.id=p_annotation_id and a.canonical_audio_id=p_canonical_audio_id and not a.is_skipped
      and nullif(a.expression_text,'') is not null and a.participant_id<>p_voter.participant_id
      and (p_voter.access_scope='all' or author.group_id<>p_voter.group_id))
$$;
revoke all on function private.is_vote_target_allowed_v2(uuid,text,public.study_participants) from public,anon,authenticated;

create or replace function public.submit_museum_vote_v4(
  p_idempotency_key uuid,p_sound_id text,p_zone text,p_annotation_id uuid,p_confidence integer default 3,
  p_play_count integer default 0,p_listening_time_sec numeric default 0,p_stage integer default 2,p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_catalog public.study_sound_catalog%rowtype;
  v_session public.study_sessions%rowtype; v_existing jsonb; v_vote_id public.votes.id%type;
  v_inserted boolean:=false; v_reward jsonb; v_quests jsonb; v_result jsonb;
begin
  v_participant:=private.require_current_participant();
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),'museum_vote',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
      and operation_type='museum_vote' and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  select * into v_session from public.study_sessions where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and status='active'
    order by started_at desc limit 1 for update;
  if not found then raise exception 'EXPERIMENT_COMPLETED'; end if;
  if p_stage<>2 or p_play_count<1 then raise exception 'AUDIO_PLAY_REQUIRED'; end if;
  select * into v_catalog from public.study_sound_catalog where sound_id=p_sound_id and zone=p_zone;
  if not found or not private.is_vote_target_allowed_v2(p_annotation_id,v_catalog.canonical_audio_id,v_participant)
    then raise exception 'INVALID_SOUND'; end if;
  insert into public.votes(participant_id,session_id,experiment_round,canonical_audio_id,sound_id,zone,annotation_id,confidence,
    play_count,listening_time_sec,stage,version)
  values(v_participant.participant_id,v_participant.group_id,v_participant.experiment_round,v_catalog.canonical_audio_id,p_sound_id,
    v_catalog.zone,p_annotation_id,p_confidence,p_play_count,p_listening_time_sec,2,p_version)
  on conflict(participant_id,experiment_round,canonical_audio_id) do nothing returning id into v_vote_id;
  v_inserted:=v_vote_id is not null;
  if not v_inserted then select id into v_vote_id from public.votes where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id; end if;
  if v_vote_id is null then raise exception 'VOTE_CONFLICT'; end if;
  if v_inserted then
    v_reward:=private.credit_currency_v3(v_participant.participant_id,'earn_vote',2,p_annotation_id::text,p_idempotency_key,
      p_listening_time_sec,null,null,p_confidence);
    v_quests:=private.refresh_today_quests_v4(v_participant.participant_id,p_zone,null,p_idempotency_key);
  else
    v_reward:=jsonb_build_object('awarded',0); v_quests:=jsonb_build_object('completed','[]'::jsonb);
  end if;
  v_result:=jsonb_build_object('voteId',v_vote_id,'canonicalAudioId',v_catalog.canonical_audio_id,'reward',v_reward,
    'quests',v_quests,'alreadyCompleted',not v_inserted);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=auth.uid() and operation_type='museum_vote' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.museum_candidate_expressions_v2(p_sound_id text,p_exclude_expression text default null,p_limit integer default 5)
returns table(id uuid,expression_text text,confidence integer,vote_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_canonical text;
begin
  v_participant:=private.require_current_participant();
  select canonical_audio_id into v_canonical from public.study_sound_catalog where sound_id=p_sound_id;
  if v_canonical is null then raise exception 'INVALID_SOUND'; end if;
  return query select a.id,a.expression_text,a.confidence,coalesce(a.vote_count,0)
    from public.annotations a join public.study_participants author on author.participant_id=a.participant_id
    where a.canonical_audio_id=v_canonical and not a.is_skipped and a.participant_id<>v_participant.participant_id
      and (v_participant.access_scope='all' or author.group_id<>v_participant.group_id)
      and nullif(a.expression_text,'') is not null
      and (p_exclude_expression is null or a.expression_text<>p_exclude_expression)
    order by random() limit least(greatest(p_limit,1),10);
end $$;

create or replace function public.museum_annotation_counts_v2()
returns table(canonical_audio_id text,annotation_count bigint)
language sql stable security definer set search_path = '' as $$
  select a.canonical_audio_id,count(*)::bigint from public.annotations a
  where private.current_participant_id() is not null and not a.is_skipped and nullif(a.expression_text,'') is not null
  group by a.canonical_audio_id
$$;

create or replace function public.museum_voted_audio_ids_v1()
returns table(canonical_audio_id text) language sql stable security definer set search_path = '' as $$
  select distinct v.canonical_audio_id from public.votes v join public.study_participants p on p.participant_id=v.participant_id
  where p.auth_user_id=auth.uid() and p.status='active' and v.experiment_round=p.experiment_round
$$;

revoke all on function public.get_my_experiment_progress_v1() from public,anon;
revoke all on function public.get_my_completed_audio_v1(text) from public,anon;
revoke all on function public.start_or_resume_study_session_v2(uuid,uuid,text,text,text,integer,integer,text,text) from public,anon;
revoke all on function public.complete_study_session_v1(uuid,text) from public,anon;
revoke all on function public.ensure_today_quests(text[]) from public,anon;
revoke all on function public.get_attendance_status() from public,anon;
revoke all on function public.ensure_today_check_in_v4(uuid) from public,anon;
revoke all on function public.submit_annotation_v4(uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) from public,anon;
revoke all on function public.submit_museum_vote_v4(uuid,text,text,uuid,integer,integer,numeric,integer,text) from public,anon;
revoke all on function public.museum_candidate_expressions_v2(text,text,integer) from public,anon;
revoke all on function public.museum_annotation_counts_v2() from public,anon;
revoke all on function public.museum_voted_audio_ids_v1() from public,anon;
grant execute on function public.get_my_experiment_progress_v1() to authenticated;
grant execute on function public.get_my_completed_audio_v1(text) to authenticated;
grant execute on function public.start_or_resume_study_session_v2(uuid,uuid,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.complete_study_session_v1(uuid,text) to authenticated;
grant execute on function public.ensure_today_quests(text[]) to authenticated;
grant execute on function public.get_attendance_status() to authenticated;
grant execute on function public.ensure_today_check_in_v4(uuid) to authenticated;
grant execute on function public.submit_annotation_v4(uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) to authenticated;
grant execute on function public.submit_museum_vote_v4(uuid,text,text,uuid,integer,integer,numeric,integer,text) to authenticated;
grant execute on function public.museum_candidate_expressions_v2(text,text,integer) to authenticated;
grant execute on function public.museum_annotation_counts_v2() to authenticated;
grant execute on function public.museum_voted_audio_ids_v1() to authenticated;

revoke execute on function public.submit_annotation_v3(uuid,text,text,text,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) from authenticated;
revoke execute on function public.submit_museum_vote_v3(uuid,text,text,uuid,integer,integer,numeric,integer,text) from authenticated;
revoke execute on function public.ensure_today_check_in_v3(uuid) from authenticated;
revoke execute on function public.start_or_resume_study_session_v1(uuid,uuid,text,text,text,integer,integer,text,text) from authenticated;

commit;
