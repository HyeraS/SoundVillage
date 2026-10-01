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
