-- Transactional integrity and idempotency. Review first; never run automatically.
-- Prerequisites: 001_auth_foundation.sql then 002_enforce_participant_rls.sql.
begin;

-- These values were already supplied by the UI but the legacy insert omitted them.
alter table public.annotations add column if not exists source_type text;
alter table public.annotations add column if not exists audioset_class text;

create table if not exists public.idempotent_operations (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  idempotency_key uuid not null,
  participant_id text not null references public.study_participants(participant_id),
  status text not null default 'processing' check (status in ('processing','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (auth_user_id, operation_type, idempotency_key)
);
alter table public.idempotent_operations enable row level security;
revoke all on public.idempotent_operations from public, anon, authenticated;

alter table public.currency_transactions add column if not exists idempotency_key uuid;
create unique index if not exists currency_transactions_operation_key_uq
  on public.currency_transactions(participant_id, type, related_id, idempotency_key)
  where idempotency_key is not null;

do $$ begin
  if exists(select 1 from public.participant_currency where balance < 0) then
    raise exception 'preflight_failed: negative participant_currency balance exists';
  end if;
end $$;
alter table public.participant_currency drop constraint if exists participant_currency_nonnegative;
alter table public.participant_currency add constraint participant_currency_nonnegative check (balance >= 0);

create or replace function private.require_current_participant()
returns public.study_participants
language plpgsql stable security definer set search_path = ''
as $$
declare v_row public.study_participants%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.study_participants where auth_user_id=auth.uid();
  if not found then raise exception 'PARTICIPANT_NOT_CLAIMED'; end if;
  if v_row.status <> 'active' then raise exception 'PARTICIPANT_INACTIVE'; end if;
  return v_row;
end $$;
revoke all on function private.require_current_participant() from public, anon, authenticated;

-- The row lock makes ledger insertion and balance cache mutation one serialized unit.
create or replace function private.credit_currency_v3(
  p_participant_id text, p_type text, p_amount integer, p_related_id text,
  p_idempotency_key uuid, p_sound_duration_sec numeric default null,
  p_sub_category text default null, p_category_count integer default null,
  p_confidence integer default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_balance integer; v_tx_id bigint;
begin
  if p_amount <= 0 or p_type not in ('earn_annotation','earn_vote','earn_quest','earn_attendance') then
    raise exception 'INVALID_REWARD_SOURCE';
  end if;
  insert into public.participant_currency(participant_id,balance,updated_at)
    values(p_participant_id,0,now()) on conflict(participant_id) do nothing;
  select balance into v_balance from public.participant_currency
    where participant_id=p_participant_id for update;
  insert into public.currency_transactions
    (participant_id,type,amount,related_id,idempotency_key,sound_duration_sec,sub_category,category_count_at_time,confidence)
  values(p_participant_id,p_type,p_amount,p_related_id,p_idempotency_key,p_sound_duration_sec,p_sub_category,p_category_count,p_confidence)
  on conflict(participant_id,related_id,type) do nothing returning id into v_tx_id;
  if v_tx_id is null then
    select id into v_tx_id from public.currency_transactions
      where participant_id=p_participant_id and related_id=p_related_id and type=p_type;
    return jsonb_build_object('awarded',0,'balance',v_balance,'transactionId',v_tx_id);
  end if;
  update public.participant_currency set balance=balance+p_amount,updated_at=now()
    where participant_id=p_participant_id returning balance into v_balance;
  return jsonb_build_object('awarded',p_amount,'balance',v_balance,'transactionId',v_tx_id);
end $$;
revoke all on function private.credit_currency_v3(text,text,integer,text,uuid,numeric,text,integer,integer) from public,anon,authenticated;

create or replace function private.ensure_today_quests_v3(p_pid text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'utc')::date; v_category text;
begin
  select c.sub_category into v_category from public.study_sound_catalog c
  left join public.annotations a on a.participant_id=p_pid and a.sub_category=c.sub_category and not a.is_skipped
  where c.sub_category is not null group by c.sub_category order by count(a.id),c.sub_category limit 1;
  insert into public.participant_daily_quests(participant_id,quest_template_id,assigned_date,target_sub_category)
    select p_pid,t.id,v_today,case when t.type='category_participate' then v_category end
    from public.daily_quest_templates t where t.active
    on conflict(participant_id,quest_template_id,assigned_date) do nothing;
end $$;

create or replace function private.refresh_today_quests_v3(
  p_pid text, p_zone text, p_sub_category text, p_operation_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'utc')::date; v_start timestamptz; v_end timestamptz;
  v_annotations integer; v_votes integer; v_zone_count integer; q record; v_progress integer;
  v_reward jsonb; v_completed jsonb := '[]'::jsonb;
begin
  perform private.ensure_today_quests_v3(p_pid);
  v_start:=v_today::timestamptz; v_end:=v_start+interval '1 day';
  select count(*) into v_annotations from public.annotations where participant_id=p_pid and not is_skipped and created_at>=v_start and created_at<v_end;
  select count(*) into v_votes from public.votes where participant_id=p_pid and created_at>=v_start and created_at<v_end;
  select count(*) into v_zone_count from public.annotations where participant_id=p_pid and zone=p_zone and not is_skipped and created_at>=v_start and created_at<v_end;
  for q in select pq.id,pq.target_sub_category,t.type,t.target_count,t.reward_currency
    from public.participant_daily_quests pq join public.daily_quest_templates t on t.id=pq.quest_template_id
    where pq.participant_id=p_pid and pq.assigned_date=v_today and not pq.completed for update of pq
  loop
    v_progress:=case q.type when 'collect_milestone' then v_annotations when 'vote_n_times' then v_votes
      when 'visit_zone' then case when v_zone_count>0 then q.target_count else 0 end
      when 'category_participate' then case when p_sub_category=q.target_sub_category then q.target_count else 0 end else 0 end;
    update public.participant_daily_quests set progress_count=v_progress,
      completed=(v_progress>=q.target_count),completed_at=case when v_progress>=q.target_count then now() else completed_at end
      where id=q.id and not completed;
    if found and v_progress>=q.target_count then
      v_reward:=private.credit_currency_v3(p_pid,'earn_quest',q.reward_currency,q.id::text,p_operation_key);
      v_completed:=v_completed||jsonb_build_array(jsonb_build_object('questId',q.id,'reward',v_reward));
    end if;
  end loop;
  return jsonb_build_object('completed',v_completed);
end $$;
revoke all on function private.ensure_today_quests_v3(text) from public,anon,authenticated;
revoke all on function private.refresh_today_quests_v3(text,text,text,uuid) from public,anon,authenticated;

create or replace function public.submit_annotation_v3(
  p_idempotency_key uuid,p_sound_id text,p_zone text,p_source_type text default '',
  p_sub_category text default '',p_audioset_class text default '',p_expression_text text default '',
  p_selected_features jsonb default '[]'::jsonb,p_confidence integer default 3,
  p_difficulty integer default 3,p_play_count integer default 0,p_listening_time_sec numeric default 0,
  p_is_skipped boolean default false,p_skip_reason text default '',p_device_info text default '',
  p_stage integer default 1,p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_type text; v_existing jsonb;
  v_annotation_id public.annotations.id%type; v_reward jsonb; v_quests jsonb; v_result jsonb; v_category_count integer;
begin
  v_participant:=private.require_current_participant();
  v_type:=case when p_is_skipped then 'annotation_skip' else 'annotation_submit' end;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),v_type,p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations
      where auth_user_id=auth.uid() and operation_type=v_type and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  if not private.is_known_sound(p_sound_id,p_zone,p_sub_category) then raise exception 'INVALID_SOUND'; end if;
  if p_is_skipped=false and nullif(btrim(p_expression_text),'') is null then raise exception 'INVALID_ANNOTATION'; end if;
  insert into public.annotations(participant_id,session_id,sound_id,zone,source_type,sub_category,audioset_class,
    expression_text,selected_features,confidence,difficulty,play_count,listening_time_sec,is_skipped,skip_reason,
    device_info,stage,is_verified,vote_count,version)
  values(v_participant.participant_id,v_participant.group_id,p_sound_id,p_zone,p_source_type,p_sub_category,p_audioset_class,
    case when p_is_skipped then '' else btrim(p_expression_text) end,p_selected_features,p_confidence,p_difficulty,
    p_play_count,p_listening_time_sec,p_is_skipped,p_skip_reason,p_device_info,p_stage,false,0,p_version)
  returning id into v_annotation_id;
  if p_is_skipped then
    v_reward:=jsonb_build_object('awarded',0);
    v_quests:=jsonb_build_object('completed','[]'::jsonb);
  else
    select count(*) into v_category_count from public.annotations
      where participant_id=v_participant.participant_id and sub_category=p_sub_category and not is_skipped;
    v_reward:=private.credit_currency_v3(v_participant.participant_id,'earn_annotation',5,p_sound_id,
      p_idempotency_key,p_listening_time_sec,p_sub_category,v_category_count,p_confidence);
    v_quests:=private.refresh_today_quests_v3(v_participant.participant_id,p_zone,p_sub_category,p_idempotency_key);
  end if;
  v_result:=jsonb_build_object('annotationId',v_annotation_id,'reward',v_reward,'quests',v_quests,'skipped',p_is_skipped);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=auth.uid() and operation_type=v_type and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.submit_museum_vote_v3(
  p_idempotency_key uuid,p_sound_id text,p_zone text,p_annotation_id uuid,p_confidence integer default 3,
  p_play_count integer default 0,p_listening_time_sec numeric default 0,p_stage integer default 2,
  p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_existing jsonb; v_vote_id public.votes.id%type;
  v_reward jsonb; v_quests jsonb; v_result jsonb;
begin
  v_participant:=private.require_current_participant();
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),'museum_vote',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
      and operation_type='museum_vote' and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  if not exists(select 1 from public.study_sound_catalog c where c.sound_id=p_sound_id and c.zone=p_zone
      and (c.group_id is null or c.group_id=v_participant.group_id or v_participant.access_scope='all'))
    or not private.is_vote_target_allowed(p_annotation_id,p_sound_id)
    then raise exception 'INVALID_SOUND'; end if;
  insert into public.votes(participant_id,session_id,sound_id,zone,annotation_id,confidence,play_count,listening_time_sec,stage,version)
    values(v_participant.participant_id,v_participant.group_id,p_sound_id,p_zone,p_annotation_id,p_confidence,p_play_count,p_listening_time_sec,p_stage,p_version)
    returning id into v_vote_id;
  v_reward:=private.credit_currency_v3(v_participant.participant_id,'earn_vote',2,p_annotation_id::text,p_idempotency_key,
    p_listening_time_sec,null,null,p_confidence);
  v_quests:=private.refresh_today_quests_v3(v_participant.participant_id,p_zone,null,p_idempotency_key);
  v_result:=jsonb_build_object('voteId',v_vote_id,'reward',v_reward,'quests',v_quests);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=auth.uid() and operation_type='museum_vote' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.ensure_today_check_in_v3(p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_existing jsonb; v_today date:=(now() at time zone 'utc')::date;
  v_last public.participant_attendance%rowtype; v_row public.participant_attendance%rowtype;
  v_day integer; v_reward integer; v_currency jsonb; v_new boolean:=false; v_result jsonb;
begin
  v_participant:=private.require_current_participant();
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),'attendance_claim',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
    and operation_type='attendance_claim' and idempotency_key=p_idempotency_key; return v_existing; end if;
  select * into v_row from public.participant_attendance where participant_id=v_participant.participant_id and check_in_date=v_today for update;
  if not found then
    select * into v_last from public.participant_attendance where participant_id=v_participant.participant_id order by check_in_date desc limit 1;
    v_day:=case when v_last.check_in_date=v_today-1 then (v_last.streak_day%7)+1 else 1 end;
    select reward_currency into v_reward from public.attendance_reward_templates where day_index=v_day;
    insert into public.participant_attendance(participant_id,check_in_date,streak_day,reward_currency)
      values(v_participant.participant_id,v_today,v_day,v_reward) on conflict(participant_id,check_in_date) do nothing returning * into v_row;
    if found then v_new:=true; v_currency:=private.credit_currency_v3(v_participant.participant_id,'earn_attendance',v_reward,v_row.id::text,p_idempotency_key);
    else select * into v_row from public.participant_attendance where participant_id=v_participant.participant_id and check_in_date=v_today; end if;
  end if;
  v_result:=jsonb_build_object('row',to_jsonb(v_row),'isNew',v_new,'reward',coalesce(v_currency,'{"awarded":0}'::jsonb));
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now() where auth_user_id=auth.uid()
    and operation_type='attendance_claim' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.set_equipped_outfit_v3(p_idempotency_key uuid,p_outfit_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_existing jsonb; v_result jsonb;
begin
  v_participant:=private.require_current_participant();
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(auth.uid(),'outfit_equip',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then select result into v_existing from public.idempotent_operations where auth_user_id=auth.uid()
    and operation_type='outfit_equip' and idempotency_key=p_idempotency_key; return v_existing; end if;
  if not exists(select 1 from public.participant_outfits where participant_id=v_participant.participant_id and outfit_id=p_outfit_id)
    then raise exception 'INVALID_ITEM'; end if;
  insert into public.participant_equipped_outfit(participant_id,outfit_id,updated_at)
    values(v_participant.participant_id,p_outfit_id,now()) on conflict(participant_id) do update set outfit_id=excluded.outfit_id,updated_at=now();
  v_result:=jsonb_build_object('outfitId',p_outfit_id);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now() where auth_user_id=auth.uid()
    and operation_type='outfit_equip' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

-- Service-role only because the reviewed Route Handler owns the product catalog and price.
create or replace function public.secure_purchase_admin(
  p_auth_user_id uuid,p_kind text,p_item_id text,p_price integer,p_ledger_type text,
  p_grant_item_ids text[],p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid text; v_balance integer; v_existing jsonb; v_result jsonb; v_granted text[]:=array[]::text[];
  v_id text; v_tx_id bigint;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  if p_price<=0 or p_ledger_type not in ('spend_shop','spend_interior') or p_item_id is null
    or cardinality(p_grant_item_ids)=0 then raise exception 'INVALID_ITEM'; end if;
  select participant_id into v_pid from public.study_participants where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(p_auth_user_id,'purchase:'||p_kind,p_request_id,v_pid) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=p_auth_user_id
      and operation_type='purchase:'||p_kind and idempotency_key=p_request_id;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  insert into public.participant_currency(participant_id,balance,updated_at) values(v_pid,0,now()) on conflict(participant_id) do nothing;
  select balance into v_balance from public.participant_currency where participant_id=v_pid for update;
  if v_balance<p_price then
    v_result:=jsonb_build_object('ok',false,'reason','insufficient_funds','balance',v_balance,'price',p_price);
  elsif p_kind='outfit' then
    insert into public.participant_outfits(participant_id,outfit_id) values(v_pid,p_item_id) on conflict do nothing;
    if not found then v_result:=jsonb_build_object('ok',false,'reason','already_owned');
    else
      insert into public.participant_equipped_outfit(participant_id,outfit_id,updated_at) values(v_pid,p_item_id,now())
        on conflict(participant_id) do update set outfit_id=excluded.outfit_id,updated_at=now();
      v_granted:=array[p_item_id];
    end if;
  elsif p_kind in ('interior_item','interior_set') then
    foreach v_id in array p_grant_item_ids loop
      insert into public.participant_interior_items(participant_id,item_id) values(v_pid,v_id) on conflict do nothing;
      if found then v_granted:=array_append(v_granted,v_id); end if;
    end loop;
    if cardinality(v_granted)=0 then v_result:=jsonb_build_object('ok',false,'reason','already_owned'); end if;
  elsif p_kind='house_item' then
    insert into public.participant_house_items(participant_id,item_id,quantity) values(v_pid,p_item_id,1)
      on conflict(participant_id,item_id) do update set quantity=public.participant_house_items.quantity+1;
    v_granted:=array[p_item_id];
  else raise exception 'INVALID_ITEM'; end if;
  if v_result is null then
    insert into public.currency_transactions(participant_id,type,amount,related_id,idempotency_key)
      values(v_pid,p_ledger_type,-p_price,p_item_id||':'||p_request_id::text,p_request_id) returning id into v_tx_id;
    update public.participant_currency set balance=balance-p_price,updated_at=now() where participant_id=v_pid returning balance into v_balance;
    v_result:=jsonb_build_object('ok',true,'newBalance',v_balance,'transactionId',v_tx_id,'grantedItemIds',to_jsonb(v_granted));
  end if;
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and operation_type='purchase:'||p_kind and idempotency_key=p_request_id;
  return v_result;
end $$;
revoke all on function public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid) to service_role;

-- Browser mutations now go only through authenticated, fixed-search-path functions.
revoke insert on public.annotations,public.votes from authenticated;
revoke insert,update on public.participant_equipped_outfit from authenticated;
revoke execute on function public.award_participant_currency(text,text,numeric,text,integer) from public,anon,authenticated;
revoke execute on function public.record_annotation_quest_progress(text,text,text[]) from public,anon,authenticated;
revoke execute on function public.record_vote_quest_progress(text[]) from public,anon,authenticated;
revoke execute on function public.ensure_today_check_in() from public,anon,authenticated;
revoke all on function public.submit_annotation_v3(uuid,text,text,text,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) from public,anon;
revoke all on function public.submit_museum_vote_v3(uuid,text,text,uuid,integer,integer,numeric,integer,text) from public,anon;
revoke all on function public.ensure_today_check_in_v3(uuid) from public,anon;
revoke all on function public.set_equipped_outfit_v3(uuid,text) from public,anon;
grant execute on function public.submit_annotation_v3(uuid,text,text,text,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) to authenticated;
grant execute on function public.submit_museum_vote_v3(uuid,text,text,uuid,integer,integer,numeric,integer,text) to authenticated;
grant execute on function public.ensure_today_check_in_v3(uuid) to authenticated;
grant execute on function public.set_equipped_outfit_v3(uuid,text) to authenticated;

commit;
