-- Append-only study session and semantic user-event logging.
-- Review first. Do not run this file against production automatically.
begin;

create table if not exists private.user_event_settings (
  singleton boolean primary key default true check (singleton),
  collection_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into private.user_event_settings(singleton, collection_enabled)
values (true, true) on conflict (singleton) do nothing;

create table if not exists private.user_event_researchers (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.user_event_settings, private.user_event_researchers from public, anon, authenticated;

create or replace function private.is_user_event_researcher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.user_event_researchers r where r.auth_user_id = auth.uid())
$$;
revoke all on function private.is_user_event_researcher() from public, anon, authenticated;
grant execute on function private.is_user_event_researcher() to authenticated;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  participant_id text not null references public.study_participants(participant_id) on delete restrict,
  group_id text not null check (group_id in ('A', 'B')),
  experiment_version text,
  status text not null default 'active' check (status in ('active','completed','abandoned','invalidated')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  completion_reason text,
  initial_screen text,
  user_agent text,
  viewport_width integer check (viewport_width between 0 and 20000),
  viewport_height integer check (viewport_height between 0 and 20000),
  locale text,
  timezone text,
  created_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table if not exists public.user_event_names (
  event_name text primary key check (event_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  description text not null default '',
  active boolean not null default true
);

insert into public.user_event_names(event_name) values
('session_started'),('session_resumed'),('session_completed'),('screen_viewed'),('screen_exited'),
('zone_entered'),('zone_exited'),('navigation_attempted'),('navigation_succeeded'),('navigation_failed'),
('network_offline'),('network_online'),('unexpected_error'),('map_control_activated'),
('zone_entry_attempted'),('zone_entry_blocked'),('zone_entry_succeeded'),('collectible_approached'),
('collectible_prompt_shown'),('collectible_activated'),('annotation_modal_opened'),
('annotation_modal_closed'),('audio_play_attempted'),('audio_play_started'),('audio_paused'),
('audio_resumed'),('audio_completed'),('audio_failed'),('expression_input_started'),
('expression_input_changed'),('expression_input_cleared'),('confidence_selected'),('confidence_changed'),
('confidence_deselected'),('annotation_submit_attempted'),('annotation_submit_succeeded'),
('annotation_submit_failed'),('annotation_skip_attempted'),('annotation_skip_succeeded'),
('annotation_skip_failed'),('museum_entered'),('museum_exited'),('museum_candidate_load_attempted'),
('museum_candidate_loaded'),('museum_candidate_empty'),('museum_candidate_load_failed'),
('museum_expression_impression'),('museum_expression_selected'),('museum_expression_deselected'),
('museum_expression_changed'),('museum_audio_play_attempted'),('museum_audio_play_started'),
('museum_audio_failed'),('museum_vote_submit_attempted'),('museum_vote_submit_succeeded'),
('museum_vote_submit_failed'),('museum_next_candidate'),('attendance_check_attempted'),
('attendance_check_succeeded'),('attendance_check_failed'),('attendance_panel_opened'),('attendance_panel_closed'),
('quest_panel_opened'),('quest_panel_closed'),('quest_row_impression'),('library_card_opened'),('library_card_closed'),
('quest_completed'),('reward_applied'),('currency_balance_viewed'),('shop_opened'),('shop_closed'),
('shop_item_viewed'),('purchase_attempted'),('purchase_succeeded'),('purchase_failed'),
('outfit_equip_attempted'),('outfit_equip_succeeded'),('outfit_equip_failed'),('interior_entered'),
('interior_exited'),('interior_item_selected'),('interior_item_deselected'),('interior_item_added'),
('interior_item_moved'),('interior_item_rotated'),('interior_item_removed'),('interior_change_undone'),
('room_save_attempted'),('room_save_succeeded'),('room_save_failed'),('friend_room_open_attempted'),
('friend_room_open_succeeded'),('friend_room_open_failed'),('duo_connect_attempted'),('duo_connected'),
('duo_disconnected'),('duo_reconnected'),('invite_link_copy_succeeded'),('invite_link_copy_failed')
on conflict (event_name) do nothing;

create table if not exists public.user_events (
  id uuid primary key,
  study_session_id uuid not null references public.study_sessions(id) on delete restrict,
  client_instance_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  participant_id text not null references public.study_participants(participant_id) on delete restrict,
  group_id text not null check (group_id in ('A','B')),
  sequence_no bigint not null check (sequence_no > 0),
  event_name text not null references public.user_event_names(event_name) on update cascade,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  screen text,
  zone text,
  sound_id text,
  target_type text,
  target_id text,
  interaction_method text check (interaction_method in ('mouse','touch','keyboard','programmatic')),
  value_before jsonb,
  value_after jsonb,
  outcome text,
  close_reason text check (close_reason in ('submitted','skipped','close_button','escape','backdrop','navigation','component_unmounted','unknown')),
  duration_ms integer check (duration_ms between 0 and 86400000),
  operation_type text,
  operation_idempotency_key uuid,
  result_entity_type text,
  result_entity_id text,
  error_code text,
  metadata jsonb,
  app_version text,
  created_at timestamptz not null default now(),
  unique(study_session_id, client_instance_id, sequence_no),
  check (value_before is null or jsonb_typeof(value_before) = 'object'),
  check (value_after is null or jsonb_typeof(value_after) = 'object'),
  check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create index if not exists study_sessions_participant_started_idx
  on public.study_sessions(participant_id, started_at desc);
create index if not exists study_sessions_activity_idx
  on public.study_sessions(status, last_activity_at);
create index if not exists user_events_timeline_idx
  on public.user_events(study_session_id, occurred_at, client_instance_id, sequence_no);
create index if not exists user_events_participant_name_idx
  on public.user_events(participant_id, event_name, occurred_at);
create index if not exists user_events_operation_idx
  on public.user_events(operation_type, operation_idempotency_key)
  where operation_idempotency_key is not null;

alter table public.study_sessions enable row level security;
alter table public.user_events enable row level security;
alter table public.user_event_names enable row level security;
revoke all on public.study_sessions, public.user_events, public.user_event_names from public, anon, authenticated;

-- Only explicitly registered researchers may use authenticated SELECT. Participants
-- have no matching policy and event writes are RPC-only. Service role bypasses RLS.
create policy study_sessions_researcher_select on public.study_sessions for select to authenticated
  using (private.is_user_event_researcher());
create policy user_events_researcher_select on public.user_events for select to authenticated
  using (private.is_user_event_researcher());
create policy user_event_names_authenticated_read on public.user_event_names for select to authenticated using (true);
grant select on public.study_sessions, public.user_events, public.user_event_names to authenticated;

create or replace function public.start_or_resume_study_session_v1(
  p_resume_session_id uuid default null,
  p_client_instance_id uuid default null,
  p_initial_screen text default 'world',
  p_experiment_version text default null,
  p_user_agent text default null,
  p_viewport_width integer default null,
  p_viewport_height integer default null,
  p_locale text default null,
  p_timezone text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_session public.study_sessions%rowtype; v_resumed boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_participant from public.study_participants
    where auth_user_id = auth.uid() and status = 'active';
  if not found then raise exception 'PARTICIPANT_SESSION_REQUIRED'; end if;
  if p_client_instance_id is null then raise exception 'INVALID_CLIENT_INSTANCE'; end if;
  if not coalesce((select collection_enabled from private.user_event_settings where singleton), false) then
    return jsonb_build_object('collectionEnabled', false);
  end if;
  if p_resume_session_id is not null then
    select * into v_session from public.study_sessions
      where id = p_resume_session_id and auth_user_id = auth.uid() and participant_id = v_participant.participant_id
        and status = 'active' for update;
    if found then
      v_resumed := true;
      update public.study_sessions set last_activity_at = now() where id = v_session.id returning * into v_session;
    end if;
  end if;
  if v_session.id is null then
    insert into public.study_sessions(auth_user_id,participant_id,group_id,experiment_version,initial_screen,user_agent,
      viewport_width,viewport_height,locale,timezone)
    values(auth.uid(),v_participant.participant_id,v_participant.group_id,left(p_experiment_version,64),left(p_initial_screen,64),
      left(p_user_agent,512),p_viewport_width,p_viewport_height,left(p_locale,32),left(p_timezone,64)) returning * into v_session;
  end if;
  return jsonb_build_object('collectionEnabled',true,'studySessionId',v_session.id,'participantId',v_session.participant_id,
    'groupId',v_session.group_id,'status',v_session.status,'resumed',v_resumed,'startedAt',v_session.started_at);
end $$;

create or replace function public.record_user_events_v1(p_study_session_id uuid, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.study_sessions%rowtype; v_event jsonb; v_inserted integer := 0; v_duplicates integer := 0;
  v_received timestamptz := now(); v_occurred timestamptz; v_id uuid; v_client uuid; v_sequence bigint; v_name text;
  v_allowed_keys constant text[] := array['id','client_instance_id','sequence_no','event_name','occurred_at','screen','zone','sound_id',
    'target_type','target_id','interaction_method','value_before','value_after','outcome','close_reason','duration_ms','operation_type',
    'operation_idempotency_key','result_entity_type','result_entity_id','error_code','metadata','app_version'];
  v_metadata_allowed_keys constant text[] := array['retryable','candidate_index','candidate_count','locked','blocked_reason',
    'price_displayed','price_confirmed','balance','reward_amount','quest_ids','is_new','item_type','position','previous_position',
    'input_empty','previous_empty','source','reason','attempt_number','visibility_state','queue_size','offline','modal_instance_id',
    'transaction_id','play_count'];
  v_value_allowed_keys constant text[] := array['length','empty','confidence','candidate_index','flipped'];
  v_position_allowed_keys constant text[] := array['layer','col','row','x','y'];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce((select collection_enabled from private.user_event_settings where singleton), false) then
    return jsonb_build_object('collectionEnabled',false,'stored',0,'duplicates',0);
  end if;
  select * into v_session from public.study_sessions where id = p_study_session_id and auth_user_id = auth.uid()
    and status in ('active','completed') for update;
  if not found then raise exception 'INVALID_STUDY_SESSION'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) < 1 or jsonb_array_length(p_events) > 25
    or pg_column_size(p_events) > 102400 then raise exception 'INVALID_EVENT_BATCH'; end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event) <> 'object'
      or exists(select 1 from jsonb_object_keys(v_event) k where not (k = any(v_allowed_keys)))
      or (v_event ? 'metadata' and coalesce(jsonb_typeof(v_event->'metadata'),'null') <> 'object')
      or (v_event ? 'value_before' and coalesce(jsonb_typeof(v_event->'value_before'),'null') <> 'object')
      or (v_event ? 'value_after' and coalesce(jsonb_typeof(v_event->'value_after'),'null') <> 'object')
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata','{}'::jsonb)) k where not (k = any(v_metadata_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'value_before','{}'::jsonb)) k where not (k = any(v_value_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'value_after','{}'::jsonb)) k where not (k = any(v_value_allowed_keys)))
      or exists(select 1 from jsonb_each(coalesce(v_event->'value_before','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or exists(select 1 from jsonb_each(coalesce(v_event->'value_after','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or exists(
        select 1 from jsonb_each(coalesce(v_event->'metadata','{}'::jsonb)) e
        where e.key not in ('position','previous_position','quest_ids')
          and jsonb_typeof(e.value) not in ('string','number','boolean','null')
      )
      or (v_event->'metadata' ? 'position' and coalesce(jsonb_typeof(v_event->'metadata'->'position'),'null') <> 'object')
      or (v_event->'metadata' ? 'previous_position' and coalesce(jsonb_typeof(v_event->'metadata'->'previous_position'),'null') <> 'object')
      or (v_event->'metadata' ? 'quest_ids' and coalesce(jsonb_typeof(v_event->'metadata'->'quest_ids'),'null') <> 'array')
      or exists(
        select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'position','{}'::jsonb)) k
        where not (k = any(v_position_allowed_keys))
      )
      or exists(
        select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) k
        where not (k = any(v_position_allowed_keys))
      )
      or exists(
        select 1 from jsonb_each(coalesce(v_event->'metadata'->'position','{}'::jsonb)) e
        where jsonb_typeof(e.value) not in ('string','number','null')
      )
      or exists(
        select 1 from jsonb_each(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) e
        where jsonb_typeof(e.value) not in ('string','number','null')
      )
      or exists(
        select 1 from jsonb_array_elements(coalesce(v_event->'metadata'->'quest_ids','[]'::jsonb)) e
        where jsonb_typeof(e) not in ('string','number','boolean','null')
      )
      or pg_column_size(v_event) > 8192 then raise exception 'INVALID_EVENT_PAYLOAD'; end if;
    begin
      v_id := (v_event->>'id')::uuid;
      v_client := (v_event->>'client_instance_id')::uuid;
      v_sequence := (v_event->>'sequence_no')::bigint;
      v_occurred := (v_event->>'occurred_at')::timestamptz;
      if nullif(v_event->>'operation_idempotency_key','') is not null then
        perform (v_event->>'operation_idempotency_key')::uuid;
      end if;
    exception when others then raise exception 'INVALID_EVENT_IDENTITY'; end;
    v_name := v_event->>'event_name';
    if v_sequence < 1 or v_occurred < v_received - interval '30 days' or v_occurred > v_received + interval '24 hours'
      or (v_session.status='completed' and v_occurred > v_session.completed_at + interval '10 minutes')
      or not exists(select 1 from public.user_event_names n where n.event_name = v_name and n.active)
      or coalesce(length(v_event->>'target_id'),0) > 160 or coalesce(length(v_event->>'sound_id'),0) > 160
      or coalesce(length(v_event->>'error_code'),0) > 80 or coalesce(pg_column_size(v_event->'metadata'),0) > 2048
      then raise exception 'INVALID_EVENT_VALUE'; end if;
    insert into public.user_events(id,study_session_id,client_instance_id,auth_user_id,participant_id,group_id,sequence_no,event_name,
      occurred_at,received_at,screen,zone,sound_id,target_type,target_id,interaction_method,value_before,value_after,outcome,close_reason,
      duration_ms,operation_type,operation_idempotency_key,result_entity_type,result_entity_id,error_code,metadata,app_version)
    values(v_id,v_session.id,v_client,auth.uid(),v_session.participant_id,v_session.group_id,v_sequence,v_name,v_occurred,v_received,
      left(v_event->>'screen',64),left(v_event->>'zone',64),left(v_event->>'sound_id',160),left(v_event->>'target_type',64),
      left(v_event->>'target_id',160),left(v_event->>'interaction_method',32),v_event->'value_before',v_event->'value_after',
      left(v_event->>'outcome',32),left(v_event->>'close_reason',32),nullif(v_event->>'duration_ms','')::integer,
      left(v_event->>'operation_type',80),nullif(v_event->>'operation_idempotency_key','')::uuid,left(v_event->>'result_entity_type',64),
      left(v_event->>'result_entity_id',160),left(v_event->>'error_code',80),v_event->'metadata',left(v_event->>'app_version',64))
    on conflict (id) do nothing;
    if found then v_inserted := v_inserted + 1; else v_duplicates := v_duplicates + 1; end if;
  end loop;
  update public.study_sessions set last_activity_at = v_received where id = v_session.id;
  return jsonb_build_object('collectionEnabled',true,'stored',v_inserted,'duplicates',v_duplicates,'receivedAt',v_received);
end $$;

create or replace function public.complete_study_session_v1(p_study_session_id uuid, p_completion_reason text default 'explicit_completion')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.study_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.study_sessions set status='completed',completed_at=coalesce(completed_at,now()),last_activity_at=now(),
    completion_reason=left(coalesce(nullif(p_completion_reason,''),'explicit_completion'),80)
  where id=p_study_session_id and auth_user_id=auth.uid() and status in ('active','completed') returning * into v_session;
  if not found then raise exception 'INVALID_STUDY_SESSION'; end if;
  return jsonb_build_object('studySessionId',v_session.id,'status',v_session.status,'completedAt',v_session.completed_at);
end $$;

-- participant_room previously used a direct upsert. This companion RPC gives room
-- saves the same retry-safe operation/result join used by the 003 mutations.
create or replace function public.save_participant_room_v3(p_idempotency_key uuid, p_room jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_existing jsonb; v_result jsonb;
begin
  if p_idempotency_key is null or jsonb_typeof(p_room) <> 'object' or pg_column_size(p_room) > 262144
    then raise exception 'INVALID_ROOM_PAYLOAD'; end if;
  select * into v_participant from public.study_participants where auth_user_id=auth.uid() and status='active';
  if not found then raise exception 'PARTICIPANT_SESSION_REQUIRED'; end if;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),'room_save',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
      and operation_type='room_save' and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  insert into public.participant_room(participant_id,room,updated_at)
    values(v_participant.participant_id,p_room,now())
  on conflict(participant_id) do update set room=excluded.room,updated_at=excluded.updated_at;
  v_result:=jsonb_build_object('roomId',v_participant.participant_id,'savedAt',now());
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=auth.uid() and operation_type='room_save' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

revoke all on function public.start_or_resume_study_session_v1(uuid,uuid,text,text,text,integer,integer,text,text) from public,anon;
revoke all on function public.record_user_events_v1(uuid,jsonb) from public,anon;
revoke all on function public.complete_study_session_v1(uuid,text) from public,anon;
revoke all on function public.save_participant_room_v3(uuid,jsonb) from public,anon;
grant execute on function public.start_or_resume_study_session_v1(uuid,uuid,text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.record_user_events_v1(uuid,jsonb) to authenticated;
grant execute on function public.complete_study_session_v1(uuid,text) to authenticated;
grant execute on function public.save_participant_room_v3(uuid,jsonb) to authenticated;

commit;
