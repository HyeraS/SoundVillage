import assert from 'node:assert/strict'
import {
  WORLD_PLAYER,
  WORLD_WALKABLE_MASK_META,
  isWorldPlayerWalkable,
  isWorldWalkableMaskCell,
  moveWorldPlayer,
  worldPlayerFootCenter,
} from '../lib/worldMapGeometry.mjs'

const MASK = WORLD_WALKABLE_MASK_META
const cellIndex = (x, y) => y * MASK.width + x
const anchors = Object.freeze({
  spawn: { x: 1920, y: 1504 },
  approach: { x: 1648, y: 1760 },
  eastRoad: { x: 1824, y: 1760 },
  westRing: { x: 1344, y: 1760 },
  northRoad: { x: 1648, y: 1344 },
  southRoad: { x: 1648, y: 2080 },
})

const toCell = point => ({
  x: Math.floor(point.x / MASK.cellSize),
  y: Math.floor(point.y / MASK.cellSize),
})

const topLeftAtCell = cell => ({
  x: (cell.x + 0.5) * MASK.cellSize - WORLD_PLAYER.width / 2,
  y: (cell.y + 0.5) * MASK.cellSize - WORLD_PLAYER.height + WORLD_PLAYER.footHeight / 2,
})

function findPath(from, to) {
  const start = toCell(from)
  const end = toCell(to)
  const parent = new Int32Array(MASK.width * MASK.height)
  parent.fill(-2)
  const queueX = new Int16Array(MASK.width * MASK.height)
  const queueY = new Int16Array(MASK.width * MASK.height)
  let head = 0
  let tail = 1
  queueX[0] = start.x
  queueY[0] = start.y
  parent[cellIndex(start.x, start.y)] = -1
  while (head < tail && parent[cellIndex(end.x, end.y)] === -2) {
    const x = queueX[head]
    const y = queueY[head]
    head += 1
    const current = cellIndex(x, y)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= MASK.width || ny >= MASK.height) continue
      const next = cellIndex(nx, ny)
      if (parent[next] !== -2 || !isWorldWalkableMaskCell(nx, ny)) continue
      parent[next] = current
      queueX[tail] = nx
      queueY[tail] = ny
      tail += 1
    }
  }
  assert.notEqual(parent[cellIndex(end.x, end.y)], -2, `route ${from.x},${from.y} -> ${to.x},${to.y} exists`)
  const path = []
  for (let current = cellIndex(end.x, end.y); current >= 0; current = parent[current]) {
    const y = Math.floor(current / MASK.width)
    path.push({ x: current - y * MASK.width, y })
  }
  return path.reverse()
}

function drive(from, to) {
  const cells = findPath(from, to)
  let position = topLeftAtCell(cells[0])
  let stalledFrames = 0
  for (const cell of cells.slice(1)) {
    const target = topLeftAtCell(cell)
    const moved = moveWorldPlayer(position, target.x - position.x, target.y - position.y)
    if (!moved.moved) stalledFrames += 1
    assert.ok(isWorldPlayerWalkable(moved.x, moved.y), 'route stays on the production clearance mask')
    position = { x: moved.x, y: moved.y }
  }
  const foot = worldPlayerFootCenter(position.x, position.y)
  const expected = {
    x: (cells.at(-1).x + 0.5) * MASK.cellSize,
    y: (cells.at(-1).y + 0.5) * MASK.cellSize,
  }
  assert.ok(Math.hypot(foot.x - expected.x, foot.y - expected.y) < 0.75, 'route reaches its final mask cell')
  assert.equal(stalledFrames, 0, 'route has zero stalled frames')
  return { pathCells: cells.length, stalledFrames }
}

const cases = Object.freeze([
  { id: 'spawn-to-home', directions: [['spawn', 'approach']] },
  { id: 'east-road-to-approach', directions: [['eastRoad', 'approach']] },
  { id: 'west-ring-to-approach', directions: [['westRing', 'approach']] },
  { id: 'approach-to-east-road', directions: [['approach', 'eastRoad']] },
  { id: 'approach-to-west-ring', directions: [['approach', 'westRing']] },
  { id: 'north-south-bidirectional', directions: [['northRoad', 'southRoad'], ['southRoad', 'northRoad']] },
  { id: 'west-east-bidirectional', directions: [['westRing', 'eastRoad'], ['eastRoad', 'westRing']] },
])

const results = {}
for (const routeCase of cases) {
  results[routeCase.id] = routeCase.directions.map(([from, to]) => ({
    from,
    to,
    ...drive(anchors[from], anchors[to]),
  }))
}

console.log(JSON.stringify({ status: 'PASS', anchors, cases: results }, null, 2))
