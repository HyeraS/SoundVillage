import {
  LEGACY_WORLD_MAP_V4,
  LEGACY_WORLD_MAP_V4_ASSET_MANIFEST,
  LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
  LEGACY_WORLD_MAP_V4_DESTINATIONS,
  LEGACY_WORLD_MAP_V4_FOREGROUND,
  LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS,
  LEGACY_WORLD_MAP_V4_MINIMAP_DESTINATIONS,
  LEGACY_WORLD_MAP_V4_OBJECTS,
  LEGACY_WORLD_MAP_V4_PATHS,
  LEGACY_WORLD_MAP_V4_TERRAIN_PANELS,
} from '../../data/world-map-v4/legacyWorldMapV4.mjs'
import { LEGACY_WORLD_MAP_V4_COLLISION_OBJECTS } from '../../data/world-map-v4/legacyCollisionObjects.mjs'

const clone = value => JSON.parse(JSON.stringify(value))

const objectBounds = object => ({
  left: object.x,
  top: object.y,
  right: object.x + object.width,
  bottom: object.y + object.height,
})

function createSpatialIndex(objects, chunkSize) {
  const chunks = new Map()
  for (const object of objects) {
    const bounds = objectBounds(object)
    for (let cy = Math.floor(bounds.top / chunkSize); cy <= Math.floor(bounds.bottom / chunkSize); cy += 1) {
      for (let cx = Math.floor(bounds.left / chunkSize); cx <= Math.floor(bounds.right / chunkSize); cx += 1) {
        const key = `${cx},${cy}`
        if (!chunks.has(key)) chunks.set(key, [])
        chunks.get(key).push(object)
      }
    }
  }
  return chunks
}

const LEGACY_WORLD_MAP_V4_SPATIAL_INDEX = createSpatialIndex(LEGACY_WORLD_MAP_V4_OBJECTS, LEGACY_WORLD_MAP_V4.chunkSize)

function guidePathForRenderObject(object) {
  if (!object.interaction) return null
  const suffix = String(object.interaction.id).toLowerCase()
  return LEGACY_WORLD_MAP_V4_PATHS.find(path => path.id === `spoke-${suffix}`) ?? null
}

function spatialChunkKeysForObject(objectId) {
  return [...LEGACY_WORLD_MAP_V4_SPATIAL_INDEX]
    .filter(([, objects]) => objects.some(object => object.id === objectId))
    .map(([key]) => key)
}

function aliasMetadata(object) {
  if (!object.interaction || !object.portalId || object.interaction.id === object.portalId) return null
  return {
    canonicalDestinationId: object.portalId.toLowerCase().replaceAll(' ', '-'),
    legacyIds: [object.interaction.id, object.portalId],
    manifestInteractionId: object.interaction.id,
    externalDestinationId: object.portalId,
  }
}

function adaptRenderObject(object, scope) {
  const destinationTarget = object.interaction
    ? LEGACY_WORLD_MAP_V4_DESTINATIONS[object.interaction.id] ?? null
    : null
  const logicalDestination = object.portalId
    ? LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS.find(destination => destination.id === object.portalId) ?? null
    : null
  const minimapDestination = object.portalId
    ? LEGACY_WORLD_MAP_V4_MINIMAP_DESTINATIONS.find(destination => destination.id === object.portalId) ?? null
    : null

  return {
    id: object.id,
    authority: 'legacy',
    scope,
    classification: scope === 'foreground'
      ? 'foreground'
      : object.category === 'environment-cluster'
        ? 'static-environment-cluster'
        : 'render-object',
    render: clone(object),
    destinationKey: object.interaction?.id ?? null,
    destinationTarget: destinationTarget ? clone(destinationTarget) : null,
    logicalDestination: logicalDestination ? clone(logicalDestination) : null,
    collisionObjects: clone(LEGACY_WORLD_MAP_V4_COLLISION_OBJECTS.filter(collider => collider.objectId === object.id)),
    guidePath: clone(guidePathForRenderObject(object)),
    minimapDestination: minimapDestination ? clone(minimapDestination) : null,
    destinationPresentation: object.portalId
      ? clone(LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS[object.portalId] ?? null)
      : null,
    bounds: clone(objectBounds(object)),
    spatialChunkKeys: scope === 'render' ? spatialChunkKeysForObject(object.id) : [],
    asset: clone(LEGACY_WORLD_MAP_V4_ASSET_MANIFEST[object.assetId]),
    aliases: aliasMetadata(object),
  }
}

export function adaptLegacyWorldMapV4() {
  const renderRecords = LEGACY_WORLD_MAP_V4_OBJECTS.map(object => adaptRenderObject(object, 'render'))
  const foregroundRecords = LEGACY_WORLD_MAP_V4_FOREGROUND.map(object => adaptRenderObject(object, 'foreground'))

  return {
    world: clone(LEGACY_WORLD_MAP_V4),
    terrainPanels: clone(LEGACY_WORLD_MAP_V4_TERRAIN_PANELS),
    renderObjects: clone(LEGACY_WORLD_MAP_V4_OBJECTS),
    foregroundObjects: clone(LEGACY_WORLD_MAP_V4_FOREGROUND),
    destinations: clone(LEGACY_WORLD_MAP_V4_DESTINATIONS),
    logicalDestinations: clone(LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS),
    collisionObjects: clone(LEGACY_WORLD_MAP_V4_COLLISION_OBJECTS),
    guidePaths: clone(LEGACY_WORLD_MAP_V4_PATHS),
    minimapDestinations: clone(LEGACY_WORLD_MAP_V4_MINIMAP_DESTINATIONS),
    destinationPresentations: clone(LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS),
    assetRegistrations: clone(LEGACY_WORLD_MAP_V4_ASSET_MANIFEST),
    spatialIndex: [...LEGACY_WORLD_MAP_V4_SPATIAL_INDEX].map(([key, objects]) => ({
      key,
      objectIds: objects.map(object => object.id),
    })),
    records: [...renderRecords, ...foregroundRecords],
    classifications: {
      renderObjectIds: renderRecords.filter(record => record.classification === 'render-object').map(record => record.id),
      logicalDestinationIds: LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS.map(destination => destination.id),
      collisionObjectIds: [...new Set(LEGACY_WORLD_MAP_V4_COLLISION_OBJECTS.map(object => object.objectId))],
      foregroundObjectIds: foregroundRecords.map(record => record.id),
      staticEnvironmentClusterIds: renderRecords
        .filter(record => record.classification === 'static-environment-cluster')
        .map(record => record.id),
      bakedEnvironmentIds: LEGACY_WORLD_MAP_V4_TERRAIN_PANELS.map(panel => panel.id),
    },
  }
}
