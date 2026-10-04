import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { WORLD_MAP_V4_ASSET_IDS, WORLD_MAP_V4_ASSETS } from '../lib/worldMapV4Assets.mjs'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_ASSET_MANIFEST,
  WORLD_MAP_V4_FOREGROUND,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_TERRAIN_PANELS,
  objectBounds,
} from '../lib/worldMapV4Manifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
assert.deepEqual(
  { world: [WORLD_MAP_V4.width, WORLD_MAP_V4.height], reference: [WORLD_MAP_V4.referenceWidth, WORLD_MAP_V4.referenceHeight] },
  { world: [3840, 2880], reference: [2896, 2172] },
)
assert.equal(WORLD_MAP_V4.scaleX, 3840 / 2896)
assert.equal(WORLD_MAP_V4.scaleY, 2880 / 2172)
assert.equal(WORLD_MAP_V4_TERRAIN_PANELS.length, 12)
const homeObject = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-home')
const guesthouseObject = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-guesthouse')
assert.equal(homeObject.assetId, 'landmark-home-player-building')
assert.equal(homeObject.layer, 'gameplay')
assert.equal(homeObject.interaction.type, 'home')
assert.deepEqual(
  WORLD_MAP_V4_LAYER_OVERRIDES[homeObject.id].map(layer => layer.assetId),
  ['landmark-home-player-site-ground', 'landmark-home-player-building'],
)
assert.equal(guesthouseObject.layer, 'inspection')
assert.equal(guesthouseObject.interaction, null)

const ids = [...WORLD_MAP_V4_ASSET_IDS]
assert.equal(new Set(ids).size, ids.length)
const usage = new Map(ids.map(id => [id, 0]))
for (const panel of WORLD_MAP_V4_TERRAIN_PANELS) usage.set(panel.assetId, usage.get(panel.assetId) + 1)
for (const object of [...WORLD_MAP_V4_OBJECTS, ...WORLD_MAP_V4_FOREGROUND]) {
  const layers = WORLD_MAP_V4_LAYER_OVERRIDES[object.id]
  if (layers) {
    for (const layer of layers) usage.set(layer.assetId, usage.get(layer.assetId) + 1)
  } else {
    usage.set(object.assetId, usage.get(object.assetId) + 1)
  }
}

let totalBytes = 0
let totalDecodedRGBA = 0
const assets = []
for (const id of ids) {
  const asset = WORLD_MAP_V4_ASSETS[id]
  assert.equal(asset, WORLD_MAP_V4_ASSET_MANIFEST[id])
  assert.match(asset.src, /^\/assets\/world\/sound-archive-garden-v4\/runtime\/.+\.webp$/)
  const filename = path.join(ROOT, 'public', asset.src)
  const info = await stat(filename)
  const metadata = await sharp(filename).metadata()
  assert.equal(metadata.width, asset.width)
  assert.equal(metadata.height, asset.height)
  assert.ok(info.size > 0)
  totalBytes += info.size
  totalDecodedRGBA += asset.width * asset.height * 4
  assets.push({ id, category: asset.category, width: asset.width, height: asset.height, bytes: info.size, uses: usage.get(id) })
}

for (const panel of WORLD_MAP_V4_TERRAIN_PANELS) {
  assert.equal(panel.width, 960)
  assert.equal(panel.height, 960)
  assert.equal(WORLD_MAP_V4_ASSETS[panel.assetId].width, 960)
  assert.equal(WORLD_MAP_V4_ASSETS[panel.assetId].height, 960)
  assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= 3840 && panel.y + panel.height <= 2880)
}
for (const object of [...WORLD_MAP_V4_OBJECTS, ...WORLD_MAP_V4_FOREGROUND]) {
  const bounds = objectBounds(object)
  assert.ok(bounds.right > 0 && bounds.bottom > 0 && bounds.left < 3840 && bounds.top < 2880)
}

const [worldSource, sceneSource, geometrySource] = await Promise.all([
  readFile(path.join(ROOT, 'components/WorldMap.js'), 'utf8'),
  readFile(path.join(ROOT, 'components/world-map/WorldMapScene.js'), 'utf8'),
  readFile(path.join(ROOT, 'lib/worldMapGeometry.mjs'), 'utf8'),
])
assert.doesNotMatch(worldSource, /worldMapV3Manifest|WORLD_MAP_V3/)
assert.doesNotMatch(sceneSource, /worldMapV3Manifest|WORLD_MAP_V3|sound-archive-garden-v3/)
assert.doesNotMatch(geometrySource, /worldMapV3Manifest|worldMapV3BlockingReasonAt/)
assert.match(sceneSource, /WORLD_MAP_V4_TERRAIN_PANELS/)
assert.match(sceneSource, /data-source="reference-registered-panels"/)
const report = {
  status: 'PASS',
  assetCount: ids.length,
  terrainPanelCount: WORLD_MAP_V4_TERRAIN_PANELS.length,
  semanticObjectCount: WORLD_MAP_V4_OBJECTS.length + WORLD_MAP_V4_FOREGROUND.length,
  totalBytes,
  totalDecodedRGBA,
  coordinateScale: { x: WORLD_MAP_V4.scaleX, y: WORLD_MAP_V4.scaleY },
  assets,
}
assert.ok(totalBytes < 15 * 1024 * 1024, 'complete optimized runtime manifest stays below 15 MiB')
assert.ok(totalDecodedRGBA < 150 * 1024 * 1024, 'complete optimized runtime decoded estimate stays below 150 MiB')
console.log(JSON.stringify({
  status: report.status,
  assetCount: report.assetCount,
  terrainPanelCount: report.terrainPanelCount,
  semanticObjectCount: report.semanticObjectCount,
  totalBytes: report.totalBytes,
  totalDecodedRGBA: report.totalDecodedRGBA,
}, null, 2))
