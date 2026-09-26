import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WORLD_DESTINATIONS,
  WORLD_HOME,
  WORLD_MAP_HEIGHT_TILES,
  WORLD_MAP_TILE_SIZE,
  WORLD_MAP_WIDTH_TILES,
  WORLD_MUSEUM,
  WORLD_PLAYER,
  WORLD_PORTALS,
  WORLD_SPAWN,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  worldDestinationHitbox,
  worldDestinationInteractionPoint,
  worldPlayerTopLeftAtFoot,
  worldRectanglesOverlap,
} from '../lib/worldMapGeometry.mjs'
import { WORLD_MAP_V4_ASSET_IDS, WORLD_MAP_V4_ASSETS } from '../lib/worldMapV4Assets.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW_DIR = path.join(ROOT, '_review/world-map-sequential-fix-2026-09-21/03-navigation-open-paths')
const read = relativePath => readFile(path.join(ROOT, relativePath), 'utf8')

const [pageSource, worldSource, sceneSource, actorSource, engineSource, interiorSource] = await Promise.all([
  read('app/page.js'),
  read('components/WorldMap.js'),
  read('components/world-map/WorldMapScene.js'),
  read('components/world-map/WorldMapActors.js'),
  read('components/GameEngine.js'),
  read('components/InteriorDecorRoom.js'),
])

assert.match(pageSource, /if \(screen === 'world'\)[\s\S]*?<WorldMap[\s\S]*?onEnterZone=\{handleEnterZone\}[\s\S]*?onEnterMuseum=\{handleEnterMuseum\}[\s\S]*?onEnterHouse=\{handleEnterHouse\}/)
assert.match(worldSource, /<WorldMapScene/)
assert.match(sceneSource, /queryWorldMapObjects\(camera\)/)
assert.match(sceneSource, /data-layer="depth-sorted"/)
assert.match(sceneSource, /data-layer="foreground"/)
assert.match(sceneSource, /data-source="reference-registered-panels"/)
assert.match(sceneSource, /object\.layer === 'gameplay' && \(mode === 'all' \|\| mode === 'objects'\)/)
assert.doesNotMatch(sceneSource, /WORLD_MAP_V3|sound-archive-garden-v3/)
assert.doesNotMatch(sceneSource, /<image href=\{REFERENCE_SRC\}[\s\S]{0,120}?opacity="1"/)

const zoneComponents = {
  Animal: 'AnimalZoneMap',
  Nature: 'NatureZoneMap',
  Human: 'HumanZoneMap',
  Urban: 'UrbanZoneMap',
  Music: 'MusicZoneMap',
  Lab: 'LabZoneMap',
}
for (const [zone, component] of Object.entries(zoneComponents)) {
  assert.match(pageSource, new RegExp(`import\\s+${component}\\s+from`), `${component} import`)
  assert.match(pageSource, new RegExp(`activeZone === '${zone}'[\\s\\S]{0,180}?<${component}`), `${zone} renders ${component}`)
  assert.match(pageSource, new RegExp(`<${component}[\\s\\S]{0,500}?onExit=\\{handleExitZone\\}`), `${component} returns to world`)
}
assert.match(pageSource, /if \(screen === 'museum'\)[\s\S]*?<SoundMuseum[\s\S]*?onExit=\{handleMuseumExit\}/)
assert.match(pageSource, /if \(screen === 'house'\)[\s\S]*?<InteriorDecorRoom[\s\S]*?onExit=\{handleExitHouse\}/)
assert.match(pageSource, /const ZONES_LOCKED_AT_START = ZONES\.filter\(z => z !== FIRST_ZONE\)/)
assert.match(pageSource, /const TEMPORARILY_UNLOCK_ALL_ZONES = true/)
assert.match(pageSource, /activeZone === FIRST_ZONE && currentBlock === 1 && allDone && !villagesUnlocked/)
assert.match(pageSource, /const allZonesUnlocked = !worldLockQaEnabled && \([\s\S]{0,180}?TEMPORARILY_UNLOCK_ALL_ZONES/)
assert.match(pageSource, /lockedZones=\{allZonesUnlocked \? \[\] : ZONES_LOCKED_AT_START\}/)

assert.match(pageSource, /process\.env\.NODE_ENV === 'development'[\s\S]{0,260}?worldOverview/)
assert.match(pageSource, /process\.env\.NODE_ENV === 'development' && query\.get\('natureQa'\) === '1'/)
assert.match(pageSource, /process\.env\.NODE_ENV === 'development' && query\.get\('worldLockQa'\) === '1'/)
assert.match(worldSource, /process\.env\.NODE_ENV !== 'development'[\s\S]{0,220}?collisionDebug\s*:\s*false/)
for (const queryName of ['worldClean', 'worldCapture', 'worldOverview', 'worldStart', 'worldCollisionDebug', 'worldReferenceOverlay', 'worldLayer', 'natureQa']) {
  assert.ok(pageSource.includes(queryName) || worldSource.includes(queryName), `${queryName} remains auditable`)
}

assert.match(worldSource, /data-testid="world-map" data-current-screen="world"/)
assert.match(worldSource, /data-testid="world-player"/)
assert.match(actorSource, /data-testid=\{`world-portal-\$\{portal\.zone\.toLowerCase\(\)\}`\}/)
assert.match(actorSource, /data-testid=\{isHome \? 'world-home' : 'world-museum'\}/)
assert.match(worldSource, /activateNearbyDestination\('keyboard'\)/)
assert.match(worldSource, /activateNearbyDestination\('touch'\)/)
assert.match(worldSource, /e\.key === 'Enter' \|\| e\.key === ' '/)
assert.match(worldSource, /<WorldMapHUD[\s\S]{0,260}?onOpenHome=\{onEnterHouse\}/)
assert.match(await read('components/world-map/WorldMapUI.js'), /ariaLabel="우리 집 꾸미기 열기"[\s\S]{0,120}?onClick=\{onOpenHome\}/)
assert.match(engineSource, /ArrowUp: 'up'[\s\S]*w: 'up'/)
assert.match(interiorSource, /\.catch\(\(error\) => \{[\s\S]{0,900}?setLoadError\(true\)[\s\S]{0,120}?setLoaded\(true\)/)
assert.match(interiorSource, /data-room-load-state=\{loadError \? 'fallback' : 'loaded'\}/)
assert.match(interiorSource, /disabled=\{loadError\} onClick=\{startEdit\}/)

const runtimeAssets = [
  ...WORLD_MAP_V4_ASSET_IDS.map(assetId => `public${WORLD_MAP_V4_ASSETS[assetId].src}`),
  'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png',
  'public/assets/world/sound-archive-garden-v4/obstacle-mask.png',
  'public/assets/world/sound-archive-garden-v4/collision-debug.png',
  'public/assets/world/player_body.png',
  'public/assets/world/player_clothes.png',
  'public/assets/world/player_hair.png',
  'public/assets/world/outfits/overalls.png',
  'public/assets/world/outfits/suit.png',
  'public/assets/world/outfits/sailor.png',
  'public/assets/world/outfits/sporty.png',
  'public/assets/world/outfits/witch.png',
]
const assetResults = []
for (const asset of runtimeAssets) {
  const info = await stat(path.join(ROOT, asset))
  assert.ok(info.isFile() && info.size > 0, `${asset} exists and is non-empty`)
  assetResults.push({ asset, bytes: info.size })
}

const portalZones = WORLD_PORTALS.map(portal => portal.zone)
assert.deepEqual(portalZones, ['Lab', 'Animal', 'Urban', 'Music', 'Human', 'Nature'])
for (const destination of WORLD_DESTINATIONS) {
  const { target } = destination
  assert.ok(target.tx >= 0 && target.ty >= 0, `${destination.id} starts inside map`)
  assert.ok(target.tx + target.w <= WORLD_MAP_WIDTH_TILES, `${destination.id} width stays inside map`)
  assert.ok(target.ty + target.h <= WORLD_MAP_HEIGHT_TILES, `${destination.id} height stays inside map`)
  const interaction = worldDestinationInteractionPoint(target)
  assert.ok(isWorldPlayerWalkable(...Object.values(worldPlayerTopLeftAtFoot(interaction.x / WORLD_MAP_TILE_SIZE, interaction.y / WORLD_MAP_TILE_SIZE))), `${destination.id} interaction point is walkable`)
}
for (let i = 0; i < WORLD_DESTINATIONS.length; i += 1) {
  for (let j = i + 1; j < WORLD_DESTINATIONS.length; j += 1) {
    const a = WORLD_DESTINATIONS[i]
    const b = WORLD_DESTINATIONS[j]
    assert.equal(
      worldRectanglesOverlap(worldDestinationHitbox(a.target), worldDestinationHitbox(b.target)),
      false,
      `${a.id} and ${b.id} interaction hitboxes do not overlap`,
    )
  }
}

const placementAt = (tx, ty) => {
  const topLeft = worldPlayerTopLeftAtFoot(tx, ty)
  return { x: topLeft.x, y: topLeft.y, w: WORLD_PLAYER.width, h: WORLD_PLAYER.height }
}
const walkable = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= WORLD_MAP_WIDTH_TILES || ty >= WORLD_MAP_HEIGHT_TILES) return false
  const topLeft = worldPlayerTopLeftAtFoot(tx, ty)
  return isWorldPlayerWalkable(topLeft.x, topLeft.y)
}

assert.ok(walkable(WORLD_SPAWN.tx, WORLD_SPAWN.ty), 'default spawn is walkable with the runtime foot samples')

// 회귀 검증: 중앙 광장 오른쪽의 눈에 보이는 곡선 길은 광장과 외곽 순환로를
// 실제로 이어야 한다. 이 지점은 과거 광장 타원 끝에서 충돌선이 끊겨 보이지 않는
// 벽처럼 막혔던 사용자 재현 경로다.
for (const [tx, ty] of [
  [60, 47], [83.5625, 39.5625], [37.0625, 40.0625], [16.4375, 41.0625],
  [103.3125, 43.8125], [92.9375, 61.6875], [24.4375, 70.0625],
]) {
  assert.ok(walkable(tx, ty), `v4 reference road stays walkable at ${tx},${ty}`)
}

const startKey = `${WORLD_SPAWN.tx},${WORLD_SPAWN.ty}`
const queue = [[WORLD_SPAWN.tx, WORLD_SPAWN.ty]]
const seen = new Set([startKey])
const parent = new Map()
const distance = new Map([[startKey, 0]])
for (let index = 0; index < queue.length; index += 1) {
  const [tx, ty] = queue[index]
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = tx + dx
    const ny = ty + dy
    const key = `${nx},${ny}`
    if (seen.has(key) || !walkable(nx, ny)) continue
    seen.add(key)
    parent.set(key, `${tx},${ty}`)
    distance.set(key, distance.get(`${tx},${ty}`) + 1)
    queue.push([nx, ny])
  }
}

function pathTo(key) {
  const pathTiles = []
  let current = key
  while (current) {
    const [tx, ty] = current.split(',').map(Number)
    pathTiles.push({ tx, ty })
    current = parent.get(current)
  }
  return pathTiles.reverse()
}

const CONTINUOUS_STEP = 0.25
const fineColumns = Math.round(WORLD_MAP_WIDTH_TILES / CONTINUOUS_STEP)
const fineRows = Math.round(WORLD_MAP_HEIGHT_TILES / CONTINUOUS_STEP)
const fineIndex = (gx, gy) => gy * fineColumns + gx
const fineSeen = new Uint8Array(fineColumns * fineRows)
const fineParent = new Int32Array(fineColumns * fineRows)
fineParent.fill(-1)
const fineQueueX = new Int16Array(fineColumns * fineRows)
const fineQueueY = new Int16Array(fineColumns * fineRows)
const fineStartX = Math.round(WORLD_SPAWN.tx / CONTINUOUS_STEP)
const fineStartY = Math.round(WORLD_SPAWN.ty / CONTINUOUS_STEP)
const fineStart = fineIndex(fineStartX, fineStartY)
fineSeen[fineStart] = 1
fineQueueX[0] = fineStartX
fineQueueY[0] = fineStartY
let fineHead = 0
let fineTail = 1
const fineDestinationEnds = new Map(WORLD_DESTINATIONS.map(destination => [destination.id, -1]))
const finePlacement = (gx, gy) => placementAt(gx * CONTINUOUS_STEP, gy * CONTINUOUS_STEP)
while (fineHead < fineTail && [...fineDestinationEnds.values()].some(value => value < 0)) {
  const gx = fineQueueX[fineHead]
  const gy = fineQueueY[fineHead]
  const currentIndex = fineIndex(gx, gy)
  fineHead += 1
  for (const destination of WORLD_DESTINATIONS) {
    if (fineDestinationEnds.get(destination.id) >= 0) continue
    if (worldRectanglesOverlap(finePlacement(gx, gy), worldDestinationHitbox(destination.target))) {
      fineDestinationEnds.set(destination.id, currentIndex)
    }
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = gx + dx
    const ny = gy + dy
    if (nx < 0 || ny < 0 || nx >= fineColumns || ny >= fineRows) continue
    const nextIndex = fineIndex(nx, ny)
    if (fineSeen[nextIndex]) continue
    const tx = nx * CONTINUOUS_STEP
    const ty = ny * CONTINUOUS_STEP
    const topLeft = worldPlayerTopLeftAtFoot(tx, ty)
    if (!isWorldPlayerWalkable(topLeft.x, topLeft.y)) continue
    const midpoint = worldPlayerTopLeftAtFoot((gx + nx) * CONTINUOUS_STEP / 2, (gy + ny) * CONTINUOUS_STEP / 2)
    if (!isWorldPlayerWalkable(midpoint.x, midpoint.y)) continue
    fineSeen[nextIndex] = 1
    fineParent[nextIndex] = currentIndex
    fineQueueX[fineTail] = nx
    fineQueueY[fineTail] = ny
    fineTail += 1
  }
}

function finePathTo(endIndex) {
  const pathPoints = []
  let current = endIndex
  while (current >= 0) {
    const gy = Math.floor(current / fineColumns)
    const gx = current - gy * fineColumns
    pathPoints.push({ tx: gx * CONTINUOUS_STEP, ty: gy * CONTINUOUS_STEP })
    current = fineParent[current]
  }
  return pathPoints.reverse()
}

const routes = {}
for (const destination of WORLD_DESTINATIONS) {
  const hitbox = worldDestinationHitbox(destination.target)
  const approaches = [...seen]
    .filter(key => {
      const [tx, ty] = key.split(',').map(Number)
      return worldRectanglesOverlap(placementAt(tx, ty), hitbox)
    })
    .sort((a, b) => distance.get(a) - distance.get(b))
  const tilePath = approaches.length ? pathTo(approaches[0]) : []
  assert.ok(tilePath.every(({ tx, ty }) => walkable(tx, ty)), `${destination.id} tile path matches runtime player-foot collision`)
  const fineEnd = fineDestinationEnds.get(destination.id)
  assert.ok(fineEnd >= 0, `${destination.id} has a continuous quarter-tile route`)
  const continuousPath = finePathTo(fineEnd)
  assert.ok(continuousPath.every(({ tx, ty }) => walkable(tx, ty)), `${destination.id} continuous route matches runtime player-foot collision`)
  for (let index = 1; index < continuousPath.length; index += 1) {
    const previous = continuousPath[index - 1]
    const current = continuousPath[index]
    assert.ok(
      walkable((previous.tx + current.tx) / 2, (previous.ty + current.ty) / 2),
      `${destination.id} continuous route edge ${index} has no sub-tile gap`,
    )
  }
  routes[destination.id] = {
    kind: destination.kind,
    zone: destination.zone ?? null,
    destination: destination.target,
    approachTiles: approaches.slice(0, 8).map(key => {
      const [tx, ty] = key.split(',').map(Number)
      return { tx, ty }
    }),
    tilePathLength: tilePath.length,
    tilePath,
    pathLength: continuousPath.length,
    pathStepTiles: CONTINUOUS_STEP,
    path: continuousPath,
    playerFootSamplesVerified: true,
  }
}

for (const [tx, ty, label] of [[6, 42, 'Nature water'], [88, 12, 'north forest'], [36, 72, 'southwest garden'], [87, 72, 'central garden arch']]) {
  assert.equal(walkable(tx, ty), true, `${label} remains open for the runtime player foot`)
}
for (const [tx, ty, label] of [[55.5, 43, 'library body'], [100.5, 70.5, 'music building body']]) {
  assert.equal(walkable(tx, ty), false, `${label} remains blocked for the runtime player foot`)
}

await mkdir(REVIEW_DIR, { recursive: true })
const result = {
  status: 'PASS',
  map: { widthTiles: WORLD_MAP_WIDTH_TILES, heightTiles: WORLD_MAP_HEIGHT_TILES, tileSize: WORLD_MAP_TILE_SIZE, mask: WORLD_WALKABLE_MASK_META },
  spawn: WORLD_SPAWN,
  reachablePlayerFootTiles: seen.size,
  zoneComponents,
  landmarks: { museum: WORLD_MUSEUM, home: WORLD_HOME },
  routes,
  assets: assetResults,
  productionQueryGate: 'development-only',
  inputParity: ['Enter', 'Space', 'mobile confirm'],
}
await writeFile(path.join(REVIEW_DIR, 'portal-route-results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  status: result.status,
  reachablePlayerFootTiles: result.reachablePlayerFootTiles,
  routes: Object.fromEntries(Object.entries(routes).map(([id, route]) => [id, { pathLength: route.pathLength, approachTiles: route.approachTiles.length }])),
  assets: assetResults.length,
}, null, 2))
