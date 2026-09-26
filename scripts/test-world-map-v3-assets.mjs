import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { WORLD_MAP_V3_ASSET_IDS, WORLD_MAP_V3_ASSETS } from '../lib/worldMapV3Assets.mjs'
import {
  WORLD_MAP_V3,
  WORLD_MAP_V3_ASSET_MANIFEST,
  WORLD_MAP_V3_DESTINATIONS,
  WORLD_MAP_V3_FOREGROUND,
  WORLD_MAP_V3_OBJECTS,
  objectBounds,
} from '../lib/worldMapV3Manifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-modular-v3')
const ids = [...WORLD_MAP_V3_ASSET_IDS]
assert.equal(new Set(ids).size, ids.length, 'asset IDs are unique')
assert.ok(ids.length >= 20 && ids.length <= 60, 'modular runtime asset count stays in the intended range')

const usage = new Map(ids.map(id => [id, 0]))
for (const id of [
  'terrain-grass', 'terrain-path', 'terrain-plaza', 'terrain-water',
  ...WORLD_MAP_V3_OBJECTS.map(object => object.assetId),
  ...WORLD_MAP_V3_FOREGROUND.map(object => object.assetId),
]) usage.set(id, (usage.get(id) || 0) + 1)

const assetResults = []
let totalBytes = 0
for (const id of ids) {
  const asset = WORLD_MAP_V3_ASSETS[id]
  assert.equal(asset, WORLD_MAP_V3_ASSET_MANIFEST[id], `${id} registry identity`)
  assert.match(asset.src, /^\/assets\/world\/sound-archive-garden-v3\//)
  const filename = path.join(ROOT, 'public', asset.src)
  const file = await stat(filename)
  assert.ok(file.size > 0, `${id} is non-empty`)
  totalBytes += file.size
  const { width, height, hasAlpha } = await sharp(filename).metadata()
  assert.equal(width, asset.width, `${id} width metadata`)
  assert.equal(height, asset.height, `${id} height metadata`)
  if (!id.startsWith('terrain-')) assert.ok(hasAlpha, `${id} has real alpha`)
  if (hasAlpha && !id.startsWith('terrain-')) {
    const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1]
    assert.ok(corners.every(pixel => data[pixel * 4 + 3] <= 8), `${id} has transparent corners without a rectangular backdrop`)
  }
  assetResults.push({ id, src: asset.src, width, height, bytes: file.size, hasAlpha: Boolean(hasAlpha), uses: usage.get(id) || 0 })
}

const objectIds = [...WORLD_MAP_V3_OBJECTS, ...WORLD_MAP_V3_FOREGROUND].map(object => object.id)
assert.equal(new Set(objectIds).size, objectIds.length, 'instance IDs are unique')
for (const object of [...WORLD_MAP_V3_OBJECTS, ...WORLD_MAP_V3_FOREGROUND]) {
  const asset = WORLD_MAP_V3_ASSETS[object.assetId]
  assert.ok(asset, `${object.id} resolves ${object.assetId}`)
  assert.ok(object.width > 0 && object.height > 0, `${object.id} has valid size`)
  assert.ok(object.anchorX >= 0 && object.anchorX <= 1 && object.anchorY >= 0 && object.anchorY <= 1, `${object.id} has valid anchor`)
  const bounds = objectBounds(object)
  assert.ok(bounds.right >= 0 && bounds.bottom >= 0 && bounds.left <= WORLD_MAP_V3.width && bounds.top <= WORLD_MAP_V3.height, `${object.id} intersects the world`)
  const density = Math.min(asset.width / object.width, asset.height / object.height)
  assert.ok(density >= 4, `${object.id} source density ${density.toFixed(2)}x is at least 4x`)
  for (const collider of object.collision) assert.ok(collider.w > 0 && collider.h > 0, `${object.id} collider is valid`)
}

assert.deepEqual(Object.keys(WORLD_MAP_V3_DESTINATIONS).sort(), ['Animal', 'Home', 'Human', 'Lab', 'Library', 'Music', 'Nature', 'Urban'])
const [worldSource, sceneSource] = await Promise.all([
  readFile(path.join(ROOT, 'components/WorldMap.js'), 'utf8'),
  readFile(path.join(ROOT, 'components/world-map/WorldMapScene.js'), 'utf8'),
])
assert.doesNotMatch(worldSource, /world-base-hd|SOUND_ARCHIVE_GARDEN_V2/)
assert.match(sceneSource, /qa\.referenceOverlay/)
assert.match(sceneSource, /queryWorldMapObjects/)

const unusedAssets = assetResults.filter(asset => asset.uses === 0).map(asset => asset.id)
const report = {
  status: 'PASS',
  assetCount: ids.length,
  instanceCount: objectIds.length,
  totalBytes,
  unusedAssets,
  assets: assetResults,
}
await mkdir(REVIEW, { recursive: true })
await writeFile(path.join(REVIEW, 'asset-manifest-validation.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ status: report.status, assetCount: report.assetCount, instanceCount: report.instanceCount, totalBytes, unusedAssets }, null, 2))
