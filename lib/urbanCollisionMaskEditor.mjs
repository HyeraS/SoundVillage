import { WORLD_HEIGHT, WORLD_WIDTH } from './urbanV3WorldConfig.mjs'
import { isUrbanV3MaskCellWalkable } from './urbanV3WalkableMask.generated.mjs'

export const URBAN_COLLISION_MASK_CELL_SIZE = 2
export const URBAN_COLLISION_MASK_COLUMNS = WORLD_WIDTH / URBAN_COLLISION_MASK_CELL_SIZE
export const URBAN_COLLISION_MASK_ROWS = WORLD_HEIGHT / URBAN_COLLISION_MASK_CELL_SIZE

export function createUrbanRuntimeCollisionMask() {
  const mask = new Uint8Array(URBAN_COLLISION_MASK_COLUMNS * URBAN_COLLISION_MASK_ROWS)
  for (let row = 0; row < URBAN_COLLISION_MASK_ROWS; row += 1) {
    for (let column = 0; column < URBAN_COLLISION_MASK_COLUMNS; column += 1) {
      mask[row * URBAN_COLLISION_MASK_COLUMNS + column] = isUrbanV3MaskCellWalkable(column, row) ? 1 : 0
    }
  }
  return mask
}
