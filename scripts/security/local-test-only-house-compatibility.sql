-- LOCAL TEST ONLY / NON-PRODUCTION-AUTHORITATIVE.
--
-- The reviewed historical house schema has one inventory row per item and a
-- composite layout primary key. Current security migration 002 and the dormant
-- house QA client instead require stack quantity plus independently identified
-- layout instances. No production schema dump establishing that later shape is
-- available, so this compatibility layer is only for a fresh disposable local
-- Stage 8 rehearsal. Never include it in a production migration chain.
begin;

do $$
declare v_layout_pk text; v_layout_pk_columns text[];
begin
  if to_regclass('public.participant_house_items') is null
    or to_regclass('public.participant_house_layout') is null then
    raise exception 'LOCAL_FIXTURE_PREFLIGHT: historical house tables are required';
  end if;

  select c.conname,
         array_agg(a.attname order by u.ordinality)
    into v_layout_pk, v_layout_pk_columns
  from pg_constraint c
  join unnest(c.conkey) with ordinality u(attnum, ordinality) on true
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.attnum
  where c.conrelid='public.participant_house_layout'::regclass and c.contype='p'
  group by c.conname;

  if v_layout_pk is null or v_layout_pk_columns <> array['participant_id','item_id']::text[] then
    raise exception 'LOCAL_FIXTURE_PREFLIGHT: unexpected participant_house_layout primary key % (%)',
      v_layout_pk, v_layout_pk_columns;
  end if;

  execute format('alter table public.participant_house_layout drop constraint %I',v_layout_pk);
end $$;

alter table public.participant_house_items add column quantity integer;
update public.participant_house_items set quantity=1 where quantity is null;
alter table public.participant_house_items alter column quantity set default 1;
alter table public.participant_house_items alter column quantity set not null;
alter table public.participant_house_items
  add constraint participant_house_items_quantity_positive check (quantity > 0);

alter table public.participant_house_layout add column id uuid default gen_random_uuid();
update public.participant_house_layout set id=gen_random_uuid() where id is null;
alter table public.participant_house_layout alter column id set not null;
alter table public.participant_house_layout
  add constraint participant_house_layout_pkey primary key (id);

commit;

