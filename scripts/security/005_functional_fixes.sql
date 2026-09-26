-- Post-instrumentation functional fixes. Review first; do not apply automatically.
begin;

-- Return one aggregated row per stored sound ID. This avoids the museum entry
-- path issuing one count request per candidate and avoids PostgREST row limits
-- because aggregation happens inside Postgres.
create or replace function public.museum_annotation_counts()
returns table(sound_id text, annotation_count bigint)
language sql stable security definer
set search_path = ''
as $$
  select a.sound_id, count(*)::bigint as annotation_count
  from public.annotations a
  where private.current_participant_id() is not null
    and nullif(a.expression_text, '') is not null
  group by a.sound_id
$$;

revoke all on function public.museum_annotation_counts() from public, anon;
grant execute on function public.museum_annotation_counts() to authenticated;

commit;
