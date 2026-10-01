-- Read-only verification after the Stage 4A / 011 migration.
begin transaction read only;

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'participant_economy_v1_rooms',
    'economy_v1_room_save_results',
    'participant_economy_v1_room_shares'
  ] loop
    if to_regclass('public.' || v_name) is null then
      raise exception 'missing Stage 4A relation: %', v_name;
    end if;
  end loop;

  if not (select relrowsecurity from pg_class where oid='public.participant_economy_v1_rooms'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.economy_v1_room_save_results'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.participant_economy_v1_room_shares'::regclass)
  then raise exception 'Stage 4A RLS is not enabled'; end if;
end $$;

do $$
declare
  v_oid regprocedure;
begin
  foreach v_oid in array array[
    'public.get_economy_v1_room_admin(uuid)'::regprocedure,
    'public.save_economy_v1_room_admin(uuid,uuid,text,bigint,jsonb,text[],text[],integer)'::regprocedure,
    'public.get_or_create_economy_v1_room_share_admin(uuid)'::regprocedure,
    'public.get_economy_v1_shared_room_admin(uuid,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon',v_oid,'execute')
      or has_function_privilege('authenticated',v_oid,'execute')
      or not has_function_privilege('service_role',v_oid,'execute')
    then raise exception 'invalid Stage 4A function ACL: %', v_oid; end if;
    if not exists (
      select 1 from pg_proc where oid=v_oid and prosecdef
        and coalesce(proconfig,array[]::text[])=array['search_path=""']::text[]
    ) then raise exception 'invalid Stage 4A function security/search_path: %', v_oid; end if;
  end loop;

  v_oid := 'private.complete_economy_v1_room_save(uuid,uuid,jsonb)'::regprocedure;
  if has_function_privilege('anon',v_oid,'execute')
    or has_function_privilege('authenticated',v_oid,'execute')
    or not exists(select 1 from pg_proc where oid=v_oid and prosecdef
      and coalesce(proconfig,array[]::text[])=array['search_path=""']::text[])
  then raise exception 'invalid private Stage 4A helper boundary'; end if;
end $$;

do $$
declare v_role text; v_relation text;
begin
  foreach v_relation in array array[
    'participant_economy_v1_rooms','economy_v1_room_save_results','participant_economy_v1_room_shares'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,'public.'||v_relation,'select,insert,update,delete,truncate,references,trigger')
      then raise exception 'forbidden Stage 4A table privilege: %.%', v_role,v_relation; end if;
    end loop;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_relation)
    then raise exception 'unexpected browser-facing Stage 4A RLS policy: %',v_relation; end if;
  end loop;
end $$;

do $$
declare v_definition text;
begin
  if (select count(*) from pg_constraint where contype='f'
      and conrelid in ('public.participant_economy_v1_rooms'::regclass,
        'public.economy_v1_room_save_results'::regclass,
        'public.participant_economy_v1_room_shares'::regclass))<>4
  then raise exception 'Stage 4A foreign-key contract is incomplete'; end if;
  if not exists(select 1 from pg_constraint where contype='u'
      and conrelid='public.participant_economy_v1_room_shares'::regclass)
    or not exists(select 1 from pg_constraint where contype='p'
      and conrelid='public.economy_v1_room_save_results'::regclass)
  then raise exception 'Stage 4A unique/idempotency constraints are incomplete'; end if;
  select string_agg(pg_get_constraintdef(oid),' ') into v_definition from pg_constraint
    where conrelid in ('public.participant_economy_v1_rooms'::regclass,
      'public.economy_v1_room_save_results'::regclass);
  if v_definition not like '%revision > 0%'
    or v_definition not like '%invite_unique_item_count%100%'
    or v_definition not like '%pg_column_size(room)%65536%'
    or v_definition not like '%request_hash%[0-9a-f]%64%'
  then raise exception 'Stage 4A check constraints are incomplete'; end if;
end $$;

do $$
begin
  if not exists(select 1 from public.user_event_names where event_name='interior_bundle_purchase_blocked' and active)
    or not exists(select 1 from public.user_event_names where event_name='interior_invite_unlocked' and active)
  then raise exception 'Stage 4A event names are missing'; end if;
  if position('cost_vector' in pg_get_functiondef('public.record_user_events_v1(uuid,jsonb)'::regprocedure))=0
    or position('unique_item_count' in pg_get_functiondef('public.record_user_events_v1(uuid,jsonb)'::regprocedure))=0
    or position('price_displayed' in pg_get_functiondef('public.record_user_events_v1(uuid,jsonb)'::regprocedure))=0
    or position('quest_ids' in pg_get_functiondef('public.record_user_events_v1(uuid,jsonb)'::regprocedure))=0
    or position('v_village_allowed_keys' in pg_get_functiondef('public.record_user_events_v1(uuid,jsonb)'::regprocedure))=0
  then raise exception 'Stage 4A event metadata allow-list is incomplete'; end if;
  if has_function_privilege('anon','public.record_user_events_v1(uuid,jsonb)','execute')
    or not has_function_privilege('authenticated','public.record_user_events_v1(uuid,jsonb)','execute')
  then raise exception 'Stage 4A event RPC ACL regressed'; end if;
end $$;

rollback;
