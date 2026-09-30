-- Stage 3C forward migration: transactional multi-village annotation/vote path.
-- Review and rehearse locally. Do not apply automatically or to a linked project.
-- Prerequisites: security migrations 001 through 009.
begin;

do $$
begin
  if to_regclass('public.participant_village_wallets') is null
    or to_regclass('public.participant_multi_village_character_loadouts') is null
    or to_regprocedure('public.submit_annotation_v4(uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text)') is null
    or to_regprocedure('public.submit_museum_vote_v4(uuid,text,text,uuid,integer,integer,numeric,integer,text)') is null
  then raise exception 'PREFLIGHT_REQUIRED: apply and verify 001 through 009 first'; end if;
end $$;

-- Stage 3C adds only the failure event needed to distinguish an ownership or
-- persistence failure from a successful Character equip.
insert into public.user_event_names(event_name,description) values
  ('character_item_equip_failed','Multi-village Character item equip failed')
on conflict (event_name) do nothing;

-- Progress is preserved, but completing a quest in the new economy never
-- credits either participant_currency or a village wallet.
create or replace function private.refresh_today_quests_economy_v1(
  p_pid text,p_zone text,p_sub_category text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_today date:=private.study_date_kst(); v_start timestamptz:=private.study_day_start_kst(v_today);
  v_end timestamptz:=private.study_day_start_kst(v_today+1); v_annotations integer; v_votes integer; v_zone_count integer;
  q record; v_progress integer; v_completed jsonb:='[]'::jsonb;
begin
  perform private.ensure_today_quests_v4(p_pid);
  select count(distinct canonical_audio_id) into v_annotations from public.annotations
    where participant_id=p_pid and not is_skipped and created_at>=v_start and created_at<v_end;
  select count(distinct canonical_audio_id) into v_votes from public.votes
    where participant_id=p_pid and created_at>=v_start and created_at<v_end;
  select count(distinct canonical_audio_id) into v_zone_count from public.annotations
    where participant_id=p_pid and zone=p_zone and not is_skipped and created_at>=v_start and created_at<v_end;
  for q in select pq.id,pq.target_sub_category,t.type,t.target_count
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
      v_completed:=v_completed||jsonb_build_array(jsonb_build_object(
        'questId',q.id,'reward',jsonb_build_object('awarded',0,'reason','economy_v1_no_quest_currency')));
    end if;
  end loop;
  return jsonb_build_object('completed',v_completed,'currencyAwarded',0);
end $$;

create or replace function private.credit_activity_village_economy_v1(
  p_participant_id text,p_activity_type text,p_result_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_village text; v_amount integer; v_after bigint; v_operation uuid:=gen_random_uuid();
  v_existing public.village_currency_ledger%rowtype;
begin
  if p_result_id is null or p_idempotency_key is null then raise exception 'INVALID_REWARD_SOURCE'; end if;
  if p_activity_type='annotation' then
    select zone into v_village from public.annotations
      where id=p_result_id and participant_id=p_participant_id and not is_skipped;
    v_amount:=5;
  elsif p_activity_type='vote' then
    select zone into v_village from public.votes
      where id=p_result_id and participant_id=p_participant_id;
    v_amount:=2;
  else raise exception 'INVALID_REWARD_SOURCE'; end if;
  if v_village is null or v_village not in ('Animal','Human','Nature','Urban','Music','Lab') then
    raise exception 'INVALID_REWARD_VILLAGE';
  end if;
  perform private.ensure_multi_village_wallets(p_participant_id);
  perform 1 from public.participant_village_wallets
    where participant_id=p_participant_id and village=v_village for update;
  select * into v_existing from public.village_currency_ledger
    where participant_id=p_participant_id and entry_type='earn_'||p_activity_type
      and related_id=p_result_id::text and village=v_village;
  if found then return jsonb_build_object('awarded',0,'village',v_village,
    'balance',v_existing.balance_after,'balances',private.multi_village_balances(p_participant_id)); end if;
  update public.participant_village_wallets set balance=balance+v_amount,updated_at=now()
    where participant_id=p_participant_id and village=v_village returning balance into v_after;
  insert into public.village_currency_ledger(
    participant_id,village,amount,balance_after,entry_type,related_id,operation_id,idempotency_key
  ) values(p_participant_id,v_village,v_amount,v_after,'earn_'||p_activity_type,p_result_id::text,v_operation,p_idempotency_key);
  return jsonb_build_object('awarded',v_amount,'village',v_village,'balance',v_after,
    'ledgerOperationId',v_operation,'balances',private.multi_village_balances(p_participant_id));
end $$;

create or replace function public.submit_annotation_economy_v1_admin(
  p_auth_user_id uuid,p_idempotency_key uuid,p_sound_id text,p_zone text,p_expression_text text default '',
  p_selected_features jsonb default null,p_confidence integer default null,p_difficulty integer default null,
  p_play_count integer default 0,p_listening_time_sec numeric default 0,p_is_skipped boolean default false,
  p_skip_reason text default '',p_device_info text default '',p_stage integer default 1,p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_catalog public.study_sound_catalog%rowtype;
  v_session public.study_sessions%rowtype; v_type text; v_existing jsonb; v_annotation_id public.annotations.id%type;
  v_inserted boolean:=false; v_reward jsonb; v_quests jsonb; v_progress jsonb; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select * into v_participant from public.study_participants where auth_user_id=p_auth_user_id and status='active';
  if not found then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  v_type:=case when p_is_skipped then 'economy_v1_annotation_skip' else 'economy_v1_annotation_submit' end;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(p_auth_user_id,v_type,p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=p_auth_user_id
      and operation_type=v_type and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  select * into v_catalog from public.study_sound_catalog where sound_id=p_sound_id;
  if not found or v_catalog.zone<>p_zone or not (v_catalog.group_id is null or v_catalog.group_id=v_participant.group_id or v_participant.access_scope='all')
    then raise exception 'INVALID_SOUND'; end if;
  if p_stage<>1 or p_selected_features is not null or p_difficulty is not null then raise exception 'INVALID_ANNOTATION'; end if;
  if not p_is_skipped and nullif(btrim(p_expression_text),'') is null then raise exception 'INVALID_ANNOTATION'; end if;
  select * into v_session from public.study_sessions where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and status in ('active','completed')
    order by case status when 'active' then 0 else 1 end,started_at desc limit 1 for update;
  if not found then raise exception 'STUDY_SESSION_REQUIRED'; end if;
  if v_session.status='completed' then
    if p_is_skipped then raise exception 'EXPERIMENT_COMPLETED'; end if;
    select id into v_annotation_id from public.annotations where participant_id=v_participant.participant_id
      and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id and not is_skipped;
    if v_annotation_id is null then raise exception 'EXPERIMENT_COMPLETED'; end if;
  else
    insert into public.annotations(participant_id,session_id,experiment_round,canonical_audio_id,sound_id,zone,source_type,sub_category,audioset_class,
      expression_text,selected_features,confidence,difficulty,play_count,listening_time_sec,is_skipped,skip_reason,device_info,stage,is_verified,vote_count,version)
    values(v_participant.participant_id,v_participant.group_id,v_participant.experiment_round,v_catalog.canonical_audio_id,p_sound_id,v_catalog.zone,
      v_catalog.source_type,v_catalog.sub_category,v_catalog.audioset_class,case when p_is_skipped then '' else btrim(p_expression_text) end,
      null,p_confidence,null,p_play_count,p_listening_time_sec,p_is_skipped,p_skip_reason,p_device_info,1,false,0,p_version)
    on conflict(participant_id,experiment_round,canonical_audio_id) where not is_skipped do nothing returning id into v_annotation_id;
    v_inserted:=v_annotation_id is not null;
    if not v_inserted and not p_is_skipped then
      select id into v_annotation_id from public.annotations where participant_id=v_participant.participant_id
        and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id and not is_skipped;
    end if;
  end if;
  if v_annotation_id is null then raise exception 'ANNOTATION_CONFLICT'; end if;
  if p_is_skipped or not v_inserted then
    v_reward:=jsonb_build_object('awarded',0,'balances',private.multi_village_balances(v_participant.participant_id));
    v_quests:=jsonb_build_object('completed','[]'::jsonb,'currencyAwarded',0);
  else
    v_reward:=private.credit_activity_village_economy_v1(v_participant.participant_id,'annotation',v_annotation_id,p_idempotency_key);
    v_quests:=private.refresh_today_quests_economy_v1(v_participant.participant_id,v_catalog.zone,v_catalog.sub_category);
  end if;
  v_progress:=private.experiment_progress_v1(v_participant);
  if coalesce((v_progress->>'isComplete')::boolean,false) and v_session.status='active' then
    update public.study_sessions set status='completed',completed_at=now(),last_activity_at=now(),
      completion_reason='all_assigned_annotations_completed',completion_operation_key=p_idempotency_key,
      completion_annotation_id=v_annotation_id where id=v_session.id;
  end if;
  v_result:=jsonb_build_object('ok',true,'annotationId',v_annotation_id,'canonicalAudioId',v_catalog.canonical_audio_id,
    'reward',v_reward,'quests',v_quests,'skipped',p_is_skipped,'alreadyCompleted',not v_inserted,'progress',v_progress);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and operation_type=v_type and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

create or replace function public.submit_museum_vote_economy_v1_admin(
  p_auth_user_id uuid,p_idempotency_key uuid,p_sound_id text,p_zone text,p_annotation_id uuid,p_confidence integer default 3,
  p_play_count integer default 0,p_listening_time_sec numeric default 0,p_stage integer default 2,p_version text default 'v0.4-web'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_participant public.study_participants%rowtype; v_catalog public.study_sound_catalog%rowtype;
  v_session public.study_sessions%rowtype; v_existing jsonb; v_vote_id public.votes.id%type;
  v_inserted boolean:=false; v_reward jsonb; v_quests jsonb; v_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required'; end if;
  select * into v_participant from public.study_participants where auth_user_id=p_auth_user_id and status='active';
  if not found then return jsonb_build_object('ok',false,'reason','participant_inactive'); end if;
  insert into public.idempotent_operations(auth_user_id,operation_type,idempotency_key,participant_id)
    values(p_auth_user_id,'economy_v1_museum_vote',p_idempotency_key,v_participant.participant_id) on conflict do nothing;
  if not found then
    select result into v_existing from public.idempotent_operations where auth_user_id=p_auth_user_id
      and operation_type='economy_v1_museum_vote' and idempotency_key=p_idempotency_key;
    if v_existing is null then raise exception 'DUPLICATE_OPERATION'; end if;
    return v_existing;
  end if;
  select * into v_session from public.study_sessions where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and status='active'
    order by started_at desc limit 1 for update;
  if not found then raise exception 'EXPERIMENT_COMPLETED'; end if;
  if p_stage<>2 or p_play_count<1 then raise exception 'AUDIO_PLAY_REQUIRED'; end if;
  select * into v_catalog from public.study_sound_catalog where sound_id=p_sound_id and zone=p_zone;
  if not found or not private.is_vote_target_allowed_v2(p_annotation_id,v_catalog.canonical_audio_id,v_participant)
    then raise exception 'INVALID_SOUND'; end if;
  insert into public.votes(participant_id,session_id,experiment_round,canonical_audio_id,sound_id,zone,annotation_id,confidence,
    play_count,listening_time_sec,stage,version)
  values(v_participant.participant_id,v_participant.group_id,v_participant.experiment_round,v_catalog.canonical_audio_id,p_sound_id,
    v_catalog.zone,p_annotation_id,p_confidence,p_play_count,p_listening_time_sec,2,p_version)
  on conflict(participant_id,experiment_round,canonical_audio_id) do nothing returning id into v_vote_id;
  v_inserted:=v_vote_id is not null;
  if not v_inserted then select id into v_vote_id from public.votes where participant_id=v_participant.participant_id
    and experiment_round=v_participant.experiment_round and canonical_audio_id=v_catalog.canonical_audio_id; end if;
  if v_vote_id is null then raise exception 'VOTE_CONFLICT'; end if;
  if v_inserted then
    v_reward:=private.credit_activity_village_economy_v1(v_participant.participant_id,'vote',v_vote_id,p_idempotency_key);
    v_quests:=private.refresh_today_quests_economy_v1(v_participant.participant_id,v_catalog.zone,null);
  else
    v_reward:=jsonb_build_object('awarded',0,'balances',private.multi_village_balances(v_participant.participant_id));
    v_quests:=jsonb_build_object('completed','[]'::jsonb,'currencyAwarded',0);
  end if;
  v_result:=jsonb_build_object('ok',true,'voteId',v_vote_id,'canonicalAudioId',v_catalog.canonical_audio_id,
    'reward',v_reward,'quests',v_quests,'alreadyCompleted',not v_inserted);
  update public.idempotent_operations set status='completed',result=v_result,completed_at=now()
    where auth_user_id=p_auth_user_id and operation_type='economy_v1_museum_vote' and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

revoke all on function private.refresh_today_quests_economy_v1(text,text,text) from public,anon,authenticated;
revoke all on function private.credit_activity_village_economy_v1(text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_annotation_economy_v1_admin(uuid,uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.submit_museum_vote_economy_v1_admin(uuid,uuid,text,text,uuid,integer,integer,numeric,integer,text) from public,anon,authenticated;
grant execute on function public.submit_annotation_economy_v1_admin(uuid,uuid,text,text,text,jsonb,integer,integer,integer,numeric,boolean,text,text,integer,text) to service_role;
grant execute on function public.submit_museum_vote_economy_v1_admin(uuid,uuid,text,text,uuid,integer,integer,numeric,integer,text) to service_role;

commit;
