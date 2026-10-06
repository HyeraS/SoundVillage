import atlasManifest from '@/public/assets/human-village/manifest.json'
import {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX, HUMAN_LAYER_Z, SPAWN, EXIT_TRIGGER,
  BLOCK_REGIONS, PATH_RECTS, OBJECTS, COLLIDER_TILE_RECTS, SAFE_SLOTS_BY_BLOCK,
  LANDMARKS, FOREGROUND_REGIONS, buildHumanVillage, spawnHumanItems,
  moveWithCollision, overlapsExitTrigger, markerStateFor, blockForTile,
  isWalkableTile,
} from '@/lib/humanVillageConfig.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'

export {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX, HUMAN_LAYER_Z, SPAWN, EXIT_TRIGGER,
  BLOCK_REGIONS, PATH_RECTS, OBJECTS, COLLIDER_TILE_RECTS, SAFE_SLOTS_BY_BLOCK,
  LANDMARKS, FOREGROUND_REGIONS, buildHumanVillage, spawnHumanItems,
  moveWithCollision, overlapsExitTrigger, markerStateFor,
}

const humanRuntimeManifest = getVillageRuntimeManifest('human')
const masterUrl = humanRuntimeManifest.background.src
const foregroundUrl = humanRuntimeManifest.foreground.src
const maskUrl = humanRuntimeManifest.mask.src
let loadPromise = null

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Human Village asset failed to load: ${src}`))
    image.src = src
  })
}

export function loadHumanAssets() {
  if (!loadPromise) {
    loadPromise = Promise.all([loadImage(masterUrl), loadImage(foregroundUrl), loadImage(maskUrl)])
      .then(([master, foreground, walkableMask]) => Object.freeze({ master, foreground, walkableMask, manifest: atlasManifest }))
  }
  return loadPromise
}

// The environment is already present in the static master. The background pass
// is intentionally empty. The foreground pass redraws exact master pixels only
// for objects whose baseline is below the player's feet.
export function drawHumanObjects(ctx, assets, playerY, pass) {
  if (pass !== 'above') return
  ctx.imageSmoothingEnabled = false
  for (const region of FOREGROUND_REGIONS) {
    if (playerY >= region.baseline * T) continue
    const sx = region.x * T
    const sy = region.y * T
    const sw = region.w * T
    const sh = region.h * T
    ctx.drawImage(assets.foreground, sx, sy, sw, sh, sx, sy, sw, sh)
  }
}

export function drawHumanExitCue(ctx, time = 0) {
  const pulse = .4 + Math.sin(time / 420) * .1
  ctx.fillStyle = `rgba(255,222,139,${pulse})`
  ctx.fillRect(23 * T, 35 * T + 7, 3 * T, 4)
  ctx.fillStyle = '#f0b84c'
  ctx.beginPath()
  ctx.moveTo(24.5 * T, 35 * T + 24)
  ctx.lineTo(24.16 * T, 35 * T + 12)
  ctx.lineTo(24.84 * T, 35 * T + 12)
  ctx.closePath()
  ctx.fill()
}

function drawWaveform(ctx, x, y, color) {
  ctx.fillStyle = color
  const bars = [[-7, 7], [-3, 12], [1, 16], [5, 10], [9, 6]]
  for (const [dx, height] of bars) ctx.fillRect(x + dx - 1, Math.round(y - height / 2), 2, height)
}

// Matches the reference's gold circular waveform language while keeping the
// runtime disc below one tile so deterministic 32px-separated items do not overlap.
export function drawHumanMarker(ctx, item, state, time) {
  if (state === 'unavailable') return
  const x = item.tx * T + T / 2
  const y = item.ty * T + 11 + Math.sin(time / 520 + item.phase) * 2
  const nearby = state === 'nearby' || state === 'interacting'

  ctx.fillStyle = 'rgba(69,48,24,.38)'
  ctx.beginPath()
  ctx.ellipse(x, y + 16, 9, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  if (state === 'completed') {
    ctx.fillStyle = 'rgba(126,118,68,.72)'
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,237,178,.72)'
    ctx.lineWidth = 2
    ctx.stroke()
    drawWaveform(ctx, x, y, 'rgba(255,246,211,.72)')
    return
  }

  const glow = ctx.createRadialGradient(x, y, 4, x, y, nearby ? 23 : 19)
  glow.addColorStop(0, 'rgba(255,247,205,.75)')
  glow.addColorStop(.52, 'rgba(248,190,67,.38)')
  glow.addColorStop(1, 'rgba(248,190,67,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(x, y, nearby ? 23 : 19, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = '#efb63f'
  ctx.beginPath(); ctx.arc(x, y, nearby ? 14 : 13, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#fff0ac'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(164,101,28,.66)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(x, y, nearby ? 16 : 15, 0, Math.PI * 2); ctx.stroke()
  drawWaveform(ctx, x, y, '#fff9d9')

  if (nearby) {
    ctx.strokeStyle = 'rgba(255,237,154,.8)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(time / 250) * 2, 0, Math.PI * 2); ctx.stroke()
  }
}

export function drawHumanLockFog(ctx, unlockedBlock, time) {
  for (let block = unlockedBlock + 1; block <= 6; block++) {
    const region = BLOCK_REGIONS[block]
    const x = region.x * T
    const y = region.y * T
    const w = region.w * T
    const h = region.h * T
    ctx.fillStyle = 'rgba(62,71,48,.42)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(239,224,184,.11)'
    for (let row = 0; row < 5; row++) {
      const drift = Math.round(Math.sin(time / 900 + block + row) * 12)
      ctx.fillRect(x + 18 + drift, y + 28 + row * Math.max(42, h / 6), Math.max(36, w - 60), 7)
    }
    ctx.fillStyle = 'rgba(50,58,39,.85)'
    ctx.font = 'bold 18px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔒', x + w / 2, y + h / 2)
  }
}

export function drawHumanDebug(ctx, { showCollision = false, showSpawns = false, unlockedBlock = 6 } = {}) {
  if (showCollision) {
    ctx.fillStyle = 'rgba(200,42,42,.18)'
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      if (!isWalkableTile(tx, ty)) ctx.fillRect(tx * T, ty * T, T, T)
    }
    ctx.fillStyle = 'rgba(225,32,32,.48)'
    for (const region of COLLIDER_TILE_RECTS) ctx.fillRect(region.x * T, region.y * T, region.w * T, region.h * T)
    ctx.strokeStyle = 'rgba(255,255,255,.2)'
    ctx.lineWidth = 1
    for (let x = 0; x <= MAP_W; x++) { ctx.beginPath(); ctx.moveTo(x * T, 0); ctx.lineTo(x * T, MAP_H * T); ctx.stroke() }
    for (let y = 0; y <= MAP_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * T); ctx.lineTo(MAP_W * T, y * T); ctx.stroke() }
  }
  if (showSpawns) {
    for (let block = 1; block <= unlockedBlock; block++) {
      ctx.fillStyle = `hsla(${20 + block * 32},85%,62%,.5)`
      for (const slot of SAFE_SLOTS_BY_BLOCK[block]) ctx.fillRect(slot.tx * T + 11, slot.ty * T + 11, 10, 10)
    }
  }
  ctx.fillStyle = '#57e18c'
  ctx.fillRect(SPAWN.x - 6, SPAWN.y - 6, 12, 12)
}

export async function loadHumanVillage(worldSize = {}) {
  const assets = await loadHumanAssets()
  const staticCanvas = document.createElement('canvas')
  staticCanvas.width = MAP_W * T
  staticCanvas.height = MAP_H * T
  const context = staticCanvas.getContext('2d')
  context.imageSmoothingEnabled = false
  context.drawImage(assets.master, 0, 0)
  return Object.freeze({ ...buildHumanVillage(worldSize), assets, staticCanvas })
}

export function countWalkableByBlock() {
  const counts = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index + 1, 0]))
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (isWalkableTile(tx, ty)) counts[blockForTile(tx, ty)]++
  }
  return counts
}
