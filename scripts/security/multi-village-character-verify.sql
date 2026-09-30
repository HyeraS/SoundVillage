-- Read-only post-apply verification for 009_multi_village_character_loadout.sql.
do $$
declare v_table text; v_function text;
begin
  foreach v_table in array array[
    'participant_multi_village_character_loadouts','multi_village_character_equip_results'
  ] loop
    if to_regclass('public.'||v_table) is null then raise exception 'missing table: %',v_table; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)) then
      raise exception 'RLS disabled: %',v_table;
    end if;
  end loop;
  foreach v_function in array array[
    'private.ensure_multi_village_character_loadout(text)',
    'public.get_multi_village_character_profile_admin(uuid)',
    'public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid)'
  ] loop
    if to_regprocedure(v_function) is null then raise exception 'missing function: %',v_function; end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='participant_multi_village_character_loadouts'
    and policyname='participant_multi_village_character_loadouts_select_own' and cmd='SELECT') then
    raise exception 'own-loadout SELECT policy missing';
  end if;
end $$;
