import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  WORLD_COLLISION_SUBSTEP_PX,
  WORLD_DESTINATIONS,
  WORLD_MAP_HEIGHT_PX,
  WORLD_MAP_WIDTH_PX,
  WORLD_PLAYER,
  WORLD_SPAWN,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  isWorldWalkableMaskCell,
  moveWorldPlayer,
  worldDestinationHitbox,
  worldPlayerFootCenter,
  worldPlayerTopLeftAtFoot,
  worldRectanglesOverlap,
} from '../lib/worldMapGeometry.mjs'
import { WORLD_MAP_V4_ASSETS } from '../lib/worldMapV4Assets.mjs'
import { WORLD_MAP_V4_BUILDING_COLLIDERS, WORLD_MAP_V4_DESTINATIONS } from '../lib/worldMapV4Manifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW_DIR = path.join(ROOT, '_review/world-map-sequential-fix-2026-09-21/03-navigation-open-paths')
const MASK = WORLD_WALKABLE_MASK_META
const SPEED = 5.85

assert.deepEqual(
  { width: MASK.width, height: MASK.height, cell: MASK.cellSize, worldWidth: MASK.worldWidth, worldHeight: MASK.worldHeight },
  { width: 960, height: 720, cell: 4, worldWidth: WORLD_MAP_WIDTH_PX, worldHeight: WORLD_MAP_HEIGHT_PX },
  'mask and world registration must be exact',
)
assert.ok(MASK.cellSize <= 4, 'one collision cell must be at most 4 world px')
assert.ok(WORLD_COLLISION_SUBSTEP_PX < MASK.cellSize, 'movement substep must be smaller than a mask cell')

const pngSize = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) })
const [libraryMetadata, maskPng] = await Promise.all([
  sharp(path.join(ROOT, 'public', WORLD_MAP_V4_ASSETS['landmark-library'].src)).metadata(),
  readFile(path.join(ROOT, 'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png')),
])
assert.ok(libraryMetadata.width >= 1100 && libraryMetadata.height >= 500, 'reference-cropped modular library density')
assert.deepEqual(pngSize(maskPng), { width: 960, height: 720 }, 'mask PNG dimensions')

const indexOf = (x, y) => y * MASK.width + x
const startX = Math.floor((WORLD_SPAWN.tx * 32) / MASK.cellSize)
const startY = Math.floor((WORLD_SPAWN.ty * 32) / MASK.cellSize)
const seen = new Uint8Array(MASK.width * MASK.height)
const parent = new Int32Array(MASK.width * MASK.height)
parent.fill(-1)
const queueX = new Int16Array(MASK.width * MASK.height)
const queueY = new Int16Array(MASK.width * MASK.height)
queueX[0] = startX
queueY[0] = startY
seen[indexOf(startX, startY)] = 1
let head = 0
let tail = 1
while (head < tail) {
  const x = queueX[head]
  const y = queueY[head]
  const current = indexOf(x, y)
  head += 1
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= MASK.width || ny >= MASK.height) continue
    const next = indexOf(nx, ny)
    if (seen[next] || !isWorldWalkableMaskCell(nx, ny)) continue
    seen[next] = 1
    parent[next] = current
    queueX[tail] = nx
    queueY[tail] = ny
    tail += 1
  }
}

let walkableCells = 0
let disconnectedCells = 0
let oneToTwoCellPinches = 0
for (let y = 0; y < MASK.height; y += 1) {
  for (let x = 0; x < MASK.width; x += 1) {
    if (!isWorldWalkableMaskCell(x, y)) continue
    walkableCells += 1
    if (!seen[indexOf(x, y)]) disconnectedCells += 1
    let horizontal = 1
    let vertical = 1
    for (let distance = 1; distance <= 2; distance += 1) {
      if (isWorldWalkableMaskCell(x - distance, y)) horizontal += 1
      if (isWorldWalkableMaskCell(x + distance, y)) horizontal += 1
      if (isWorldWalkableMaskCell(x, y - distance)) vertical += 1
      if (isWorldWalkableMaskCell(x, y + distance)) vertical += 1
    }
    if (horizontal <= 2 && vertical <= 2) oneToTwoCellPinches += 1
  }
}
assert.equal(disconnectedCells, 0, 'all walkable cells must be one 4-connected network')
assert.ok(oneToTwoCellPinches <= 8, 'no unintended field of 1-2 cell bottlenecks')
assert.ok(walkableCells / (MASK.width * MASK.height) >= 0.9, 'at least 90% of the world remains freely walkable')

const cellCenterPosition = (x, y) => {
  const footX = (x + 0.5) * MASK.cellSize
  const footY = (y + 0.5) * MASK.cellSize
  return { x: footX - WORLD_PLAYER.width / 2, y: footY - WORLD_PLAYER.height + WORLD_PLAYER.footHeight / 2 }
}

const placementAtCell = (x, y) => {
  const position = cellCenterPosition(x, y)
  return { ...position, w: WORLD_PLAYER.width, h: WORLD_PLAYER.height }
}

const nearestReachableCell = (tx, ty, radius = 120) => {
  const cx = Math.round((tx * 32) / MASK.cellSize)
  const cy = Math.round((ty * 32) / MASK.cellSize)
  let best = null
  for (let y = Math.max(0, cy - radius); y <= Math.min(MASK.height - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(MASK.width - 1, cx + radius); x += 1) {
      if (!seen[indexOf(x, y)]) continue
      const distance = (x - cx) ** 2 + (y - cy) ** 2
      if (!best || distance < best.distance) best = { x, y, distance }
    }
  }
  assert.ok(best, `reachable sample near ${tx},${ty}`)
  return best
}

const pathTo = target => {
  const cells = []
  let current = indexOf(target.x, target.y)
  while (current >= 0) {
    const y = Math.floor(current / MASK.width)
    const x = current - y * MASK.width
    cells.push({ x, y })
    current = parent[current]
  }
  return cells.reverse()
}

const drivePath = cells => {
  let position = cellCenterPosition(cells[0].x, cells[0].y)
  let stalledFrames = 0
  let maxStalledFrames = 0
  let largeDeltaChecks = 0
  for (let index = 1; index < cells.length; index += 1) {
    const target = cellCenterPosition(cells[index].x, cells[index].y)
    const deltaX = target.x - position.x
    const deltaY = target.y - position.y
    const moved = moveWorldPlayer(position, deltaX, deltaY)
    if (moved.moved) stalledFrames = 0
    else stalledFrames += 1
    maxStalledFrames = Math.max(maxStalledFrames, stalledFrames)
    assert.ok(isWorldPlayerWalkable(moved.x, moved.y), 'movement always ends on clearance mask')
    position = { x: moved.x, y: moved.y }

    if (index + 3 < cells.length) {
      const ahead = cells[index + 3]
      const sameLine = (ahead.x === cells[index].x) || (ahead.y === cells[index].y)
      if (sameLine) {
        const aheadPosition = cellCenterPosition(ahead.x, ahead.y)
        const large = moveWorldPlayer(position, aheadPosition.x - position.x, aheadPosition.y - position.y)
        assert.ok(isWorldPlayerWalkable(large.x, large.y), 'large-delta substeps cannot tunnel into obstacles')
        largeDeltaChecks += 1
      }
    }
  }
  assert.ok(maxStalledFrames < 30, 'no route stalls for 500ms at 60fps')
  return { pathCells: cells.length, maxStalledFrames, largeDeltaChecks }
}

const experientialSamples = [
  { id: 'east-plaza-curve', tx: 83.5, ty: 39.5 },
  { id: 'west-plaza-curve', tx: 37, ty: 40 },
  { id: 'nature-bridge-gate', tx: 17, ty: 42 },
  { id: 'urban-branch-gate', tx: 106, ty: 43 },
  { id: 'music-flowerbed-lane', tx: 96, ty: 66 },
  { id: 'human-market-bench-lane', tx: 20, ty: 70 },
]
const routeCoverage = {}
for (const sample of experientialSamples) {
  const target = nearestReachableCell(sample.tx, sample.ty)
  routeCoverage[sample.id] = {
    requestedWorldTile: { tx: sample.tx, ty: sample.ty },
    testedFootWorldPx: { x: (target.x + 0.5) * MASK.cellSize, y: (target.y + 0.5) * MASK.cellSize },
    ...drivePath(pathTo(target)),
  }
}

const destinations = {}
for (const destination of WORLD_DESTINATIONS) {
  const hitbox = worldDestinationHitbox(destination.target)
  let target = null
  for (let index = 0; index < tail; index += 1) {
    const x = queueX[index]
    const y = queueY[index]
    if (worldRectanglesOverlap(placementAtCell(x, y), hitbox)) {
      target = { x, y }
      break
    }
  }
  assert.ok(target, `${destination.id} has a reachable mask approach`)
  destinations[destination.id] = drivePath(pathTo(target))
}

const openTerrainSamples = [
  { id: 'nature-water', tx: 6, ty: 42 },
  { id: 'north-forest', tx: 88, ty: 12 },
  { id: 'southwest-garden', tx: 36, ty: 72 },
  { id: 'central-garden-arch', tx: 87, ty: 72 },
]
for (const sample of openTerrainSamples) {
  const position = worldPlayerTopLeftAtFoot(sample.tx, sample.ty)
  assert.equal(isWorldPlayerWalkable(position.x, position.y), true, `${sample.id} is open terrain`)
}

const buildingSamples = []
for (const collider of WORLD_MAP_V4_BUILDING_COLLIDERS) {
  const centerX = (collider.left + collider.right) / 2
  const centerY = (collider.top + collider.bottom) / 2
  const position = worldPlayerTopLeftAtFoot(centerX / 32, centerY / 32)
  assert.equal(isWorldPlayerWalkable(position.x, position.y), false, `${collider.id} building body remains blocked`)
  buildingSamples.push({ id:collider.id, center:{ x:centerX, y:centerY } })
}
for (const [id, destination] of Object.entries(WORLD_MAP_V4_DESTINATIONS)) {
  const position = worldPlayerTopLeftAtFoot(destination.approach.x / 32, destination.approach.y / 32)
  assert.equal(isWorldPlayerWalkable(position.x, position.y), true, `${id} approach remains walkable`)
}

// Sample the production movement function at both normal and throttled-frame
// deltas across the connected field.
let movementSamples = 0
for (let index = 0; index < tail; index += 97) {
  const position = cellCenterPosition(queueX[index], queueY[index])
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (const deltaScale of [1, 3]) {
      const result = moveWorldPlayer(position, dx * SPEED * deltaScale, dy * SPEED * deltaScale)
      assert.ok(isWorldPlayerWalkable(result.x, result.y), 'normal and large delta movement remains valid')
      const foot = worldPlayerFootCenter(result.x, result.y)
      assert.ok(foot.x >= 0 && foot.y >= 0 && foot.x <= WORLD_MAP_WIDTH_PX && foot.y <= WORLD_MAP_HEIGHT_PX)
      movementSamples += 1
    }
  }
}

const report = {
  status: 'PASS',
  registration: MASK,
  modularLandmark: { width: libraryMetadata.width, height: libraryMetadata.height },
  connectivity: { walkableCells, reachableCells: tail, disconnectedCells, oneToTwoCellPinches },
  movement: { speedPxPerFrame: SPEED, substepPx: WORLD_COLLISION_SUBSTEP_PX, sampledNormalAndLargeDeltaMoves: movementSamples },
  routeCoverage,
  destinations,
  openTerrainSamples,
  buildingSamples,
}
await mkdir(REVIEW_DIR, { recursive: true })
await writeFile(path.join(REVIEW_DIR, 'collision-coverage-validation.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
