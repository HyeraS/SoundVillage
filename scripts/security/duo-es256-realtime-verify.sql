-- Read-only verification for migration 015 and its unchanged ACL/RLS boundary.
do $$
declare
  relation_name text;
  v_definition text;
begin
  if to_regprocedure('private.is_realtime_room_member(text)') is null
  then raise exception 'missing private.is_realtime_room_member(text)'; end if;

  select pg_get_functiondef(to_regprocedure('private.is_realtime_room_member(text)'))
    into v_definition;
  if v_definition like '%duo_session_id%'
    or v_definition like '%duo_client_id%'
    or v_definition like '%duo_role%'
  then raise exception 'legacy Duo custom JWT claim dependency remains'; end if;
  if v_definition not like '%auth.uid() is not null%'
    or v_definition not like '%legacy.topic=p_topic%'
    or v_definition not like '%p_topic=''duo-v2:''||session.id::text%'
    or v_definition not like '%member.auth_user_id=auth.uid()%'
    or v_definition not like '%participant.status=''active''%'
    or v_definition not like '%session.status=''active''%'
    or v_definition not like '%session.expires_at>now()%'
    or v_definition not like '%member.left_at is null%'
    or v_definition not like '%lease.state=''active''%'
    or v_definition not like '%lease.heartbeat_at>now()-interval ''45 seconds''%'
  then raise exception '015 Realtime authorization predicate is incomplete'; end if;

  if not exists(select 1 from pg_proc where oid=to_regprocedure('private.is_realtime_room_member(text)')
      and prosecdef and provolatile='s'
      and coalesce(proconfig,array[]::text[])=array['search_path=""']::text[])
  then raise exception 'Realtime authorization function safety attributes changed'; end if;
  if has_function_privilege('anon','private.is_realtime_room_member(text)','execute')
    or not has_function_privilege('authenticated','private.is_realtime_room_member(text)','execute')
  then raise exception 'Realtime authorization function ACL changed'; end if;

  foreach relation_name in array array[
    'duo_v2_sessions','duo_v2_session_members','duo_v2_invites','duo_v2_leases','duo_v2_operation_results'
  ] loop
    if has_table_privilege('anon','public.'||relation_name,'select,insert,update,delete')
      or has_table_privilege('authenticated','public.'||relation_name,'select,insert,update,delete')
      or not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=relation_name and c.relrowsecurity)
    then raise exception 'Duo browser ACL/RLS boundary failed: %',relation_name; end if;
  end loop;

  if not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_read' and cmd='SELECT' and roles=array['authenticated']::name[])
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_send' and cmd='INSERT' and roles=array['authenticated']::name[])
    or exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and (roles @> array['anon']::name[] or roles @> array['public']::name[]))
  then raise exception 'Realtime authenticated-only RLS boundary changed'; end if;
end $$;

select 'duo_es256_realtime_verify_ok';
