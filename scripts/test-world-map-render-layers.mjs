import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_OBJECTS,
} from '../lib/worldMapV4Manifest.mjs'
import { planWorldMapRenderLayers, WORLD_MAP_RENDER_BAND_ORDER } from '../lib/worldMapRenderLayers.mjs'
import { WORLD_MAP_V4_OBJECT_AUTHORITY } from '../data/world-map-v4/worldObjects.mjs'

const libraryObject = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-library')
const homeObject = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-home')
const libraryLayers = WORLD_MAP_V4_LAYER_OVERRIDES['landmark-library']
const homeLayers = WORLD_MAP_V4_LAYER_OVERRIDES['landmark-home']
const fullView = { x: 0, y: 0, width: WORLD_MAP_V4.width, height: WORLD_MAP_V4.height }

assert.equal(Object.values(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(value => value === 'native').length, 2)
assert.equal(Object.values(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(value => value === 'legacy').length, 16)
assert.equal(WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-library'], 'native')
assert.equal(WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-home'], 'native')
assert.deepEqual(Object.keys(WORLD_MAP_V4_LAYER_OVERRIDES), ['landmark-library', 'landmark-home'])
assert.equal(libraryLayers.length, 1)
assert.deepEqual(libraryLayers[0], {
  objectId: 'landmark-library',
  layerId: 'body',
  role: 'body',
  renderBand: 'world',
  assetId: 'landmark-library',
  x: 1146.9613259668508,
  y: 828.7292817679557,
  width: 1544.7513812154696,
  height: 716.0220994475138,
  sortY: 1339.2265193370165,
  sortOffsetY: 0,
  visibleWhen: null,
  layer: 'gameplay',
})
assert.equal(homeLayers.length, 2)
assert.deepEqual(homeObject, {
  id: 'landmark-home',
  assetId: 'landmark-home-player-building',
  category: 'landmark',
  x: 1344,
  y: 1344,
  width: 512,
  height: 480,
  anchorX: 0,
  anchorY: 0,
  sortY: 1696,
  layer: 'gameplay',
  interaction: { type: 'home', id: 'Home' },
  portalId: 'Home',
  collision: [],
})

const plan = planWorldMapRenderLayers({
  objects: WORLD_MAP_V4_OBJECTS,
  layerOverrides: WORLD_MAP_V4_LAYER_OVERRIDES,
  view: fullView,
  margin: 0,
})
assert.deepEqual(plan.ground.map(entry => entry.item.layerId), ['site-ground'])
assert.equal(plan.foreground.length, 0)
assert.equal(plan.overlay.length, 0)
assert.equal(plan.world.filter(entry => entry.type === 'object-layer').length, 8)
assert.equal(plan.world.filter(entry => entry.item?.objectId === 'landmark-library').length, 1)
assert.equal(plan.world.find(entry => entry.item?.objectId === 'landmark-library').item.source, 'override')
assert.equal(plan.world.find(entry => entry.item?.objectId === 'landmark-home').item.source, 'override')
assert.equal(plan.world.filter(entry => entry.item?.objectId === 'landmark-home').length, 1)
assert.equal(plan.world.some(entry => entry.item?.objectId === 'landmark-home' && entry.item.layerId === 'legacy-flat'), false)
assert.deepEqual(WORLD_MAP_RENDER_BAND_ORDER, [
  'terrain', 'environment', 'ground', 'world', 'object-foreground', 'global-foreground', 'overlay', 'interaction-debug',
])

const sceneSource = readFileSync(new URL('../components/world-map/WorldMapScene.js', import.meta.url), 'utf8')
const orderTokens = [
  'data-layer="object-ground"',
  'data-layer="depth-sorted"',
  'data-layer="object-foreground"',
  'data-layer="foreground"',
  'data-layer="object-overlay"',
  '{interactionLayer}',
  'WorldMapDebugOverlay',
]
let previousIndex = -1
for (const token of orderTokens) {
  const index = sceneSource.indexOf(token, previousIndex + 1)
  assert.ok(index > previousIndex, `Expected ${token} after the previous render band`)
  previousIndex = index
}
assert.match(sceneSource, /data-object-id=\{item\.objectId\}/)
assert.match(sceneSource, /data-asset-id=\{item\.assetId\}/)
assert.match(sceneSource, /data-layer=\{item\.layer\}/)
assert.match(sceneSource, /data-layer-id=\{item\.source === 'override' \? item\.layerId : undefined\}/)
assert.match(sceneSource, /data-render-band=\{item\.source === 'override' \? item\.renderBand : undefined\}/)
const renderLayerSource = sceneSource.slice(
  sceneSource.indexOf('function WorldRenderLayer'),
  sceneSource.indexOf('export function WorldMapDebugOverlay'),
)
assert.doesNotMatch(renderLayerSource, /return <g/)

assert.equal(libraryObject.assetId, libraryLayers[0].assetId)
assert.equal(libraryObject.x, libraryLayers[0].x)
assert.equal(libraryObject.y, libraryLayers[0].y)
assert.equal(libraryObject.width, libraryLayers[0].width)
assert.equal(libraryObject.height, libraryLayers[0].height)
assert.equal(libraryObject.sortY, libraryLayers[0].sortY)

console.log('World map render-layer integration checks passed.')
