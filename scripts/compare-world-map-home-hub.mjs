import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/house-hub-redesign-2026-09-24')
const beforePath = path.join(REVIEW, 'before/01-world-overview.png')
const afterPath = path.join(REVIEW, 'after/09-world-overview.png')
const outputDir = path.join(REVIEW, 'metrics')
await mkdir(outputDir, { recursive:true })

const width = 960
const height = 720
const before = await sharp(beforePath).resize(width, height, { fit:'fill' }).removeAlpha().raw().toBuffer()
const after = await sharp(afterPath).extract({ left:160, top:0, width, height }).removeAlpha().raw().toBuffer()

const expectedChange = (x, y) => (
  // Former home interaction badge; the painted building remains a guesthouse.
  (x >= 130 && x <= 285 && y >= 120 && y <= 215)
  // New central home, status beacon and entrance label.
  || (x >= 325 && x <= 510 && y >= 315 && y <= 485)
)

const heat = Buffer.alloc(width * height * 4)
let outsideAbsolute = 0
let outsideSamples = 0
let outsideChangedPixels = 0
let insideChangedPixels = 0
for (let pixel = 0; pixel < width * height; pixel += 1) {
  const offset = pixel * 3
  const x = pixel % width
  const y = Math.floor(pixel / width)
  const delta = (Math.abs(before[offset] - after[offset]) + Math.abs(before[offset + 1] - after[offset + 1]) + Math.abs(before[offset + 2] - after[offset + 2])) / 3
  const expected = expectedChange(x, y)
  if (expected) insideChangedPixels += delta > 24 ? 1 : 0
  else {
    outsideAbsolute += delta
    outsideSamples += 1
    outsideChangedPixels += delta > 24 ? 1 : 0
  }
  heat[pixel * 4] = Math.min(255, delta * 5)
  heat[pixel * 4 + 1] = expected ? 118 : 18
  heat[pixel * 4 + 2] = expected ? 32 : 18
  heat[pixel * 4 + 3] = delta > 5 ? 235 : 0
}

await Promise.all([
  sharp(before, { raw:{ width, height, channels:3 } }).png().toFile(path.join(outputDir, 'before-normalized.png')),
  sharp(after, { raw:{ width, height, channels:3 } }).png().toFile(path.join(outputDir, 'after-normalized.png')),
  sharp(heat, { raw:{ width, height, channels:4 } }).png().toFile(path.join(outputDir, 'difference-heatmap.png')),
])

const outsideMeanAbsoluteError255 = Number((outsideAbsolute / outsideSamples).toFixed(4))
const outsideChangedPixelRatio = Number((outsideChangedPixels / outsideSamples).toFixed(6))
const passed = outsideMeanAbsoluteError255 < 8 && outsideChangedPixelRatio < 0.01 && insideChangedPixels > 1000
const report = {
  status:passed ? 'PASS' : 'FAIL',
  normalizedSize:[width, height],
  comparison:'baseline 4:3 capture vs centered 4:3 map crop from the new browser capture',
  expectedChangeRegions:['former-home interaction marker', 'new central home landmark and interaction marker'],
  outsideMeanAbsoluteError255,
  outsideChangedPixelRatio,
  expectedRegionChangedPixels:insideChangedPixels,
}
await writeFile(path.join(outputDir, 'visual-regression.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!passed) process.exitCode = 1
