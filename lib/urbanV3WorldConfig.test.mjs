import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import sharp from 'sharp'
import {
  URBAN_V3_WALKABLE_MASK_METADATA,
  isUrbanV3MaskCellWalkable,
  isUrbanV3MaskPointWalkable,
} from './urbanV3WalkableMask.generated.mjs'
import { spawnUrbanV3SoundItems } from './urbanV3SoundItems.mjs'
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
  const runtimeBackground = await readFile(new URL('../public/assets/urban-city-v3/reference/canonical-map-art-runtime.png', import.meta.url))
  const backgroundMetadata = await sharp(runtimeBackground).metadata()
  assert.deepEqual({ width: backgroundMetadata.width, height: backgroundMetadata.height }, {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  })
})

test('generated mask metadata and every packed bit match the immutable RGBA source', async () => {
  const source = await readFile(new URL('../public/assets/urban-city-v3/collision/urban-walkable-mask.png', import.meta.url))
  assert.equal(createHash('sha256').update(source).digest('hex'), '1438401782712ed4c315e69c6337d93dc060241ca2b77ded7eef1100b82dde02')
  assert.deepEqual(URBAN_V3_WALKABLE_MASK_METADATA, {
    villageId: 'urban-v3',
    width: 724,
    height: 543,
    baseCellSize: 2,
    baseWorldWidth: 1448,
    baseWorldHeight: 1086,
    playerFootWidth: 20,
    playerFootHeight: 14,
    sourceAsset: 'public/assets/urban-city-v3/collision/urban-walkable-mask.png',
    sourceSha256: '1438401782712ed4c315e69c6337d93dc060241ca2b77ded7eef1100b82dde02',
    formatVersion: 2,
    encoding: '1-bit-msb-row-major-base64',
    whitePixels: 157072,
    blackPixels: 236060,
    byteLength: 49142,
  })

  const image = sharp(source, { failOn: 'error', limitInputPixels: 724 * 543 })
  const imageMetadata = await image.metadata()
  assert.deepEqual({
    format: imageMetadata.format,
    width: imageMetadata.width,
    height: imageMetadata.height,
    channels: imageMetadata.channels,
    hasAlpha: imageMetadata.hasAlpha,
  }, { format: 'png', width: 724, height: 543, channels: 4, hasAlpha: true })
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.channels, 4)
  let blackPixels = 0
  let whitePixels = 0
  for (let index = 0; index < 724 * 543; index += 1) {
    const offset = index * 4
    const rgba = [...data.subarray(offset, offset + 4)]
    const black = rgba[0] === 0 && rgba[1] === 0 && rgba[2] === 0 && rgba[3] === 255
    const white = rgba[0] === 255 && rgba[1] === 255 && rgba[2] === 255 && rgba[3] === 255
    assert.ok(black || white, `non-binary source pixel at index ${index}: ${rgba.join(',')}`)
    if (white) whitePixels += 1
    else blackPixels += 1
    assert.equal(isUrbanV3MaskCellWalkable(index % 724, Math.floor(index / 724)), white,
      `packed bit mismatch at source pixel ${index}`)
  }
  assert.deepEqual({ blackPixels, whitePixels }, { blackPixels: 236060, whitePixels: 157072 })
})

test('world coordinates map to mask cells without resize, offset, crop, or Y inversion', () => {
  const probes = [
    [0, 0], [WORLD_WIDTH - 0.001, 0], [0, WORLD_HEIGHT - 0.001],
    [WORLD_WIDTH - 0.001, WORLD_HEIGHT - 0.001],
    ...CROSSWALK_REGIONS.map((region) => [region.x + region.w / 2, region.y + region.h / 2]),
  ]
  for (const [worldX, worldY] of probes) {
    const column = Math.floor(worldX / 2)
    const row = Math.floor(worldY / 2)
    assert.equal(isUrbanV3MaskPointWalkable(worldX, worldY), isUrbanV3MaskCellWalkable(column, row),
      `world (${worldX}, ${worldY}) must map to mask (${column}, ${row})`)
  }
  for (const [worldX, worldY] of [[-0.001, 0], [0, -0.001], [WORLD_WIDTH, 0], [0, WORLD_HEIGHT]]) {
    assert.equal(isUrbanV3MaskPointWalkable(worldX, worldY), false)
  }
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

test('semantic surfaces remain available while the generated mask is final walkability', () => {
  assert.equal(surfaceAt(720, 580), 'plaza')
  assert.equal(surfaceAt(720, 260), 'stairs')
  assert.equal(surfaceAt(720, 1060), 'entrance')
  assert.equal(surfaceAt(580, 700), 'road')
  assert.equal(isWalkablePoint(580, 700), true, 'white mask must open a semantic road cell')
  assert.equal(isWalkablePoint(720, 580), false, 'black mask must close a semantic plaza cell')
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
  assert.equal(collidesPlayerAt(980, 540)?.id, 'blocked-non-walkable', 'edited black mask must override plaza semantics')
  assert.equal(surfaceAt(150, 380), 'sidewalk', 'northwest curved pavement must stay open')
  assert.equal(isWalkablePoint(150, 380), false, 'edited black mask must override polygon semantics')
  assert.equal(surfaceAt(1290, 422), 'sidewalk', 'northeast curved pavement must stay open')
  assert.equal(collidesPlayerAt(1290, 422), null)
})

test('white mask cells under explicit colliders remain blocked and are audited', () => {
  const overlapsById = new Map()
  let overlapCells = 0
  for (const collider of OBJECT_COLLIDERS) {
    let count = 0
    const firstColumn = Math.floor(collider.x / 2)
    const lastColumn = Math.ceil((collider.x + collider.w) / 2) - 1
    const firstRow = Math.floor(collider.y / 2)
    const lastRow = Math.ceil((collider.y + collider.h) / 2) - 1
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (isUrbanV3MaskCellWalkable(column, row)) count += 1
      }
    }
    if (count) overlapsById.set(collider.id, count)
    overlapCells += count
  }
  assert.equal(overlapCells, 16667)
  assert.equal(overlapsById.size, 94)
  assert.deepEqual([...overlapsById.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10), [
    ['metro-underpass-east-wall', 2761],
    ['metro-underpass-west-wall', 2110],
    ['building-northwest-helipad-tower', 1294],
    ['building-northeast-curved-tower', 1152],
    ['building-west-media-office', 1023],
    ['building-east-food-annex', 761],
    ['vehicle-southeast-orange-shuttle', 662],
    ['vehicle-east-electric-bus-02', 586],
    ['vehicle-west-road-car', 528],
    ['vehicle-southeast-blue-shuttle', 308],
  ])

  const collider = OBJECT_COLLIDERS.find((entry) => entry.id === 'building-west-media-office')
  let whitePoint = null
  for (let row = Math.floor((collider.y + 1) / 2); row < Math.ceil((collider.y + collider.h) / 2) && !whitePoint; row += 1) {
    for (let column = Math.floor(collider.x / 2); column < Math.ceil((collider.x + collider.w) / 2); column += 1) {
      if (isUrbanV3MaskCellWalkable(column, row)) {
        whitePoint = { x: column * 2 + 1, y: row * 2 + 1 }
        break
      }
    }
  }
  assert.ok(whitePoint && isWalkablePoint(whitePoint.x, whitePoint.y))
  assert.equal(collidesPlayerAt(whitePoint.x, whitePoint.y)?.id, collider.id,
    'explicit collider must win over a white generated-mask cell')
})

test('white mask connectivity is reported without modifying isolated regions', () => {
  const width = URBAN_V3_WALKABLE_MASK_METADATA.width
  const height = URBAN_V3_WALKABLE_MASK_METADATA.height
  const labels = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  const components = []
  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] !== -1 || !isUrbanV3MaskCellWalkable(start % width, Math.floor(start / width))) continue
    const label = components.length
    let head = 0
    let tail = 1
    let minColumn = start % width
    let maxColumn = minColumn
    let minRow = Math.floor(start / width)
    let maxRow = minRow
    labels[start] = label
    queue[0] = start
    while (head < tail) {
      const index = queue[head]
      head += 1
      const column = index % width
      const row = Math.floor(index / width)
      minColumn = Math.min(minColumn, column)
      maxColumn = Math.max(maxColumn, column)
      minRow = Math.min(minRow, row)
      maxRow = Math.max(maxRow, row)
      for (const [nextColumn, nextRow] of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]) {
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= width || nextRow >= height) continue
        const nextIndex = nextRow * width + nextColumn
        if (labels[nextIndex] !== -1 || !isUrbanV3MaskCellWalkable(nextColumn, nextRow)) continue
        labels[nextIndex] = label
        queue[tail] = nextIndex
        tail += 1
      }
    }
    components.push({
      size: tail,
      bounds: {
        x: minColumn * 2,
        y: minRow * 2,
        w: (maxColumn - minColumn + 1) * 2,
        h: (maxRow - minRow + 1) * 2,
      },
    })
  }
  components.sort((left, right) => right.size - left.size)
  assert.deepEqual(components, [
    { size: 157064, bounds: { x: 58, y: 206, w: 1382, h: 880 } },
    { size: 3, bounds: { x: 348, y: 466, w: 4, h: 4 } },
    { size: 2, bounds: { x: 442, y: 466, w: 4, h: 2 } },
    { size: 1, bounds: { x: 494, y: 460, w: 2, h: 2 } },
    { size: 1, bounds: { x: 436, y: 468, w: 2, h: 2 } },
    { size: 1, bounds: { x: 352, y: 470, w: 2, h: 2 } },
  ])
  const entranceIndex = Math.floor(SPAWN_POINTS.entrance.y / 2) * width + Math.floor(SPAWN_POINTS.entrance.x / 2)
  const entranceLabel = labels[entranceIndex]
  assert.notEqual(entranceLabel, -1)
  assert.equal(components.find((component) => component.size === 157064)?.size, 157064)
  for (const point of [...Object.values(SPAWN_POINTS), ...Object.values(ACCESSIBILITY_TARGETS)]) {
    const index = Math.floor(point.y / 2) * width + Math.floor(point.x / 2)
    assert.equal(labels[index], entranceLabel, `${point.id} must share the entrance mask component`)
  }
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

test('all Urban A/B sounds receive deterministic, unique, reachable V3 positions', async () => {
  const metadata = JSON.parse(await readFile(new URL('../data/sound_metadata.json', import.meta.url), 'utf8'))
  const reachable = reachableGridKeys(SPAWN_POINTS.entrance, 8)
  for (const group of ['A', 'B']) {
    const sounds = metadata.sounds.filter((sound) => sound.game_zone === 'Urban' && sound.group === group)
    const first = spawnUrbanV3SoundItems(sounds)
    const second = spawnUrbanV3SoundItems([...sounds].reverse())
    assert.equal(first.length, 83)
    assert.deepEqual(first.map(({ id, x, y }) => [id, x, y]), second.map(({ id, x, y }) => [id, x, y]))
    assert.equal(new Set(first.map((item) => `${item.x},${item.y}`)).size, first.length)
    for (const item of first) {
      assert.equal(collidesPlayerAt(item.x, item.y), null, `${group}:${item.id} is blocked`)
      assert.ok(reachable.has(`${item.x},${item.y}`), `${group}:${item.id} is unreachable`)
    }
  }
})

test('object footprints stop entry and diagonal movement slides on the free axis', () => {
  for (const id of ['building-west-media-office', 'vehicle-west-road-car', 'tree-12', 'planter-09', 'street-light-14']) {
    const collider = OBJECT_COLLIDERS.find((entry) => entry.id === id)
    assert.ok(collider, `${id} collider missing`)
    const hit = collidesPlayerAt(collider.x + collider.w / 2, collider.y + collider.h)
    assert.equal(hit?.id, id, `${id} does not block the player`)
  }
  assert.equal(isWalkablePoint(626, 244), true, 'test fixture center must be a white cell')
  assert.equal(collidesPlayerAt(626, 244)?.id, 'blocked-non-walkable',
    'a white center must not allow a 20x14 foot box that overlaps black mask cells')
  const start = { x: 764, y: 300 }
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
