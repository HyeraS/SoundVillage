-- Stage 4 Character Identity Sync: service-only Duo member appearance snapshot.
-- Apply after 013. Browser roles retain no direct table or function access.
begin;

do $$
begin
  if to_regclass('public.duo_v2_sessions') is null
    or to_regclass('public.duo_v2_session_members') is null
    or to_regclass('public.duo_v2_leases') is null
    or to_regclass('public.participant_multi_village_character_loadouts') is null
    or to_regprocedure('private.ensure_multi_village_character_loadout(text)') is null
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify migrations 001 through 013 first'; end if;
  if to_regprocedure('public.get_duo_v2_character_identity_admin(uuid,uuid,uuid)') is not null
  then raise exception 'MIGRATION_ALREADY_APPLIED: 014 Duo Character Identity Sync'; end if;
end $$;

create or replace function public.get_duo_v2_character_identity_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_session public.duo_v2_sessions%rowtype;
  v_member public.duo_v2_session_members%rowtype;
  v_lease public.duo_v2_leases%rowtype;
  v_peer_member public.duo_v2_session_members%rowtype;
  v_self_pid text;
  v_peer_pid text;
  v_self public.participant_multi_village_character_loadouts%rowtype;
  v_peer public.participant_multi_village_character_loadouts%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_auth_user_id is null or p_session_id is null or p_client_id is null then
    return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
  if not private.duo_v2_participant_active(p_auth_user_id) then
    return jsonb_build_object('ok',false,'reason','participant_inactive');
  end if;

  select * into v_session from public.duo_v2_sessions where id=p_session_id;
  if not found then return jsonb_build_object('ok',false,'reason','session_not_found'); end if;
  if v_session.status<>'active' then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  if v_session.expires_at<=now() then return jsonb_build_object('ok',false,'reason','session_expired'); end if;

  select * into v_member from public.duo_v2_session_members
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  if not found then return jsonb_build_object('ok',false,'reason','membership_required'); end if;
  if v_member.left_at is not null then return jsonb_build_object('ok',false,'reason','session_left'); end if;

  select * into v_lease from public.duo_v2_leases
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  if not found or v_lease.state<>'active' or v_lease.client_id<>p_client_id then
    return jsonb_build_object('ok',false,'reason','lease_mismatch');
  end if;
  if v_lease.heartbeat_at<=now()-interval '45 seconds' then
    return jsonb_build_object('ok',false,'reason','lease_stale');
  end if;

  select member.* into v_peer_member
    from public.duo_v2_session_members member
    join public.duo_v2_leases lease
      on lease.session_id=member.session_id and lease.auth_user_id=member.auth_user_id
    where member.session_id=p_session_id and member.auth_user_id<>p_auth_user_id
      and member.left_at is null and lease.state='active'
      and lease.heartbeat_at>now()-interval '45 seconds';
  if not found then return jsonb_build_object('ok',false,'reason','peer_unavailable'); end if;
  if v_peer_member.role=v_member.role then return jsonb_build_object('ok',false,'reason','role_mismatch'); end if;

  select participant_id into v_self_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  select participant_id into v_peer_pid from public.study_participants
    where auth_user_id=v_peer_member.auth_user_id and status='active';
  if v_self_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  if v_peer_pid is null then return jsonb_build_object('ok',false,'reason','peer_inactive'); end if;

  perform private.ensure_multi_village_character_loadout(v_self_pid);
  perform private.ensure_multi_village_character_loadout(v_peer_pid);
  select * into v_self from public.participant_multi_village_character_loadouts where participant_id=v_self_pid;
  select * into v_peer from public.participant_multi_village_character_loadouts where participant_id=v_peer_pid;

  return jsonb_build_object(
    'ok',true,'contractVersion',1,
    'self',jsonb_build_object(
      'skinId',v_self.skin_id,'eyesId',v_self.eyes_id,'hairStyleId',v_self.hair_style_id,
      'hairColorId',v_self.hair_color_id,'outfitId',v_self.outfit_id,'accessoryId',v_self.accessory_id),
    'peer',jsonb_build_object(
      'skinId',v_peer.skin_id,'eyesId',v_peer.eyes_id,'hairStyleId',v_peer.hair_style_id,
      'hairColorId',v_peer.hair_color_id,'outfitId',v_peer.outfit_id,'accessoryId',v_peer.accessory_id)
  );
end $$;

revoke all on function public.get_duo_v2_character_identity_admin(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_duo_v2_character_identity_admin(uuid,uuid,uuid) to service_role;

commit;
