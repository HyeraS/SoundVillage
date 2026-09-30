-- Disposable local-Supabase integration checks for migration 008.
-- Run only after applying 001-008 locally:
--   supabase db query --local --file scripts/security/multi-village-economy.integration.sql
-- The outer transaction always rolls back; this script never targets a linked DB.
begin;

select set_config('request.jwt.claim.role','service_role',true);

create temporary table economy_test_identity(user_id uuid primary key, participant_id text not null);
insert into economy_test_identity values
  (gen_random_uuid(),'ECONOMY_2A_A_'||substr(gen_random_uuid()::text,1,8)),
  (gen_random_uuid(),'ECONOMY_2A_B_'||substr(gen_random_uuid()::text,1,8)),
  (gen_random_uuid(),'ECONOMY_2A_C_'||substr(gen_random_uuid()::text,1,8));

insert into auth.users(id,aud,role,created_at,updated_at)
select user_id,'authenticated','authenticated',now(),now() from economy_test_identity;
insert into public.study_participants(participant_id,auth_user_id,group_id,status)
select participant_id,user_id,case row_number() over () when 1 then 'A' else 'B' end,'active'
from economy_test_identity;

do $$
declare
  v_user uuid; v_pid text; v_key uuid:=gen_random_uuid(); v_result jsonb; v_replay jsonb;
  v_before jsonb; v_ledger_count bigint; v_week date; v_today date:=(now() at time zone 'Asia/Seoul')::date;
begin
  select user_id,participant_id into v_user,v_pid from economy_test_identity order by participant_id limit 1;
  v_result:=public.get_multi_village_wallets_admin(v_user);
  if not (v_result->>'ok')::boolean or (select count(*) from public.participant_village_wallets where participant_id=v_pid)<>6 then
    raise exception 'wallet initialization failed';
  end if;
  update public.participant_village_wallets set balance=100 where participant_id=v_pid;

  -- Four-wallet purchase and exact idempotent replay.
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_general','outfit',
    '{"Animal":5,"Human":5,"Nature":5,"Urban":5,"Music":0,"Lab":0}'::jsonb,
    array['integration_general'],false,'[]'::jsonb,v_key);
  v_replay:=public.purchase_multi_village_item_admin(v_user,'integration_general','outfit',
    '{"Animal":5,"Human":5,"Nature":5,"Urban":5,"Music":0,"Lab":0}'::jsonb,
    array['integration_general'],false,'[]'::jsonb,v_key);
  if v_result<>v_replay then raise exception 'purchase replay changed its result'; end if;
  if (select count(*) from public.village_currency_ledger where participant_id=v_pid and related_id='integration_general')<>4 then
    raise exception 'general purchase did not create four debit rows';
  end if;

  -- ALL purchase uses all six wallets.
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_all','event',
    '{"Animal":10,"Human":10,"Nature":10,"Urban":10,"Music":10,"Lab":10}'::jsonb,
    array['integration_all'],false,'[]'::jsonb,gen_random_uuid());
  if (select count(*) from public.village_currency_ledger where participant_id=v_pid and related_id='integration_all')<>6 then
    raise exception 'ALL purchase did not create six debit rows';
  end if;

  -- An insufficient vector changes no wallet, ledger, or ownership row.
  v_before:=private.multi_village_balances(v_pid);
  select count(*) into v_ledger_count from public.village_currency_ledger where participant_id=v_pid;
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_insufficient','outfit',
    '{"Animal":9999,"Human":1,"Nature":1,"Urban":1,"Music":0,"Lab":0}'::jsonb,
    array['integration_insufficient'],false,'[]'::jsonb,gen_random_uuid());
  if v_result->>'reason'<>'insufficient_funds'
    or private.multi_village_balances(v_pid)<>v_before
    or (select count(*) from public.village_currency_ledger where participant_id=v_pid)<>v_ledger_count
    or exists(select 1 from public.participant_catalog_items where participant_id=v_pid and item_id='integration_insufficient')
  then raise exception 'insufficient purchase was not atomic'; end if;

  -- Any owned component blocks a bundle purchase.
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_component_a','interior',
    '{"Animal":1,"Human":1,"Nature":1,"Urban":1,"Music":0,"Lab":0}'::jsonb,
    array['integration_component_a'],false,'[]'::jsonb,gen_random_uuid());
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_bundle','theme_set',
    '{"Animal":1,"Human":1,"Nature":1,"Urban":1,"Music":1,"Lab":1}'::jsonb,
    array['integration_component_a','integration_component_b'],true,'[]'::jsonb,gen_random_uuid());
  if v_result->>'reason'<>'bundle_partially_owned' then raise exception 'partial bundle ownership was not blocked'; end if;

  -- Completing via individual items records eligibility but never grants a placeholder.
  v_result:=public.purchase_multi_village_item_admin(v_user,'integration_component_b','interior',
    '{"Animal":1,"Human":1,"Nature":1,"Urban":1,"Music":0,"Lab":0}'::jsonb,
    array['integration_component_b'],false,
    '[{"setId":"integration_bundle","rewardId":"integration_reward","assetId":"placeholder_integration_reward","assetSelectionRequired":true,"bundleItemIds":["integration_component_a","integration_component_b"]}]'::jsonb,
    gen_random_uuid());
  if not exists(select 1 from public.participant_collection_completions
      where participant_id=v_pid and reward_id='integration_reward' and status='eligible_pending_asset')
    or exists(select 1 from public.participant_catalog_items
      where participant_id=v_pid and item_id like 'placeholder_%')
  then raise exception 'placeholder completion reward boundary failed'; end if;

  -- Current-day attendance is stable on replay and credits exactly once.
  v_week:=v_today-(extract(isodow from v_today)::integer-1); v_key:=gen_random_uuid();
  v_result:=public.claim_multi_village_attendance_admin(v_user,v_today,v_week,
    array['Animal','Human','Nature','Urban','Music','Lab'],
    array['Lab','Music','Urban','Nature','Human','Animal'],'hmac-sha256-v1',v_key);
  v_replay:=public.claim_multi_village_attendance_admin(v_user,v_today,v_week,
    array['Animal','Human','Nature','Urban','Music','Lab'],
    array['Lab','Music','Urban','Nature','Human','Animal'],'hmac-sha256-v1',v_key);
  if v_result<>v_replay or (select count(*) from public.multi_village_attendance_claims
    where participant_id=v_pid and week_start=v_week)<>1 then raise exception 'attendance replay failed'; end if;
end $$;

-- Exercise the public day-7 branch against PostgreSQL without changing the
-- host clock. This private clock replacement exists only inside this outer
-- rollback transaction, so the applied migration retains the real KST clock.
create or replace function private.multi_village_today_kst()
returns date language sql stable security definer set search_path = '' as $$
  select date '2026-10-04'
$$;

do $$
declare
  v_user uuid; v_pid text; v_result jsonb; v_replay jsonb; v_mismatch_blocked boolean:=false;
  v_permutation text[]:=array['Animal','Human','Nature','Urban','Music','Lab'];
begin
  select user_id,participant_id into v_user,v_pid
  from economy_test_identity where participant_id like 'ECONOMY_2A_C_%';
  perform public.get_multi_village_wallets_admin(v_user);
  update public.participant_village_wallets set balance=10 where participant_id=v_pid;
  update public.participant_village_wallets set balance=1
    where participant_id=v_pid and village in ('Animal','Human');

  v_result:=public.claim_multi_village_attendance_admin(
    v_user,date '2026-10-04',date '2026-09-28',v_permutation,
    array['Human','Animal','Nature','Urban','Music','Lab'],'hmac-sha256-v1',gen_random_uuid());
  v_replay:=public.claim_multi_village_attendance_admin(
    v_user,date '2026-10-04',date '2026-09-28',v_permutation,
    array['Animal','Human','Nature','Urban','Music','Lab'],'hmac-sha256-v1',gen_random_uuid());
  if v_result<>v_replay or v_result->>'village'<>'Human' or (v_result->>'amount')::integer<>5 then
    raise exception 'day-7 minimum balance or persisted HMAC tie decision failed';
  end if;
  if (select day7_village from public.multi_village_attendance_weeks
      where participant_id=v_pid and week_start=date '2026-09-28')<>'Human' then
    raise exception 'day-7 village was not persisted';
  end if;

  begin
    perform public.get_multi_village_attendance_admin(v_user,date '2026-09-28',
      array['Human','Animal','Nature','Urban','Music','Lab'],'hmac-sha256-v1');
  exception when others then
    v_mismatch_blocked:=true;
  end;
  if not v_mismatch_blocked then raise exception 'stored permutation unexpectedly changed'; end if;

  insert into public.multi_village_attendance_claims(
    participant_id,week_start,attendance_day,village,amount,operation_id,idempotency_key,result
  )
  select v_pid,date '2026-09-28',day,v_permutation[day],
    (array[2,2,2,3,3,4])[day],gen_random_uuid(),gen_random_uuid(),'{}'::jsonb
  from generate_series(1,6) day;
  if (select sum(amount) from public.multi_village_attendance_claims
      where participant_id=v_pid and week_start=date '2026-09-28')<>21 then
    raise exception 'weekly attendance total is not 21';
  end if;
end $$;

-- Authenticated users can read only their own six rows and cannot mutate them.
select set_config('request.jwt.claim.sub',(select user_id::text from economy_test_identity order by participant_id limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.participant_village_wallets;
  if v_count<>6 then raise exception 'RLS exposed another participant wallet'; end if;
  begin
    update public.participant_village_wallets set balance=balance+1;
    raise exception 'authenticated direct wallet mutation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
