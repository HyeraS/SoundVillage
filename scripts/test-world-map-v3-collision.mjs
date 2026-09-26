import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WORLD_DESTINATIONS,
  WORLD_MAP_HEIGHT_PX,
  WORLD_MAP_WIDTH_PX,
  WORLD_SPAWN,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  isWorldWalkableMaskCell,
  moveWorldPlayer,
  worldDestinationHitbox,
  worldPlayerTopLeftAtFoot,
  worldRectanglesOverlap,
} from '../lib/worldMapGeometry.mjs'
import { WORLD_MAP_V3_PATHS } from '../lib/worldMapV3Manifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-modular-v3')
const mask = WORLD_WALKABLE_MASK_META
assert.equal(mask.source, 'world-map-v3-manifest')
assert.equal(mask.cellSize, 4)
assert.equal(mask.worldWidth, WORLD_MAP_WIDTH_PX)
assert.equal(mask.worldHeight, WORLD_MAP_HEIGHT_PX)

const spawn = worldPlayerTopLeftAtFoot(WORLD_SPAWN.tx, WORLD_SPAWN.ty)
assert.ok(isWorldPlayerWalkable(spawn.x, spawn.y), 'spawn is walkable')
for (const route of WORLD_MAP_V3_PATHS) {
  for (let index = 1; index < route.points.length; index += 1) {
    const a = route.points[index - 1]
    const b = route.points[index]
    for (let step = 0; step <= 20; step += 1) {
      const t = step / 20
      const position = worldPlayerTopLeftAtFoot((a.x + (b.x - a.x) * t) / 32, (a.y + (b.y - a.y) * t) / 32)
      assert.ok(isWorldPlayerWalkable(position.x, position.y), `${route.id} centerline is walkable at sample ${step}`)
    }
  }
}

const width = mask.width
const height = mask.height
const startX = Math.floor(WORLD_SPAWN.tx * 32 / mask.cellSize)
const startY = Math.floor(WORLD_SPAWN.ty * 32 / mask.cellSize)
const queue = [[startX, startY]]
const seen = new Set([`${startX},${startY}`])
for (let head = 0; head < queue.length; head += 1) {
  const [x, y] = queue[head]
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    const key = `${nx},${ny}`
    if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen.has(key) || !isWorldWalkableMaskCell(nx, ny)) continue
    seen.add(key)
    queue.push([nx, ny])
  }
}
let totalWalkable = 0
for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (isWorldWalkableMaskCell(x, y)) totalWalkable += 1
assert.equal(seen.size, totalWalkable, 'all walkable cells are connected')

const destinationResults = {}
for (const destination of WORLD_DESTINATIONS) {
  const hitbox = worldDestinationHitbox(destination.target)
  const reachable = queue.some(([x, y]) => {
    const footX = (x + 0.5) * mask.cellSize
    const footY = (y + 0.5) * mask.cellSize
    return worldRectanglesOverlap({ x: footX - 36, y: footY - 80, w: 72, h: 88 }, hitbox)
  })
  assert.ok(reachable, `${destination.id} is reachable from spawn`) 
  destinationResults[destination.id] = 'reachable'
}

for (const [dx, dy] of [[300, 0], [-300, 0], [0, 300], [0, -300], [240, 240]]) {
  const moved = moveWorldPlayer(spawn, dx, dy)
  assert.ok(isWorldPlayerWalkable(moved.x, moved.y), 'large delta never exits clearance mask')
}

const report = { status: 'PASS', source: mask.source, connectedCells: seen.size, totalWalkable, destinations: destinationResults, routeCenterlineSamples: WORLD_MAP_V3_PATHS.length * 42 }
await mkdir(REVIEW, { recursive: true })
await writeFile(path.join(REVIEW, 'collision-coverage-validation.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
