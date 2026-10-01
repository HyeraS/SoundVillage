-- Stage 4A forward migration: isolated Economy v1 InteriorDecorRoom storage.
-- Apply only to a disposable local Supabase after 001-010 have passed.
-- Legacy participant_room, participant_interior_items, scalar currency and ledgers
-- are intentionally neither altered nor read by the functions below.
begin;

do $$
begin
  if to_regclass('public.participant_economy_v1_rooms') is not null
    or to_regclass('public.economy_v1_room_save_results') is not null
    or to_regclass('public.participant_economy_v1_room_shares') is not null
  then raise exception 'MIGRATION_ALREADY_APPLIED: 011 multi-village Interior cutover'; end if;
  if to_regclass('public.study_participants') is null -- 001
    or to_regprocedure('private.current_participant_id()') is null -- 001
    or to_regprocedure('private.increment_annotation_vote_count()') is null -- 002
    or to_regprocedure('public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid)') is null -- 003
    or to_regclass('public.user_events') is null -- 004
    or to_regprocedure('public.record_user_events_v1(uuid,jsonb)') is null -- 004
    or to_regprocedure('public.museum_annotation_counts()') is null -- 005
    or to_regprocedure('private.study_date_kst(timestamp with time zone)') is null -- 006
    or to_regprocedure('public.submit_annotation_v4(uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text)') is null -- 006
    or to_regprocedure('public.save_participant_room_v3(uuid,jsonb)') is null -- 007
    or has_table_privilege('authenticated','public.participant_room','insert') -- 007
    or to_regclass('public.participant_catalog_items') is null -- 008
    or to_regclass('public.participant_multi_village_character_loadouts') is null -- 009
    or to_regprocedure('public.submit_annotation_economy_v1_admin(uuid,uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text)') is null -- 010
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify 001 through 010 first'; end if;
end $$;

create table public.participant_economy_v1_rooms (
  participant_id text primary key references public.study_participants(participant_id) on delete cascade,
  room jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  invite_unique_item_count integer not null default 0 check (invite_unique_item_count between 0 and 100),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(room)='object' and pg_column_size(room)<=65536)
);

create table public.economy_v1_room_save_results (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(auth_user_id,idempotency_key)
);

create table public.participant_economy_v1_room_shares (
  participant_id text primary key references public.study_participants(participant_id) on delete cascade,
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create or replace function private.complete_economy_v1_room_save(
  p_auth_user_id uuid,p_idempotency_key uuid,p_result jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update public.economy_v1_room_save_results set result=p_result,completed_at=now()
  where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
  return p_result;
end $$;

create or replace function public.get_economy_v1_room_admin(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pid text; v_room public.participant_economy_v1_rooms%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select * into v_room from public.participant_economy_v1_rooms where participant_id=v_pid;
  if not found then return jsonb_build_object('ok',true,'room',null,'revision',0,'inviteUniqueItemCount',0); end if;
  return jsonb_build_object('ok',true,'room',v_room.room,'revision',v_room.revision,
    'inviteUniqueItemCount',v_room.invite_unique_item_count,'updatedAt',v_room.updated_at);
end $$;

create or replace function public.save_economy_v1_room_admin(
  p_auth_user_id uuid,p_idempotency_key uuid,p_request_hash text,p_expected_revision bigint,
  p_room jsonb,p_referenced_item_ids text[],p_starter_item_ids text[],p_unique_item_count integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_pid text; v_existing_hash text; v_existing_result jsonb; v_revision bigint; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_expected_revision<0
    or jsonb_typeof(p_room)<>'object' or pg_column_size(p_room)>65536
    or jsonb_typeof(p_room->'items')<>'array' or jsonb_array_length(p_room->'items')>100
    or cardinality(p_referenced_item_ids)<2
    or (select array_agg(item_id order by item_id) from unnest(p_starter_item_ids) as starter(item_id))
      <> array['starter_floor_beige','starter_wall_neutral']::text[]
    or p_unique_item_count<0 or p_unique_item_count>100
  then return jsonb_build_object('ok',false,'reason','invalid_room'); end if;

  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;

  insert into public.economy_v1_room_save_results(
    auth_user_id,participant_id,idempotency_key,request_hash
  ) values(p_auth_user_id,v_pid,p_idempotency_key,p_request_hash) on conflict do nothing;
  if not found then
    select request_hash,result into v_existing_hash,v_existing_result
    from public.economy_v1_room_save_results
    where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
    if v_existing_hash<>p_request_hash then
      return jsonb_build_object('ok',false,'reason','idempotency_key_reused');
    end if;
    if v_existing_result is null then raise exception 'DUPLICATE_ROOM_SAVE_IN_PROGRESS'; end if;
    return v_existing_result;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_pid,0));
  if exists(
    select 1 from unnest(p_referenced_item_ids) as refs(item_id)
    where not (refs.item_id=any(p_starter_item_ids))
      and not exists(select 1 from public.participant_catalog_items owned
        where owned.participant_id=v_pid and owned.item_id=refs.item_id)
  ) then
    return private.complete_economy_v1_room_save(p_auth_user_id,p_idempotency_key,
      jsonb_build_object('ok',false,'reason','item_not_owned'));
  end if;

  select revision into v_revision from public.participant_economy_v1_rooms where participant_id=v_pid;
  if not found then v_revision:=0; end if;
  if v_revision<>p_expected_revision then
    return private.complete_economy_v1_room_save(p_auth_user_id,p_idempotency_key,
      jsonb_build_object('ok',false,'reason','room_conflict','revision',v_revision));
  end if;

  insert into public.participant_economy_v1_rooms(
    participant_id,room,revision,invite_unique_item_count,updated_at
  ) values(v_pid,p_room,1,p_unique_item_count,now())
  on conflict(participant_id) do update set room=excluded.room,
    revision=public.participant_economy_v1_rooms.revision+1,
    invite_unique_item_count=excluded.invite_unique_item_count,updated_at=now()
  returning revision into v_revision;

  v_result:=jsonb_build_object('ok',true,'revision',v_revision,
    'inviteUniqueItemCount',p_unique_item_count,'savedAt',now());
  return private.complete_economy_v1_room_save(p_auth_user_id,p_idempotency_key,v_result);
end $$;

create or replace function public.get_or_create_economy_v1_room_share_admin(p_auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pid text; v_token uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  insert into public.participant_economy_v1_room_shares(participant_id) values(v_pid)
    on conflict(participant_id) do nothing;
  select share_token into v_token from public.participant_economy_v1_room_shares where participant_id=v_pid;
  return jsonb_build_object('ok',true,'shareToken',v_token);
end $$;

create or replace function public.get_economy_v1_shared_room_admin(p_auth_user_id uuid,p_share_token uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_room public.participant_economy_v1_rooms%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if not exists(select 1 from public.study_participants where auth_user_id=p_auth_user_id and status='active')
    then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select room.* into v_room from public.participant_economy_v1_room_shares shares
    join public.participant_economy_v1_rooms room on room.participant_id=shares.participant_id
    where shares.share_token=p_share_token;
  if not found then return jsonb_build_object('ok',false,'reason','shared_room_not_found'); end if;
  return jsonb_build_object('ok',true,'room',v_room.room,'revision',v_room.revision);
end $$;

alter table public.participant_economy_v1_rooms enable row level security;
alter table public.economy_v1_room_save_results enable row level security;
alter table public.participant_economy_v1_room_shares enable row level security;

revoke all on public.participant_economy_v1_rooms,public.economy_v1_room_save_results,
  public.participant_economy_v1_room_shares from public,anon,authenticated;
revoke all on function private.complete_economy_v1_room_save(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_economy_v1_room_admin(uuid) from public,anon,authenticated;
revoke all on function public.save_economy_v1_room_admin(uuid,uuid,text,bigint,jsonb,text[],text[],integer) from public,anon,authenticated;
revoke all on function public.get_or_create_economy_v1_room_share_admin(uuid) from public,anon,authenticated;
revoke all on function public.get_economy_v1_shared_room_admin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_economy_v1_room_admin(uuid) to service_role;
grant execute on function public.save_economy_v1_room_admin(uuid,uuid,text,bigint,jsonb,text[],text[],integer) to service_role;
grant execute on function public.get_or_create_economy_v1_room_share_admin(uuid) to service_role;
grant execute on function public.get_economy_v1_shared_room_admin(uuid,uuid) to service_role;

insert into public.user_event_names(event_name,description) values
  ('interior_bundle_purchase_blocked','Economy v1 interior set purchase blocked by partial ownership'),
  ('interior_invite_unlocked','Economy v1 room reached the unique-item invitation threshold')
on conflict(event_name) do nothing;

-- Extend the existing strict event envelope with a bounded six-wallet cost
-- vector and scalar Interior progress fields. Unknown metadata remains rejected.
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
    'transaction_id','play_count','item_id','product_group','price_tier','currency_combination','insufficient_village_count','result_code',
    'cost_vector','unique_item_count','bundle_owned_count','bundle_total_count','room_revision'];
  v_value_allowed_keys constant text[] := array['length','empty','confidence','candidate_index','flipped'];
  v_position_allowed_keys constant text[] := array['layer','col','row','x','y'];
  v_village_allowed_keys constant text[] := array['Animal','Human','Nature','Urban','Music','Lab'];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not coalesce((select collection_enabled from private.user_event_settings where singleton), false) then
    return jsonb_build_object('collectionEnabled',false,'stored',0,'duplicates',0);
  end if;
  select * into v_session from public.study_sessions where id=p_study_session_id and auth_user_id=auth.uid()
    and status in ('active','completed') for update;
  if not found then raise exception 'INVALID_STUDY_SESSION'; end if;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)<1 or jsonb_array_length(p_events)>25
    or pg_column_size(p_events)>102400 then raise exception 'INVALID_EVENT_BATCH'; end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event)<>'object'
      or exists(select 1 from jsonb_object_keys(v_event) k where not (k=any(v_allowed_keys)))
      or (v_event ? 'metadata' and coalesce(jsonb_typeof(v_event->'metadata'),'null')<>'object')
      or (v_event ? 'value_before' and coalesce(jsonb_typeof(v_event->'value_before'),'null')<>'object')
      or (v_event ? 'value_after' and coalesce(jsonb_typeof(v_event->'value_after'),'null')<>'object')
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata','{}'::jsonb)) k where not (k=any(v_metadata_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'value_before','{}'::jsonb)) k where not (k=any(v_value_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'value_after','{}'::jsonb)) k where not (k=any(v_value_allowed_keys)))
      or exists(select 1 from jsonb_each(coalesce(v_event->'value_before','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or exists(select 1 from jsonb_each(coalesce(v_event->'value_after','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or exists(select 1 from jsonb_each(coalesce(v_event->'metadata','{}'::jsonb)) e
        where e.key not in ('position','previous_position','quest_ids','cost_vector') and jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or (v_event->'metadata' ? 'position' and coalesce(jsonb_typeof(v_event->'metadata'->'position'),'null')<>'object')
      or (v_event->'metadata' ? 'previous_position' and coalesce(jsonb_typeof(v_event->'metadata'->'previous_position'),'null')<>'object')
      or (v_event->'metadata' ? 'quest_ids' and coalesce(jsonb_typeof(v_event->'metadata'->'quest_ids'),'null')<>'array')
      or (v_event->'metadata' ? 'cost_vector' and coalesce(jsonb_typeof(v_event->'metadata'->'cost_vector'),'null')<>'object')
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'position','{}'::jsonb)) k where not (k=any(v_position_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) k where not (k=any(v_position_allowed_keys)))
      or exists(select 1 from jsonb_each(coalesce(v_event->'metadata'->'position','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','null'))
      or exists(select 1 from jsonb_each(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','null'))
      or exists(select 1 from jsonb_array_elements(coalesce(v_event->'metadata'->'quest_ids','[]'::jsonb)) e where jsonb_typeof(e) not in ('string','number','boolean','null'))
      or (v_event->'metadata' ? 'cost_vector' and (
        (select count(*) from jsonb_object_keys(v_event->'metadata'->'cost_vector'))<>6
        or exists(select 1 from jsonb_each(v_event->'metadata'->'cost_vector') as e
          where not (e.key=any(v_village_allowed_keys)) or jsonb_typeof(e.value)<>'number'
            or e.value::text !~ '^[0-9]+$' or (e.value::text)::numeric>1000000)))
      or pg_column_size(v_event)>8192 then raise exception 'INVALID_EVENT_PAYLOAD'; end if;
    begin
      v_id:=(v_event->>'id')::uuid; v_client:=(v_event->>'client_instance_id')::uuid;
      v_sequence:=(v_event->>'sequence_no')::bigint; v_occurred:=(v_event->>'occurred_at')::timestamptz;
      if nullif(v_event->>'operation_idempotency_key','') is not null then perform (v_event->>'operation_idempotency_key')::uuid; end if;
    exception when others then raise exception 'INVALID_EVENT_IDENTITY'; end;
    v_name:=v_event->>'event_name';
    if v_sequence<1 or v_occurred<v_received-interval '30 days' or v_occurred>v_received+interval '24 hours'
      or (v_session.status='completed' and v_occurred>v_session.completed_at+interval '10 minutes')
      or not exists(select 1 from public.user_event_names n where n.event_name=v_name and n.active)
      or coalesce(length(v_event->>'target_id'),0)>160 or coalesce(length(v_event->>'sound_id'),0)>160
      or coalesce(length(v_event->>'error_code'),0)>80 or coalesce(pg_column_size(v_event->'metadata'),0)>2048
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
    on conflict(id) do nothing;
    if found then v_inserted:=v_inserted+1; else v_duplicates:=v_duplicates+1; end if;
  end loop;
  update public.study_sessions set last_activity_at=v_received where id=v_session.id;
  return jsonb_build_object('collectionEnabled',true,'stored',v_inserted,'duplicates',v_duplicates,'receivedAt',v_received);
end $$;
revoke all on function public.record_user_events_v1(uuid,jsonb) from public,anon;
grant execute on function public.record_user_events_v1(uuid,jsonb) to authenticated;

commit;
