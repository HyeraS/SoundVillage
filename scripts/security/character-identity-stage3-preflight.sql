-- Read-only preflight for 013_character_identity_loadout.sql.
begin transaction read only;

do $$
declare v_identity_columns integer;
begin
  if to_regclass('public.participant_multi_village_character_loadouts') is null
    or to_regclass('public.duo_v2_sessions') is null
    or to_regprocedure('public.get_multi_village_character_profile_admin(uuid)') is null
    or to_regprocedure('public.equip_multi_village_character_item_admin(uuid,text,text,text,boolean,uuid)') is null
  then raise exception 'PREFLIGHT_REQUIRED: migrations 001 through 012 are incomplete'; end if;
  select count(*) into v_identity_columns from information_schema.columns
    where table_schema='public' and table_name='participant_multi_village_character_loadouts'
      and column_name in ('skin_id','eyes_id','hair_style_id','hair_color_id');
  if v_identity_columns<>0
    or to_regclass('public.multi_village_character_identity_results') is not null
    or to_regprocedure('public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid)') is not null
  then raise exception 'MIGRATION_PARTIAL_OR_ALREADY_APPLIED: 013 Character Identity'; end if;
end $$;

rollback;
