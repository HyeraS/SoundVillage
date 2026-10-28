-- Move a participant session to the most recently authenticated browser.
-- Apply after 001_auth_foundation.sql. MASTER and USER1 keep their dedicated
-- password/shared-demo authentication paths and cannot be taken over here.
begin;

create or replace function public.claim_study_participant_admin(
  p_auth_user_id uuid, p_group_id text, p_participant_id text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.study_participants%rowtype;
  v_existing_participant_id text;
  v_previous_auth_user_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_participant_id !~ '^[A-Z0-9_-]{1,64}$' or p_group_id not in ('A', 'B') then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select * into v_row from public.study_participants
    where participant_id = p_participant_id for update;
  if not found then return jsonb_build_object('status', 'participant_not_registered'); end if;
  if v_row.status <> 'active' then return jsonb_build_object('status', 'participant_inactive'); end if;
  if v_row.group_id <> p_group_id then return jsonb_build_object('status', 'group_mismatch'); end if;
  if v_row.participant_id in ('MASTER', 'USER1') then
    return jsonb_build_object('status', 'participant_takeover_forbidden');
  end if;

  select participant_id into v_existing_participant_id
  from public.study_participants
  where auth_user_id = p_auth_user_id and participant_id <> p_participant_id
  for update;
  if v_existing_participant_id in ('MASTER', 'USER1') then
    return jsonb_build_object('status', 'auth_session_reserved');
  end if;

  v_previous_auth_user_id := v_row.auth_user_id;

  -- The unique auth_user_id constraint means one browser identity can own at
  -- most one participant. Release any ordinary prior mapping before moving the
  -- requested participant to this browser.
  update public.study_participants
    set auth_user_id = null
    where auth_user_id = p_auth_user_id and participant_id <> p_participant_id;

  update public.study_participants
    set auth_user_id = p_auth_user_id,
        claimed_at = coalesce(claimed_at, now()),
        last_seen_at = now()
    where participant_id = p_participant_id
    returning * into v_row;

  -- Keep the one active experiment session usable after moving browsers. The
  -- previous token stops matching immediately, while the new browser can
  -- resume the same participant/round instead of colliding with the active
  -- session uniqueness constraint.
  if v_previous_auth_user_id is not null and v_previous_auth_user_id <> p_auth_user_id then
    update public.study_sessions
    set auth_user_id = p_auth_user_id, last_activity_at = now()
    where participant_id = p_participant_id
      and auth_user_id = v_previous_auth_user_id;
  end if;

  -- Old Realtime room grants are no longer useful after ownership moves. RLS
  -- already rejects them, and removing them keeps the membership table tidy.
  if v_previous_auth_user_id is not null and v_previous_auth_user_id <> p_auth_user_id then
    delete from public.participant_realtime_room_members
    where auth_user_id = v_previous_auth_user_id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'participant_id', v_row.participant_id,
    'group_id', v_row.group_id,
    'session_replaced', v_previous_auth_user_id is not null and v_previous_auth_user_id <> p_auth_user_id
  );
end;
$$;

revoke all on function public.claim_study_participant_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_study_participant_admin(uuid, text, text) to service_role;

commit;
