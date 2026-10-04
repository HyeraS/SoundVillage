import {
  WORLD_WALKABLE_MASK_BASE64,
  WORLD_WALKABLE_MASK_META,
} from './worldWalkableMaskData.mjs'
import { worldMapV4BlockingReasonAt } from './worldMapCollision.mjs'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_LOGICAL_DESTINATIONS,
} from './worldMapV4Manifest.mjs'

export const WORLD_MAP_TILE_SIZE = WORLD_MAP_V4.tileSize
export const WORLD_MAP_WIDTH_TILES = WORLD_MAP_V4.widthTiles
export const WORLD_MAP_HEIGHT_TILES = WORLD_MAP_V4.heightTiles
export const WORLD_MAP_WIDTH_PX = WORLD_MAP_V4.width
export const WORLD_MAP_HEIGHT_PX = WORLD_MAP_V4.height

export const WORLD_PLAYER = Object.freeze({ width: 72, height: 88, footWidth: 28, footHeight: 16 })
export const WORLD_SPAWN = Object.freeze({ tx: 60, ty: 47 })
export const WORLD_COLLISION_SUBSTEP_PX = 3
export const WORLD_INTERACTION_HALF_WIDTH = 64
export const WORLD_INTERACTION_HALF_HEIGHT = 48
export { WORLD_WALKABLE_MASK_META }

export const WORLD_PORTALS = Object.freeze(
  WORLD_MAP_V4_LOGICAL_DESTINATIONS.filter(destination => destination.kind === 'zone').map(destination => destination.target),
)
export const WORLD_MUSEUM = WORLD_MAP_V4_LOGICAL_DESTINATIONS.find(destination => destination.id === 'Sound Library').target
export const WORLD_HOME = WORLD_MAP_V4_LOGICAL_DESTINATIONS.find(destination => destination.id === 'Home').target

const maskBytes = Uint8Array.from(atob(WORLD_WALKABLE_MASK_BASE64), character => character.charCodeAt(0))

export function isWorldWalkableMaskCell(cellX, cellY) {
  const x = Math.floor(cellX)
  const y = Math.floor(cellY)
  if (x < 0 || y < 0 || x >= WORLD_WALKABLE_MASK_META.width || y >= WORLD_WALKABLE_MASK_META.height) return false
  const bitIndex = y * WORLD_WALKABLE_MASK_META.width + x
  return Boolean(maskBytes[bitIndex >> 3] & (1 << (bitIndex & 7)))
}

export function isWorldWalkableWorldPoint(worldX, worldY) {
  return isWorldWalkableMaskCell(
    worldX / WORLD_WALKABLE_MASK_META.cellSize,
    worldY / WORLD_WALKABLE_MASK_META.cellSize,
  )
}

export function isWorldWalkablePoint(tx, ty, tileSize = WORLD_MAP_TILE_SIZE) {
  return isWorldWalkableWorldPoint(tx * tileSize, ty * tileSize)
}

export function worldPlayerTopLeftAtFoot(tx, ty, tileSize = WORLD_MAP_TILE_SIZE) {
  return {
    x: tx * tileSize - WORLD_PLAYER.width / 2,
    y: ty * tileSize - WORLD_PLAYER.height + WORLD_PLAYER.footHeight / 2,
  }
}

export function worldPlayerFootCenter(px, py) {
  return {
    x: px + WORLD_PLAYER.width / 2,
    y: py + WORLD_PLAYER.height - WORLD_PLAYER.footHeight / 2,
  }
}

// The mask is already eroded for the complete 28x16 foot area. Runtime
// collision therefore needs one stable foot-center lookup instead of two edge
// samples that can disagree on curves.
export function isWorldPlayerWalkable(px, py) {
  const foot = worldPlayerFootCenter(px, py)
  return isWorldWalkableWorldPoint(foot.x, foot.y)
}

export function moveWorldPlayer(position, deltaX, deltaY, options = {}) {
  const substep = Math.max(1, options.substepPx ?? WORLD_COLLISION_SUBSTEP_PX)
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / substep))
  const stepX = deltaX / steps
  const stepY = deltaY / steps
  let x = position.x
  let y = position.y
  let blockedX = false
  let blockedY = false
  let blockedReason = ''

  for (let index = 0; index < steps; index += 1) {
    if (stepX) {
      const nextX = Math.max(0, Math.min(WORLD_MAP_WIDTH_PX - WORLD_PLAYER.width, x + stepX))
      if (nextX !== x && isWorldPlayerWalkable(nextX, y)) x = nextX
      else if (nextX !== x || deltaX) {
        blockedX = true
        const foot = worldPlayerFootCenter(nextX, y)
        blockedReason ||= worldMapV4BlockingReasonAt(foot.x, foot.y)
      }
    }
    if (stepY) {
      const nextY = Math.max(0, Math.min(WORLD_MAP_HEIGHT_PX - WORLD_PLAYER.height, y + stepY))
      if (nextY !== y && isWorldPlayerWalkable(x, nextY)) y = nextY
      else if (nextY !== y || deltaY) {
        blockedY = true
        const foot = worldPlayerFootCenter(x, nextY)
        blockedReason ||= worldMapV4BlockingReasonAt(foot.x, foot.y)
      }
    }
  }

  return {
    x,
    y,
    moved: x !== position.x || y !== position.y,
    blockedX,
    blockedY,
    blockedReason,
  }
}

export function worldDestinationHitbox(target, tileSize = WORLD_MAP_TILE_SIZE) {
  const interaction = worldDestinationInteractionPoint(target, tileSize)
  return {
    x: interaction.x - WORLD_INTERACTION_HALF_WIDTH,
    y: interaction.y - WORLD_INTERACTION_HALF_HEIGHT,
    w: WORLD_INTERACTION_HALF_WIDTH * 2,
    h: WORLD_INTERACTION_HALF_HEIGHT * 2,
  }
}

export function worldDestinationContainsFoot(position, target, tileSize = WORLD_MAP_TILE_SIZE) {
  const foot = worldPlayerFootCenter(position.x, position.y)
  const interaction = worldDestinationInteractionPoint(target, tileSize)
  return Math.abs(foot.x - interaction.x) <= WORLD_INTERACTION_HALF_WIDTH
    && Math.abs(foot.y - interaction.y) <= WORLD_INTERACTION_HALF_HEIGHT
}

export function worldDestinationInteractionPoint(target, tileSize = WORLD_MAP_TILE_SIZE) {
  if (target.approach) return target.approach
  return {
    x: (target.tx + target.w / 2) * tileSize,
    y: (target.ty + target.h) * tileSize,
  }
}

export function worldRectanglesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export const WORLD_DESTINATIONS = WORLD_MAP_V4_LOGICAL_DESTINATIONS
