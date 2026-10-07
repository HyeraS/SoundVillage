import {
  MAP_H,
  MAP_W,
  PLAYER_BOX,
  SPAWN,
  T,
} from './humanVillageConfig.mjs'
import { isMaskCellWalkable } from './generated/humanWalkableMask.generated.mjs'

export const HUMAN_COLLISION_MASK_CELL_SIZE = 4
export const HUMAN_WORLD_WIDTH = MAP_W * T
export const HUMAN_WORLD_HEIGHT = MAP_H * T
export const HUMAN_COLLISION_MASK_COLUMNS = HUMAN_WORLD_WIDTH / HUMAN_COLLISION_MASK_CELL_SIZE
export const HUMAN_COLLISION_MASK_ROWS = HUMAN_WORLD_HEIGHT / HUMAN_COLLISION_MASK_CELL_SIZE
export const HUMAN_COLLISION_PLAYER_BOX = PLAYER_BOX
export const HUMAN_COLLISION_SPAWN = SPAWN

export function createHumanRuntimeCollisionMask() {
  const mask = new Uint8Array(HUMAN_COLLISION_MASK_COLUMNS * HUMAN_COLLISION_MASK_ROWS)

  for (let row = 0; row < HUMAN_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < HUMAN_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * HUMAN_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) ? 1 : 0
    }
  }

  return mask
}
