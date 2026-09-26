-- LOCAL TEST ONLY / NON-PRODUCTION-AUTHORITATIVE.
--
-- The historical daily quest schema has no created_at column, while the Stage 7
-- read-only preflight needs one to compare legacy assigned dates with KST. This
-- supplies that audit timestamp only for a fresh, empty disposable database.
-- A production schema dump and explicit compatibility decision are still
-- required before applying the Stage 7 chain outside local testing.
begin;

do $$
begin
  if to_regclass('public.participant_daily_quests') is null then
    raise exception 'LOCAL_FIXTURE_PREFLIGHT: participant_daily_quests is required';
  end if;
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='participant_daily_quests' and column_name='created_at'
  ) then
    raise exception 'LOCAL_FIXTURE_PREFLIGHT: created_at already exists; review the actual schema instead';
  end if;
end $$;

alter table public.participant_daily_quests
  add column created_at timestamptz not null default now();

commit;

