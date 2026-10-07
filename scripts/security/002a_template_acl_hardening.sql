-- Forward-only correction for template ACLs left behind by pre-existing remote grants.
-- This migration changes privileges only; it does not modify template rows.
begin;

do $$
begin
  if to_regclass('public.daily_quest_templates') is null then
    raise exception 'Required table public.daily_quest_templates is missing';
  end if;
  if to_regclass('public.attendance_reward_templates') is null then
    raise exception 'Required table public.attendance_reward_templates is missing';
  end if;
end $$;

revoke all on table
  public.daily_quest_templates,
  public.attendance_reward_templates
from public, anon, authenticated;

grant select on table
  public.daily_quest_templates,
  public.attendance_reward_templates
to authenticated;

do $$
declare
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array[
    'daily_quest_templates',
    'attendance_reward_templates'
  ] loop
    if not has_table_privilege('authenticated', 'public.' || v_table, 'select') then
      raise exception 'authenticated SELECT is missing on public.%', v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'select') then
      raise exception 'anon retains effective SELECT on public.%', v_table;
    end if;

    foreach v_privilege in array array[
      'insert', 'update', 'delete', 'truncate', 'references', 'trigger'
    ] loop
      if has_table_privilege('anon', 'public.' || v_table, v_privilege) then
        raise exception 'anon retains effective % on public.%', v_privilege, v_table;
      end if;
      if has_table_privilege('authenticated', 'public.' || v_table, v_privilege) then
        raise exception 'authenticated retains effective % on public.%', v_privilege, v_table;
      end if;
    end loop;
  end loop;
end $$;

commit;
