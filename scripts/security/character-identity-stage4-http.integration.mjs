import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const dbContainer = process.env.SECURITY_TEST_DB_CONTAINER
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey || !dbContainer) throw new Error('Local Stage 4 HTTP environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authClients = Array.from({ length:3 }, () => createClient(supabaseUrl, anonKey, options))
const users = []
const signed = []
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['A','B','C'].map((role) => `STAGE4_HTTP_${role}_${suffix}`)
const sessionId = crypto.randomUUID()
const clientIds = [crypto.randomUUID(), crypto.randomUUID()]
let rpcRevoked = false

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function sql(statement) {
  execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', statement], { stdio:'pipe' })
}

async function request(token, query) {
  const response = await fetch(new URL(`/api/duo-v2/character-identity${query}`, appUrl), {
    headers:token ? { authorization:`Bearer ${token}` } : {},
  })
  return { response, json:await response.json() }
}

try {
  for (const client of authClients) {
    const auth = ok(await client.auth.signInAnonymously(), 'sign in')
    signed.push(auth)
    users.push(auth.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'participants')
  for (const user of users) ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:user.id }), 'initialize')
  ok(await admin.from('duo_v2_sessions').insert({ id:sessionId, host_auth_user_id:users[0].id, room_system:'economy_v1', expires_at:new Date(Date.now() + 3_600_000).toISOString() }), 'session')
  ok(await admin.from('duo_v2_session_members').insert([
    { session_id:sessionId, auth_user_id:users[0].id, role:'host' },
    { session_id:sessionId, auth_user_id:users[1].id, role:'visitor' },
  ]), 'members')
  ok(await admin.from('duo_v2_leases').insert([
    { session_id:sessionId, auth_user_id:users[0].id, client_id:clientIds[0], screen:'worldmap' },
    { session_id:sessionId, auth_user_id:users[1].id, client_id:clientIds[1], screen:'worldmap' },
  ]), 'leases')

  const validQuery = `?sessionId=${sessionId}&clientId=${clientIds[0]}`
  const unauthorized = await request(null, validQuery)
  assert.equal(unauthorized.response.status, 401)
  assert.equal(unauthorized.response.headers.get('cache-control'), 'private, no-store')

  for (const query of ['', `?sessionId=${sessionId}`, `${validQuery}&participantId=${participantIds[0]}`, `${validQuery}&clientId=${clientIds[0]}`]) {
    const invalid = await request(signed[0].session.access_token, query)
    assert.equal(invalid.response.status, 400)
    assert.deepEqual(invalid.json, { ok:false, code:'invalid_request' })
  }

  const success = await request(signed[0].session.access_token, validQuery)
  assert.equal(success.response.status, 200)
  assert.equal(success.response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Object.keys(success.json).sort(), ['code','contractVersion','ok','peer','self'])
  assert.deepEqual(Object.keys(success.json.peer).sort(), ['accessoryId','eyesId','hairColorId','hairStyleId','outfitId','skinId'])
  assert.doesNotMatch(JSON.stringify(success.json), /participant|authUser|wallet|inventory|service_role|sql/i)

  const forbidden = await request(signed[2].session.access_token, `?sessionId=${sessionId}&clientId=${crypto.randomUUID()}`)
  assert.equal(forbidden.response.status, 403)
  assert.equal(forbidden.json.code, 'membership_required')
  const missing = await request(signed[0].session.access_token, `?sessionId=${crypto.randomUUID()}&clientId=${clientIds[0]}`)
  assert.equal(missing.response.status, 404)
  assert.equal(missing.json.code, 'session_not_found')

  ok(await admin.from('duo_v2_session_members').update({ left_at:new Date().toISOString() })
    .eq('session_id', sessionId).eq('auth_user_id', users[0].id), 'leave')
  const left = await request(signed[0].session.access_token, validQuery)
  assert.equal(left.response.status, 409)
  assert.equal(left.json.code, 'session_left')
  ok(await admin.from('duo_v2_session_members').update({ left_at:null })
    .eq('session_id', sessionId).eq('auth_user_id', users[0].id), 'restore')

  sql('revoke execute on function public.get_duo_v2_character_identity_admin(uuid,uuid,uuid) from service_role')
  rpcRevoked = true
  const unavailable = await request(signed[0].session.access_token, validQuery)
  assert.equal(unavailable.response.status, 503)
  assert.deepEqual(unavailable.json, { ok:false, code:'storage_retryable', retryable:true })
  assert.doesNotMatch(JSON.stringify(unavailable.json), /permission|postgres|service_role|function|sql/i)
  sql('grant execute on function public.get_duo_v2_character_identity_admin(uuid,uuid,uuid) to service_role')
  rpcRevoked = false

  console.log('Stage 4 Duo Character Identity HTTP status and redaction checks passed.')
} finally {
  if (rpcRevoked) {
    try { sql('grant execute on function public.get_duo_v2_character_identity_admin(uuid,uuid,uuid) to service_role') } catch {}
  }
  await admin.from('duo_v2_sessions').delete().eq('id', sessionId)
  await admin.from('participant_multi_village_character_loadouts').delete().in('participant_id', participantIds)
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
