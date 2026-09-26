export const MAP = { width: 48, height: 36, tile: 32, pixelWidth: 1536, pixelHeight: 1152 }

export const SOUND_AUDIT = {
  total: 169,
  groups: {
    A: { total: 84, blocks: [15, 15, 15, 15, 15, 9] },
    B: { total: 85, blocks: [15, 15, 15, 15, 15, 10] },
  },
}

export const SPAWN = { tx: 24, ty: 33 }
export const EXIT = { x: 22, y: 35, w: 5, h: 1 }

export const STRUCTURES = {
  archive: {
    label: 'ARCHIVE LAB', subtitle: 'quiet storage / cataloguing',
    x: 3, y: 3, w: 13, h: 9,
    entrance: { x: 8, y: 12, w: 3, h: 1 },
    approach: { x: 8, y: 12, w: 3, h: 3 },
  },
  spectrum: {
    label: 'SPECTRUM LAB', subtitle: 'measurement / comparison',
    x: 31, y: 3, w: 14, h: 10,
    entrance: { x: 37, y: 13, w: 3, h: 1 },
    approach: { x: 37, y: 13, w: 3, h: 3 },
  },
  signal: {
    label: 'SIGNAL LAB', subtitle: 'capture / relay',
    x: 34, y: 22, w: 11, h: 10,
    entrance: { x: 33, y: 26, w: 1, h: 3 },
    approach: { x: 31, y: 26, w: 3, h: 3 },
  },
}

export const OBSERVATORY = {
  footprint: { x: 18, y: 12, w: 12, h: 13 },
  core: { cx: 24, cy: 18.5, rx: 3.35, ry: 3.35 },
  label: 'CENTRAL OBSERVATORY',
}

export const MATERIAL_ZONES = [
  { id: 'arrival', label: 'arrival basalt', x: 19, y: 27, w: 11, h: 8, color: '#30475c' },
  { id: 'radial', label: 'radial brass inlay', x: 14, y: 9, w: 20, h: 20, color: '#263f55' },
  { id: 'archive-court', label: 'archive slate', x: 2, y: 2, w: 17, h: 19, color: '#263849' },
  { id: 'spectrum-court', label: 'spectrum blue stone', x: 29, y: 2, w: 17, h: 19, color: '#214052' },
  { id: 'signal-court', label: 'signal teal stone', x: 28, y: 20, w: 18, h: 14, color: '#244b50' },
  { id: 'quiet-court', label: 'quiet observation court', x: 2, y: 20, w: 17, h: 14, color: '#2b3f4b' },
]

export const SLOT_REGIONS = [
  { block: 1, label: 'Arrival / first observation', x0: 14, y0: 28, x1: 33, y1: 33 },
  { block: 2, label: 'Quiet court', x0: 3, y0: 21, x1: 17, y1: 32 },
  { block: 3, label: 'Archive court', x0: 3, y0: 12, x1: 18, y1: 21 },
  { block: 4, label: 'North observatory ridge', x0: 17, y0: 3, x1: 30, y1: 11 },
  { block: 5, label: 'Spectrum court', x0: 30, y0: 13, x1: 44, y1: 21 },
  { block: 6, label: 'Signal court / south radial edge', x0: 19, y0: 20, x1: 44, y1: 34 },
]

export const FOREGROUND_ZONES = [
  { id: 'archive-roof', x: 3, y: 3, w: 13, h: 2.25 },
  { id: 'spectrum-dome', x: 31, y: 3, w: 14, h: 2.75 },
  { id: 'signal-canopy', x: 34, y: 22, w: 2.25, h: 10 },
  { id: 'observatory-upper', x: 20, y: 13.5, w: 8, h: 2 },
]

export const PROP_BLOCKERS = [
  { x: 5, y: 24 }, { x: 9, y: 27 }, { x: 14, y: 23 },
  { x: 18, y: 7 }, { x: 21, y: 5 }, { x: 28, y: 7 },
  { x: 32, y: 17 }, { x: 42, y: 18 }, { x: 30, y: 30 },
]

function insideRect(tx, ty, rect) {
  return tx >= rect.x && tx < rect.x + rect.w && ty >= rect.y && ty < rect.y + rect.h
}

export function isCollision(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP.width || ty >= MAP.height) return true
  const atOuterWall = tx < 2 || tx > 45 || ty < 2 || ty > 34
  const inGateOpening = ty >= 34 && tx >= EXIT.x && tx < EXIT.x + EXIT.w
  if (atOuterWall && !inGateOpening) return true
  if (Object.values(STRUCTURES).some(structure => insideRect(tx, ty, structure))) return true
  const dx = (tx + 0.5 - OBSERVATORY.core.cx) / OBSERVATORY.core.rx
  const dy = (ty + 0.5 - OBSERVATORY.core.cy) / OBSERVATORY.core.ry
  if (dx * dx + dy * dy <= 1) return true
  return PROP_BLOCKERS.some(prop => prop.x === tx && prop.y === ty)
}

function hasMarkerClearance(tx, ty) {
  for (let y = ty - 1; y <= ty + 1; y++) {
    for (let x = tx - 1; x <= tx + 1; x++) if (isCollision(x, y)) return false
  }
  const approaches = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  return approaches.some(([dx, dy]) => !isCollision(tx + dx, ty + dy) && !isCollision(tx + dx * 2, ty + dy * 2))
}

function isSlotReserved(tx, ty) {
  if (insideRect(tx, ty, OBSERVATORY.footprint)) return true
  if (Object.values(STRUCTURES).some(structure => insideRect(tx, ty, structure.approach))) return true
  if (insideRect(tx, ty, EXIT)) return true
  if (Math.abs(tx - SPAWN.tx) <= 1 && Math.abs(ty - SPAWN.ty) <= 1) return true
  return tx >= 23 && tx <= 25 && ty >= 24 && ty <= 35
}

function hashPoint(tx, ty, block) {
  let h = ((tx + 11) * 73856093) ^ ((ty + 17) * 19349663) ^ (block * 83492791)
  h ^= h >>> 13
  return h >>> 0
}

function buildSafeSlots() {
  const all = []
  const byBlock = {}
  for (const region of SLOT_REGIONS) {
    const candidates = []
    for (let ty = region.y0; ty <= region.y1; ty++) {
      for (let tx = region.x0; tx <= region.x1; tx++) {
        if (hasMarkerClearance(tx, ty) && !isSlotReserved(tx, ty)) candidates.push({ tx, ty, block: region.block })
      }
    }
    candidates.sort((a, b) => hashPoint(a.tx, a.ty, region.block) - hashPoint(b.tx, b.ty, region.block))
    const chosen = []
    for (const candidate of candidates) {
      if (chosen.some(slot => (slot.tx - candidate.tx) ** 2 + (slot.ty - candidate.ty) ** 2 < 4)) continue
      if (all.some(slot => (slot.tx - candidate.tx) ** 2 + (slot.ty - candidate.ty) ** 2 < 2.25)) continue
      chosen.push(candidate)
      all.push(candidate)
      if (chosen.length === 18) break
    }
    byBlock[region.block] = chosen
  }
  return byBlock
}

export const SAFE_SLOTS = buildSafeSlots()

export function validateWhitebox() {
  const errors = []
  const warnings = []
  const capacities = {}
  for (const region of SLOT_REGIONS) {
    const slots = SAFE_SLOTS[region.block] || []
    capacities[region.block] = slots.length
    const need = Math.max(SOUND_AUDIT.groups.A.blocks[region.block - 1], SOUND_AUDIT.groups.B.blocks[region.block - 1])
    if (slots.length < need) errors.push(`block ${region.block}: ${slots.length}/${need} slots`)
    for (const slot of slots) if (!hasMarkerClearance(slot.tx, slot.ty)) errors.push(`block ${region.block}: clearance ${slot.tx},${slot.ty}`)
  }

  for (const structure of Object.values(STRUCTURES)) {
    for (let ty = structure.approach.y; ty < structure.approach.y + structure.approach.h; ty++) {
      for (let tx = structure.approach.x; tx < structure.approach.x + structure.approach.w; tx++) {
        if (isCollision(tx, ty)) errors.push(`${structure.label}: approach blocked ${tx},${ty}`)
      }
    }
  }

  const start = `${SPAWN.tx},${SPAWN.ty}`
  const queue = [[SPAWN.tx, SPAWN.ty]]
  const visited = new Set([start])
  while (queue.length) {
    const [tx, ty] = queue.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy, key = `${nx},${ny}`
      if (!visited.has(key) && !isCollision(nx, ny)) { visited.add(key); queue.push([nx, ny]) }
    }
  }
  const targets = [
    ...Object.values(STRUCTURES).map(s => [s.approach.x + 1, s.approach.y + 1, s.label]),
    ...Object.values(SAFE_SLOTS).flat().map(s => [s.tx, s.ty, `slot B${s.block}`]),
    [24, 34, 'exit'],
  ]
  for (const [tx, ty, label] of targets) if (!visited.has(`${tx},${ty}`)) errors.push(`${label}: unreachable ${tx},${ty}`)

  const slotTotal = Object.values(capacities).reduce((sum, value) => sum + value, 0)
  if (slotTotal < 108) warnings.push(`target 108 safe slots, generated ${slotTotal}`)
  return { pass: errors.length === 0, errors, warnings, capacities, slotTotal, reachableTiles: visited.size }
}

export const WHITEBOX_VALIDATION = validateWhitebox()
