import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LISTENING_STATIONS,
  MUSEUM_ASSETS,
  MUSEUM_BOUNDS,
  MUSEUM_COLLISIONS,
  MUSEUM_EXIT_TRIGGER,
  MUSEUM_HARDWOOD_WAYPOINTS,
  MUSEUM_INTERACTIONS,
  MUSEUM_SPAWN,
  PLAYER_BODY,
  overlapsMuseumExitTrigger,
  rectsOverlap,
} from './soundMuseumFinalBLayout.mjs'

const playerRect = (x, y) => ({ x, y, width:PLAYER_BODY.width, height:PLAYER_BODY.height })
const blocked = (x, y) => MUSEUM_COLLISIONS.some(rect => rectsOverlap(playerRect(x, y), rect))

function pathExists(interactionId) {
  const step = 8
  const start = { x:Math.round(MUSEUM_SPAWN.x / step) * step, y:Math.round(MUSEUM_SPAWN.y / step) * step }
  const queue = [start]
  const seen = new Set([`${start.x},${start.y}`])
  while (queue.length) {
    const current = queue.shift()
    const body = playerRect(current.x, current.y)
    if (MUSEUM_INTERACTIONS.some(zone => zone.interactionId === interactionId && rectsOverlap(body, zone))) return true
    for (const [dx, dy] of [[step,0],[-step,0],[0,step],[0,-step]]) {
      const x = current.x + dx
      const y = current.y + dy
      if (x < MUSEUM_BOUNDS.minX || y < MUSEUM_BOUNDS.minY || x + PLAYER_BODY.width > MUSEUM_BOUNDS.maxX || y + PLAYER_BODY.height > MUSEUM_BOUNDS.maxY || blocked(x, y)) continue
      const key = `${x},${y}`
      if (!seen.has(key)) { seen.add(key); queue.push({ x, y }) }
    }
  }
  return false
}

function reachableFloorTiles() {
  const step = 8
  const start = { x:Math.round(MUSEUM_SPAWN.x / step) * step, y:Math.round(MUSEUM_SPAWN.y / step) * step }
  const queue = [start]
  const seen = new Set([`${start.x},${start.y}`])
  while (queue.length) {
    const current = queue.shift()
    for (const [dx, dy] of [[step,0],[-step,0],[0,step],[0,-step]]) {
      const x = current.x + dx
      const y = current.y + dy
      if (x < MUSEUM_BOUNDS.minX || y < MUSEUM_BOUNDS.minY || x + PLAYER_BODY.width > MUSEUM_BOUNDS.maxX || y + PLAYER_BODY.height > MUSEUM_BOUNDS.maxY || blocked(x, y)) continue
      const key = `${x},${y}`
      if (!seen.has(key)) { seen.add(key); queue.push({ x, y }) }
    }
  }
  return { step, seen }
}

test('entrance spawn is inside the world and collision free', () => {
  assert.equal(blocked(MUSEUM_SPAWN.x, MUSEUM_SPAWN.y), false)
  assert.equal(overlapsMuseumExitTrigger(MUSEUM_SPAWN), false, 'spawn must not immediately trigger the exit')
  assert.ok(MUSEUM_SPAWN.x >= MUSEUM_BOUNDS.minX && MUSEUM_SPAWN.y >= MUSEUM_BOUNDS.minY)
})

test('bottom entrance provides a reachable, collision-free exit trigger', () => {
  const { step, seen } = reachableFloorTiles()
  const reachableExitPosition = [...seen].some(key => {
    const [x, y] = key.split(',').map(Number)
    return overlapsMuseumExitTrigger({ x, y })
  })
  assert.equal(reachableExitPosition, true)
  assert.ok(MUSEUM_EXIT_TRIGGER.x >= MUSEUM_BOUNDS.minX)
  assert.ok(MUSEUM_EXIT_TRIGGER.x + MUSEUM_EXIT_TRIGGER.width <= MUSEUM_BOUNDS.maxX)
  assert.ok(MUSEUM_EXIT_TRIGGER.y + MUSEUM_EXIT_TRIGGER.height <= MUSEUM_BOUNDS.maxY)
  assert.equal(blocked(
    Math.round((MUSEUM_EXIT_TRIGGER.x + MUSEUM_EXIT_TRIGGER.width / 2) / step) * step,
    MUSEUM_BOUNDS.maxY - PLAYER_BODY.height,
  ), false)
})

test('flood fill reaches vote, exhibits, and shop from the entrance', () => {
  for (const interactionId of ['vote', 'exhibits', 'shop']) assert.equal(pathExists(interactionId), true, `${interactionId} must be reachable`)
})

test('every authored hardwood aisle remains connected to the entrance', () => {
  const { step, seen } = reachableFloorTiles()
  for (const point of MUSEUM_HARDWOOD_WAYPOINTS) {
    const x = Math.round(point.x / step) * step
    const y = Math.round(point.y / step) * step
    assert.equal(blocked(x, y), false, `${point.id} must be collision free`)
    assert.equal(seen.has(`${x},${y}`), true, `${point.id} must be reachable from the entrance`)
  }
})

test('the three functional interaction regions do not overlap', () => {
  const groups = Object.groupBy(MUSEUM_INTERACTIONS, zone => zone.interactionId)
  for (const [leftId, rightId] of [['vote','exhibits'], ['vote','shop'], ['exhibits','shop']]) {
    for (const left of groups[leftId]) for (const right of groups[rightId]) assert.equal(rectsOverlap(left, right), false, `${left.id} overlaps ${right.id}`)
  }
})

test('inventory counts and corridor widths match the authored room', () => {
  assert.equal(LISTENING_STATIONS.length, 5)
  assert.ok(968 - 704 >= PLAYER_BODY.width * 2, 'entrance corridor must be at least two players wide')
  assert.ok(1095 - 1040 >= PLAYER_BODY.width, 'center-right passage must fit the player')
})

test('depth modes preserve desk, shop, lounge and foreground roles', () => {
  const byId = Object.fromEntries(MUSEUM_ASSETS.map(asset => [asset.id, asset]))
  assert.equal(byId['left-listening-lounge'].zMode, 'footY')
  assert.equal(byId['curator-desk-ledger'].zMode, 'footY')
  assert.equal(byId['costume-shop'].zMode, 'footY')
  assert.equal(byId['foreground-rail-bookshelf'].zMode, 'foreground')
  assert.equal(byId['architecture-room-shell'].zMode, 'fixed')
  assert.equal(byId['owl-curator'].frameData.frames, 4)
})
