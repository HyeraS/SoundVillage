import {
  MAP_H,
  MAP_W,
  PLAYER_BOX,
  SPAWN,
  T,
} from './labVillageConfig.mjs'
import { isMaskCellWalkable } from './generated/labWalkableMask.generated.mjs'

export const LAB_COLLISION_MASK_CELL_SIZE = 4
export const LAB_WORLD_WIDTH = MAP_W * T
export const LAB_WORLD_HEIGHT = MAP_H * T
export const LAB_COLLISION_MASK_COLUMNS = LAB_WORLD_WIDTH / LAB_COLLISION_MASK_CELL_SIZE
export const LAB_COLLISION_MASK_ROWS = LAB_WORLD_HEIGHT / LAB_COLLISION_MASK_CELL_SIZE
export const LAB_COLLISION_PLAYER_BOX = PLAYER_BOX
export const LAB_COLLISION_SPAWN = SPAWN

export function createLabRuntimeCollisionMask() {
  const mask = new Uint8Array(LAB_COLLISION_MASK_COLUMNS * LAB_COLLISION_MASK_ROWS)
  for (let row = 0; row < LAB_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < LAB_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * LAB_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) ? 1 : 0
    }
  }

  return mask
}
