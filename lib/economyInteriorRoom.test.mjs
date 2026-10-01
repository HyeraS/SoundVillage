import assert from 'node:assert/strict'
import test from 'node:test'
import { validateEconomyInteriorRoom } from './economyInteriorRoom.mjs'

const runtime = [
  { id:'starter_wall_neutral', kind:'wallpaper', starter:true },
  { id:'starter_floor_beige', kind:'floor', starter:true },
  { id:'chair', kind:'furniture', layer:'floor', fw:1, fh:1 },
  { id:'wide_bed', kind:'furniture', layer:'floor', fw:2, fh:2 },
  { id:'frame', kind:'wall_decor', layer:'wall', fw:1, fh:1 },
]

const baseRoom = () => ({ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:[] })

test('valid room accepts repeated placements of one permanent unlock', () => {
  const room = baseRoom()
  room.items = [
    { uid:1, itemId:'chair', layer:'floor', col:1, row:1, flip:false },
    { uid:2, itemId:'chair', layer:'floor', col:2, row:1, flip:true },
  ]
  const result = validateEconomyInteriorRoom(room, runtime)
  assert.equal(result.ok, true)
  assert.equal(result.uniqueItemCount, 1)
  assert.deepEqual(result.uniqueMovableItemIds, ['chair'])
})
test('room validation rejects unknown IDs, forged layers, coordinates and duplicate uids', () => {
  for (const placement of [
    { uid:1, itemId:'unknown', layer:'floor', col:1, row:1, flip:false },
    { uid:1, itemId:'frame', layer:'floor', col:1, row:1, flip:false },
    { uid:1, itemId:'wide_bed', layer:'floor', col:11, row:1, flip:false },
  ]) {
    const room = baseRoom(); room.items = [placement]
    assert.equal(validateEconomyInteriorRoom(room, runtime).ok, false)
  }
  const duplicate = baseRoom()
  duplicate.items = [
    { uid:1, itemId:'chair', layer:'floor', col:1, row:1, flip:false },
    { uid:1, itemId:'chair', layer:'floor', col:2, row:1, flip:false },
  ]
  assert.equal(validateEconomyInteriorRoom(duplicate, runtime).code, 'invalid_room_item')
})

test('room validation caps placement arrays and rejects extra JSON keys', () => {
  const oversized = baseRoom()
  oversized.items = Array.from({ length:101 }, (_, index) => ({ uid:index + 1, itemId:'chair', layer:'floor', col:0, row:0, flip:false }))
  assert.equal(validateEconomyInteriorRoom(oversized, runtime).code, 'invalid_room')
  assert.equal(validateEconomyInteriorRoom({ ...baseRoom(), participantId:'forged' }, runtime).code, 'invalid_room')
})
