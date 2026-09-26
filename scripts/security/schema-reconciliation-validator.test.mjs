import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  requiredColumns,
  nullableColumns,
  requiredConstraints,
  requiredFunctions,
  requiredIndexes,
  requiredPolicies,
  rlsTables,
  SCHEMA_INVENTORY_FORMAT,
  validateSchemaInventory,
} from './schema-reconciliation-validator.mjs'

function contractInventory() {
  return {
    format: SCHEMA_INVENTORY_FORMAT,
    columns: [
      ...requiredColumns.map(([schema, table, column, data_type, nullable]) => ({ schema, table, column, data_type, udt_name: data_type, nullable })),
      ...nullableColumns.map(([schema, table, column]) => ({ schema, table, column, data_type: 'jsonb', udt_name: 'jsonb', nullable: 'YES' })),
    ],
    constraints: requiredConstraints.map(([schema, table, type, tokens], index) => ({
      schema, table, type, name: `fixture_${index}`, definition: tokens.join(' '),
    })),
    indexes: requiredIndexes.map(([schema, name, tokens]) => ({ schema, name, definition: tokens.join(' ') })),
    policies: requiredPolicies.map(([schema, table, name, command]) => ({ schema, table, name, command, roles: ['authenticated'] })),
    rls: [...rlsTables.map(table => ({ schema: 'public', table, enabled: true })),
      { schema: 'realtime', table: 'messages', enabled: true }],
    functions: requiredFunctions.map(([schema, name, argument_types, argument_names]) => ({
      schema, name, argument_types, argument_names: argument_names || [], security_definer: true, config: ['search_path='],
    })),
    function_grants: requiredFunctions.map(([schema, name, argument_types, , grantee]) => ({
      schema, name, argument_types, grantee, privilege: 'EXECUTE',
    })),
    table_grants: [],
  }
}

test('complete schema inventory contract passes with explicit dashboard warnings', () => {
  const result = validateSchemaInventory(contractInventory())
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert(result.warnings.includes('dashboard_check_required:realtime_allow_public_access_disabled'))
})

test('known local compatibility columns and exact function argument names are mandatory', () => {
  const inventory = contractInventory()
  inventory.columns = inventory.columns.filter(row => row.column !== 'quantity')
  inventory.functions.find(row => row.name === 'ensure_today_quests').argument_names = ['renamed_argument']
  const result = validateSchemaInventory(inventory)
  assert.equal(result.ok, false)
  assert(result.errors.includes('column_missing:public.participant_house_items.quantity'))
  assert(result.errors.includes('function_argument_names_mismatch:public.ensure_today_quests'))
})

test('legacy RPC execute is a blocker', () => {
  const inventory = contractInventory()
  inventory.function_grants.push({
    schema: 'public', name: 'ensure_today_check_in_v3', argument_types: 'uuid',
    grantee: 'authenticated', privilege: 'EXECUTE',
  })
  const result = validateSchemaInventory(inventory)
  assert.equal(result.ok, false)
  assert(result.errors.includes('legacy_function_still_executable:authenticated:public.ensure_today_check_in_v3'))
})

for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
  test(`participant_room authenticated ${privilege} grant is an independent blocker`, () => {
    const inventory = contractInventory()
    inventory.table_grants.push({
      schema: 'public', table: 'participant_room', grantee: 'authenticated', privilege,
    })
    const result = validateSchemaInventory(inventory)
    assert.equal(result.ok, false)
    assert(result.errors.includes(`participant_room_rpc_bypass_grant:${privilege}`))
  })
}

test('participant_room authenticated write policies are blockers even without table grants', () => {
  const inventory = contractInventory()
  inventory.policies.push({
    schema: 'public', table: 'participant_room', name: 'participant_room_insert_own',
    command: 'INSERT', roles: ['authenticated'],
  })
  const result = validateSchemaInventory(inventory)
  assert.equal(result.ok, false)
  assert(result.errors.includes('participant_room_direct_write_policy_present:INSERT'))
})

test('anon or PUBLIC table writes fail even when RLS is enabled', () => {
  const inventory = contractInventory()
  inventory.table_grants.push({ schema: 'public', table: 'votes', grantee: 'anon', privilege: 'INSERT' })
  const result = validateSchemaInventory(inventory)
  assert.equal(result.ok, false)
  assert(result.errors.includes('forbidden_table_grant:anon:public.votes:INSERT'))
})

for (const grantee of ['anon', 'PUBLIC']) {
  test(`participant_room ${grantee} TRUNCATE grant is forbidden`, () => {
    const inventory = contractInventory()
    inventory.table_grants.push({ schema: 'public', table: 'participant_room', grantee, privilege: 'TRUNCATE' })
    const result = validateSchemaInventory(inventory)
    assert.equal(result.ok, false)
    assert(result.errors.includes(`forbidden_table_grant:${grantee.toLowerCase()}:public.participant_room:TRUNCATE`))
  })
}

test('participant_room owner SELECT and exact RPC-only contract remain allowed', () => {
  const inventory = contractInventory()
  inventory.table_grants.push({
    schema: 'public', table: 'participant_room', grantee: 'authenticated', privilege: 'SELECT',
  })
  const result = validateSchemaInventory(inventory)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('schema snapshot is catalog-only and transactionally read-only', async () => {
  const sql = await readFile(new URL('./schema-reconciliation-snapshot.sql', import.meta.url), 'utf8')
  assert.match(sql, /begin transaction read only;/i)
  assert.match(sql, /rollback;/i)
  const withoutComments = sql.replace(/--.*$/gm, '')
  assert.doesNotMatch(withoutComments, /\b(insert|update|delete|truncate|alter|drop|create)\b/i)
  assert.doesNotMatch(withoutComments, /public\.(annotations|votes|study_sessions|user_events)\b/i)
  assert.doesNotMatch(withoutComments, /pg_get_functiondef|\bprosrc\b|\bprobin\b/i)
  assert.match(withoutComments, /aclexplode\(coalesce\(c\.relacl,\s*acldefault\('r',\s*c\.relowner\)\)\)/i)
  assert.match(withoutComments, /'privilege',\s*acl\.privilege_type/i)
})
