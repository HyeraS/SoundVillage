-- Regression verification for 002a_template_acl_hardening.sql.
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

select table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('daily_quest_templates', 'attendance_reward_templates')
  and grantee in ('anon', 'authenticated')
group by table_name
order by table_name;
