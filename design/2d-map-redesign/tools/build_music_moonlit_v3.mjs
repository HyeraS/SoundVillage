import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  T, MAP_W, MAP_H, STAGE, GATE, BUILDINGS, PROPS, SCENE_TREES, PROP_COLLIDERS, BLOCKING_PROP_COLLIDERS,
  OCCLUSION_OBJECTS, NAV_CELL,
} from '../../../lib/musicVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SOURCE = path.join(ROOT, 'design/2d-map-redesign/sources/music-moonlit-v3/clean-production-master.png')
const OUT = path.join(ROOT, 'public/assets/music-village-moonlit-v3')
const PREVIEWS = path.join(ROOT, 'design/2d-map-redesign/previews/music-moonlit-v3')
const W = MAP_W * T
const H = MAP_H * T
const files = []

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`)

async function write(relative, input) {
  const target = path.join(OUT, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  await sharp(input).png({ compressionLevel: 9 }).toFile(target)
  const data = fs.readFileSync(target)
  files.push({
    path: relative,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  })
}

function objectMask(objects) {
  const shapes = objects.map((object) =>
    `<polygon points="${object.maskPoints.map(({ x, y }) => `${x},${y}`).join(' ')}" fill="white"/>`
  ).join('')
  return svg(shapes)
}

async function buildForeground(master) {
  const landmarks = OCCLUSION_OBJECTS.filter((object) => object.kind !== 'vegetation')
  const trees = OCCLUSION_OBJECTS.filter((object) => object.kind === 'vegetation')
  const landmarkLayer = await sharp(master).composite([{ input: objectMask(landmarks), blend: 'dest-in' }]).png().toBuffer()
  const { data: rgb } = await sharp(master).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { data: treeMask } = await sharp(objectMask(trees)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(W * H * 4)
  for (let treeIndex = 0; treeIndex < trees.length; treeIndex++) {
    const object = trees[treeIndex]
    const tree = SCENE_TREES[treeIndex]
    const left = Math.round(object.display.x)
    const top = Math.round(object.display.y)
    const width = Math.round(object.display.w)
    const height = Math.round(object.display.h)
    const candidate = new Uint8Array(width * height)
    const visited = new Uint8Array(width * height)
    const queue = []
    for (let localY = 0; localY < height; localY++) {
      for (let localX = 0; localX < width; localX++) {
        const x = left + localX
        const y = top + localY
        const pixel = y * W + x
        if (treeMask[pixel * 4 + 3] === 0) continue
        const r = rgb[pixel * 3]
        const g = rgb[pixel * 3 + 1]
        const b = rgb[pixel * 3 + 2]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max ? (max - min) / max : 0
        const foliage = saturation > .16 && max < 225 && (b > r * 1.08 || g > r * 1.18)
        const trunk = Math.abs(x - tree.cx) <= 12 && y >= tree.cy + tree.ry * .35 && y <= tree.sortY && max < 170 && saturation > .12
        if (!foliage && !trunk) continue
        const local = localY * width + localX
        candidate[local] = 1
        if (Math.abs(x - tree.cx) <= 10 && Math.abs(y - tree.cy) <= 12) {
          visited[local] = 1
          queue.push(local)
        }
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const local = queue[cursor]
      const localX = local % width
      const localY = Math.floor(local / width)
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue
          const nx = localX + ox
          const ny = localY + oy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const next = ny * width + nx
          if (!candidate[next] || visited[next]) continue
          visited[next] = 1
          queue.push(next)
        }
      }
    }
    for (const local of queue) {
      const x = left + local % width
      const y = top + Math.floor(local / width)
      const pixel = y * W + x
      rgba[pixel * 4] = rgb[pixel * 3]
      rgba[pixel * 4 + 1] = rgb[pixel * 3 + 1]
      rgba[pixel * 4 + 2] = rgb[pixel * 3 + 2]
      rgba[pixel * 4 + 3] = 255
    }
  }
  const treeLayer = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: landmarkLayer }, { input: treeLayer }]).png().toBuffer()
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing clean production master: ${SOURCE}`)
  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(PREVIEWS, { recursive: true })

  const master = await sharp(SOURCE)
    .resize(W, H, { fit: 'fill', kernel: 'nearest' })
    .png()
    .toBuffer()

  const chunks = [
    ['nw', 0, 0], ['ne', W / 2, 0], ['sw', 0, H / 2], ['se', W / 2, H / 2],
  ]
  for (const [id, left, top] of chunks) {
    await write(`ground/chunk-${id}.png`, await sharp(master).extract({ left, top, width: W / 2, height: H / 2 }).png().toBuffer())
  }

  const occlusion = await buildForeground(master)
  await write('foreground/occlusion.png', occlusion)

  const manifest = {
    version: 'music-moonlit-v3.0.0',
    productionUse: true,
    geometry: { width: W, height: H, tiles: { width: MAP_W, height: MAP_H }, tileSize: T },
    artAuthority: {
      selectedStyleframe: 'design/concepts/music-village-cozy-2026-09-17/01-moonlit-concert-garden-v2-music.png',
      cleanMaster: 'design/2d-map-redesign/sources/music-moonlit-v3/clean-production-master.png',
      edit: 'Only the five baked example sound orbs were removed; composition and environment were preserved.',
    },
    generation: {
      script: 'design/2d-map-redesign/tools/build_music_moonlit_v3.mjs',
      runtimePackaging: `1536x1152 nearest-neighbor ground chunks plus per-object polygon alpha foreground; ${NAV_CELL}px terrain navigation cells`,
    },
    stage: STAGE,
    gate: GATE,
    buildings: BUILDINGS,
    props: PROPS.map((item, index) => ({
      ...item,
      markerAvoidance: PROP_COLLIDERS[index],
      movementBlocking: BLOCKING_PROP_COLLIDERS.some((rect) => rect.tag === PROP_COLLIDERS[index].tag),
    })),
    sceneTrees: SCENE_TREES,
    drawOrder: ['ground chunks', 'foreground decoration', 'vignette', 'runtime sound markers', 'runtime player', 'HUD'],
    exclusions: ['baked sound markers', 'characters', 'UI', 'collision guides', 'review overlays'],
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  await sharp(master).toFile(path.join(PREVIEWS, 'production-overview.png'))
  await sharp(master).grayscale().toFile(path.join(PREVIEWS, 'grayscale-readability.png'))
  await sharp(master).modulate({ brightness: .76, saturation: .68 }).toFile(path.join(PREVIEWS, 'emissive-off-readability.png'))
  await sharp(master).composite([{ input: occlusion, left: 0, top: 0 }]).toFile(path.join(PREVIEWS, 'foreground-occlusion-preview.png'))
  console.log(`Moonlit v3 package: ${files.length} PNG files -> ${OUT}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
