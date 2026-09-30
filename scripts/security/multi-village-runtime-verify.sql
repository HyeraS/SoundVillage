-- Read-only verification after 010.
begin transaction read only;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'submit_annotation_economy_v1_admin','submit_museum_vote_economy_v1_admin'
) order by p.proname;

select participant_id,village,balance,
  coalesce((select sum(l.amount) from public.village_currency_ledger l
    where l.participant_id=w.participant_id and l.village=w.village),0) as ledger_net
from public.participant_village_wallets w order by participant_id,village;

select participant_id,entry_type,related_id,village,count(*)
from public.village_currency_ledger
where entry_type in ('earn_annotation','earn_vote')
group by participant_id,entry_type,related_id,village having count(*)<>1;

rollback;
