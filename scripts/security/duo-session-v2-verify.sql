do $$
declare relation_name text; function_signature text; v_event_name text;
begin
  foreach relation_name in array array[
    'duo_v2_sessions','duo_v2_session_members','duo_v2_invites','duo_v2_leases','duo_v2_operation_results'
  ] loop
    if to_regclass('public.'||relation_name) is null then raise exception 'missing relation: %',relation_name; end if;
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=relation_name and c.relrowsecurity)
    then raise exception 'RLS disabled: %',relation_name; end if;
    if has_table_privilege('anon','public.'||relation_name,'select,insert,update,delete')
      or has_table_privilege('authenticated','public.'||relation_name,'select,insert,update,delete')
    then raise exception 'browser table privilege leaked: %',relation_name; end if;
  end loop;

  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name in ('duo_v2_sessions','duo_v2_session_members','duo_v2_invites','duo_v2_leases','duo_v2_operation_results')
    and column_name in ('join_token','invite_token','token','share_token'))
  then raise exception 'raw token column exists'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='duo_v2_invites' and column_name='token_hash')
  then raise exception 'token hash column missing'; end if;

  if not exists(select 1 from pg_indexes where schemaname='public'
      and indexname='duo_v2_one_active_session_per_host' and indexdef ilike '%where (status = ''active''%')
    or not exists(select 1 from pg_indexes where schemaname='public'
      and indexname='duo_v2_one_active_invite_per_session' and indexdef ilike '%where (status = ''active''%')
  then raise exception 'partial uniqueness missing'; end if;

  foreach function_signature in array array[
    'public.create_duo_v2_session_admin(uuid,uuid,text,uuid,text,text)',
    'public.join_duo_v2_session_admin(uuid,uuid,text,uuid,text)',
    'public.get_duo_v2_session_status_admin(uuid,uuid,uuid)',
    'public.get_duo_v2_shared_room_admin(uuid,uuid,uuid)',
    'public.recover_duo_v2_session_admin(uuid,uuid,uuid)',
    'public.heartbeat_duo_v2_session_admin(uuid,uuid,uuid,text,uuid)',
    'public.leave_duo_v2_session_admin(uuid,uuid,uuid,uuid)',
    'public.close_duo_v2_session_admin(uuid,uuid,uuid)',
    'private.complete_duo_v2_operation(uuid,text,uuid,jsonb)',
    'private.duo_v2_participant_active(uuid)',
    'private.duo_v2_host_room_eligible(uuid,text)',
    'private.reject_duo_v2_visitor_legacy_currency_mutation()',
    'public.is_duo_v2_visitor_mutation_blocked_admin(uuid)',
    'private.is_realtime_room_member(text)'
  ] loop
    if to_regprocedure(function_signature) is null then raise exception 'missing function: %',function_signature; end if;
    if not exists(select 1 from pg_proc where oid=to_regprocedure(function_signature)
      and coalesce(proconfig,array[]::text[])=array['search_path=""']::text[])
    then raise exception 'unsafe search_path: %',function_signature; end if;
  end loop;

  if has_function_privilege('authenticated','public.create_duo_v2_session_admin(uuid,uuid,text,uuid,text,text)','execute')
    or has_function_privilege('anon','public.join_duo_v2_session_admin(uuid,uuid,text,uuid,text)','execute')
    or not has_function_privilege('service_role','public.create_duo_v2_session_admin(uuid,uuid,text,uuid,text,text)','execute')
    or not has_function_privilege('service_role','public.join_duo_v2_session_admin(uuid,uuid,text,uuid,text)','execute')
  then raise exception 'Duo RPC privilege boundary failed'; end if;

  if not exists(select 1 from pg_trigger
    where tgrelid='public.currency_transactions'::regclass
      and tgname='duo_v2_visitor_legacy_currency_guard' and not tgisinternal)
  then raise exception 'legacy visitor mutation guard missing'; end if;

  if not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_read' and cmd='SELECT' and roles=array['authenticated']::name[])
    or not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages'
      and policyname='duo_realtime_send' and cmd='INSERT' and roles=array['authenticated']::name[])
  then raise exception 'existing authenticated-only Realtime policies changed'; end if;

  foreach v_event_name in array array[
    'duo_invite_created','duo_invite_revoked','duo_join_attempted','duo_join_succeeded','duo_join_failed','duo_session_closed',
    'duo_connected','duo_disconnected','duo_reconnected'
  ] loop
    if not exists(select 1 from public.user_event_names n where n.event_name=v_event_name and n.active)
    then raise exception 'missing Duo event: %',v_event_name; end if;
  end loop;
end $$;

select 'duo_session_v2_verify_ok';
