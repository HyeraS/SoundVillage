import {
  COLLIDERS,
  PLAYER_BOX,
  SPAWN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './animalVillageSunflowerConfig.mjs'
import { isMaskCellWalkable } from './generated/animalWalkableMask.generated.mjs'

export const ANIMAL_COLLISION_MASK_CELL_SIZE = 4
export const ANIMAL_WORLD_WIDTH = WORLD_WIDTH
export const ANIMAL_WORLD_HEIGHT = WORLD_HEIGHT
export const ANIMAL_COLLISION_MASK_COLUMNS = WORLD_WIDTH / ANIMAL_COLLISION_MASK_CELL_SIZE
export const ANIMAL_COLLISION_MASK_ROWS = WORLD_HEIGHT / ANIMAL_COLLISION_MASK_CELL_SIZE
export const ANIMAL_COLLISION_PLAYER_BOX = PLAYER_BOX
export const ANIMAL_COLLISION_SPAWN = SPAWN

function paintRect(mask, rect, value) {
  const firstColumn = Math.max(0, Math.floor(rect.x / ANIMAL_COLLISION_MASK_CELL_SIZE))
  const lastColumn = Math.min(
    ANIMAL_COLLISION_MASK_COLUMNS - 1,
    Math.ceil((rect.x + rect.w) / ANIMAL_COLLISION_MASK_CELL_SIZE) - 1,
  )
  const firstRow = Math.max(0, Math.floor(rect.y / ANIMAL_COLLISION_MASK_CELL_SIZE))
  const lastRow = Math.min(
    ANIMAL_COLLISION_MASK_ROWS - 1,
    Math.ceil((rect.y + rect.h) / ANIMAL_COLLISION_MASK_CELL_SIZE) - 1,
  )

  for (let row = firstRow; row <= lastRow; row += 1) {
    const worldY = row * ANIMAL_COLLISION_MASK_CELL_SIZE + ANIMAL_COLLISION_MASK_CELL_SIZE / 2
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const worldX = column * ANIMAL_COLLISION_MASK_CELL_SIZE + ANIMAL_COLLISION_MASK_CELL_SIZE / 2
      if (worldX >= rect.x && worldX < rect.x + rect.w && worldY >= rect.y && worldY < rect.y + rect.h) {
        mask[row * ANIMAL_COLLISION_MASK_COLUMNS + column] = value
      }
    }
  }
}

export function createAnimalRuntimeCollisionMask() {
  const mask = new Uint8Array(ANIMAL_COLLISION_MASK_COLUMNS * ANIMAL_COLLISION_MASK_ROWS)
  for (let row = 0; row < ANIMAL_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < ANIMAL_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * ANIMAL_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) ? 1 : 0
    }
  }
  for (const collider of COLLIDERS) paintRect(mask, collider, 0)
  return mask
}
