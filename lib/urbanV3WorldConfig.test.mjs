import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  ACCESSIBILITY_TARGETS,
  BLOCKED_ROAD_REGIONS,
  CROSSWALK_REGIONS,
  ENTRANCE_REGIONS,
  EXIT_TRIGGER,
  OBJECT_COLLIDERS,
  OBJECT_FOOTPRINTS,
  PLAYER_FOOT_BOX,
  REFERENCE_TRANSFORM,
  SPAWN_POINTS,
  STAIR_REGIONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collidesPlayerAt,
  isReachableTarget,
  isWalkablePoint,
  moveUrbanV3Player,
  overlapsExitTrigger,
  reachableGridKeys,
  surfaceAt,
} from './urbanV3WorldConfig.mjs'

const overlaps = (a, b) => (
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
)

const reaches = (from, target, gridSize = 8) => {
  const visited = reachableGridKeys(from, gridSize)
  for (let x = target.x - gridSize; x <= target.x + gridSize; x += gridSize) {
    for (let y = target.y - gridSize; y <= target.y + gridSize; y += gridSize) {
      const snappedX = Math.round(x / gridSize) * gridSize
      const snappedY = Math.round(y / gridSize) * gridSize
      if (visited.has(`${snappedX},${snappedY}`)) return true
    }
  }
  return false
}

test('Urban v3 keeps canonical identity coordinates', async () => {
  assert.equal(WORLD_WIDTH, 1448)
  assert.equal(WORLD_HEIGHT, 1086)
  assert.deepEqual(REFERENCE_TRANSFORM, {
    type: 'identity', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
  })
  const layout = JSON.parse(await readFile(new URL('../public/assets/urban-city-v3/layout.json', import.meta.url), 'utf8'))
  assert.deepEqual(layout.worldPixels, { width: WORLD_WIDTH, height: WORLD_HEIGHT })
  assert.deepEqual(layout.referenceTransform, REFERENCE_TRANSFORM)
})

test('all active collider ids and rectangles are valid, unique, in-world, and non-overlapping', () => {
  const ids = new Set()
  for (const rect of [...OBJECT_COLLIDERS, ...BLOCKED_ROAD_REGIONS]) {
    assert.ok(rect.id && !ids.has(rect.id), `duplicate collider id: ${rect.id}`)
    ids.add(rect.id)
    assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.y), `${rect.id} has invalid coordinates`)
    assert.ok(Number.isFinite(rect.w) && rect.w > 0, `${rect.id} has invalid width`)
    assert.ok(Number.isFinite(rect.h) && rect.h > 0, `${rect.id} has invalid height`)
    assert.ok(rect.x >= 0 && rect.y >= 0, `${rect.id} begins outside the world`)
    assert.ok(rect.x + rect.w <= WORLD_WIDTH, `${rect.id} exceeds world width`)
    assert.ok(rect.y + rect.h <= WORLD_HEIGHT, `${rect.id} exceeds world height`)
  }
  for (let left = 0; left < OBJECT_COLLIDERS.length; left++) {
    for (let right = left + 1; right < OBJECT_COLLIDERS.length; right++) {
      assert.equal(overlaps(OBJECT_COLLIDERS[left], OBJECT_COLLIDERS[right]), false,
        `${OBJECT_COLLIDERS[left].id} overlaps ${OBJECT_COLLIDERS[right].id}`)
    }
  }
})

test('footprints cover every requested object class without using visual bounds', async () => {
  const categories = new Set(OBJECT_FOOTPRINTS.map((rect) => rect.category))
  for (const category of [
    'building', 'metro', 'vehicle', 'tree-trunk', 'planter', 'street-light-base',
    'kiosk', 'control-box', 'bench', 'bollard', 'south-rail',
  ]) assert.ok(categories.has(category), `missing ${category} footprints`)

  const inventory = JSON.parse(await readFile(new URL('../public/assets/urban-city-v3/inventory.json', import.meta.url), 'utf8'))
  const inventoryById = new Map(inventory.instances.map((entry) => [entry.id, entry]))
  for (const footprint of OBJECT_FOOTPRINTS.filter((rect) => ['tree-trunk', 'street-light-base'].includes(rect.category))) {
    const reference = inventoryById.get(footprint.id)?.referenceBounds
    assert.ok(reference, `${footprint.id} must map to inventory art`)
    assert.ok(footprint.w < reference.w || footprint.h < reference.h,
      `${footprint.id} must use its base/trunk, not referenceBounds`)
  }
})

test('surface classification blocks roads and preserves explicit crossings', () => {
  assert.equal(surfaceAt(720, 580), 'plaza')
  assert.equal(surfaceAt(720, 260), 'stairs')
  assert.equal(surfaceAt(720, 1060), 'entrance')
  assert.equal(surfaceAt(580, 700), 'road')
  assert.equal(isWalkablePoint(580, 700), false)
  assert.equal(surfaceAt(580, 790), 'crosswalk')
  assert.equal(isWalkablePoint(580, 790), true)
  assert.ok(CROSSWALK_REGIONS.every((rect) => Math.min(rect.w, rect.h) > PLAYER_FOOT_BOX.h),
    'crosswalk openings must exceed the foot hitbox')
  assert.ok(STAIR_REGIONS.every((rect) => rect.w > PLAYER_FOOT_BOX.w),
    'metro stair opening must exceed the foot hitbox')
  assert.ok(ENTRANCE_REGIONS.every((rect) => rect.w > PLAYER_FOOT_BOX.w),
    'south entrance must exceed the foot hitbox')
})

test('art-aligned facade and visible-path regressions stay fixed', () => {
  assert.equal(surfaceAt(325, 270), 'object-footprint', 'north metro facade must not be walkable')
  assert.equal(collidesPlayerAt(325, 270)?.id, 'metro-underpass-west-wall')
  assert.equal(surfaceAt(980, 540), 'plaza', 'pavement below the east glass building must stay open')
  assert.equal(collidesPlayerAt(980, 540), null)
  assert.equal(surfaceAt(150, 380), 'sidewalk', 'northwest curved pavement must stay open')
  assert.equal(surfaceAt(1290, 422), 'sidewalk', 'northeast curved pavement must stay open')
  assert.equal(collidesPlayerAt(1290, 422), null)
})

test('spawns, targets, and exit are clear', () => {
  for (const spawn of Object.values(SPAWN_POINTS)) {
    assert.equal(collidesPlayerAt(spawn.x, spawn.y), null, `${spawn.id} spawn is blocked`)
    assert.equal(overlapsExitTrigger(spawn), false, `${spawn.id} spawn starts at exit`)
  }
  for (const target of Object.values(ACCESSIBILITY_TARGETS)) {
    assert.equal(collidesPlayerAt(target.x, target.y), null, `${target.id} target is blocked`)
  }
  assert.equal(collidesPlayerAt(720, 1060), null)
  assert.ok(overlapsExitTrigger({ x: 720, y: 1060 }))
  assert.ok(EXIT_TRIGGER.w > PLAYER_FOOT_BOX.w)
})

test('all required accessibility routes pass on an 8px BFS grid', () => {
  for (const targetId of Object.keys(ACCESSIBILITY_TARGETS)) {
    assert.ok(isReachableTarget(targetId, 'entrance', 8), `entrance cannot reach ${targetId}`)
  }
  const required = [
    ['entrance → central plaza', SPAWN_POINTS.entrance, ACCESSIBILITY_TARGETS['central-plaza']],
    ['entrance → southwest', SPAWN_POINTS.entrance, ACCESSIBILITY_TARGETS.southwest],
    ['entrance → southeast', SPAWN_POINTS.entrance, ACCESSIBILITY_TARGETS.southeast],
    ['central plaza → west media', ACCESSIBILITY_TARGETS['central-plaza'], ACCESSIBILITY_TARGETS['west-media-plaza']],
    ['central plaza → east food court', ACCESSIBILITY_TARGETS['central-plaza'], ACCESSIBILITY_TARGETS['east-food-court']],
    ['central plaza → metro stairs', ACCESSIBILITY_TARGETS['central-plaza'], ACCESSIBILITY_TARGETS['metro-stairs']],
    ['metro spawn → central plaza', SPAWN_POINTS.metro, ACCESSIBILITY_TARGETS['central-plaza']],
  ]
  for (const [label, from, target] of required) assert.ok(reaches(from, target), label)
  for (const target of Object.values(ACCESSIBILITY_TARGETS)) {
    assert.ok(reaches(target, ACCESSIBILITY_TARGETS['south-exit']), `${target.id} cannot reach south exit`)
  }
})

test('object footprints stop entry and diagonal movement slides on the free axis', () => {
  for (const id of ['building-west-media-office', 'vehicle-west-road-car', 'tree-12', 'planter-09', 'street-light-14']) {
    const collider = OBJECT_COLLIDERS.find((entry) => entry.id === id)
    assert.ok(collider, `${id} collider missing`)
    const hit = collidesPlayerAt(collider.x + collider.w / 2, collider.y + collider.h)
    assert.equal(hit?.id, id, `${id} does not block the player`)
  }
  const start = { x: 550, y: 340 }
  assert.equal(collidesPlayerAt(start.x, start.y), null)
  const moved = moveUrbanV3Player(start, 8, 8)
  assert.equal(moved.x, start.x, 'blocked x axis should remain fixed')
  assert.ok(moved.y > start.y, 'free y axis should keep sliding')
})

test('v3 config and playtest do not import v2 or mutate other zone movement', async () => {
  const config = await readFile(new URL('./urbanV3WorldConfig.mjs', import.meta.url), 'utf8')
  const component = await readFile(new URL('../components/UrbanV3Playtest.js', import.meta.url), 'utf8')
  assert.doesNotMatch(config, /urbanVillageConfig|urban-city-v2|referenceBounds/)
  assert.doesNotMatch(component, /urbanVillageConfig|urban-city-v2/)
  assert.match(component, /urbanV3WorldConfig\.mjs/)
  assert.match(component, /debug collision/)
})
