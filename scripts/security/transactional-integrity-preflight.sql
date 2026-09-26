-- READ ONLY. Run before 003 and save every result for researcher review.
begin transaction read only;

-- Candidate duplicates only: no rows are deleted or merged.
select participant_id,sound_id,stage,version,is_skipped,count(*) as row_count
from public.annotations group by participant_id,sound_id,stage,version,is_skipped having count(*)>1
order by row_count desc,participant_id,sound_id;

select participant_id,sound_id,annotation_id,count(*) as row_count
from public.votes group by participant_id,sound_id,annotation_id having count(*)>1
order by row_count desc,participant_id,sound_id;

-- Ledger/cache reconciliation. Any non-zero delta blocks 003 until reviewed.
select p.participant_id,p.balance,coalesce(sum(t.amount),0) as ledger_total,
  p.balance-coalesce(sum(t.amount),0) as delta
from public.participant_currency p left join public.currency_transactions t using(participant_id)
group by p.participant_id,p.balance having p.balance<>coalesce(sum(t.amount),0)
order by abs(p.balance-coalesce(sum(t.amount),0)) desc;

-- Denormalized vote_count reconciliation.
select a.id,a.vote_count,coalesce(v.actual_votes,0) as actual_votes,
  coalesce(a.vote_count,0)-coalesce(v.actual_votes,0) as delta
from public.annotations a left join (
  select annotation_id,count(*) as actual_votes from public.votes group by annotation_id
) v on v.annotation_id=a.id
where coalesce(a.vote_count,0)<>coalesce(v.actual_votes,0)
order by abs(coalesce(a.vote_count,0)-coalesce(v.actual_votes,0)) desc;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and (
  (table_name in ('participant_house_items','participant_house_layout') and column_name in ('quantity','id','item_id','participant_id','grid_x','grid_y'))
  or (table_name='annotations' and column_name in ('id','session_id','selected_features','source_type','audioset_class'))
  or (table_name='votes' and column_name in ('id','annotation_id','session_id'))
)
order by table_name,ordinal_position;

-- Effective public-function grants and fixed search_path review.
select n.nspname,p.proname,p.oid::regprocedure as signature,p.prosecdef,
  coalesce(array_to_string(p.proconfig,','),'') as function_config,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in (
  'submit_annotation_v3','submit_museum_vote_v3','ensure_today_check_in_v3','set_equipped_outfit_v3',
  'secure_purchase_admin','award_participant_currency','increment_currency_balance','increment_vote_count',
  'record_annotation_quest_progress','record_vote_quest_progress'
) order by n.nspname,p.proname,p.oid::regprocedure::text;

rollback;
