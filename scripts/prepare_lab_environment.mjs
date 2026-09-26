import fs from 'node:fs/promises'
import sharp from 'sharp'

const source = 'public/assets/lab-witch/environment-source-v2.png'
const output = 'public/assets/lab-witch/environment-master-v2.png'
const crop = { left: 36, top: 54, width: 1376, height: 1032 }

await fs.access(source)
await sharp(source)
  .extract(crop)
  .resize(1536, 1152, { kernel: 'nearest' })
  .png({ compressionLevel: 9, palette: true })
  .toFile(output)

const metadata = await sharp(output).metadata()
if (metadata.width !== 1536 || metadata.height !== 1152) {
  throw new Error(`Unexpected Lab environment size: ${metadata.width}x${metadata.height}`)
}

console.log(JSON.stringify({ source, output, crop, size: [metadata.width, metadata.height] }, null, 2))
