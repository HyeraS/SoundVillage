import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { WORLD_MAP_FLAT_V2_ASSET, WORLD_MAP_FLAT_V2_HOME } from '../lib/worldMapFlatV2.mjs'
import { WORLD_MAP_RENDER_MODE, WORLD_MAP_RENDER_MODES, resolveWorldMapRenderMode } from '../lib/worldMapMode.mjs'
import {
  WORLD_DESTINATIONS,
  WORLD_HOME,
  isWorldPlayerWalkable,
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
const blockedInsideHome = worldPlayerTopLeftAtFoot(1280 / 32, 1600 / 32)
assert.equal(isWorldPlayerWalkable(blockedInsideHome.x, blockedInsideHome.y), false, 'flat-v2 Home body blocks movement')
const route = getWorldNavigationRoute('Home')
assert.deepEqual(route.authoredPoints, WORLD_MAP_FLAT_V2_HOME.guidePath)
assert.deepEqual(route.points.at(-1), WORLD_MAP_FLAT_V2_HOME.target.approach)

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
}, null, 2))

