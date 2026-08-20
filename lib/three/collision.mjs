export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function circleIntersectsAabb(position, radius, collider) {
  const halfX = collider.size[0] / 2
  const halfZ = collider.size[1] / 2
  const closestX = clamp(position.x, collider.position[0] - halfX, collider.position[0] + halfX)
  const closestZ = clamp(position.z, collider.position[1] - halfZ, collider.position[1] + halfZ)
  const dx = position.x - closestX
  const dz = position.z - closestZ
  return dx * dx + dz * dz < radius * radius
}

export function isPositionWalkable(position, radius, bounds, colliders) {
  if (
    position.x - radius < bounds.minX ||
    position.x + radius > bounds.maxX ||
    position.z - radius < bounds.minZ ||
    position.z + radius > bounds.maxZ
  ) return false

  return !colliders.some(collider => circleIntersectsAabb(position, radius, collider))
}

export function moveWithCollisions(position, delta, radius, bounds, colliders) {
  const next = { ...position }
  const xCandidate = { x: position.x + delta.x, z: position.z }
  if (isPositionWalkable(xCandidate, radius, bounds, colliders)) next.x = xCandidate.x

  const zCandidate = { x: next.x, z: position.z + delta.z }
  if (isPositionWalkable(zCandidate, radius, bounds, colliders)) next.z = zCandidate.z
  return next
}

