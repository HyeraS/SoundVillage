import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  WORLD_MAP_V4_AUTHORED_CANDIDATES,
  WORLD_MAP_V4_OBJECT_AUTHORITY,
} from '../data/world-map-v4/worldObjects.mjs'
import {
  WORLD_MAP_V4_DESTINATIONS,
  WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_MINIMAP_DESTINATIONS,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_PATHS,
} from '../lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS } from '../lib/worldMapCollision.mjs'
import { validateWorldObject } from '../lib/worldMapObjectSchema.mjs'
import { planWorldMapRenderLayers } from '../lib/worldMapRenderLayers.mjs'
import {
  assertDeterministicSources,
  buildProjectionSources,
  checkProjectionFiles,
  compileWorldMapObjectProjections,
  writeProjectionFiles,
} from './build-world-map-object-projections.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME_ID = 'landmark-home'
const home = WORLD_MAP_V4_AUTHORED_CANDIDATES.find(object => object.id === HOME_ID)
const compiled = compileWorldMapObjectProjections()
const runtimeHome = WORLD_MAP_V4_OBJECTS.find(object => object.id === HOME_ID)
const layers = WORLD_MAP_V4_LAYER_OVERRIDES[HOME_ID]
const collision = WORLD_MAP_V4_COLLISION_OBJECTS.filter(object => object.objectId === HOME_ID)

function importedSpecifiers(file) {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1])
}

function importGraph(entries) {
  const pending = entries.map(entry => resolve(ROOT, entry))
  const files = new Set()
  const externals = new Set()
  while (pending.length > 0) {
    const file = pending.pop()
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of importedSpecifiers(file)) {
      const local = specifier.startsWith('@/')
        ? resolve(ROOT, specifier.slice(2))
        : specifier.startsWith('.')
          ? resolve(dirname(file), specifier)
          : null
      if (local && existsSync(local) && !files.has(local)) pending.push(local)
      if (!local) externals.add(specifier)
    }
  }
  return { files: [...files].map(file => relative(ROOT, file)), externals: [...externals] }
}

test('Home and Library are the only native authorities', () => {
  const native = Object.entries(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(([, authority]) => authority === 'native').map(([id]) => id)
  assert.deepEqual(native, ['landmark-library', HOME_ID])
  assert.equal(Object.keys(WORLD_MAP_V4_OBJECT_AUTHORITY).length, 18)
  assert.equal(Object.values(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(authority => authority === 'legacy').length, 16)
  assert.deepEqual(Object.keys(WORLD_MAP_V4_LAYER_OVERRIDES), ['landmark-library', HOME_ID])
})

test('Home native schema, two layers, union bounds, and primary body projection are exact', () => {
  assert.equal(validateWorldObject(home, { profile:'native' }), home)
  assert.deepEqual(runtimeHome, {
    id:HOME_ID,
    assetId:'landmark-home-player-building',
    category:'landmark',
    x:1344,
    y:1344,
    width:512,
    height:480,
    anchorX:0,
    anchorY:0,
    sortY:1696,
    layer:'gameplay',
    interaction:{ type:'home', id:'Home' },
    portalId:'Home',
    collision:[],
  })
  assert.equal(home.compatibility.primaryVisualLayerId, 'body')
  assert.deepEqual(layers.map(layer => ({
    id:layer.layerId, role:layer.role, band:layer.renderBand, assetId:layer.assetId,
    rect:[layer.x, layer.y, layer.x + layer.width, layer.y + layer.height], sortY:layer.sortY,
  })), [{
    id:'site-ground', role:'ground', band:'ground', assetId:'landmark-home-player-site-ground',
    rect:[1344,1344,1856,1824], sortY:1695,
  }, {
    id:'body', role:'body', band:'world', assetId:'landmark-home-player-building',
    rect:[1472,1395,1824,1696], sortY:1696,
  }])
  assert.equal(layers.some(layer => ['foreground', 'overlay'].includes(layer.renderBand)), false)
})

test('planner suppresses Home flat fallback and emits one ground plus one body item', () => {
  const plan = planWorldMapRenderLayers({
    objects:[runtimeHome],
    layerOverrides:{ [HOME_ID]:layers },
    view:{ x:0, y:0, width:3840, height:2880 },
    margin:0,
  })
  assert.deepEqual(plan.ground.map(entry => entry.layerId), ['site-ground'])
  assert.deepEqual(plan.world.map(entry => entry.layerId), ['body'])
  assert.equal(plan.metrics.fallbackItemCount, 0)
  assert.equal(plan.metrics.overrideItemCount, 2)
  assert.equal([...plan.ground, ...plan.world].some(entry => entry.layerId === 'legacy-flat'), false)
  assert.equal(plan.foreground.length, 0)
  assert.equal(plan.overlay.length, 0)
})

test('Home collision, interaction, destination, minimap, presentation, and guide endpoint are exact', () => {
  assert.deepEqual(collision, [{
    objectId:HOME_ID,
    colliderId:'home-body',
    collisionRole:'building-body',
    shapes:[{ type:'rect', left:1520, top:1472, right:1776, bottom:1696 }],
  }])
  assert.deepEqual(WORLD_MAP_V4_DESTINATIONS.Home, { tx:47, ty:46, w:9, h:7, approach:{ x:1648, y:1760 } })
  assert.deepEqual(WORLD_MAP_V4_MINIMAP_DESTINATIONS.find(item => item.id === 'Home').worldPoint, { x:1648, y:1760 })
  assert.deepEqual(WORLD_MAP_V4_DESTINATION_PRESENTATIONS.Home, { label:'우리 집 · 꾸미기', icon:'🏠', color:'#E98265' })
  assert.deepEqual(WORLD_MAP_V4_PATHS.find(path => path.id === 'spoke-home').points.at(-1), { x:1648, y:1760 })
})

test('test-only Home legacy rollback restores render, collision, destination, minimap, path, and presentation', () => {
  const rollback = compileWorldMapObjectProjections({
    authorityRegistry:{ ...WORLD_MAP_V4_OBJECT_AUTHORITY, [HOME_ID]:'legacy' },
  })
  const legacyHome = rollback.runtimeProjection.renderObjects.find(object => object.id === HOME_ID)
  assert.deepEqual(legacyHome, {
    id:HOME_ID, assetId:'landmark-home-hub', category:'landmark', x:1440, y:1368,
    width:448, height:384, anchorX:0, anchorY:0, sortY:1752, layer:'gameplay',
    interaction:{ type:'home', id:'Home' }, portalId:'Home', collision:[],
  })
  assert.deepEqual(rollback.collisionObjects.find(object => object.objectId === HOME_ID).shapes[0], { type:'rect', left:1536, top:1472, right:1792, bottom:1752 })
  assert.deepEqual(rollback.runtimeProjection.destinations.Home, { tx:48, ty:46, w:8, h:9, approach:{ x:1664, y:1792 } })
  assert.deepEqual(rollback.runtimeProjection.minimapDestinations.find(item => item.id === 'Home').worldPoint, { x:1664, y:1792 })
  assert.deepEqual(rollback.runtimeProjection.guidePaths.find(path => path.id === 'spoke-home').points.at(-1), { x:1664, y:1792 })
  assert.equal(rollback.runtimeProjection.destinationPresentations.Home, undefined)
  assert.equal(Object.hasOwn(rollback.runtimeProjection.layerOverrides, HOME_ID), false)
})

test('projection generation is deterministic and stale checks recover after regeneration', () => {
  assertDeterministicSources(buildProjectionSources(), buildProjectionSources())
  const directory = mkdtempSync(resolve(tmpdir(), 'world-map-home-pilot-'))
  const runtimeOutput = resolve(directory, 'runtime.mjs')
  const collisionOutput = resolve(directory, 'collision.mjs')
  try {
    writeProjectionFiles({ runtimeOutput, collisionOutput })
    checkProjectionFiles({ runtimeOutput, collisionOutput })
    appendFileSync(runtimeOutput, '\n// stale\n')
    assert.throws(() => checkProjectionFiles({ runtimeOutput, collisionOutput }), /stale/)
    writeProjectionFiles({ runtimeOutput, collisionOutput })
    assert.doesNotThrow(() => checkProjectionFiles({ runtimeOutput, collisionOutput }))
  } finally {
    rmSync(directory, { recursive:true, force:true })
  }
})

test('client graph excludes authored, compiler, schema, Node, and source PNG paths', () => {
  const graph = importGraph(['components/WorldMap.js', 'components/world-map/WorldMapScene.js', 'components/world-map/WorldMapDiagram.js'])
  assert.ok(!graph.files.some(file => file.startsWith('data/world-map-v4/') || file.startsWith('scripts/') || file === 'lib/worldMapObjectSchema.mjs'))
  assert.ok(!graph.externals.some(specifier => specifier.startsWith('node:')))
  const generated = readFileSync(resolve(ROOT, 'lib/generated/worldMapV4RuntimeObjects.mjs'), 'utf8')
  assert.doesNotMatch(generated, /design\/world-map-v4|candidate-b|sourceAssets|provenance/)
  assert.deepEqual(compiled.runtimeProjection.layerOverrides[HOME_ID], layers)
})
