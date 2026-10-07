import {
  OBJECT_COLLIDERS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  pointInRegion,
} from './urbanV3WorldConfig.mjs'
import { isUrbanV3MaskCellWalkable } from './urbanV3WalkableMask.generated.mjs'

export const URBAN_COLLISION_MASK_CELL_SIZE = 2
export const URBAN_COLLISION_MASK_COLUMNS = WORLD_WIDTH / URBAN_COLLISION_MASK_CELL_SIZE
export const URBAN_COLLISION_MASK_ROWS = WORLD_HEIGHT / URBAN_COLLISION_MASK_CELL_SIZE

function regionBounds(region) {
  if (!region.points) return region
  const xs = region.points.map((point) => point.x)
  const ys = region.points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function paintRegion(mask, region, value) {
  const bounds = regionBounds(region)
  const firstColumn = Math.max(0, Math.floor(bounds.x / URBAN_COLLISION_MASK_CELL_SIZE))
  const lastColumn = Math.min(
    URBAN_COLLISION_MASK_COLUMNS - 1,
    Math.ceil((bounds.x + bounds.w) / URBAN_COLLISION_MASK_CELL_SIZE) - 1,
  )
  const firstRow = Math.max(0, Math.floor(bounds.y / URBAN_COLLISION_MASK_CELL_SIZE))
  const lastRow = Math.min(
    URBAN_COLLISION_MASK_ROWS - 1,
    Math.ceil((bounds.y + bounds.h) / URBAN_COLLISION_MASK_CELL_SIZE) - 1,
  )

  for (let row = firstRow; row <= lastRow; row += 1) {
    const worldY = row * URBAN_COLLISION_MASK_CELL_SIZE + URBAN_COLLISION_MASK_CELL_SIZE / 2
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const worldX = column * URBAN_COLLISION_MASK_CELL_SIZE + URBAN_COLLISION_MASK_CELL_SIZE / 2
      if (pointInRegion(worldX, worldY, region)) {
        mask[row * URBAN_COLLISION_MASK_COLUMNS + column] = value
      }
    }
  }
}

export function createUrbanRuntimeCollisionMask() {
  const mask = new Uint8Array(URBAN_COLLISION_MASK_COLUMNS * URBAN_COLLISION_MASK_ROWS)
  for (let row = 0; row < URBAN_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < URBAN_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * URBAN_COLLISION_MASK_COLUMNS + column] = isUrbanV3MaskCellWalkable(column, row) ? 1 : 0
    }
  }
  for (const collider of OBJECT_COLLIDERS) paintRegion(mask, collider, 0)
  return mask
}
