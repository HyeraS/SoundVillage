export const T = 32
export const MAP_W = 48
export const MAP_H = 36
export const PLAYER_BOX = Object.freeze({ w: 20, h: 14 })
export const INTERACTION_BOX = Object.freeze({ w: 28, h: 28 })
export const HUMAN_LAYER_Z = Object.freeze({
  background: 0,
  ambience: 1,
  markers: 2,
  foreground: 4,
  player: 5,
  prompt: 6,
})

const rect = (x, y, w, h, tag, extra = {}) => Object.freeze({ x, y, w, h, tag, ...extra })
const freezeRects = (items) => Object.freeze(items.map(Object.freeze))
const object = (id, d, colliders) => Object.freeze({ id, d, colliders: freezeRects(colliders) })
const footprintWithDoor = (x, y, w, h, doorX, doorW, tag) => {
  const frontY = y + h - 1
  const leftW = Math.max(0, doorX - x)
  const rightX = doorX + doorW
  const rightW = Math.max(0, x + w - rightX)
  return [
    ...(h > 1 ? [rect(x, y, w, h - 1, `${tag}-body`)] : []),
    ...(leftW ? [rect(x, frontY, leftW, 1, `${tag}-front-left`)] : []),
    ...(rightW ? [rect(rightX, frontY, rightW, 1, `${tag}-front-right`)] : []),
  ]
}

export const SPAWN = Object.freeze({ x: 24 * T + T / 2, y: 32 * T + 23, tx: 24, ty: 32 })
export const EXIT_GATE = rect(22, 35, 5, 1, 'south-gate')
export const EXIT_TRIGGER = Object.freeze({ x: 22 * T, y: 35 * T + 4, w: 5 * T, h: 28, tag: 'south-exit' })

// Product progression keeps the same 3-column × 2-row order. Visual fog uses
// these regions, while physical traversal follows the irregular reference lanes.
export const BLOCK_REGIONS = Object.freeze({
  1: rect(17, 18, 14, 17, 'south-centre-arrival'),
  2: rect(1, 18, 16, 17, 'south-west-daily-life'),
  3: rect(31, 18, 16, 17, 'south-east-gardens'),
  4: rect(17, 1, 14, 17, 'north-centre-civic-plaza'),
  5: rect(1, 1, 16, 17, 'north-west-shops'),
  6: rect(31, 1, 16, 17, 'north-east-homes'),
})

// Union of readable paving/dirt/yard lanes measured from the v2 reference.
// Overlaps are deliberate: they form loops instead of thin disconnected strips.
export const PATH_RECTS = freezeRects([
  rect(21, 23, 7, 13, 'south-gate-axis'),
  rect(18, 20, 13, 6, 'lower-tree-plaza'),
  rect(15, 13, 18, 8, 'central-tree-loop'),
  rect(14, 10, 21, 5, 'hall-forecourt'),
  rect(12, 6, 5, 25, 'west-spine'),
  rect(7, 7, 8, 8, 'north-west-lane'),
  rect(1, 11, 14, 4, 'bakery-front-lane'),
  rect(3, 17, 12, 7, 'west-home-pocket'),
  rect(4, 29, 3, 3, 'south-west-home-approach'),
  rect(5, 22, 17, 10, 'south-west-cafe-loop'),
  rect(31, 6, 5, 25, 'east-spine'),
  rect(31, 7, 5, 4, 'north-east-lane'),
  rect(38, 10, 3, 3, 'north-east-home-approach'),
  rect(34, 12, 12, 7, 'clinic-front-lane'),
  rect(32, 17, 14, 8, 'laundry-front-lane'),
  rect(27, 23, 19, 9, 'south-east-garden-loop'),
  rect(27, 30, 9, 3, 'garden-to-gate-link'),
])

// Visual bounds and ground-contact footprints are derived from the reference
// master. The master supplies art; these objects drive collision and QA only.
export const OBJECTS = Object.freeze([
  object('community-hall', rect(18, 2, 12, 11, 'community-hall-art'), footprintWithDoor(18, 8, 12, 3, 23, 3, 'community-hall-footprint')),
  object('bakery', rect(0, 4, 11, 10, 'bakery-art'), footprintWithDoor(1, 9, 9, 3, 6, 3, 'bakery-footprint')),
  object('north-west-yard', rect(5, 1, 12, 8, 'north-west-yard-art'), [rect(6, 3, 5, 3, 'raised-bed'), rect(10, 2, 3, 3, 'clothesline-posts'), rect(14, 5, 3, 2, 'delivery-cart')]),
  object('north-east-home', rect(36, 1, 8, 10, 'north-east-home-art'), [...footprintWithDoor(36, 8, 8, 3, 38, 3, 'north-east-home-footprint'), rect(35, 7, 3, 2, 'bicycles')]),
  object('clinic', rect(36, 9, 9, 9, 'clinic-art'), footprintWithDoor(36, 14, 9, 3, 39, 3, 'clinic-footprint')),
  object('west-home', rect(4, 14, 10, 8, 'west-home-art'), footprintWithDoor(5, 19, 8, 3, 7, 3, 'west-home-footprint')),
  object('south-west-homes', rect(0, 20, 10, 11, 'south-west-homes-art'), footprintWithDoor(1, 26, 8, 4, 4, 3, 'south-west-home-footprint')),
  object('cafe-shop', rect(9, 23, 8, 9, 'cafe-shop-art'), footprintWithDoor(9, 27, 8, 3, 12, 3, 'cafe-shop-footprint')),
  object('cafe-seating', rect(10, 27, 10, 5, 'cafe-seating-art'), [rect(10, 29, 3, 2, 'cafe-table-west'), rect(14, 29, 3, 2, 'cafe-table-centre'), rect(17, 28, 3, 3, 'cafe-table-east')]),
  object('laundry', rect(35, 17, 10, 7, 'laundry-art'), footprintWithDoor(35, 21, 9, 3, 38, 3, 'laundry-footprint')),
  object('community-garden', rect(34, 23, 11, 9, 'community-garden-art'), [rect(35, 25, 9, 5, 'garden-bed-and-fence')]),
  object('notice-board', rect(29, 25, 5, 5, 'notice-board-art'), [rect(29, 27, 4, 2, 'notice-board-footprint')]),
  object('central-tree-bed', rect(21, 16, 6, 6, 'central-tree-art'), [rect(21, 18, 6, 4, 'central-tree-raised-bed')]),
  object('west-flower-island', rect(15, 15, 4, 4, 'west-flower-island-art'), [rect(15, 16, 4, 2, 'west-flower-island')]),
  object('east-flower-island', rect(29, 15, 5, 4, 'east-flower-island-art'), [rect(30, 16, 4, 2, 'east-flower-island')]),
  object('west-bench', rect(18, 22, 3, 2, 'west-bench-art'), [rect(18, 23, 3, 1, 'west-bench-footprint')]),
  object('east-bench', rect(27, 22, 3, 2, 'east-bench-art'), [rect(27, 23, 3, 1, 'east-bench-footprint')]),
  object('hall-west-wall', rect(15, 10, 4, 4, 'hall-west-wall-art'), [rect(17, 10, 1, 1, 'hall-west-cap'), rect(15, 11, 4, 2, 'hall-west-wall')]),
  object('hall-east-wall', rect(29, 10, 5, 4, 'hall-east-wall-art'), [rect(30, 10, 1, 1, 'hall-east-cap'), rect(30, 11, 4, 2, 'hall-east-wall')]),
  object('west-civic-planters', rect(16, 13, 4, 4, 'west-civic-planters-art'), [rect(17, 14, 2, 2, 'west-civic-planters')]),
  object('east-civic-planters', rect(28, 13, 4, 4, 'east-civic-planters-art'), [rect(29, 14, 2, 2, 'east-civic-planters')]),
])

export const COLLIDER_TILE_RECTS = Object.freeze(OBJECTS.flatMap((entry) => entry.colliders))
export const DOOR_CLEARANCES = freezeRects([
  rect(23, 10, 3, 4, 'community-hall-door'),
  rect(6, 11, 3, 3, 'bakery-door'),
  rect(38, 10, 3, 3, 'north-east-home-door'),
  rect(39, 16, 3, 3, 'clinic-door'),
  rect(7, 21, 3, 3, 'west-home-door'),
  rect(4, 29, 3, 3, 'south-west-home-door'),
  rect(12, 29, 3, 3, 'cafe-door'),
  rect(38, 23, 3, 3, 'laundry-door'),
])
export const LANDMARKS = Object.freeze({
  centralPlaza: Object.freeze({ tx: 24, ty: 23 }),
  hallFront: Object.freeze({ tx: 24, ty: 13 }),
  centralTree: Object.freeze({ tx: 24, ty: 17 }),
  westLane: Object.freeze({ tx: 14, ty: 18 }),
  eastLane: Object.freeze({ tx: 34, ty: 18 }),
})

// Source rectangles in the transparent foreground master. Runtime code redraws
// a region only while the player's feet are above its reference baseline.
export const FOREGROUND_REGIONS = Object.freeze([
  rect(0, 3, 11, 8, 'bakery-roof', { baseline: 12 }),
  rect(18, 1, 13, 9, 'community-hall-roof', { baseline: 11 }),
  rect(36, 1, 8, 7, 'north-east-home-roof', { baseline: 9 }),
  rect(35, 8, 10, 6, 'clinic-roof', { baseline: 16 }),
  rect(4, 13, 10, 6, 'west-home-roof', { baseline: 21 }),
  rect(0, 20, 10, 7, 'south-west-roof', { baseline: 29 }),
  rect(9, 22, 8, 6, 'cafe-roof-awning', { baseline: 29 }),
  rect(34, 16, 11, 5, 'laundry-roof-awning', { baseline: 23 }),
  rect(21, 16, 6, 4, 'central-tree-canopy', { baseline: 21 }),
])

const inside = (tx, ty, r, padding = 0) => tx >= r.x - padding && tx < r.x + r.w + padding && ty >= r.y - padding && ty < r.y + r.h + padding
export const isSolidTile = (tx, ty) => COLLIDER_TILE_RECTS.some((r) => inside(tx, ty, r))
const isReferenceLane = (tx, ty) => PATH_RECTS.some((r) => inside(tx, ty, r))

export function blockForTile(tx, ty) {
  if (inside(tx, ty, EXIT_GATE) || (tx >= 17 && tx < 31 && ty >= 18)) return 1
  if (tx < 17 && ty >= 18) return 2
  if (tx >= 31 && ty >= 18) return 3
  if (tx >= 17 && tx < 31) return 4
  if (tx < 17) return 5
  return 6
}

export function isWalkableTile(tx, ty) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return false
  const gate = inside(tx, ty, EXIT_GATE)
  return (gate || isReferenceLane(tx, ty)) && !isSolidTile(tx, ty)
}

export function isAccessibleTile(tx, ty, unlockedBlock = 6) {
  return isWalkableTile(tx, ty) && blockForTile(tx, ty) <= unlockedBlock
}

export function reachableTileKeys(unlockedBlock = 6) {
  const start = { tx: SPAWN.tx, ty: SPAWN.ty }
  const visited = new Set()
  if (!isAccessibleTile(start.tx, start.ty, unlockedBlock)) return visited
  const queue = [start]
  visited.add(`${start.tx},${start.ty}`)
  for (let index = 0; index < queue.length; index++) {
    const { tx, ty } = queue[index]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx
      const ny = ty + dy
      const key = `${nx},${ny}`
      if (!visited.has(key) && isAccessibleTile(nx, ny, unlockedBlock)) {
        visited.add(key)
        queue.push({ tx: nx, ty: ny })
      }
    }
  }
  return visited
}

const RESERVED = Object.freeze([
  ...DOOR_CLEARANCES,
  rect(20, 31, 9, 5, 'arrival-clearance'),
  rect(21, 11, 7, 4, 'hall-step-clearance'),
  rect(20, 16, 8, 7, 'central-tree-clearance'),
])

export function distanceFromSolid(tx, ty) {
  let distance = Infinity
  for (const r of COLLIDER_TILE_RECTS) {
    const dx = Math.max(r.x - tx, 0, tx - (r.x + r.w - 1))
    const dy = Math.max(r.y - ty, 0, ty - (r.y + r.h - 1))
    distance = Math.min(distance, Math.max(dx, dy))
  }
  return distance
}

export function isSafeHumanSlot(tx, ty, block = blockForTile(tx, ty)) {
  if (!inside(tx, ty, BLOCK_REGIONS[block])) return false
  if (!isWalkableTile(tx, ty) || blockForTile(tx, ty) !== block) return false
  if (distanceFromSolid(tx, ty) < 1) return false
  if (RESERVED.some((r) => inside(tx, ty, r))) return false
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!isWalkableTile(tx + dx, ty + dy)) return false
  }
  return true
}

export const SAFE_SLOTS_BY_BLOCK = Object.freeze(Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => index + 1).map((block) => {
    const reachable = reachableTileKeys(block)
    const slots = []
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      if (isSafeHumanSlot(tx, ty, block) && reachable.has(`${tx},${ty}`)) slots.push(Object.freeze({ tx, ty }))
    }
    return [block, Object.freeze(slots)]
  }),
))

const hash32 = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function spreadSlots(slots, seed, count) {
  const pool = [...slots]
  const chosen = []
  while (pool.length && chosen.length < count) {
    let bestIndex = -1
    let bestDistance = -1
    let bestTie = Infinity
    for (let index = 0; index < pool.length; index++) {
      const candidate = pool[index]
      const minDistance = chosen.length === 0 ? Infinity : Math.min(...chosen.map((slot) => (slot.tx - candidate.tx) ** 2 + (slot.ty - candidate.ty) ** 2))
      const tie = hash32(`${seed}|${candidate.tx},${candidate.ty}`)
      if (minDistance > bestDistance || (minDistance === bestDistance && tie < bestTie)) {
        bestIndex = index
        bestDistance = minDistance
        bestTie = tie
      }
    }
    if (bestIndex < 0) break
    chosen.push(pool.splice(bestIndex, 1)[0])
  }
  return chosen
}

export function spawnHumanItems(sounds) {
  const soundSet = (sounds || []).map((sound) => `${sound.sound_id}:${Number(sound.block) || 1}`).sort().join('|')
  const byBlock = new Map()
  for (const sound of sounds || []) {
    const block = Number(sound.block) || 1
    if (!byBlock.has(block)) byBlock.set(block, [])
    byBlock.get(block).push(sound)
  }
  const items = []
  for (const block of [...byBlock.keys()].sort((a, b) => a - b)) {
    const list = byBlock.get(block).slice().sort((a, b) => String(a.sound_id).localeCompare(String(b.sound_id)))
    const slots = spreadSlots(SAFE_SLOTS_BY_BLOCK[block] || [], `${soundSet}|${block}`, list.length)
    if (slots.length < list.length) throw new Error(`Human block ${block} capacity exceeded (${slots.length} separated slots for ${list.length} sounds)`)
    list.forEach((sound, index) => items.push(Object.freeze({
      id: sound.sound_id, sound, block, tx: slots[index].tx, ty: slots[index].ty,
      phase: (items.length * 2.399963229728653) % (Math.PI * 2),
    })))
  }
  return Object.freeze(items)
}

function playerRectAt(cx, cy) {
  return { x: cx - PLAYER_BOX.w / 2, y: cy - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h }
}
const pixelRect = (r) => ({ x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T, tag: r.tag })
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function collides(village, cx, cy, unlockedBlock = 6) {
  const player = playerRectAt(cx, cy)
  const hard = village.colliders.find((r) => overlaps(player, r))
  if (hard) return hard
  for (const [px, py] of [[player.x + 1, player.y + 1], [player.x + player.w - 1, player.y + 1], [player.x + 1, player.y + player.h - 1], [player.x + player.w - 1, player.y + player.h - 1]]) {
    const tx = Math.floor(px / T)
    const ty = Math.floor(py / T)
    if (!isAccessibleTile(tx, ty, unlockedBlock)) return { x: tx * T, y: ty * T, w: T, h: T, tag: 'blocked-tile' }
  }
  return null
}

export function moveWithCollision(village, position, dx, dy, unlockedBlock = 6) {
  let { x, y } = position
  if (dx && !collides(village, x + dx, y, unlockedBlock)) x += dx
  if (dy && !collides(village, x, y + dy, unlockedBlock)) y += dy
  return { x, y }
}

export function overlapsExitTrigger(position) {
  return overlaps(playerRectAt(position.x, position.y), EXIT_TRIGGER)
}

export function markerStateFor(item, { blockNum, collectedIds, nearbyId, interactingId }) {
  if (item.id === interactingId) return 'interacting'
  if (collectedIds?.has(item.id)) return 'completed'
  if (item.block > blockNum) return 'unavailable'
  if (item.id === nearbyId) return 'nearby'
  return 'active'
}

export function buildHumanVillage() {
  return Object.freeze({
    label: 'Human · Community Hall Plaza v2', mapWidth: MAP_W, mapHeight: MAP_H,
    spawn: SPAWN, exitTrigger: EXIT_TRIGGER, paths: PATH_RECTS, objects: OBJECTS,
    colliders: Object.freeze(COLLIDER_TILE_RECTS.map(pixelRect)),
  })
}
