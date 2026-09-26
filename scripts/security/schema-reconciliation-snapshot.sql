-- READ ONLY. Run with psql -X -q -A -t -f and redirect the single JSON value to
-- an access-controlled file. This captures schema/catalog metadata only; it does
-- not read participant or experiment rows and does not mutate the database.
begin transaction read only;

with
columns_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', table_schema, 'table', table_name, 'column', column_name,
    'data_type', data_type, 'udt_name', udt_name, 'nullable', is_nullable,
    'default', column_default
  ) order by table_schema, table_name, ordinal_position), '[]'::jsonb) value
  from information_schema.columns
  where table_schema in ('public', 'private', 'realtime')
),
constraints_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'table', c.relname, 'name', con.conname,
    'type', con.contype, 'definition', pg_get_constraintdef(con.oid, true)
  ) order by n.nspname, c.relname, con.conname), '[]'::jsonb) value
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private', 'realtime')
),
indexes_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'table', tablename, 'name', indexname, 'definition', indexdef
  ) order by schemaname, tablename, indexname), '[]'::jsonb) value
  from pg_indexes where schemaname in ('public', 'private', 'realtime')
),
policies_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'table', tablename, 'name', policyname,
    'command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check
  ) order by schemaname, tablename, policyname), '[]'::jsonb) value
  from pg_policies where schemaname in ('public', 'private', 'realtime')
),
rls_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'table', c.relname, 'enabled', c.relrowsecurity,
    'forced', c.relforcerowsecurity
  ) order by n.nspname, c.relname), '[]'::jsonb) value
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private', 'realtime') and c.relkind in ('r', 'p')
),
functions_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'argument_types', oidvectortypes(p.proargtypes),
    'argument_names', coalesce(to_jsonb(p.proargnames), '[]'::jsonb),
    'result_type', pg_get_function_result(p.oid),
    'security_definer', p.prosecdef,
    'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb)
  ) order by n.nspname, p.proname, oidvectortypes(p.proargtypes)), '[]'::jsonb) value
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
),
function_grants_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname, 'argument_types', oidvectortypes(p.proargtypes),
    'grantee', case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    'privilege', acl.privilege_type
  ) order by n.nspname, p.proname, oidvectortypes(p.proargtypes), acl.grantee), '[]'::jsonb) value
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
  where n.nspname in ('public', 'private')
),
table_grants_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'table', c.relname,
    'grantee', case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
    'privilege', acl.privilege_type
  ) order by n.nspname, c.relname, acl.grantee, acl.privilege_type), '[]'::jsonb) value
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
  where n.nspname in ('public', 'private', 'realtime') and c.relkind in ('r', 'p')
)
select jsonb_build_object(
  'format', 'sound-village-schema-inventory-v1',
  'captured_at', now(),
  'server_version', current_setting('server_version'),
  'columns', columns_json.value,
  'constraints', constraints_json.value,
  'indexes', indexes_json.value,
  'policies', policies_json.value,
  'rls', rls_json.value,
  'functions', functions_json.value,
  'function_grants', function_grants_json.value,
  'table_grants', table_grants_json.value,
  'external_settings', jsonb_build_object(
    'supabase_anonymous_auth_enabled', 'manual_verification_required',
    'realtime_allow_public_access_disabled', 'manual_verification_required'
  )
)
from columns_json, constraints_json, indexes_json, policies_json, rls_json,
  functions_json, function_grants_json, table_grants_json;

rollback;
