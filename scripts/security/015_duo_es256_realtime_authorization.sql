-- Forward-only Duo Realtime authorization for Supabase Auth access tokens.
-- 012 is already deployed and must remain byte-for-byte historical. This
-- migration removes only the custom Duo JWT-claim dependency; it does not
-- widen Realtime policies or expose Duo tables to browser roles.
begin;

do $$
declare v_definition text;
begin
  if to_regclass('public.duo_v2_sessions') is null
    or to_regclass('public.duo_v2_session_members') is null
    or to_regclass('public.duo_v2_leases') is null
    or to_regprocedure('public.get_duo_v2_character_identity_admin(uuid,uuid,uuid)') is null
    or to_regprocedure('private.is_realtime_room_member(text)') is null
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_read' and cmd='SELECT' and roles=array['authenticated']::name[])
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_send' and cmd='INSERT' and roles=array['authenticated']::name[])
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify migrations 001 through 014 first'; end if;

  select pg_get_functiondef(to_regprocedure('private.is_realtime_room_member(text)'))
    into v_definition;
  if v_definition not like '%duo_session_id%'
    or v_definition not like '%duo_client_id%'
    or v_definition not like '%duo_role%'
  then raise exception 'MIGRATION_ALREADY_APPLIED_OR_UNEXPECTED_BASELINE: 015'; end if;
end $$;

-- A current Supabase Auth JWT supplies auth.uid(). The exact Duo topic is then
-- authorized from server-controlled membership, participant, session, and
-- lease rows. A browser clientId cannot be cryptographically bound to a stock
-- Supabase access token, so product-level duplicate-tab enforcement remains in
-- the recover/status/heartbeat APIs while this policy preserves DB isolation.
create or replace function private.is_realtime_room_member(p_topic text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    exists(
      select 1 from public.participant_realtime_room_members legacy
        join public.study_participants participant
          on participant.auth_user_id=legacy.auth_user_id
        where legacy.topic=p_topic
          and legacy.auth_user_id=auth.uid()
          and legacy.expires_at>now()
          and participant.status='active'
    ) or exists(
      select 1 from public.duo_v2_sessions session
        join public.duo_v2_session_members member
          on member.session_id=session.id
        join public.duo_v2_leases lease
          on lease.session_id=member.session_id
          and lease.auth_user_id=member.auth_user_id
        join public.study_participants participant
          on participant.auth_user_id=member.auth_user_id
        where p_topic='duo-v2:'||session.id::text
          and member.auth_user_id=auth.uid()
          and participant.status='active'
          and session.status='active'
          and session.expires_at>now()
          and member.left_at is null
          and lease.state='active'
          and lease.heartbeat_at>now()-interval '45 seconds'
    )
  )
$$;

revoke all on function private.is_realtime_room_member(text) from public,anon;
grant execute on function private.is_realtime_room_member(text) to authenticated;

commit;
