import {
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

export function createAnimalRuntimeCollisionMask() {
  const mask = new Uint8Array(ANIMAL_COLLISION_MASK_COLUMNS * ANIMAL_COLLISION_MASK_ROWS)
  for (let row = 0; row < ANIMAL_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < ANIMAL_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * ANIMAL_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) ? 1 : 0
    }
  }
  return mask
}
