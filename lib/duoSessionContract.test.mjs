import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DUO_HEARTBEAT_MS,
  DUO_LEASE_STALE_MS,
  DUO_POSITION_STALE_MS,
  DUO_POSITION_THROTTLE_MS,
  DUO_SESSION_TTL_MS,
  duoRealtimeTopic,
  validateDuoPositionPayload,
} from './duoSessionContract.mjs'
import {
  DUO_PEER_CONNECTED,
  DUO_PEER_DISCONNECTED,
  DUO_PEER_NEVER_SEEN,
  reduceDuoPeerPresence,
} from './duoPresenceLifecycle.mjs'
import {
  DUO_VISITOR_FOLLOW_ACTIONS,
  resolveDuoPresenceScreen,
  resolveDuoVisitorFollowAction,
} from './duoNavigation.mjs'

const clientId = '13345678-1234-4234-9234-123456789abc'

test('Duo timing policy is centralized and keeps the required safety margins', () => {
  assert.equal(DUO_SESSION_TTL_MS, 7_200_000)
  assert.equal(DUO_HEARTBEAT_MS, 15_000)
  assert.equal(DUO_LEASE_STALE_MS, 45_000)
  assert.equal(DUO_POSITION_STALE_MS, 4_000)
  assert.equal(DUO_POSITION_THROTTLE_MS, 120)
  assert(DUO_LEASE_STALE_MS >= DUO_HEARTBEAT_MS * 3)
})

test('Realtime topics can only be derived from opaque server session UUIDs', () => {
  assert.equal(duoRealtimeTopic(clientId), `duo-v2:${clientId}`)
  assert.equal(duoRealtimeTopic('share-token'), null)
  assert.equal(duoRealtimeTopic('duo-v2:anything'), null)
})

test('position payloads reject unknown screens, facings and unsafe coordinates', () => {
  const valid = { senderRole:'visitor', x:120.5, y:-4, facing:'left', screen:'worldmap', moving:true }
  assert.deepEqual(validateDuoPositionPayload(valid), valid)
  for (const patch of [
    { x:NaN }, { y:Infinity }, { x:100_001 }, { facing:'north' },
    { screen:'museum' }, { moving:'yes' }, { senderRole:'spectator' },
  ]) assert.equal(validateDuoPositionPayload({ ...valid, ...patch }), null)
})

test('private screens remain independent while world map and host interior keep their existing contracts', () => {
  assert.equal(resolveDuoPresenceScreen({ screen:'world' }), 'worldmap')
  assert.equal(resolveDuoPresenceScreen({ screen:'house' }), 'interior')
  assert.equal(resolveDuoPresenceScreen({ screen:'zone' }), 'waiting')
  assert.equal(resolveDuoPresenceScreen({ screen:'museum' }), 'waiting')
  assert.equal(resolveDuoPresenceScreen({ screen:'annotate' }), 'waiting')
  assert.equal(resolveDuoPresenceScreen({ screen:'zone', visiting:true }), 'interior')

  const follow = resolveDuoVisitorFollowAction
  const stay = DUO_VISITOR_FOLLOW_ACTIONS.STAY
  assert.equal(follow({ role:'host', peerScreen:'interior', hasSharedRoom:true }), stay)
  assert.equal(follow({ role:'visitor', peerScreen:'waiting', hasSharedRoom:true }), stay)
  assert.equal(follow({ role:'visitor', peerScreen:'worldmap', visiting:false, hasSharedRoom:true }), stay)
  assert.equal(follow({ role:'visitor', peerScreen:'interior', visiting:false, hasSharedRoom:false }), stay)
  assert.equal(follow({ role:'visitor', peerScreen:'interior', visiting:false, hasSharedRoom:true }), DUO_VISITOR_FOLLOW_ACTIONS.ENTER_SHARED_INTERIOR)
  assert.equal(follow({ role:'visitor', peerScreen:'worldmap', visiting:true, hasSharedRoom:true }), DUO_VISITOR_FOLLOW_ACTIONS.LEAVE_SHARED_INTERIOR)
  assert.equal(follow({ role:'visitor', peerScreen:'waiting', visiting:true, hasSharedRoom:true }), stay)
})

test('peer presence edges distinguish first connect, disconnect and reconnect', () => {
  let phase = DUO_PEER_NEVER_SEEN
  const events = []
  const observe = (peerPresent) => {
    const transition = reduceDuoPeerPresence(phase, peerPresent)
    phase = transition.phase
    if (transition.eventName) events.push(transition.eventName)
  }

  observe(false)
  observe(false)
  assert.equal(phase, DUO_PEER_NEVER_SEEN)
  assert.deepEqual(events, [], 'host waiting alone and socket retries do not emit events')

  observe(true)
  observe(true)
  assert.equal(phase, DUO_PEER_CONNECTED)
  assert.deepEqual(events, ['duo_connected'], 'first presence and repeated sync emit one connect')

  observe(false)
  observe(false)
  assert.equal(phase, DUO_PEER_DISCONNECTED)
  assert.deepEqual(events, ['duo_connected', 'duo_disconnected'], 'repeated absence emits one disconnect')

  observe(true)
  observe(true)
  assert.equal(phase, DUO_PEER_CONNECTED)
  assert.deepEqual(events, ['duo_connected', 'duo_disconnected', 'duo_reconnected'], 'actual peer return emits one reconnect')
})

test('same mounted lifecycle state survives effect replay without duplicate events', () => {
  const connected = reduceDuoPeerPresence(DUO_PEER_NEVER_SEEN, true)
  assert.deepEqual(connected, { phase:DUO_PEER_CONNECTED, eventName:'duo_connected' })
  assert.deepEqual(
    reduceDuoPeerPresence(connected.phase, true),
    { phase:DUO_PEER_CONNECTED, eventName:null },
    'a replayed subscription observing the same peer is not a second connection',
  )
  assert.deepEqual(
    reduceDuoPeerPresence(DUO_PEER_DISCONNECTED, false),
    { phase:DUO_PEER_DISCONNECTED, eventName:null },
    'a socket resubscribe without peer presence is not a reconnect',
  )
})
