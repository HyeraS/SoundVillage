import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('SECURITY_TEST_SUPABASE_* variables are required')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const unauthenticated = createClient(url, anonKey, { auth: { persistSession: false } })
const clientA = createClient(url, anonKey, { auth: { persistSession: false } })
const clientB = createClient(url, anonKey, { auth: { persistSession: false } })
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `RLS_A_${suffix}`
const participantB = `RLS_B_${suffix}`
let userA
let userB
let sessionA

async function mustSucceed(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

try {
  const anonymousRead = await unauthenticated.from('participant_currency').select('*')
  assert(anonymousRead.error, 'unauthenticated participant SELECT must fail')
  const anonymousRpc = await unauthenticated.rpc('increment_currency_balance', { p_participant_id: participantA, p_amount: 1 })
  assert(anonymousRpc.error, 'legacy currency mutator must be unavailable')

  await mustSucceed(await admin.from('study_participants').insert([
    { participant_id: participantA, group_id: 'A' },
    { participant_id: participantB, group_id: 'B' },
  ]), 'register participants')

  userA = (await mustSucceed(await clientA.auth.signInAnonymously(), 'sign in A')).user
  userB = (await mustSucceed(await clientB.auth.signInAnonymously(), 'sign in B')).user
  const claimA = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userA.id, p_group_id: 'A', p_participant_id: participantA,
  }), 'claim A')
  assert.equal(claimA.status, 'ok')
  const reconnectA = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userA.id, p_group_id: 'A', p_participant_id: participantA,
  }), 'reconnect A')
  assert.equal(reconnectA.status, 'ok')
  const stolenA = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userB.id, p_group_id: 'A', p_participant_id: participantA,
  }), 'reject stolen A')
  assert.equal(stolenA.status, 'participant_claimed')
  const wrongGroup = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userB.id, p_group_id: 'A', p_participant_id: participantB,
  }), 'reject wrong group')
  assert.equal(wrongGroup.status, 'group_mismatch')
  const unknown = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userB.id, p_group_id: 'B', p_participant_id: `UNKNOWN_${suffix}`,
  }), 'reject unknown')
  assert.equal(unknown.status, 'participant_not_registered')
  const claimB = await mustSucceed(await admin.rpc('claim_study_participant_admin', {
    p_auth_user_id: userB.id, p_group_id: 'B', p_participant_id: participantB,
  }), 'claim B')
  assert.equal(claimB.status, 'ok')

  const directInsert = await clientA.from('participant_room').insert({ participant_id: participantA, room: { items: [] } })
  assert(directInsert.error, 'authenticated direct room INSERT must fail')

  const firstKey = crypto.randomUUID()
  const firstRoom = { wallpaper: 'rpc-only', items: [] }
  const firstSave = await mustSucceed(await clientA.rpc('save_participant_room_v3', {
    p_idempotency_key: firstKey, p_room: firstRoom,
  }), 'A saves own room through RPC')
  const replaySave = await mustSucceed(await clientA.rpc('save_participant_room_v3', {
    p_idempotency_key: firstKey, p_room: { wallpaper: 'must-not-replace', items: [] },
  }), 'A replays room save')
  assert.deepEqual(replaySave, firstSave)

  const directUpdate = await clientA.from('participant_room').update({ room: { items: ['forbidden'] } }).eq('participant_id', participantA)
  assert(directUpdate.error, 'authenticated direct room UPDATE must fail')
  const directDelete = await clientA.from('participant_room').delete().eq('participant_id', participantA)
  assert(directDelete.error, 'authenticated direct room DELETE must fail')

  const crossInsert = await clientA.from('participant_room').insert({ participant_id: participantB, room: { items: ['forbidden'] } })
  assert(crossInsert.error, 'A must not write B room directly')
  const crossRead = await mustSucceed(await clientA.from('participant_room').select('*').eq('participant_id', participantB), 'A queries B room')
  assert.deepEqual(crossRead, [])
  const ownRead = await mustSucceed(await clientA.from('participant_room').select('*').eq('participant_id', participantA), 'A reads own room')
  assert.equal(ownRead.length, 1)
  assert.deepEqual(ownRead[0].room, firstRoom)

  const concurrentRooms = [
    { wallpaper: 'concurrent-a', items: [] },
    { wallpaper: 'concurrent-b', items: [] },
  ]
  const concurrentResults = await Promise.all(concurrentRooms.map((room) => clientA.rpc('save_participant_room_v3', {
    p_idempotency_key: crypto.randomUUID(), p_room: room,
  })))
  concurrentResults.forEach((result, index) => mustSucceed(result, `independent concurrent room save ${index + 1}`))
  const converged = await mustSucceed(await clientA.from('participant_room').select('room').eq('participant_id', participantA).single(), 'converged room')
  assert(concurrentRooms.some(room => room.wallpaper === converged.room.wallpaper
    && Array.isArray(converged.room.items) && converged.room.items.length === room.items.length),
  'independent keys converge to one complete room snapshot')

  await mustSucceed(await clientB.rpc('save_participant_room_v3', {
    p_idempotency_key: crypto.randomUUID(), p_room: { wallpaper: 'test', items: [] },
  }), 'B saves own room through RPC')
  const crossRpc = await mustSucceed(await clientA.rpc('save_participant_room_v3', {
    p_idempotency_key: crypto.randomUUID(), p_room: { participant_id: participantB, items: ['not-an-identity-field'] },
  }), 'RPC ignores payload identity-like content and derives A ownership')
  assert.equal(crossRpc.roomId, participantA)
  assert.equal((await mustSucceed(await clientB.from('participant_room').select('room').eq('participant_id', participantB).single(), 'B room unchanged')).room.wallpaper, 'test')
  const share = await mustSucceed(await clientB.rpc('get_or_create_room_share'), 'B creates share')
  const sharedRoom = await mustSucceed(await clientA.rpc('get_shared_room', { p_share_token: share.shareToken }), 'A reads shared room')
  assert.deepEqual(sharedRoom.room.items, [])
  assert.equal('participant_id' in sharedRoom, false)

  const clientInstanceId = crypto.randomUUID()
  sessionA = (await mustSucceed(await clientA.rpc('start_or_resume_study_session_v2', {
    p_client_instance_id: clientInstanceId,
  }), 'A starts event session')).studySessionId
  const eventId = crypto.randomUUID()
  const roomEvent = {
    id: eventId, client_instance_id: clientInstanceId, sequence_no: 1,
    event_name: 'room_save_succeeded', occurred_at: new Date().toISOString(),
    screen: 'interior', target_type: 'button', target_id: 'room-save',
    interaction_method: 'programmatic', outcome: 'succeeded', operation_type: 'room_save',
    operation_idempotency_key: firstKey, result_entity_type: 'participant_room', app_version: 'integration',
  }
  assert.equal((await mustSucceed(await clientA.rpc('record_user_events_v1', {
    p_study_session_id: sessionA, p_events: [roomEvent],
  }), 'room success event')).stored, 1)
  assert.equal((await mustSucceed(await clientA.rpc('record_user_events_v1', {
    p_study_session_id: sessionA, p_events: [roomEvent],
  }), 'room success event replay')).duplicates, 1)
  const storedEvent = await mustSucceed(await admin.from('user_events')
    .select('target_id,result_entity_id,metadata,value_before,value_after')
    .eq('id', eventId).single(), 'inspect sanitized room event')
  const exposedPayload = JSON.stringify(storedEvent)
  assert.equal(exposedPayload.includes(participantA), false)
  assert.equal(exposedPayload.includes(userA.id), false)
  assert.equal(exposedPayload.includes(share.shareToken), false)
  assert.equal(exposedPayload.includes(JSON.stringify(converged.room)), false)

  const museum = await mustSucceed(await clientA.rpc('museum_candidate_expressions', {
    p_sound_ids: ['not-present'], p_exclude_expression: null, p_limit: 5,
  }), 'museum RPC')
  assert.deepEqual(museum, [])
  console.log('Local RLS integration checks passed.')
} finally {
  if (sessionA) await admin.from('user_events').delete().eq('study_session_id', sessionA)
  if (sessionA) await admin.from('study_sessions').delete().eq('id', sessionA)
  await admin.from('idempotent_operations').delete().in('participant_id', [participantA, participantB])
  for (const table of ['participant_room', 'participant_currency', 'study_participants']) {
    await admin.from(table).delete().in('participant_id', [participantA, participantB])
  }
  if (userA) await admin.auth.admin.deleteUser(userA.id)
  if (userB) await admin.auth.admin.deleteUser(userB.id)
}
