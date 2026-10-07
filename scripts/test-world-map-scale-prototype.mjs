import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW_ROOT = path.join(ROOT, '_review/world-map-scale-prototype-2026-10-05')
const phases = [
  { directory:'00-baseline', scale:1 },
  { directory:'01-scale-80', scale:.8 },
  { directory:'02-scale-75', scale:.75 },
]
const records = await Promise.all(phases.map(async phase => ({
  ...phase,
  values:JSON.parse(await readFile(path.join(REVIEW_ROOT, phase.directory, 'metrics-dpr1.json'), 'utf8')),
})))

for (const phase of records) assert.equal(phase.values.length, 25, `${phase.directory} has every viewport/location capture`)
const audit = []
for (let index = 0; index < records[0].values.length; index += 1) {
  const baseline = records[0].values[index]
  const scaled = records.slice(1).map(phase => phase.values[index])
  for (const [scaledIndex, actual] of scaled.entries()) {
    const expectedScale = records[scaledIndex + 1].scale
    assert.deepEqual(actual.viewport, baseline.viewport, 'viewport order matches baseline')
    assert.equal(actual.location.id, baseline.location.id, 'location order matches baseline')
    assert.equal(actual.worldVisualScale, expectedScale, 'requested visual scale is active')
    assert.ok(Math.abs(actual.camera.viewW / baseline.camera.viewW - 1 / expectedScale) < .001, 'horizontal FOV follows base/scale')
    assert.ok(Math.abs(actual.camera.viewH / baseline.camera.viewH - 1 / expectedScale) < .001, 'vertical FOV follows base/scale')
    assert.ok(Math.abs(actual.player.width / baseline.player.width - 1) <= .05, 'player width remains within 5%')
    assert.ok(Math.abs(actual.player.height / baseline.player.height - 1) <= .05, 'player height remains within 5%')
    // Library and Home are not camera-clamped in any target viewport, so they
    // are the stable anchoring authority. At edge destinations the deliberate
    // clamp moves the player on screen as the wider FOV exposes more world.
    if (['library', 'home'].includes(baseline.location.id)) {
      assert.ok(Math.abs(actual.playerFootScreen.x - baseline.playerFootScreen.x) <= 2, 'unclamped player foot X remains within 2 CSS px')
      assert.ok(Math.abs(actual.playerFootScreen.y - baseline.playerFootScreen.y) <= 2, 'unclamped player foot Y remains within 2 CSS px')
    }
    assert.ok(actual.labelCssHeight >= 12, 'core destination label remains at least 12 CSS px')
    if (actual.touchTarget.width > 0 || actual.touchTarget.height > 0) {
      assert.ok(actual.touchTarget.width >= 44 && actual.touchTarget.height >= 44, 'visible touch confirmation remains at least 44x44 CSS px')
    }
    assert.ok(actual.player.left >= 0 && actual.player.right <= actual.viewport.width, 'player remains horizontally visible')
    assert.ok(actual.player.top >= 56 && actual.player.bottom <= actual.viewport.height, 'player remains vertically visible')
    assert.equal(actual.performance.failedAssetCount, 0, 'world assets load without failures')
    assert.deepEqual(actual.errors, [], 'console, page and HTTP errors remain empty')
  }
  const scale80 = records[1].values[index]
  const scale75 = records[2].values[index]
  if (baseline.landmark && scale80.landmark && scale75.landmark) {
    assert.ok(Math.abs(scale80.landmark.width / baseline.landmark.width - .8) < .015, '80% landmark width is visually 80%')
    assert.ok(Math.abs(scale75.landmark.width / baseline.landmark.width - .75) < .015, '75% landmark width is visually 75%')
  }
  assert.ok(scale80.pixelDensity.meanX > baseline.pixelDensity.meanX, '80% mode improves sampled horizontal source density')
  assert.ok(scale75.pixelDensity.meanX > scale80.pixelDensity.meanX, '75% mode improves sampled horizontal source density again')
  audit.push({
    viewport:`${baseline.viewport.width}x${baseline.viewport.height}`,
    location:baseline.location.id,
    playerSize:[baseline, scale80, scale75].map(value => [value.player.width, value.player.height]),
    footY:[baseline, scale80, scale75].map(value => value.playerFootScreen.y),
    labelHeight:[baseline, scale80, scale75].map(value => value.labelCssHeight),
    densityX:[baseline, scale80, scale75].map(value => value.pixelDensity.meanX),
  })
}

console.log(JSON.stringify({ status:'PASS', checks:audit.length, audit }, null, 2))
