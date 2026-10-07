import {
  MAP_H,
  MAP_W,
  PLAYER_BOX,
  SPAWN,
  T,
  buildVillage,
} from './labVillageConfig.mjs'
import { isMaskCellWalkable } from './generated/labWalkableMask.generated.mjs'

export const LAB_COLLISION_MASK_CELL_SIZE = 4
export const LAB_WORLD_WIDTH = MAP_W * T
export const LAB_WORLD_HEIGHT = MAP_H * T
export const LAB_COLLISION_MASK_COLUMNS = LAB_WORLD_WIDTH / LAB_COLLISION_MASK_CELL_SIZE
export const LAB_COLLISION_MASK_ROWS = LAB_WORLD_HEIGHT / LAB_COLLISION_MASK_CELL_SIZE
export const LAB_COLLISION_PLAYER_BOX = PLAYER_BOX
export const LAB_COLLISION_SPAWN = SPAWN

function paintRect(mask, rect, value) {
  const firstColumn = Math.max(0, Math.floor(rect.x / LAB_COLLISION_MASK_CELL_SIZE))
  const lastColumn = Math.min(
    LAB_COLLISION_MASK_COLUMNS - 1,
    Math.ceil((rect.x + rect.w) / LAB_COLLISION_MASK_CELL_SIZE) - 1,
  )
  const firstRow = Math.max(0, Math.floor(rect.y / LAB_COLLISION_MASK_CELL_SIZE))
  const lastRow = Math.min(
    LAB_COLLISION_MASK_ROWS - 1,
    Math.ceil((rect.y + rect.h) / LAB_COLLISION_MASK_CELL_SIZE) - 1,
  )

  for (let row = firstRow; row <= lastRow; row += 1) {
    const worldY = row * LAB_COLLISION_MASK_CELL_SIZE + LAB_COLLISION_MASK_CELL_SIZE / 2
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const worldX = column * LAB_COLLISION_MASK_CELL_SIZE + LAB_COLLISION_MASK_CELL_SIZE / 2
      if (worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h) {
        mask[row * LAB_COLLISION_MASK_COLUMNS + column] = value
      }
    }
  }
}

export function createLabRuntimeCollisionMask() {
  const mask = new Uint8Array(LAB_COLLISION_MASK_COLUMNS * LAB_COLLISION_MASK_ROWS)
  for (let row = 0; row < LAB_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < LAB_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * LAB_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) ? 1 : 0
    }
  }

  const boundary = T * 0.4
  for (const rect of [
    { x: 0, y: 0, w: LAB_WORLD_WIDTH, h: boundary },
    { x: 0, y: LAB_WORLD_HEIGHT - boundary, w: LAB_WORLD_WIDTH, h: boundary },
    { x: 0, y: 0, w: boundary, h: LAB_WORLD_HEIGHT },
    { x: LAB_WORLD_WIDTH - boundary, y: 0, w: boundary, h: LAB_WORLD_HEIGHT },
  ]) paintRect(mask, rect, 0)

  for (const solid of buildVillage().solids) paintRect(mask, solid, 0)
  return mask
}
