-- Read-only post-apply verification for 008_multi_village_economy.sql.
do $$
declare v_table text; v_function text;
begin
  foreach v_table in array array[
    'participant_village_wallets','village_currency_ledger','multi_village_purchase_results',
    'participant_catalog_items','participant_collection_completions',
    'multi_village_attendance_weeks','multi_village_attendance_claims'
  ] loop
    if to_regclass('public.'||v_table) is null then raise exception 'missing table: %',v_table; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)) then
      raise exception 'RLS disabled: %',v_table;
    end if;
  end loop;
  foreach v_function in array array[
    'private.multi_village_today_kst()',
    'public.get_multi_village_wallets_admin(uuid)',
    'public.purchase_multi_village_item_admin(uuid,text,text,jsonb,text[],boolean,jsonb,uuid)',
    'public.claim_multi_village_attendance_admin(uuid,date,date,text[],text[],text,uuid)',
    'public.credit_verified_activity_village_admin(uuid,text,uuid,uuid)'
  ] loop
    if to_regprocedure(v_function) is null then raise exception 'missing function: %',v_function; end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid='public.village_currency_ledger'::regclass
    and tgname='village_currency_ledger_immutable' and not tgisinternal) then
    raise exception 'immutable ledger trigger missing';
  end if;
end $$;
