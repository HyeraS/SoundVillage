import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { validateEconomyInteriorRoom } from '../../lib/economyInteriorRoom.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Interior integration environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const clientOptions = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, clientOptions)
const serviceA = createClient(url, serviceKey, clientOptions)
const serviceB = createClient(url, serviceKey, clientOptions)
const clientA = createClient(url, anonKey, clientOptions)
const clientB = createClient(url, anonKey, clientOptions)
const anonymous = createClient(url, anonKey, clientOptions)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `INTERIOR_A_${suffix}`
const participantB = `INTERIOR_B_${suffix}`
const starters = ['starter_wall_neutral', 'starter_floor_beige']
const runtimeItems = new Map([
  ['starter_wall_neutral', { id:'starter_wall_neutral', kind:'wallpaper', starter:true }],
  ['starter_floor_beige', { id:'starter_floor_beige', kind:'floor', starter:true }],
  ['bed_cream', { id:'bed_cream', layer:'floor', fw:2, fh:2 }],
  ['plant_tall', { id:'plant_tall', layer:'floor', fw:1, fh:1 }],
  ['curtain_red', { id:'curtain_red', layer:'wall', fw:2, fh:1 }],
])
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function retryFutureJwt(operation) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await operation()
    if (result.error?.code !== 'PGRST303' || !result.error.message?.includes('JWT issued at future')) return result
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  return operation()
}

function room(items = []) {
  return { wallpaper:starters[0], floor:starters[1], items }
}

function placement(uid, itemId = 'bed_cream', overrides = {}) {
  return { uid, itemId, layer:'floor', col:0, row:1, flip:false, ...overrides }
}

function hash(expectedRevision, value) {
  return createHash('sha256').update(JSON.stringify([expectedRevision, value])).digest('hex')
}

function saveArgs(userId, value, expectedRevision, key = crypto.randomUUID()) {
  const validated = validateEconomyInteriorRoom(value, runtimeItems)
  assert.equal(validated.ok, true, 'integration fixture must be a valid room')
  return {
    p_auth_user_id:userId,
    p_idempotency_key:key,
    p_request_hash:hash(expectedRevision, validated.room),
    p_expected_revision:expectedRevision,
    p_room:validated.room,
    p_referenced_item_ids:validated.referencedItemIds,
    p_starter_item_ids:starters,
    p_unique_item_count:validated.uniqueItemCount,
  }
}

async function legacyState() {
  const [roomRows, ownership, currency, ledger] = await Promise.all([
    admin.from('participant_room').select('*').in('participant_id', [participantA, participantB]).order('participant_id'),
    admin.from('participant_interior_items').select('*').in('participant_id', [participantA, participantB]).order('participant_id').order('item_id'),
    admin.from('participant_currency').select('*').in('participant_id', [participantA, participantB]).order('participant_id'),
    admin.from('currency_transactions').select('*').in('participant_id', [participantA, participantB]).order('participant_id').order('id'),
  ])
  return {
    rooms:ok(roomRows, 'legacy rooms'), ownership:ok(ownership, 'legacy ownership'),
    currency:ok(currency, 'legacy currency'), ledger:ok(ledger, 'legacy ledger'),
  }
}

function assertInvalidRoom(candidate, code) {
  assert.equal(validateEconomyInteriorRoom(candidate, runtimeItems).code, code)
}

try {
  userA = ok(await clientA.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await clientB.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.from('study_participants').insert([
    { participant_id:participantA, auth_user_id:userA.id, group_id:'A', status:'active' },
    { participant_id:participantB, auth_user_id:userB.id, group_id:'B', status:'active' },
  ]), 'create Interior participants')
  ok(await admin.from('participant_currency').insert([
    { participant_id:participantA, balance:37 }, { participant_id:participantB, balance:41 },
  ]), 'seed legacy currency')
  ok(await admin.from('participant_interior_items').insert({ participant_id:participantA, item_id:'plant_tall' }), 'seed legacy ownership')
  ok(await retryFutureJwt(() => clientA.rpc('save_participant_room_v3', {
    p_idempotency_key:crypto.randomUUID(), p_room:{ wallpaper:'wp_clover', floor:'fl_brown', items:[] },
  })), 'seed legacy room')
  const legacyBefore = await legacyState()

  const firstRead = ok(await admin.rpc('get_economy_v1_room_admin', { p_auth_user_id:userA.id }), 'new room read')
  assert.deepEqual(firstRead, { ok:true, room:null, revision:0, inviteUniqueItemCount:0 })

  const starterKey = crypto.randomUUID()
  const starterArgs = saveArgs(userA.id, room(), 0, starterKey)
  const firstSave = ok(await serviceA.rpc('save_economy_v1_room_admin', starterArgs), 'starter room save')
  assert.equal(firstSave.ok, true)
  assert.equal(firstSave.revision, 1)
  assert.deepEqual(ok(await serviceB.rpc('save_economy_v1_room_admin', starterArgs), 'starter replay'), firstSave)
  const changedReplay = ok(await serviceB.rpc('save_economy_v1_room_admin', {
    ...starterArgs, p_request_hash:hash(0, room([placement(1)])), p_room:room([placement(1)]),
  }), 'changed replay')
  assert.equal(changedReplay.reason, 'idempotency_key_reused')

  const forgedStarters = ok(await admin.rpc('save_economy_v1_room_admin', {
    ...saveArgs(userA.id, room(), 1), p_starter_item_ids:['starter_wall_neutral','bed_cream'],
  }), 'forged starter allow-list')
  assert.equal(forgedStarters.reason, 'invalid_room')

  const ownedRoom = room([placement(1), placement(2)])
  const unowned = ok(await admin.rpc('save_economy_v1_room_admin', saveArgs(userA.id, ownedRoom, 1)), 'unowned room rejection')
  assert.equal(unowned.reason, 'item_not_owned')
  ok(await admin.from('participant_catalog_items').insert({
    participant_id:participantA, item_id:'bed_cream', acquisition_source:'individual_purchase',
  }), 'seed Economy ownership')
  const ownedSave = ok(await admin.rpc('save_economy_v1_room_admin', saveArgs(userA.id, ownedRoom, 1)), 'owned room save')
  assert.equal(ownedSave.ok, true)
  assert.equal(ownedSave.revision, 2)
  assert.equal(ownedSave.inviteUniqueItemCount, 1, 'repeated placement must count once')

  assertInvalidRoom({ ...room(), wallpaper:'unknown' }, 'unknown_room_item')
  assertInvalidRoom(room([placement(1, 'unknown')]), 'unknown_room_item')
  assertInvalidRoom(room([placement(1, 'bed_cream', { layer:'wall' })]), 'unknown_room_item')
  assertInvalidRoom(room([placement(1, 'bed_cream', { col:11 })]), 'invalid_room_item')
  assertInvalidRoom(room([placement(1), placement(1, 'bed_cream', { col:3 })]), 'invalid_room_item')
  assertInvalidRoom(room(Array.from({ length:101 }, (_, index) => placement(index + 1, 'plant_tall', { col:index % 12, row:index % 5 }))), 'invalid_room')
  assertInvalidRoom({ ...room(), extra:'x'.repeat(70_000) }, 'invalid_room')

  const concurrentRoomA = room([placement(3, 'bed_cream', { col:4 })])
  const concurrentRoomB = room([placement(4, 'bed_cream', { col:7 })])
  const concurrent = await Promise.all([
    serviceA.rpc('save_economy_v1_room_admin', saveArgs(userA.id, concurrentRoomA, 2)),
    serviceB.rpc('save_economy_v1_room_admin', saveArgs(userA.id, concurrentRoomB, 2)),
  ])
  const concurrentData = concurrent.map((result, index) => ok(result, `concurrent save ${index + 1}`))
  assert.equal(concurrentData.filter((result) => result.ok).length, 1)
  assert.equal(concurrentData.filter((result) => result.reason === 'room_conflict').length, 1)
  assert.equal(ok(await admin.rpc('get_economy_v1_room_admin', { p_auth_user_id:userA.id }), 'read revision').revision, 3)
  const stale = ok(await admin.rpc('save_economy_v1_room_admin', saveArgs(userA.id, room(), 1)), 'stale revision')
  assert.equal(stale.reason, 'room_conflict')
  assert.equal(stale.revision, 3)

  const isolatedB = ok(await admin.rpc('save_economy_v1_room_admin', saveArgs(userB.id, room(), 0)), 'isolated B room save')
  assert.equal(isolatedB.ok, true)
  assert.equal(isolatedB.revision, 1)
  const roomAAfterB = ok(await admin.rpc('get_economy_v1_room_admin', { p_auth_user_id:userA.id }), 'A room after B save')
  assert.equal(roomAAfterB.revision, 3)
  const roomBAfterSave = ok(await admin.rpc('get_economy_v1_room_admin', { p_auth_user_id:userB.id }), 'B room after save')
  assert.deepEqual(roomBAfterSave.room, room())

  for (const caller of [anonymous, clientA, clientB]) {
    const denied = await caller.rpc('get_economy_v1_room_admin', { p_auth_user_id:userA.id })
    assert(denied.error, 'browser roles must not execute admin room RPCs')
  }
  for (const action of [
    clientA.from('participant_economy_v1_rooms').select('*'),
    clientA.from('participant_economy_v1_rooms').insert({ participant_id:participantA, room:room() }),
    clientA.from('participant_economy_v1_rooms').update({ room:room() }).eq('participant_id', participantA),
    clientA.from('participant_economy_v1_rooms').delete().eq('participant_id', participantA),
  ]) assert((await action).error, 'direct Economy room table access must be denied')

  const shareA = ok(await admin.rpc('get_or_create_economy_v1_room_share_admin', { p_auth_user_id:userA.id }), 'share create')
  const shareReplay = ok(await admin.rpc('get_or_create_economy_v1_room_share_admin', { p_auth_user_id:userA.id }), 'share replay')
  assert.deepEqual(shareReplay, shareA)
  const shared = ok(await admin.rpc('get_economy_v1_shared_room_admin', {
    p_auth_user_id:userB.id, p_share_token:shareA.shareToken,
  }), 'shared room read')
  assert.equal(shared.ok, true)
  assert.equal(shared.revision, 3)
  assert.equal('participantId' in shared || 'owner' in shared || 'shareToken' in shared, false)
  const missingShare = ok(await admin.rpc('get_economy_v1_shared_room_admin', {
    p_auth_user_id:userB.id, p_share_token:crypto.randomUUID(),
  }), 'bad share token')
  assert.equal(missingShare.reason, 'shared_room_not_found')
  assert((await clientB.rpc('save_economy_v1_room_admin', saveArgs(userA.id, room(), 3))).error,
    'visitor must not be able to modify the owner room')

  const studySession = ok(await clientA.rpc('start_or_resume_study_session_v2', {
    p_client_instance_id:crypto.randomUUID(),
  }), 'start event session')
  const sessionId = studySession.studySessionId || studySession.study_session_id || studySession.id
  assert(sessionId, 'event session id is missing')
  const baseEvent = {
    id:crypto.randomUUID(), client_instance_id:crypto.randomUUID(), sequence_no:1,
    event_name:'room_save_succeeded', occurred_at:new Date().toISOString(), screen:'interior',
    target_type:'button', target_id:'room-save', outcome:'succeeded', operation_type:'economy_v1_room_save',
    operation_idempotency_key:crypto.randomUUID(), result_entity_type:'economy_v1_room',
    metadata:{ cost_vector:{ Animal:1, Human:1, Nature:1, Urban:1, Music:1, Lab:1 }, unique_item_count:1, room_revision:3 },
    app_version:'interior-integration',
  }
  ok(await clientA.rpc('record_user_events_v1', { p_study_session_id:sessionId, p_events:[baseEvent] }), 'valid Interior event')
  const badVector = await clientA.rpc('record_user_events_v1', {
    p_study_session_id:sessionId,
    p_events:[{ ...baseEvent, id:crypto.randomUUID(), sequence_no:2, metadata:{ cost_vector:{ Animal:1 } } }],
  })
  assert(badVector.error, 'partial cost vector must be rejected')
  const secretMetadata = await clientA.rpc('record_user_events_v1', {
    p_study_session_id:sessionId,
    p_events:[{ ...baseEvent, id:crypto.randomUUID(), sequence_no:3, metadata:{ share_token:shareA.shareToken, room:room() } }],
  })
  assert(secretMetadata.error, 'tokens and room JSON must be rejected from event metadata')
  const storedEvents = ok(await admin.from('user_events').select('metadata,result_entity_id')
    .eq('participant_id', participantA).eq('event_name', 'room_save_succeeded'), 'stored Interior events')
  assert(storedEvents.every((event) => !JSON.stringify(event).includes(shareA.shareToken)))
  assert(storedEvents.every((event) => event.result_entity_id === null))

  assert.deepEqual(await legacyState(), legacyBefore, 'Economy Interior work changed legacy persistence')
  console.log('Multi-village Interior DB integration passed.')
} finally {
  await admin.from('currency_transactions').delete().in('participant_id', [participantA, participantB])
  await admin.from('participant_interior_items').delete().in('participant_id', [participantA, participantB])
  await admin.from('participant_currency').delete().in('participant_id', [participantA, participantB])
  await admin.from('study_participants').delete().in('participant_id', [participantA, participantB])
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
