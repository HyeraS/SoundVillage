import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WORLD_PLAYER_FOOT_CLEARANCE,
  blockingCollisionAtWorldPoint,
  buildCollisionMasks,
  collisionShapeContainsPoint,
  pointInPolygonHalfOpen,
  pointInRectHalfOpen,
} from './worldMapCollision.mjs'

const object = (colliderId, shapes, collisionRole = 'building-body') => ({
  objectId: `object-${colliderId}`,
  colliderId,
  collisionRole,
  shapes,
})

test('rect uses half-open right and bottom edges', () => {
  const shape = { type: 'rect', left: 4, top: 8, right: 12, bottom: 16 }
  assert.equal(pointInRectHalfOpen(4, 8, shape), true)
  assert.equal(pointInRectHalfOpen(11.999, 15.999, shape), true)
  assert.equal(pointInRectHalfOpen(12, 10, shape), false)
  assert.equal(pointInRectHalfOpen(10, 16, shape), false)
})

test('polygon supports inside, outside and half-open axis-aligned edges', () => {
  const shape = { type: 'polygon', points: [[4, 4], [20, 4], [20, 20], [4, 20]] }
  assert.equal(pointInPolygonHalfOpen(8, 8, shape), true)
  assert.equal(pointInPolygonHalfOpen(2, 8, shape), false)
  assert.equal(pointInPolygonHalfOpen(4, 8, shape), true)
  assert.equal(pointInPolygonHalfOpen(20, 8, shape), false)
  assert.equal(pointInPolygonHalfOpen(8, 20, shape), false)
})

test('concave polygon keeps its notch walkable', () => {
  const shape = { type: 'polygon', points: [[4, 4], [28, 4], [28, 28], [20, 28], [20, 12], [4, 12]] }
  assert.equal(collisionShapeContainsPoint(shape, 8, 8), true)
  assert.equal(collisionShapeContainsPoint(shape, 24, 24), true)
  assert.equal(collisionShapeContainsPoint(shape, 8, 20), false)
})

test('multiple shapes and logical objects are unioned while decorative objects stay nonblocking', () => {
  const objects = [
    object('multi', [
      { type: 'rect', left: 4, top: 4, right: 8, bottom: 8 },
      { type: 'polygon', points: [[20, 4], [28, 4], [24, 12]] },
    ]),
    object('second', [{ type: 'rect', left: 4, top: 20, right: 8, bottom: 24 }], 'furniture'),
    object('flowers', [{ type: 'rect', left: 20, top: 20, right: 28, bottom: 28 }], 'decorative-nonblocking'),
  ]
  const { rawObstacle } = buildCollisionMasks(objects, 32, 32, { halfWidth: 0, halfHeight: 0 })
  assert.equal(rawObstacle[5 * 32 + 5], 1)
  assert.equal(rawObstacle[7 * 32 + 24], 1)
  assert.equal(rawObstacle[21 * 32 + 5], 1)
  assert.equal(rawObstacle[23 * 32 + 23], 0)
})

test('clearance is 29x17 and remains anisotropic', () => {
  const objects = [object('pixel', [{ type: 'rect', left: 20, top: 20, right: 21, bottom: 21 }])]
  const { clearanceObstacle } = buildCollisionMasks(objects, 48, 48, { cellSize: 1, ...WORLD_PLAYER_FOOT_CLEARANCE })
  assert.equal(clearanceObstacle[12 * 48 + 6], 1)
  assert.equal(clearanceObstacle[28 * 48 + 34], 1)
  assert.equal(clearanceObstacle[11 * 48 + 20], 0)
  assert.equal(clearanceObstacle[20 * 48 + 35], 0)
})

test('a collider exactly on a cell boundary does not grow into the next cell', () => {
  const objects = [object('cell-edge', [{ type: 'rect', left: 8, top: 8, right: 12, bottom: 12 }])]
  const { obstacle, width } = buildCollisionMasks(objects, 24, 24, { halfWidth: 0, halfHeight: 0, cellSize: 4 })
  assert.equal(obstacle[2 * width + 2], 1)
  assert.equal(obstacle[2 * width + 3], 0)
  assert.equal(obstacle[3 * width + 2], 0)
})

test('approved home fixture right=1776 clears the x=1792 road cell without a magic correction', () => {
  const originX = 1400
  const objects = [object('home-fixture', [{ type: 'rect', left: 120, top: 32, right: 376, bottom: 256 }])]
  const masks = buildCollisionMasks(objects, 600, 320)
  const sampleY = 100 / masks.cellSize
  const lastBlockedX = Array.from({ length: masks.width }, (_, x) => x)
    .filter(x => masks.obstacle[sampleY * masks.width + x]).at(-1)
  assert.equal(originX + (lastBlockedX + 1) * masks.cellSize, 1792)
  assert.equal(masks.obstacle[sampleY * masks.width + ((1792 - originX) / masks.cellSize)], 0)
})

test('blocking reason lookup matches the rasterized union', () => {
  const objects = [
    object('rect', [{ type: 'rect', left: 8, top: 8, right: 20, bottom: 16 }]),
    object('concave', [{ type: 'polygon', points: [[28, 8], [52, 8], [52, 40], [40, 40], [40, 20], [28, 20]] }], 'wall'),
  ]
  const masks = buildCollisionMasks(objects, 64, 48)
  for (let y = 0; y < masks.height; y += 1) {
    for (let x = 0; x < masks.width; x += 1) {
      const collision = blockingCollisionAtWorldPoint((x + 0.5) * 4, (y + 0.5) * 4, { objects })
      assert.equal(Boolean(collision), Boolean(masks.obstacle[y * masks.width + x]), `cell ${x},${y}`)
    }
  }
})
