import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-80-production-2026-10-05')
const baseUrl = process.argv.find(argument => argument.startsWith('--base-url='))?.slice('--base-url='.length)
  || process.env.WORLD_SCALE_BROWSER_BASE_URL
  || 'http://localhost:3000'
const RUNS = 3
const VIEWPORT = Object.freeze({ width:1440, height:900 })
const CONDITIONS = Object.freeze([
  { id:'100', scale:1 },
  { id:'80', scale:.8 },
])

const round = value => Number(Number(value || 0).toFixed(2))
const average = (values, field) => round(values.reduce((sum, value) => sum + value[field], 0) / values.length)
const range = (values, field) => [Math.min(...values.map(value => value[field])), Math.max(...values.map(value => value[field]))].map(round)

await mkdir(REVIEW, { recursive:true })
const browser = await chromium.launch({ headless:true })
const records = []

try {
  for (const condition of CONDITIONS) {
    for (let run = 1; run <= RUNS; run += 1) {
      // A new non-persistent context makes every run a cold browser-cache sample.
      const context = await browser.newContext({ viewport:VIEWPORT, deviceScaleFactor:1 })
      await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
      page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`) })
      const query = new URLSearchParams({ natureQa:'1', worldStart:'60,47', worldVisualScale:String(condition.scale) })
      await page.goto(`${baseUrl}/?${query}`, { waitUntil:'domcontentloaded', timeout:30_000 })
      await page.getByTestId('world-map').waitFor({ timeout:30_000 })
      await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.mapReady === 'true', null, { timeout:30_000 })
      await page.waitForTimeout(2_300)
      const beforeMove = await page.evaluate(() => {
        const map = document.querySelector('[data-testid="world-map"]')
        const resources = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/sound-archive-garden-v4/'))
        const visibleAssets = [...document.querySelectorAll('svg image[data-object-id], svg image[data-terrain-id]')]
          .filter(node => { const rect = node.getBoundingClientRect(); return rect.right > 0 && rect.bottom > 56 && rect.left < innerWidth && rect.top < innerHeight }).length
        return {
          scale:Number(map.dataset.worldVisualScale),
          mapReadyMs:Number(map.dataset.mapReadyMs),
          transferBytes:Number(map.dataset.assetTransferBytes),
          decodedBytes:Number(map.dataset.assetDecodedBytes),
          resourceCount:Number(map.dataset.assetResourceCount),
          visibleAssets,
          averageFps:Number(map.dataset.averageFps),
          slowFrames:Number(map.dataset.slowFrames),
          maxFrameMs:Number(map.dataset.maxFrameMs),
          heapDelta:Number(map.dataset.heapDelta),
          worldResourceNames:resources.map(entry => entry.name),
        }
      })
      await page.keyboard.down('ArrowRight')
      await page.waitForTimeout(1_500)
      await page.keyboard.up('ArrowRight')
      await page.waitForTimeout(700)
      const afterMove = await page.evaluate(() => ({
        worldResourceNames:performance.getEntriesByType('resource').filter(entry => entry.name.includes('/sound-archive-garden-v4/')).map(entry => entry.name),
        heap:performance.memory?.usedJSHeapSize || 0,
        failedAssets:Number(document.querySelector('[data-testid="world-map"]')?.dataset.failedAssetCount || 0),
      }))
      const initialResources = new Set(beforeMove.worldResourceNames)
      const additionalRequests = afterMove.worldResourceNames.filter(name => !initialResources.has(name)).length
      assert.equal(beforeMove.scale, condition.scale, `${condition.id}% comparison scale is active`)
      assert.equal(afterMove.failedAssets, 0, 'asset failures stay at zero')
      assert.deepEqual(errors, [], 'console, page and HTTP errors stay empty')
      records.push({ condition:condition.id, run, viewport:VIEWPORT, ...beforeMove, additionalRequests, heapAfterMove:afterMove.heap, errors })
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const byCondition = Object.fromEntries(CONDITIONS.map(condition => {
  const values = records.filter(record => record.condition === condition.id)
  return [condition.id, {
    scale:condition.scale,
    coldRuns:values.length,
    visibleAssets:{ average:average(values, 'visibleAssets'), range:range(values, 'visibleAssets') },
    transferBytes:{ average:average(values, 'transferBytes'), range:range(values, 'transferBytes') },
    decodedRGBABytes:{ average:average(values, 'decodedBytes'), range:range(values, 'decodedBytes') },
    mapReadyMs:{ average:average(values, 'mapReadyMs'), range:range(values, 'mapReadyMs') },
    averageFps:{ average:average(values, 'averageFps'), range:range(values, 'averageFps') },
    slowFramesOver50Ms:{ average:average(values, 'slowFrames'), range:range(values, 'slowFrames') },
    maxFrameMs:{ average:average(values, 'maxFrameMs'), range:range(values, 'maxFrameMs') },
    cameraMoveAdditionalRequests:{ average:average(values, 'additionalRequests'), range:range(values, 'additionalRequests') },
    heapDeltaBytes:{ average:average(values, 'heapDelta'), range:range(values, 'heapDelta') },
    errors:values.reduce((sum, value) => sum + value.errors.length, 0),
  }]
}))

const report = {
  generatedAt:'2026-10-05',
  methodology:'Chromium, new non-persistent context per sample, 1440x900 DPR1, default spawn/library, 2.3s frame sample followed by 1.5s camera movement.',
  runsPerCondition:RUNS,
  byCondition,
  records,
}
await writeFile(path.join(REVIEW, 'performance-comparison.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ status:'PASS', output:path.join(REVIEW, 'performance-comparison.json'), byCondition }, null, 2))
