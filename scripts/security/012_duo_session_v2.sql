-- Stage 4B forward migration: server-approved, two-person Duo sessions.
-- Join tokens are never stored. Only their SHA-256 hashes cross this boundary.
begin;

do $$
begin
  if to_regclass('public.duo_v2_sessions') is not null
    or to_regclass('public.duo_v2_session_members') is not null
    or to_regclass('public.duo_v2_invites') is not null
    or to_regclass('public.duo_v2_leases') is not null
    or to_regclass('public.duo_v2_operation_results') is not null
  then raise exception 'MIGRATION_ALREADY_APPLIED: 012 Duo Session V2'; end if;
  if to_regclass('public.participant_economy_v1_rooms') is null
    or to_regprocedure('public.get_economy_v1_shared_room_admin(uuid,uuid)') is null
    or to_regprocedure('private.is_realtime_room_member(text)') is null
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_read')
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_send')
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify 001 through 011 first'; end if;
end $$;

create table public.duo_v2_sessions (
  id uuid primary key default gen_random_uuid(),
  host_auth_user_id uuid not null references auth.users(id) on delete cascade,
  room_system text not null check (room_system in ('legacy','economy_v1')),
  status text not null default 'active' check (status in ('active','closed','expired')),
  expires_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status='active' and closed_at is null) or status<>'active')
);

create unique index duo_v2_one_active_session_per_host
  on public.duo_v2_sessions(host_auth_user_id) where status='active';

create table public.duo_v2_session_members (
  session_id uuid not null references public.duo_v2_sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host','visitor')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(session_id,auth_user_id),
  unique(session_id,role)
);

create table public.duo_v2_invites (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  session_id uuid not null references public.duo_v2_sessions(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index duo_v2_one_active_invite_per_session
  on public.duo_v2_invites(session_id) where status='active';

create table public.duo_v2_leases (
  session_id uuid not null,
  auth_user_id uuid not null,
  client_id uuid not null,
  state text not null default 'active' check (state in ('active','released')),
  screen text not null default 'waiting' check (screen in ('worldmap','interior','waiting')),
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  released_at timestamptz,
  primary key(session_id,auth_user_id),
  foreign key(session_id,auth_user_id)
    references public.duo_v2_session_members(session_id,auth_user_id) on delete cascade
);

create table public.duo_v2_operation_results (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('host_create','visitor_join')),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(auth_user_id,operation,idempotency_key),
  check (result is null or (jsonb_typeof(result)='object'
    and not (result ?| array['inviteToken','joinToken','tokenHash','participantId','authUserId','clientId','realtimeTopic','url'])))
);

create or replace function private.complete_duo_v2_operation(
  p_auth_user_id uuid,p_operation text,p_idempotency_key uuid,p_result jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update public.duo_v2_operation_results
    set result=p_result,completed_at=now()
    where auth_user_id=p_auth_user_id and operation=p_operation and idempotency_key=p_idempotency_key;
  return p_result;
end $$;

create or replace function private.duo_v2_participant_active(p_auth_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.study_participants
    where auth_user_id=p_auth_user_id and status='active')
$$;

-- The invite threshold is derived from the saved server room and ownership
-- rows.  The allow-list is the approved, game-connected movable subset of the
-- Stage 4A catalog: starters, wallpaper/floor products and pending products are
-- deliberately absent.  Neither the browser's count nor its runtime mode is
-- accepted by this function.
create or replace function private.duo_v2_host_room_eligible(
  p_auth_user_id uuid,p_room_system text
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  v_participant_id text;
  v_room jsonb;
  v_official_movable_ids constant text[] := array[
    'plant_tall','plant_bush','books','fruitbowl','rug_persian_red','rug_persian_green','rug_circle_teal',
    'curtain_red','curtain_green','bed_cream','bed_teal','dresser','wardrobe_teal','wardrobe_purple',
    'fireplace','sofa_cream','sofa_red','armchair_cream','chair_cream','table_round','stool_wood',
    'pot_cactus','lamp_floor','candle','xmas_tree','curtain_blue','frame_butterfly2','cat','hamster','deer','cactus'
  ]::text[];
  v_count integer;
begin
  if p_room_system not in ('legacy','economy_v1') then return false; end if;
  select participant_id into v_participant_id from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_participant_id is null then return false; end if;

  if p_room_system='economy_v1' then
    select room into v_room from public.participant_economy_v1_rooms
      where participant_id=v_participant_id;
    if jsonb_typeof(v_room->'items')<>'array' then return false; end if;
    select count(distinct placement->>'itemId') into v_count
      from jsonb_array_elements(v_room->'items') placement
      join public.participant_catalog_items owned
        on owned.participant_id=v_participant_id and owned.item_id=placement->>'itemId'
      where placement->>'itemId'=any(v_official_movable_ids);
  else
    select room into v_room from public.participant_room where participant_id=v_participant_id;
    if jsonb_typeof(v_room->'items')<>'array' then return false; end if;
    select count(distinct placement->>'itemId') into v_count
      from jsonb_array_elements(v_room->'items') placement
      join public.participant_interior_items owned
        on owned.participant_id=v_participant_id and owned.item_id=placement->>'itemId'
      where placement->>'itemId'=any(v_official_movable_ids);
  end if;
  return coalesce(v_count,0)>=4;
end $$;

create or replace function public.is_duo_v2_visitor_mutation_blocked_admin(p_auth_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.duo_v2_sessions session
    join public.duo_v2_session_members member on member.session_id=session.id
    where member.auth_user_id=p_auth_user_id and member.role='visitor' and member.left_at is null
      and session.status='active' and session.expires_at>now()
  ) and coalesce(auth.role(),'')='service_role'
$$;

-- The Stage 3B purchase Route Handler is protected by a source fingerprint and
-- must remain byte-for-byte unchanged.  Its transaction always inserts the
-- legacy ledger row before committing, so this trigger provides the same
-- server-side visitor boundary without changing that protected route or RPC.
create or replace function private.reject_duo_v2_visitor_legacy_currency_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select 1 from public.study_participants participant
    join public.duo_v2_session_members member on member.auth_user_id=participant.auth_user_id
    join public.duo_v2_sessions session on session.id=member.session_id
    join public.duo_v2_leases lease on lease.session_id=member.session_id
      and lease.auth_user_id=member.auth_user_id
    where participant.participant_id=new.participant_id and participant.status='active'
      and member.role='visitor' and member.left_at is null
      and session.status='active' and session.expires_at>now()
      and lease.state='active' and lease.heartbeat_at>now()-interval '45 seconds'
  ) then
    raise exception using errcode='42501',message='DUO_VISITOR_READONLY';
  end if;
  return new;
end $$;

create trigger duo_v2_visitor_legacy_currency_guard
before insert on public.currency_transactions
for each row execute function private.reject_duo_v2_visitor_legacy_currency_mutation();

create or replace function public.create_duo_v2_session_admin(
  p_auth_user_id uuid,p_client_id uuid,p_token_hash text,p_idempotency_key uuid,p_request_hash text,
  p_room_system text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_session public.duo_v2_sessions%rowtype;
  v_lease public.duo_v2_leases%rowtype;
  v_existing_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_auth_user_id is null or p_client_id is null or p_idempotency_key is null
    or p_token_hash !~ '^[0-9a-f]{64}$' or p_request_hash !~ '^[0-9a-f]{64}$'
  then return jsonb_build_object('ok',false,'reason','invalid_request'); end if;
  if not private.duo_v2_participant_active(p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  if not private.duo_v2_host_room_eligible(p_auth_user_id,p_room_system)
  then return jsonb_build_object('ok',false,'reason','invite_locked'); end if;

  insert into public.duo_v2_operation_results(auth_user_id,operation,idempotency_key,request_hash)
    values(p_auth_user_id,'host_create',p_idempotency_key,p_request_hash) on conflict do nothing;
  if not found then
    select request_hash,result into v_existing_hash,v_existing_result
      from public.duo_v2_operation_results
      where auth_user_id=p_auth_user_id and operation='host_create' and idempotency_key=p_idempotency_key;
    if v_existing_hash<>p_request_hash then return jsonb_build_object('ok',false,'reason','idempotency_key_reused'); end if;
    if v_existing_result is null then raise exception 'DUO_OPERATION_IN_PROGRESS'; end if;
    return v_existing_result;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text,4202));
  update public.duo_v2_sessions set status='expired',closed_at=now(),updated_at=now()
    where host_auth_user_id=p_auth_user_id and status='active' and expires_at<=now();
  select * into v_session from public.duo_v2_sessions
    where host_auth_user_id=p_auth_user_id and status='active' for update;
  if found and v_session.room_system<>p_room_system then
    update public.duo_v2_sessions set status='closed',closed_at=now(),updated_at=now()
      where id=v_session.id;
    update public.duo_v2_invites set status='revoked',revoked_at=coalesce(revoked_at,now())
      where session_id=v_session.id and status='active';
    update public.duo_v2_leases set state='released',released_at=coalesce(released_at,now())
      where session_id=v_session.id and state='active';
    v_session:=null;
  end if;
  if v_session.id is null then
    insert into public.duo_v2_sessions(host_auth_user_id,room_system,expires_at)
      values(p_auth_user_id,p_room_system,now()+interval '2 hours') returning * into v_session;
    insert into public.duo_v2_session_members(session_id,auth_user_id,role)
      values(v_session.id,p_auth_user_id,'host');
  end if;

  select * into v_lease from public.duo_v2_leases
    where session_id=v_session.id and auth_user_id=p_auth_user_id for update;
  if found and v_lease.state='active' and v_lease.heartbeat_at>now()-interval '45 seconds'
    and v_lease.client_id<>p_client_id
  then
    return private.complete_duo_v2_operation(p_auth_user_id,'host_create',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','already_open_elsewhere'));
  end if;
  insert into public.duo_v2_leases(session_id,auth_user_id,client_id,state,screen,joined_at,heartbeat_at,released_at)
    values(v_session.id,p_auth_user_id,p_client_id,'active','waiting',now(),now(),null)
    on conflict(session_id,auth_user_id) do update set client_id=excluded.client_id,state='active',screen='waiting',
      joined_at=now(),heartbeat_at=now(),released_at=null;

  update public.duo_v2_invites set status='revoked',revoked_at=now()
    where session_id=v_session.id and status='active';
  insert into public.duo_v2_invites(token_hash,session_id,status,expires_at)
    values(p_token_hash,v_session.id,'active',v_session.expires_at)
    on conflict(token_hash) do update set session_id=excluded.session_id,status='active',
      expires_at=excluded.expires_at,created_at=now(),revoked_at=null;

  v_result:=jsonb_build_object('ok',true,'sessionId',v_session.id,'role','host',
    'expiresAt',v_session.expires_at,'leaseExpiresAt',now()+interval '45 seconds');
  return private.complete_duo_v2_operation(p_auth_user_id,'host_create',p_idempotency_key,v_result);
end $$;

create or replace function public.join_duo_v2_session_admin(
  p_auth_user_id uuid,p_client_id uuid,p_token_hash text,p_idempotency_key uuid,p_request_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_invite public.duo_v2_invites%rowtype;
  v_session public.duo_v2_sessions%rowtype;
  v_member public.duo_v2_session_members%rowtype;
  v_lease public.duo_v2_leases%rowtype;
  v_existing_hash text;
  v_existing_result jsonb;
  v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_auth_user_id is null or p_client_id is null or p_idempotency_key is null
    or p_token_hash !~ '^[0-9a-f]{64}$' or p_request_hash !~ '^[0-9a-f]{64}$'
  then return jsonb_build_object('ok',false,'reason','invalid_invite'); end if;
  if not private.duo_v2_participant_active(p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;

  insert into public.duo_v2_operation_results(auth_user_id,operation,idempotency_key,request_hash)
    values(p_auth_user_id,'visitor_join',p_idempotency_key,p_request_hash) on conflict do nothing;
  if not found then
    select request_hash,result into v_existing_hash,v_existing_result
      from public.duo_v2_operation_results
      where auth_user_id=p_auth_user_id and operation='visitor_join' and idempotency_key=p_idempotency_key;
    if v_existing_hash<>p_request_hash then return jsonb_build_object('ok',false,'reason','idempotency_key_reused'); end if;
    if v_existing_result is null then raise exception 'DUO_OPERATION_IN_PROGRESS'; end if;
    return v_existing_result;
  end if;

  select * into v_invite from public.duo_v2_invites where token_hash=p_token_hash for update;
  if not found then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','invalid_invite'));
  end if;
  if v_invite.status='revoked' then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','invite_revoked'));
  end if;
  if v_invite.expires_at<=now() then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','invite_expired'));
  end if;
  select * into v_session from public.duo_v2_sessions where id=v_invite.session_id for update;
  if v_session.status<>'active' or v_session.expires_at<=now() then
    if v_session.status='active' then
      update public.duo_v2_sessions set status='expired',closed_at=now(),updated_at=now() where id=v_session.id;
    end if;
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','session_closed'));
  end if;
  if v_session.host_auth_user_id=p_auth_user_id then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','invalid_invite'));
  end if;

  select * into v_member from public.duo_v2_session_members
    where session_id=v_session.id and role='visitor' for update;
  if found and v_member.auth_user_id<>p_auth_user_id then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','session_full'));
  end if;
  if not found then
    insert into public.duo_v2_session_members(session_id,auth_user_id,role)
      values(v_session.id,p_auth_user_id,'visitor');
  else
    update public.duo_v2_session_members set left_at=null,joined_at=now()
      where session_id=v_session.id and auth_user_id=p_auth_user_id;
  end if;

  select * into v_lease from public.duo_v2_leases
    where session_id=v_session.id and auth_user_id=p_auth_user_id for update;
  if found and v_lease.state='active' and v_lease.heartbeat_at>now()-interval '45 seconds'
    and v_lease.client_id<>p_client_id
  then
    return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,
      jsonb_build_object('ok',false,'reason','already_open_elsewhere'));
  end if;
  insert into public.duo_v2_leases(session_id,auth_user_id,client_id,state,screen,joined_at,heartbeat_at,released_at)
    values(v_session.id,p_auth_user_id,p_client_id,'active','waiting',now(),now(),null)
    on conflict(session_id,auth_user_id) do update set client_id=excluded.client_id,state='active',screen='waiting',
      joined_at=now(),heartbeat_at=now(),released_at=null;

  v_result:=jsonb_build_object('ok',true,'sessionId',v_session.id,'role','visitor',
    'expiresAt',v_session.expires_at,'leaseExpiresAt',now()+interval '45 seconds');
  return private.complete_duo_v2_operation(p_auth_user_id,'visitor_join',p_idempotency_key,v_result);
end $$;

create or replace function public.get_duo_v2_session_status_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.duo_v2_sessions%rowtype; v_member public.duo_v2_session_members%rowtype;
  v_lease public.duo_v2_leases%rowtype; v_peer public.duo_v2_leases%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if not private.duo_v2_participant_active(p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select * into v_session from public.duo_v2_sessions where id=p_session_id;
  select * into v_member from public.duo_v2_session_members
    where session_id=p_session_id and auth_user_id=p_auth_user_id and left_at is null;
  if v_session.id is null or v_member.auth_user_id is null or v_session.status<>'active' or v_session.expires_at<=now()
  then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  select * into v_lease from public.duo_v2_leases
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  if v_lease.client_id is null or v_lease.client_id<>p_client_id or v_lease.state<>'active'
    or v_lease.heartbeat_at<=now()-interval '45 seconds'
  then return jsonb_build_object('ok',false,'reason','lease_stale'); end if;
  select lease.* into v_peer from public.duo_v2_leases lease
    where lease.session_id=p_session_id and lease.auth_user_id<>p_auth_user_id
      and lease.state='active' and lease.heartbeat_at>now()-interval '45 seconds';
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'role',v_member.role,
    'expiresAt',v_session.expires_at,'leaseExpiresAt',v_lease.heartbeat_at+interval '45 seconds',
    'peerPresent',v_peer.client_id is not null,'peerScreen',case when v_peer.client_id is null then null else v_peer.screen end);
end $$;

create or replace function public.get_duo_v2_shared_room_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_host_auth_user_id uuid; v_host_participant_id text; v_room_system text;
  v_room jsonb; v_revision bigint;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if not exists(select 1 from public.duo_v2_sessions session
    join public.duo_v2_session_members member on member.session_id=session.id
    join public.duo_v2_leases lease on lease.session_id=member.session_id
      and lease.auth_user_id=member.auth_user_id
    join public.study_participants participant on participant.auth_user_id=member.auth_user_id
    where session.id=p_session_id and session.status='active' and session.expires_at>now()
      and member.auth_user_id=p_auth_user_id and member.left_at is null
      and participant.status='active' and lease.client_id=p_client_id
      and lease.state='active' and lease.heartbeat_at>now()-interval '45 seconds')
  then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  select host_auth_user_id,room_system into v_host_auth_user_id,v_room_system
    from public.duo_v2_sessions where id=p_session_id;
  select participant_id into v_host_participant_id from public.study_participants
    where auth_user_id=v_host_auth_user_id and status='active';
  if v_host_participant_id is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  if v_room_system='economy_v1' then
    select room,revision into v_room,v_revision from public.participant_economy_v1_rooms
      where participant_id=v_host_participant_id;
  else
    select room,1::bigint into v_room,v_revision from public.participant_room
      where participant_id=v_host_participant_id;
  end if;
  if v_room is null then return jsonb_build_object('ok',false,'reason','shared_room_not_found'); end if;
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'room',v_room,'revision',v_revision);
end $$;

create or replace function public.recover_duo_v2_session_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.duo_v2_sessions%rowtype; v_member public.duo_v2_session_members%rowtype;
  v_lease public.duo_v2_leases%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if not private.duo_v2_participant_active(p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select * into v_session from public.duo_v2_sessions where id=p_session_id for update;
  select * into v_member from public.duo_v2_session_members
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  if v_session.id is null or v_member.auth_user_id is null or v_session.status<>'active' or v_session.expires_at<=now()
  then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  select * into v_lease from public.duo_v2_leases
    where session_id=p_session_id and auth_user_id=p_auth_user_id for update;
  if v_lease.state='active' and v_lease.heartbeat_at>now()-interval '45 seconds' and v_lease.client_id<>p_client_id
  then return jsonb_build_object('ok',false,'reason','already_open_elsewhere'); end if;
  update public.duo_v2_leases set client_id=p_client_id,state='active',screen='waiting',
    joined_at=now(),heartbeat_at=now(),released_at=null
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  update public.duo_v2_session_members set left_at=null,joined_at=now()
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'role',v_member.role,
    'expiresAt',v_session.expires_at,'leaseExpiresAt',now()+interval '45 seconds');
end $$;

create or replace function public.heartbeat_duo_v2_session_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid,p_screen text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.duo_v2_sessions%rowtype; v_member public.duo_v2_session_members%rowtype;
  v_lease public.duo_v2_leases%rowtype; v_peer public.duo_v2_leases%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null or p_screen not in ('worldmap','interior','waiting')
  then return jsonb_build_object('ok',false,'reason','invalid_request'); end if;
  if not private.duo_v2_participant_active(p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select * into v_session from public.duo_v2_sessions where id=p_session_id for update;
  select * into v_member from public.duo_v2_session_members
    where session_id=p_session_id and auth_user_id=p_auth_user_id and left_at is null;
  if v_session.id is null or v_member.auth_user_id is null or v_session.status<>'active' or v_session.expires_at<=now()
  then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  select * into v_lease from public.duo_v2_leases
    where session_id=p_session_id and auth_user_id=p_auth_user_id for update;
  if v_lease.client_id is null or v_lease.client_id<>p_client_id or v_lease.state<>'active'
  then return jsonb_build_object('ok',false,'reason','already_open_elsewhere'); end if;
  if v_lease.heartbeat_at<=now()-interval '45 seconds'
  then return jsonb_build_object('ok',false,'reason','lease_stale'); end if;
  update public.duo_v2_leases set heartbeat_at=now(),screen=p_screen
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  select lease.* into v_peer from public.duo_v2_leases lease
    where lease.session_id=p_session_id and lease.auth_user_id<>p_auth_user_id
      and lease.state='active' and lease.heartbeat_at>now()-interval '45 seconds';
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'role',v_member.role,
    'expiresAt',v_session.expires_at,'leaseExpiresAt',now()+interval '45 seconds',
    'peerPresent',v_peer.client_id is not null,'peerScreen',case when v_peer.client_id is null then null else v_peer.screen end);
end $$;

create or replace function public.leave_duo_v2_session_admin(
  p_auth_user_id uuid,p_session_id uuid,p_client_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_released integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null then return jsonb_build_object('ok',false,'reason','invalid_request'); end if;
  select role into v_role from public.duo_v2_session_members
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  if v_role is null then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  update public.duo_v2_leases set state='released',released_at=now(),heartbeat_at=now()
    where session_id=p_session_id and auth_user_id=p_auth_user_id and client_id=p_client_id
      and state='active';
  get diagnostics v_released=row_count;
  if v_released<>1 then
    return jsonb_build_object('ok',false,'reason','lease_mismatch');
  end if;
  update public.duo_v2_session_members set left_at=now()
    where session_id=p_session_id and auth_user_id=p_auth_user_id;
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'role',v_role);
end $$;

create or replace function public.close_duo_v2_session_admin(
  p_auth_user_id uuid,p_session_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null then return jsonb_build_object('ok',false,'reason','invalid_request'); end if;
  if not exists(select 1 from public.duo_v2_sessions
    where id=p_session_id and host_auth_user_id=p_auth_user_id)
  then return jsonb_build_object('ok',false,'reason','session_closed'); end if;
  update public.duo_v2_sessions set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now()
    where id=p_session_id and status='active';
  update public.duo_v2_invites set status='revoked',revoked_at=coalesce(revoked_at,now())
    where session_id=p_session_id and status='active';
  update public.duo_v2_leases set state='released',released_at=coalesce(released_at,now())
    where session_id=p_session_id and state='active';
  return jsonb_build_object('ok',true,'sessionId',p_session_id,'role','host');
end $$;

-- Preserve every legacy topic grant and add V2 membership only while the exact
-- browser lease remains active and fresh. Existing Realtime policies keep using
-- this function, so no policy is dropped or widened to anon/public.
create or replace function private.is_realtime_room_member(p_topic text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.participant_realtime_room_members legacy
      join public.study_participants participant on participant.auth_user_id=legacy.auth_user_id
      where legacy.topic=p_topic and legacy.auth_user_id=auth.uid()
        and legacy.expires_at>now() and participant.status='active'
  ) or exists(
    select 1 from public.duo_v2_sessions session
      join public.duo_v2_session_members member on member.session_id=session.id
      join public.duo_v2_leases lease on lease.session_id=member.session_id
        and lease.auth_user_id=member.auth_user_id
      join public.study_participants participant on participant.auth_user_id=member.auth_user_id
      where p_topic='duo-v2:'||session.id::text and member.auth_user_id=auth.uid()
        and participant.status='active' and session.status='active' and session.expires_at>now()
        and member.left_at is null
        and auth.jwt()->>'duo_session_id'=session.id::text
        and auth.jwt()->>'duo_client_id'=lease.client_id::text
        and auth.jwt()->>'duo_role'=member.role
        and lease.state='active' and lease.heartbeat_at>now()-interval '45 seconds'
  )
$$;

alter table public.duo_v2_sessions enable row level security;
alter table public.duo_v2_session_members enable row level security;
alter table public.duo_v2_invites enable row level security;
alter table public.duo_v2_leases enable row level security;
alter table public.duo_v2_operation_results enable row level security;

revoke all on public.duo_v2_sessions,public.duo_v2_session_members,public.duo_v2_invites,
  public.duo_v2_leases,public.duo_v2_operation_results from public,anon,authenticated;
revoke all on function private.complete_duo_v2_operation(uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.duo_v2_participant_active(uuid) from public,anon,authenticated;
revoke all on function private.duo_v2_host_room_eligible(uuid,text) from public,anon,authenticated;
revoke all on function private.reject_duo_v2_visitor_legacy_currency_mutation() from public,anon,authenticated;
revoke all on function public.is_duo_v2_visitor_mutation_blocked_admin(uuid) from public,anon,authenticated;
revoke all on function public.create_duo_v2_session_admin(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.join_duo_v2_session_admin(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.get_duo_v2_session_status_admin(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_duo_v2_shared_room_admin(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.recover_duo_v2_session_admin(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.heartbeat_duo_v2_session_admin(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.leave_duo_v2_session_admin(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_duo_v2_session_admin(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_duo_v2_session_admin(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.is_duo_v2_visitor_mutation_blocked_admin(uuid) to service_role;
grant execute on function public.join_duo_v2_session_admin(uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.get_duo_v2_session_status_admin(uuid,uuid,uuid) to service_role;
grant execute on function public.get_duo_v2_shared_room_admin(uuid,uuid,uuid) to service_role;
grant execute on function public.recover_duo_v2_session_admin(uuid,uuid,uuid) to service_role;
grant execute on function public.heartbeat_duo_v2_session_admin(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.leave_duo_v2_session_admin(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.close_duo_v2_session_admin(uuid,uuid,uuid) to service_role;
grant execute on function private.is_realtime_room_member(text) to authenticated;

insert into public.user_event_names(event_name,description) values
  ('duo_invite_created','Duo V2 host created or rotated an invitation'),
  ('duo_invite_revoked','Duo V2 host revoked an invitation'),
  ('duo_join_attempted','Duo V2 visitor attempted to join'),
  ('duo_join_succeeded','Duo V2 visitor joined'),
  ('duo_join_failed','Duo V2 visitor join failed'),
  ('duo_session_closed','Duo V2 host closed the session')
on conflict(event_name) do nothing;

commit;
