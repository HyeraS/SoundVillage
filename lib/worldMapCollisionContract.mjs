// Pure collision declaration contract shared by build-time validation and the
// production collision engine. This module intentionally contains no runtime
// collider data and no generated-module imports.

export const WORLD_COLLISION_ROLES = Object.freeze([
  'building-body',
  'fence',
  'wall',
  'trunk',
  'furniture',
  'decorative-nonblocking',
])

function validationShapeBounds(shape) {
  if (shape.type === 'rect') return shape
  if (shape.type !== 'polygon' || shape.points.length < 3) throw new Error(`Unsupported collision shape: ${shape.type}`)
  const xs = shape.points.map(([x]) => x)
  const ys = shape.points.map(([, y]) => y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

export function validateCollisionObjects(objects) {
  const colliderIds = new Set()
  for (const object of objects) {
    if (!object.objectId || !object.colliderId || !Array.isArray(object.shapes) || object.shapes.length === 0) {
      throw new Error('Collision objects require objectId, colliderId, collisionRole and at least one shape')
    }
    if (colliderIds.has(object.colliderId)) throw new Error(`Duplicate colliderId: ${object.colliderId}`)
    colliderIds.add(object.colliderId)
    if (!WORLD_COLLISION_ROLES.includes(object.collisionRole)) throw new Error(`Unknown collision role: ${object.collisionRole}`)
    for (const shape of object.shapes) {
      const bounds = validationShapeBounds(shape)
      if (!(bounds.left < bounds.right && bounds.top < bounds.bottom)) throw new Error(`Empty collision shape in ${object.colliderId}`)
    }
  }
  return objects
}
