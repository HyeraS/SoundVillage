import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Stage 4 DB environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const browsers = Array.from({ length:3 }, () => createClient(url, anonKey, options))
const users = []
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['A','B','C'].map((role) => `STAGE4_DB_${role}_${suffix}`)
const sessionId = crypto.randomUUID()
const clientIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

const identityA = { skinId:'skin_02', eyesId:'eyes_blue', hairStyleId:'hair_braids', hairColorId:'pink', outfitId:'overalls', accessoryId:'acc_glasses' }
const identityB = { skinId:'skin_07', eyesId:'eyes_red', hairStyleId:'hair_extra_long', hairColorId:'turquoise', outfitId:'skirt', accessoryId:'acc_hat_lucky' }

async function snapshot(userIndex, requestedSession = sessionId, clientId = clientIds[userIndex]) {
  return ok(await admin.rpc('get_duo_v2_character_identity_admin', {
    p_auth_user_id:users[userIndex].id, p_session_id:requestedSession, p_client_id:clientId,
  }), `snapshot ${userIndex}`)
}

try {
  for (let index = 0; index < browsers.length; index += 1) {
    const auth = ok(await browsers[index].auth.signInAnonymously(), `sign in ${index}`)
    users.push(auth.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'participants')
  for (const user of users) ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:user.id }), 'initialize loadout')
  ok(await admin.from('participant_multi_village_character_loadouts').update({
    skin_id:identityA.skinId, eyes_id:identityA.eyesId, hair_style_id:identityA.hairStyleId,
    hair_color_id:identityA.hairColorId, outfit_id:identityA.outfitId, accessory_id:identityA.accessoryId,
  }).eq('participant_id', participantIds[0]), 'loadout A')
  ok(await admin.from('participant_multi_village_character_loadouts').update({
    skin_id:identityB.skinId, eyes_id:identityB.eyesId, hair_style_id:identityB.hairStyleId,
    hair_color_id:identityB.hairColorId, outfit_id:identityB.outfitId, accessory_id:identityB.accessoryId,
  }).eq('participant_id', participantIds[1]), 'loadout B')
  ok(await admin.from('duo_v2_sessions').insert({ id:sessionId, host_auth_user_id:users[0].id, room_system:'economy_v1', expires_at:new Date(Date.now() + 3_600_000).toISOString() }), 'session')
  ok(await admin.from('duo_v2_session_members').insert([
    { session_id:sessionId, auth_user_id:users[0].id, role:'host' },
    { session_id:sessionId, auth_user_id:users[1].id, role:'visitor' },
  ]), 'members')
  ok(await admin.from('duo_v2_leases').insert([
    { session_id:sessionId, auth_user_id:users[0].id, client_id:clientIds[0], screen:'worldmap' },
    { session_id:sessionId, auth_user_id:users[1].id, client_id:clientIds[1], screen:'interior' },
  ]), 'leases')

  const a = await snapshot(0)
  const b = await snapshot(1)
  assert.deepEqual(a, { ok:true, contractVersion:1, self:identityA, peer:identityB })
  assert.deepEqual(b, { ok:true, contractVersion:1, self:identityB, peer:identityA })
  const serialized = JSON.stringify([a, b])
  for (const secret of [...participantIds, ...users.map((user) => user.id), ...clientIds, sessionId]) {
    assert.equal(serialized.includes(secret), false, 'snapshot leaked an operational identifier')
  }

  assert.equal((await snapshot(2)).reason, 'membership_required')
  assert.equal((await snapshot(0, crypto.randomUUID())).reason, 'session_not_found')
  assert.equal((await snapshot(0, sessionId, clientIds[2])).reason, 'lease_mismatch')

  for (const browser of browsers) {
    const direct = await browser.rpc('get_duo_v2_character_identity_admin', {
      p_auth_user_id:users[0].id, p_session_id:sessionId, p_client_id:clientIds[0],
    })
    assert(direct.error, 'authenticated browser executed service-only appearance RPC')
  }

  ok(await admin.from('duo_v2_session_members').update({ left_at:new Date().toISOString() })
    .eq('session_id', sessionId).eq('auth_user_id', users[0].id), 'leave A')
  assert.equal((await snapshot(0)).reason, 'session_left')
  ok(await admin.from('duo_v2_session_members').update({ left_at:null })
    .eq('session_id', sessionId).eq('auth_user_id', users[0].id), 'restore A')
  ok(await admin.from('duo_v2_leases').update({ heartbeat_at:new Date(Date.now() - 60_000).toISOString() })
    .eq('session_id', sessionId).eq('auth_user_id', users[0].id), 'stale A')
  assert.equal((await snapshot(0)).reason, 'lease_stale')
  ok(await admin.from('duo_v2_leases').update({ heartbeat_at:new Date().toISOString() })
    .eq('session_id', sessionId), 'refresh leases')
  ok(await admin.from('duo_v2_sessions').update({ status:'closed', closed_at:new Date().toISOString() }).eq('id', sessionId), 'close')
  assert.equal((await snapshot(0)).reason, 'session_closed')

  console.log('Stage 4 Duo Character Identity DB isolation and lifecycle checks passed.')
} finally {
  await admin.from('duo_v2_sessions').delete().eq('id', sessionId)
  await admin.from('participant_multi_village_character_loadouts').delete().in('participant_id', participantIds)
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
