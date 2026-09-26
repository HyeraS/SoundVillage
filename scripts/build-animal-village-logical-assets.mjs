import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { COLLIDERS, WORLD_WIDTH, WORLD_HEIGHT } from '../lib/animalVillageSunflowerConfig.mjs'

const root = new URL('../', import.meta.url)
const source = fileURLToPath(new URL('public/design-previews/animal-village-concepts/01-sunflower-commons-v4.png', root))
const outputRoot = new URL('public/assets/animal-village-sunflower/', root)

const rects = COLLIDERS.map(({ x, y, w, h }) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000"/>`).join('')

const walkableSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}">
    <rect width="100%" height="100%" fill="#fff"/>
    ${rects}
  </svg>
`)

await sharp(walkableSvg).png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('walkable-mask.png', outputRoot)))

// Only the entrance arch is extracted. Its mask is deliberately conservative:
// every visible color comes directly from the reference and the rest is fully
// transparent. Ambiguous tree/roof silhouettes are omitted instead of being
// approximated with replacement art or haloed cut-outs.
const foregroundMask = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}">
    <path d="M660 802 L678 787 L699 778 L737 784 L773 782 L803 801 L807 838 L790 842 L778 819 L687 819 L675 842 L657 837 Z" fill="#fff"/>
    <path d="M664 813 H691 V916 H664 Z" fill="#fff"/>
    <path d="M778 811 H808 V916 H778 Z" fill="#fff"/>
  </svg>
`)

const sourcePixels = await sharp(source).ensureAlpha().png().toBuffer()
const hardForegroundMask = await sharp(foregroundMask).threshold(128).png().toBuffer()
await sharp({ create: { width: WORLD_WIDTH, height: WORLD_HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: sourcePixels, left: 0, top: 0 },
    { input: hardForegroundMask, left: 0, top: 0, blend: 'dest-in' },
  ])
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('foreground-map.png', outputRoot)))

console.log('Built walkable-mask.png and foreground-map.png at 1536x1024.')
