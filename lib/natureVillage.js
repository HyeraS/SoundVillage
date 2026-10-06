/**
 * Nature village runtime — Brookside Bloom farm.
 *
 * The approved ImageGen village is the runtime's 48x36 world layer. Collision,
 * bridge lanes, sound placement and player interaction remain deterministic
 * gameplay data layered over that exact art-directed map. The atlas-composed
 * renderer is retained only as a defensive fallback if the hero map cannot be
 * supplied by an older asset bundle.
 */
import {
  T, MAP_W, MAP_H, PLAYER_BOX, EXIT,
  BRIDGES, BUILDINGS, FARM_PLOTS, ORCHARD, BENCHES, TREE_CENTERS,
  buildNatureFarmModel,
  mulberry32 as pureMulberry32,
  hashSeed as pureHashSeed,
  computeBlockGrid as pureComputeBlockGrid,
  orderedBlockCells,
  spawnNatureItemsForModel,
  createNatureFlowerDecor,
  moveWithCollisionModel,
} from '@/lib/natureFarmLayout.mjs'
import { drawVillageCurrencyIcon } from './villageCurrencyIconCanvas.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'

export { T, MAP_W, MAP_H, PLAYER_BOX }

const WORLD_W = MAP_W * T
const WORLD_H = MAP_H * T

const NATURE_RUNTIME_MANIFEST = getVillageRuntimeManifest('nature')
const ASSET_PATHS = {
  map: NATURE_RUNTIME_MANIFEST.background.src,
  walkableMask: NATURE_RUNTIME_MANIFEST.mask.src,
  grass: '/assets/world/nature-farm-v2/grass-v2.png',
  path: '/assets/world/nature-farm-v2/path-v2.png',
  creek: '/assets/world/nature-farm-v2/creek-bank-v2.png',
  bridgeDeck: '/assets/world/nature-farm-v2/bridge-deck-v2.png',
  bridgeRails: '/assets/world/nature-farm-v2/bridge-rails-v2.png',
  trees: '/assets/world/nature-farm-v2/trees-v2.png',
  forestTrees: '/assets/world/nature-farm-v2/forest-trees-v2.png',
  appleTrees: '/assets/world/nature-farm-v2/apple-trees-v2.png',
  farm: '/assets/world/nature-farm-v2/farm-v2.png',
  props: '/assets/world/nature-farm-v2/flowers-props-v2.png',
  houseCream: '/assets/world/nature-farm-v2/north-cottage-v2.png',
  houseCabin: '/assets/world/nature-farm-v2/south-cottage-v2.png',
  greenhouse: '/assets/world/nature-farm-v2/greenhouse-v2.png',
  watermill: '/assets/world/nature-farm-v2/watermill-v2.png',
}

const tileKey = (x, y) => `${x},${y}`

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Nature asset failed to load: ${src}`))
    image.src = src
  })
}

let assetPromise = null
function loadAssets() {
  if (!assetPromise) {
    assetPromise = Promise.all(Object.entries(ASSET_PATHS).map(async ([key, src]) => [key, await loadImage(src)]))
      .then((entries) => Object.fromEntries(entries))
  }
  return assetPromise
}

function canvas2d() {
  const canvas = document.createElement('canvas')
  canvas.width = WORLD_W
  canvas.height = WORLD_H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawAtlasCell(ctx, image, index, cols, cellW, cellH, dx, dy, dw = T, dh = T) {
  const sx = (index % cols) * cellW
  const sy = Math.floor(index / cols) * cellH
  ctx.drawImage(image, sx, sy, cellW, cellH, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh))
}

function drawPathCell(ctx, image, tx, ty, n, e, s, w) {
  const dx = tx * T
  const dy = ty * T
  if (!n && !e && !s && !w) {
    drawAtlasCell(ctx, image, 0, 8, 32, 32, dx, dy)
    return
  }

  // The generated sheet describes one-tile lanes, while the approved map uses
  // broad two/three-tile roads. Start with its real sand center, then composite
  // only the grass-facing half of the straight/corner cells at the outer edge.
  ctx.drawImage(image, 8, 8, 16, 16, dx, dy, T, T)
  if (!n) ctx.drawImage(image, 32, 0, 32, 16, dx, dy, T, T / 2)
  if (!s) ctx.drawImage(image, 32, 16, 32, 16, dx, dy + T / 2, T, T / 2)
  if (!w) ctx.drawImage(image, 96, 0, 16, 32, dx, dy, T / 2, T)
  if (!e) ctx.drawImage(image, 112, 0, 16, 32, dx + T / 2, dy, T / 2, T)
  if (!n && !w) ctx.drawImage(image, 0, 0, 16, 16, dx, dy, T / 2, T / 2)
  if (!n && !e) ctx.drawImage(image, 16, 0, 16, 16, dx + T / 2, dy, T / 2, T / 2)
  if (!s && !e) ctx.drawImage(image, 16, 16, 16, 16, dx + T / 2, dy + T / 2, T / 2, T / 2)
  if (!s && !w) ctx.drawImage(image, 0, 16, 16, 16, dx, dy + T / 2, T / 2, T / 2)
}

function drawGround(ctx, model, assets) {
  const rnd = seeded(20260901)
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const edge = Math.min(tx, ty, MAP_W - 1 - tx, MAP_H - 1 - ty)
    const variant = edge < 2 ? 12 + ((tx + ty) % 4) : Math.floor(rnd() * 10)
    drawAtlasCell(ctx, assets.grass, variant, 8, 32, 32, tx * T, ty * T)
  }

  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (!model.path[ty][tx] || model.water[ty][tx]) continue
    const n = !!model.path[ty - 1]?.[tx]
    const e = !!model.path[ty]?.[tx + 1]
    const s = !!model.path[ty + 1]?.[tx]
    const w = !!model.path[ty]?.[tx - 1]
    drawPathCell(ctx, assets.path, tx, ty, n, e, s, w)
  }

  const streamXs = [26, 195, 364, 535, 705, 876, 1049]
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (!model.water[ty][tx]) continue
    const stripX = streamXs[(tx * 3 + ty) % streamXs.length]
    const sy = 62 + ((tx * 17 + ty * 29) % 190)
    ctx.drawImage(assets.creek, stripX + 39, sy, 49, 48, tx * T, ty * T, T, T)
  }

  const rockRects = [[1217,903,64,52], [1130,898,45,57], [1314,799,61,55], [1321,920,47,35]]
  const reedRects = [[896,779,52,86], [970,780,48,86], [1045,787,49,79], [1126,793,51,72]]
  for (let ty = 1; ty < MAP_H - 1; ty++) for (let tx = 1; tx < MAP_W - 1; tx++) {
    if (!model.water[ty][tx]) continue
    const x = tx * T
    const y = ty * T
    const sides = [
      [-1, 0, x - 9, y + 7, 18, 18], [1, 0, x + 23, y + 7, 18, 18],
      [0, -1, x + 7, y - 8, 19, 17], [0, 1, x + 7, y + 23, 19, 17],
    ]
    for (const [dx, dy, rx, ry, rw, rh] of sides) {
      if (model.water[ty + dy]?.[tx + dx]) continue
      const rect = rockRects[(tx + ty + dx + dy + 8) % rockRects.length]
      ctx.drawImage(assets.creek, ...rect, rx, ry, rw, rh)
      if ((tx * 5 + ty * 3 + dx) % 7 === 0) {
        const reed = reedRects[(tx + ty) % reedRects.length]
        ctx.drawImage(assets.creek, ...reed, rx - 2, ry - 14, 18, 28)
      }
    }
  }
}

function drawFieldGround(ctx, assets) {
  for (const p of FARM_PLOTS) {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      const sx = 1218 + ((x + y) % 3) * 28
      const sy = 116 + ((x * 7 + y * 11) % 3) * 26
      ctx.drawImage(assets.farm, sx, sy, 48, 48, x * T, y * T, T, T)
    }
  }
}

function drawFenceTile(ctx, assets, tx, ty, horizontal = true) {
  const dx = tx * T
  const dy = ty * T
  if (horizontal) ctx.drawImage(assets.farm, 66, 530, 93, 43, dx, dy + 7, T, 18)
  else ctx.drawImage(assets.farm, 70, 612, 22, 55, dx + 7, dy, 18, T)
}

const CROP_RECTS = {
  wheat: [63,714,77,106], carrot: [775,717,55,104],
  cabbage: [54,865,61,95], corn: [764,861,53,99],
}

function drawPlot(ctx, assets, p, plotIndex) {
  const x1 = p.x + p.w - 1
  const y1 = p.y + p.h - 1
  for (let x = p.x; x <= x1; x++) {
    drawFenceTile(ctx, assets, x, p.y, true)
    const gate = p.gate.side === 'bottom' && (x === p.gate.at || x === p.gate.at + 1)
    if (!gate) drawFenceTile(ctx, assets, x, y1, true)
  }
  for (let y = p.y + 1; y < y1; y++) {
    drawFenceTile(ctx, assets, p.x, y, false)
    if (!(p.gate.side === 'right' && y === p.gate.at)) drawFenceTile(ctx, assets, x1, y, false)
  }
  for (let y = p.y + 1; y < y1; y++) for (let x = p.x + 1; x < x1; x++) {
    const crop = plotIndex === 0 ? CROP_RECTS.wheat
      : plotIndex === 2 ? CROP_RECTS.corn
        : ((x + y) % 2 ? CROP_RECTS.carrot : CROP_RECTS.cabbage)
    ctx.drawImage(assets.farm, ...crop, x * T + 3, y * T + 2, 26, 29)
  }
}

function drawBridge(ctx, assets, bridge, index) {
  ctx.drawImage(assets.bridgeDeck, 0, index * 128, 288, 128, bridge.x0 * T, bridge.y * T, 288, 128)
}

function drawBridgeRail(ctx, assets, bridge, index) {
  ctx.drawImage(assets.bridgeRails, 0, index * 54, 288, 54, bridge.x0 * T, bridge.y * T + 74, 288, 54)
}

function drawAsset(ctx, image, x, y, w, h) {
  ctx.drawImage(image, 0, 0, image.width, image.height, Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function drawAssetForeground(ctx, image, x, y, w, h, ratio) {
  const sh = Math.max(1, Math.round(image.height * ratio))
  ctx.drawImage(image, 0, 0, image.width, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(h * ratio))
}

function treeRect(tx, ty, w = 112, h = 128) {
  return { x: tx * T + T / 2 - w / 2, y: ty * T + T - h, w, h }
}

function drawTree(ctx, image, tx, ty, variant, variantCount, w = 112, h = 128) {
  const r = treeRect(tx, ty, w, h)
  const sx = (variant % variantCount) * 112
  ctx.drawImage(image, sx, 0, 112, 128, r.x, r.y, r.w, r.h)
  return r
}

function drawTreeForeground(ctx, image, tx, ty, variant, variantCount, w = 112, h = 128) {
  const r = treeRect(tx, ty, w, h)
  const sourceH = 94
  ctx.drawImage(image, (variant % variantCount) * 112, 0, 112, sourceH, r.x, r.y, r.w, r.h * sourceH / 128)
}

const FLOWER_RECTS = [
  [82,83,58,82], [81,233,59,88], [80,373,60,82], [79,506,62,87],
  [202,80,81,85], [196,221,90,100], [193,361,85,94], [196,491,86,104],
  [346,58,116,107], [346,204,113,117], [337,354,120,104], [337,480,108,118],
]

function drawFlowers(ctx, assets, flowers) {
  for (const f of flowers) {
    const rect = FLOWER_RECTS[f.variant % FLOWER_RECTS.length]
    const height = 14 + (f.variant % 4) * 3
    const width = Math.max(8, Math.round(rect[2] / rect[3] * height))
    const x = f.tx * T + T / 2 - width / 2 + f.ox
    const y = f.ty * T + T - height + f.oy
    ctx.drawImage(assets.props, ...rect, Math.round(x), Math.round(y), width, height)
  }
}

function drawOrchard(ctx, fg, assets) {
  const x1 = ORCHARD.x + ORCHARD.w - 1
  const y1 = ORCHARD.y + ORCHARD.h - 1
  for (let x = ORCHARD.x; x <= x1; x++) {
    drawFenceTile(ctx, assets, x, ORCHARD.y, true)
    const gate = x === ORCHARD.gate.at || x === ORCHARD.gate.at + 1
    if (!gate) drawFenceTile(ctx, assets, x, y1, true)
  }
  for (let y = ORCHARD.y + 1; y < y1; y++) {
    drawFenceTile(ctx, assets, ORCHARD.x, y, false)
    drawFenceTile(ctx, assets, x1, y, false)
  }
  ORCHARD.trees.forEach(([tx, ty], index) => {
    drawTree(ctx, assets.appleTrees, tx, ty, index, 3, 104, 119)
    drawTreeForeground(fg, assets.appleTrees, tx, ty, index, 3, 104, 119)
  })
}

const PROP_RECTS = {
  bench: [77,805,225,162],
  sign: [372,800,108,160],
  barrel: [552,809,130,149],
  crate: [744,838,122,120],
}

const SMALL_PROPS = [
  { type: 'sign', tx: 7, ty: 19, w: 31, h: 46 },
  { type: 'barrel', tx: 7, ty: 10, w: 34, h: 39 },
  { type: 'crate', tx: 7, ty: 29, w: 32, h: 31 },
]

function drawProp(ctx, assets, type, x, y, w, h) {
  ctx.drawImage(assets.props, ...PROP_RECTS[type], Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function drawProps(ctx, fg, assets) {
  for (const bench of BENCHES) {
    drawProp(ctx, assets, 'bench', bench.x, bench.y - 23, 96, 69)
    const [sx, sy, sw, sh] = PROP_RECTS.bench
    const sourceH = 84
    fg.drawImage(assets.props, sx, sy, sw, sourceH, bench.x, bench.y - 23, 96, Math.round(69 * sourceH / sh))
  }
  for (const prop of SMALL_PROPS) {
    drawProp(ctx, assets, prop.type, prop.tx * T, prop.ty * T + T - prop.h, prop.w, prop.h)
  }
}

function drawBuildings(ctx, fg, assets) {
  for (const b of BUILDINGS) {
    const image = assets[b.asset]
    drawAsset(ctx, image, b.x, b.y, b.w, b.h)
    drawAssetForeground(fg, image, b.x, b.y, b.w, b.h, b.id === 'watermill' ? 0.58 : 0.64)
  }
}

function drawAtlasStaticLayers(model, assets, flowers) {
  const base = canvas2d()
  const foreground = canvas2d()
  drawGround(base.ctx, model, assets)
  drawFieldGround(base.ctx, assets)
  FARM_PLOTS.forEach((plot, index) => drawPlot(base.ctx, assets, plot, index))
  BRIDGES.forEach((bridge, index) => drawBridge(base.ctx, assets, bridge, index))
  drawBuildings(base.ctx, foreground.ctx, assets)
  drawOrchard(base.ctx, foreground.ctx, assets)
  drawProps(base.ctx, foreground.ctx, assets)
  TREE_CENTERS.forEach(([tx, ty], index) => {
    const forestEdge = Math.min(tx, ty, MAP_W - 1 - tx, MAP_H - 1 - ty) <= 3
    const image = forestEdge ? assets.forestTrees : assets.trees
    const count = forestEdge ? 2 : 6
    drawTree(base.ctx, image, tx, ty, index, count)
    drawTreeForeground(foreground.ctx, image, tx, ty, index, count)
  })
  drawFlowers(base.ctx, assets, flowers)
  BRIDGES.forEach((bridge, index) => drawBridgeRail(foreground.ctx, assets, bridge, index))
  return { staticCanvas: base.canvas, foregroundCanvas: foreground.canvas }
}

function drawStaticLayers(model, assets, flowers) {
  if (!assets.map) return drawAtlasStaticLayers(model, assets, flowers)

  const base = canvas2d()
  const foreground = canvas2d()
  drawAsset(base.ctx, assets.map, 0, 0, WORLD_W, WORLD_H)

  // The approved map already contains every environmental object. Keeping the
  // foreground transparent avoids double-drawing generated roofs, trees and
  // bridge rails while the live player, sound orbs and fog remain independent.
  return { staticCanvas: base.canvas, foregroundCanvas: foreground.canvas }
}

export async function loadNatureVillage(worldSize = {}) {
  const assets = await loadAssets()
  const model = buildNatureFarmModel(worldSize)
  const flowers = createNatureFlowerDecor(model)
  const layers = drawStaticLayers(model, assets, flowers)
  const decorTiles = new Set(flowers.map((f) => tileKey(f.tx, f.ty)))
  for (const bench of BENCHES) {
    const tx = Math.floor(bench.x / T)
    const ty = Math.floor(bench.y / T)
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx; x <= tx + 2; x++) decorTiles.add(tileKey(x, y))
  }
  for (const prop of SMALL_PROPS) decorTiles.add(tileKey(prop.tx, prop.ty))
  return { ...model, ...layers, assets, decorTiles, houses: BUILDINGS }
}

export function moveWithCollision(village, pos, dx, dy) {
  return moveWithCollisionModel(village, pos, dx, dy)
}

export const mulberry32 = pureMulberry32
export const hashSeed = pureHashSeed
export const computeBlockGrid = pureComputeBlockGrid

export function spawnNatureItems(sounds, village) {
  return spawnNatureItemsForModel(sounds, village, village.decorTiles)
}

export function drawOrb(ctx, item, time) {
  const x = item.tx * T + 16
  const groundY = item.ty * T + 21
  const y = item.ty * T + 13 + Math.sin(time / 520 + item.phase) * 5
  ctx.fillStyle = 'rgba(79,55,28,.25)'
  ctx.fillRect(x - 9, groundY, 18, 5)
  const wave = (time + item.phase * 700) % 1800 / 1800
  ctx.strokeStyle = `rgba(255,241,164,${0.62 * (1 - wave)})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, 10 + wave * 18, 0, Math.PI * 2)
  ctx.stroke()
  if (!drawVillageCurrencyIcon(ctx, 'Nature', x, y, { size: 30 })) {
    const grad = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 15)
    grad.addColorStop(0, '#fffde5')
    grad.addColorStop(0.38, '#ffd764')
    grad.addColorStop(1, 'rgba(238,163,42,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fffde2'
    ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 3, 3)
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - 1, 2, 5)
  }
}

export function drawWaterShimmers(ctx, time) {
  const points = [[23,4], [20,16], [25,23], [30,33]]
  points.forEach(([tx, ty], i) => {
    const alpha = 0.24 + 0.16 * Math.sin(time / 900 + i)
    ctx.fillStyle = `rgba(203,255,247,${alpha})`
    ctx.fillRect(tx * T + 6, ty * T + 11, 14, 3)
    ctx.fillRect(tx * T + 18, ty * T + 18, 7, 2)
  })
}

export function drawLockFog(ctx, sounds, unlockedBlock, time) {
  const { blockNums, cells } = orderedBlockCells(sounds, { x: 18 * T + 16, y: 33 * T + 16 })
  blockNums.forEach((block, index) => {
    if (block <= unlockedBlock) return
    const cell = cells[Math.min(index, cells.length - 1)]
    const x = cell.x0 * T
    const y = cell.y0 * T
    const w = (cell.x1 - cell.x0) * T
    const h = (cell.y1 - cell.y0) * T
    ctx.fillStyle = 'rgba(54,82,49,.42)'
    ctx.fillRect(x, y, w, h)
    const rnd = mulberry32(block * 771)
    ctx.fillStyle = 'rgba(231,241,213,.22)'
    for (let i = 0; i < 10; i++) {
      const px = Math.round(x + rnd() * w)
      const py = Math.round(y + rnd() * h + Math.sin(time / 1200 + i) * 3)
      ctx.fillRect(px, py, 24 + Math.floor(rnd() * 36), 8)
    }
    ctx.font = 'bold 18px "Courier New", monospace'
    ctx.fillStyle = 'rgba(29,44,26,.82)'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔒', x + w / 2 - 10, y + h / 2)
  })
}
