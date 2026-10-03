-- Read-only post-apply verification for 013_character_identity_loadout.sql.
do $$
declare v_column text; v_event text;
begin
  if to_regclass('public.multi_village_character_identity_results') is null then
    raise exception 'identity result table missing';
  end if;
  foreach v_column in array array['skin_id','eyes_id','hair_style_id','hair_color_id'] loop
    if not exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='participant_multi_village_character_loadouts'
        and column_name=v_column and is_nullable='NO' and column_default is not null)
    then raise exception 'invalid identity column: %',v_column; end if;
  end loop;
  if exists(select 1 from public.participant_multi_village_character_loadouts
    where skin_id='' or eyes_id='' or hair_style_id='' or hair_color_id='')
  then raise exception 'empty identity value found'; end if;
  if not (select relrowsecurity from pg_class
    where oid='public.participant_multi_village_character_loadouts'::regclass)
    or not (select relrowsecurity from pg_class
    where oid='public.multi_village_character_identity_results'::regclass)
  then raise exception 'identity RLS missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='participant_multi_village_character_loadouts'
    and policyname='participant_multi_village_character_loadouts_select_own' and cmd='SELECT')
  then raise exception 'own loadout policy missing'; end if;
  if to_regprocedure('public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)') is null
  then raise exception 'identity save RPC missing'; end if;
  if has_table_privilege('anon','public.participant_multi_village_character_loadouts','INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.participant_multi_village_character_loadouts','INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.multi_village_character_identity_results','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.multi_village_character_identity_results','SELECT,INSERT,UPDATE,DELETE')
  then raise exception 'identity table privilege widened'; end if;
  if has_function_privilege('anon','public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)','execute')
    or has_function_privilege('authenticated','public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)','execute')
    or not has_function_privilege('service_role','public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)','execute')
  then raise exception 'identity RPC privilege invalid'; end if;
  foreach v_event in array array[
    'character_identity_save_attempted','character_identity_save_succeeded','character_identity_save_failed'
  ] loop
    if not exists(select 1 from public.user_event_names where event_name=v_event and active)
    then raise exception 'identity event missing: %',v_event; end if;
  end loop;
end $$;
