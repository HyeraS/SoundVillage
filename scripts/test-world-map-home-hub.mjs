import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateWorldCamera, WORLD_CAMERA_HUD_HEIGHT } from '../lib/worldMapCamera.mjs'
import {
  WORLD_HOME,
  WORLD_MAP_HEIGHT_PX,
  WORLD_MAP_TILE_SIZE,
  WORLD_MAP_WIDTH_PX,
  WORLD_PLAYER,
  WORLD_SPAWN,
  isWorldPlayerWalkable,
  worldDestinationInteractionPoint,
  worldPlayerTopLeftAtFoot,
} from '../lib/worldMapGeometry.mjs'
import { getWorldNavigationRoute } from '../lib/worldMapNavigation.mjs'
import { WORLD_MINIMAP_DESTINATIONS } from '../lib/worldMapMinimap.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS, WORLD_MAP_V4_DESTINATIONS, WORLD_MAP_V4_LAYER_OVERRIDES, WORLD_MAP_V4_OBJECTS, objectBounds, queryWorldMapObjects } from '../lib/worldMapV4Manifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const spawn = { x: WORLD_SPAWN.tx * WORLD_MAP_TILE_SIZE, y: WORLD_SPAWN.ty * WORLD_MAP_TILE_SIZE }
const approach = worldDestinationInteractionPoint(WORLD_HOME)
const straightTiles = Math.hypot(approach.x - spawn.x, approach.y - spawn.y) / WORLD_MAP_TILE_SIZE
const route = getWorldNavigationRoute('Home')
const routeTiles = route.points.slice(1).reduce((sum, point, index) => {
  const previous = route.points[index]
  return sum + Math.hypot(point.x - previous.x, point.y - previous.y)
}, 0) / WORLD_MAP_TILE_SIZE

assert.ok(straightTiles >= 10 && straightTiles <= 14, `straight home distance ${straightTiles.toFixed(2)} is 10–14 tiles`)
assert.ok(routeTiles >= 10 && routeTiles <= 14.05, `walkable home route ${routeTiles.toFixed(2)} is 10–14 tiles`)
assert.deepEqual(WORLD_MAP_V4_DESTINATIONS.Home, WORLD_HOME)
assert.deepEqual(WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Home').worldPoint, approach)

const approachPosition = worldPlayerTopLeftAtFoot(approach.x / WORLD_MAP_TILE_SIZE, approach.y / WORLD_MAP_TILE_SIZE)
assert.equal(isWorldPlayerWalkable(approachPosition.x, approachPosition.y), true, 'front step is walkable')

const homeObject = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-home')
const guesthouse = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-guesthouse')
const homeCollider = WORLD_MAP_V4_COLLISION_OBJECTS.find(collider => collider.objectId === 'landmark-home')
const homeShape = homeCollider.shapes[0]
const homeLayers = WORLD_MAP_V4_LAYER_OVERRIDES['landmark-home']
assert.equal(homeObject.layer, 'gameplay')
assert.equal(homeObject.assetId, 'landmark-home-player-building')
assert.deepEqual(objectBounds(homeObject), { left:1344, top:1344, right:1856, bottom:1824 })
assert.equal(homeObject.sortY, 1696)
assert.deepEqual(homeLayers.map(layer => [layer.layerId, layer.assetId, layer.renderBand, layer.x, layer.y, layer.width, layer.height, layer.sortY]), [
  ['site-ground', 'landmark-home-player-site-ground', 'ground', 1344, 1344, 512, 480, 1695],
  ['body', 'landmark-home-player-building', 'world', 1472, 1395, 352, 301, 1696],
])
assert.equal(guesthouse.interaction, null)
assert.deepEqual(homeShape, { type:'rect', left:1520, top:1472, right:1776, bottom:1696 })
assert.ok(approach.y - homeShape.bottom >= 40, 'front step keeps a gathering apron')

for (const viewport of [{ width:1440, height:900 }, { width:390, height:844 }]) {
  const player = worldPlayerTopLeftAtFoot(WORLD_SPAWN.tx, WORLD_SPAWN.ty)
  const camera = calculateWorldCamera({
    focusX:player.x + WORLD_PLAYER.width / 2,
    focusY:player.y + WORLD_PLAYER.height / 2,
    viewportWidth:viewport.width,
    viewportHeight:viewport.height,
    hudHeight:WORLD_CAMERA_HUD_HEIGHT,
    worldWidth:WORLD_MAP_WIDTH_PX,
    worldHeight:WORLD_MAP_HEIGHT_PX,
  })
  const bounds = objectBounds(homeObject)
  assert.ok(bounds.right >= camera.x && bounds.left <= camera.x + camera.width && bounds.bottom >= camera.y && bounds.top <= camera.y + camera.height, `home silhouette is visible at spawn on ${viewport.width}x${viewport.height}`)
  assert.ok(queryWorldMapObjects(camera).objects.some(object => object.id === 'landmark-home'), `home survives culling on ${viewport.width}x${viewport.height}`)
}

const sceneSource = await readFile(path.join(ROOT, 'components/world-map/WorldMapScene.js'), 'utf8')
assert.match(sceneSource, /planWorldMapRenderLayers\(\{/)
assert.match(sceneSource, /layerOverrides: WORLD_MAP_V4_LAYER_OVERRIDES/)
assert.match(sceneSource, /data-render-band=/)

console.log(JSON.stringify({
  status:'PASS',
  spawn:WORLD_SPAWN,
  home:WORLD_HOME,
  straightDistanceTiles:Number(straightTiles.toFixed(3)),
  walkableRouteDistanceTiles:Number(routeTiles.toFixed(3)),
  homeObject:{ id:homeObject.id, assetId:homeObject.assetId, layer:homeObject.layer, bounds:objectBounds(homeObject), sortY:homeObject.sortY },
  homeCollider,
  minimap:WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Home').worldPoint,
}, null, 2))
