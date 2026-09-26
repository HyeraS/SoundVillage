-- Participant authentication foundation. Review first; do not run automatically.
-- Run as postgres/service owner in a Supabase SQL editor.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.study_participants (
  participant_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  group_id text not null check (group_id in ('A', 'B')),
  access_scope text not null default 'group' check (access_scope in ('group', 'all')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.study_participants
  add column if not exists access_scope text not null default 'group';

alter table public.study_participants enable row level security;
revoke all on public.study_participants from public, anon, authenticated;

-- The catalog is populated by register-study-data.mjs before RLS enforcement.
create table if not exists public.study_sound_catalog (
  sound_id text primary key,
  zone text not null,
  sub_category text,
  group_id text check (group_id in ('A', 'B')),
  canonical_audio_id text not null,
  file_path text not null,
  source_dataset text not null,
  original_filename text not null,
  source_type text,
  audioset_class text
);
alter table public.study_sound_catalog add column if not exists canonical_audio_id text;
alter table public.study_sound_catalog add column if not exists file_path text;
alter table public.study_sound_catalog add column if not exists source_dataset text;
alter table public.study_sound_catalog add column if not exists original_filename text;
alter table public.study_sound_catalog add column if not exists source_type text;
alter table public.study_sound_catalog add column if not exists audioset_class text;
alter table public.study_sound_catalog enable row level security;
revoke all on public.study_sound_catalog from public, anon, authenticated;

create table if not exists public.participant_room_shares (
  participant_id text primary key references public.study_participants(participant_id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participant_realtime_room_members (
  topic text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (topic, auth_user_id)
);

alter table public.participant_room_shares enable row level security;
alter table public.participant_realtime_room_members enable row level security;
revoke all on public.participant_room_shares from public, anon, authenticated;
revoke all on public.participant_realtime_room_members from public, anon, authenticated;

create or replace function private.current_participant_id()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.participant_id
  from public.study_participants p
  where p.auth_user_id = auth.uid() and p.status = 'active'
$$;

create or replace function private.current_group_id()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.group_id
  from public.study_participants p
  where p.auth_user_id = auth.uid() and p.status = 'active'
$$;

create or replace function private.is_known_sound(p_sound_id text, p_zone text, p_sub_category text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_sound_catalog c
    where c.sound_id = p_sound_id
      and c.zone = p_zone
      and (c.sub_category is null or c.sub_category = coalesce(p_sub_category, ''))
      and (
        c.group_id is null or c.group_id = private.current_group_id()
        or exists (
          select 1 from public.study_participants p
          where p.auth_user_id=auth.uid() and p.status='active' and p.access_scope='all'
        )
      )
  )
$$;

create or replace function private.is_vote_target_allowed(p_annotation_id uuid, p_sound_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.annotations a
    where a.id = p_annotation_id
      and a.sound_id = p_sound_id
      and a.participant_id <> private.current_participant_id()
      and nullif(a.expression_text, '') is not null
  )
$$;

create or replace function private.is_outfit_owned(p_outfit_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participant_outfits o
    where o.participant_id = private.current_participant_id() and o.outfit_id = p_outfit_id
  )
$$;

create or replace function private.is_interior_item_owned(p_item_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participant_interior_items i
    where i.participant_id = private.current_participant_id() and i.item_id = p_item_id
  )
$$;

create or replace function private.is_house_item_owned(p_item_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participant_house_items i
    where i.participant_id = private.current_participant_id() and i.item_id = p_item_id
  )
$$;

create or replace function private.is_realtime_room_member(p_topic text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participant_realtime_room_members m
    join public.study_participants p on p.auth_user_id = m.auth_user_id
    where m.topic = p_topic and m.auth_user_id = auth.uid()
      and m.expires_at > now() and p.status = 'active'
  )
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_participant_id() to authenticated;
grant execute on function private.current_group_id() to authenticated;
grant execute on function private.is_known_sound(text, text, text) to authenticated;
grant execute on function private.is_vote_target_allowed(uuid, text) to authenticated;
grant execute on function private.is_outfit_owned(text) to authenticated;
grant execute on function private.is_interior_item_owned(text) to authenticated;
grant execute on function private.is_house_item_owned(text) to authenticated;
grant execute on function private.is_realtime_room_member(text) to authenticated;

create or replace function public.claim_study_participant_admin(
  p_auth_user_id uuid, p_group_id text, p_participant_id text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_row public.study_participants%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_participant_id !~ '^[A-Z0-9_-]{1,64}$' or p_group_id not in ('A', 'B') then
    return jsonb_build_object('status', 'invalid_input');
  end if;
  select * into v_row from public.study_participants
    where participant_id = p_participant_id for update;
  if not found then return jsonb_build_object('status', 'participant_not_registered'); end if;
  if v_row.status <> 'active' then return jsonb_build_object('status', 'participant_inactive'); end if;
  if v_row.group_id <> p_group_id then return jsonb_build_object('status', 'group_mismatch'); end if;
  if v_row.auth_user_id is not null and v_row.auth_user_id <> p_auth_user_id then
    return jsonb_build_object('status', 'participant_claimed');
  end if;
  update public.study_participants
    set auth_user_id = coalesce(auth_user_id, p_auth_user_id),
        claimed_at = coalesce(claimed_at, now()), last_seen_at = now()
    where participant_id = p_participant_id
    returning * into v_row;
  return jsonb_build_object(
    'status', 'ok', 'participant_id', v_row.participant_id,
    'group_id', v_row.group_id
  );
end;
$$;
revoke all on function public.claim_study_participant_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_study_participant_admin(uuid, text, text) to service_role;

create or replace function public.get_my_study_participant()
returns table(participant_id text, group_id text, status text)
language sql stable security definer
set search_path = ''
as $$
  select p.participant_id, p.group_id, p.status
  from public.study_participants p where p.auth_user_id = auth.uid()
$$;
revoke all on function public.get_my_study_participant() from public, anon;
grant execute on function public.get_my_study_participant() to authenticated;

create or replace function public.museum_candidate_expressions(
  p_sound_ids text[], p_exclude_expression text default null, p_limit integer default 5
) returns table(id uuid, expression_text text, confidence integer, vote_count integer)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.expression_text, a.confidence, coalesce(a.vote_count, 0)
  from public.annotations a
  where private.current_participant_id() is not null
    and a.participant_id <> private.current_participant_id()
    and a.sound_id = any(p_sound_ids)
    and nullif(a.expression_text, '') is not null
    and (p_exclude_expression is null or a.expression_text <> p_exclude_expression)
  order by random() limit least(greatest(p_limit, 1), 10)
$$;

create or replace function public.museum_annotated_sound_ids()
returns table(sound_id text)
language sql stable security definer
set search_path = ''
as $$
  select distinct a.sound_id from public.annotations a
  where private.current_participant_id() is not null
    and nullif(a.expression_text, '') is not null
$$;

create or replace function public.museum_annotation_count(p_sound_ids text[])
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select count(*) from public.annotations a
  where private.current_participant_id() is not null
    and a.sound_id = any(p_sound_ids) and nullif(a.expression_text, '') is not null
$$;

revoke all on function public.museum_candidate_expressions(text[], text, integer) from public, anon;
revoke all on function public.museum_annotated_sound_ids() from public, anon;
revoke all on function public.museum_annotation_count(text[]) from public, anon;
grant execute on function public.museum_candidate_expressions(text[], text, integer) to authenticated;
grant execute on function public.museum_annotated_sound_ids() to authenticated;
grant execute on function public.museum_annotation_count(text[]) to authenticated;

create or replace function private.credit_currency(
  p_participant_id text, p_type text, p_amount integer, p_related_id text,
  p_sound_duration_sec numeric default null, p_sub_category text default null,
  p_category_count integer default null, p_confidence integer default null
) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_balance integer;
begin
  insert into public.currency_transactions
    (participant_id, type, amount, related_id, sound_duration_sec, sub_category, category_count_at_time, confidence)
  values
    (p_participant_id, p_type, p_amount, p_related_id, p_sound_duration_sec, p_sub_category, p_category_count, p_confidence)
  on conflict (participant_id, related_id, type) do nothing;
  if not found then return null; end if;
  insert into public.participant_currency(participant_id, balance, updated_at)
    values (p_participant_id, p_amount, now())
  on conflict (participant_id) do update
    set balance = public.participant_currency.balance + excluded.balance, updated_at = now()
  returning balance into v_balance;
  return v_balance;
end;
$$;
revoke all on function private.credit_currency(text, text, integer, text, numeric, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.award_participant_currency(
  p_type text, p_related_id text, p_sound_duration_sec numeric default null,
  p_sub_category text default null, p_confidence integer default null
) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_pid text := private.current_participant_id(); v_amount integer; v_category_count integer;
begin
  if v_pid is null then raise exception 'participant_session_required'; end if;
  if p_type = 'earn_annotation' then
    if not exists (select 1 from public.annotations a join public.study_sound_catalog c on c.sound_id = a.sound_id
      where a.participant_id = v_pid and a.sound_id = p_related_id and not a.is_skipped) then
      raise exception 'invalid_annotation_reward_source';
    end if;
    v_amount := 5;
    select count(*) into v_category_count from public.annotations a
      where a.participant_id = v_pid and a.sub_category = p_sub_category and not a.is_skipped;
  elsif p_type = 'earn_vote' then
    if not exists (select 1 from public.votes v where v.participant_id = v_pid and v.annotation_id::text = p_related_id) then
      raise exception 'invalid_vote_reward_source';
    end if;
    v_amount := 2;
  elsif p_type = 'earn_quest' then
    select t.reward_currency into v_amount
      from public.participant_daily_quests q join public.daily_quest_templates t on t.id = q.quest_template_id
      where q.id::text = p_related_id and q.participant_id = v_pid and q.completed;
  elsif p_type = 'earn_attendance' then
    select a.reward_currency into v_amount from public.participant_attendance a
      where a.id::text = p_related_id and a.participant_id = v_pid;
  else raise exception 'unsupported_reward_type';
  end if;
  if v_amount is null or v_amount <= 0 then raise exception 'invalid_reward_source'; end if;
  return private.credit_currency(v_pid, p_type, v_amount, p_related_id,
    p_sound_duration_sec, p_sub_category, v_category_count, p_confidence);
end;
$$;
revoke all on function public.award_participant_currency(text, text, numeric, text, integer) from public, anon;
grant execute on function public.award_participant_currency(text, text, numeric, text, integer) to authenticated;

create or replace function public.ensure_today_check_in()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_pid text := private.current_participant_id(); v_today date := (now() at time zone 'utc')::date;
  v_last public.participant_attendance%rowtype; v_row public.participant_attendance%rowtype;
  v_day integer; v_reward integer; v_new boolean := false;
begin
  if v_pid is null then raise exception 'participant_session_required'; end if;
  select * into v_row from public.participant_attendance where participant_id=v_pid and check_in_date=v_today;
  if not found then
    select * into v_last from public.participant_attendance where participant_id=v_pid
      order by check_in_date desc limit 1;
    v_day := case when v_last.check_in_date = v_today - 1 then (v_last.streak_day % 7) + 1 else 1 end;
    select reward_currency into v_reward from public.attendance_reward_templates where day_index=v_day;
    insert into public.participant_attendance(participant_id, check_in_date, streak_day, reward_currency)
      values(v_pid, v_today, v_day, v_reward)
      on conflict(participant_id, check_in_date) do nothing returning * into v_row;
    if found then
      v_new := true;
      perform private.credit_currency(v_pid, 'earn_attendance', v_reward, v_row.id::text);
    else select * into v_row from public.participant_attendance where participant_id=v_pid and check_in_date=v_today;
    end if;
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'isNew', v_new);
end;
$$;

create or replace function public.get_attendance_status()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'templates', coalesce((select jsonb_agg(to_jsonb(t) order by t.day_index) from public.attendance_reward_templates t), '[]'::jsonb),
    'today', (select to_jsonb(a) from public.participant_attendance a
      where a.participant_id=private.current_participant_id() and a.check_in_date=(now() at time zone 'utc')::date)
  ) where private.current_participant_id() is not null
$$;
revoke all on function public.ensure_today_check_in() from public, anon;
revoke all on function public.get_attendance_status() from public, anon;
grant execute on function public.ensure_today_check_in() to authenticated;
grant execute on function public.get_attendance_status() to authenticated;

create or replace function public.ensure_today_quests(p_known_sub_categories text[] default array[]::text[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_pid text := private.current_participant_id(); v_today date := (now() at time zone 'utc')::date;
  v_category text;
begin
  if v_pid is null then raise exception 'participant_session_required'; end if;
  select c.sub_category into v_category from public.study_sound_catalog c
  left join public.annotations a on a.participant_id=v_pid and a.sub_category=c.sub_category and not a.is_skipped
  where c.sub_category is not null group by c.sub_category order by count(a.id), c.sub_category limit 1;
  insert into public.participant_daily_quests(participant_id, quest_template_id, assigned_date, target_sub_category)
    select v_pid, t.id, v_today, case when t.type='category_participate' then v_category end
    from public.daily_quest_templates t where t.active
    on conflict(participant_id, quest_template_id, assigned_date) do nothing;
  return (select coalesce(jsonb_agg(to_jsonb(q) || jsonb_build_object('template', to_jsonb(t))
    order by t.type, t.tier_index nulls last), '[]'::jsonb)
    from public.participant_daily_quests q join public.daily_quest_templates t on t.id=q.quest_template_id
    where q.participant_id=v_pid and q.assigned_date=v_today);
end;
$$;

create or replace function private.refresh_today_quest_progress(p_pid text, p_zone text default null, p_sub_category text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_today date := (now() at time zone 'utc')::date; v_start timestamptz; v_end timestamptz;
  v_annotations integer; v_votes integer; v_zone_count integer; q record; v_progress integer;
begin
  v_start := v_today::timestamptz; v_end := v_start + interval '1 day';
  select count(*) into v_annotations from public.annotations a where a.participant_id=p_pid and not a.is_skipped and a.created_at>=v_start and a.created_at<v_end;
  select count(*) into v_votes from public.votes v where v.participant_id=p_pid and v.created_at>=v_start and v.created_at<v_end;
  if p_zone is not null then select count(*) into v_zone_count from public.annotations a where a.participant_id=p_pid and a.zone=p_zone and not a.is_skipped and a.created_at>=v_start and a.created_at<v_end; end if;
  for q in select pq.id, pq.target_sub_category, t.type, t.target_count, t.reward_currency
    from public.participant_daily_quests pq join public.daily_quest_templates t on t.id=pq.quest_template_id
    where pq.participant_id=p_pid and pq.assigned_date=v_today and not pq.completed
  loop
    v_progress := case q.type
      when 'collect_milestone' then v_annotations
      when 'vote_n_times' then v_votes
      when 'visit_zone' then case when coalesce(v_zone_count,0)>0 then q.target_count else 0 end
      when 'category_participate' then case when p_sub_category=q.target_sub_category then q.target_count else 0 end
      else 0 end;
    update public.participant_daily_quests set progress_count=v_progress,
      completed=(v_progress>=q.target_count), completed_at=case when v_progress>=q.target_count then now() else completed_at end
      where id=q.id and not completed;
    if v_progress>=q.target_count then perform private.credit_currency(p_pid, 'earn_quest', q.reward_currency, q.id::text); end if;
  end loop;
end;
$$;

create or replace function public.record_annotation_quest_progress(
  p_zone text, p_sub_category text default null, p_known_sub_categories text[] default array[]::text[]
) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if private.current_participant_id() is null then raise exception 'participant_session_required'; end if;
  perform public.ensure_today_quests(p_known_sub_categories);
  perform private.refresh_today_quest_progress(private.current_participant_id(), p_zone, p_sub_category);
end $$;

create or replace function public.record_vote_quest_progress(p_known_sub_categories text[] default array[]::text[])
returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if private.current_participant_id() is null then raise exception 'participant_session_required'; end if;
  perform public.ensure_today_quests(p_known_sub_categories);
  perform private.refresh_today_quest_progress(private.current_participant_id());
end $$;
revoke all on function public.ensure_today_quests(text[]) from public, anon;
revoke all on function public.record_annotation_quest_progress(text, text, text[]) from public, anon;
revoke all on function public.record_vote_quest_progress(text[]) from public, anon;
grant execute on function public.ensure_today_quests(text[]) to authenticated;
grant execute on function public.record_annotation_quest_progress(text, text, text[]) to authenticated;
grant execute on function public.record_vote_quest_progress(text[]) to authenticated;

create or replace function public.get_or_create_room_share()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_pid text := private.current_participant_id(); v_token uuid; v_topic text;
begin
  if v_pid is null then raise exception 'participant_session_required'; end if;
  insert into public.participant_room_shares(participant_id) values(v_pid)
    on conflict(participant_id) do update set updated_at=now()
    returning share_token into v_token;
  v_topic := 'duo:' || v_token::text;
  insert into public.participant_realtime_room_members(topic, auth_user_id, expires_at)
    values(v_topic, auth.uid(), now()+interval '30 days')
    on conflict(topic, auth_user_id) do update set expires_at=excluded.expires_at;
  return jsonb_build_object('shareToken', v_token, 'topic', v_topic);
end $$;

create or replace function public.get_shared_room(p_share_token uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_pid text := private.current_participant_id(); v_room jsonb; v_topic text;
begin
  if v_pid is null then raise exception 'participant_session_required'; end if;
  select r.room into v_room from public.participant_room_shares s
    join public.participant_room r on r.participant_id=s.participant_id
    join public.study_participants p on p.participant_id=s.participant_id
    where s.share_token=p_share_token and s.enabled and p.status='active';
  if not found then return null; end if;
  v_topic := 'duo:' || p_share_token::text;
  insert into public.participant_realtime_room_members(topic, auth_user_id, expires_at)
    values(v_topic, auth.uid(), now()+interval '8 hours')
    on conflict(topic, auth_user_id) do update set expires_at=excluded.expires_at;
  return jsonb_build_object('room', v_room, 'shareToken', p_share_token, 'topic', v_topic);
end $$;
revoke all on function public.get_or_create_room_share() from public, anon;
revoke all on function public.get_shared_room(uuid) from public, anon;
grant execute on function public.get_or_create_room_share() to authenticated;
grant execute on function public.get_shared_room(uuid) to authenticated;

create or replace function public.secure_purchase_admin(
  p_auth_user_id uuid, p_kind text, p_item_id text, p_price integer,
  p_ledger_type text, p_grant_item_ids text[], p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_pid text; v_balance integer; v_granted text[] := array[]::text[]; v_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_price < 0 or p_ledger_type not in ('spend_shop','spend_interior') then raise exception 'invalid_purchase'; end if;
  select participant_id into v_pid from public.study_participants where auth_user_id=p_auth_user_id and status='active';
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'participant_inactive'); end if;
  insert into public.participant_currency(participant_id,balance) values(v_pid,0) on conflict do nothing;
  select balance into v_balance from public.participant_currency where participant_id=v_pid for update;
  if v_balance < p_price then return jsonb_build_object('ok',false,'reason','insufficient_funds','balance',v_balance,'price',p_price); end if;
  if p_kind='outfit' then
    insert into public.participant_outfits(participant_id,outfit_id) values(v_pid,p_item_id) on conflict do nothing;
    if not found then return jsonb_build_object('ok',false,'reason','already_owned'); end if;
    insert into public.participant_equipped_outfit(participant_id,outfit_id,updated_at) values(v_pid,p_item_id,now())
      on conflict(participant_id) do update set outfit_id=excluded.outfit_id,updated_at=now();
    v_granted := array[p_item_id];
  elsif p_kind in ('interior_item','interior_set') then
    foreach v_id in array p_grant_item_ids loop
      insert into public.participant_interior_items(participant_id,item_id) values(v_pid,v_id) on conflict do nothing;
      if found then v_granted := array_append(v_granted,v_id); end if;
    end loop;
    if cardinality(v_granted)=0 then return jsonb_build_object('ok',true,'alreadyOwned',true,'grantedItemIds','[]'::jsonb,'newBalance',v_balance); end if;
  elsif p_kind='house_item' then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='participant_house_items' and column_name='quantity') then
      execute 'insert into public.participant_house_items(participant_id,item_id,quantity) values($1,$2,1) on conflict(participant_id,item_id) do update set quantity=public.participant_house_items.quantity+1' using v_pid,p_item_id;
    else
      insert into public.participant_house_items(participant_id,item_id) values(v_pid,p_item_id) on conflict do nothing;
      if not found then return jsonb_build_object('ok',false,'reason','already_owned'); end if;
    end if;
    v_granted := array[p_item_id];
  else raise exception 'invalid_purchase_kind'; end if;
  insert into public.currency_transactions(participant_id,type,amount,related_id)
    values(v_pid,p_ledger_type,-p_price,p_item_id || ':' || p_request_id::text);
  update public.participant_currency set balance=balance-p_price,updated_at=now() where participant_id=v_pid returning balance into v_balance;
  return jsonb_build_object('ok',true,'newBalance',v_balance,'grantedItemIds',to_jsonb(v_granted));
end $$;
revoke all on function public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid) from public, anon, authenticated;
grant execute on function public.secure_purchase_admin(uuid,text,text,integer,text,text[],uuid) to service_role;

commit;
