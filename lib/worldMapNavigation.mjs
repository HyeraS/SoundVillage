import {
  WORLD_DESTINATIONS,
  WORLD_PLAYER,
  WORLD_SPAWN,
  WORLD_WALKABLE_MASK_META,
  isWorldWalkableMaskCell,
  moveWorldPlayer,
  worldDestinationInteractionPoint,
  worldPlayerFootCenter,
  worldPlayerTopLeftAtFoot,
} from './worldMapGeometry.mjs'
import { WORLD_MAP_V4_PATHS as WORLD_MAP_V4_AUTHORED_PATHS } from './worldMapV4Manifest.mjs'
import { WORLD_MAP_FLAT_V2_HOME } from './worldMapFlatV2.mjs'
import { WORLD_MAP_RENDER_MODE, WORLD_MAP_RENDER_MODES } from './worldMapMode.mjs'

const MASK = WORLD_WALKABLE_MASK_META
const cellIndex = (x, y) => y * MASK.width + x
let navigationTree = null
const routeCache = new Map()

function buildNavigationTree() {
  if (navigationTree) return navigationTree
  const startX = Math.floor(WORLD_SPAWN.tx * 32 / MASK.cellSize)
  const startY = Math.floor(WORLD_SPAWN.ty * 32 / MASK.cellSize)
  const startIndex = cellIndex(startX, startY)
  const seen = new Uint8Array(MASK.width * MASK.height)
  const parent = new Int32Array(MASK.width * MASK.height)
  parent.fill(-1)
  const queueX = new Int16Array(MASK.width * MASK.height)
  const queueY = new Int16Array(MASK.width * MASK.height)
  seen[startIndex] = 1
  queueX[0] = startX
  queueY[0] = startY
  let head = 0
  let tail = 1
  while (head < tail) {
    const x = queueX[head]
    const y = queueY[head]
    const current = cellIndex(x, y)
    head += 1
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= MASK.width || ny >= MASK.height) continue
      const next = cellIndex(nx, ny)
      if (seen[next] || !isWorldWalkableMaskCell(nx, ny)) continue
      seen[next] = 1
      parent[next] = current
      queueX[tail] = nx
      queueY[tail] = ny
      tail += 1
    }
  }
  navigationTree = { seen, parent, reachableCells: tail }
  return navigationTree
}

function nearestReachableCell(point, seen) {
  const targetX = Math.floor(point.x / MASK.cellSize)
  const targetY = Math.floor(point.y / MASK.cellSize)
  for (let radius = 0; radius <= 64; radius += 1) {
    let best = null
    for (let y = Math.max(0, targetY - radius); y <= Math.min(MASK.height - 1, targetY + radius); y += 1) {
      for (let x = Math.max(0, targetX - radius); x <= Math.min(MASK.width - 1, targetX + radius); x += 1) {
        if (Math.max(Math.abs(x - targetX), Math.abs(y - targetY)) !== radius || !seen[cellIndex(x, y)]) continue
        const distance = (x - targetX) ** 2 + (y - targetY) ** 2
        if (!best || distance < best.distance) best = { x, y, distance }
      }
    }
    if (best) return best
  }
  throw new Error(`No reachable navigation cell near ${point.x},${point.y}`)
}

function reconstructCells(end, parent) {
  const cells = []
  let current = cellIndex(end.x, end.y)
  while (current >= 0) {
    const y = Math.floor(current / MASK.width)
    const x = current - y * MASK.width
    cells.push({ x, y })
    current = parent[current]
  }
  return cells.reverse()
}

const footPointForCell = cell => ({
  x: (cell.x + 0.5) * MASK.cellSize,
  y: (cell.y + 0.5) * MASK.cellSize,
})

function topLeftAtFootPoint(point) {
  return {
    x: point.x - WORLD_PLAYER.width / 2,
    y: point.y - WORLD_PLAYER.height + WORLD_PLAYER.footHeight / 2,
  }
}

function canMoveDirect(fromFoot, toFoot) {
  const start = topLeftAtFootPoint(fromFoot)
  const moved = moveWorldPlayer(start, toFoot.x - fromFoot.x, toFoot.y - fromFoot.y)
  const endFoot = worldPlayerFootCenter(moved.x, moved.y)
  return Math.hypot(endFoot.x - toFoot.x, endFoot.y - toFoot.y) < 0.75
}

function simplifyMaskPath(points) {
  if (points.length <= 2) return points
  const simplified = [points[0]]
  let anchor = 0
  while (anchor < points.length - 1) {
    let next = Math.min(points.length - 1, anchor + 64)
    while (next > anchor + 1 && !canMoveDirect(points[anchor], points[next])) next -= 1
    simplified.push(points[next])
    anchor = next
  }
  return simplified
}

export function getWorldNavigationRoute(destinationId) {
  if (routeCache.has(destinationId)) return routeCache.get(destinationId)
  const destination = WORLD_DESTINATIONS.find(candidate => candidate.id === destinationId || candidate.zone === destinationId)
  if (!destination) return null
  const { seen, parent, reachableCells } = buildNavigationTree()
  const interaction = worldDestinationInteractionPoint(destination.target)
  const end = nearestReachableCell(interaction, seen)
  const rawPoints = reconstructCells(end, parent).map(footPointForCell)
  const spawn = { x: WORLD_SPAWN.tx * 32, y: WORLD_SPAWN.ty * 32 }
  rawPoints[0] = spawn
  if (canMoveDirect(rawPoints.at(-1), interaction)) rawPoints.push(interaction)
  const points = simplifyMaskPath(rawPoints)
  const authored = WORLD_MAP_V4_AUTHORED_PATHS.find(route => route.id === `spoke-${String(destinationId).toLowerCase().replace('sound ', '')}`)
  const authoredPoints = destination.id === 'Home' && WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2
    ? WORLD_MAP_FLAT_V2_HOME.guidePath
    : authored?.points
  const route = Object.freeze({
    id: `spoke-${String(destinationId).toLowerCase().replace('sound ', '')}`,
    destination: destination.id,
    points: Object.freeze(points.map(point => Object.freeze(point))),
    source: 'walkable-clearance-mask',
    authoredPoints: authoredPoints ?? Object.freeze([spawn, interaction]),
    reachableCells,
  })
  routeCache.set(destinationId, route)
  return route
}

export function getAllWorldNavigationRoutes() {
  return WORLD_DESTINATIONS.map(destination => getWorldNavigationRoute(destination.id))
}
