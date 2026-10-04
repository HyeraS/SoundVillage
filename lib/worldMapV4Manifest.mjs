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
  WORLD_MAP_V4_GENERATED_TERRAIN_PANELS,
  WORLD_MAP_V4_GENERATED_WORLD,
} from './generated/worldMapV4RuntimeObjects.mjs'
import { WORLD_MAP_V4_ASSETS } from './worldMapV4Assets.mjs'
import {
  WORLD_MAP_V4_COLLISION_OBJECTS,
  worldMapV4BlockingReasonAt,
} from './worldMapCollision.mjs'

export { WORLD_MAP_V4_COLLISION_OBJECTS, worldMapV4BlockingReasonAt }

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

// Public compatibility facade. Authored legacy data and WorldObject candidates
// stop at the compiler; production consumes only these generated projections.
export const WORLD_MAP_V4 = deepFreeze(WORLD_MAP_V4_GENERATED_WORLD)
export const WORLD_MAP_V4_DESTINATIONS = deepFreeze(WORLD_MAP_V4_GENERATED_DESTINATIONS)
export const WORLD_MAP_V4_PATHS = deepFreeze(WORLD_MAP_V4_GENERATED_PATHS)
export const WORLD_MAP_V4_TERRAIN_PANELS = deepFreeze(WORLD_MAP_V4_GENERATED_TERRAIN_PANELS)
export const WORLD_MAP_V4_OBJECTS = deepFreeze(WORLD_MAP_V4_GENERATED_OBJECTS)
export const WORLD_MAP_V4_FOREGROUND = deepFreeze(WORLD_MAP_V4_GENERATED_FOREGROUND)
export const WORLD_MAP_V4_LAYER_OVERRIDES = deepFreeze(WORLD_MAP_V4_GENERATED_LAYER_OVERRIDES)
export const WORLD_MAP_V4_ASSET_MANIFEST = WORLD_MAP_V4_ASSETS

// Internal production projections used by the existing geometry/minimap
// facades. They remain named separately from the established public API.
export const WORLD_MAP_V4_LOGICAL_DESTINATIONS = deepFreeze(WORLD_MAP_V4_GENERATED_LOGICAL_DESTINATIONS)
export const WORLD_MAP_V4_MINIMAP_DESTINATIONS = deepFreeze(WORLD_MAP_V4_GENERATED_MINIMAP_DESTINATIONS)
export const WORLD_MAP_V4_DESTINATION_PRESENTATIONS = deepFreeze(WORLD_MAP_V4_GENERATED_DESTINATION_PRESENTATIONS)
export const WORLD_MAP_V4_ALIASES = deepFreeze(WORLD_MAP_V4_GENERATED_ALIASES)

export function objectBounds(object) {
  return { left: object.x, top: object.y, right: object.x + object.width, bottom: object.y + object.height }
}

export function createWorldMapSpatialIndex(objects = WORLD_MAP_V4_OBJECTS, chunkSize = WORLD_MAP_V4.chunkSize) {
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

export const WORLD_MAP_V4_SPATIAL_INDEX = createWorldMapSpatialIndex()

export function queryWorldMapTerrainPanels(view, margin = 64) {
  return WORLD_MAP_V4_TERRAIN_PANELS.filter(panel => (
    panel.x + panel.width >= view.x - margin
    && panel.x <= view.x + view.width + margin
    && panel.y + panel.height >= view.y - margin
    && panel.y <= view.y + view.height + margin
  ))
}

export function queryWorldMapObjects(view, margin = 180) {
  const minX = Math.floor((view.x - margin) / WORLD_MAP_V4.chunkSize)
  const maxX = Math.floor((view.x + view.width + margin) / WORLD_MAP_V4.chunkSize)
  const minY = Math.floor((view.y - margin) / WORLD_MAP_V4.chunkSize)
  const maxY = Math.floor((view.y + view.height + margin) / WORLD_MAP_V4.chunkSize)
  const seen = new Set()
  const objects = []
  const chunks = []
  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const key = `${cx},${cy}`
      chunks.push(key)
      for (const object of WORLD_MAP_V4_SPATIAL_INDEX.get(key) || []) {
        if (seen.has(object.id)) continue
        seen.add(object.id)
        const bounds = objectBounds(object)
        if (bounds.right < view.x - margin || bounds.left > view.x + view.width + margin || bounds.bottom < view.y - margin || bounds.top > view.y + view.height + margin) continue
        objects.push(object)
      }
    }
  }
  return { objects, chunks }
}
