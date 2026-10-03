-- Stage 3 Character Identity: forward-only extension of the 009 loadout.
-- Apply after 012. This migration deliberately refuses reapply and partial state.
begin;

do $$
declare v_present integer;
begin
  if to_regclass('public.participant_multi_village_character_loadouts') is null
    or to_regprocedure('public.get_multi_village_character_profile_admin(uuid)') is null
    or to_regprocedure('public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid)') is null
    or to_regclass('public.duo_v2_sessions') is null
    or to_regclass('public.user_event_names') is null
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify migrations 001 through 012 first'; end if;

  select count(*) into v_present from information_schema.columns
    where table_schema='public' and table_name='participant_multi_village_character_loadouts'
      and column_name in ('skin_id','eyes_id','hair_style_id','hair_color_id');
  if v_present<>0
    or to_regclass('public.multi_village_character_identity_results') is not null
    or to_regprocedure('public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)') is not null
  then raise exception 'MIGRATION_PARTIAL_OR_ALREADY_APPLIED: 013 Character Identity'; end if;
end $$;

alter table public.participant_multi_village_character_loadouts
  add column skin_id text not null default 'skin_01',
  add column eyes_id text not null default 'eyes_green_light',
  add column hair_style_id text not null default 'hair_buzzcut',
  add column hair_color_id text not null default 'black';

alter table public.participant_multi_village_character_loadouts
  add constraint character_loadout_skin_allowed check (skin_id=any(array[
    'skin_01','skin_02','skin_03','skin_04','skin_05','skin_06','skin_07','skin_08'
  ]::text[])),
  add constraint character_loadout_eyes_allowed check (eyes_id=any(array[
    'eyes_black','eyes_blue','eyes_blue_light','eyes_brown','eyes_brown_dark','eyes_brown_light',
    'eyes_green','eyes_green_dark','eyes_green_light','eyes_grey','eyes_grey_light','eyes_pink',
    'eyes_pink_light','eyes_red'
  ]::text[])),
  add constraint character_loadout_hair_style_allowed check (hair_style_id=any(array[
    'hair_bob','hair_braids','hair_buzzcut','hair_curly','hair_emo','hair_extra_long',
    'hair_french_curl','hair_gentleman','hair_long_straight','hair_midiwave','hair_ponytail',
    'hair_spacebuns','hair_wavy'
  ]::text[])),
  add constraint character_loadout_hair_color_allowed check (hair_color_id=any(array[
    'black','blonde','brown','brown_light','copper','emerald','green','grey','lilac','navy',
    'pink','purple','red','turquoise'
  ]::text[]));

create table public.multi_village_character_identity_results (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  skin_id text not null,
  eyes_id text not null,
  hair_style_id text not null,
  hair_color_id text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(auth_user_id,idempotency_key),
  check (skin_id<>'' and eyes_id<>'' and hair_style_id<>'' and hair_color_id<>''),
  check (result is null or (jsonb_typeof(result)='object'
    and not (result ?| array['participantId','authUserId','balance','balances','ownedItemIds'])))
);

create or replace function private.ensure_multi_village_character_loadout(p_participant_id text)
returns void language sql security definer set search_path='' as $$
  insert into public.participant_multi_village_character_loadouts(
    participant_id,outfit_id,accessory_id,skin_id,eyes_id,hair_style_id,hair_color_id
  ) values(
    p_participant_id,'basic',null,'skin_01','eyes_green_light','hair_buzzcut','black'
  ) on conflict(participant_id) do nothing
$$;

create or replace function public.get_multi_village_character_profile_admin(p_auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pid text; v_loadout public.participant_multi_village_character_loadouts%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  perform private.ensure_multi_village_wallets(v_pid);
  perform private.ensure_multi_village_character_loadout(v_pid);
  select * into v_loadout from public.participant_multi_village_character_loadouts where participant_id=v_pid;
  return jsonb_build_object(
    'ok',true,
    'balances',private.multi_village_balances(v_pid),
    'ownedItemIds',(select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb)
      from public.participant_catalog_items where participant_id=v_pid),
    'loadout',jsonb_build_object(
      'skinId',v_loadout.skin_id,'eyesId',v_loadout.eyes_id,
      'hairStyleId',v_loadout.hair_style_id,'hairColorId',v_loadout.hair_color_id,
      'outfitId',v_loadout.outfit_id,'accessoryId',v_loadout.accessory_id),
    'defaultOutfitId','basic'
  );
end $$;

create or replace function public.equip_multi_village_character_item_admin(
  p_auth_user_id uuid,p_slot text,p_item_id text,p_item_type text,
  p_is_approved boolean,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_pid text; v_existing_slot text; v_existing_item text; v_existing_result jsonb;
  v_loadout public.participant_multi_village_character_loadouts%rowtype; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
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
    update public.participant_multi_village_character_loadouts set accessory_id=null,updated_at=now()
      where participant_id=v_pid returning * into v_loadout;
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
      update public.participant_multi_village_character_loadouts set outfit_id='basic',updated_at=now()
        where participant_id=v_pid returning * into v_loadout;
    end if;
  elsif not exists(select 1 from public.participant_catalog_items
    where participant_id=v_pid and item_id=p_item_id) then
    v_result:=jsonb_build_object('ok',false,'reason','item_not_owned');
  elsif p_slot='outfit' then
    update public.participant_multi_village_character_loadouts set outfit_id=p_item_id,updated_at=now()
      where participant_id=v_pid returning * into v_loadout;
  else
    update public.participant_multi_village_character_loadouts set accessory_id=p_item_id,updated_at=now()
      where participant_id=v_pid returning * into v_loadout;
  end if;
  if v_result is null then
    v_result:=jsonb_build_object('ok',true,'loadout',jsonb_build_object(
      'skinId',v_loadout.skin_id,'eyesId',v_loadout.eyes_id,
      'hairStyleId',v_loadout.hair_style_id,'hairColorId',v_loadout.hair_color_id,
      'outfitId',v_loadout.outfit_id,'accessoryId',v_loadout.accessory_id));
  end if;
  update public.multi_village_character_equip_results set result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.save_multi_village_character_identity_admin(
  p_auth_user_id uuid,p_skin_id text,p_eyes_id text,p_hair_style_id text,
  p_hair_color_id text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_pid text; v_fingerprint text; v_existing_fingerprint text; v_existing_result jsonb;
  v_loadout public.participant_multi_village_character_loadouts%rowtype; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_auth_user_id is null or p_idempotency_key is null then
    return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
  if p_skin_id is null or p_skin_id<>all(array[
    'skin_01','skin_02','skin_03','skin_04','skin_05','skin_06','skin_07','skin_08'
  ]::text[]) then return jsonb_build_object('ok',false,'reason','invalid_skin_id'); end if;
  if p_eyes_id is null or p_eyes_id<>all(array[
    'eyes_black','eyes_blue','eyes_blue_light','eyes_brown','eyes_brown_dark','eyes_brown_light',
    'eyes_green','eyes_green_dark','eyes_green_light','eyes_grey','eyes_grey_light','eyes_pink',
    'eyes_pink_light','eyes_red'
  ]::text[]) then return jsonb_build_object('ok',false,'reason','invalid_eyes_id'); end if;
  if p_hair_style_id is null or p_hair_style_id<>all(array[
    'hair_bob','hair_braids','hair_buzzcut','hair_curly','hair_emo','hair_extra_long',
    'hair_french_curl','hair_gentleman','hair_long_straight','hair_midiwave','hair_ponytail',
    'hair_spacebuns','hair_wavy'
  ]::text[]) then return jsonb_build_object('ok',false,'reason','invalid_hair_style_id'); end if;
  if p_hair_color_id is null or p_hair_color_id<>all(array[
    'black','blonde','brown','brown_light','copper','emerald','green','grey','lilac','navy',
    'pink','purple','red','turquoise'
  ]::text[]) then return jsonb_build_object('ok',false,'reason','invalid_hair_color_id'); end if;

  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  v_fingerprint:=encode(extensions.digest(convert_to(
    jsonb_build_object('skinId',p_skin_id,'eyesId',p_eyes_id,'hairStyleId',p_hair_style_id,'hairColorId',p_hair_color_id)::text,
    'UTF8'),'sha256'),'hex');

  insert into public.multi_village_character_identity_results(
    auth_user_id,participant_id,idempotency_key,request_fingerprint,
    skin_id,eyes_id,hair_style_id,hair_color_id
  ) values(
    p_auth_user_id,v_pid,p_idempotency_key,v_fingerprint,
    p_skin_id,p_eyes_id,p_hair_style_id,p_hair_color_id
  ) on conflict do nothing;
  if not found then
    select request_fingerprint,result into v_existing_fingerprint,v_existing_result
      from public.multi_village_character_identity_results
      where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key for update;
    if v_existing_fingerprint<>v_fingerprint then
      return jsonb_build_object('ok',false,'reason','idempotency_key_reused');
    end if;
    if v_existing_result is null then raise exception 'IDENTITY_OPERATION_IN_PROGRESS'; end if;
    return v_existing_result;
  end if;

  perform private.ensure_multi_village_character_loadout(v_pid);
  update public.participant_multi_village_character_loadouts set
    skin_id=p_skin_id,eyes_id=p_eyes_id,hair_style_id=p_hair_style_id,
    hair_color_id=p_hair_color_id,updated_at=now()
    where participant_id=v_pid returning * into v_loadout;
  v_result:=jsonb_build_object('ok',true,'loadout',jsonb_build_object(
    'skinId',v_loadout.skin_id,'eyesId',v_loadout.eyes_id,
    'hairStyleId',v_loadout.hair_style_id,'hairColorId',v_loadout.hair_color_id,
    'outfitId',v_loadout.outfit_id,'accessoryId',v_loadout.accessory_id));
  update public.multi_village_character_identity_results set result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

alter table public.multi_village_character_identity_results enable row level security;
revoke all on public.multi_village_character_identity_results from public,anon,authenticated;
revoke insert,update,delete on public.participant_multi_village_character_loadouts from public,anon,authenticated;
revoke all on function private.ensure_multi_village_character_loadout(text) from public,anon,authenticated;
revoke all on function public.get_multi_village_character_profile_admin(uuid) from public,anon,authenticated;
revoke all on function public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_multi_village_character_profile_admin(uuid) to service_role;
grant execute on function public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid) to service_role;
grant execute on function public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid) to service_role;

insert into public.user_event_names(event_name,description) values
  ('character_identity_save_attempted','Character identity save attempted'),
  ('character_identity_save_succeeded','Character identity save succeeded'),
  ('character_identity_save_failed','Character identity save failed')
on conflict(event_name) do update set active=true;

commit;
