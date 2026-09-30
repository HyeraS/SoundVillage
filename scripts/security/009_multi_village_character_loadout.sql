-- Stage 3B forward migration: isolated multi-village Character loadout.
-- Review first. Apply only to a disposable local Supabase after migrations 001-008.
-- The legacy participant_equipped_outfit table and scalar currency system remain untouched.
begin;

do $$
begin
  if to_regclass('public.participant_catalog_items') is null
    or to_regprocedure('private.current_participant_id()') is null
    or to_regprocedure('private.ensure_multi_village_wallets(text)') is null then
    raise exception 'PREFLIGHT_REQUIRED: migrations 001-008 must be applied first';
  end if;
end $$;

create table public.participant_multi_village_character_loadouts (
  participant_id text primary key references public.study_participants(participant_id) on delete cascade,
  outfit_id text not null default 'basic',
  accessory_id text,
  updated_at timestamptz not null default now(),
  check (outfit_id <> ''),
  check (accessory_id is null or accessory_id <> '')
);

create table public.multi_village_character_equip_results (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  idempotency_key uuid not null,
  slot text not null check (slot in ('outfit','accessory')),
  item_id text,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (auth_user_id,idempotency_key),
  check ((slot='outfit' and item_id is not null) or slot='accessory')
);

create or replace function private.ensure_multi_village_character_loadout(p_participant_id text)
returns void language sql security definer set search_path = '' as $$
  insert into public.participant_multi_village_character_loadouts(participant_id,outfit_id,accessory_id)
  values(p_participant_id,'basic',null) on conflict (participant_id) do nothing
$$;

create or replace function public.get_multi_village_character_profile_admin(p_auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_loadout public.participant_multi_village_character_loadouts%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  perform private.ensure_multi_village_wallets(v_pid);
  perform private.ensure_multi_village_character_loadout(v_pid);
  select * into v_loadout from public.participant_multi_village_character_loadouts
    where participant_id=v_pid;
  return jsonb_build_object(
    'ok',true,
    'balances',private.multi_village_balances(v_pid),
    'ownedItemIds',(select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb)
      from public.participant_catalog_items where participant_id=v_pid),
    'loadout',jsonb_build_object('outfitId',v_loadout.outfit_id,'accessoryId',v_loadout.accessory_id),
    'defaultOutfitId','basic'
  );
end $$;

create or replace function public.equip_multi_village_character_item_admin(
  p_auth_user_id uuid,
  p_slot text,
  p_item_id text,
  p_item_type text,
  p_is_approved boolean,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pid text; v_existing_slot text; v_existing_item text; v_existing_result jsonb;
  v_loadout public.participant_multi_village_character_loadouts%rowtype; v_result jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null then raise exception 'INVALID_EQUIP_REQUEST'; end if;
  if p_slot is null or p_slot not in ('outfit','accessory') then
    return jsonb_build_object('ok',false,'reason','invalid_slot');
  end if;

  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;

  insert into public.multi_village_character_equip_results(
    auth_user_id,participant_id,idempotency_key,slot,item_id
  ) values(p_auth_user_id,v_pid,p_idempotency_key,p_slot,p_item_id) on conflict do nothing;
  if not found then
    select slot,item_id,result into v_existing_slot,v_existing_item,v_existing_result
      from public.multi_village_character_equip_results
      where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
    if v_existing_slot is distinct from p_slot or v_existing_item is distinct from p_item_id then
      return jsonb_build_object('ok',false,'reason','idempotency_key_reused');
    end if;
    if v_existing_result is null then raise exception 'DUPLICATE_EQUIP_IN_PROGRESS'; end if;
    return v_existing_result;
  end if;

  perform private.ensure_multi_village_character_loadout(v_pid);
  select * into v_loadout from public.participant_multi_village_character_loadouts
    where participant_id=v_pid for update;

  if p_slot='accessory' and p_item_id is null then
    update public.participant_multi_village_character_loadouts
      set accessory_id=null,updated_at=now() where participant_id=v_pid returning * into v_loadout;
  elsif p_item_id is null or nullif(p_item_type,'') is null then
    v_result:=jsonb_build_object('ok',false,'reason','unknown_item');
  elsif not coalesce(p_is_approved,false) then
    v_result:=jsonb_build_object('ok',false,'reason','official_store_unapproved');
  elsif p_item_type<>p_slot then
    v_result:=jsonb_build_object('ok',false,'reason','invalid_item_type');
  elsif p_item_id='basic' then
    if p_slot<>'outfit' then
      v_result:=jsonb_build_object('ok',false,'reason','invalid_item_type');
    else
      update public.participant_multi_village_character_loadouts
        set outfit_id='basic',updated_at=now() where participant_id=v_pid returning * into v_loadout;
    end if;
  elsif not exists (select 1 from public.participant_catalog_items
    where participant_id=v_pid and item_id=p_item_id) then
    v_result:=jsonb_build_object('ok',false,'reason','item_not_owned');
  elsif p_slot='outfit' then
    update public.participant_multi_village_character_loadouts
      set outfit_id=p_item_id,updated_at=now() where participant_id=v_pid returning * into v_loadout;
  else
    update public.participant_multi_village_character_loadouts
      set accessory_id=p_item_id,updated_at=now() where participant_id=v_pid returning * into v_loadout;
  end if;

  if v_result is null then
    v_result:=jsonb_build_object('ok',true,'loadout',jsonb_build_object(
      'outfitId',v_loadout.outfit_id,'accessoryId',v_loadout.accessory_id));
  end if;
  update public.multi_village_character_equip_results
    set result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

alter table public.participant_multi_village_character_loadouts enable row level security;
alter table public.multi_village_character_equip_results enable row level security;

create policy participant_multi_village_character_loadouts_select_own
  on public.participant_multi_village_character_loadouts for select to authenticated
  using (participant_id=private.current_participant_id());

revoke all on public.participant_multi_village_character_loadouts,
  public.multi_village_character_equip_results from public,anon,authenticated;
grant select on public.participant_multi_village_character_loadouts to authenticated;

revoke all on function private.ensure_multi_village_character_loadout(text) from public,anon,authenticated;
revoke all on function public.get_multi_village_character_profile_admin(uuid) from public,anon,authenticated;
revoke all on function public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid)
  from public,anon,authenticated;
grant execute on function public.get_multi_village_character_profile_admin(uuid) to service_role;
grant execute on function public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid)
  to service_role;

-- New preview-specific names are added forward; existing event names remain unchanged.
insert into public.user_event_names(event_name,description) values
  ('economy_v1_preview_opened','Internal multi-village Character preview opened'),
  ('village_wallets_viewed','Six-village wallet bar viewed'),
  ('character_item_previewed','Character shop item previewed'),
  ('character_item_equipped','Multi-village Character item equipped'),
  ('character_item_unequipped','Multi-village Character accessory removed')
on conflict (event_name) do nothing;

-- Preserve the v1 event boundary while extending only its metadata allow-list.
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
    'transaction_id','play_count','item_id','product_group','price_tier','currency_combination','insufficient_village_count','result_code'];
  v_value_allowed_keys constant text[] := array['length','empty','confidence','candidate_index','flipped'];
  v_position_allowed_keys constant text[] := array['layer','col','row','x','y'];
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
        where e.key not in ('position','previous_position','quest_ids') and jsonb_typeof(e.value) not in ('string','number','boolean','null'))
      or (v_event->'metadata' ? 'position' and coalesce(jsonb_typeof(v_event->'metadata'->'position'),'null')<>'object')
      or (v_event->'metadata' ? 'previous_position' and coalesce(jsonb_typeof(v_event->'metadata'->'previous_position'),'null')<>'object')
      or (v_event->'metadata' ? 'quest_ids' and coalesce(jsonb_typeof(v_event->'metadata'->'quest_ids'),'null')<>'array')
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'position','{}'::jsonb)) k where not (k=any(v_position_allowed_keys)))
      or exists(select 1 from jsonb_object_keys(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) k where not (k=any(v_position_allowed_keys)))
      or exists(select 1 from jsonb_each(coalesce(v_event->'metadata'->'position','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','null'))
      or exists(select 1 from jsonb_each(coalesce(v_event->'metadata'->'previous_position','{}'::jsonb)) e where jsonb_typeof(e.value) not in ('string','number','null'))
      or exists(select 1 from jsonb_array_elements(coalesce(v_event->'metadata'->'quest_ids','[]'::jsonb)) e where jsonb_typeof(e) not in ('string','number','boolean','null'))
      or pg_column_size(v_event)>8192 then raise exception 'INVALID_EVENT_PAYLOAD'; end if;
    begin
      v_id:=(v_event->>'id')::uuid; v_client:=(v_event->>'client_instance_id')::uuid;
      v_sequence:=(v_event->>'sequence_no')::bigint; v_occurred:=(v_event->>'occurred_at')::timestamptz;
      if nullif(v_event->>'operation_idempotency_key','') is not null then
        perform (v_event->>'operation_idempotency_key')::uuid;
      end if;
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
    on conflict (id) do nothing;
    if found then v_inserted:=v_inserted+1; else v_duplicates:=v_duplicates+1; end if;
  end loop;
  update public.study_sessions set last_activity_at=v_received where id=v_session.id;
  return jsonb_build_object('collectionEnabled',true,'stored',v_inserted,'duplicates',v_duplicates,'receivedAt',v_received);
end $$;
revoke all on function public.record_user_events_v1(uuid,jsonb) from public,anon;
grant execute on function public.record_user_events_v1(uuid,jsonb) to authenticated;

commit;
