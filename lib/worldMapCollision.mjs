import { WORLD_MAP_V4_COLLISION_OBJECTS as GENERATED_WORLD_MAP_V4_COLLISION_OBJECTS } from './generated/worldMapV4CollisionObjects.mjs'
import {
  WORLD_COLLISION_ROLES,
  validateCollisionObjects,
} from './worldMapCollisionContract.mjs'

export { WORLD_COLLISION_ROLES, validateCollisionObjects }

export const WORLD_COLLISION_CELL_SIZE = 4
export const WORLD_PLAYER_FOOT_CLEARANCE = Object.freeze({ halfWidth: 14, halfHeight: 8 })

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

// Collider declarations come from the generated projection. Geometry,
// rasterization, clearance, pooling and reason lookup remain in this module.
export const WORLD_MAP_V4_COLLISION_OBJECTS = deepFreeze(GENERATED_WORLD_MAP_V4_COLLISION_OBJECTS)

export function shapeBounds(shape) {
  if (shape.type === 'rect') return shape
  if (shape.type !== 'polygon' || shape.points.length < 3) throw new Error(`Unsupported collision shape: ${shape.type}`)
  const xs = shape.points.map(([x]) => x)
  const ys = shape.points.map(([, y]) => y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

export function pointInRectHalfOpen(x, y, shape) {
  return x >= shape.left && x < shape.right && y >= shape.top && y < shape.bottom
}

const pointOnSegment = (x, y, [ax, ay], [bx, by]) => {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
  if (Math.abs(cross) > 1e-9) return false
  return x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)
}

// Even/odd ray casting supports convex and concave polygons. On an exact
// boundary, the polygon's maximum X/Y edges are excluded so an axis-aligned
// polygon follows the same [left,right) × [top,bottom) contract as a rect.
export function pointInPolygonHalfOpen(x, y, shape) {
  const bounds = shapeBounds(shape)
  if (!pointInRectHalfOpen(x, y, bounds)) return false
  const points = shape.points
  for (let index = 0; index < points.length; index += 1) {
    if (pointOnSegment(x, y, points[index], points[(index + 1) % points.length])) return true
  }
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index]
    const [xj, yj] = points[previous]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function collisionShapeContainsPoint(shape, x, y) {
  if (shape.type === 'rect') return pointInRectHalfOpen(x, y, shape)
  if (shape.type === 'polygon') return pointInPolygonHalfOpen(x, y, shape)
  throw new Error(`Unsupported collision shape: ${shape.type}`)
}

export function isBlockingCollisionObject(object) {
  if (!WORLD_COLLISION_ROLES.includes(object.collisionRole)) throw new Error(`Unknown collision role: ${object.collisionRole}`)
  return object.collisionRole !== 'decorative-nonblocking'
}

export function rasterizeRawObstaclePixels(objects, width, height) {
  validateCollisionObjects(objects)
  const obstacle = new Uint8Array(width * height)
  for (const object of objects) {
    if (!isBlockingCollisionObject(object)) continue
    for (const shape of object.shapes) {
      const bounds = shapeBounds(shape)
      const minX = Math.max(0, Math.floor(bounds.left))
      const maxXExclusive = Math.min(width, Math.ceil(bounds.right))
      const minY = Math.max(0, Math.floor(bounds.top))
      const maxYExclusive = Math.min(height, Math.ceil(bounds.bottom))
      for (let y = minY; y < maxYExclusive; y += 1) {
        for (let x = minX; x < maxXExclusive; x += 1) {
          if (collisionShapeContainsPoint(shape, x + 0.5, y + 0.5)) obstacle[y * width + x] = 1
        }
      }
    }
  }
  return obstacle
}

export function dilateObstaclePixels(source, width, height, halfWidth, halfHeight) {
  const horizontal = new Uint8Array(source.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    let count = 0
    for (let x = 0; x <= Math.min(width - 1, halfWidth); x += 1) count += source[row + x]
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = count > 0 ? 1 : 0
      const addX = x + halfWidth + 1
      const removeX = x - halfWidth
      if (addX < width) count += source[row + addX]
      if (removeX >= 0) count -= source[row + removeX]
    }
  }

  const expanded = new Uint8Array(source.length)
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y <= Math.min(height - 1, halfHeight); y += 1) count += horizontal[y * width + x]
    for (let y = 0; y < height; y += 1) {
      expanded[y * width + x] = count > 0 ? 1 : 0
      const addY = y + halfHeight + 1
      const removeY = y - halfHeight
      if (addY < height) count += horizontal[addY * width + x]
      if (removeY >= 0) count -= horizontal[removeY * width + x]
    }
  }
  return expanded
}

export function maxPoolObstaclePixels(source, width, height, cellSize = WORLD_COLLISION_CELL_SIZE) {
  if (width % cellSize || height % cellSize) throw new Error('World dimensions must be divisible by collision cell size')
  const cellWidth = width / cellSize
  const cellHeight = height / cellSize
  const obstacle = new Uint8Array(cellWidth * cellHeight)
  for (let cellY = 0; cellY < cellHeight; cellY += 1) {
    for (let cellX = 0; cellX < cellWidth; cellX += 1) {
      let blocked = 0
      for (let offsetY = 0; offsetY < cellSize && !blocked; offsetY += 1) {
        const row = (cellY * cellSize + offsetY) * width + cellX * cellSize
        for (let offsetX = 0; offsetX < cellSize; offsetX += 1) {
          if (source[row + offsetX]) {
            blocked = 1
            break
          }
        }
      }
      obstacle[cellY * cellWidth + cellX] = blocked
    }
  }
  return { obstacle, width: cellWidth, height: cellHeight, cellSize }
}

export function buildCollisionMasks(objects, width, height, options = {}) {
  const cellSize = options.cellSize ?? WORLD_COLLISION_CELL_SIZE
  const halfWidth = options.halfWidth ?? WORLD_PLAYER_FOOT_CLEARANCE.halfWidth
  const halfHeight = options.halfHeight ?? WORLD_PLAYER_FOOT_CLEARANCE.halfHeight
  const rawObstacle = rasterizeRawObstaclePixels(objects, width, height)
  const clearanceObstacle = dilateObstaclePixels(rawObstacle, width, height, halfWidth, halfHeight)
  const cells = maxPoolObstaclePixels(clearanceObstacle, width, height, cellSize)
  return { rawObstacle, clearanceObstacle, ...cells }
}

export function blockingCollisionAtWorldPoint(x, y, options = {}) {
  const objects = options.objects ?? WORLD_MAP_V4_COLLISION_OBJECTS
  const cellSize = options.cellSize ?? WORLD_COLLISION_CELL_SIZE
  const halfWidth = options.halfWidth ?? WORLD_PLAYER_FOOT_CLEARANCE.halfWidth
  const halfHeight = options.halfHeight ?? WORLD_PLAYER_FOOT_CLEARANCE.halfHeight
  const cellX = Math.floor(x / cellSize)
  const cellY = Math.floor(y / cellSize)
  const minX = cellX * cellSize - halfWidth
  const maxXExclusive = (cellX + 1) * cellSize + halfWidth
  const minY = cellY * cellSize - halfHeight
  const maxYExclusive = (cellY + 1) * cellSize + halfHeight

  for (const object of objects) {
    if (!isBlockingCollisionObject(object)) continue
    for (const shape of object.shapes) {
      const bounds = shapeBounds(shape)
      if (bounds.right <= minX || bounds.left >= maxXExclusive || bounds.bottom <= minY || bounds.top >= maxYExclusive) continue
      const startX = Math.max(Math.floor(bounds.left), minX)
      const endX = Math.min(Math.ceil(bounds.right), maxXExclusive)
      const startY = Math.max(Math.floor(bounds.top), minY)
      const endY = Math.min(Math.ceil(bounds.bottom), maxYExclusive)
      for (let pixelY = startY; pixelY < endY; pixelY += 1) {
        for (let pixelX = startX; pixelX < endX; pixelX += 1) {
          if (collisionShapeContainsPoint(shape, pixelX + 0.5, pixelY + 0.5)) return object
        }
      }
    }
  }
  return null
}

export function worldMapV4BlockingReasonAt(x, y) {
  const collision = blockingCollisionAtWorldPoint(x, y)
  return collision ? `collision:${collision.objectId}:${collision.colliderId}` : 'world:boundary'
}
