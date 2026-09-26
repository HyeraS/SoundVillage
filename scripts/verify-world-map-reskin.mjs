import assert from 'node:assert/strict'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  WORLD_DESTINATIONS,
  WORLD_MAP_HEIGHT_TILES,
  WORLD_MAP_WIDTH_TILES,
  WORLD_PLAYER,
  WORLD_SPAWN,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  worldDestinationHitbox,
  worldPlayerTopLeftAtFoot,
  worldRectanglesOverlap,
} from '../lib/worldMapGeometry.mjs'

const root = process.cwd()
const source = await readFile(path.join(root, 'components/WorldMap.js'), 'utf8')
const scene = await readFile(path.join(root, 'components/world-map/WorldMapScene.js'), 'utf8')
const reviewDir = path.join(root, '_review/world-map-modular-v3')
const asset = path.join(root, 'public/assets/world/sound-archive-garden-v3/asset-manifest.json')
const maskAsset = path.join(root, 'public/assets/world/sound-archive-garden-v3/walkable-clearance-mask.png')

await access(asset)
await access(maskAsset)
assert.ok((await stat(asset)).size > 0)
assert.ok((await stat(maskAsset)).size > 0)
assert.match(source, /const MAP_W\s*=\s*WORLD_MAP_WIDTH_TILES/)
assert.match(source, /const MAP_H\s*=\s*WORLD_MAP_HEIGHT_TILES/)
assert.match(source, /const VIEW_TW = 30/)
assert.match(source, /const VIEW_TH = 22/)
assert.match(source, /process\.env\.NODE_ENV !== 'development'/)
assert.match(source, /<WorldMapScene/)
assert.doesNotMatch(source, /world-base-hd|SOUND_ARCHIVE_GARDEN_V2/)
assert.match(scene, /queryWorldMapObjects/)
assert.match(scene, /data-layer="terrain"/)
assert.match(scene, /data-layer="foreground"/)
assert.match(scene, /qa\.referenceOverlay/)
assert.match(source, /worldCollisionDebug/)
assert.doesNotMatch(source, /feConvolveMatrix/)
assert.doesNotMatch(source, /imageRendering:'crisp-edges'/)
assert.match(source, /worldQa\.overview \? 'xMidYMid meet' : 'xMidYMid slice'/)

const walkable = (tx, ty) => {
  if (tx < 0 || tx >= WORLD_MAP_WIDTH_TILES || ty < 0 || ty >= WORLD_MAP_HEIGHT_TILES) return false
  const { x, y } = worldPlayerTopLeftAtFoot(tx, ty)
  return isWorldPlayerWalkable(x, y)
}
const placement = (tx, ty) => {
  const { x, y } = worldPlayerTopLeftAtFoot(tx, ty)
  return { x, y, w: WORLD_PLAYER.width, h: WORLD_PLAYER.height }
}

const start = [WORLD_SPAWN.tx, WORLD_SPAWN.ty]
assert.ok(walkable(...start), 'spawn must be walkable for both runtime foot samples')
const queue = [start]
const seen = new Set([start.join(',')])
for (let index = 0; index < queue.length; index += 1) {
  const [x, y] = queue[index]
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    const key = `${nx},${ny}`
    if (seen.has(key) || !walkable(nx, ny)) continue
    seen.add(key)
    queue.push([nx, ny])
  }
}

const destinations = WORLD_DESTINATIONS.map(destination => {
  const hitbox = worldDestinationHitbox(destination.target)
  const approachTiles = [...seen].filter(key => {
    const [tx, ty] = key.split(',').map(Number)
    return worldRectanglesOverlap(placement(tx, ty), hitbox)
  })
  let quarterTileApproaches = 0
  for (let ty = 0; ty < WORLD_MAP_HEIGHT_TILES; ty += 0.25) {
    for (let tx = 0; tx < WORLD_MAP_WIDTH_TILES; tx += 0.25) {
      if (walkable(tx, ty) && worldRectanglesOverlap(placement(tx, ty), hitbox)) quarterTileApproaches += 1
    }
  }
  assert.ok(quarterTileApproaches >= 2, `${destination.id} needs two clearance-mask approaches`)
  return { id: destination.id, kind: destination.kind, zone: destination.zone ?? null, target: destination.target, reachableWholeTileApproaches: approachTiles.length, reachableQuarterTileApproaches: quarterTileApproaches }
})

for (const [x, y, label] of [[6, 42, 'Nature water'], [56, 43, 'library body'], [88, 12, 'north forest'], [36, 72, 'southwest garden']]) {
  assert.equal(walkable(x, y), false, `${label} unexpectedly walkable`)
}

const report = {
  map: `${WORLD_MAP_WIDTH_TILES}x${WORLD_MAP_HEIGHT_TILES}`,
  camera: '30x22',
  mask: WORLD_WALKABLE_MASK_META,
  spawn: WORLD_SPAWN,
  destinations,
  blockedSamples: ['Nature water', 'library body', 'north forest', 'southwest garden'],
  reachablePlayerFootTiles: seen.size,
  cleanCaptureFlag: 'worldClean=1 (development only)',
  status: 'PASS',
}
await mkdir(reviewDir, { recursive: true })
await writeFile(path.join(reviewDir, 'collision-portal-validation.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
