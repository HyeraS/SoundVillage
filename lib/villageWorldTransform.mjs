const finitePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be a positive finite number`)
  return value
}

export function createWorldTransform({
  baseWorldWidth,
  baseWorldHeight,
  currentWorldWidth = baseWorldWidth,
  currentWorldHeight = baseWorldHeight,
}) {
  const baseWidth = finitePositive(baseWorldWidth, 'baseWorldWidth')
  const baseHeight = finitePositive(baseWorldHeight, 'baseWorldHeight')
  const currentWidth = finitePositive(currentWorldWidth, 'currentWorldWidth')
  const currentHeight = finitePositive(currentWorldHeight, 'currentWorldHeight')
  return Object.freeze({
    baseWorldWidth: baseWidth,
    baseWorldHeight: baseHeight,
    currentWorldWidth: currentWidth,
    currentWorldHeight: currentHeight,
    scaleX: currentWidth / baseWidth,
    scaleY: currentHeight / baseHeight,
  })
}

export function normalizeWorldPoint(worldX, worldY, transform) {
  return {
    x: worldX / transform.currentWorldWidth,
    y: worldY / transform.currentWorldHeight,
  }
}

const snapNearInteger = (value) => {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) < 1e-9 ? rounded : value
}

export function worldPointToMaskCell(worldX, worldY, transform, maskWidth, maskHeight) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)
    || worldX < 0 || worldY < 0
    || worldX >= transform.currentWorldWidth || worldY >= transform.currentWorldHeight) return null
  const normalized = normalizeWorldPoint(worldX, worldY, transform)
  return {
    column: Math.min(maskWidth - 1, Math.floor(snapNearInteger(normalized.x * maskWidth))),
    row: Math.min(maskHeight - 1, Math.floor(snapNearInteger(normalized.y * maskHeight))),
  }
}

export function currentPointToBase(point, transform) {
  return { x: point.x / transform.scaleX, y: point.y / transform.scaleY }
}

export function basePointToCurrent(point, transform) {
  return { x: point.x * transform.scaleX, y: point.y * transform.scaleY }
}

export function baseRectToCurrent(rect, transform) {
  return {
    ...rect,
    x: rect.x * transform.scaleX,
    y: rect.y * transform.scaleY,
    w: rect.w * transform.scaleX,
    h: rect.h * transform.scaleY,
  }
}

export function currentRectToBase(rect, transform) {
  return {
    ...rect,
    x: rect.x / transform.scaleX,
    y: rect.y / transform.scaleY,
    w: rect.w / transform.scaleX,
    h: rect.h / transform.scaleY,
  }
}

export function basePolygonToCurrent(points, transform) {
  return points.map((point) => basePointToCurrent(point, transform))
}

export function worldPointToScreen(point, camera) {
  const zoomX = camera.zoomX ?? camera.zoom ?? 1
  const zoomY = camera.zoomY ?? camera.zoom ?? 1
  return {
    x: (point.x - (camera.x ?? camera.cameraX ?? 0)) * zoomX + (camera.offsetX ?? 0),
    y: (point.y - (camera.y ?? camera.cameraY ?? 0)) * zoomY + (camera.offsetY ?? 0),
  }
}

export function screenPointToWorld(point, camera) {
  const zoomX = camera.zoomX ?? camera.zoom ?? 1
  const zoomY = camera.zoomY ?? camera.zoom ?? 1
  return {
    x: (point.x - (camera.offsetX ?? 0)) / zoomX + (camera.x ?? camera.cameraX ?? 0),
    y: (point.y - (camera.offsetY ?? 0)) / zoomY + (camera.y ?? camera.cameraY ?? 0),
  }
}

export function playerFootRectAt(position, baseFootprint, transform) {
  const width = baseFootprint.w * transform.scaleX
  const height = baseFootprint.h * transform.scaleY
  return { x: position.x - width / 2, y: position.y - height, w: width, h: height }
}

export function worldRectToMaskBounds(rect, transform, maskWidth, maskHeight) {
  if (rect.x < 0 || rect.y < 0
    || rect.x + rect.w > transform.currentWorldWidth
    || rect.y + rect.h > transform.currentWorldHeight) return null
  const left = snapNearInteger(rect.x / transform.currentWorldWidth * maskWidth)
  const right = snapNearInteger((rect.x + rect.w) / transform.currentWorldWidth * maskWidth)
  const top = snapNearInteger(rect.y / transform.currentWorldHeight * maskHeight)
  const bottom = snapNearInteger((rect.y + rect.h) / transform.currentWorldHeight * maskHeight)
  return {
    firstColumn: Math.max(0, Math.floor(left)),
    lastColumn: Math.min(maskWidth - 1, Math.ceil(right) - 1),
    firstRow: Math.max(0, Math.floor(top)),
    lastRow: Math.min(maskHeight - 1, Math.ceil(bottom) - 1),
  }
}

export function canOccupyMask(maskCellWalkable, maskMetadata, position, baseFootprint, transform) {
  const foot = playerFootRectAt(position, baseFootprint, transform)
  const bounds = worldRectToMaskBounds(foot, transform, maskMetadata.width, maskMetadata.height)
  if (!bounds) return false
  for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
    for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
      if (!maskCellWalkable(column, row)) return false
    }
  }
  return true
}

export function rectsOverlap(left, right) {
  return left.x < right.x + right.w && left.x + left.w > right.x
    && left.y < right.y + right.h && left.y + left.h > right.y
}

export function findScaledRectCollision(baseRects, currentRect, transform) {
  return baseRects.find((rect) => rectsOverlap(currentRect, baseRectToCurrent(rect, transform))) || null
}

export function projectGeometry(value, transform) {
  if (Array.isArray(value)) return value.map((entry) => projectGeometry(entry, transform))
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value.points)) {
    return { ...value, points: basePolygonToCurrent(value.points, transform) }
  }
  if (Number.isFinite(value.x) && Number.isFinite(value.y)
    && Number.isFinite(value.w) && Number.isFinite(value.h)) return baseRectToCurrent(value, transform)
  if (Number.isFinite(value.x) && Number.isFinite(value.y)) {
    const projected = { ...value, ...basePointToCurrent(value, transform) }
    if (Number.isFinite(value.radius)) {
      projected.radiusX = value.radius * transform.scaleX
      projected.radiusY = value.radius * transform.scaleY
      if (transform.scaleX === transform.scaleY) projected.radius = value.radius * transform.scaleX
    }
    return projected
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, projectGeometry(entry, transform)]))
}
