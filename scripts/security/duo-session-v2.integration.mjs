import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Duo V2 integration environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const serviceA = createClient(url, serviceKey, options)
const serviceB = createClient(url, serviceKey, options)
const browserClients = Array.from({ length:4 }, () => createClient(url, anonKey, options))
const users = []
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['HOST','B','C','D'].map((role) => `DUO_${role}_${suffix}`)
const clientIds = Array.from({ length:12 }, () => crypto.randomUUID())

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function token() {
  return randomBytes(32).toString('base64url')
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hostRequestHash(clientId, tokenHash, roomSystem = 'economy_v1') {
  return hash(JSON.stringify([clientId, tokenHash, roomSystem]))
}

function joinRequestHash(clientId, tokenHash) {
  return hash(JSON.stringify([clientId, tokenHash]))
}

function hostArgs(userId, clientId, inviteToken, idempotencyKey = crypto.randomUUID()) {
  const tokenHash = hash(inviteToken)
  return {
    p_auth_user_id:userId, p_client_id:clientId, p_token_hash:tokenHash,
    p_idempotency_key:idempotencyKey, p_request_hash:hostRequestHash(clientId, tokenHash),
    p_room_system:'economy_v1',
  }
}

function joinArgs(userId, clientId, inviteToken, idempotencyKey = crypto.randomUUID()) {
  const tokenHash = hash(inviteToken)
  return {
    p_auth_user_id:userId, p_client_id:clientId, p_token_hash:tokenHash,
    p_idempotency_key:idempotencyKey, p_request_hash:joinRequestHash(clientId, tokenHash),
  }
}

try {
  for (let index = 0; index < browserClients.length; index += 1) {
    const signed = ok(await browserClients[index].auth.signInAnonymously(), `sign in ${index}`)
    users.push(signed.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'create Duo participants')
  ok(await admin.from('participant_economy_v1_rooms').insert({
    participant_id:participantIds[0],
    room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:[] },
    revision:1,
  }), 'seed host room')

  const firstToken = token()
  const hostKey = crypto.randomUUID()
  const hostRequest = hostArgs(users[0].id, clientIds[0], firstToken, hostKey)
  assert.equal(ok(await serviceA.rpc('create_duo_v2_session_admin', hostRequest), 'zero item host').reason, 'invite_locked')

  const officialItems = ['plant_tall','plant_bush','books','fruitbowl']
  ok(await admin.from('participant_catalog_items').insert(officialItems.map((itemId) => ({
    participant_id:participantIds[0], item_id:itemId, acquisition_source:'individual_purchase',
  }))), 'seed official ownership')
  const roomWith = (ids) => ({
    wallpaper:'starter_wall_neutral', floor:'starter_floor_beige',
    items:ids.map((itemId, index) => ({ uid:index + 1, itemId, layer:'floor', col:index, row:0, flip:false })),
  })
  for (const [label, ids] of [
    ['three unique items', officialItems.slice(0, 3)],
    ['four repeated placements', Array(4).fill(officialItems[0])],
    ['unowned forged item', [...officialItems.slice(0, 3), 'cactus']],
    ['starter forged item', [...officialItems.slice(0, 3), 'starter_floor_beige']],
    ['pending forged item', [...officialItems.slice(0, 3), 'interior_pending_01']],
  ]) {
    ok(await admin.from('participant_economy_v1_rooms').update({ room:roomWith(ids), invite_unique_item_count:4 })
      .eq('participant_id', participantIds[0]), `seed ${label}`)
    assert.equal(ok(await serviceA.rpc('create_duo_v2_session_admin', {
      ...hostRequest, p_idempotency_key:crypto.randomUUID(),
    }), label).reason, 'invite_locked')
  }
  ok(await admin.from('participant_economy_v1_rooms').update({ room:roomWith(officialItems), invite_unique_item_count:4 })
    .eq('participant_id', participantIds[0]), 'seed eligible room')
  const hosted = ok(await serviceA.rpc('create_duo_v2_session_admin', hostRequest), 'host create')
  assert.equal(hosted.ok, true)
  assert.equal(hosted.role, 'host')
  assert.equal(typeof hosted.sessionId, 'string')
  assert.deepEqual(ok(await serviceB.rpc('create_duo_v2_session_admin', hostRequest), 'host replay'), hosted)
  const blockedHostResume = ok(await serviceB.rpc('recover_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:hosted.sessionId, p_client_id:clientIds[1],
  }), 'active host second tab')
  assert.equal(blockedHostResume.reason, 'already_open_elsewhere')
  const reusedHostKey = ok(await serviceB.rpc('create_duo_v2_session_admin', {
    ...hostRequest, p_client_id:clientIds[1], p_request_hash:hostRequestHash(clientIds[1], hash(firstToken)),
  }), 'host key reuse')
  assert.equal(reusedHostKey.reason, 'idempotency_key_reused')

  const concurrent = await Promise.all([
    serviceA.rpc('join_duo_v2_session_admin', joinArgs(users[1].id, clientIds[2], firstToken)),
    serviceB.rpc('join_duo_v2_session_admin', joinArgs(users[2].id, clientIds[3], firstToken)),
  ])
  const joined = concurrent.map((entry, index) => ok(entry, `concurrent visitor ${index}`))
  assert.equal(joined.filter((entry) => entry.ok).length, 1)
  assert.equal(joined.filter((entry) => entry.reason === 'session_full').length, 1)
  const winnerIndex = joined[0].ok ? 1 : 2
  const loserIndex = winnerIndex === 1 ? 2 : 1
  const winnerClient = winnerIndex === 1 ? clientIds[2] : clientIds[3]

  const secondTab = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[winnerIndex].id, clientIds[4], firstToken)), 'second visitor tab')
  assert.equal(secondTab.reason, 'already_open_elsewhere')
  const thirdParticipant = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[3].id, clientIds[5], firstToken)), 'third participant')
  assert.equal(thirdParticipant.reason, 'session_full')

  const heartbeatHost = ok(await serviceA.rpc('heartbeat_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:hosted.sessionId, p_client_id:clientIds[0],
    p_screen:'interior', p_idempotency_key:crypto.randomUUID(),
  }), 'host heartbeat')
  assert.equal(heartbeatHost.ok, true)
  const heartbeatVisitor = ok(await serviceB.rpc('heartbeat_duo_v2_session_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:winnerClient,
    p_screen:'worldmap', p_idempotency_key:crypto.randomUUID(),
  }), 'visitor heartbeat')
  assert.equal(heartbeatVisitor.peerPresent, true)
  assert.equal(heartbeatVisitor.peerScreen, 'interior')

  const room = ok(await serviceA.rpc('get_duo_v2_shared_room_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:winnerClient,
  }), 'Duo room read')
  assert.equal(room.ok, true)
  assert.equal(JSON.stringify(room).includes(participantIds[0]), false)
  assert.equal('authUserId' in room || 'clientId' in room, false)

  ok(await admin.from('participant_currency').upsert({
    participant_id:participantIds[winnerIndex], balance:1_000,
  }), 'seed visitor legacy balance')
  const blockedLegacyPurchase = await serviceA.rpc('secure_purchase_admin', {
    p_auth_user_id:users[winnerIndex].id, p_kind:'interior_item', p_item_id:'plant_tall',
    p_price:50, p_ledger_type:'spend_interior', p_grant_item_ids:['plant_tall'],
    p_request_id:crypto.randomUUID(),
  })
  assert.equal(blockedLegacyPurchase.data, null)
  assert.equal(blockedLegacyPurchase.error?.code, '42501')
  assert.equal(ok(await admin.from('participant_interior_items').select('item_id')
    .eq('participant_id', participantIds[winnerIndex]).eq('item_id', 'plant_tall'),
  'read blocked legacy grant').length, 0)

  const badLeave = ok(await serviceA.rpc('leave_duo_v2_session_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId,
    p_client_id:clientIds[11], p_idempotency_key:crypto.randomUUID(),
  }), 'wrong client leave')
  assert.equal(badLeave.reason, 'lease_mismatch')
  assert.equal(ok(await serviceA.rpc('get_duo_v2_session_status_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:winnerClient,
  }), 'lease survives wrong leave').ok, true)

  ok(await serviceA.rpc('leave_duo_v2_session_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId,
    p_client_id:winnerClient, p_idempotency_key:crypto.randomUUID(),
  }), 'visitor leave')
  assert.equal(ok(await serviceA.rpc('get_duo_v2_shared_room_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:winnerClient,
  }), 'room after leave').reason, 'session_closed')
  const afterLeaveClient = clientIds[6]
  const afterLeave = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[winnerIndex].id, afterLeaveClient, firstToken)), 'visitor rejoin after leave')
  assert.equal(afterLeave.ok, true)

  ok(await admin.from('duo_v2_leases').update({ heartbeat_at:new Date(Date.now() - 60_000).toISOString() })
    .eq('session_id', hosted.sessionId).eq('auth_user_id', users[winnerIndex].id), 'age visitor lease')
  assert.equal(ok(await serviceA.rpc('get_duo_v2_shared_room_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:afterLeaveClient,
  }), 'room with stale lease').reason, 'session_closed')
  const staleRecoveredClient = clientIds[7]
  const staleRecovery = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[winnerIndex].id, staleRecoveredClient, firstToken)), 'stale lease recovery')
  assert.equal(staleRecovery.ok, true)

  ok(await serviceA.rpc('leave_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:hosted.sessionId,
    p_client_id:clientIds[0], p_idempotency_key:crypto.randomUUID(),
  }), 'host page leave')
  const resumedHostClient = clientIds[10]
  const resumedHost = ok(await serviceA.rpc('recover_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:hosted.sessionId, p_client_id:resumedHostClient,
  }), 'host resume')
  assert.equal(resumedHost.ok, true)

  const rotatedToken = token()
  const rotated = ok(await serviceA.rpc('create_duo_v2_session_admin',
    hostArgs(users[0].id, resumedHostClient, rotatedToken)), 'rotate invite')
  assert.equal(rotated.sessionId, hosted.sessionId)
  const oldTokenReplay = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[loserIndex].id, clientIds[8], firstToken)), 'revoked token replay')
  assert.equal(oldTokenReplay.reason, 'invite_revoked')

  ok(await admin.from('duo_v2_invites').update({ expires_at:new Date(Date.now() - 1_000).toISOString() })
    .eq('token_hash', hash(rotatedToken)), 'expire invite')
  const expired = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[loserIndex].id, clientIds[9], rotatedToken)), 'expired invite')
  assert.equal(expired.reason, 'invite_expired')

  const inviteRows = ok(await admin.from('duo_v2_invites').select('*').eq('session_id', hosted.sessionId), 'invite rows')
  const serializedInvites = JSON.stringify(inviteRows)
  assert.equal(serializedInvites.includes(firstToken), false)
  assert.equal(serializedInvites.includes(rotatedToken), false)
  assert(inviteRows.every((row) => /^[0-9a-f]{64}$/.test(row.token_hash)))

  for (const client of browserClients.slice(0, 2)) {
    assert((await client.rpc('create_duo_v2_session_admin', hostRequest)).error,
      'browser must not execute Duo admin RPC')
    for (const action of [
      client.from('duo_v2_sessions').select('*'),
      client.from('duo_v2_leases').update({ screen:'worldmap' }).eq('session_id', hosted.sessionId),
      client.from('duo_v2_invites').delete().eq('session_id', hosted.sessionId),
    ]) assert((await action).error, 'browser direct Duo table access must be denied')
  }

  const closed = ok(await serviceA.rpc('close_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:hosted.sessionId, p_idempotency_key:crypto.randomUUID(),
  }), 'host close')
  assert.equal(closed.ok, true)
  const closedStatus = ok(await serviceA.rpc('get_duo_v2_session_status_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:staleRecoveredClient,
  }), 'closed status')
  assert.equal(closedStatus.reason, 'session_closed')
  assert.equal(ok(await serviceA.rpc('get_duo_v2_shared_room_admin', {
    p_auth_user_id:users[winnerIndex].id, p_session_id:hosted.sessionId, p_client_id:staleRecoveredClient,
  }), 'room after close').reason, 'session_closed')

  const newToken = token()
  const replacement = ok(await serviceA.rpc('create_duo_v2_session_admin',
    hostArgs(users[0].id, clientIds[0], newToken)), 'replacement host session')
  assert.equal(replacement.ok, true)
  assert.notEqual(replacement.sessionId, hosted.sessionId)

  ok(await admin.from('study_participants').update({ status:'inactive' }).eq('participant_id', participantIds[3]), 'deactivate participant')
  const inactive = ok(await serviceA.rpc('join_duo_v2_session_admin',
    joinArgs(users[3].id, clientIds[11], newToken)), 'inactive join')
  assert.equal(inactive.reason, 'participant_inactive')

  console.log('Duo Session V2 DB concurrency, token, lease, ACL, and room-boundary checks passed.')
} finally {
  if (users.length) {
    await admin.from('duo_v2_operation_results').delete().in('auth_user_id', users.map((user) => user.id))
    await admin.from('duo_v2_sessions').delete().in('host_auth_user_id', users.map((user) => user.id))
  }
  await admin.from('participant_economy_v1_rooms').delete().in('participant_id', participantIds)
  await admin.from('participant_currency').delete().in('participant_id', participantIds)
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
