import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeCollisionMask,
  canOccupyCollisionMask,
  createCollisionMask,
  moveOnCollisionMask,
  paintCollisionMaskStroke,
} from './collisionMaskEditor.mjs'
import {
  ANIMAL_COLLISION_MASK_CELL_SIZE,
  ANIMAL_COLLISION_MASK_COLUMNS,
  ANIMAL_COLLISION_MASK_ROWS,
  ANIMAL_COLLISION_PLAYER_BOX,
  ANIMAL_COLLISION_SPAWN,
  ANIMAL_WORLD_HEIGHT,
  ANIMAL_WORLD_WIDTH,
  createAnimalRuntimeCollisionMask,
} from './animalCollisionMaskEditor.mjs'
import {
  HUMAN_COLLISION_MASK_CELL_SIZE,
  HUMAN_COLLISION_MASK_COLUMNS,
  HUMAN_COLLISION_MASK_ROWS,
  HUMAN_COLLISION_PLAYER_BOX,
  HUMAN_COLLISION_SPAWN,
  HUMAN_WORLD_HEIGHT,
  HUMAN_WORLD_WIDTH,
  createHumanRuntimeCollisionMask,
} from './humanCollisionMaskEditor.mjs'
import {
  LAB_COLLISION_MASK_CELL_SIZE,
  LAB_COLLISION_MASK_COLUMNS,
  LAB_COLLISION_MASK_ROWS,
  LAB_COLLISION_PLAYER_BOX,
  LAB_COLLISION_SPAWN,
  LAB_WORLD_HEIGHT,
  LAB_WORLD_WIDTH,
  createLabRuntimeCollisionMask,
} from './labCollisionMaskEditor.mjs'
import {
  URBAN_COLLISION_MASK_CELL_SIZE,
  URBAN_COLLISION_MASK_COLUMNS,
  URBAN_COLLISION_MASK_ROWS,
  createUrbanRuntimeCollisionMask,
} from './urbanCollisionMaskEditor.mjs'
import {
  NATURE_COLLISION_MASK_CELL_SIZE,
  NATURE_COLLISION_MASK_COLUMNS,
  NATURE_COLLISION_MASK_ROWS,
  NATURE_WORLD_HEIGHT,
  NATURE_WORLD_WIDTH,
  createNatureRuntimeCollisionMask,
} from './natureCollisionMaskEditor.mjs'
import {
  BRIDGES as NATURE_BRIDGES,
  PLAYER_BOX as NATURE_PLAYER_BOX,
  SPAWN as NATURE_SPAWN,
  T as NATURE_TILE_SIZE,
} from './natureFarmLayout.mjs'
import { PLAYER_FOOT_BOX, SPAWN_POINTS } from './urbanV3WorldConfig.mjs'

test('creates a deterministic binary collision mask', () => {
  assert.deepEqual([...createCollisionMask(3, 2, 1)], [1, 1, 1, 1, 1, 1])
  assert.deepEqual([...createCollisionMask(2, 2, 0)], [0, 0, 0, 0])
})

test('paint stroke fills gaps between pointer samples', () => {
  const mask = createCollisionMask(12, 5, 1)
  const painted = paintCollisionMaskStroke(mask, 12, 5, { x: 1, y: 2 }, { x: 10, y: 2 }, 0.8, 0)
  for (let x = 1; x <= 10; x += 1) assert.equal(painted[2 * 12 + x], 0)
  assert.equal(mask[2 * 12 + 5], 1, 'painting must not mutate the history snapshot')
})

test('player footprint cannot overlap a blocked mask cell', () => {
  const mask = createCollisionMask(8, 8, 1)
  mask[4 * 8 + 4] = 0
  const footprint = { width: 2, height: 2 }
  assert.equal(canOccupyCollisionMask(mask, 8, 8, 1, { x: 2, y: 3 }, footprint), true)
  assert.equal(canOccupyCollisionMask(mask, 8, 8, 1, { x: 4.5, y: 5 }, footprint), false)
})

test('movement resolves axes independently so a player can slide along a wall', () => {
  const mask = createCollisionMask(8, 8, 1)
  for (let y = 0; y < 8; y += 1) mask[y * 8 + 4] = 0
  const moved = moveOnCollisionMask(mask, 8, 8, 1, { x: 3, y: 3 }, { width: 1, height: 1 }, { x: 2, y: 1 })
  assert.deepEqual(moved, { x: 3, y: 4 })
})

test('connectivity analysis reports isolated walkable islands', () => {
  const mask = createCollisionMask(5, 3, 0)
  mask[0] = 1
  mask[1] = 1
  mask[14] = 1
  assert.deepEqual(analyzeCollisionMask(mask, 5, 3), {
    totalCells: 15,
    walkableCells: 3,
    blockedCells: 12,
    connectedAreas: 2,
    largestArea: 2,
    largestAreaRatio: 2 / 3,
  })
})

test('Nature runtime editor mask mirrors the 1536x1152 collision model at 4px resolution', () => {
  const mask = createNatureRuntimeCollisionMask()
  assert.equal(NATURE_WORLD_WIDTH, 1536)
  assert.equal(NATURE_WORLD_HEIGHT, 1152)
  assert.equal(NATURE_COLLISION_MASK_CELL_SIZE, 4)
  assert.equal(NATURE_COLLISION_MASK_COLUMNS, 384)
  assert.equal(NATURE_COLLISION_MASK_ROWS, 288)
  assert.equal(mask.length, 384 * 288)

  const atWorldPoint = (x, y) => mask[
    Math.floor(y / NATURE_COLLISION_MASK_CELL_SIZE) * NATURE_COLLISION_MASK_COLUMNS
      + Math.floor(x / NATURE_COLLISION_MASK_CELL_SIZE)
  ]
  assert.equal(atWorldPoint(NATURE_SPAWN.x, NATURE_SPAWN.y), 1, 'Nature spawn must remain walkable')
  assert.equal(atWorldPoint(23 * NATURE_TILE_SIZE + 16, 4 * NATURE_TILE_SIZE + 16), 0, 'creek water must remain blocked')
  assert.equal(atWorldPoint(0, 0), 0, 'world boundary must remain blocked')

  const bridge = NATURE_BRIDGES[0]
  const bridgeCenterX = (bridge.x0 + bridge.x1 + 1) * NATURE_TILE_SIZE / 2
  assert.equal(atWorldPoint(bridgeCenterX, bridge.laneY0 * NATURE_TILE_SIZE + 2), 0, 'bridge rail must remain blocked')
  assert.equal(atWorldPoint(bridgeCenterX, (bridge.laneY0 + 1) * NATURE_TILE_SIZE + 16), 1, 'bridge deck must remain open')
  assert.equal(canOccupyCollisionMask(
    mask,
    NATURE_COLLISION_MASK_COLUMNS,
    NATURE_COLLISION_MASK_ROWS,
    NATURE_COLLISION_MASK_CELL_SIZE,
    NATURE_SPAWN,
    { width: NATURE_PLAYER_BOX.w, height: NATURE_PLAYER_BOX.h },
  ), true)
})

test('Animal editor mask mirrors Sunflower Commons colliders at 4px resolution', () => {
  const mask = createAnimalRuntimeCollisionMask()
  assert.equal(ANIMAL_WORLD_WIDTH, 1536)
  assert.equal(ANIMAL_WORLD_HEIGHT, 1024)
  assert.equal(ANIMAL_COLLISION_MASK_CELL_SIZE, 4)
  assert.equal(ANIMAL_COLLISION_MASK_COLUMNS, 384)
  assert.equal(ANIMAL_COLLISION_MASK_ROWS, 256)
  assert.equal(mask.length, 384 * 256)

  const atWorldPoint = (x, y) => mask[
    Math.floor(y / ANIMAL_COLLISION_MASK_CELL_SIZE) * ANIMAL_COLLISION_MASK_COLUMNS
      + Math.floor(x / ANIMAL_COLLISION_MASK_CELL_SIZE)
  ]
  assert.equal(atWorldPoint(80, 100), 0, 'silo footprint must remain blocked')
  assert.equal(atWorldPoint(ANIMAL_COLLISION_SPAWN.x, ANIMAL_COLLISION_SPAWN.y), 1, 'Animal spawn must remain walkable')
  assert.equal(canOccupyCollisionMask(
    mask,
    ANIMAL_COLLISION_MASK_COLUMNS,
    ANIMAL_COLLISION_MASK_ROWS,
    ANIMAL_COLLISION_MASK_CELL_SIZE,
    ANIMAL_COLLISION_SPAWN,
    { width: ANIMAL_COLLISION_PLAYER_BOX.w, height: ANIMAL_COLLISION_PLAYER_BOX.h },
  ), true)
})

test('Human editor mask mirrors fully unlocked path and object collision at 4px resolution', () => {
  const mask = createHumanRuntimeCollisionMask()
  assert.equal(HUMAN_WORLD_WIDTH, 1536)
  assert.equal(HUMAN_WORLD_HEIGHT, 1152)
  assert.equal(HUMAN_COLLISION_MASK_CELL_SIZE, 4)
  assert.equal(HUMAN_COLLISION_MASK_COLUMNS, 384)
  assert.equal(HUMAN_COLLISION_MASK_ROWS, 288)
  assert.equal(mask.length, 384 * 288)

  const atWorldPoint = (x, y) => mask[
    Math.floor(y / HUMAN_COLLISION_MASK_CELL_SIZE) * HUMAN_COLLISION_MASK_COLUMNS
      + Math.floor(x / HUMAN_COLLISION_MASK_CELL_SIZE)
  ]
  assert.equal(atWorldPoint(24 * 32 + 16, 8 * 32 + 16), 0, 'community hall footprint must remain blocked')
  assert.equal(atWorldPoint(HUMAN_COLLISION_SPAWN.x, HUMAN_COLLISION_SPAWN.y), 1, 'Human spawn must remain walkable')
  assert.equal(canOccupyCollisionMask(
    mask,
    HUMAN_COLLISION_MASK_COLUMNS,
    HUMAN_COLLISION_MASK_ROWS,
    HUMAN_COLLISION_MASK_CELL_SIZE,
    HUMAN_COLLISION_SPAWN,
    { width: HUMAN_COLLISION_PLAYER_BOX.w, height: HUMAN_COLLISION_PLAYER_BOX.h },
  ), true)
})

test('Lab editor mask mirrors fully unlocked solids and boundary at 4px resolution', () => {
  const mask = createLabRuntimeCollisionMask()
  assert.equal(LAB_WORLD_WIDTH, 1536)
  assert.equal(LAB_WORLD_HEIGHT, 1152)
  assert.equal(LAB_COLLISION_MASK_CELL_SIZE, 4)
  assert.equal(LAB_COLLISION_MASK_COLUMNS, 384)
  assert.equal(LAB_COLLISION_MASK_ROWS, 288)
  assert.equal(mask.length, 384 * 288)

  const atWorldPoint = (x, y) => mask[
    Math.floor(y / LAB_COLLISION_MASK_CELL_SIZE) * LAB_COLLISION_MASK_COLUMNS
      + Math.floor(x / LAB_COLLISION_MASK_CELL_SIZE)
  ]
  assert.equal(atWorldPoint(0, 0), 0, 'Lab world boundary must remain blocked')
  assert.equal(atWorldPoint(24.2 * 32, 19 * 32), 0, 'central well footprint must remain blocked')
  assert.equal(atWorldPoint(LAB_COLLISION_SPAWN.x, LAB_COLLISION_SPAWN.y), 1, 'Lab spawn must remain walkable')
  assert.equal(canOccupyCollisionMask(
    mask,
    LAB_COLLISION_MASK_COLUMNS,
    LAB_COLLISION_MASK_ROWS,
    LAB_COLLISION_MASK_CELL_SIZE,
    LAB_COLLISION_SPAWN,
    { width: LAB_COLLISION_PLAYER_BOX.w, height: LAB_COLLISION_PLAYER_BOX.h },
  ), true)
})

test('Urban runtime editor mask uses the generated 2px terrain mask plus object colliders', () => {
  const mask = createUrbanRuntimeCollisionMask()
  assert.equal(URBAN_COLLISION_MASK_CELL_SIZE, 2)
  assert.equal(URBAN_COLLISION_MASK_COLUMNS, 724)
  assert.equal(URBAN_COLLISION_MASK_ROWS, 543)
  assert.equal(mask.length, 724 * 543)

  const atWorldPoint = (x, y) => mask[
    Math.floor(y / URBAN_COLLISION_MASK_CELL_SIZE) * URBAN_COLLISION_MASK_COLUMNS
      + Math.floor(x / URBAN_COLLISION_MASK_CELL_SIZE)
  ]
  assert.equal(atWorldPoint(190, 360), 0, 'black generated-mask terrain must remain blocked')
  assert.equal(atWorldPoint(704, 620), 0, 'object footprint must remain blocked inside the central plaza')
  assert.equal(atWorldPoint(580, 700), 1, 'white generated-mask terrain must override road semantics')
  assert.equal(atWorldPoint(580, 790), 1, 'white generated-mask crosswalk must remain walkable')
})

test('Urban editor mask accepts the runtime spawn and south exit with the 20x14 foot box', () => {
  const mask = createUrbanRuntimeCollisionMask()
  const footprint = { width: PLAYER_FOOT_BOX.w, height: PLAYER_FOOT_BOX.h }
  assert.equal(canOccupyCollisionMask(
    mask,
    URBAN_COLLISION_MASK_COLUMNS,
    URBAN_COLLISION_MASK_ROWS,
    URBAN_COLLISION_MASK_CELL_SIZE,
    SPAWN_POINTS.entrance,
    footprint,
  ), true)
  assert.equal(canOccupyCollisionMask(
    mask,
    URBAN_COLLISION_MASK_COLUMNS,
    URBAN_COLLISION_MASK_ROWS,
    URBAN_COLLISION_MASK_CELL_SIZE,
    { x: 720, y: 1060 },
    footprint,
  ), true)
})
