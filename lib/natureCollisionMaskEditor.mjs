import {
  MAP_H,
  MAP_W,
  T,
  buildNatureFarmModel,
} from './natureFarmLayout.mjs'
import { isMaskCellWalkable } from './generated/natureWalkableMask.generated.mjs'

export const NATURE_COLLISION_MASK_CELL_SIZE = 4
export const NATURE_WORLD_WIDTH = MAP_W * T
export const NATURE_WORLD_HEIGHT = MAP_H * T
export const NATURE_COLLISION_MASK_COLUMNS = NATURE_WORLD_WIDTH / NATURE_COLLISION_MASK_CELL_SIZE
export const NATURE_COLLISION_MASK_ROWS = NATURE_WORLD_HEIGHT / NATURE_COLLISION_MASK_CELL_SIZE

const pointInRect = (x, y, rect) => (
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
)

export function createNatureRuntimeCollisionMask() {
  const model = buildNatureFarmModel()
  const mask = new Uint8Array(NATURE_COLLISION_MASK_COLUMNS * NATURE_COLLISION_MASK_ROWS)

  for (let row = 0; row < NATURE_COLLISION_MASK_ROWS; row += 1) {
    const worldY = row * NATURE_COLLISION_MASK_CELL_SIZE + NATURE_COLLISION_MASK_CELL_SIZE / 2
    for (let column = 0; column < NATURE_COLLISION_MASK_COLUMNS; column += 1) {
      const worldX = column * NATURE_COLLISION_MASK_CELL_SIZE + NATURE_COLLISION_MASK_CELL_SIZE / 2
      const blockedByPixelCollider = model.pixelColliders.some((collider) => pointInRect(worldX, worldY, collider))
      mask[row * NATURE_COLLISION_MASK_COLUMNS + column] = isMaskCellWalkable(column, row) && !blockedByPixelCollider ? 1 : 0
    }
  }

  return mask
}
