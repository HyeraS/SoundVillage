import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const manifestPath = path.join(root, 'public/assets/sound-museum-final-b/manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const ids = manifest.assets.map(asset => asset.id)
assert.equal(new Set(ids).size, ids.length, 'manifest asset IDs must be unique')
assert.equal(manifest.instances.listeningStations.length, 5, 'exactly five listening stations are required')
assert.equal(manifest.instances.zoneExhibits.length, 6, 'exactly six zone exhibits are required')

for (const asset of manifest.assets) {
  assert.match(asset.src, /\.png$/i, `${asset.id} must be a lossless PNG`)
  const file = path.join(root, 'public', asset.src.replace(/^\//, ''))
  await access(file)
  const image = sharp(file)
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  assert.equal(metadata.width, asset.sourceWidth, `${asset.id} source width mismatch`)
  assert.equal(metadata.height, asset.sourceHeight, `${asset.id} source height mismatch`)
  assert.ok(stats.channels.some(channel => channel.max > channel.min), `${asset.id} must not be blank`)
  if (asset.id !== 'architecture-room-shell') assert.equal(metadata.hasAlpha, true, `${asset.id} must preserve alpha`)
  assert.ok(asset.sourceWidth / asset.displayWidth >= 2, `${asset.id} width master must be at least 2x display`)
  assert.ok(asset.sourceHeight / asset.displayHeight >= 2, `${asset.id} height master must be at least 2x display`)
  const rects = asset.collision ? (Array.isArray(asset.collision) ? asset.collision : [asset.collision]) : []
  for (const rect of rects) {
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= manifest.world.width && rect.y + rect.height <= manifest.world.height, `${asset.id} collision must stay in world`)
  }
}

const { MUSEUM_INTERACTIONS } = await import('../lib/soundMuseumFinalBLayout.mjs')
for (const zone of MUSEUM_INTERACTIONS) {
  assert.ok(zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= manifest.world.width && zone.y + zone.height <= manifest.world.height, `${zone.id} interaction must stay in world`)
}

console.log(`Sound Museum Final B assets OK: ${manifest.assets.length} instances, 5 stations, 6 exhibits`)

