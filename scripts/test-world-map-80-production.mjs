import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveWorldVisualScale, WORLD_DEFAULT_VISUAL_SCALE } from '../lib/worldMapCamera.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-80-production-2026-10-05')
const baseline = JSON.parse(await readFile(path.join(REVIEW, '00-baseline/metrics-dpr1.json'), 'utf8'))
const production = JSON.parse(await readFile(path.join(REVIEW, '01-scale-80/metrics-dpr1.json'), 'utf8'))
const baselineDpr2 = JSON.parse(await readFile(path.join(REVIEW, '00-baseline/metrics-dpr2.json'), 'utf8'))
const productionDpr2 = JSON.parse(await readFile(path.join(REVIEW, '01-scale-80/metrics-dpr2.json'), 'utf8'))
const expectedLocations = ['library', 'home', 'lab', 'nature', 'music', 'animal', 'urban', 'human']
const expectedViewports = ['1280x720', '1440x900', '1920x1080', '390x844', '844x390']
const viewportKey = record => `${record.viewport.width}x${record.viewport.height}`
const round = (value, places = 3) => Number(Number(value || 0).toFixed(places))

assert.equal(WORLD_DEFAULT_VISUAL_SCALE, .8)
assert.equal(resolveWorldVisualScale(undefined, { nodeEnv:'production' }), .8)
assert.equal(resolveWorldVisualScale('1', { nodeEnv:'production' }), .8)
assert.equal(resolveWorldVisualScale('.75', { nodeEnv:'production' }), .8)
assert.equal(resolveWorldVisualScale(undefined, { nodeEnv:'development' }), .8)
assert.equal(resolveWorldVisualScale('1', { nodeEnv:'development' }), 1)
assert.equal(baseline.length, 40, '100% comparison has five viewports by eight destinations')
assert.equal(production.length, 40, '80% release has five viewports by eight destinations')
assert.equal(baselineDpr2.length, 8, 'DPR2 comparison has all eight destinations')
assert.equal(productionDpr2.length, 8, 'DPR2 release has all eight destinations')
assert.deepEqual([...new Set(production.map(record => record.location.id))], expectedLocations)
assert.deepEqual([...new Set(production.map(viewportKey))], expectedViewports)

const checks = []
for (let index = 0; index < baseline.length; index += 1) {
  const before = baseline[index]
  const after = production[index]
  assert.deepEqual(after.viewport, before.viewport, 'viewport ordering matches')
  assert.equal(after.location.id, before.location.id, 'destination ordering matches')
  assert.equal(before.worldVisualScale, 1, 'comparison capture is 100%')
  assert.equal(after.worldVisualScale, .8, 'release capture is 80%')
  assert.ok(Math.abs(after.camera.viewW / before.camera.viewW - 1.25) < .001, 'horizontal FOV is base/0.8')
  assert.ok(Math.abs(after.camera.viewH / before.camera.viewH - 1.25) < .001, 'vertical FOV is base/0.8')
  const widthDelta = after.player.width / before.player.width - 1
  const heightDelta = after.player.height / before.player.height - 1
  assert.ok(Math.abs(widthDelta) <= .05, 'player width remains within ±5%')
  assert.ok(Math.abs(heightDelta) <= .05, 'player height remains within ±5%')
  const footError = Math.hypot(after.playerFootScreen.x - before.playerFootScreen.x, after.playerFootScreen.y - before.playerFootScreen.y)
  if (['library', 'home'].includes(after.location.id)) assert.ok(footError <= 2, 'central foot anchor remains within 2 CSS px')
  assert.ok(after.labelCssHeight >= 12, 'core label is at least 12 CSS px')
  if (after.touchTarget.width > 0 || after.touchTarget.height > 0) {
    assert.ok(after.touchTarget.width >= 44 && after.touchTarget.height >= 44, 'visible mobile confirm target is at least 44x44 CSS px')
  }
  assert.ok(after.player.left >= 0 && after.player.right <= after.viewport.width, 'player stays horizontally visible')
  assert.ok(after.player.top >= 56 && after.player.bottom <= after.viewport.height, 'player stays vertically visible')
  assert.equal(after.performance.failedAssetCount, 0, 'assets have no failures')
  assert.deepEqual(after.errors, [], 'console, page and HTTP errors stay empty')
  if (before.landmark && after.landmark) assert.ok(Math.abs(after.landmark.width / before.landmark.width - .8) < .015, 'landmark width is approximately 80%')
  checks.push({ viewport:viewportKey(after), location:after.location.id, widthDeltaPercent:round(widthDelta * 100, 4), heightDeltaPercent:round(heightDelta * 100, 4), footErrorCssPx:round(footError, 4), labelCssHeight:round(after.labelCssHeight) })
}

for (let index = 0; index < baselineDpr2.length; index += 1) {
  const before = baselineDpr2[index]
  const after = productionDpr2[index]
  assert.equal(after.worldVisualScale, .8)
  assert.ok(Math.abs(after.player.width / before.player.width - 1) <= .05, 'DPR2 player width remains within ±5%')
  assert.ok(Math.abs(after.player.height / before.player.height - 1) <= .05, 'DPR2 player height remains within ±5%')
  assert.equal(after.performance.failedAssetCount, 0)
  assert.deepEqual(after.errors, [])
}

const cameraMetrics = {
  generatedAt:'2026-10-05',
  productionDefaultScale:.8,
  logicalWorld:{ width:3840, height:2880, tiles:{ width:120, height:90 }, tileSize:32, changed:false },
  queryContract:{ development:{ default:.8, allowed:[1, .8, .75], invalidFallback:.8 }, production:{ default:.8, attempted1:.8, attempted75:.8 } },
  overview:{ width:3840, height:2880, ignoresVisualScale:true },
  coverage:{ dpr1:{ captures:production.length, viewports:expectedViewports, locations:expectedLocations }, dpr2:{ captures:productionDpr2.length, viewports:['1440x900'], locations:expectedLocations } },
  viewports:Object.fromEntries(expectedViewports.map(viewport => {
    const records = production.filter(record => viewportKey(record) === viewport)
    const comparisons = checks.filter(record => record.viewport === viewport)
    const authority = records.find(record => record.location.id === 'library')
    return [viewport, {
      viewW:round(authority.camera.viewW),
      viewH:round(authority.camera.viewH),
      playerCss:{ width:round(authority.player.width), height:round(authority.player.height) },
      maxPlayerWidthDeltaPercent:round(Math.max(...comparisons.map(record => Math.abs(record.widthDeltaPercent))), 4),
      maxPlayerHeightDeltaPercent:round(Math.max(...comparisons.map(record => Math.abs(record.heightDeltaPercent))), 4),
      centralFootErrorCssPx:round(Math.max(...comparisons.filter(record => ['library', 'home'].includes(record.location)).map(record => record.footErrorCssPx)), 4),
      minimumLabelCssPx:round(Math.min(...records.map(record => record.labelCssHeight))),
      consoleHttpImageErrors:records.reduce((sum, record) => sum + record.errors.length + record.performance.failedAssetCount, 0),
    }]
  })),
  checks,
}
await writeFile(path.join(REVIEW, 'camera-metrics.json'), `${JSON.stringify(cameraMetrics, null, 2)}\n`)
console.log(JSON.stringify({ status:'PASS', checks:checks.length, dpr2Checks:productionDpr2.length, output:path.join(REVIEW, 'camera-metrics.json') }, null, 2))
