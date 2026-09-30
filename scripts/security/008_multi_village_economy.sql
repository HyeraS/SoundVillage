-- Stage 2A forward migration: parallel six-village economy foundation.
-- Review first. Never run automatically or directly against production.
-- Prerequisites: security migrations 001 through 007.
-- This migration deliberately leaves participant_currency, currency_transactions,
-- participant_outfits, participant_interior_items, and all legacy RPCs unchanged.
begin;

do $$
begin
  if to_regclass('public.study_participants') is null then
    raise exception 'PREFLIGHT_REQUIRED: public.study_participants is missing';
  end if;
  if to_regprocedure('private.current_participant_id()') is null then
    raise exception 'PREFLIGHT_REQUIRED: private.current_participant_id() is missing';
  end if;
end $$;

create table public.participant_village_wallets (
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  village text not null check (village in ('Animal','Human','Nature','Urban','Music','Lab')),
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (participant_id, village)
);

create table public.village_currency_ledger (
  id bigint generated always as identity primary key,
  participant_id text not null references public.study_participants(participant_id) on delete restrict,
  village text not null check (village in ('Animal','Human','Nature','Urban','Music','Lab')),
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  entry_type text not null check (entry_type in (
    'spend_catalog','earn_attendance','earn_annotation','earn_vote','earn_completion'
  )),
  related_id text not null,
  operation_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (participant_id, entry_type, related_id, village)
);
create index village_currency_ledger_participant_created_idx
  on public.village_currency_ledger(participant_id, created_at desc);
create index village_currency_ledger_operation_idx
  on public.village_currency_ledger(operation_id);

create table public.multi_village_purchase_results (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  idempotency_key uuid not null,
  purchase_id uuid not null default gen_random_uuid(),
  item_id text not null,
  status text not null default 'processing' check (status in ('processing','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (auth_user_id, idempotency_key),
  unique (purchase_id)
);

create table public.participant_catalog_items (
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  item_id text not null,
  acquisition_source text not null check (acquisition_source in (
    'individual_purchase','bundle_purchase','completion_reward'
  )),
  source_purchase_id uuid references public.multi_village_purchase_results(purchase_id),
  acquired_at timestamptz not null default now(),
  primary key (participant_id, item_id)
);

create table public.participant_collection_completions (
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  set_id text not null,
  reward_id text not null,
  status text not null check (status in ('eligible_pending_asset','granted')),
  asset_id text,
  eligible_at timestamptz not null default now(),
  granted_at timestamptz,
  grant_idempotency_key uuid,
  grant_operation_id uuid,
  primary key (participant_id, reward_id),
  check ((status = 'eligible_pending_asset' and asset_id is null and granted_at is null and grant_operation_id is null)
    or (status = 'granted' and asset_id is not null and granted_at is not null and grant_operation_id is not null))
);

create table public.multi_village_attendance_weeks (
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  week_start date not null,
  hmac_version text not null check (hmac_version = 'hmac-sha256-v1'),
  village_permutation text[] not null,
  day7_village text check (day7_village in ('Animal','Human','Nature','Urban','Music','Lab')),
  created_at timestamptz not null default now(),
  primary key (participant_id, week_start),
  check (cardinality(village_permutation) = 6)
);

create table public.multi_village_attendance_claims (
  participant_id text not null references public.study_participants(participant_id) on delete cascade,
  week_start date not null,
  attendance_day smallint not null check (attendance_day between 1 and 7),
  village text not null check (village in ('Animal','Human','Nature','Urban','Music','Lab')),
  amount integer not null check (amount in (2,3,4,5)),
  operation_id uuid not null,
  idempotency_key uuid not null,
  result jsonb not null,
  claimed_at timestamptz not null default now(),
  primary key (participant_id, week_start, attendance_day),
  unique (participant_id, idempotency_key),
  foreign key (participant_id, week_start)
    references public.multi_village_attendance_weeks(participant_id, week_start) on delete cascade
);

create or replace function private.reject_immutable_village_ledger_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_VILLAGE_LEDGER';
end $$;
create trigger village_currency_ledger_immutable
before update or delete on public.village_currency_ledger
for each row execute function private.reject_immutable_village_ledger_mutation();

create or replace function private.is_canonical_village_array(p_villages text[])
returns boolean language sql immutable security definer set search_path = '' as $$
  select cardinality(p_villages) = 6
    and (select count(distinct village) from unnest(p_villages) as valueset(village)) = 6
    and not exists (
      select 1 from unnest(p_villages) as valueset(village)
      where village not in ('Animal','Human','Nature','Urban','Music','Lab')
    )
$$;

create or replace function private.ensure_multi_village_wallets(p_participant_id text)
returns void language sql security definer set search_path = '' as $$
  insert into public.participant_village_wallets(participant_id, village, balance)
  select p_participant_id, village, 0
  from unnest(array['Animal','Human','Nature','Urban','Music','Lab']::text[]) as ordered(village)
  on conflict (participant_id, village) do nothing
$$;

create or replace function private.multi_village_balances(p_participant_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'Animal', coalesce(max(balance) filter (where village='Animal'),0),
    'Human', coalesce(max(balance) filter (where village='Human'),0),
    'Nature', coalesce(max(balance) filter (where village='Nature'),0),
    'Urban', coalesce(max(balance) filter (where village='Urban'),0),
    'Music', coalesce(max(balance) filter (where village='Music'),0),
    'Lab', coalesce(max(balance) filter (where village='Lab'),0)
  ) from public.participant_village_wallets where participant_id=p_participant_id
$$;

create or replace function private.multi_village_today_kst()
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create or replace function private.complete_purchase_result(
  p_auth_user_id uuid, p_idempotency_key uuid, p_result jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.multi_village_purchase_results
  set status='completed', result=p_result, completed_at=now()
  where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
  return p_result;
end $$;

create or replace function public.get_multi_village_participant_admin(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_pid text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  return jsonb_build_object('ok',true,'participantId',v_pid);
end $$;

create or replace function public.get_multi_village_wallets_admin(p_auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  perform private.ensure_multi_village_wallets(v_pid);
  return jsonb_build_object('ok',true,'balances',private.multi_village_balances(v_pid));
end $$;

create or replace function public.purchase_multi_village_item_admin(
  p_auth_user_id uuid,
  p_item_id text,
  p_item_type text,
  p_cost jsonb,
  p_grant_item_ids text[],
  p_is_bundle boolean,
  p_completion_candidates jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pid text; v_purchase_id uuid; v_existing_item text; v_existing jsonb; v_result jsonb;
  v_village text; v_required bigint; v_balance bigint; v_after bigint;
  v_shortages jsonb := '{}'::jsonb; v_funds jsonb := '{}'::jsonb;
  v_wallet record; v_item text; v_candidate jsonb;
  v_components text[]; v_reward_id text; v_set_id text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if nullif(p_item_id,'') is null or nullif(p_item_type,'') is null
    or p_idempotency_key is null or p_is_bundle is null or cardinality(p_grant_item_ids) < 1
    or cardinality(p_grant_item_ids) <> (select count(distinct item_id) from unnest(p_grant_item_ids) as grants(item_id))
    or jsonb_typeof(p_cost) <> 'object'
    or (select count(*) from jsonb_object_keys(p_cost)) <> 6
    or (select coalesce(sum(value::bigint),0) from jsonb_each_text(p_cost)) < 1
    or exists (select 1 from jsonb_object_keys(p_cost) as keys(village)
      where village not in ('Animal','Human','Nature','Urban','Music','Lab'))
  then raise exception 'INVALID_CATALOG_PURCHASE'; end if;
  foreach v_village in array array['Animal','Human','Nature','Urban','Music','Lab']::text[] loop
    if not (p_cost ? v_village) or (p_cost->>v_village) !~ '^[0-9]+$' then
      raise exception 'INVALID_CATALOG_PURCHASE';
    end if;
  end loop;

  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;

  insert into public.multi_village_purchase_results(auth_user_id,participant_id,idempotency_key,item_id)
  values(p_auth_user_id,v_pid,p_idempotency_key,p_item_id) on conflict do nothing
  returning purchase_id into v_purchase_id;
  if v_purchase_id is null then
    select item_id,result into v_existing_item,v_existing
    from public.multi_village_purchase_results
    where auth_user_id=p_auth_user_id and idempotency_key=p_idempotency_key;
    if v_existing_item <> p_item_id then
      return jsonb_build_object('ok',false,'reason','idempotency_key_reused');
    end if;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION_IN_PROGRESS'; end if;
    return v_existing;
  end if;

  perform private.ensure_multi_village_wallets(v_pid);
  for v_wallet in
    select village,balance from public.participant_village_wallets
    where participant_id=v_pid
    order by array_position(array['Animal','Human','Nature','Urban','Music','Lab']::text[],village)
    for update
  loop null; end loop;

  if p_is_bundle then
    if exists (select 1 from public.participant_catalog_items
      where participant_id=v_pid and item_id=any(p_grant_item_ids)) then
      v_result:=jsonb_build_object('ok',false,'reason','bundle_partially_owned',
        'ownedItemIds',(select coalesce(jsonb_agg(item_id order by item_id),'[]'::jsonb)
          from public.participant_catalog_items where participant_id=v_pid and item_id=any(p_grant_item_ids)));
      return private.complete_purchase_result(p_auth_user_id,p_idempotency_key,v_result);
    end if;
  elsif exists (select 1 from public.participant_catalog_items
    where participant_id=v_pid and item_id=p_item_id) then
    return private.complete_purchase_result(p_auth_user_id,p_idempotency_key,
      jsonb_build_object('ok',false,'reason','already_owned'));
  end if;

  foreach v_village in array array['Animal','Human','Nature','Urban','Music','Lab']::text[] loop
    v_required := (p_cost->>v_village)::bigint;
    select balance into v_balance from public.participant_village_wallets
      where participant_id=v_pid and village=v_village;
    v_funds := v_funds || jsonb_build_object(v_village,jsonb_build_object(
      'balance',v_balance,'required',v_required,'shortage',greatest(v_required-v_balance,0)));
    if v_balance < v_required then
      v_shortages := v_shortages || jsonb_build_object(v_village,jsonb_build_object(
        'balance',v_balance,'required',v_required,'shortage',v_required-v_balance));
    end if;
  end loop;
  if v_shortages <> '{}'::jsonb then
    v_result:=jsonb_build_object('ok',false,'reason','insufficient_funds',
      'balances',private.multi_village_balances(v_pid),'cost',p_cost,
      'wallets',v_funds,'shortages',v_shortages);
    return private.complete_purchase_result(p_auth_user_id,p_idempotency_key,v_result);
  end if;

  foreach v_village in array array['Animal','Human','Nature','Urban','Music','Lab']::text[] loop
    v_required := (p_cost->>v_village)::bigint;
    if v_required > 0 then
      update public.participant_village_wallets
      set balance=balance-v_required,updated_at=now()
      where participant_id=v_pid and village=v_village returning balance into v_after;
      insert into public.village_currency_ledger(
        participant_id,village,amount,balance_after,entry_type,related_id,operation_id,idempotency_key
      ) values(v_pid,v_village,-v_required,v_after,'spend_catalog',p_item_id,v_purchase_id,p_idempotency_key);
    end if;
  end loop;

  foreach v_item in array p_grant_item_ids loop
    insert into public.participant_catalog_items(participant_id,item_id,acquisition_source,source_purchase_id)
    values(v_pid,v_item,case when p_is_bundle then 'bundle_purchase' else 'individual_purchase' end,v_purchase_id);
  end loop;

  if not p_is_bundle and jsonb_typeof(p_completion_candidates)='array' then
    for v_candidate in select candidate from jsonb_array_elements(p_completion_candidates) as candidates(candidate) loop
      v_set_id:=v_candidate->>'setId'; v_reward_id:=v_candidate->>'rewardId';
      select array_agg(component order by position) into v_components
        from jsonb_array_elements_text(v_candidate->'bundleItemIds') with ordinality as components(component,position);
      if coalesce((v_candidate->>'assetSelectionRequired')::boolean,false)
        and (v_candidate->>'assetId') like 'placeholder_%'
        and cardinality(v_components)>0
        and not exists (select 1 from unnest(v_components) as components(component)
          where not exists (select 1 from public.participant_catalog_items owned
            where owned.participant_id=v_pid and owned.item_id=component
              and owned.acquisition_source='individual_purchase'))
      then
        insert into public.participant_collection_completions(participant_id,set_id,reward_id,status)
        values(v_pid,v_set_id,v_reward_id,'eligible_pending_asset') on conflict do nothing;
      end if;
    end loop;
  end if;

  v_result:=jsonb_build_object('ok',true,'purchaseId',v_purchase_id,'itemId',p_item_id,
    'itemType',p_item_type,'grantedItemIds',to_jsonb(p_grant_item_ids),
    'balances',private.multi_village_balances(v_pid));
  return private.complete_purchase_result(p_auth_user_id,p_idempotency_key,v_result);
end $$;

create or replace function public.grant_collection_completion_reward_admin(
  p_auth_user_id uuid, p_reward_id text, p_asset_id text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_row public.participant_collection_completions%rowtype; v_operation uuid:=gen_random_uuid();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null or nullif(p_asset_id,'') is null or p_asset_id like 'placeholder_%' then
    return jsonb_build_object('ok',false,'reason','asset_selection_required');
  end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  select * into v_row from public.participant_collection_completions
    where participant_id=v_pid and reward_id=p_reward_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','completion_not_eligible'); end if;
  if v_row.status='granted' then
    return jsonb_build_object('ok',true,'rewardId',p_reward_id,'assetId',v_row.asset_id,
      'operationId',v_row.grant_operation_id);
  end if;
  insert into public.participant_catalog_items(participant_id,item_id,acquisition_source)
    values(v_pid,p_asset_id,'completion_reward') on conflict do nothing;
  update public.participant_collection_completions set status='granted',asset_id=p_asset_id,
    granted_at=now(),grant_idempotency_key=p_idempotency_key,grant_operation_id=v_operation
    where participant_id=v_pid and reward_id=p_reward_id;
  return jsonb_build_object('ok',true,'rewardId',p_reward_id,'assetId',p_asset_id,
    'operationId',v_operation);
end $$;

create or replace function private.ensure_attendance_week(
  p_participant_id text,p_week_start date,p_permutation text[],p_hmac_version text
) returns public.multi_village_attendance_weeks
language plpgsql security definer set search_path = '' as $$
declare v_row public.multi_village_attendance_weeks%rowtype;
begin
  if p_hmac_version <> 'hmac-sha256-v1' or not private.is_canonical_village_array(p_permutation) then
    raise exception 'INVALID_ATTENDANCE_DECISION';
  end if;
  insert into public.multi_village_attendance_weeks(participant_id,week_start,hmac_version,village_permutation)
  values(p_participant_id,p_week_start,p_hmac_version,p_permutation) on conflict do nothing;
  select * into v_row from public.multi_village_attendance_weeks
    where participant_id=p_participant_id and week_start=p_week_start for update;
  if v_row.hmac_version<>p_hmac_version or v_row.village_permutation<>p_permutation then
    raise exception 'ATTENDANCE_DECISION_MISMATCH';
  end if;
  return v_row;
end $$;

create or replace function public.get_multi_village_attendance_admin(
  p_auth_user_id uuid,p_week_start date,p_permutation text[],p_hmac_version text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_today date:=private.multi_village_today_kst();
  v_week_start date; v_day integer; v_week public.multi_village_attendance_weeks%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  v_day:=extract(isodow from v_today)::integer; v_week_start:=v_today-(v_day-1);
  if p_week_start<>v_week_start then raise exception 'ATTENDANCE_DATE_MISMATCH'; end if;
  v_week:=private.ensure_attendance_week(v_pid,v_week_start,p_permutation,p_hmac_version);
  perform private.ensure_multi_village_wallets(v_pid);
  return jsonb_build_object('ok',true,'weekStart',v_week_start,'attendanceDay',v_day,
    'villagePermutation',to_jsonb(v_week.village_permutation),'day7Village',v_week.day7_village,
    'claims',(select coalesce(jsonb_agg(jsonb_build_object('day',attendance_day,'village',village,'amount',amount)
      order by attendance_day),'[]'::jsonb) from public.multi_village_attendance_claims
      where participant_id=v_pid and week_start=v_week_start),
    'balances',private.multi_village_balances(v_pid));
end $$;

create or replace function public.claim_multi_village_attendance_admin(
  p_auth_user_id uuid,p_expected_local_date date,p_expected_week_start date,
  p_permutation text[],p_day7_tie_order text[],p_hmac_version text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_today date:=private.multi_village_today_kst();
  v_week_start date; v_day integer; v_amount integer; v_village text; v_after bigint;
  v_week public.multi_village_attendance_weeks%rowtype; v_claim public.multi_village_attendance_claims%rowtype;
  v_wallet record; v_min_balance bigint; v_operation uuid:=gen_random_uuid(); v_result jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_idempotency_key is null or p_expected_local_date is null or p_expected_week_start is null
    or not private.is_canonical_village_array(p_day7_tie_order) then
    raise exception 'INVALID_ATTENDANCE_DECISION';
  end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  v_day:=extract(isodow from v_today)::integer; v_week_start:=v_today-(v_day-1);
  if p_expected_local_date<>v_today or p_expected_week_start<>v_week_start then
    raise exception 'ATTENDANCE_DATE_MISMATCH';
  end if;
  v_week:=private.ensure_attendance_week(v_pid,v_week_start,p_permutation,p_hmac_version);
  perform private.ensure_multi_village_wallets(v_pid);
  for v_wallet in select village,balance from public.participant_village_wallets
    where participant_id=v_pid
    order by array_position(array['Animal','Human','Nature','Urban','Music','Lab']::text[],village)
    for update loop null; end loop;

  select * into v_claim from public.multi_village_attendance_claims
    where participant_id=v_pid and week_start=v_week_start and attendance_day=v_day;
  if found then
    return v_claim.result;
  end if;

  if v_day<=6 then
    v_village:=v_week.village_permutation[v_day];
    v_amount:=(array[2,2,2,3,3,4])[v_day];
  else
    if v_week.day7_village is null then
      select min(balance) into v_min_balance from public.participant_village_wallets where participant_id=v_pid;
      select candidate into v_village from unnest(p_day7_tie_order) with ordinality ordered(candidate,position)
      join public.participant_village_wallets wallet on wallet.participant_id=v_pid and wallet.village=ordered.candidate
      where wallet.balance=v_min_balance order by ordered.position limit 1;
      update public.multi_village_attendance_weeks set day7_village=v_village
        where participant_id=v_pid and week_start=v_week_start;
    else v_village:=v_week.day7_village; end if;
    v_amount:=5;
  end if;

  update public.participant_village_wallets set balance=balance+v_amount,updated_at=now()
    where participant_id=v_pid and village=v_village returning balance into v_after;
  v_result:=jsonb_build_object('ok',true,'weekStart',v_week_start,'attendanceDay',v_day,
    'village',v_village,'amount',v_amount,'balances',private.multi_village_balances(v_pid));
  insert into public.multi_village_attendance_claims(
    participant_id,week_start,attendance_day,village,amount,operation_id,idempotency_key,result
  ) values(v_pid,v_week_start,v_day,v_village,v_amount,v_operation,p_idempotency_key,v_result);
  insert into public.village_currency_ledger(
    participant_id,village,amount,balance_after,entry_type,related_id,operation_id,idempotency_key
  ) values(v_pid,v_village,v_amount,v_after,'earn_attendance',v_week_start::text||':'||v_day,v_operation,p_idempotency_key);
  return v_result;
end $$;

-- Future annotation/vote transition hook. The trusted DB resolves the village
-- and fixed amount from the already-stored result row; callers cannot supply either.
create or replace function public.credit_verified_activity_village_admin(
  p_auth_user_id uuid,p_activity_type text,p_result_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_village text; v_amount integer; v_after bigint; v_operation uuid:=gen_random_uuid();
  v_existing public.village_currency_ledger%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_result_id is null or p_idempotency_key is null then raise exception 'INVALID_REWARD_SOURCE'; end if;
  select participant_id into v_pid from public.study_participants
    where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  if p_activity_type='annotation' then
    select zone into v_village from public.annotations
      where id=p_result_id and participant_id=v_pid and not is_skipped;
    v_amount:=5;
  elsif p_activity_type='vote' then
    select zone into v_village from public.votes where id=p_result_id and participant_id=v_pid;
    v_amount:=2;
  else raise exception 'INVALID_REWARD_SOURCE'; end if;
  if v_village is null or v_village not in ('Animal','Human','Nature','Urban','Music','Lab') then
    raise exception 'INVALID_REWARD_VILLAGE';
  end if;
  select * into v_existing from public.village_currency_ledger where participant_id=v_pid
    and entry_type='earn_'||p_activity_type and related_id=p_result_id::text and village=v_village;
  if found then return jsonb_build_object('ok',true,'village',v_village,'amount',v_existing.amount,
    'balance',v_existing.balance_after); end if;
  perform private.ensure_multi_village_wallets(v_pid);
  perform 1 from public.participant_village_wallets where participant_id=v_pid and village=v_village for update;
  select * into v_existing from public.village_currency_ledger where participant_id=v_pid
    and entry_type='earn_'||p_activity_type and related_id=p_result_id::text and village=v_village;
  if found then return jsonb_build_object('ok',true,'village',v_village,'amount',v_existing.amount,
    'balance',v_existing.balance_after); end if;
  update public.participant_village_wallets set balance=balance+v_amount,updated_at=now()
    where participant_id=v_pid and village=v_village returning balance into v_after;
  insert into public.village_currency_ledger(
    participant_id,village,amount,balance_after,entry_type,related_id,operation_id,idempotency_key
  ) values(v_pid,v_village,v_amount,v_after,'earn_'||p_activity_type,p_result_id::text,v_operation,p_idempotency_key);
  return jsonb_build_object('ok',true,'village',v_village,'amount',v_amount,'balance',v_after);
end $$;

alter table public.participant_village_wallets enable row level security;
alter table public.village_currency_ledger enable row level security;
alter table public.multi_village_purchase_results enable row level security;
alter table public.participant_catalog_items enable row level security;
alter table public.participant_collection_completions enable row level security;
alter table public.multi_village_attendance_weeks enable row level security;
alter table public.multi_village_attendance_claims enable row level security;

create policy participant_village_wallets_select_own on public.participant_village_wallets
  for select to authenticated using (participant_id=private.current_participant_id());
create policy village_currency_ledger_select_own on public.village_currency_ledger
  for select to authenticated using (participant_id=private.current_participant_id());
create policy participant_catalog_items_select_own on public.participant_catalog_items
  for select to authenticated using (participant_id=private.current_participant_id());
create policy participant_collection_completions_select_own on public.participant_collection_completions
  for select to authenticated using (participant_id=private.current_participant_id());
create policy multi_village_attendance_weeks_select_own on public.multi_village_attendance_weeks
  for select to authenticated using (participant_id=private.current_participant_id());
create policy multi_village_attendance_claims_select_own on public.multi_village_attendance_claims
  for select to authenticated using (participant_id=private.current_participant_id());

revoke all on public.participant_village_wallets,public.village_currency_ledger,
  public.multi_village_purchase_results,public.participant_catalog_items,
  public.participant_collection_completions,public.multi_village_attendance_weeks,
  public.multi_village_attendance_claims from public,anon,authenticated;
grant select on public.participant_village_wallets,public.village_currency_ledger,
  public.participant_catalog_items,public.participant_collection_completions,
  public.multi_village_attendance_weeks,public.multi_village_attendance_claims to authenticated;

revoke all on function private.reject_immutable_village_ledger_mutation() from public,anon,authenticated;
revoke all on function private.is_canonical_village_array(text[]) from public,anon,authenticated;
revoke all on function private.ensure_multi_village_wallets(text) from public,anon,authenticated;
revoke all on function private.multi_village_balances(text) from public,anon,authenticated;
revoke all on function private.multi_village_today_kst() from public,anon,authenticated;
revoke all on function private.complete_purchase_result(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.ensure_attendance_week(text,date,text[],text) from public,anon,authenticated;

revoke all on function public.get_multi_village_participant_admin(uuid) from public,anon,authenticated;
revoke all on function public.get_multi_village_wallets_admin(uuid) from public,anon,authenticated;
revoke all on function public.purchase_multi_village_item_admin(uuid,text,text,jsonb,text[],boolean,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.grant_collection_completion_reward_admin(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.get_multi_village_attendance_admin(uuid,date,text[],text) from public,anon,authenticated;
revoke all on function public.claim_multi_village_attendance_admin(uuid,date,date,text[],text[],text,uuid) from public,anon,authenticated;
revoke all on function public.credit_verified_activity_village_admin(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_multi_village_participant_admin(uuid) to service_role;
grant execute on function public.get_multi_village_wallets_admin(uuid) to service_role;
grant execute on function public.purchase_multi_village_item_admin(uuid,text,text,jsonb,text[],boolean,jsonb,uuid) to service_role;
grant execute on function public.grant_collection_completion_reward_admin(uuid,text,text,uuid) to service_role;
grant execute on function public.get_multi_village_attendance_admin(uuid,date,text[],text) to service_role;
grant execute on function public.claim_multi_village_attendance_admin(uuid,date,date,text[],text[],text,uuid) to service_role;
grant execute on function public.credit_verified_activity_village_admin(uuid,text,uuid,uuid) to service_role;

commit;
