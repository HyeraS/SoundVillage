import {
  createWorldTransform,
  playerFootRectAt,
  worldRectToMaskBounds,
} from './villageWorldTransform.mjs'

export function createCollisionMask(columns, rows, value = 1) {
  const width = Math.max(1, Math.floor(Number(columns) || 1))
  const height = Math.max(1, Math.floor(Number(rows) || 1))
  const mask = new Uint8Array(width * height)
  mask.fill(value ? 1 : 0)
  return mask
}

export function paintCollisionMaskStroke(mask, columns, rows, from, to, radius, value) {
  const next = new Uint8Array(mask)
  const x0 = Number(from?.x) || 0
  const y0 = Number(from?.y) || 0
  const x1 = Number(to?.x) || 0
  const y1 = Number(to?.y) || 0
  const brushRadius = Math.max(0, Number(radius) || 0)
  const distance = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, brushRadius * 0.45)))

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    const centerX = x0 + (x1 - x0) * progress
    const centerY = y0 + (y1 - y0) * progress
    const minX = Math.max(0, Math.floor(centerX - brushRadius))
    const maxX = Math.min(columns - 1, Math.ceil(centerX + brushRadius))
    const minY = Math.max(0, Math.floor(centerY - brushRadius))
    const maxY = Math.min(rows - 1, Math.ceil(centerY + brushRadius))

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (Math.hypot(x - centerX, y - centerY) <= brushRadius + 0.35) {
          next[y * columns + x] = value ? 1 : 0
        }
      }
    }
  }

  return next
}

export function canOccupyCollisionMask(mask, columns, rows, cellSize, player, footprint, worldSize = {}) {
  const scale = Math.max(1, Number(cellSize) || 1)
  const transform = createWorldTransform({
    baseWorldWidth: worldSize.baseWorldWidth ?? columns * scale,
    baseWorldHeight: worldSize.baseWorldHeight ?? rows * scale,
    currentWorldWidth: worldSize.currentWorldWidth ?? columns * scale,
    currentWorldHeight: worldSize.currentWorldHeight ?? rows * scale,
  })
  const foot = playerFootRectAt(
    { x: Number(player?.x) || 0, y: Number(player?.y) || 0 },
    { w: Math.max(0, Number(footprint?.width) || 0), h: Math.max(0, Number(footprint?.height) || 0) },
    transform,
  )
  const bounds = worldRectToMaskBounds(foot, transform, columns, rows)
  if (!bounds) return false

  for (let y = bounds.firstRow; y <= bounds.lastRow; y += 1) {
    for (let x = bounds.firstColumn; x <= bounds.lastColumn; x += 1) {
      if (mask[y * columns + x] !== 1) return false
    }
  }

  return true
}

export function moveOnCollisionMask(mask, columns, rows, cellSize, player, footprint, delta, worldSize = {}) {
  const next = { x: Number(player?.x) || 0, y: Number(player?.y) || 0 }
  const horizontal = { x: next.x + (Number(delta?.x) || 0), y: next.y }
  if (canOccupyCollisionMask(mask, columns, rows, cellSize, horizontal, footprint, worldSize)) next.x = horizontal.x
  const vertical = { x: next.x, y: next.y + (Number(delta?.y) || 0) }
  if (canOccupyCollisionMask(mask, columns, rows, cellSize, vertical, footprint, worldSize)) next.y = vertical.y
  return next
}

export function analyzeCollisionMask(mask, columns, rows) {
  const visited = new Uint8Array(mask.length)
  let walkableCells = 0
  let connectedAreas = 0
  let largestArea = 0
  const queue = new Int32Array(mask.length)

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 1) walkableCells += 1
    if (mask[index] !== 1 || visited[index]) continue

    connectedAreas += 1
    let head = 0
    let tail = 0
    let areaSize = 0
    queue[tail] = index
    tail += 1
    visited[index] = 1

    while (head < tail) {
      const current = queue[head]
      head += 1
      areaSize += 1
      const x = current % columns
      const y = Math.floor(current / columns)
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < columns ? current + 1 : -1,
        y > 0 ? current - columns : -1,
        y + 1 < rows ? current + columns : -1,
      ]

      for (const neighbor of neighbors) {
        if (neighbor < 0 || visited[neighbor] || mask[neighbor] !== 1) continue
        visited[neighbor] = 1
        queue[tail] = neighbor
        tail += 1
      }
    }

    largestArea = Math.max(largestArea, areaSize)
  }

  return {
    totalCells: columns * rows,
    walkableCells,
    blockedCells: columns * rows - walkableCells,
    connectedAreas,
    largestArea,
    largestAreaRatio: walkableCells ? largestArea / walkableCells : 0,
  }
}
