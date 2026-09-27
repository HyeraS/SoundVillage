import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  WORLD_MAP_V4_AUTHORED_CANDIDATES,
  WORLD_MAP_V4_OBJECT_AUTHORITY,
} from '../data/world-map-v4/worldObjects.mjs'
import {
  WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_SPATIAL_INDEX,
} from '../lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS } from '../lib/worldMapCollision.mjs'
import { WORLD_DESTINATIONS } from '../lib/worldMapGeometry.mjs'
import { WORLD_MINIMAP_DESTINATIONS } from '../lib/worldMapMinimap.mjs'
import { adaptLegacyWorldMapV4 } from './world-map/legacy-world-object-adapter.mjs'
import {
  buildProjectionSources,
  compileWorldMapObjectProjections,
} from './build-world-map-object-projections.mjs'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_ID = 'landmark-library'
const LIBRARY_PRESENTATION = Object.freeze({
  label: 'Sound Museum',
  icon: '🏛',
  color: '#C8A96E',
})
const legacySnapshot = adaptLegacyWorldMapV4()
const nativeCompiled = compileWorldMapObjectProjections()
const legacyAuthority = Object.freeze({
  ...WORLD_MAP_V4_OBJECT_AUTHORITY,
  [LIBRARY_ID]: 'legacy',
})
const legacyCompiled = compileWorldMapObjectProjections({ authorityRegistry: legacyAuthority })
const nativeSources = buildProjectionSources()
const legacySources = buildProjectionSources({ authorityRegistry: legacyAuthority })

function importedSpecifiers(file) {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1])
}

function resolveLocalImport(file, specifier) {
  if (specifier.startsWith('@/')) return resolve(REPOSITORY_ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier)
  return null
}

function importGraph(entries) {
  const pending = entries.map(entry => resolve(REPOSITORY_ROOT, entry))
  const files = new Set()
  while (pending.length > 0) {
    const file = pending.pop()
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of importedSpecifiers(file)) {
      const local = resolveLocalImport(file, specifier)
      if (local && existsSync(local) && !files.has(local)) pending.push(local)
    }
  }
  return [...files].map(file => relative(REPOSITORY_ROOT, file))
}

function selectedAuthority(compiled, id) {
  return compiled.authorityOutputs.find(entry => entry.id === id)?.authority
}

test('Library remains native alongside Home', () => {
  const entries = Object.entries(WORLD_MAP_V4_OBJECT_AUTHORITY)
  assert.equal(entries.length, 18)
  assert.deepEqual(entries.filter(([, authority]) => authority === 'native').map(([id]) => id), [LIBRARY_ID, 'landmark-home'])
  assert.equal(entries.filter(([, authority]) => authority === 'legacy').length, 16)
  assert.equal(WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-home'], 'native')
  assert.equal(selectedAuthority(nativeCompiled, LIBRARY_ID), 'native')
  assert.equal(new Set(nativeCompiled.authorityOutputs.map(entry => entry.id)).size, 18)
})

test('native and one-line authority rollback preserve flat compatibility and collision projections', () => {
  assert.equal(selectedAuthority(nativeCompiled, LIBRARY_ID), 'native')
  assert.equal(selectedAuthority(legacyCompiled, LIBRARY_ID), 'legacy')
  const { layerOverrides: nativeLayers, ...nativeCompatibility } = nativeCompiled.runtimeProjection
  const { layerOverrides: legacyLayers, ...legacyCompatibility } = legacyCompiled.runtimeProjection
  assert.deepEqual(nativeCompatibility, legacyCompatibility)
  assert.deepEqual(Object.keys(nativeLayers), [LIBRARY_ID, 'landmark-home'])
  assert.deepEqual(Object.keys(legacyLayers), ['landmark-home'])
  assert.deepEqual(nativeCompiled.collisionObjects, legacyCompiled.collisionObjects)
  assert.notEqual(nativeSources.runtimeSource, legacySources.runtimeSource)
  assert.equal(nativeSources.collisionSource, legacySources.collisionSource)
  assert.equal(nativeCompiled.authorityOutputs.filter(entry => entry.id === LIBRARY_ID).length, 1)
  assert.equal(legacyCompiled.authorityOutputs.filter(entry => entry.id === LIBRARY_ID).length, 1)
})

test('Library candidate owns every selected production field', () => {
  const candidate = WORLD_MAP_V4_AUTHORED_CANDIDATES.find(object => object.id === LIBRARY_ID)
  const render = nativeCompiled.runtimeProjection.renderObjects.find(object => object.id === LIBRARY_ID)
  const destination = nativeCompiled.runtimeProjection.destinations.Library
  const logical = nativeCompiled.runtimeProjection.logicalDestinations.find(item => item.id === 'Sound Library')
  const minimap = nativeCompiled.runtimeProjection.minimapDestinations.find(item => item.id === 'Sound Library')
  const path = nativeCompiled.runtimeProjection.guidePaths.find(item => item.id === 'spoke-library')
  const collision = nativeCompiled.collisionObjects.find(item => item.objectId === LIBRARY_ID)

  assert.deepEqual(render, {
    id: LIBRARY_ID,
    assetId: 'landmark-library',
    category: 'landmark',
    x: 1146.9613259668508,
    y: 828.7292817679557,
    width: 1544.7513812154696,
    height: 716.0220994475138,
    anchorX: 0,
    anchorY: 0,
    sortY: 1339.2265193370165,
    layer: 'gameplay',
    interaction: { type: 'museum', id: 'Library' },
    portalId: 'Sound Library',
    collision: [],
  })
  assert.deepEqual(destination, { tx: 54, ty: 37, w: 12, h: 8, approach: { x: 1918, y: 1438 } })
  assert.equal(logical.id, 'Sound Library')
  assert.deepEqual(minimap.worldPoint, { x: 1918, y: 1438 })
  assert.deepEqual(path.points, [{ x: 1920, y: 1504 }, { x: 1918, y: 1438 }])
  assert.deepEqual(collision, {
    objectId: LIBRARY_ID,
    colliderId: 'library-body',
    collisionRole: 'building-body',
    shapes: [{ type: 'rect', left: 1728, top: 1184, right: 2112, bottom: 1398 }],
  })
  assert.deepEqual(nativeCompiled.runtimeProjection.aliases[LIBRARY_ID], {
    canonicalDestinationId: 'sound-library',
    legacyIds: ['Library', 'Sound Library'],
    manifestInteractionId: 'Library',
    externalDestinationId: 'Sound Library',
  })
  assert.deepEqual(nativeCompiled.runtimeProjection.destinationPresentations['Sound Library'], LIBRARY_PRESENTATION)
  assert.deepEqual(candidate.minimap, {
    visible: true,
    point: { mode: 'from-navigation-approach' },
    ...LIBRARY_PRESENTATION,
  })
  assert.equal(candidate.compatibility.runtimeSortReferenceY, 1010)
  assert.equal(candidate.compatibility.assetBuildSemanticSortReferenceY, 1147)
  assert.deepEqual(nativeCompiled.runtimeProjection.layerOverrides[LIBRARY_ID], WORLD_MAP_V4_LAYER_OVERRIDES[LIBRARY_ID])
})

test('production projections preserve counts, identity, bounds, and twelve Library chunks', () => {
  assert.equal(nativeCompiled.runtimeProjection.renderObjects.length, 17)
  assert.equal(nativeCompiled.runtimeProjection.foreground.length, 1)
  assert.equal(Object.keys(nativeCompiled.runtimeProjection.destinations).length, 8)
  assert.equal(nativeCompiled.runtimeProjection.logicalDestinations.length, 8)
  assert.equal(nativeCompiled.runtimeProjection.guidePaths.length, 8)
  assert.equal(nativeCompiled.runtimeProjection.minimapDestinations.length, 8)
  assert.equal(nativeCompiled.collisionObjects.length, 8)
  assert.equal(WORLD_MAP_V4_SPATIAL_INDEX.size, 48)
  assert.deepEqual(
    [...WORLD_MAP_V4_SPATIAL_INDEX].filter(([, objects]) => objects.some(object => object.id === LIBRARY_ID)).map(([key]) => key),
    ['2,1', '3,1', '4,1', '5,1', '5,2', '5,3', '2,2', '3,2', '4,2', '2,3', '3,3', '4,3'],
  )
  assert.strictEqual(WORLD_MAP_V4_OBJECTS.find(object => object.id === LIBRARY_ID), WORLD_MAP_V4_OBJECTS[12])
  assert.strictEqual(WORLD_DESTINATIONS.find(destination => destination.id === 'Sound Library').target, WORLD_DESTINATIONS[6].target)
  assert.deepEqual(WORLD_MINIMAP_DESTINATIONS, nativeCompiled.runtimeProjection.minimapDestinations)
  assert.deepEqual(WORLD_MAP_V4_COLLISION_OBJECTS, nativeCompiled.collisionObjects)
})

test('Library and Home presentations have generated production authority with no JSX literal fallback', () => {
  assert.deepEqual(WORLD_MAP_V4_DESTINATION_PRESENTATIONS, {
    'Sound Library': LIBRARY_PRESENTATION,
    Home: { label: '우리 집 · 꾸미기', icon: '🏠', color: '#E98265' },
  })
  const diagram = readFileSync(resolve(REPOSITORY_ROOT, 'components/world-map/WorldMapDiagram.js'), 'utf8')
  assert.match(diagram, /WORLD_MAP_V4_DESTINATION_PRESENTATIONS\[destination\.id\]/)
  assert.doesNotMatch(diagram, /Sound Museum|🏛|#C8A96E/)
  assert.doesNotMatch(diagram, /LEGACY_LANDMARK_META|우리 집 · 꾸미기|#E98265/)
})

test('production and generated import graphs exclude build-only authority', () => {
  const productionGraph = importGraph([
    'components/world-map/WorldMapDiagram.js',
    'components/world-map/WorldMapScene.js',
  ])
  assert.ok(!productionGraph.some(file => file.startsWith('data/world-map-v4/')))
  assert.ok(!productionGraph.some(file => file.startsWith('scripts/')))
  assert.ok(!productionGraph.includes('lib/worldMapObjectSchema.mjs'))

  const generatedRuntime = readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4RuntimeObjects.mjs'), 'utf8')
  const generatedCollision = readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4CollisionObjects.mjs'), 'utf8')
  for (const source of [generatedRuntime, generatedCollision]) {
    assert.doesNotMatch(source, /\bimport\b|\brequire\s*\(|node:|provenance|sourceAssets|sourceNote|generator|crop/)
  }
  const compiler = readFileSync(resolve(REPOSITORY_ROOT, 'scripts/build-world-map-object-projections.mjs'), 'utf8')
  assert.doesNotMatch(compiler, /WorldMapDiagram|\.jsx?['"]/)
})

test('rollback changes no asset, mask, Home, or renderer input', () => {
  assert.deepEqual(
    nativeCompiled.runtimeProjection.renderObjects.find(object => object.id === 'landmark-home'),
    legacyCompiled.runtimeProjection.renderObjects.find(object => object.id === 'landmark-home'),
  )
  assert.deepEqual(
    nativeCompiled.runtimeProjection.destinations.Home,
    legacyCompiled.runtimeProjection.destinations.Home,
  )
  assert.deepEqual(legacySnapshot.destinationPresentations['Sound Library'], LIBRARY_PRESENTATION)
  assert.deepEqual(nativeCompiled.runtimeProjection.assets, legacyCompiled.runtimeProjection.assets)
  const flat = nativeCompiled.runtimeProjection.renderObjects.find(object => object.id === LIBRARY_ID)
  const layer = nativeCompiled.runtimeProjection.layerOverrides[LIBRARY_ID][0]
  assert.deepEqual(
    [layer.objectId, layer.assetId, layer.x, layer.y, layer.width, layer.height, layer.sortY, layer.layer],
    [flat.id, flat.assetId, flat.x, flat.y, flat.width, flat.height, flat.sortY, flat.layer],
  )
})
