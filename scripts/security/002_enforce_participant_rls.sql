-- Enforcement phase. Apply only after 001, participant registration, sound catalog
-- synchronization, and application deployment are ready for the same maintenance window.
begin;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'annotations','votes','participant_currency','currency_transactions',
    'participant_outfits','participant_equipped_outfit','participant_daily_quests',
    'participant_attendance','participant_interior_items','participant_room',
    'participant_house_items','participant_house_layout'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Required table public.% is missing; stop before changing grants', v_table;
    end if;
  end loop;
  if not exists(select 1 from public.study_sound_catalog) then
    raise exception 'study_sound_catalog is empty; run register-study-data.mjs first';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='participant_house_items' and column_name='quantity') then
    raise exception 'participant_house_items.quantity is missing; reconcile the deployed house schema first';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='participant_house_layout' and column_name='id') then
    raise exception 'participant_house_layout.id is missing; reconcile the deployed house schema first';
  end if;
end $$;

-- Remove every permissive policy from the scoped participant tables before adding
-- the named restrictive set. Policies are OR-combined, so leaving one old policy is unsafe.
do $$
declare p record; v_table text;
begin
  foreach v_table in array array[
    'annotations','votes','participant_currency','currency_transactions',
    'participant_outfits','participant_equipped_outfit','participant_daily_quests',
    'participant_attendance','participant_interior_items','participant_room',
    'participant_house_items','participant_house_layout'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    for p in select policyname from pg_policies where schemaname='public' and tablename=v_table loop
      execute format('drop policy %I on public.%I', p.policyname, v_table);
    end loop;
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
  end loop;
end $$;

create policy annotations_select_own on public.annotations for select to authenticated
  using (participant_id = private.current_participant_id());
create policy annotations_insert_own on public.annotations for insert to authenticated
  with check (
    participant_id = private.current_participant_id()
    and session_id::text = private.current_group_id()
    and private.is_known_sound(sound_id, zone, sub_category)
  );

create policy votes_select_own on public.votes for select to authenticated
  using (participant_id = private.current_participant_id());
create policy votes_insert_own on public.votes for insert to authenticated
  with check (
    participant_id = private.current_participant_id()
    and session_id::text = private.current_group_id()
    and private.is_vote_target_allowed(annotation_id, sound_id)
  );

create policy participant_currency_select_own on public.participant_currency for select to authenticated
  using (participant_id = private.current_participant_id());
create policy currency_transactions_select_own on public.currency_transactions for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_outfits_select_own on public.participant_outfits for select to authenticated
  using (participant_id = private.current_participant_id());

create policy participant_equipped_select_own on public.participant_equipped_outfit for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_equipped_insert_own on public.participant_equipped_outfit for insert to authenticated
  with check (participant_id = private.current_participant_id() and private.is_outfit_owned(outfit_id));
create policy participant_equipped_update_own on public.participant_equipped_outfit for update to authenticated
  using (participant_id = private.current_participant_id())
  with check (participant_id = private.current_participant_id() and private.is_outfit_owned(outfit_id));

create policy participant_daily_quests_select_own on public.participant_daily_quests for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_attendance_select_own on public.participant_attendance for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_interior_items_select_own on public.participant_interior_items for select to authenticated
  using (participant_id = private.current_participant_id());

create policy participant_room_select_own on public.participant_room for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_room_insert_own on public.participant_room for insert to authenticated
  with check (participant_id = private.current_participant_id());
create policy participant_room_update_own on public.participant_room for update to authenticated
  using (participant_id = private.current_participant_id())
  with check (participant_id = private.current_participant_id());

create policy participant_house_items_select_own on public.participant_house_items for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_house_layout_select_own on public.participant_house_layout for select to authenticated
  using (participant_id = private.current_participant_id());
create policy participant_house_layout_insert_own on public.participant_house_layout for insert to authenticated
  with check (participant_id = private.current_participant_id() and private.is_house_item_owned(item_id));
create policy participant_house_layout_update_own on public.participant_house_layout for update to authenticated
  using (participant_id = private.current_participant_id())
  with check (participant_id = private.current_participant_id() and private.is_house_item_owned(item_id));
create policy participant_house_layout_delete_own on public.participant_house_layout for delete to authenticated
  using (participant_id = private.current_participant_id());

-- Only operations still performed directly by the authenticated browser are granted.
grant select, insert on public.annotations to authenticated;
grant select, insert on public.votes to authenticated;
grant select on public.participant_currency, public.currency_transactions to authenticated;
grant select on public.participant_outfits to authenticated;
grant select, insert, update on public.participant_equipped_outfit to authenticated;
grant select on public.participant_daily_quests, public.participant_attendance to authenticated;
grant select on public.participant_interior_items to authenticated;
grant select, insert, update on public.participant_room to authenticated;
grant select on public.participant_house_items to authenticated;
grant select, insert, update, delete on public.participant_house_layout to authenticated;
grant select on public.daily_quest_templates, public.attendance_reward_templates to authenticated;
revoke all on public.daily_quest_templates, public.attendance_reward_templates from anon;

-- Legacy mutators can otherwise bypass all application validation. Revoke every
-- overload so this migration does not guess a deployed signature.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'increment_vote_count','increment_currency_balance','increment_house_item_quantity'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

create or replace function private.increment_annotation_vote_count()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  update public.annotations set vote_count=coalesce(vote_count,0)+1 where id=new.annotation_id;
  return new;
end $$;
revoke all on function private.increment_annotation_vote_count() from public, anon, authenticated;
drop trigger if exists votes_increment_annotation_count on public.votes;
create trigger votes_increment_annotation_count after insert on public.votes
for each row execute function private.increment_annotation_vote_count();

-- Private Realtime authorization. The Supabase Realtime dashboard must also have
-- "Allow public access" disabled; application channels use config.private=true.
-- Current Supabase Realtime provisions this managed table with RLS already
-- enabled and deliberately rejects ALTER TABLE, including from CLI migrations.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='realtime' and tablename='messages' loop
    execute format('drop policy %I on realtime.messages', p.policyname);
  end loop;
end $$;
create policy duo_realtime_read on realtime.messages for select to authenticated
  using (extension in ('broadcast','presence') and private.is_realtime_room_member(realtime.topic()));
create policy duo_realtime_send on realtime.messages for insert to authenticated
  with check (extension in ('broadcast','presence') and private.is_realtime_room_member(realtime.topic()));

commit;

-- Emergency recovery (manual, temporary, and logged): do not disable RLS. If the new
-- app must be rolled back, restore the previous app and explicitly recreate only the
-- exact required policies after review. Never re-grant participant tables to anon.
