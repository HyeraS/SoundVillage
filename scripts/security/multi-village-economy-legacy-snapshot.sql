-- Stable read-only fingerprint for legacy single-currency objects that migration
-- 008 must not mutate. The local rehearsal compares this output byte-for-byte.
select jsonb_build_object(
  'table_rows', (
    select jsonb_object_agg(table_name, row_count order by table_name)
    from (
      select 'currency_transactions' table_name, count(*) row_count from public.currency_transactions
      union all select 'participant_currency', count(*) from public.participant_currency
      union all select 'participant_house_items', count(*) from public.participant_house_items
      union all select 'participant_house_layout', count(*) from public.participant_house_layout
      union all select 'participant_interior_items', count(*) from public.participant_interior_items
      union all select 'participant_outfits', count(*) from public.participant_outfits
    ) rows
  ),
  'table_acls', (
    select jsonb_object_agg(c.relname, coalesce(c.relacl::text, '') order by c.relname)
    from pg_class c
    where c.oid in (
      'public.currency_transactions'::regclass,
      'public.participant_currency'::regclass,
      'public.participant_house_items'::regclass,
      'public.participant_house_layout'::regclass,
      'public.participant_interior_items'::regclass,
      'public.participant_outfits'::regclass
    )
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', policyname, 'roles', roles, 'command', cmd,
      'using', qual, 'check', with_check
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public' and tablename in (
      'currency_transactions','participant_currency','participant_house_items',
      'participant_house_layout','participant_interior_items','participant_outfits'
    )
  ),
  'functions', (
    select jsonb_object_agg(p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('award_participant_currency','increment_currency_balance','secure_purchase_admin')
  )
)::text;
