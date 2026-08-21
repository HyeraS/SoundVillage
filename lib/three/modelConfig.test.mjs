import test from 'node:test'
import assert from 'node:assert/strict'
import { isPositionWalkable } from './collision.mjs'
import {
  BASE_WORLD_BOUNDS,
  MUSIC_ENVIRONMENT_CONFIG,
  MUSIC_EXIT_TARGET,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
  PLAYER_START,
  SOUND_INTERACTION_RADIUS,
  SOUND_ORB_VISUAL_SCALE,
  WORLD_BOUNDS,
  WORLD_COLLIDERS,
  ZONE_LINEAR_SCALE,
} from './modelConfig.mjs'
import { createSoundPlacements } from './prototypeData.mjs'
import { HUB_BOUNDS, HUB_EXITS, HUB_LANDMARK } from './worldConfig.mjs'

const width = bounds => bounds.maxX - bounds.minX
const height = bounds => bounds.maxZ - bounds.minZ
const positionOf = position => ({ x: position[0], z: position[2] })

test('Music playable bounds use Math.SQRT2 per axis and exactly double their area', () => {
  assert.equal(ZONE_LINEAR_SCALE, Math.SQRT2)
  assert.ok(Math.abs(width(WORLD_BOUNDS) / width(BASE_WORLD_BOUNDS) - Math.SQRT2) < 1e-12)
  assert.ok(Math.abs(height(WORLD_BOUNDS) / height(BASE_WORLD_BOUNDS) - Math.SQRT2) < 1e-12)
  const oldArea = width(BASE_WORLD_BOUNDS) * height(BASE_WORLD_BOUNDS)
  const newArea = width(WORLD_BOUNDS) * height(WORLD_BOUNDS)
  assert.ok(Math.abs(newArea / oldArea - 2) < 1e-12)
})

test('spawn, Music exit, and all 15 Sound Orbs remain walkable inside expanded bounds', () => {
  const placements = createSoundPlacements(Array.from({ length: 15 }, (_, index) => ({ sound_id: `Music_${index + 1}` })))
  assert.equal(isPositionWalkable(positionOf(PLAYER_START), PLAYER_RADIUS, WORLD_BOUNDS, WORLD_COLLIDERS), true)
  assert.equal(isPositionWalkable(positionOf(MUSIC_EXIT_TARGET.position), PLAYER_RADIUS, WORLD_BOUNDS, WORLD_COLLIDERS), true)
  for (const placement of placements) {
    assert.equal(isPositionWalkable(positionOf(placement.position), PLAYER_RADIUS, WORLD_BOUNDS, WORLD_COLLIDERS), true)
  }
})

test('central Music paths remain open while model sizes, player speed, and interaction radii stay unchanged', () => {
  for (let z = -8; z <= 9; z += 0.5) {
    assert.equal(isPositionWalkable({ x: 0, z }, PLAYER_RADIUS, WORLD_BOUNDS, WORLD_COLLIDERS), true)
  }
  assert.equal(PLAYER_MOVE_SPEED, 4.1)
  assert.equal(SOUND_INTERACTION_RADIUS, 1.62)
  assert.equal(MUSIC_EXIT_TARGET.interactionRadius, 1.9)
  assert.deepEqual(WORLD_COLLIDERS.find(item => item.id === 'music-house').size, [4.2, 3.3])
  assert.equal(MUSIC_ENVIRONMENT_CONFIG.northSouthPath.width, 3.2)
  assert.equal(MUSIC_ENVIRONMENT_CONFIG.eastWestPath.width, 2.4)
})

test('annotation Orb scales shrink independently without changing the hub landmark', () => {
  assert.deepEqual(SOUND_ORB_VISUAL_SCALE, { default: 0.68, nearby: 0.8, completed: 0.54 })
  assert.equal(HUB_LANDMARK.id, 'hub-landmark-orb')
  assert.deepEqual(HUB_LANDMARK.position, [0, 0.92, 0])
})

test('central hub dimensions and gateway positions stay unchanged', () => {
  assert.deepEqual(HUB_BOUNDS, { minX: -12.6, maxX: 12.6, minZ: -9.8, maxZ: 10.2 })
  assert.deepEqual(HUB_EXITS.find(exit => exit.id === 'music').position, [10.9, 0, 0.8])
})
