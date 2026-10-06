/**
 * Brookside Bloom Nature village — pure geometry and collision model.
 *
 * This module deliberately contains no DOM/Image/canvas access so the exact
 * walkability model used by the runtime can also be exercised by node:test.
 * Coordinates are 32px logical tiles in the existing 48x36 village world.
 */
import { CREEK_GUIDE, LANDMARK_GUIDE } from './natureFarmArtGuide.mjs'
import { WALKABLE_MASK_METADATA, isMaskCellWalkable } from './generated/natureWalkableMask.generated.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'
import {
  baseRectToCurrent,
  canOccupyMask,
  createWorldTransform,
  currentPointToBase,
  playerFootRectAt,
  projectGeometry,
  rectsOverlap,
} from './villageWorldTransform.mjs'

export const VILLAGE_ID = 'nature'
export const VILLAGE_MANIFEST = getVillageRuntimeManifest(VILLAGE_ID)
export const T = 32
export const MAP_W = 48
export const MAP_H = 36
export const WORLD_WIDTH = VILLAGE_MANIFEST.baseWorldWidth
export const WORLD_HEIGHT = VILLAGE_MANIFEST.baseWorldHeight
export const PLAYER_BOX = { w: 18, h: 10 }

export const SPAWN = { x: 18 * T + 16, y: 33 * T + 16 }
export const EXIT = { x: 12 * T + 16, y: 34 * T + 18 }

const key = (x, y) => `${x},${y}`
const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H

const WATER_CONTROL = CREEK_GUIDE

export function creekCenter(ty) {
  const y = Math.max(0, Math.min(MAP_H - 1, ty))
  for (let i = 1; i < WATER_CONTROL.length; i++) {
    const [y1, x1] = WATER_CONTROL[i]
    if (y <= y1) {
      const [y0, x0] = WATER_CONTROL[i - 1]
      const t = (y - y0) / Math.max(1, y1 - y0)
      return Math.round(x0 + (x1 - x0) * t)
    }
  }
  return WATER_CONTROL.at(-1)[1]
}

export const BRIDGES = [
  {
    id: 'upper', y: LANDMARK_GUIDE.upperBridge.targetTiles.y,
    x0: LANDMARK_GUIDE.upperBridge.walkLaneTiles.x,
    x1: LANDMARK_GUIDE.upperBridge.walkLaneTiles.x + LANDMARK_GUIDE.upperBridge.walkLaneTiles.w - 1,
    visualH: LANDMARK_GUIDE.upperBridge.targetTiles.h,
    laneY0: LANDMARK_GUIDE.upperBridge.walkLaneTiles.y,
    laneY1: LANDMARK_GUIDE.upperBridge.walkLaneTiles.y + LANDMARK_GUIDE.upperBridge.walkLaneTiles.h - 1,
  },
  {
    id: 'lower', y: LANDMARK_GUIDE.lowerBridge.targetTiles.y,
    x0: LANDMARK_GUIDE.lowerBridge.walkLaneTiles.x,
    x1: LANDMARK_GUIDE.lowerBridge.walkLaneTiles.x + LANDMARK_GUIDE.lowerBridge.walkLaneTiles.w - 1,
    visualH: LANDMARK_GUIDE.lowerBridge.targetTiles.h,
    laneY0: LANDMARK_GUIDE.lowerBridge.walkLaneTiles.y,
    laneY1: LANDMARK_GUIDE.lowerBridge.walkLaneTiles.y + LANDMARK_GUIDE.lowerBridge.walkLaneTiles.h - 1,
  },
]

const buildingFromGuide = (id, asset, guideKey, doorPad) => {
  const guide = LANDMARK_GUIDE[guideKey]
  return {
    id, asset,
    x: guide.targetTiles.x * T,
    y: guide.targetTiles.y * T,
    w: guide.targetTiles.w * T,
    h: guide.targetTiles.h * T,
    footprint: {
      x: guide.footprintTiles.x * T,
      y: guide.footprintTiles.y * T,
      w: guide.footprintTiles.w * T,
      h: guide.footprintTiles.h * T,
    },
    doorPad,
  }
}

export const BUILDINGS = [
  buildingFromGuide('watermill', 'watermill', 'watermill', { x: 11 * T, y: 9 * T, w: 3 * T, h: 2 * T }),
  buildingFromGuide('north-cottage', 'houseCream', 'northCottage', { x: 31 * T, y: 9 * T, w: 3 * T, h: 2 * T }),
  buildingFromGuide('greenhouse', 'greenhouse', 'greenhouse', { x: 40 * T, y: 9 * T, w: 3 * T, h: 2 * T }),
  buildingFromGuide('south-cottage', 'houseCabin', 'southCottage', { x: 4 * T, y: 30 * T, w: 3 * T, h: 2 * T }),
]

export const FARM_PLOTS = [
  { id: 'wheat', ...LANDMARK_GUIDE.wheatField.targetTiles, gate: { side: 'right', at: 15 } },
  { id: 'vegetables', ...LANDMARK_GUIDE.vegetableField.targetTiles, gate: { side: 'bottom', at: 12 } },
  { id: 'corn', ...LANDMARK_GUIDE.cornField.targetTiles, gate: { side: 'bottom', at: 15 } },
]

export const ORCHARD = {
  ...LANDMARK_GUIDE.orchard.targetTiles,
  trees: [[31,16], [34,16], [37,17], [31,20], [34,21], [37,21]],
  gate: { side: 'bottom', at: 34 },
}

export const BENCHES = [
  { x: 37 * T, y: 25 * T },
]

export const TREE_CENTERS = [
  // Dense outer canopy. Trunks remain one-tile collision points while the
  // larger v2 crowns will overlap to form the reference's irregular border.
  [1,1],[3,1],[5,1],[7,1],[9,1],[11,1],[13,1],[15,1],[17,1],[19,1],
  [27,1],[29,1],[31,1],[33,1],[35,1],[37,1],[39,1],[41,1],[43,1],[45,1],[46,1],
  [1,4],[1,7],[1,10],[1,19],[1,22],[1,25],[1,28],[1,31],[1,34],
  [46,5],[46,8],[46,11],[46,14],[46,17],[46,20],[46,23],[46,26],[46,29],[46,32],[46,34],
  // A staggered inner edge breaks the evenly spaced border silhouette.
  [3,3],[18,3],[20,4],[26,3],[44,4],[3,9],[3,22],[44,12],[44,24],[44,30],
  // South edge keeps the broad x=9..22 entrance corridor completely open.
  [2,35],[4,35],[6,35],[8,35],[24,35],[26,35],[28,35],[30,35],[33,35],[36,35],[39,35],[42,35],[45,35],
  [2,33],[7,33],[25,33],[31,33],[43,33],
]

const FLOWER_ANCHORS = [
  [13,5],[14,8],[17,3],[28,5],[28,9],[36,9],[42,9],[44,12],
  [27,15],[28,20],[29,24],[32,27],[42,27],[44,23],[8,32],[18,31],
  [3,22],[17,18],[35,2],[10,2],[43,32],[26,33],
]

function makeMask(fill = false) {
  return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill))
}

function addRect(mask, x0, y0, x1, y1, value = true) {
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
      if (inMap(x, y)) mask[y][x] = value
    }
  }
}

function paintPath(mask, points, radius = 1.55) {
  const stamp = (cx, cy) => {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (inMap(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 + 0.35) mask[y][x] = true
      }
    }
  }
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3))
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      stamp(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t))
    }
  }
}

function bridgeAt(tx, ty) {
  return BRIDGES.some((b) => tx >= b.x0 && tx <= b.x1 && ty >= b.laneY0 && ty <= b.laneY1)
}

function addFenceAndCrops(collision, plot) {
  const x1 = plot.x + plot.w - 1
  const y1 = plot.y + plot.h - 1
  for (let x = plot.x; x <= x1; x++) {
    collision[plot.y][x] = true
    collision[y1][x] = true
  }
  for (let y = plot.y; y <= y1; y++) {
    collision[y][plot.x] = true
    collision[y][x1] = true
  }
  // Cultivated beds are environmental obstacles, not a new farming system.
  addRect(collision, plot.x + 1, plot.y + 1, x1 - 1, y1 - 1, true)
  if (plot.gate.side === 'right') collision[plot.gate.at][x1] = false
  if (plot.gate.side === 'bottom') {
    collision[y1][plot.gate.at] = false
    if (plot.gate.at + 1 < x1) collision[y1][plot.gate.at + 1] = false
  }
}

export function buildNatureFarmModel(worldSize = {}) {
  const transform = createWorldTransform({
    baseWorldWidth: WORLD_WIDTH,
    baseWorldHeight: WORLD_HEIGHT,
    currentWorldWidth: worldSize.currentWorldWidth ?? WORLD_WIDTH,
    currentWorldHeight: worldSize.currentWorldHeight ?? WORLD_HEIGHT,
  })
  const water = makeMask(false)
  const path = makeMask(false)
  const collision = makeMask(false)
  const explicitCollision = makeMask(false)

  for (let y = 0; y < MAP_H; y++) {
    const cx = creekCenter(y)
    const half = y >= 29 ? 3 : 2
    for (let x = cx - half; x <= cx + half; x++) if (inMap(x, y)) water[y][x] = true
  }

  // Warm 3-tile loop path: two bridge approaches connect west farm/cottage
  // and east cottage/orchard without turning the meadow into a dirt plaza.
  paintPath(path, [[3,11],[11,11],[17,11],[25,11],[34,11],[40,12],[43,15]])
  paintPath(path, [[15,10],[14,16],[16,21],[17,26],[15,30],[22,31]])
  paintPath(path, [[34,11],[40,13],[42,19],[41,25],[37,30],[30,29]])
  paintPath(path, [[5,31],[13,30],[22,29],[28,28],[36,30],[41,28]])
  paintPath(path, [[11,18],[16,19],[19,18]], 1.2)
  paintPath(path, [[8,27],[10,29],[14,30]], 1.2)
  paintPath(path, [[33,9],[37,10],[41,9]], 1.2)
  for (const b of BRIDGES) addRect(path, b.x0, b.laneY0, b.x1, b.laneY1)

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (water[y][x] && !bridgeAt(x, y)) collision[y][x] = true
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) collision[y][x] = true
    }
  }

  for (const building of BUILDINGS) {
    const f = building.footprint
    addRect(collision, f.x / T, f.y / T, (f.x + f.w) / T - 0.01, (f.y + f.h) / T - 0.01, true)
    addRect(explicitCollision, f.x / T, f.y / T, (f.x + f.w) / T - 0.01, (f.y + f.h) / T - 0.01, true)
  }
  for (const plot of FARM_PLOTS) {
    addFenceAndCrops(collision, plot)
    addFenceAndCrops(explicitCollision, plot)
  }

  const ox1 = ORCHARD.x + ORCHARD.w - 1
  const oy1 = ORCHARD.y + ORCHARD.h - 1
  for (let x = ORCHARD.x; x <= ox1; x++) {
    collision[ORCHARD.y][x] = true
    collision[oy1][x] = true
    explicitCollision[ORCHARD.y][x] = true
    explicitCollision[oy1][x] = true
  }
  for (let y = ORCHARD.y; y <= oy1; y++) {
    collision[y][ORCHARD.x] = true
    collision[y][ox1] = true
    explicitCollision[y][ORCHARD.x] = true
    explicitCollision[y][ox1] = true
  }
  collision[oy1][ORCHARD.gate.at] = false
  collision[oy1][ORCHARD.gate.at + 1] = false
  explicitCollision[oy1][ORCHARD.gate.at] = false
  explicitCollision[oy1][ORCHARD.gate.at + 1] = false
  for (const [x, y] of ORCHARD.trees) { collision[y][x] = true; explicitCollision[y][x] = true }
  for (const [x, y] of TREE_CENTERS) { collision[y][x] = true; explicitCollision[y][x] = true }

  // The southern entry lane and all four door aprons are hard guarantees.
  addRect(collision, 10, 32, 21, 34, false)
  addRect(explicitCollision, 10, 32, 21, 34, false)
  for (const b of BUILDINGS) {
    const p = b.doorPad
    addRect(collision, p.x / T, p.y / T, (p.x + p.w) / T - 0.01, (p.y + p.h) / T - 0.01, false)
    addRect(explicitCollision, p.x / T, p.y / T, (p.x + p.w) / T - 0.01, (p.y + p.h) / T - 0.01, false)
  }
  // Restore creek collision where a door apron cannot logically override water.
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (water[y][x] && !bridgeAt(x, y)) collision[y][x] = true
  }

  const pixelColliders = []
  const itemReserved = new Set()
  for (const b of BRIDGES) {
    const x = b.x0 * T
    const w = (b.x1 - b.x0 + 1) * T
    pixelColliders.push(
      { x, y: b.laneY0 * T, w, h: 7, tag: `${b.id}-rail` },
      { x, y: (b.laneY1 + 1) * T - 7, w, h: 7, tag: `${b.id}-rail` },
    )
    for (let y = b.laneY0 - 1; y <= b.laneY1 + 1; y++) {
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++) if (inMap(x, y)) itemReserved.add(key(x, y))
    }
  }
  for (const b of BUILDINGS) {
    const visualX0 = Math.floor(b.x / T)
    const visualY0 = Math.floor(b.y / T)
    const visualX1 = Math.ceil((b.x + b.w) / T) - 1
    const visualY1 = Math.ceil((b.y + b.h) / T) - 1
    for (let y = visualY0; y <= visualY1; y++) {
      for (let x = visualX0; x <= visualX1; x++) if (inMap(x, y)) itemReserved.add(key(x, y))
    }
    const p = b.doorPad
    for (let y = Math.floor(p.y / T); y <= Math.floor((p.y + p.h) / T); y++) {
      for (let x = Math.floor(p.x / T); x <= Math.floor((p.x + p.w) / T); x++) if (inMap(x, y)) itemReserved.add(key(x, y))
    }
  }
  for (let y = ORCHARD.y; y < ORCHARD.y + ORCHARD.h; y++) {
    for (let x = ORCHARD.x; x < ORCHARD.x + ORCHARD.w; x++) itemReserved.add(key(x, y))
  }
  for (let y = 31; y <= 35; y++) for (let x = 9; x <= 22; x++) if (inMap(x, y)) itemReserved.add(key(x, y))

  const scaledPixelColliders = pixelColliders.map((collider) => baseRectToCurrent(collider, transform))
  const canStand = (cx, cy) => {
    const foot = playerFootRectAt({ x: cx, y: cy }, PLAYER_BOX, transform)
    if (!canOccupyMask(isMaskCellWalkable, WALKABLE_MASK_METADATA, { x: cx, y: cy }, PLAYER_BOX, transform)) return false
    for (const px of [foot.x, foot.x + foot.w]) for (const py of [foot.y, foot.y + foot.h - 0.001]) {
      const base = currentPointToBase({ x: px, y: py }, transform)
      const tx = Math.floor(base.x / T), ty = Math.floor(base.y / T)
      if (!inMap(tx, ty) || explicitCollision[ty][tx]) return false
    }
    if (scaledPixelColliders.some((collider) => rectsOverlap(foot, collider))) return false
    return true
  }

  return {
    villageId: VILLAGE_ID, manifest: VILLAGE_MANIFEST, transform,
    baseWorldWidth: WORLD_WIDTH, baseWorldHeight: WORLD_HEIGHT,
    currentWorldWidth: transform.currentWorldWidth, currentWorldHeight: transform.currentWorldHeight,
    water, path, collision, explicitCollision, pixelColliders: scaledPixelColliders, itemReserved, canStand,
    spawn: projectGeometry(SPAWN, transform), exit: projectGeometry(EXIT, transform),
  }
}

export function reachableTileKeys(model, start = model.spawn) {
  const baseStart = currentPointToBase(start, model.transform)
  const sx = Math.floor(baseStart.x / T)
  const sy = Math.floor(baseStart.y / T)
  const seen = new Set()
  const queue = [[sx, sy]]
  while (queue.length) {
    const [x, y] = queue.shift()
    const k = key(x, y)
    const current = projectGeometry({ x: x * T + 16, y: y * T + 16 }, model.transform)
    if (seen.has(k) || !inMap(x, y) || !model.canStand(current.x, current.y)) continue
    seen.add(k)
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return seen
}

export function moveWithCollisionModel(model, pos, dx, dy) {
  let x = pos.x
  let y = pos.y
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6))
  const sx = dx / steps
  const sy = dy / steps
  for (let i = 0; i < steps; i++) {
    if (sx && model.canStand(x + sx, y)) x += sx
    if (sy && model.canStand(x, y + sy)) y += sy
  }
  return { x, y }
}

export function tileHasClearance(model, tx, ty, radius = 1) {
  for (let y = ty - radius; y <= ty + radius; y++) {
    for (let x = tx - radius; x <= tx + radius; x++) {
      const current = projectGeometry({ x: x * T + 16, y: y * T + 16 }, model.transform)
      if (!inMap(x, y) || !model.canStand(current.x, current.y)) return false
    }
  }
  return true
}

export function isolatedWalkableTiles(model) {
  const reachable = reachableTileKeys(model)
  const isolated = []
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (model.canStand(x * T + 16, y * T + 16) && !reachable.has(key(x, y))) isolated.push([x, y])
  }
  return isolated
}

export const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createNatureFlowerDecor(model) {
  const rnd = mulberry32(87317)
  const used = new Set()
  const out = []
  for (let ai = 0; ai < FLOWER_ANCHORS.length; ai++) {
    const [ax, ay] = FLOWER_ANCHORS[ai]
    const count = 4 + Math.floor(rnd() * 4)
    for (let i = 0; i < count; i++) {
      const tx = Math.max(1, Math.min(MAP_W - 2, ax + Math.floor(rnd() * 7) - 3))
      const ty = Math.max(1, Math.min(MAP_H - 2, ay + Math.floor(rnd() * 5) - 2))
      const k = key(tx, ty)
      if (used.has(k) || model.collision[ty][tx] || model.water[ty][tx] || model.path[ty][tx]) continue
      used.add(k)
      out.push({ tx, ty, variant: (ai + i) % 10, ox: Math.floor(rnd() * 7) - 3, oy: Math.floor(rnd() * 5) - 2 })
    }
  }
  return out
}

export function hashSeed(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

export function computeBlockGrid(sounds) {
  const byBlock = new Map()
  for (const sound of sounds) {
    const block = sound.block || 1
    if (!byBlock.has(block)) byBlock.set(block, [])
    byBlock.get(block).push(sound)
  }
  const blockNums = [...byBlock.keys()].sort((a, b) => a - b)
  const n = Math.max(1, blockNums.length)
  let cols = Math.max(1, Math.round(Math.sqrt(n * (MAP_W / MAP_H))))
  let rows = Math.ceil(n / cols)
  while (cols * rows < n) cols++
  const colBounds = Array.from({ length: cols + 1 }, (_, i) => Math.round(2 + (MAP_W - 4) * i / cols))
  const rowBounds = Array.from({ length: rows + 1 }, (_, i) => Math.round(2 + (MAP_H - 4) * i / rows))
  return { byBlock, blockNums, cols, rows, colBounds, rowBounds }
}

export function orderedBlockCells(sounds, spawn) {
  const grid = computeBlockGrid(sounds)
  const cells = []
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    cells.push({
      x0: grid.colBounds[c], x1: grid.colBounds[c + 1],
      y0: grid.rowBounds[r], y1: grid.rowBounds[r + 1], tiles: [], fallbackTiles: [],
    })
  }
  const sx = spawn.x / T
  const sy = spawn.y / T
  cells.sort((a, b) => {
    const da = ((a.x0 + a.x1) / 2 - sx) ** 2 + ((a.y0 + a.y1) / 2 - sy) ** 2
    const db = ((b.x0 + b.x1) / 2 - sx) ** 2 + ((b.y0 + b.y1) / 2 - sy) ** 2
    return da - db
  })
  return { ...grid, cells }
}

export function spawnNatureItemsForModel(sounds, model, decorTiles = new Set()) {
  const { byBlock, blockNums, cells } = orderedBlockCells(sounds, currentPointToBase(model.spawn, model.transform))
  const reachable = reachableTileKeys(model)
  const cellFor = (tx, ty) => cells.find((cell) => tx >= cell.x0 && tx < cell.x1 && ty >= cell.y0 && ty < cell.y1)

  for (let ty = 2; ty < MAP_H - 2; ty++) for (let tx = 2; tx < MAP_W - 2; tx++) {
    const cell = cellFor(tx, ty)
    const k = key(tx, ty)
    if (!cell || !reachable.has(k) || model.itemReserved.has(k) || decorTiles.has(k)) continue
    if (tileHasClearance(model, tx, ty, 1)) cell.tiles.push({ tx, ty })
    else cell.fallbackTiles.push({ tx, ty })
  }

  const seed = hashSeed(`Nature|${sounds.map((s) => s.sound_id).sort().join(',')}`)
  const rnd = mulberry32(seed)
  const items = []
  blockNums.forEach((block, index) => {
    const list = [...byBlock.get(block)].sort((a, b) => String(a.sound_id).localeCompare(String(b.sound_id)))
    const cell = cells[Math.min(index, cells.length - 1)]
    const primary = [...cell.tiles]
    const fallback = [...cell.fallbackTiles]
    for (let i = primary.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[primary[i], primary[j]] = [primary[j], primary[i]]
    }
    for (let i = fallback.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[fallback[i], fallback[j]] = [fallback[j], fallback[i]]
    }
    // Actual group A/B lists fit entirely in `primary` (one-tile clearance).
    // Group-bypass research IDs pass A+B together (30 per block), so only for
    // that extra capacity do we append reachable, non-obstacle center tiles.
    const pool = primary.length >= list.length ? primary : [...primary, ...fallback]
    const chosen = []
    for (const p of pool) {
      if (chosen.length >= list.length) break
      if (chosen.every((c) => (c.tx - p.tx) ** 2 + (c.ty - p.ty) ** 2 >= 4)) chosen.push(p)
    }
    if (chosen.length < list.length) {
      for (const p of pool) {
        if (chosen.length >= list.length) break
        if (!chosen.some((c) => c.tx === p.tx && c.ty === p.ty)) chosen.push(p)
      }
    }
    if (chosen.length < list.length) {
      throw new Error(`Nature block ${block} has ${list.length} sounds but only ${chosen.length} safe unique positions`)
    }
    list.forEach((sound, i) => items.push({
      id: sound.sound_id, sound, tx: chosen[i].tx, ty: chosen[i].ty,
      block, phase: rnd() * Math.PI * 2,
    }))
  })
  return items
}
