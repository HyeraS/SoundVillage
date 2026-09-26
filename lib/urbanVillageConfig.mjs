export const T = 32
export const MAP_W = 48
export const MAP_H = 36
export const PLAYER_BOX = Object.freeze({ w: 20, h: 14 })
export const INTERACTION_BOX = Object.freeze({ w: 28, h: 28 })

const tileRect = (x, y, w, h, tag, extra = {}) => Object.freeze({ x, y, w, h, tag, ...extra })
const pixelRect = ({ x, y, w, h, tag }) => Object.freeze({ x: x * T, y: y * T, w: w * T, h: h * T, tag })

export const SPAWN = Object.freeze({ x: 24 * T + 16, y: 32 * T + 22, tx: 24, ty: 32 })
export const EXIT_TRIGGER = Object.freeze({ x: 22 * T, y: 35 * T + 6, w: 4 * T, h: 22 })

export const METRO = Object.freeze({
  rail: tileRect(8, 5, 32, 3, 'elevated-metro'),
  railPieces: Object.freeze([
    tileRect(8, 5, 14, 3, 'metro-west'),
    tileRect(26, 5, 14, 3, 'metro-east'),
  ]),
  stairs: tileRect(22, 5, 4, 8, 'metro-stairs'),
})

export const BUILDINGS = Object.freeze([
  tileRect(1, 1, 8, 11, 'northwest-tower', { kind: 'tower', accent: '#50cde8' }),
  tileRect(9, 1, 10, 4, 'north-hotel', { kind: 'tower', accent: '#8e72e8' }),
  tileRect(29, 1, 11, 4, 'media-tower', { kind: 'tower', accent: '#58d8f5' }),
  tileRect(40, 1, 7, 12, 'northeast-tower', { kind: 'tower', accent: '#62bfe9' }),
  tileRect(2, 13, 11, 6, 'media-office', { kind: 'media', accent: '#8c68ef' }),
  tileRect(37, 13, 10, 8, 'glass-food-court', { kind: 'glass', accent: '#55dff2' }),
  tileRect(2, 27, 10, 6, 'culture-office', { kind: 'culture', accent: '#5679dc' }),
  tileRect(35, 27, 9, 6, 'metro-cinema', { kind: 'cinema', accent: '#61d4ef' }),
])

export const ROAD_LANES = Object.freeze([
  tileRect(15, 8, 4, 27, 'west-transit-loop'),
  tileRect(29, 8, 4, 27, 'east-transit-loop'),
  tileRect(1, 21, 46, 4, 'cross-town-road'),
  tileRect(44, 23, 3, 10, 'electric-bus-bay'),
])

export const CROSSWALKS = Object.freeze([
  tileRect(15, 17, 4, 3, 'media-crosswalk'),
  tileRect(29, 17, 4, 3, 'food-crosswalk'),
  tileRect(15, 28, 4, 3, 'culture-crosswalk'),
  tileRect(29, 28, 4, 3, 'cinema-crosswalk'),
  tileRect(6, 21, 3, 4, 'west-road-crosswalk'),
  tileRect(22, 21, 4, 4, 'central-road-crosswalk'),
])

export const WATER = Object.freeze([])

export const PROPS = Object.freeze([
  tileRect(23, 18, 2, 2, 'light-fountain', { kind: 'fountain' }),
  tileRect(7, 19, 1, 1, 'media-orb', { kind: 'media-orb' }),
  tileRect(4, 20, 2, 1, 'media-planter-a', { kind: 'planter' }),
  tileRect(10, 20, 2, 1, 'media-planter-b', { kind: 'planter' }),
  tileRect(36, 22, 2, 1, 'food-planter-a', { kind: 'planter' }),
  tileRect(41, 22, 2, 1, 'food-planter-b', { kind: 'planter' }),
  tileRect(4, 25, 1, 1, 'culture-tree-a', { kind: 'tree' }),
  tileRect(12, 26, 1, 1, 'culture-tree-b', { kind: 'tree' }),
  tileRect(36, 25, 1, 1, 'cinema-tree-a', { kind: 'tree' }),
  tileRect(42, 25, 1, 1, 'cinema-tree-b', { kind: 'tree' }),
  tileRect(20, 15, 1, 1, 'concourse-tree-a', { kind: 'tree' }),
  tileRect(27, 15, 1, 1, 'concourse-tree-b', { kind: 'tree' }),
  tileRect(21, 27, 1, 1, 'arrival-tree-a', { kind: 'tree' }),
  tileRect(27, 27, 1, 1, 'arrival-tree-b', { kind: 'tree' }),
  tileRect(2, 25, 2, 1, 'scooter-dock', { kind: 'scooter' }),
  tileRect(30, 25, 2, 3, 'electric-shuttle', { kind: 'shuttle' }),
  tileRect(45, 25, 2, 3, 'electric-bus-a', { kind: 'bus' }),
  tileRect(45, 29, 2, 3, 'electric-bus-b', { kind: 'bus' }),
  ...[
    [13, 15], [19, 13], [28, 13], [34, 15], [13, 25], [19, 26],
    [28, 26], [34, 24], [19, 32], [28, 32], [21, 11], [26, 11],
  ].map(([x, y], index) => tileRect(x, y, 1, 1, `smart-lamp-${index + 1}`, { kind: 'lamp' })),
])

export const SOLID_TILE_RECTS = Object.freeze([
  ...BUILDINGS,
  ...METRO.railPieces,
  ...PROPS,
])

export const COLLIDERS = Object.freeze([
  ...SOLID_TILE_RECTS.map(pixelRect),
  Object.freeze({ x: -T, y: 0, w: T, h: MAP_H * T, tag: 'map-left' }),
  Object.freeze({ x: MAP_W * T, y: 0, w: T, h: MAP_H * T, tag: 'map-right' }),
  Object.freeze({ x: 0, y: -T, w: MAP_W * T, h: T, tag: 'map-top' }),
  Object.freeze({ x: 0, y: MAP_H * T, w: MAP_W * T, h: T, tag: 'map-bottom' }),
])

export const BLOCK_REGIONS = Object.freeze({
  1: Object.freeze([tileRect(19, 25, 10, 10, 'arrival-plaza')]),
  2: Object.freeze([tileRect(1, 25, 18, 10, 'southwest-culture')]),
  3: Object.freeze([tileRect(29, 25, 18, 10, 'southeast-cinema-transit')]),
  4: Object.freeze([tileRect(1, 12, 28, 13, 'media-concourse')]),
  5: Object.freeze([tileRect(29, 12, 18, 13, 'food-transit')]),
  6: Object.freeze([tileRect(18, 8, 12, 5, 'metro-concourse')]),
})

export const LOCK_FOG_REGIONS = Object.freeze({
  2: tileRect(0, 25, 19, 11, 'locked-southwest'),
  3: tileRect(29, 25, 19, 11, 'locked-southeast'),
  4: tileRect(0, 12, 29, 13, 'locked-media'),
  5: tileRect(29, 12, 19, 13, 'locked-food'),
  6: tileRect(0, 0, 48, 12, 'locked-metro'),
})

const insideRect = (tx, ty, rect, padding = 0) => (
  tx >= rect.x - padding && tx < rect.x + rect.w + padding &&
  ty >= rect.y - padding && ty < rect.y + rect.h + padding
)

export const isRoadLaneTile = (tx, ty) => (
  ROAD_LANES.some((rect) => insideRect(tx, ty, rect)) &&
  !CROSSWALKS.some((rect) => insideRect(tx, ty, rect))
)

export const isRailTile = (tx, ty) => (
  METRO.railPieces.some((rect) => insideRect(tx, ty, rect))
)

export const isWaterTile = (tx, ty) => WATER.some((rect) => insideRect(tx, ty, rect))
export const isSolidTile = (tx, ty) => SOLID_TILE_RECTS.some((rect) => insideRect(tx, ty, rect))

export function blockForTile(tx, ty) {
  if (ty <= 11) return 6
  if (ty <= 24) return tx < 29 ? 4 : 5
  if (tx < 19) return 2
  if (tx >= 29) return 3
  return 1
}

export function isWalkableTile(tx, ty) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return false
  if (tx < 1 || ty < 1 || tx > MAP_W - 2 || ty > MAP_H - 2) return false
  return !isSolidTile(tx, ty) && !isRoadLaneTile(tx, ty) && !isRailTile(tx, ty) && !isWaterTile(tx, ty)
}

export function isAccessibleTile(tx, ty, unlockedBlock = 6) {
  return isWalkableTile(tx, ty) && blockForTile(tx, ty) <= unlockedBlock
}

const CLEARANCE_RECTS = Object.freeze([
  tileRect(21, 29, 7, 6, 'spawn-and-entrance-clearance'),
  tileRect(21, 8, 6, 6, 'metro-stair-clearance'),
  tileRect(20, 12, 8, 14, 'central-pedestrian-spine'),
  ...CROSSWALKS,
])

const inBlockRegion = (block, tx, ty) => (BLOCK_REGIONS[block] || []).some((rect) => insideRect(tx, ty, rect))

export function distanceFromSolid(tx, ty) {
  let distance = Infinity
  for (const rect of SOLID_TILE_RECTS) {
    const dx = Math.max(rect.x - tx, 0, tx - (rect.x + rect.w - 1))
    const dy = Math.max(rect.y - ty, 0, ty - (rect.y + rect.h - 1))
    distance = Math.min(distance, Math.max(dx, dy))
  }
  return distance
}

export function isSafeUrbanSlot(tx, ty, block = blockForTile(tx, ty)) {
  if (!inBlockRegion(block, tx, ty) || blockForTile(tx, ty) !== block) return false
  if (!isWalkableTile(tx, ty) || isRoadLaneTile(tx, ty) || isRailTile(tx, ty) || isWaterTile(tx, ty)) return false
  if (distanceFromSolid(tx, ty) < 1) return false
  return !CLEARANCE_RECTS.some((rect) => insideRect(tx, ty, rect))
}

export const SAFE_SLOTS_BY_BLOCK = Object.freeze(Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => index + 1).map((block) => {
    const reachable = reachableTileKeys(block)
    return [
      block,
      Object.freeze(Array.from({ length: MAP_H }, (_, ty) => (
        Array.from({ length: MAP_W }, (_, tx) => ({ tx, ty }))
      )).flat()
        .filter(({ tx, ty }) => isSafeUrbanSlot(tx, ty, block))
        .filter(({ tx, ty }) => reachable.has(`${tx},${ty}`))
        .map(Object.freeze)),
    ]
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

export const MARKER_OUTER_RADIUS = 10
export const MARKER_MIN_CENTER_DISTANCE = T

function spreadSlots(slots, seed) {
  const pool = [...slots]
  const chosen = []
  while (pool.length) {
    let bestIndex = 0
    let bestDistance = -1
    let bestTie = Infinity
    for (let index = 0; index < pool.length; index++) {
      const candidate = pool[index]
      const minDistance = chosen.length === 0
        ? Infinity
        : Math.min(...chosen.map((slot) => (
          (slot.tx - candidate.tx) ** 2 + (slot.ty - candidate.ty) ** 2
        )))
      const tie = hash32(`${seed}|${candidate.tx},${candidate.ty}`)
      if (minDistance > bestDistance || (minDistance === bestDistance && tie < bestTie)) {
        bestIndex = index
        bestDistance = minDistance
        bestTie = tie
      }
    }
    chosen.push(pool.splice(bestIndex, 1)[0])
  }
  return chosen
}

export function spawnUrbanItems(sounds) {
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
    // 단순 해시 정렬은 15개가 우연히 한 줄/모서리에 몰릴 수 있다. 해시를 동률
    // 결정자로만 쓰고, 매 단계에서 기존 선택점과 가장 먼 슬롯을 고르는 방식으로
    // 구역 전체에 먼저 퍼뜨린 뒤 남는 촘촘한 칸을 사용한다.
    const slots = spreadSlots(SAFE_SLOTS_BY_BLOCK[block] || [], `${soundSet}|${block}`)
    if (slots.length < list.length) {
      throw new Error(`Urban block ${block} capacity exceeded (${slots.length} safe slots for ${list.length} sounds)`)
    }
    list.forEach((sound, index) => items.push(Object.freeze({
      id: sound.sound_id,
      sound,
      block,
      tx: slots[index].tx,
      ty: slots[index].ty,
      phase: (items.length * 2.399963229728653) % (Math.PI * 2),
    })))
  }
  return Object.freeze(items)
}

export function markerStateFor(item, { blockNum, collectedIds, nearbyId, interactingId }) {
  if (item.id === interactingId) return 'interacting'
  if (collectedIds?.has(item.id)) return 'completed'
  if (item.block > blockNum) return 'unavailable'
  if (item.id === nearbyId) return 'nearby'
  return 'active'
}

function playerRectAt(cx, cy) {
  return { x: cx - PLAYER_BOX.w / 2, y: cy - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h }
}

const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function collides(village, cx, cy, unlockedBlock = 6) {
  const player = playerRectAt(cx, cy)
  const hard = village.colliders.find((rect) => rectsOverlap(player, rect))
  if (hard) return hard

  const samples = [
    [player.x + 1, player.y + 1], [player.x + player.w - 1, player.y + 1],
    [player.x + 1, player.y + player.h - 1], [player.x + player.w - 1, player.y + player.h - 1],
  ]
  for (const [px, py] of samples) {
    const tx = Math.floor(px / T)
    const ty = Math.floor(py / T)
    if (!isAccessibleTile(tx, ty, unlockedBlock)) return { x: tx * T, y: ty * T, w: T, h: T, tag: 'blocked-tile' }
  }
  return null
}

export function moveWithCollision(village, position, dx, dy, unlockedBlock = 6) {
  let x = position.x
  let y = position.y
  if (dx && !collides(village, x + dx, y, unlockedBlock)) x += dx
  if (dy && !collides(village, x, y + dy, unlockedBlock)) y += dy
  return { x, y }
}

export function overlapsExitTrigger(position) {
  return rectsOverlap(playerRectAt(position.x, position.y), EXIT_TRIGGER)
}

export function buildUrbanVillage() {
  return Object.freeze({
    label: 'Urban · Midnight Metro Media Core',
    mapWidth: MAP_W,
    mapHeight: MAP_H,
    buildings: BUILDINGS,
    props: PROPS,
    roads: ROAD_LANES,
    crosswalks: CROSSWALKS,
    metro: METRO,
    colliders: COLLIDERS,
    spawn: SPAWN,
    exitTrigger: EXIT_TRIGGER,
  })
}

export function reachableTileKeys(unlockedBlock = 6) {
  const start = { tx: SPAWN.tx, ty: SPAWN.ty }
  const startKey = `${start.tx},${start.ty}`
  const visited = new Set([startKey])
  const queue = [start]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = current.tx + dx
      const ty = current.ty + dy
      const key = `${tx},${ty}`
      if (!visited.has(key) && isAccessibleTile(tx, ty, unlockedBlock)) {
        visited.add(key)
        queue.push({ tx, ty })
      }
    }
  }
  return visited
}
