import test from 'node:test'
import assert from 'node:assert/strict'
import { circleIntersectsAabb, moveWithCollisions } from './collision.mjs'

const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }
const colliders = [{ id: 'house', position: [1, 0], size: [2, 2] }]

test('circle and AABB collision detects overlap and separation', () => {
  assert.equal(circleIntersectsAabb({ x: 0.4, z: 0 }, 0.5, colliders[0]), true)
  assert.equal(circleIntersectsAabb({ x: -2, z: 0 }, 0.5, colliders[0]), false)
})

test('movement is clamped by world bounds and slides along obstacles', () => {
  assert.deepEqual(moveWithCollisions({ x: 4.5, z: 0 }, { x: 1, z: 0 }, 0.4, bounds, []), { x: 4.5, z: 0 })
  const slid = moveWithCollisions({ x: -0.6, z: -1.8 }, { x: 0.4, z: 0.5 }, 0.4, bounds, colliders)
  assert.ok(Math.abs(slid.x - (-0.2)) < Number.EPSILON)
  assert.equal(slid.z, -1.8)
})
