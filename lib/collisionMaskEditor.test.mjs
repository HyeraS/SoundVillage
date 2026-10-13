import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { handleCollisionMaskApply } from '../app/api/internal/collision-mask-apply/route.js'
import {
  GET as getCollisionMaskDraft,
  resolveCollisionMaskDraftTarget,
} from '../app/api/internal/collision-mask-draft/route.js'

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
  COLLIDERS as ANIMAL_COLLIDERS,
  collidesAt as animalCollidesAt,
  collidesPlacementAt as animalCollidesPlacementAt,
} from './animalVillageSunflowerConfig.mjs'
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
  EXIT_TRIGGER as HUMAN_EXIT_TRIGGER,
  buildHumanVillage,
  collides as humanCollides,
} from './humanVillageConfig.mjs'
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
import { isMaskCellWalkable as isLabMaskCellWalkable } from './generated/labWalkableMask.generated.mjs'
import { isMusicVillageMaskCellWalkable } from './generated/musicVillageWalkableMask.mjs'
import {
  EXIT as LAB_EXIT,
  OBJECTS as LAB_OBJECTS,
  buildVillage as buildLabVillage,
  collidesPlacementAt as labCollidesPlacementAt,
  collidesPlayerAt as labCollidesPlayerAt,
} from './labVillageConfig.mjs'
import {
  URBAN_COLLISION_MASK_CELL_SIZE,
  URBAN_COLLISION_MASK_COLUMNS,
  URBAN_COLLISION_MASK_ROWS,
  createUrbanRuntimeCollisionMask,
} from './urbanCollisionMaskEditor.mjs'
import { isUrbanV3MaskCellWalkable } from './urbanV3WalkableMask.generated.mjs'
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
  buildNatureFarmModel,
} from './natureFarmLayout.mjs'
import {
  NAV_CELL as MUSIC_COLLISION_MASK_CELL_SIZE,
  NAV_COLS as MUSIC_COLLISION_MASK_COLUMNS,
  NAV_ROWS as MUSIC_COLLISION_MASK_ROWS,
  PLAYER_BOX as MUSIC_COLLISION_PLAYER_BOX,
  SPAWN as MUSIC_COLLISION_SPAWN,
  WORLD_H as MUSIC_WORLD_HEIGHT,
  WORLD_W as MUSIC_WORLD_WIDTH,
  buildVillage as buildMusicVillage,
  collidesPlacementAt as musicCollidesPlacementAt,
  collidesPlayerAt as musicCollidesPlayerAt,
  createMusicRuntimeCollisionMask,
  getNavigationTypeAtWorld as getMusicNavigationTypeAtWorld,
  isNavigationWalkable as isMusicNavigationWalkable,
} from './musicVillageConfig.mjs'
import {
  OBJECT_COLLIDERS,
  PLAYER_FOOT_BOX,
  SPAWN_POINTS,
  collidesPlacementAt,
  collidesPlayerAt,
} from './urbanV3WorldConfig.mjs'
import {
  buildWalkableMaskTarget,
  createOpaqueBinaryMaskPng,
  generateWalkableMaskModule,
  getVillageWalkableMaskTarget,
  listVillageWalkableMaskTargets,
  writeWalkableMaskModules,
} from './villageWalkableMaskPipeline.mjs'

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
  assert.equal(atWorldPoint(bridgeCenterX, bridge.laneY0 * NATURE_TILE_SIZE + 2), 1, 'editor mirrors the authored white bridge rail area')
  assert.equal(atWorldPoint(bridgeCenterX, (bridge.laneY0 + 1) * NATURE_TILE_SIZE + 16), 1, 'bridge deck must remain open')
  assert.equal(canOccupyCollisionMask(
    mask,
    NATURE_COLLISION_MASK_COLUMNS,
    NATURE_COLLISION_MASK_ROWS,
    NATURE_COLLISION_MASK_CELL_SIZE,
    NATURE_SPAWN,
    { width: NATURE_PLAYER_BOX.w, height: NATURE_PLAYER_BOX.h },
  ), true)

  const model = buildNatureFarmModel()
  for (const point of [
    NATURE_SPAWN,
    { x: 23 * NATURE_TILE_SIZE + 16, y: 4 * NATURE_TILE_SIZE + 16 },
    { x: bridgeCenterX, y: bridge.laneY0 * NATURE_TILE_SIZE + 5 },
    { x: 32 * NATURE_TILE_SIZE + 16, y: 8 * NATURE_TILE_SIZE + 16 },
  ]) {
    assert.equal(
      model.canStand(point.x, point.y),
      canOccupyCollisionMask(
        mask,
        NATURE_COLLISION_MASK_COLUMNS,
        NATURE_COLLISION_MASK_ROWS,
        NATURE_COLLISION_MASK_CELL_SIZE,
        point,
        { width: NATURE_PLAYER_BOX.w, height: NATURE_PLAYER_BOX.h },
      ),
      `editor and runtime must agree at (${point.x}, ${point.y})`,
    )
  }

  const mismatches = []
  for (let y = 0; y < NATURE_WORLD_HEIGHT; y += 8) {
    for (let x = 0; x < NATURE_WORLD_WIDTH; x += 8) {
      const editor = canOccupyCollisionMask(
        mask,
        NATURE_COLLISION_MASK_COLUMNS,
        NATURE_COLLISION_MASK_ROWS,
        NATURE_COLLISION_MASK_CELL_SIZE,
        { x, y },
        { width: NATURE_PLAYER_BOX.w, height: NATURE_PLAYER_BOX.h },
      )
      const runtime = model.canStand(x, y)
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
    }
  }
  assert.deepEqual(mismatches, [])
})

test('Animal editor mask is exactly the generated 4px movement authority', () => {
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

  const whiteOverLegacyBarn = { x: 118, y: 222 }
  assert.equal(canOccupyCollisionMask(
    mask,
    ANIMAL_COLLISION_MASK_COLUMNS,
    ANIMAL_COLLISION_MASK_ROWS,
    ANIMAL_COLLISION_MASK_CELL_SIZE,
    whiteOverLegacyBarn,
    { width: ANIMAL_COLLISION_PLAYER_BOX.w, height: ANIMAL_COLLISION_PLAYER_BOX.h },
  ), true, 'the applied mask keeps the barn-edge probe white')
  assert.equal(animalCollidesAt(ANIMAL_COLLIDERS, whiteOverLegacyBarn.x, whiteOverLegacyBarn.y), null,
    'legacy Animal colliders must not override a white mask footprint')
  assert.equal(animalCollidesPlacementAt(ANIMAL_COLLIDERS, whiteOverLegacyBarn.x, whiteOverLegacyBarn.y)?.id, 'barn',
    'the retained barn collider remains available for placement and QA')

  const mismatches = []
  for (let y = 0; y < ANIMAL_WORLD_HEIGHT; y += 8) {
    for (let x = 0; x < ANIMAL_WORLD_WIDTH; x += 8) {
      const editor = canOccupyCollisionMask(
        mask,
        ANIMAL_COLLISION_MASK_COLUMNS,
        ANIMAL_COLLISION_MASK_ROWS,
        ANIMAL_COLLISION_MASK_CELL_SIZE,
        { x, y },
        { width: ANIMAL_COLLISION_PLAYER_BOX.w, height: ANIMAL_COLLISION_PLAYER_BOX.h },
      )
      const runtime = animalCollidesAt(ANIMAL_COLLIDERS, x, y) === null
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
    }
  }
  assert.deepEqual(mismatches, [])
})

test('Music runtime editor mask exactly mirrors all 110,592 final generated cells', () => {
  const mask = createMusicRuntimeCollisionMask()
  assert.equal(MUSIC_WORLD_WIDTH, 1536)
  assert.equal(MUSIC_WORLD_HEIGHT, 1152)
  assert.equal(MUSIC_COLLISION_MASK_CELL_SIZE, 4)
  assert.equal(MUSIC_COLLISION_MASK_COLUMNS, 384)
  assert.equal(MUSIC_COLLISION_MASK_ROWS, 288)
  assert.equal(mask.length, 110592)

  for (let index = 0; index < mask.length; index += 1) {
    const col = index % MUSIC_COLLISION_MASK_COLUMNS
    const row = Math.floor(index / MUSIC_COLLISION_MASK_COLUMNS)
    assert.equal(mask[index], isMusicVillageMaskCellWalkable(col, row) ? 1 : 0,
      `Music editor mask differs from generated cell ${index}`)
  }
})

test('Music editor occupancy and player movement authority agree at every 8px sample', () => {
  const mask = createMusicRuntimeCollisionMask()
  const village = buildMusicVillage()
  const footprint = { width: MUSIC_COLLISION_PLAYER_BOX.w, height: MUSIC_COLLISION_PLAYER_BOX.h }
  const editorCanOccupy = (point) => canOccupyCollisionMask(
    mask,
    MUSIC_COLLISION_MASK_COLUMNS,
    MUSIC_COLLISION_MASK_ROWS,
    MUSIC_COLLISION_MASK_CELL_SIZE,
    point,
    footprint,
  )

  for (const [label, point, expected] of [
    ['spawn', MUSIC_COLLISION_SPAWN, true],
    ['black mask', { x: 680, y: 900 }, false],
    ['south exit approach', { x: 768, y: 1138 }, true],
    ['building', { x: 768, y: 160 }, false],
    ['pond', { x: 60, y: 570 }, false],
    ['garden', { x: 620, y: 600 }, false],
  ]) {
    assert.equal(editorCanOccupy(point), expected, `${label}: editor`)
    assert.equal(musicCollidesPlayerAt(village, point.x, point.y) === null, expected, `${label}: runtime`)
  }

  const whiteFootCenterWithBlackEdge = { x: 416, y: 200 }
  assert.equal(
    isMusicNavigationWalkable(getMusicNavigationTypeAtWorld(
      whiteFootCenterWithBlackEdge.x,
      whiteFootCenterWithBlackEdge.y - MUSIC_COLLISION_PLAYER_BOX.h / 2,
    )),
    true,
    'representative foot center is white',
  )
  assert.equal(editorCanOccupy(whiteFootCenterWithBlackEdge), false,
    'a white center cannot override a black cell under another part of the foot box')
  assert.ok(musicCollidesPlayerAt(village, whiteFootCenterWithBlackEdge.x, whiteFootCenterWithBlackEdge.y))

  const mismatches = []
  for (let y = 0; y < MUSIC_WORLD_HEIGHT; y += 8) {
    for (let x = 0; x < MUSIC_WORLD_WIDTH; x += 8) {
      const editor = editorCanOccupy({ x, y })
      const runtime = musicCollidesPlayerAt(village, x, y) === null
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
    }
  }
  assert.deepEqual(mismatches, [])

  const syntheticCollider = Object.freeze({
    x: MUSIC_COLLISION_SPAWN.x - 2,
    y: MUSIC_COLLISION_SPAWN.y - 6,
    w: 4,
    h: 4,
    id: 'synthetic-placement-collider',
  })
  const syntheticVillage = { colliders: [syntheticCollider] }
  assert.equal(musicCollidesPlayerAt(syntheticVillage, MUSIC_COLLISION_SPAWN.x, MUSIC_COLLISION_SPAWN.y), null,
    'white final mask remains walkable when a collider is injected')
  assert.equal(
    musicCollidesPlacementAt(syntheticVillage, MUSIC_COLLISION_SPAWN.x, MUSIC_COLLISION_SPAWN.y)?.id,
    syntheticCollider.id,
    'the same collider remains authoritative for placement safety',
  )
})

test('Human editor mask mirrors the generated black/white movement authority at 4px resolution', () => {
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

test('Human editor occupancy and fully unlocked runtime movement agree at every 8px sample', () => {
  const mask = createHumanRuntimeCollisionMask()
  const village = buildHumanVillage()
  const footprint = { width: HUMAN_COLLISION_PLAYER_BOX.w, height: HUMAN_COLLISION_PLAYER_BOX.h }
  const editorCanOccupy = (point) => canOccupyCollisionMask(
    mask,
    HUMAN_COLLISION_MASK_COLUMNS,
    HUMAN_COLLISION_MASK_ROWS,
    HUMAN_COLLISION_MASK_CELL_SIZE,
    point,
    footprint,
  )
  const runtimeCanOccupy = (point, unlockedBlock = 6) => humanCollides(village, point.x, point.y, unlockedBlock) === null

  const legacyColliderWhite = { x: 232, y: 112 }
  const blackMask = { x: 24 * 32 + 16, y: 8 * 32 + 16 }
  const exitApproach = {
    x: HUMAN_EXIT_TRIGGER.x + HUMAN_EXIT_TRIGGER.w / 2,
    y: HUMAN_EXIT_TRIGGER.y + HUMAN_EXIT_TRIGGER.h / 2,
  }
  const lockedBlockTwo = { x: 432, y: 656 }

  const raisedBed = village.colliders.find((collider) => collider.tag === 'raised-bed')
  assert.ok(raisedBed, 'legacy raised-bed geometry must remain available')
  assert.ok(
    legacyColliderWhite.x + HUMAN_COLLISION_PLAYER_BOX.w / 2 > raisedBed.x
      && legacyColliderWhite.x - HUMAN_COLLISION_PLAYER_BOX.w / 2 < raisedBed.x + raisedBed.w
      && legacyColliderWhite.y > raisedBed.y
      && legacyColliderWhite.y - HUMAN_COLLISION_PLAYER_BOX.h < raisedBed.y + raisedBed.h,
    'representative white-mask footprint must overlap the retained legacy collider',
  )

  for (const [label, point, expected] of [
    ['legacy collider white area', legacyColliderWhite, true],
    ['black mask area', blackMask, false],
    ['spawn', HUMAN_COLLISION_SPAWN, true],
    ['exit approach', exitApproach, true],
  ]) {
    assert.equal(editorCanOccupy(point), expected, `${label}: editor mask`)
    assert.equal(runtimeCanOccupy(point), expected, `${label}: fully unlocked runtime`)
  }

  const mismatches = []
  for (let y = 0; y < HUMAN_WORLD_HEIGHT; y += 8) {
    for (let x = 0; x < HUMAN_WORLD_WIDTH; x += 8) {
      const point = { x, y }
      const editor = editorCanOccupy(point)
      const runtime = runtimeCanOccupy(point)
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
    }
  }
  assert.deepEqual(mismatches, [])

  assert.equal(editorCanOccupy(lockedBlockTwo), true, 'block 2 probe must be white in the authored mask')
  assert.equal(humanCollides(village, lockedBlockTwo.x, lockedBlockTwo.y, 1), null,
    'progression must not block movement through an authored white area')
  assert.equal(humanCollides(village, lockedBlockTwo.x, lockedBlockTwo.y, 2), null)
})

test('Lab runtime editor mask is exactly the authored/generated 4px mask', () => {
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
  assert.equal(atWorldPoint(0, 0), 0, 'authored black terrain must remain blocked')
  assert.equal(atWorldPoint(400, 80), 1, 'white mask must not be repainted by a retained tree collider')
  assert.equal(atWorldPoint(LAB_COLLISION_SPAWN.x, LAB_COLLISION_SPAWN.y), 1, 'Lab spawn must remain walkable')
  assert.equal(canOccupyCollisionMask(
    mask,
    LAB_COLLISION_MASK_COLUMNS,
    LAB_COLLISION_MASK_ROWS,
    LAB_COLLISION_MASK_CELL_SIZE,
    LAB_COLLISION_SPAWN,
    { width: LAB_COLLISION_PLAYER_BOX.w, height: LAB_COLLISION_PLAYER_BOX.h },
  ), true)

  for (let index = 0; index < mask.length; index += 1) {
    assert.equal(
      mask[index],
      isLabMaskCellWalkable(index % LAB_COLLISION_MASK_COLUMNS, Math.floor(index / LAB_COLLISION_MASK_COLUMNS)) ? 1 : 0,
      `editor mask differs from authored Lab cell ${index}`,
    )
  }
})

test('Lab editor and fully unlocked runtime movement agree at every 8px sample', () => {
  const mask = createLabRuntimeCollisionMask()
  const village = buildLabVillage()
  const footprint = { width: LAB_COLLISION_PLAYER_BOX.w, height: LAB_COLLISION_PLAYER_BOX.h }
  const editorCanOccupy = (point) => canOccupyCollisionMask(
    mask,
    LAB_COLLISION_MASK_COLUMNS,
    LAB_COLLISION_MASK_ROWS,
    LAB_COLLISION_MASK_CELL_SIZE,
    point,
    footprint,
  )

  for (const [label, point, expected] of [
    ['white mask overlapping a retained tree collider', { x: 400, y: 80 }, true],
    ['white anchor whose full foot box overlaps black', { x: 384, y: 64 }, false],
    ['black mask', { x: 16, y: 16 }, false],
    ['spawn', LAB_COLLISION_SPAWN, true],
    ['south exit approach', { x: LAB_EXIT.x + LAB_EXIT.w / 2, y: LAB_EXIT.y + 20 }, true],
  ]) {
    assert.equal(editorCanOccupy(point), expected, `${label}: editor`)
    assert.equal(labCollidesPlayerAt(village, point.x, point.y) === null, expected, `${label}: runtime`)
  }
  assert.equal(labCollidesPlacementAt(village, 400, 80)?.id, 'tree-3')
  assert.ok(LAB_OBJECTS.some((object) => object.id === 'tree-3' && object.solid), 'retained solid metadata must remain available')

  const mismatches = []
  for (let y = 0; y < LAB_WORLD_HEIGHT; y += 8) {
    for (let x = 0; x < LAB_WORLD_WIDTH; x += 8) {
      const point = { x, y }
      const editor = editorCanOccupy(point)
      const runtime = labCollidesPlayerAt(village, x, y) === null
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
    }
  }
  assert.deepEqual(mismatches, [])

  const progressionVillage = buildLabVillage(Array.from({ length: 6 }, (_, index) => ({
    sound_id: `progress-${index + 1}`,
    block: index + 1,
  })))
  assert.equal(labCollidesPlayerAt(progressionVillage, 400, 80, 0, 1), null,
    'Lab progression must not block movement through an authored white area')
  assert.equal(labCollidesPlacementAt(progressionVillage, 400, 80, 0, 1)?.id, 'locked-northwest',
    'progression can remain available to conservative placement logic')
})

test('Urban runtime editor mask is exactly the authored/generated 2px mask', () => {
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
  assert.equal(atWorldPoint(600, 240), 1, 'white mask must not be repainted by an object collider')
  assert.equal(atWorldPoint(580, 700), 1, 'white generated-mask terrain must override road semantics')
  assert.equal(atWorldPoint(580, 790), 1, 'white generated-mask crosswalk must remain walkable')

  for (let index = 0; index < mask.length; index += 1) {
    assert.equal(
      mask[index],
      isUrbanV3MaskCellWalkable(index % URBAN_COLLISION_MASK_COLUMNS, Math.floor(index / URBAN_COLLISION_MASK_COLUMNS)) ? 1 : 0,
      `editor mask differs from authored cell ${index}`,
    )
  }
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

test('Urban editor and runtime movement agree at every 8px sample', () => {
  const mask = createUrbanRuntimeCollisionMask()
  const footprint = { width: PLAYER_FOOT_BOX.w, height: PLAYER_FOOT_BOX.h }
  const editorCanOccupy = (point) => canOccupyCollisionMask(
    mask,
    URBAN_COLLISION_MASK_COLUMNS,
    URBAN_COLLISION_MASK_ROWS,
    URBAN_COLLISION_MASK_CELL_SIZE,
    point,
    footprint,
  )

  for (const [label, point, expected] of [
    ['white mask overlapping a retained object collider', { x: 600, y: 240 }, true],
    ['black mask', { x: 190, y: 360 }, false],
    ['spawn', SPAWN_POINTS.entrance, true],
    ['south exit approach', { x: 720, y: 1060 }, true],
  ]) {
    assert.equal(editorCanOccupy(point), expected, `${label}: editor`)
    assert.equal(collidesPlayerAt(point.x, point.y) === null, expected, `${label}: runtime`)
  }
  assert.equal(collidesPlacementAt(600, 240)?.id, 'metro-deck-west',
    'retained object metadata must still reject unsafe placement')

  const mismatches = []
  let legacyObjectOverrides = 0
  const legacyCompositeMask = new Uint8Array(mask)
  for (const collider of OBJECT_COLLIDERS) {
    const firstColumn = Math.max(0, Math.floor(collider.x / URBAN_COLLISION_MASK_CELL_SIZE))
    const lastColumn = Math.min(URBAN_COLLISION_MASK_COLUMNS - 1,
      Math.ceil((collider.x + collider.w) / URBAN_COLLISION_MASK_CELL_SIZE) - 1)
    const firstRow = Math.max(0, Math.floor(collider.y / URBAN_COLLISION_MASK_CELL_SIZE))
    const lastRow = Math.min(URBAN_COLLISION_MASK_ROWS - 1,
      Math.ceil((collider.y + collider.h) / URBAN_COLLISION_MASK_CELL_SIZE) - 1)
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const cellX = column * URBAN_COLLISION_MASK_CELL_SIZE + URBAN_COLLISION_MASK_CELL_SIZE / 2
        const cellY = row * URBAN_COLLISION_MASK_CELL_SIZE + URBAN_COLLISION_MASK_CELL_SIZE / 2
        if (cellX >= collider.x && cellX < collider.x + collider.w
          && cellY >= collider.y && cellY < collider.y + collider.h) {
          legacyCompositeMask[row * URBAN_COLLISION_MASK_COLUMNS + column] = 0
        }
      }
    }
  }
  let legacyCompositeMismatches = 0
  for (let y = 4; y < 1086; y += 8) {
    for (let x = 4; x < 1448; x += 8) {
      const point = { x, y }
      const editor = editorCanOccupy(point)
      const runtime = collidesPlayerAt(x, y) === null
      if (editor !== runtime) mismatches.push({ x, y, editor, runtime })
      if (editor && collidesPlacementAt(x, y)) legacyObjectOverrides += 1
      const legacyEditor = canOccupyCollisionMask(
        legacyCompositeMask,
        URBAN_COLLISION_MASK_COLUMNS,
        URBAN_COLLISION_MASK_ROWS,
        URBAN_COLLISION_MASK_CELL_SIZE,
        point,
        footprint,
      )
      if (legacyEditor !== (collidesPlacementAt(x, y) === null)) legacyCompositeMismatches += 1
    }
  }
  assert.deepEqual(mismatches, [])
  assert.equal(legacyObjectOverrides, 1483,
    'the retained placement geometry must document the former white-mask overrides')
  assert.equal(legacyCompositeMismatches, 56,
    'the former editor collider rasterization must document its runtime mismatch')
})

test('urban-v3 and legacy urban autosave ids resolve to the same existing draft', async () => {
  const legacy = resolveCollisionMaskDraftTarget('urban')
  const current = resolveCollisionMaskDraftTarget('urban-v3')
  assert.deepEqual(
    { filename: current.filename, columns: current.columns, rows: current.rows },
    { filename: legacy.filename, columns: legacy.columns, rows: legacy.rows },
  )
  assert.equal(current.filename, 'urban-mask-draft.json')

  const [legacyResponse, currentResponse] = await Promise.all([
    getCollisionMaskDraft(new Request('http://localhost/api/internal/collision-mask-draft?village=urban')),
    getCollisionMaskDraft(new Request('http://localhost/api/internal/collision-mask-draft?village=urban-v3')),
  ])
  assert.equal(legacyResponse.status, 200)
  assert.equal(currentResponse.status, 200)
  const [legacyBody, currentBody] = await Promise.all([legacyResponse.json(), currentResponse.json()])
  assert.deepEqual(currentBody.draft, legacyBody.draft)

  const editorSource = await readFile(new URL('../app/collision-mask-editor/CollisionMaskEditor.js', import.meta.url), 'utf8')
  assert.match(editorSource, /id:\s*'urban-v3'/)
  assert.match(editorSource, /localDraftKey:\s*'soundvillage:collision-mask-editor:urban:v1'/)
})

test('all canonical PNGs and generated runtime modules are byte-for-byte current', async () => {
  for (const target of listVillageWalkableMaskTargets()) {
    const generated = await buildWalkableMaskTarget(target)
    const existing = await readFile(new URL(`../${target.outputModule}`, import.meta.url), 'utf8')
    assert.equal(existing, generated.moduleSource, `${target.villageId} generated module is stale`)
    assert.equal(generated.whitePixels + generated.blackPixels, target.width * target.height)
  }
})

test('opaque binary PNG and generated module creation are deterministic', async () => {
  const target = getVillageWalkableMaskTarget('animal')
  const mask = Uint8Array.from({ length: target.width * target.height }, (_, index) => index % 7 === 0 ? 0 : 1)
  const firstPng = await createOpaqueBinaryMaskPng(mask, target.width, target.height)
  const secondPng = await createOpaqueBinaryMaskPng(mask, target.width, target.height)
  assert.deepEqual(firstPng, secondPng)
  const [firstModule, secondModule] = await Promise.all([
    generateWalkableMaskModule(target, firstPng),
    generateWalkableMaskModule(target, secondPng),
  ])
  assert.equal(firstModule.moduleSource, secondModule.moduleSource)
  assert.equal(firstModule.sourceSha256, secondModule.sourceSha256)
  assert.equal(firstModule.whitePixels + firstModule.blackPixels, mask.length)
})

test('--check rejects a stale generated module', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'soundvillage-mask-check-'))
  const target = getVillageWalkableMaskTarget('animal')
  try {
    await Promise.all([
      mkdir(path.join(root, path.dirname(target.sourceAsset)), { recursive: true }),
      mkdir(path.join(root, path.dirname(target.outputModule)), { recursive: true }),
    ])
    await copyFile(new URL(`../${target.sourceAsset}`, import.meta.url), path.join(root, target.sourceAsset))
    await writeFile(path.join(root, target.outputModule), '// stale\n')
    await assert.rejects(
      writeWalkableMaskModules([target], { check: true, root }),
      /missing or stale/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('collision mask apply API strictly validates input and rejects production', async () => {
  const target = getVillageWalkableMaskTarget('animal')
  const validMaskBase64 = Buffer.alloc(target.width * target.height, 1).toString('base64')
  const validPayload = {
    villageId: target.villageId,
    width: target.width,
    height: target.height,
    maskBase64: validMaskBase64,
  }
  const requestFor = (body) => new Request('http://localhost/api/internal/collision-mask-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const noopApply = async (payload) => ({
    villageId: payload.villageId,
    width: payload.width,
    height: payload.height,
    hash: 'a'.repeat(64),
    walkablePixels: target.width * target.height,
    blockedPixels: 0,
    appliedAt: '2026-10-12T00:00:00.000Z',
  })

  const cases = [
    [{ ...validPayload, villageId: '../animal' }, 'unsupported_village'],
    [{ ...validPayload, width: target.width - 1 }, 'invalid_dimensions'],
    [{ ...validPayload, maskBase64: Buffer.alloc(8, 1).toString('base64') }, 'invalid_mask_length'],
    [{ ...validPayload, maskBase64: Buffer.alloc(target.width * target.height, 2).toString('base64') }, 'invalid_mask_value'],
    [{ ...validPayload, maskBase64: '%%%not-base64%%%' }, 'invalid_mask_base64'],
    [null, 'invalid_payload'],
    [{ ...validPayload, outputPath: '../../outside.png' }, 'unexpected_field'],
  ]
  for (const [payload, code] of cases) {
    const response = await handleCollisionMaskApply(requestFor(payload), { nodeEnv: 'development', apply: noopApply })
    assert.equal(response.status, 400, code)
    assert.equal((await response.json()).code, code)
  }

  const invalidJson = await handleCollisionMaskApply(requestFor('{'), { nodeEnv: 'development', apply: noopApply })
  assert.equal(invalidJson.status, 400)
  assert.equal((await invalidJson.json()).code, 'invalid_json')

  const production = await handleCollisionMaskApply(requestFor(validPayload), { nodeEnv: 'production', apply: noopApply })
  assert.equal(production.status, 403)
  assert.equal((await production.json()).code, 'production_disabled')

  const success = await handleCollisionMaskApply(requestFor(validPayload), { nodeEnv: 'development', apply: noopApply })
  assert.equal(success.status, 200)
  assert.deepEqual(await success.json(), {
    ok: true,
    villageId: 'animal',
    width: target.width,
    height: target.height,
    hash: 'a'.repeat(64),
    walkablePixels: target.width * target.height,
    blockedPixels: 0,
    appliedAt: '2026-10-12T00:00:00.000Z',
    reloadRequired: true,
  })
})
