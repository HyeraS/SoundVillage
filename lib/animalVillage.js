/**
 * Runtime API for the Sunflower Commons Animal map.
 * The reference PNG is the sole static production visual. Geometry in the
 * config is logical data only and is never painted as replacement scenery.
 */
import {
  T, MAP_W, MAP_H, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_BOX,
  BASE_MAP_SRC, WALKABLE_MASK_SRC, FOREGROUND_MAP_SRC,
  buildSunflowerVillageModel, collidesAt,
} from './animalVillageSunflowerConfig.mjs'
import { drawVillageCurrencyIcon } from './villageCurrencyIconCanvas.mjs'

export {
  T, MAP_W, MAP_H, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_BOX,
  BASE_MAP_SRC, WALKABLE_MASK_SRC, FOREGROUND_MAP_SRC,
}

export function setAssetBase(base) {
  const canonical = '/assets/animal-village-sunflower/'
  const requested = base.endsWith('/') ? base : `${base}/`
  if (requested !== canonical) throw new Error(`Animal village assets are fixed by villageId to ${canonical}`)
}

export const IMG = {}
let loaded = null

function loadImage(name, file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => { IMG[name] = image; resolve(image) }
    image.onerror = () => reject(new Error(`Animal village asset failed to load: ${file}`))
    image.src = file
  })
}

export function loadAssets() {
  if (!loaded) {
    loaded = Promise.all([
      loadImage('baseMap', BASE_MAP_SRC),
      loadImage('foregroundMap', FOREGROUND_MAP_SRC),
      loadImage('walkableMask', WALKABLE_MASK_SRC),
    ])
  }
  return loaded
}

export function drawStatic(ctx) {
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  if (IMG.baseMap) ctx.drawImage(IMG.baseMap, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
}

export function drawAnimalVillageLayer(ctx, village, time, playerY, layer = 'back') {
  void village
  void time
  void playerY
  ctx.imageSmoothingEnabled = false
  if (layer === 'back' && IMG.baseMap) {
    ctx.drawImage(IMG.baseMap, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  } else if (layer === 'front' && IMG.foregroundMap) {
    ctx.drawImage(IMG.foregroundMap, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  }
}

export function buildVillage(worldSize = {}) {
  const village = buildSunflowerVillageModel(worldSize)
  village.walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H
    && village.reachable.has(`${tx},${ty}`)
  village.variant = 'sunflower-commons-v4-base-image'
  return village
}

export async function loadAnimalVillage(worldSize = {}) {
  await loadAssets()
  const village = buildVillage(worldSize)
  village.baseMap = IMG.baseMap
  village.foregroundMap = IMG.foregroundMap
  village.walkableMask = IMG.walkableMask
  return village
}

export function moveWithCollision(village, position, dx, dy) {
  let x = position.x
  let y = position.y
  village.lastCollision = null
  const moveAxis = (axis, amount) => {
    const direction = Math.sign(amount)
    let remaining = Math.abs(amount)
    while (remaining > 0) {
      const step = Math.min(4, remaining) * direction
      const nx = axis === 'x' ? x + step : x
      const ny = axis === 'y' ? y + step : y
      const hit = collidesAt(village.colliders, nx, ny, {
        currentWorldWidth: village.currentWorldWidth,
        currentWorldHeight: village.currentWorldHeight,
      })
      if (hit) { village.lastCollision = hit; break }
      x = nx
      y = ny
      remaining -= Math.abs(step)
    }
  }
  if (dx) moveAxis('x', dx)
  if (dy) moveAxis('y', dy)
  return { x, y }
}

export const mulberry32 = (seed) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(value) {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return Math.abs(hash) || 1
}

const BLOCK_NEON = ['#ffd166', '#ff9f6b', '#63c6f2', '#7cd06a', '#c58bff', '#f27a7a']

export function computeBlockGrid(sounds) {
  const byBlock = new Map()
  for (const sound of sounds) {
    const block = sound.block || 1
    if (!byBlock.has(block)) byBlock.set(block, [])
    byBlock.get(block).push(sound)
  }
  const blockNums = [...byBlock.keys()].sort((a, b) => a - b)
  const cols = 3
  const rows = 2
  const colBounds = [2, 17, 31, 46]
  const rowBounds = [2, 16, 29]
  return { byBlock, blockNums, cols, rows, colBounds, rowBounds }
}

function orderedBlockCells(sounds, spawn) {
  const grid = computeBlockGrid(sounds)
  const cells = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      cells.push({
        x0: grid.colBounds[col], x1: grid.colBounds[col + 1],
        y0: grid.rowBounds[row], y1: grid.rowBounds[row + 1],
      })
    }
  }
  const spawnTx = spawn.x / T
  const spawnTy = spawn.y / T
  cells.sort((a, b) => {
    const distance = (cell) => ((cell.x0 + cell.x1) / 2 - spawnTx) ** 2
      + ((cell.y0 + cell.y1) / 2 - spawnTy) ** 2
    return distance(a) - distance(b)
  })
  return { ...grid, cells }
}

export function spawnAnimalItems(sounds, village) {
  const { byBlock, blockNums, cells } = orderedBlockCells(sounds, village.spawn)
  const seedBase = hashSeed(`Animal|${sounds.map((sound) => sound.sound_id).sort().join(',')}`)
  const used = new Set()
  const items = []

  blockNums.forEach((block, blockIndex) => {
    const cell = cells[Math.min(blockIndex, cells.length - 1)]
    const rnd = mulberry32(seedBase ^ Math.imul(block, 0x45d9f3b))
    const localPool = village.spawnSlots
      .filter((slot) => slot.tx >= cell.x0 && slot.tx < cell.x1 && slot.ty >= cell.y0 && slot.ty < cell.y1)
      .filter((slot) => !used.has(`${slot.tx},${slot.ty}`))
    const overflowPool = village.spawnSlots
      .filter((slot) => !used.has(`${slot.tx},${slot.ty}`))
      .filter((slot) => !localPool.some((local) => local.tx === slot.tx && local.ty === slot.ty))
    for (const candidates of [localPool, overflowPool]) {
      for (let index = candidates.length - 1; index > 0; index--) {
        const other = Math.floor(rnd() * (index + 1))
        ;[candidates[index], candidates[other]] = [candidates[other], candidates[index]]
      }
    }
    const pool = [...localPool, ...overflowPool]

    const soundsForBlock = [...byBlock.get(block)]
      .sort((a, b) => String(a.sound_id).localeCompare(String(b.sound_id)))
    const chosen = []
    for (const slot of pool) {
      if (chosen.length >= soundsForBlock.length) break
      if (chosen.every((other) => Math.abs(other.tx - slot.tx) >= 2 || Math.abs(other.ty - slot.ty) >= 2)) chosen.push(slot)
    }
    for (const slot of pool) {
      if (chosen.length >= soundsForBlock.length) break
      if (!chosen.some((other) => other.tx === slot.tx && other.ty === slot.ty)) chosen.push(slot)
    }

    soundsForBlock.forEach((sound, index) => {
      const slot = chosen[index]
      if (!slot) throw new Error(`Animal block ${block} does not have enough reachable spawn slots`)
      used.add(`${slot.tx},${slot.ty}`)
      items.push({
        id: sound.sound_id, sound, tx: slot.tx, ty: slot.ty, block,
        neon: BLOCK_NEON[(block - 1) % BLOCK_NEON.length],
        cat: sound.sub_category, phase: rnd() * Math.PI * 2, collected: false,
      })
    })
  })
  return items
}

export function drawItem(ctx, item, time) {
  const bob = Math.sin(time / 380 + item.phase) * 5
  const x = item.tx * T + 16
  const y = item.ty * T + 18 + bob
  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = '#20250f'
  ctx.beginPath()
  ctx.ellipse(x, item.ty * T + 30, 9, 3.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 18)
  glow.addColorStop(0, `${item.neon}cc`)
  glow.addColorStop(1, `${item.neon}00`)
  ctx.fillStyle = glow
  ctx.fillRect(x - 18, y - 18, 36, 36)
  if (!drawVillageCurrencyIcon(ctx, 'Animal', x, y, { size: 28 })) {
    ctx.fillStyle = '#fff8e6'
    ctx.beginPath()
    ctx.ellipse(x, y + 3, 6, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    for (const [dx, dy] of [[-5.5, -4], [-2, -6.5], [2, -6.5], [5.5, -4]]) {
      ctx.beginPath()
      ctx.ellipse(x + dx, y + dy, 2.2, 2.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = item.neon
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.ellipse(x, y + 3, 3.2, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawLockFog(ctx, sounds, unlockedBlock, time) {
  const { blockNums, cells } = orderedBlockCells(sounds, { x: 23.5 * T, y: 27 * T })
  blockNums.forEach((block, index) => {
    if (block <= unlockedBlock) return
    const cell = cells[Math.min(index, cells.length - 1)]
    const x = cell.x0 * T
    const y = cell.y0 * T
    const width = (cell.x1 - cell.x0) * T
    const height = (cell.y1 - cell.y0) * T
    ctx.save()
    ctx.globalAlpha = 0.53
    ctx.fillStyle = '#f1e7cf'
    ctx.fillRect(x, y, width, height)
    const rnd = mulberry32(block * 77)
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.24
      ctx.fillStyle = '#fffdf4'
      ctx.beginPath()
      ctx.ellipse(x + rnd() * width, y + rnd() * height + Math.sin(time / 900 + i) * 4,
        18 + rnd() * 25, 10 + rnd() * 13, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.font = 'bold 20px "Courier New", monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(80,60,30,.9)'
    ctx.fillText('🔒', x + width / 2, y + height / 2)
    ctx.restore()
  })
}

export function drawAnimalDebug(ctx, village, items, options, player) {
  if (!options) return
  ctx.save()
  ctx.lineWidth = 2
  if (options.colliders) {
    for (const collider of village.colliders) {
      ctx.fillStyle = 'rgba(255,64,64,.2)'
      ctx.fillRect(collider.x, collider.y, collider.w, collider.h)
      ctx.strokeStyle = '#ff4747'
      ctx.strokeRect(collider.x, collider.y, collider.w, collider.h)
    }
  }
  if (options.spawnSlots) {
    ctx.fillStyle = 'rgba(85,255,116,.72)'
    for (const slot of village.spawnSlots) ctx.fillRect(slot.tx * T + 12, slot.ty * T + 12, 8, 8)
    ctx.fillStyle = '#fff'
    for (const item of items || []) ctx.fillRect(item.tx * T + 9, item.ty * T + 9, 14, 14)
  }
  if (options.blocks && options.sounds) {
    const { cols, rows, colBounds, rowBounds } = computeBlockGrid(options.sounds)
    ctx.strokeStyle = '#ffe66d'
    ctx.lineWidth = 3
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(colBounds[c] * T, rowBounds[0] * T)
      ctx.lineTo(colBounds[c] * T, rowBounds[rows] * T); ctx.stroke()
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(colBounds[0] * T, rowBounds[r] * T)
      ctx.lineTo(colBounds[cols] * T, rowBounds[r] * T); ctx.stroke()
    }
  }
  if (player && options.colliders) {
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(player.x - PLAYER_BOX.w / 2, player.y - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h)
  }
  ctx.restore()
}

export function drawPlayer() {}
