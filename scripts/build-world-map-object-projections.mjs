import { isDeepStrictEqual } from 'node:util'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  WORLD_MAP_V4_AUTHORED_CANDIDATES,
  WORLD_MAP_V4_OBJECT_AUTHORITY,
} from '../data/world-map-v4/worldObjects.mjs'
import {
  assertWorldObjectRuntimeProjection,
  deriveWorldObjectApproachPoint,
  deriveWorldObjectMinimapPoint,
  deriveWorldObjectSortY,
  deriveWorldObjectVisualBounds,
  projectWorldObjectColliders,
  projectWorldObjectLayerRect,
  projectWorldObjectPoint,
  unionWorldObjectLayerRects,
  validateWorldObjectSet,
} from '../lib/worldMapObjectSchema.mjs'
import { adaptLegacyWorldMapV4 } from './world-map/legacy-world-object-adapter.mjs'

const THIS_FILE = fileURLToPath(import.meta.url)
const REPOSITORY_ROOT = resolve(dirname(THIS_FILE), '..')
const DEFAULT_RUNTIME_OUTPUT = resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4RuntimeObjects.mjs')
const DEFAULT_COLLISION_OUTPUT = resolve(REPOSITORY_ROOT, 'lib/generated/worldMapV4CollisionObjects.mjs')
const clone = value => JSON.parse(JSON.stringify(value))

function createSpatialIndex(objects, chunkSize) {
  const chunks = new Map()
  for (const object of objects) {
    const bounds = {
      left: object.x,
      top: object.y,
      right: object.x + object.width,
      bottom: object.y + object.height,
    }
    for (let cy = Math.floor(bounds.top / chunkSize); cy <= Math.floor(bounds.bottom / chunkSize); cy += 1) {
      for (let cx = Math.floor(bounds.left / chunkSize); cx <= Math.floor(bounds.right / chunkSize); cx += 1) {
        const key = `${cx},${cy}`
        if (!chunks.has(key)) chunks.set(key, [])
        chunks.get(key).push(object.id)
      }
    }
  }
  return [...chunks].map(([key, objectIds]) => ({ key, objectIds }))
}

function spatialChunkKeys(object, legacySnapshot) {
  const renderObjects = legacySnapshot.renderObjects.map(current => current.id === object.id ? object : current)
  return createSpatialIndex(renderObjects, legacySnapshot.world.chunkSize)
    .filter(entry => entry.objectIds.includes(object.id))
    .map(entry => entry.key)
}

function projectGuidePoints(object) {
  if (object.navigation.guidePath === null) return null
  const { guidePath } = object.navigation
  return guidePath.points.map(point => projectWorldObjectPoint(object, {
    space: guidePath.space,
    ...point,
  }))
}

export function projectNativeWorldObjectCandidate(object, legacySnapshot) {
  validateWorldObjectSet([object], { profile: 'migration' })
  const compatibility = object.compatibility
  if (!compatibility || compatibility.scope !== 'render') {
    throw new Error(`Native candidate ${object.id} requires compatibility.scope=render`)
  }
  if (object.transform.rotationDeg !== 0) {
    throw new Error(`Native candidate ${object.id} uses unsupported visual rotation ${object.transform.rotationDeg}; schema v1 production image layers require rotationDeg=0`)
  }
  if (!compatibility.primaryVisualLayerId) {
    throw new Error(`Native candidate ${object.id} requires compatibility.primaryVisualLayerId`)
  }
  const primaryLayer = object.visual.layers.find(layer => layer.id === compatibility.primaryVisualLayerId)
  if (!primaryLayer) {
    throw new Error(`Native candidate ${object.id} primary visual layer ${compatibility.primaryVisualLayerId} does not exist`)
  }
  for (const layer of object.visual.layers) {
    if (!legacySnapshot.assetRegistrations[layer.assetId]) {
      throw new Error(`Native candidate ${object.id} visual layer ${layer.id} references unknown asset ${layer.assetId}`)
    }
  }

  const bounds = deriveWorldObjectVisualBounds(object)
  const localBounds = unionWorldObjectLayerRects(object.visual.layers)
  const objectSortY = deriveWorldObjectSortY(object)
  if (!Number.isFinite(objectSortY)) {
    throw new Error(`Native candidate ${object.id} requires a finite compatibility sortY`)
  }
  const renderLayers = object.visual.layers.map(layer => {
    const rect = projectWorldObjectLayerRect(object, layer)
    const sortOffsetY = layer.sortOffsetY ?? 0
    return {
      objectId: object.id,
      layerId: layer.id,
      role: layer.role,
      renderBand: layer.renderBand,
      assetId: layer.assetId,
      x: rect.left,
      y: rect.top,
      width: (layer.rect.right - layer.rect.left) * object.transform.scale.x,
      height: (layer.rect.bottom - layer.rect.top) * object.transform.scale.y,
      sortY: objectSortY + sortOffsetY,
      sortOffsetY,
      visibleWhen: clone(layer.visibleWhen ?? null),
      layer: compatibility.renderLayer,
    }
  })
  const approachPoint = deriveWorldObjectApproachPoint(object)
  const minimapPoint = deriveWorldObjectMinimapPoint(object)
  const destinationTarget = clone(compatibility.destinationTarget)
  const aliases = {
    canonicalDestinationId: object.interaction.destinationId,
    legacyIds: clone(object.interaction.legacyIds),
    manifestInteractionId: compatibility.renderInteractionId,
    externalDestinationId: compatibility.externalDestinationId,
  }
  const render = {
    id: object.id,
    assetId: primaryLayer.assetId,
    category: compatibility.renderCategory,
    x: bounds.left,
    y: bounds.top,
    width: (localBounds.right - localBounds.left) * object.transform.scale.x,
    height: (localBounds.bottom - localBounds.top) * object.transform.scale.y,
    anchorX: object.anchor.x,
    anchorY: object.anchor.y,
    sortY: objectSortY,
    layer: compatibility.renderLayer,
    interaction: {
      type: object.interaction.type,
      id: compatibility.renderInteractionId,
    },
    portalId: compatibility.portalId,
    collision: [],
  }
  const logicalDestination = {
    id: compatibility.externalDestinationId,
    kind: object.interaction.type,
    target: clone(destinationTarget),
  }
  const guidePath = {
    id: compatibility.guidePathId,
    points: projectGuidePoints(object),
  }
  const minimapDestination = {
    id: compatibility.externalDestinationId,
    kind: object.interaction.type,
    zone: null,
    worldPoint: minimapPoint,
  }
  const destinationPresentation = {
    label: object.minimap.label,
    icon: object.minimap.icon,
    color: object.minimap.color,
  }

  return {
    id: object.id,
    authority: 'native',
    scope: compatibility.scope,
    classification: 'render-object',
    render,
    renderLayers,
    destinationKey: compatibility.destinationKey,
    destinationTarget,
    logicalDestination,
    collisionObjects: projectWorldObjectColliders(object),
    guidePath,
    minimapDestination,
    destinationPresentation,
    bounds,
    spatialChunkKeys: spatialChunkKeys(render, legacySnapshot),
    asset: clone(legacySnapshot.assetRegistrations[primaryLayer.assetId]),
    aliases,
    parityReferences: {
      approachPoint,
      runtimeSortReferenceY: compatibility.runtimeSortReferenceY,
      assetBuildSemanticSortReferenceY: compatibility.assetBuildSemanticSortReferenceY,
    },
  }
}

function parityField(results, field, actual, expected) {
  results[field] = isDeepStrictEqual(actual, expected)
  return results[field]
}

export function compareNativeCandidateWithLegacy(object, legacySnapshot) {
  const legacy = legacySnapshot.records.find(record => record.id === object.id)
  if (!legacy) throw new Error(`Native candidate ${object.id} has no legacy parity target`)
  const projected = projectNativeWorldObjectCandidate(object, legacySnapshot)
  const results = {}
  parityField(results, 'renderObject', projected.render, legacy.render)
  parityField(results, 'assetRegistration', projected.asset, legacy.asset)
  parityField(results, 'destinationGeometry', projected.destinationTarget, legacy.destinationTarget)
  parityField(results, 'logicalDestination', projected.logicalDestination, legacy.logicalDestination)
  parityField(results, 'approachPoint', projected.parityReferences.approachPoint, legacy.destinationTarget?.approach)
  parityField(results, 'collisionObject', projected.collisionObjects, legacy.collisionObjects)
  parityField(results, 'minimapWorldPoint', projected.minimapDestination, legacy.minimapDestination)
  parityField(results, 'destinationPresentation', projected.destinationPresentation, legacy.destinationPresentation)
  parityField(results, 'guidePath', projected.guidePath, legacy.guidePath)
  parityField(results, 'cullingBounds', projected.bounds, legacy.bounds)
  parityField(results, 'spatialIndexChunkKeys', projected.spatialChunkKeys, legacy.spatialChunkKeys)
  parityField(results, 'aliases', projected.aliases, legacy.aliases)
  results.runtimeSortReferencePreserved = projected.parityReferences.runtimeSortReferenceY === 1010
    && projected.render.sortY === legacy.render.sortY
  results.semanticSortReferenceIsReviewOnly = projected.parityReferences.assetBuildSemanticSortReferenceY === 1147
    && projected.render.sortY !== 1147 * legacySnapshot.world.scaleY

  const failures = Object.entries(results).filter(([, passed]) => !passed).map(([field]) => field)
  if (failures.length > 0) {
    throw new Error(`Unselected native candidate ${object.id} failed parity: ${failures.join(', ')}`)
  }
  return { projected, results }
}

function candidateMap(candidates) {
  const map = new Map()
  for (const candidate of candidates) {
    if (map.has(candidate.id)) throw new Error(`Duplicate native candidate ID: ${candidate.id}`)
    map.set(candidate.id, candidate)
  }
  return map
}

export function validateAuthorityRegistry(legacySnapshot, candidates, authorityRegistry) {
  const candidatesById = candidateMap(candidates)
  const legacyIds = new Set([
    ...legacySnapshot.records.map(record => record.id),
    ...legacySnapshot.collisionObjects.map(object => object.objectId),
  ])
  for (const id of legacyIds) {
    if (!Object.hasOwn(authorityRegistry, id)) throw new Error(`Missing authority registry entry for legacy object ${id}`)
  }
  for (const id of candidatesById.keys()) {
    if (!Object.hasOwn(authorityRegistry, id)) throw new Error(`Native candidate ${id} is missing from the authority registry`)
  }
  for (const [id, authority] of Object.entries(authorityRegistry)) {
    if (!['legacy', 'native'].includes(authority)) throw new Error(`Unknown authority value ${authority} for ${id}`)
    if (!legacyIds.has(id) && !candidatesById.has(id)) throw new Error(`Authority registry contains unknown object ${id}`)
    if (authority === 'legacy' && !legacyIds.has(id)) throw new Error(`Legacy authority selected for missing legacy object ${id}`)
    if (authority === 'native' && !candidatesById.has(id)) throw new Error(`Native authority selected without a candidate for ${id}`)
  }
  return candidatesById
}

export function assertSingleAuthorityOutput(entries) {
  const selected = new Map()
  for (const entry of entries) {
    if (selected.has(entry.id)) {
      throw new Error(`Object ${entry.id} would be emitted by both ${selected.get(entry.id)} and ${entry.authority} authority`)
    }
    selected.set(entry.id, entry.authority)
  }
  return entries
}

function remapByLegacyOrder(legacyItems, legacyRecords, selectedRecords, match, select) {
  return legacyItems.map(item => {
    const legacyRecord = legacyRecords.find(record => match(record, item))
    if (!legacyRecord) throw new Error(`No authority-owned record for compatibility item ${JSON.stringify(item)}`)
    return clone(select(selectedRecords.get(legacyRecord.id), item))
  })
}

export function compileWorldMapObjectProjections({
  legacySnapshot = adaptLegacyWorldMapV4(),
  candidates = WORLD_MAP_V4_AUTHORED_CANDIDATES,
  authorityRegistry = WORLD_MAP_V4_OBJECT_AUTHORITY,
} = {}) {
  const candidatesById = validateAuthorityRegistry(legacySnapshot, candidates, authorityRegistry)
  const candidateParity = Object.fromEntries(candidates.map(candidate => {
    if (candidate.compatibility?.parity === 'intentional-delta') {
      return [candidate.id, {
        projected: projectNativeWorldObjectCandidate(candidate, legacySnapshot),
        results: { intentionalDelta: true },
      }]
    }
    const parity = compareNativeCandidateWithLegacy(candidate, legacySnapshot)
    return [candidate.id, parity]
  }))
  const selectedRecords = new Map()
  const authorityOutputs = []
  for (const legacy of legacySnapshot.records) {
    const authority = authorityRegistry[legacy.id]
    const record = authority === 'legacy'
      ? legacy
      : candidateParity[legacy.id]?.projected
        ?? projectNativeWorldObjectCandidate(candidatesById.get(legacy.id), legacySnapshot)
    selectedRecords.set(legacy.id, record)
    authorityOutputs.push({ id: legacy.id, authority })
  }
  assertSingleAuthorityOutput(authorityOutputs)

  const renderObjects = legacySnapshot.renderObjects.map(object => clone(selectedRecords.get(object.id).render))
  const foreground = legacySnapshot.foregroundObjects.map(object => clone(selectedRecords.get(object.id).render))
  const destinations = Object.fromEntries(Object.entries(legacySnapshot.destinations).map(([key, target]) => {
    const legacy = legacySnapshot.records.find(record => record.destinationKey === key)
    if (!legacy) throw new Error(`Destination ${key} has no authority-owned object`)
    return [key, clone(selectedRecords.get(legacy.id).destinationTarget ?? target)]
  }))
  const logicalDestinations = remapByLegacyOrder(
    legacySnapshot.logicalDestinations,
    legacySnapshot.records,
    selectedRecords,
    (record, destination) => record.logicalDestination?.id === destination.id,
    record => record.logicalDestination,
  )
  const guidePaths = remapByLegacyOrder(
    legacySnapshot.guidePaths,
    legacySnapshot.records,
    selectedRecords,
    (record, path) => record.guidePath?.id === path.id,
    record => record.guidePath,
  )
  const minimapDestinations = remapByLegacyOrder(
    legacySnapshot.minimapDestinations,
    legacySnapshot.records,
    selectedRecords,
    (record, destination) => record.minimapDestination?.id === destination.id,
    record => record.minimapDestination,
  )
  const destinationPresentations = Object.fromEntries(Object.entries(legacySnapshot.destinationPresentations).map(([id, presentation]) => {
    const legacy = legacySnapshot.records.find(record => record.logicalDestination?.id === id)
    if (!legacy) throw new Error(`Destination presentation ${id} has no authority-owned object`)
    return [id, clone(selectedRecords.get(legacy.id).destinationPresentation ?? presentation)]
  }))
  for (const record of selectedRecords.values()) {
    const presentationId = record.logicalDestination?.id
    if (record.authority === 'native' && presentationId && record.destinationPresentation && !Object.hasOwn(destinationPresentations, presentationId)) {
      destinationPresentations[presentationId] = clone(record.destinationPresentation)
    }
  }
  const collisionObjects = remapByLegacyOrder(
    legacySnapshot.collisionObjects,
    legacySnapshot.records,
    selectedRecords,
    (record, collider) => record.id === collider.objectId,
    (record, collider) => record.collisionObjects.find(candidate => candidate.colliderId === collider.colliderId),
  )
  const selectedInProductionOrder = legacySnapshot.records.map(record => selectedRecords.get(record.id))
  const aliases = Object.fromEntries(selectedInProductionOrder
    .filter(record => record.aliases)
    .map(record => [record.id, clone(record.aliases)]))
  const layerOverrides = Object.fromEntries(selectedInProductionOrder
    .filter(record => record.authority === 'native' && record.renderLayers?.length > 0)
    .map(record => [record.id, clone(record.renderLayers)]))
  const runtimeProjection = {
    schemaVersion: 1,
    world: clone(legacySnapshot.world),
    terrainPanels: clone(legacySnapshot.terrainPanels),
    renderObjects,
    foreground,
    destinations,
    logicalDestinations,
    guidePaths,
    minimapDestinations,
    destinationPresentations,
    assets: clone(legacySnapshot.assetRegistrations),
    aliases,
    layerOverrides,
  }
  assertWorldObjectRuntimeProjection(runtimeProjection)
  assertWorldObjectRuntimeProjection(collisionObjects)
  return {
    runtimeProjection,
    collisionObjects,
    candidateParity: Object.fromEntries(Object.entries(candidateParity).map(([id, parity]) => [id, parity.results])),
    authorityOutputs,
  }
}

function literal(value) {
  return JSON.stringify(value, null, 2)
}

export function buildProjectionSources(options) {
  const compiled = compileWorldMapObjectProjections(options)
  const projection = compiled.runtimeProjection
  const runtimeExports = [
    ['WORLD_MAP_V4_GENERATED_SCHEMA_VERSION', projection.schemaVersion],
    ['WORLD_MAP_V4_GENERATED_WORLD', projection.world],
    ['WORLD_MAP_V4_GENERATED_TERRAIN_PANELS', projection.terrainPanels],
    ['WORLD_MAP_V4_GENERATED_OBJECTS', projection.renderObjects],
    ['WORLD_MAP_V4_GENERATED_FOREGROUND', projection.foreground],
    ['WORLD_MAP_V4_GENERATED_DESTINATIONS', projection.destinations],
    ['WORLD_MAP_V4_GENERATED_LOGICAL_DESTINATIONS', projection.logicalDestinations],
    ['WORLD_MAP_V4_GENERATED_PATHS', projection.guidePaths],
    ['WORLD_MAP_V4_GENERATED_MINIMAP_DESTINATIONS', projection.minimapDestinations],
    ['WORLD_MAP_V4_GENERATED_DESTINATION_PRESENTATIONS', projection.destinationPresentations],
    ['WORLD_MAP_V4_GENERATED_ALIASES', projection.aliases],
    ['WORLD_MAP_V4_GENERATED_LAYER_OVERRIDES', projection.layerOverrides],
  ]
  return {
    compiled,
    runtimeSource: `// Generated file. Do not edit by hand.\n${runtimeExports.map(([name, value]) => `export const ${name} = ${literal(value)}`).join('\n\n')}\n`,
    collisionSource: `// Generated file. Do not edit by hand.\nexport const WORLD_MAP_V4_COLLISION_OBJECTS = ${literal(compiled.collisionObjects)}\n`,
  }
}

export function assertDeterministicSources(first, second) {
  if (first.runtimeSource !== second.runtimeSource || first.collisionSource !== second.collisionSource) {
    throw new Error('Projection compiler produced non-deterministic output')
  }
  return true
}

export function checkGeneratedSource(actual, expected, label) {
  if (actual !== expected) throw new Error(`Generated output is stale: ${label}`)
  return true
}

export function writeProjectionFiles({
  runtimeOutput = DEFAULT_RUNTIME_OUTPUT,
  collisionOutput = DEFAULT_COLLISION_OUTPUT,
  ...compileOptions
} = {}) {
  const sources = buildProjectionSources(compileOptions)
  mkdirSync(dirname(runtimeOutput), { recursive: true })
  mkdirSync(dirname(collisionOutput), { recursive: true })
  writeFileSync(runtimeOutput, sources.runtimeSource)
  writeFileSync(collisionOutput, sources.collisionSource)
  return sources
}

export function checkProjectionFiles({
  runtimeOutput = DEFAULT_RUNTIME_OUTPUT,
  collisionOutput = DEFAULT_COLLISION_OUTPUT,
  ...compileOptions
} = {}) {
  const sources = buildProjectionSources(compileOptions)
  checkGeneratedSource(readFileSync(runtimeOutput, 'utf8'), sources.runtimeSource, runtimeOutput)
  checkGeneratedSource(readFileSync(collisionOutput, 'utf8'), sources.collisionSource, collisionOutput)
  return sources
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(argument => argument !== '--check')) throw new Error(`Unknown argument: ${args.join(' ')}`)
  if (args.includes('--check')) {
    checkProjectionFiles()
    console.log('WorldObject projection check passed.')
  } else {
    writeProjectionFiles()
    console.log('WorldObject projections generated.')
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
