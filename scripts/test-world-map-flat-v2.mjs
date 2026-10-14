import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  WORLD_MAP_FLAT_V2_ASSET,
  WORLD_MAP_FLAT_V2_HOME,
  WORLD_MAP_FLAT_V2_ZONE_APPROACHES,
  WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS,
} from '../lib/worldMapFlatV2.mjs'
import { WORLD_MAP_RENDER_MODE, WORLD_MAP_RENDER_MODES, resolveWorldMapRenderMode } from '../lib/worldMapMode.mjs'
import { WORLD_MAP_V4_LOGICAL_DESTINATIONS } from '../lib/worldMapV4Manifest.mjs'
import {
  WORLD_DESTINATIONS,
  WORLD_HOME,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  worldDestinationContainsFoot,
  isWorldWalkableMaskCell,
  worldPlayerTopLeftAtFoot,
} from '../lib/worldMapGeometry.mjs'
import { getWorldNavigationRoute } from '../lib/worldMapNavigation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicPath = source => path.join(ROOT, 'public', source)
assert.equal(WORLD_MAP_RENDER_MODE, WORLD_MAP_RENDER_MODES.FLAT_V2)
assert.equal(resolveWorldMapRenderMode('flat-v2'), WORLD_MAP_RENDER_MODES.FLAT_V2)
assert.equal(resolveWorldMapRenderMode('modular-v4'), WORLD_MAP_RENDER_MODES.MODULAR_V4)
assert.equal(resolveWorldMapRenderMode('unknown'), WORLD_MAP_RENDER_MODES.FLAT_V2)

const webpPath = publicPath(WORLD_MAP_FLAT_V2_ASSET.src)
const pngPath = publicPath(WORLD_MAP_FLAT_V2_ASSET.pngSrc)
const [webpInfo, pngInfo, webpStat, pngStat] = await Promise.all([
  sharp(webpPath).metadata(),
  sharp(pngPath).metadata(),
  stat(webpPath),
  stat(pngPath),
])
for (const info of [webpInfo, pngInfo]) {
  assert.equal(info.width, 1448)
  assert.equal(info.height, 1086)
  assert.equal(info.width / info.height, 4 / 3)
}
assert.equal(webpInfo.format, 'webp')
assert.equal(pngInfo.format, 'png')
assert.ok(webpStat.size < pngStat.size / 4, 'near-lossless WebP is at least 75% smaller than PNG')

assert.deepEqual(WORLD_HOME.approach, WORLD_MAP_FLAT_V2_HOME.target.approach)
assert.deepEqual(WORLD_DESTINATIONS.find(destination => destination.id === 'Home'), WORLD_MAP_FLAT_V2_HOME)
const homePosition = worldPlayerTopLeftAtFoot(WORLD_HOME.approach.x / 32, WORLD_HOME.approach.y / 32)
assert.ok(isWorldPlayerWalkable(homePosition.x, homePosition.y), 'flat-v2 Home approach is walkable')
const insideHome = worldPlayerTopLeftAtFoot(1280 / 32, 1600 / 32)
assert.equal(isWorldPlayerWalkable(insideHome.x, insideHome.y), true, 'flat-v2 landmarks do not block movement')
let blockedCells = 0
for (let y = 0; y < WORLD_WALKABLE_MASK_META.height; y += 1) {
  for (let x = 0; x < WORLD_WALKABLE_MASK_META.width; x += 1) {
    if (!isWorldWalkableMaskCell(x, y)) blockedCells += 1
  }
}
assert.equal(blockedCells, 0, 'flat-v2 has no internal collision cells')
const route = getWorldNavigationRoute('Home')
assert.deepEqual(route.authoredPoints, WORLD_MAP_FLAT_V2_HOME.guidePath)
assert.deepEqual(route.points.at(-1), WORLD_MAP_FLAT_V2_HOME.target.approach)

for (const [zone, doorApproach] of Object.entries(WORLD_MAP_FLAT_V2_ZONE_APPROACHES)) {
  const destination = WORLD_DESTINATIONS.find(candidate => candidate.id === zone)
  const originalDestination = WORLD_MAP_V4_LOGICAL_DESTINATIONS.find(candidate => candidate.id === zone)
  assert.deepEqual(destination.target.approach, doorApproach, `${zone} uses its artwork door-front approach`)
  assert.deepEqual(destination.target.markerPoint, originalDestination.target.approach, `${zone} keeps its original panel position`)
  const position = worldPlayerTopLeftAtFoot(doorApproach.x / 32, doorApproach.y / 32)
  assert.ok(isWorldPlayerWalkable(position.x, position.y), `${zone} door-front approach is walkable`)
  assert.deepEqual(getWorldNavigationRoute(zone).points.at(-1), doorApproach, `${zone} route ends at its door`)
}

const humanDestination = WORLD_DESTINATIONS.find(candidate => candidate.id === 'Human')
assert.deepEqual(humanDestination.target.interactionBounds, WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS.Human)
for (const point of [
  humanDestination.target.approach,
  { x:WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS.Human.left, y:WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS.Human.top },
  { x:WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS.Human.right, y:WORLD_MAP_FLAT_V2_ZONE_INTERACTION_BOUNDS.Human.bottom },
]) {
  const position = worldPlayerTopLeftAtFoot(point.x / 32, point.y / 32)
  assert.equal(worldDestinationContainsFoot(position, humanDestination.target), true, 'Human cafe storefront is interactive')
}
const humanMarkerPosition = worldPlayerTopLeftAtFoot(
  humanDestination.target.markerPoint.x / 32,
  humanDestination.target.markerPoint.y / 32,
)
assert.equal(worldDestinationContainsFoot(humanMarkerPosition, humanDestination.target), false, 'Human road panel stays outside the interaction region')

const [worldSource, sceneSource] = await Promise.all([
  readFile(path.join(ROOT, 'components/WorldMap.js'), 'utf8'),
  readFile(path.join(ROOT, 'components/world-map/WorldMapScene.js'), 'utf8'),
])
assert.match(worldSource, /viewBox="0 0 3840 2880"/)
assert.match(worldSource, /preserveAspectRatio="xMidYMid meet"/)
assert.doesNotMatch(worldSource, /<WorldMinimap|<WorldMapOverlay/)
assert.match(sceneSource, /data-layer="flat-background"/)
assert.match(sceneSource, /WORLD_MAP_RENDER_MODES\.FLAT_V2/)

console.log(JSON.stringify({
  status:'PASS',
  asset:{ width:webpInfo.width, height:webpInfo.height, pngBytes:pngStat.size, webpBytes:webpStat.size },
  home:{ approach:WORLD_HOME.approach, collision:WORLD_MAP_FLAT_V2_HOME.collision, routeWaypoints:route.points.length },
  zoneDoors:Object.fromEntries(Object.entries(WORLD_MAP_FLAT_V2_ZONE_APPROACHES).map(([zone, approach]) => [zone, {
    approach,
    routeWaypoints:getWorldNavigationRoute(zone).points.length,
  }])),
}, null, 2))
