-- Read-only Stage 3C preflight. Run before 010; it never mutates data.
begin transaction read only;

select case when to_regclass('public.participant_village_wallets') is null then 'missing_008' else 'ok_008' end as economy_008,
  case when to_regclass('public.participant_multi_village_character_loadouts') is null then 'missing_009' else 'ok_009' end as character_009,
  case when to_regclass('public.annotations') is null or to_regclass('public.votes') is null then 'missing_results' else 'ok_results' end as result_tables;

select village,count(*) as wallet_rows,min(balance) as min_balance,max(balance) as max_balance
from public.participant_village_wallets group by village order by array_position(array['Animal','Human','Nature','Urban','Music','Lab']::text[],village);

select count(*) filter (where balance<0) as negative_wallets,
  count(*) filter (where village not in ('Animal','Human','Nature','Urban','Music','Lab')) as invalid_villages
from public.participant_village_wallets;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'get_multi_village_wallets_admin','purchase_multi_village_item_admin',
  'get_multi_village_character_profile_admin','equip_multi_village_character_item_admin'
) order by p.proname;

rollback;
