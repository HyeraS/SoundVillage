import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_ALIASES,
  WORLD_MAP_V4_ASSET_MANIFEST,
  WORLD_MAP_V4_DESTINATIONS,
  WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
  WORLD_MAP_V4_FOREGROUND,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_LOGICAL_DESTINATIONS,
  WORLD_MAP_V4_MINIMAP_DESTINATIONS,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_PATHS,
  WORLD_MAP_V4_SPATIAL_INDEX,
  WORLD_MAP_V4_TERRAIN_PANELS,
  createWorldMapSpatialIndex,
  objectBounds,
} from '../lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS as CURRENT_COLLISION_OBJECTS } from '../lib/worldMapCollision.mjs'
import {
  WORLD_DESTINATIONS,
  WORLD_HOME,
  WORLD_MUSEUM,
  WORLD_PORTALS,
} from '../lib/worldMapGeometry.mjs'
import { WORLD_MINIMAP_DESTINATIONS } from '../lib/worldMapMinimap.mjs'
import {
  assertWorldObjectRuntimeProjection,
  deriveWorldObjectSortY,
  validateWorldObject,
} from '../lib/worldMapObjectSchema.mjs'
import {
  WORLD_MAP_V4_GENERATED_ALIASES,
  WORLD_MAP_V4_GENERATED_DESTINATIONS,
  WORLD_MAP_V4_GENERATED_DESTINATION_PRESENTATIONS,
  WORLD_MAP_V4_GENERATED_FOREGROUND,
  WORLD_MAP_V4_GENERATED_LAYER_OVERRIDES,
  WORLD_MAP_V4_GENERATED_LOGICAL_DESTINATIONS,
  WORLD_MAP_V4_GENERATED_MINIMAP_DESTINATIONS,
  WORLD_MAP_V4_GENERATED_OBJECTS,
  WORLD_MAP_V4_GENERATED_PATHS,
  WORLD_MAP_V4_GENERATED_SCHEMA_VERSION,
  WORLD_MAP_V4_GENERATED_TERRAIN_PANELS,
  WORLD_MAP_V4_GENERATED_WORLD,
} from '../lib/generated/worldMapV4RuntimeObjects.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS as GENERATED_COLLISION_OBJECTS } from '../lib/generated/worldMapV4CollisionObjects.mjs'
import {
  WORLD_MAP_V4_AUTHORED_CANDIDATES,
  WORLD_MAP_V4_OBJECT_AUTHORITY,
} from '../data/world-map-v4/worldObjects.mjs'
import { adaptLegacyWorldMapV4 } from './world-map/legacy-world-object-adapter.mjs'
import {
  assertDeterministicSources,
  assertSingleAuthorityOutput,
  buildProjectionSources,
  checkGeneratedSource,
  checkProjectionFiles,
  compareNativeCandidateWithLegacy,
  compileWorldMapObjectProjections,
  validateAuthorityRegistry,
} from './build-world-map-object-projections.mjs'

const clone = value => structuredClone(value)
const legacy = adaptLegacyWorldMapV4()
const compiled = compileWorldMapObjectProjections()
const library = WORLD_MAP_V4_AUTHORED_CANDIDATES.find(object => object.id === 'landmark-library')
const currentLibrary = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-library')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const mapEntries = map => [...map].map(([key, objects]) => ({ key, objectIds: objects.map(object => object.id) }))
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY_SNAPSHOT_SHA256 = 'cb311187288252d6e88ff1a9216aa32bdb15361c93fc7849d716e42b0ea71346'
const GENERATED_RUNTIME = {
  schemaVersion: WORLD_MAP_V4_GENERATED_SCHEMA_VERSION,
  world: WORLD_MAP_V4_GENERATED_WORLD,
  terrainPanels: WORLD_MAP_V4_GENERATED_TERRAIN_PANELS,
  renderObjects: WORLD_MAP_V4_GENERATED_OBJECTS,
  foreground: WORLD_MAP_V4_GENERATED_FOREGROUND,
  destinations: WORLD_MAP_V4_GENERATED_DESTINATIONS,
  logicalDestinations: WORLD_MAP_V4_GENERATED_LOGICAL_DESTINATIONS,
  guidePaths: WORLD_MAP_V4_GENERATED_PATHS,
  minimapDestinations: WORLD_MAP_V4_GENERATED_MINIMAP_DESTINATIONS,
  destinationPresentations: WORLD_MAP_V4_GENERATED_DESTINATION_PRESENTATIONS,
  assets: WORLD_MAP_V4_ASSET_MANIFEST,
  aliases: WORLD_MAP_V4_GENERATED_ALIASES,
  layerOverrides: WORLD_MAP_V4_GENERATED_LAYER_OVERRIDES,
}

function legacySnapshotHash(snapshot) {
  const core = {
    world: snapshot.world,
    terrainPanels: snapshot.terrainPanels,
    renderObjects: snapshot.renderObjects,
    foregroundObjects: snapshot.foregroundObjects,
    destinations: snapshot.destinations,
    logicalDestinations: snapshot.logicalDestinations,
    collisionObjects: snapshot.collisionObjects,
    guidePaths: snapshot.guidePaths,
    minimapDestinations: snapshot.minimapDestinations,
    destinationPresentations: snapshot.destinationPresentations,
    assetRegistrations: snapshot.assetRegistrations,
    spatialIndex: snapshot.spatialIndex,
    records: snapshot.records,
    classifications: snapshot.classifications,
  }
  return sha256(JSON.stringify(core))
}

test('legacy adapter snapshots production data without merging responsibilities', () => {
  assert.equal(legacySnapshotHash(legacy), LEGACY_SNAPSHOT_SHA256)
  assert.deepEqual(
    legacy.renderObjects.filter(object => object.id !== 'landmark-home'),
    WORLD_MAP_V4_OBJECTS.filter(object => object.id !== 'landmark-home'),
  )
  assert.equal(legacy.renderObjects.find(object => object.id === 'landmark-home').assetId, 'landmark-home-hub')
  assert.equal(WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-home').assetId, 'landmark-home-player-building')
  assert.deepEqual(legacy.foregroundObjects, WORLD_MAP_V4_FOREGROUND)
  assert.deepEqual(legacy.destinations.Home.approach, { x: 1664, y: 1792 })
  assert.deepEqual(WORLD_MAP_V4_DESTINATIONS.Home.approach, { x: 1648, y: 1760 })
  assert.deepEqual(legacy.logicalDestinations.find(item => item.id === 'Home').target.approach, { x: 1664, y: 1792 })
  assert.deepEqual(WORLD_DESTINATIONS.find(item => item.id === 'Home').target.approach, { x: 1648, y: 1760 })
  assert.equal(legacy.collisionObjects.find(item => item.objectId === 'landmark-home').shapes[0].right, 1792)
  assert.equal(CURRENT_COLLISION_OBJECTS.find(item => item.objectId === 'landmark-home').shapes[0].right, 1776)
  assert.deepEqual(legacy.guidePaths.find(item => item.id === 'spoke-home').points.at(-1), { x: 1664, y: 1792 })
  assert.deepEqual(WORLD_MAP_V4_PATHS.find(item => item.id === 'spoke-home').points.at(-1), { x: 1648, y: 1760 })
  assert.deepEqual(legacy.minimapDestinations.find(item => item.id === 'Home').worldPoint, { x: 1664, y: 1792 })
  assert.deepEqual(WORLD_MINIMAP_DESTINATIONS.find(item => item.id === 'Home').worldPoint, { x: 1648, y: 1760 })
  assert.equal(legacy.destinationPresentations.Home, undefined)
  assert.deepEqual(WORLD_MAP_V4_DESTINATION_PRESENTATIONS.Home, { label: '우리 집 · 꾸미기', icon: '🏠', color: '#E98265' })
  assert.deepEqual(legacy.assetRegistrations, WORLD_MAP_V4_ASSET_MANIFEST)
  assert.equal(legacy.classifications.staticEnvironmentClusterIds.length, 8)
  assert.deepEqual(legacy.classifications.foregroundObjectIds, ['foreground-south-gate'])
  assert.equal(legacy.classifications.logicalDestinationIds.length, 8)
  assert.equal(legacy.classifications.collisionObjectIds.length, 8)
  assert.equal(legacy.classifications.bakedEnvironmentIds.length, 12)
})

test('Library and Home are native authorities and every production object emits once', () => {
  assert.equal(Object.keys(WORLD_MAP_V4_OBJECT_AUTHORITY).length, 18)
  assert.equal(Object.values(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(authority => authority === 'native').length, 2)
  assert.equal(Object.values(WORLD_MAP_V4_OBJECT_AUTHORITY).filter(authority => authority === 'legacy').length, 16)
  assert.equal(WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-library'], 'native')
  assert.equal(WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-home'], 'native')
  assert.equal(compiled.authorityOutputs.length, 18)
  assert.equal(new Set(compiled.authorityOutputs.map(entry => entry.id)).size, 18)
})

test('generated legacy runtime projection is production-equivalent', () => {
  const projection = compiled.runtimeProjection
  assert.deepEqual(projection.world, WORLD_MAP_V4)
  assert.deepEqual(projection.terrainPanels, WORLD_MAP_V4_TERRAIN_PANELS)
  assert.deepEqual(projection.renderObjects, WORLD_MAP_V4_OBJECTS)
  assert.deepEqual(projection.foreground, WORLD_MAP_V4_FOREGROUND)
  assert.deepEqual(projection.destinations, WORLD_MAP_V4_DESTINATIONS)
  assert.deepEqual(projection.logicalDestinations, WORLD_DESTINATIONS)
  assert.deepEqual(projection.guidePaths, WORLD_MAP_V4_PATHS)
  assert.deepEqual(projection.minimapDestinations, WORLD_MINIMAP_DESTINATIONS)
  assert.deepEqual(projection.destinationPresentations, WORLD_MAP_V4_DESTINATION_PRESENTATIONS)
  assert.deepEqual(projection.assets, WORLD_MAP_V4_ASSET_MANIFEST)
  assert.deepEqual(WORLD_MAP_V4_LOGICAL_DESTINATIONS, WORLD_DESTINATIONS)
  assert.deepEqual(WORLD_MAP_V4_MINIMAP_DESTINATIONS, WORLD_MINIMAP_DESTINATIONS)
  assert.deepEqual(WORLD_MAP_V4_ALIASES, projection.aliases)
  assert.deepEqual(WORLD_MAP_V4_LAYER_OVERRIDES, projection.layerOverrides)
  assert.deepEqual(Object.keys(projection.layerOverrides), ['landmark-library', 'landmark-home'])
  assert.equal(projection.renderObjects.length, 17)
  assert.equal(projection.foreground.length, 1)
  assert.equal(Object.keys(projection.destinations).length, 8)
  assert.deepEqual(projection.renderObjects.map(object => object.id), WORLD_MAP_V4_OBJECTS.map(object => object.id))
  assert.deepEqual(projection.foreground.map(object => object.id), WORLD_MAP_V4_FOREGROUND.map(object => object.id))
})

test('bounds and spatial-index results reconstruct exactly from the lean projection', () => {
  const generatedBounds = GENERATED_RUNTIME.renderObjects.map(object => objectBounds(object))
  const currentBounds = WORLD_MAP_V4_OBJECTS.map(object => objectBounds(object))
  assert.deepEqual(generatedBounds, currentBounds)
  assert.deepEqual(
    mapEntries(createWorldMapSpatialIndex(GENERATED_RUNTIME.renderObjects, GENERATED_RUNTIME.world.chunkSize)),
    mapEntries(WORLD_MAP_V4_SPATIAL_INDEX),
  )
  assert.equal(mapEntries(WORLD_MAP_V4_SPATIAL_INDEX).length, 48)
  assert.deepEqual(
    [...createWorldMapSpatialIndex([{ id: 'boundary-touch', x: 0, y: 1, width: 512, height: 1 }], 512).keys()],
    ['0,0', '1,0'],
  )
})

test('generated collision projection preserves collider and shape order exactly', () => {
  assert.deepEqual(compiled.collisionObjects, CURRENT_COLLISION_OBJECTS)
  assert.deepEqual(GENERATED_COLLISION_OBJECTS, CURRENT_COLLISION_OBJECTS)
  assert.deepEqual(
    GENERATED_COLLISION_OBJECTS.map(object => [object.objectId, object.colliderId, object.collisionRole, object.shapes]),
    CURRENT_COLLISION_OBJECTS.map(object => [object.objectId, object.colliderId, object.collisionRole, object.shapes]),
  )
})

test('Library authored migration candidate matches every current compatibility field', () => {
  assert.equal(validateWorldObject(library, { profile: 'migration' }), library)
  const { projected, results } = compareNativeCandidateWithLegacy(library, legacy)
  assert.ok(Object.values(results).every(Boolean))
  assert.deepEqual(projected.render, currentLibrary)
  assert.deepEqual(projected.asset, WORLD_MAP_V4_ASSET_MANIFEST['landmark-library'])
  assert.deepEqual(projected.collisionObjects, CURRENT_COLLISION_OBJECTS.filter(object => object.objectId === 'landmark-library'))
  assert.deepEqual(projected.minimapDestination.worldPoint, { x: 1918, y: 1438 })
  assert.deepEqual(projected.destinationPresentation, { label: 'Sound Museum', icon: '🏛', color: '#C8A96E' })
  assert.deepEqual(projected.guidePath.points, [{ x: 1920, y: 1504 }, { x: 1918, y: 1438 }])
  assert.deepEqual(projected.aliases, {
    canonicalDestinationId: 'sound-library',
    legacyIds: ['Library', 'Sound Library'],
    manifestInteractionId: 'Library',
    externalDestinationId: 'Sound Library',
  })
  assert.deepEqual(projected.renderLayers, [{
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
  }])
  assert.equal(deriveWorldObjectSortY(library), 1339.2265193370165)
  assert.equal(library.compatibility.runtimeSortReferenceY, 1010)
  assert.equal(library.compatibility.assetBuildSemanticSortReferenceY, 1147)
})

test('asset-build semantic Library sort cannot replace current runtime sort', () => {
  const drifted = clone(library)
  drifted.depth.legacySortY = 1147 * legacy.world.scaleY
  assert.throws(
    () => compareNativeCandidateWithLegacy(drifted, legacy),
    /failed parity: renderObject.*runtimeSortReferencePreserved|failed parity: .*renderObject/,
  )
})

test('authority registry rejects unknown, missing, duplicate, and unavailable selections', () => {
  const unknown = { ...WORLD_MAP_V4_OBJECT_AUTHORITY, 'landmark-library': 'preferred' }
  assert.throws(() => validateAuthorityRegistry(legacy, WORLD_MAP_V4_AUTHORED_CANDIDATES, unknown), /Unknown authority value/)

  const annex = { ...clone(library), id: 'landmark-library-annex' }
  assert.throws(
    () => validateAuthorityRegistry(legacy, [...WORLD_MAP_V4_AUTHORED_CANDIDATES, annex], WORLD_MAP_V4_OBJECT_AUTHORITY),
    /missing from the authority registry/,
  )
  assert.throws(
    () => validateAuthorityRegistry(legacy, [library, clone(library)], WORLD_MAP_V4_OBJECT_AUTHORITY),
    /Duplicate native candidate ID/,
  )
  assert.throws(
    () => validateAuthorityRegistry(legacy, [...WORLD_MAP_V4_AUTHORED_CANDIDATES, annex], {
      ...WORLD_MAP_V4_OBJECT_AUTHORITY,
      'landmark-library-annex': 'legacy',
    }),
    /Legacy authority selected for missing legacy object/,
  )
  assert.throws(
    () => validateAuthorityRegistry(legacy, WORLD_MAP_V4_AUTHORED_CANDIDATES, {
      ...WORLD_MAP_V4_OBJECT_AUTHORITY,
      'landmark-guesthouse': 'native',
    }),
    /Native authority selected without a candidate/,
  )
})

test('dual authority output and selected-out candidate drift are hard failures', () => {
  assert.throws(() => assertSingleAuthorityOutput([
    { id: 'landmark-library', authority: 'legacy' },
    { id: 'landmark-library', authority: 'native' },
  ]), /emitted by both legacy and native authority/)

  const driftedCandidates = clone(WORLD_MAP_V4_AUTHORED_CANDIDATES)
  driftedCandidates.find(candidate => candidate.id === 'landmark-library').transform.position.x += 1
  assert.throws(() => compileWorldMapObjectProjections({
    legacySnapshot: legacy,
    candidates: driftedCandidates,
    authorityRegistry: WORLD_MAP_V4_OBJECT_AUTHORITY,
  }), /Unselected native candidate landmark-library failed parity/)
})

test('generated modules equal a fresh compile and check mode passes', () => {
  assert.deepEqual(GENERATED_RUNTIME, compiled.runtimeProjection)
  assert.deepEqual(GENERATED_COLLISION_OBJECTS, compiled.collisionObjects)
  assert.doesNotThrow(() => checkProjectionFiles())
})

test('compiler output is deterministic and stale/non-deterministic output fails', () => {
  const first = buildProjectionSources()
  const second = buildProjectionSources()
  assertDeterministicSources(first, second)
  assert.equal(sha256(first.runtimeSource), sha256(second.runtimeSource))
  assert.equal(sha256(first.collisionSource), sha256(second.collisionSource))
  assert.throws(() => checkGeneratedSource(`${first.runtimeSource}\n`, first.runtimeSource, 'runtime'), /stale/)
  assert.throws(() => assertDeterministicSources(first, {
    ...second,
    collisionSource: `${second.collisionSource}\n`,
  }), /non-deterministic/)
})

test('generated modules are pure literals without build-only or Node/browser dependencies', () => {
  const runtimeSource = readFileSync(new URL('../lib/generated/worldMapV4RuntimeObjects.mjs', import.meta.url), 'utf8')
  const collisionSource = readFileSync(new URL('../lib/generated/worldMapV4CollisionObjects.mjs', import.meta.url), 'utf8')
  for (const source of [runtimeSource, collisionSource]) {
    assert.doesNotMatch(source, /\bimport\b|\brequire\s*\(|node:|react|window|document/)
    assert.doesNotMatch(source, /provenance|sourceAssets|sourceNote|generator|referenceRegistration|\/Users\//)
    assert.doesNotMatch(source, /20\d\d-\d\d-\d\dT\d\d:/)
    assert.doesNotMatch(source, /validateWorldObject|assertWorldObjectRuntimeProjection/)
  }
  assert.doesNotMatch(runtimeSource, /"assets"\s*:/)
  assertWorldObjectRuntimeProjection(GENERATED_RUNTIME)
  assert.throws(
    () => assertWorldObjectRuntimeProjection({ provenance: { sourceAssets: [] } }),
    /build-only provenance/,
  )
})

function importedSpecifiers(file) {
  const source = readFileSync(file, 'utf8')
  const matches = source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)
  return [...matches].map(match => match[1])
}

function resolveLocalImport(file, specifier) {
  if (specifier.startsWith('@/')) return resolve(REPOSITORY_ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier)
  return null
}

function importGraph(entries) {
  const pending = entries.map(entry => resolve(REPOSITORY_ROOT, entry))
  const files = new Set()
  const externals = new Set()
  while (pending.length > 0) {
    const file = pending.pop()
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of importedSpecifiers(file)) {
      const local = resolveLocalImport(file, specifier)
      if (!local) {
        externals.add(specifier)
        continue
      }
      if (existsSync(local) && !files.has(local)) pending.push(local)
    }
  }
  return {
    files: [...files].map(file => relative(REPOSITORY_ROOT, file)),
    externals: [...externals],
  }
}

test('import graph follows authored -> compiler -> generated -> facade -> runtime direction', () => {
  const compilerGraph = importGraph([
    'scripts/build-world-map-object-projections.mjs',
    'scripts/world-map/legacy-world-object-adapter.mjs',
  ])
  assert.ok(compilerGraph.files.includes('data/world-map-v4/legacyWorldMapV4.mjs'))
  assert.ok(compilerGraph.files.includes('data/world-map-v4/legacyCollisionObjects.mjs'))
  assert.ok(!compilerGraph.files.some(file => file.startsWith('lib/generated/')))
  assert.ok(!compilerGraph.files.some(file => /lib\/worldMap(?:V4Manifest|Geometry|Collision|Minimap|Navigation)\.mjs/.test(file)))

  const generatedSources = [
    readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4RuntimeObjects.mjs'), 'utf8'),
    readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4CollisionObjects.mjs'), 'utf8'),
  ]
  for (const source of generatedSources) assert.doesNotMatch(source, /\bimport\b|\bexport\s+\{[^}]+\}\s+from\b/)

  const facadeGraph = importGraph([
    'lib/worldMapV4Manifest.mjs',
    'lib/worldMapGeometry.mjs',
    'lib/worldMapCollision.mjs',
    'lib/worldMapNavigation.mjs',
    'lib/worldMapMinimap.mjs',
  ])
  assert.ok(facadeGraph.files.includes('lib/generated/worldMapV4RuntimeObjects.mjs'))
  assert.ok(facadeGraph.files.includes('lib/generated/worldMapV4CollisionObjects.mjs'))
  assert.ok(!facadeGraph.files.some(file => file.startsWith('scripts/') || file.startsWith('data/world-map-v4/') || file === 'lib/worldMapObjectSchema.mjs'))

  const clientGraph = importGraph([
    'components/WorldMap.js',
    'components/world-map/WorldMapScene.js',
    'components/world-map/WorldMapDiagram.js',
  ])
  assert.ok(!clientGraph.files.some(file => file.startsWith('scripts/') || file.startsWith('data/world-map-v4/') || file === 'lib/worldMapObjectSchema.mjs'))
  assert.ok(!clientGraph.externals.some(specifier => specifier.startsWith('node:')))

  const authoredGraph = importGraph([
    'data/world-map-v4/legacyWorldMapV4.mjs',
    'data/world-map-v4/legacyCollisionObjects.mjs',
    'data/world-map-v4/worldObjects.mjs',
    'data/world-map-v4/sourceAssets.mjs',
  ])
  assert.ok(!authoredGraph.files.some(file => file.startsWith('components/')))
})

test('compiler rebuilds both projections in isolation without existing generated files', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'world-map-projection-'))
  const inputs = [
    'scripts/build-world-map-object-projections.mjs',
    'scripts/world-map/legacy-world-object-adapter.mjs',
    'data/world-map-v4/worldObjects.mjs',
    'data/world-map-v4/sourceAssets.mjs',
    'data/world-map-v4/legacyWorldMapV4.mjs',
    'data/world-map-v4/legacyCollisionObjects.mjs',
    'lib/worldMapObjectSchema.mjs',
    'lib/worldMapCollisionContract.mjs',
    'lib/worldMapV4Assets.mjs',
  ]
  try {
    for (const input of inputs) {
      const target = resolve(temporaryRoot, input)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(resolve(REPOSITORY_ROOT, input), target)
    }
    const temporaryRuntime = resolve(temporaryRoot, 'lib/generated/worldMapV4RuntimeObjects.mjs')
    const temporaryCollision = resolve(temporaryRoot, 'lib/generated/worldMapV4CollisionObjects.mjs')
    assert.equal(existsSync(temporaryRuntime), false)
    assert.equal(existsSync(temporaryCollision), false)
    const result = spawnSync(process.execPath, ['scripts/build-world-map-object-projections.mjs'], {
      cwd: temporaryRoot,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(readFileSync(temporaryRuntime, 'utf8'), readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4RuntimeObjects.mjs'), 'utf8'))
    assert.equal(readFileSync(temporaryCollision, 'utf8'), readFileSync(resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4CollisionObjects.mjs'), 'utf8'))
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('production facade preserves top-level and nested immutability', () => {
  const topLevel = [
    WORLD_MAP_V4,
    WORLD_MAP_V4_DESTINATIONS,
    WORLD_MAP_V4_PATHS,
    WORLD_MAP_V4_TERRAIN_PANELS,
    WORLD_MAP_V4_OBJECTS,
    WORLD_MAP_V4_FOREGROUND,
    WORLD_MAP_V4_LAYER_OVERRIDES,
    WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
    WORLD_MAP_V4_ASSET_MANIFEST,
    WORLD_DESTINATIONS,
    WORLD_MINIMAP_DESTINATIONS,
    CURRENT_COLLISION_OBJECTS,
  ]
  assert.ok(topLevel.every(Object.isFrozen))
  assert.ok(WORLD_MAP_V4_OBJECTS.every(object => Object.isFrozen(object) && Object.isFrozen(object.collision)))
  assert.ok(WORLD_MAP_V4_TERRAIN_PANELS.every(Object.isFrozen))
  assert.ok(WORLD_DESTINATIONS.every(destination => Object.isFrozen(destination) && Object.isFrozen(destination.target)))
  assert.ok(WORLD_MINIMAP_DESTINATIONS.every(destination => Object.isFrozen(destination) && Object.isFrozen(destination.worldPoint)))
  assert.ok(CURRENT_COLLISION_OBJECTS.every(object => Object.isFrozen(object) && Object.isFrozen(object.shapes) && object.shapes.every(Object.isFrozen)))
  assert.equal(WORLD_PORTALS[0], WORLD_DESTINATIONS[0].target)
  assert.equal(WORLD_MUSEUM, WORLD_DESTINATIONS.find(destination => destination.id === 'Sound Library').target)
  assert.equal(WORLD_HOME, WORLD_DESTINATIONS.find(destination => destination.id === 'Home').target)
})
