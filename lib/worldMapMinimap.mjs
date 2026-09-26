import {
  WORLD_DESTINATIONS,
  WORLD_INTERACTION_HALF_HEIGHT,
  WORLD_INTERACTION_HALF_WIDTH,
  WORLD_MAP_HEIGHT_PX,
  WORLD_MAP_WIDTH_PX,
  worldDestinationInteractionPoint,
} from './worldMapGeometry.mjs'

export const WORLD_MINIMAP_SIZE = Object.freeze({
  width: WORLD_MAP_WIDTH_PX,
  height: WORLD_MAP_HEIGHT_PX,
})

export const WORLD_OBJECTIVE_ORDER = Object.freeze([
  'Music',
  'Animal',
  'Human',
  'Nature',
  'Urban',
  'Lab',
])

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))

export function worldToMinimap(point, worldSize, minimapSize) {
  const worldWidth = Math.max(0, Number(worldSize?.width) || 0)
  const worldHeight = Math.max(0, Number(worldSize?.height) || 0)
  const minimapWidth = Math.max(0, Number(minimapSize?.width) || 0)
  const minimapHeight = Math.max(0, Number(minimapSize?.height) || 0)
  const worldX = clamp(Number(point?.x), 0, worldWidth)
  const worldY = clamp(Number(point?.y), 0, worldHeight)

  return {
    x: worldWidth ? worldX / worldWidth * minimapWidth : 0,
    y: worldHeight ? worldY / worldHeight * minimapHeight : 0,
  }
}

export function getWorldMinimapDestinations(destinations = WORLD_DESTINATIONS) {
  return destinations.map(destination => Object.freeze({
    id: destination.id,
    kind: destination.kind,
    zone: destination.zone ?? null,
    worldPoint: Object.freeze({ ...worldDestinationInteractionPoint(destination.target) }),
  }))
}

export const WORLD_MINIMAP_DESTINATIONS = Object.freeze(getWorldMinimapDestinations())

export function getWorldMinimapMarkerState(destination, { lockedZones = [], objectiveId = null, nearDestinationId = null } = {}) {
  return Object.freeze({
    locked: Boolean(destination.zone && lockedZones.includes(destination.zone)),
    current: destination.id === objectiveId,
    near: destination.id === nearDestinationId,
  })
}

export function getWorldObjective({ lockedZones = [], zoneProgress = {} } = {}) {
  const locked = new Set(lockedZones)
  if (locked.size > 0) {
    return Object.freeze({ destinationId: 'Music', reason: 'prerequisite', arrived: false })
  }

  const destinationId = WORLD_OBJECTIVE_ORDER.find(zone => Number(zoneProgress[zone] || 0) < 1) ?? null
  return Object.freeze({
    destinationId,
    reason: destinationId ? 'incomplete-zone' : 'complete',
    arrived: false,
  })
}

export function withWorldObjectiveArrival(objective, playerFoot) {
  if (!objective?.destinationId) return objective
  const destination = WORLD_MINIMAP_DESTINATIONS.find(candidate => candidate.id === objective.destinationId)
  if (!destination) return objective
  const dx = Math.abs(Number(playerFoot?.x) - destination.worldPoint.x)
  const dy = Math.abs(Number(playerFoot?.y) - destination.worldPoint.y)
  return Object.freeze({
    ...objective,
    arrived: dx <= WORLD_INTERACTION_HALF_WIDTH && dy <= WORLD_INTERACTION_HALF_HEIGHT,
  })
}
