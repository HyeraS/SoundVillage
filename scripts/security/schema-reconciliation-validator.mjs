import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCHEMA_INVENTORY_FORMAT = 'sound-village-schema-inventory-v1'

export const requiredColumns = [
  ['public', 'participant_house_items', 'quantity', 'integer', 'NO'],
  ['public', 'participant_house_layout', 'id', 'uuid', 'NO'],
  ['public', 'participant_daily_quests', 'created_at', 'timestamp with time zone', 'NO'],
  ['public', 'study_sound_catalog', 'canonical_audio_id', 'text', 'NO'],
  ['public', 'study_sound_catalog', 'file_path', 'text', 'NO'],
  ['public', 'study_sound_catalog', 'source_dataset', 'text', 'NO'],
  ['public', 'study_sound_catalog', 'original_filename', 'text', 'NO'],
  ['public', 'annotations', 'canonical_audio_id', 'text', 'NO'],
  ['public', 'annotations', 'experiment_round', 'integer', 'NO'],
  ['public', 'votes', 'canonical_audio_id', 'text', 'NO'],
  ['public', 'votes', 'experiment_round', 'integer', 'NO'],
  ['public', 'study_sessions', 'experiment_round', 'integer', 'NO'],
  ['public', 'study_sessions', 'completion_operation_key', 'uuid', 'YES'],
  ['public', 'study_sessions', 'completion_annotation_id', 'uuid', 'YES'],
]

export const nullableColumns = [
  ['public', 'annotations', 'difficulty'],
  ['public', 'annotations', 'selected_features'],
]

export const requiredConstraints = [
  ['public', 'participant_house_items', 'p', ['participant_id', 'item_id']],
  ['public', 'participant_house_items', 'c', ['quantity', '> 0']],
  ['public', 'participant_house_layout', 'p', ['id']],
  ['public', 'participant_house_layout', 'u', ['participant_id', 'grid_x', 'grid_y']],
  ['public', 'participant_daily_quests', 'u', ['participant_id', 'quest_template_id', 'assigned_date']],
  ['public', 'study_sound_catalog', 'p', ['sound_id']],
  ['public', 'study_sessions', 'f', ['completion_annotation_id', 'annotations']],
]

export const requiredIndexes = [
  ['public', 'study_sound_catalog_canonical_idx', ['canonical_audio_id']],
  ['public', 'annotations_one_normal_result_per_audio_round_uq', ['unique', 'participant_id', 'experiment_round', 'canonical_audio_id', 'where', 'not is_skipped']],
  ['public', 'votes_one_result_per_audio_round_uq', ['unique', 'participant_id', 'experiment_round', 'canonical_audio_id']],
  ['public', 'study_sessions_one_active_round_uq', ['unique', 'participant_id', 'experiment_round', 'where', "status = 'active'"]],
  ['public', 'user_events_timeline_idx', ['study_session_id', 'occurred_at', 'client_instance_id', 'sequence_no']],
]

export const requiredPolicies = [
  ['public', 'annotations', 'annotations_select_own', 'SELECT'],
  ['public', 'annotations', 'annotations_insert_own', 'INSERT'],
  ['public', 'votes', 'votes_select_own', 'SELECT'],
  ['public', 'votes', 'votes_insert_own', 'INSERT'],
  ['public', 'participant_currency', 'participant_currency_select_own', 'SELECT'],
  ['public', 'currency_transactions', 'currency_transactions_select_own', 'SELECT'],
  ['public', 'participant_outfits', 'participant_outfits_select_own', 'SELECT'],
  ['public', 'participant_equipped_outfit', 'participant_equipped_select_own', 'SELECT'],
  ['public', 'participant_equipped_outfit', 'participant_equipped_insert_own', 'INSERT'],
  ['public', 'participant_equipped_outfit', 'participant_equipped_update_own', 'UPDATE'],
  ['public', 'participant_daily_quests', 'participant_daily_quests_select_own', 'SELECT'],
  ['public', 'participant_attendance', 'participant_attendance_select_own', 'SELECT'],
  ['public', 'participant_interior_items', 'participant_interior_items_select_own', 'SELECT'],
  ['public', 'participant_room', 'participant_room_select_own', 'SELECT'],
  ['public', 'participant_house_items', 'participant_house_items_select_own', 'SELECT'],
  ['public', 'participant_house_layout', 'participant_house_layout_select_own', 'SELECT'],
  ['public', 'participant_house_layout', 'participant_house_layout_insert_own', 'INSERT'],
  ['public', 'participant_house_layout', 'participant_house_layout_update_own', 'UPDATE'],
  ['public', 'participant_house_layout', 'participant_house_layout_delete_own', 'DELETE'],
  ['public', 'study_sessions', 'study_sessions_researcher_select', 'SELECT'],
  ['public', 'user_events', 'user_events_researcher_select', 'SELECT'],
  ['public', 'user_event_names', 'user_event_names_authenticated_read', 'SELECT'],
  ['realtime', 'messages', 'duo_realtime_read', 'SELECT'],
  ['realtime', 'messages', 'duo_realtime_send', 'INSERT'],
]

export const rlsTables = [
  'annotations', 'votes', 'participant_currency', 'currency_transactions',
  'participant_outfits', 'participant_equipped_outfit', 'participant_daily_quests',
  'participant_attendance', 'participant_interior_items', 'participant_room',
  'participant_house_items', 'participant_house_layout', 'study_participants',
  'study_sound_catalog', 'study_sessions', 'user_events', 'user_event_names',
]

export const requiredFunctions = [
  ['public', 'claim_study_participant_admin', 'uuid, text, text', ['p_auth_user_id', 'p_group_id', 'p_participant_id'], 'service_role'],
  ['public', 'secure_purchase_admin', 'uuid, text, text, integer, text, text[], uuid', null, 'service_role'],
  ['public', 'start_or_resume_study_session_v2', 'uuid, uuid, text, text, text, integer, integer, text, text', null, 'authenticated'],
  ['public', 'record_user_events_v1', 'uuid, jsonb', ['p_study_session_id', 'p_events'], 'authenticated'],
  ['public', 'save_participant_room_v3', 'uuid, jsonb', ['p_idempotency_key', 'p_room'], 'authenticated'],
  ['public', 'submit_annotation_v4', 'uuid, text, text, text, jsonb, integer, integer, integer, numeric, boolean, text, text, integer, text', null, 'authenticated'],
  ['public', 'submit_museum_vote_v4', 'uuid, text, text, uuid, integer, integer, numeric, integer, text', null, 'authenticated'],
  ['public', 'ensure_today_quests', 'text[]', ['p_known_sub_categories'], 'authenticated'],
]

export const forbiddenAuthenticatedFunctions = [
  ['submit_annotation_v3', 'uuid, text, text, text, text, text, text, jsonb, integer, integer, integer, numeric, boolean, text, text, integer, text'],
  ['submit_museum_vote_v3', 'uuid, text, text, uuid, integer, integer, numeric, integer, text'],
  ['ensure_today_check_in_v3', 'uuid'],
  ['start_or_resume_study_session_v1', 'uuid, uuid, text, text, text, integer, integer, text, text'],
  ['increment_vote_count', null],
  ['increment_currency_balance', null],
  ['increment_house_item_quantity', null],
]

const compact = value => String(value || '').toLowerCase().replaceAll('"', '').replace(/\s+/g, ' ').trim()
const signature = value => compact(value).replace(/\s*,\s*/g, ', ')
const hasTokens = (value, tokens) => tokens.every(token => compact(value).includes(compact(token)))

function hasFunctionGrant(inventory, schema, name, argumentTypes, grantee) {
  return inventory.function_grants.some(grant => grant.schema === schema && grant.name === name
    && signature(grant.argument_types) === signature(argumentTypes)
    && String(grant.grantee).toLowerCase() === grantee.toLowerCase()
    && String(grant.privilege).toUpperCase() === 'EXECUTE')
}

export function validateSchemaInventory(inventory) {
  const errors = []
  const warnings = []
  if (inventory?.format !== SCHEMA_INVENTORY_FORMAT) errors.push('schema_inventory_format_invalid')
  for (const key of ['columns', 'constraints', 'indexes', 'policies', 'rls', 'functions', 'function_grants', 'table_grants']) {
    if (!Array.isArray(inventory?.[key])) errors.push(`inventory_${key}_missing`)
  }
  if (errors.length) return { ok: false, errors, warnings }

  for (const [schema, table, column, dataType, nullable] of requiredColumns) {
    const found = inventory.columns.find(row => row.schema === schema && row.table === table && row.column === column)
    if (!found) errors.push(`column_missing:${schema}.${table}.${column}`)
    else {
      if (compact(found.data_type) !== compact(dataType) && compact(found.udt_name) !== compact(dataType)) {
        errors.push(`column_type_mismatch:${schema}.${table}.${column}`)
      }
      if (found.nullable !== nullable) errors.push(`column_nullability_mismatch:${schema}.${table}.${column}`)
    }
  }
  for (const [schema, table, column] of nullableColumns) {
    const found = inventory.columns.find(row => row.schema === schema && row.table === table && row.column === column)
    if (!found) errors.push(`column_missing:${schema}.${table}.${column}`)
    else if (found.nullable !== 'YES') errors.push(`column_must_allow_null:${schema}.${table}.${column}`)
  }

  for (const [schema, table, type, tokens] of requiredConstraints) {
    const found = inventory.constraints.some(row => row.schema === schema && row.table === table
      && row.type === type && hasTokens(row.definition, tokens))
    if (!found) errors.push(`constraint_missing_or_mismatched:${schema}.${table}:${type}:${tokens.join('+')}`)
  }
  for (const [schema, name, tokens] of requiredIndexes) {
    const found = inventory.indexes.find(row => row.schema === schema && row.name === name)
    if (!found || !hasTokens(found.definition, tokens)) errors.push(`index_missing_or_mismatched:${schema}.${name}`)
  }
  for (const [schema, table, name, command] of requiredPolicies) {
    if (!inventory.policies.some(row => row.schema === schema && row.table === table && row.name === name
      && String(row.command).toUpperCase() === command
      && Array.isArray(row.roles) && row.roles.map(role => String(role).toLowerCase()).includes('authenticated'))) {
      errors.push(`policy_missing:${schema}.${table}.${name}`)
    }
  }
  const allowedPolicies = new Set(requiredPolicies.map(([schema, table, name]) => `${schema}.${table}.${name}`))
  const policyScopedTables = new Set(requiredPolicies.map(([schema, table]) => `${schema}.${table}`))
  for (const policy of inventory.policies) {
    if (policyScopedTables.has(`${policy.schema}.${policy.table}`)
      && !allowedPolicies.has(`${policy.schema}.${policy.table}.${policy.name}`)) {
      errors.push(`unexpected_policy:${policy.schema}.${policy.table}.${policy.name}`)
    }
  }
  for (const command of ['INSERT', 'UPDATE', 'DELETE']) {
    if (inventory.policies.some(row => row.schema === 'public' && row.table === 'participant_room'
      && String(row.command).toUpperCase() === command
      && Array.isArray(row.roles) && row.roles.map(role => String(role).toLowerCase()).includes('authenticated'))) {
      errors.push(`participant_room_direct_write_policy_present:${command}`)
    }
  }
  for (const table of rlsTables) {
    if (!inventory.rls.some(row => row.schema === 'public' && row.table === table && row.enabled === true)) {
      errors.push(`rls_not_enabled:public.${table}`)
    }
  }
  if (!inventory.rls.some(row => row.schema === 'realtime' && row.table === 'messages' && row.enabled === true)) {
    errors.push('rls_not_enabled:realtime.messages')
  }

  for (const [schema, name, argumentTypes, argumentNames, grantee] of requiredFunctions) {
    const found = inventory.functions.find(row => row.schema === schema && row.name === name
      && signature(row.argument_types) === signature(argumentTypes))
    if (!found) {
      errors.push(`function_missing_or_signature_mismatch:${schema}.${name}(${argumentTypes})`)
      continue
    }
    if (!found.security_definer) errors.push(`function_not_security_definer:${schema}.${name}`)
    if (!Array.isArray(found.config) || !found.config.some(value => ['search_path=', 'search_path=\"\"'].includes(compact(value)))) {
      errors.push(`function_search_path_not_empty:${schema}.${name}`)
    }
    if (argumentNames && JSON.stringify(found.argument_names.slice(0, argumentNames.length)) !== JSON.stringify(argumentNames)) {
      errors.push(`function_argument_names_mismatch:${schema}.${name}`)
    }
    if (!hasFunctionGrant(inventory, schema, name, argumentTypes, grantee)) {
      errors.push(`function_execute_grant_missing:${grantee}:${schema}.${name}`)
    }
    for (const forbidden of ['PUBLIC', 'anon']) {
      if (hasFunctionGrant(inventory, schema, name, argumentTypes, forbidden)) {
        errors.push(`function_execute_grant_forbidden:${forbidden}:${schema}.${name}`)
      }
    }
  }

  for (const [name, argumentTypes] of forbiddenAuthenticatedFunctions) {
    const grants = inventory.function_grants.filter(grant => grant.schema === 'public' && grant.name === name
      && (!argumentTypes || signature(grant.argument_types) === signature(argumentTypes))
      && String(grant.grantee).toLowerCase() === 'authenticated'
      && String(grant.privilege).toUpperCase() === 'EXECUTE')
    if (grants.length) errors.push(`legacy_function_still_executable:authenticated:public.${name}`)
  }

  const protectedTables = new Set(rlsTables)
  for (const grant of inventory.table_grants) {
    if (grant.schema !== 'public' || !protectedTables.has(grant.table)) continue
    const grantee = String(grant.grantee).toLowerCase()
    const privilege = String(grant.privilege).toUpperCase()
    if ((grantee === 'public' || grantee === 'anon') && ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(privilege)) {
      errors.push(`forbidden_table_grant:${grantee}:public.${grant.table}:${privilege}`)
    }
    if (grantee === 'authenticated' && grant.table === 'participant_room' && ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(privilege)) {
      errors.push(`participant_room_rpc_bypass_grant:${privilege}`)
    }
    if (grantee === 'authenticated' && ['annotations', 'votes', 'participant_equipped_outfit', 'user_events']
      .includes(grant.table) && ['INSERT', 'UPDATE', 'DELETE'].includes(privilege)) {
      errors.push(`authenticated_direct_write_grant:${grant.table}:${privilege}`)
    }
  }

  warnings.push('dashboard_check_required:supabase_anonymous_auth_enabled')
  warnings.push('dashboard_check_required:realtime_allow_public_access_disabled')
  warnings.push('data_preflight_required:duplicates_drift_completed_and_active_sessions')
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings }
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node schema-reconciliation-validator.mjs /absolute/schema-inventory.json')
  const inventory = JSON.parse(await readFile(path.resolve(process.argv[2]), 'utf8'))
  const result = validateSchemaInventory(inventory)
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
