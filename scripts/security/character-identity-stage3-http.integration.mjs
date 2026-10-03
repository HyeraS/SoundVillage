import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const dbContainer = process.env.SECURITY_TEST_DB_CONTAINER
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey || !dbContainer) throw new Error('Local Stage 3 HTTP environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const activeClient = createClient(supabaseUrl, anonKey, options)
const inactiveClient = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const activeParticipant = `IDENTITY_HTTP_A_${suffix}`
const inactiveParticipant = `IDENTITY_HTTP_I_${suffix}`
const inactiveEmail = `identity-http-${suffix}@example.test`
const inactivePassword = `Test-${crypto.randomUUID()}-9a!`
let activeUser
let inactiveUser
let rpcRevoked = false

const identity = {
  skinId:'skin_04', eyesId:'eyes_blue', hairStyleId:'hair_braids', hairColorId:'pink',
}

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function request(token, body) {
  const response = await fetch(new URL('/api/economy-v1/character-identity', appUrl), {
    method:'POST',
    headers:{ ...(token ? { authorization:`Bearer ${token}` } : {}), 'content-type':'application/json' },
    body:JSON.stringify(body),
  })
  return { response, json:await response.json() }
}

function sql(statement) {
  execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', statement], { stdio:'pipe' })
}

try {
  const activeAuth = ok(await activeClient.auth.signInAnonymously(), 'active sign-in')
  activeUser = activeAuth.user
  inactiveUser = ok(await admin.auth.admin.createUser({ email:inactiveEmail, password:inactivePassword, email_confirm:true }), 'inactive create').user
  const inactiveAuth = ok(await inactiveClient.auth.signInWithPassword({ email:inactiveEmail, password:inactivePassword }), 'inactive sign-in')
  ok(await admin.from('study_participants').insert([
    { participant_id:activeParticipant, auth_user_id:activeUser.id, group_id:'A', status:'active' },
    { participant_id:inactiveParticipant, auth_user_id:inactiveUser.id, group_id:'A', status:'inactive' },
  ]), 'HTTP participants')
  ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:activeUser.id }), 'initialize active profile')

  const unauthorized = await request(null, { ...identity, idempotencyKey:crypto.randomUUID() })
  assert.equal(unauthorized.response.status, 401)
  assert.equal(unauthorized.response.headers.get('cache-control'), 'private, no-store')

  for (const [payload, code] of [
    [{ ...identity }, 'invalid_idempotency_key'],
    [{ ...identity, idempotencyKey:crypto.randomUUID(), participantId:activeParticipant }, 'invalid_request'],
    [{ ...identity, idempotencyKey:crypto.randomUUID(), outfitId:'basic' }, 'invalid_request'],
  ]) {
    const invalid = await request(activeAuth.session.access_token, payload)
    assert.equal(invalid.response.status, 400)
    assert.equal(invalid.json.code, code)
  }
  for (const [field, value, code] of [
    ['skinId','skin_99','invalid_skin_id'],
    ['eyesId','eyes_orange','invalid_eyes_id'],
    ['hairStyleId','hair_unknown','invalid_hair_style_id'],
    ['hairColorId','orange','invalid_hair_color_id'],
  ]) {
    const invalid = await request(activeAuth.session.access_token, { ...identity, [field]:value, idempotencyKey:crypto.randomUUID() })
    assert.equal(invalid.response.status, 400)
    assert.equal(invalid.json.code, code)
  }

  const inactive = await request(inactiveAuth.session.access_token, { ...identity, idempotencyKey:crypto.randomUUID() })
  assert.equal(inactive.response.status, 403)
  assert.deepEqual(inactive.json, { ok:false, code:'participant_inactive' })

  const key = crypto.randomUUID()
  const saved = await request(activeAuth.session.access_token, { ...identity, idempotencyKey:key })
  assert.equal(saved.response.status, 200)
  assert.equal(saved.response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Object.keys(saved.json).sort(), ['code','loadout','ok'])
  assert.deepEqual(saved.json.loadout, { ...identity, outfitId:'basic', accessoryId:null })
  const replay = await request(activeAuth.session.access_token, { ...identity, idempotencyKey:key })
  assert.equal(replay.response.status, 200)
  assert.deepEqual(replay.json, saved.json)
  const conflict = await request(activeAuth.session.access_token, { ...identity, skinId:'skin_05', idempotencyKey:key })
  assert.equal(conflict.response.status, 409)
  assert.deepEqual(conflict.json, { ok:false, code:'idempotency_key_reused' })

  const profileResponse = await fetch(new URL('/api/economy-v1/character-profile', appUrl), {
    headers:{ authorization:`Bearer ${activeAuth.session.access_token}` },
  })
  const profile = await profileResponse.json()
  assert.equal(profileResponse.status, 200)
  assert.deepEqual(profile.loadout, saved.json.loadout)
  const bootstrapResponse = await fetch(new URL('/api/economy-v1/bootstrap', appUrl), {
    headers:{ authorization:`Bearer ${activeAuth.session.access_token}` },
  })
  const bootstrap = await bootstrapResponse.json()
  assert.equal(bootstrapResponse.status, 200)
  assert.equal(bootstrap.capabilities.characterIdentityCustomization, true)
  assert.equal(bootstrap.identityCatalogVersion, 1)
  assert.deepEqual(bootstrap.profile.loadout, saved.json.loadout)

  sql('revoke execute on function public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid) from service_role')
  rpcRevoked = true
  const retryable = await request(activeAuth.session.access_token, { ...identity, skinId:'skin_06', idempotencyKey:crypto.randomUUID() })
  assert.equal(retryable.response.status, 503)
  assert.deepEqual(retryable.json, { ok:false, code:'storage_retryable', retryable:true })
  assert.equal(retryable.response.headers.get('cache-control'), 'private, no-store')
  assert.doesNotMatch(JSON.stringify(retryable.json), /permission|postgres|service_role|participant|sql/i)
  sql('grant execute on function public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid) to service_role')
  rpcRevoked = false
  console.log('Stage 3 Character Identity HTTP integration checks passed.')
} finally {
  if (rpcRevoked) {
    try { sql('grant execute on function public.save_multi_village_character_identity_admin(uuid,text,text,text,text,uuid) to service_role') } catch {}
  }
  await admin.from('study_participants').delete().in('participant_id', [activeParticipant, inactiveParticipant])
  if (activeUser) await admin.auth.admin.deleteUser(activeUser.id).catch(() => {})
  if (inactiveUser) await admin.auth.admin.deleteUser(inactiveUser.id).catch(() => {})
}
