import assert from 'node:assert/strict'
import {
  EXIT, MAP, OBSERVATORY, SAFE_SLOTS, SOUND_AUDIT, SPAWN, STRUCTURES, WHITEBOX_VALIDATION,
} from '../../../app/lab-whitebox-preview/whiteboxConfig.mjs'

assert.deepEqual(MAP, { width: 48, height: 36, tile: 32, pixelWidth: 1536, pixelHeight: 1152 })
assert.equal(SOUND_AUDIT.total, 169)
assert.equal(SOUND_AUDIT.groups.A.total, 84)
assert.equal(SOUND_AUDIT.groups.B.total, 85)
assert.deepEqual(SOUND_AUDIT.groups.A.blocks, [15, 15, 15, 15, 15, 9])
assert.deepEqual(SOUND_AUDIT.groups.B.blocks, [15, 15, 15, 15, 15, 10])
assert.equal(SPAWN.tx, 24)
assert.equal(SPAWN.ty, 33)
assert.deepEqual(EXIT, { x: 22, y: 35, w: 5, h: 1 })
assert.deepEqual(OBSERVATORY.footprint, { x: 18, y: 12, w: 12, h: 13 })
assert.equal(Object.keys(STRUCTURES).length, 3)
assert.equal(Object.values(SAFE_SLOTS).flat().length, 108)
for (let block = 1; block <= 6; block++) assert.equal(SAFE_SLOTS[block].length, 18)
assert.equal(WHITEBOX_VALIDATION.pass, true, WHITEBOX_VALIDATION.errors.join('\n'))
assert.deepEqual(WHITEBOX_VALIDATION.warnings, [])

console.log('LAB-1 whitebox validation PASS')
console.log(JSON.stringify({
  map: `${MAP.width}x${MAP.height}@${MAP.tile}px`,
  sounds: SOUND_AUDIT,
  safeSlots: WHITEBOX_VALIDATION.slotTotal,
  capacities: WHITEBOX_VALIDATION.capacities,
  reachableTiles: WHITEBOX_VALIDATION.reachableTiles,
}, null, 2))

