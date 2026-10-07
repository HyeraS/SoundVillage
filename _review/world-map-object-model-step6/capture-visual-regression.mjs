import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUTPUT = resolve(ROOT, '_review/world-map-object-model-step6/visual/current-render-layers')
const BASELINE = process.env.WORLD_RENDER_LAYER_BASELINE_DIR
  ? resolve(process.env.WORLD_RENDER_LAYER_BASELINE_DIR)
  : resolve(ROOT, '_review/world-map-object-model-step5/visual/current-native-presentation')
const baseUrl = process.env.WORLD_RENDER_LAYER_BASE_URL
if (!baseUrl) throw new Error('WORLD_RENDER_LAYER_BASE_URL is required')
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(baseUrl).hostname)) throw new Error('WORLD_RENDER_LAYER_BASE_URL must be loopback')

const viewports = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]
const screens = [
  { id: 'spawn', query: 'natureQa=1&worldCapture=1' },
  { id: 'library', query: 'natureQa=1&worldCapture=1&worldStart=59.9375,44.9375' },
  { id: 'objects', query: 'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=objects', static: true },
  { id: 'foreground', query: 'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=foreground', static: true },
  { id: 'collision', query: 'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=collision', static: true },
  { id: 'minimap-library', query: 'natureQa=1&worldCapture=1&worldMinimapQa=1&worldStart=59.9375,44.9375' },
]

const baselineMetrics = JSON.parse(await readFile(resolve(BASELINE, 'metrics.json'), 'utf8'))
const baselineByKey = new Map(baselineMetrics.map(entry => [`${entry.screen}-${entry.viewport}`, entry.metrics]))
const contains = (rect, x, y, margin = 64) => x >= rect.left - margin && x < rect.right + margin && y >= rect.top - margin && y < rect.bottom + margin

async function comparePngs(baselinePath, currentPath, allowedRects) {
  const [baseline, current] = await Promise.all([
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(currentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ])
  assert.equal(current.info.width, baseline.info.width)
  assert.equal(current.info.height, baseline.info.height)
  let changedPixels = 0
  let unexpectedPixels = 0
  for (let y = 0; y < baseline.info.height; y += 1) {
    for (let x = 0; x < baseline.info.width; x += 1) {
      const offset = (y * baseline.info.width + x) * 4
      let changed = false
      for (let channel = 0; channel < 4; channel += 1) {
        if (baseline.data[offset + channel] !== current.data[offset + channel]) changed = true
      }
      if (!changed) continue
      changedPixels += 1
      if (!allowedRects.some(rect => contains(rect, x, y))) unexpectedPixels += 1
    }
  }
  return { changedPixels, unexpectedPixels }
}

await mkdir(OUTPUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const viewport of viewports) {
    for (const screen of screens) {
      const context = await browser.newContext({ viewport })
      await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
      const page = await context.newPage()
      const consoleErrors = []
      const consoleWarnings = []
      const missingAssets = []
      page.on('pageerror', error => consoleErrors.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text())
        if (message.type() === 'warning') consoleWarnings.push(message.text())
      })
      page.on('response', response => {
        if (response.status() >= 400 && response.url().includes('/assets/')) missingAssets.push(`${response.status()} ${response.url()}`)
      })
      await page.goto(`${baseUrl}/?${screen.query}`, { waitUntil: 'load' })
      const world = page.getByTestId('world-map')
      await world.waitFor({ timeout: 20_000 })
      await page.waitForFunction(() => document.fonts?.status === 'loaded')
      if (!screen.static) await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.mapReady === 'true')
      await page.waitForTimeout(450)

      const viewportId = `${viewport.width}x${viewport.height}`
      const key = `${screen.id}-${viewportId}`
      const file = resolve(OUTPUT, `${key}.png`)
      await page.screenshot({ path: file })
      const metrics = await page.evaluate(() => {
        const map = document.querySelector('[data-testid="world-map"]')
        const library = [...document.querySelectorAll('svg image[data-object-id="landmark-library"]')].map(node => ({
          objectId: node.getAttribute('data-object-id'),
          assetId: node.getAttribute('data-asset-id'),
          dataLayer: node.getAttribute('data-layer'),
          layerId: node.getAttribute('data-layer-id'),
          x: Number(node.getAttribute('x')),
          y: Number(node.getAttribute('y')),
          width: Number(node.getAttribute('width')),
          height: Number(node.getAttribute('height')),
        }))
        const southGate = [...document.querySelectorAll('svg image[data-object-id="foreground-south-gate"]')].map(node => ({
          x: Number(node.getAttribute('x')),
          y: Number(node.getAttribute('y')),
          width: Number(node.getAttribute('width')),
          height: Number(node.getAttribute('height')),
        }))
        return {
          imageNodes: document.querySelectorAll('svg image').length,
          visibleObjectIds: [...document.querySelectorAll('svg image[data-object-id]')].map(node => node.getAttribute('data-object-id')),
          library,
          southGate,
          objectGroundGroups: document.querySelectorAll('svg g[data-layer="object-ground"]').length,
          objectForegroundGroups: document.querySelectorAll('svg g[data-layer="object-foreground"]').length,
          objectOverlayGroups: document.querySelectorAll('svg g[data-layer="object-overlay"]').length,
          failedAssetCount: Number(map?.dataset.failedAssetCount ?? 0),
          decodedAssetBytes: Number(map?.dataset.assetDecodedBytes ?? 0),
          assetResourceCount: Number(map?.dataset.assetResourceCount ?? 0),
          assetRequests: [...new Set(performance.getEntriesByType('resource')
            .map(entry => new URL(entry.name).pathname)
            .filter(path => path.startsWith('/assets/')))].sort(),
        }
      })
      const baseline = baselineByKey.get(key)
      assert.ok(baseline, `missing Step 5 baseline metrics for ${key}`)
      const pixelDiff = await comparePngs(resolve(BASELINE, `${key}.png`), file, screen.static ? [] : baseline.animated)
      results.push({
        screen: screen.id,
        viewport: viewportId,
        file,
        metrics,
        consoleErrors,
        consoleWarnings,
        missingAssets,
        comparisons: {
          imageNodesEqual: metrics.imageNodes === baseline.imageNodes,
          visibleObjectIdsEqual: JSON.stringify(metrics.visibleObjectIds) === JSON.stringify(baseline.visibleObjectIds),
          assetRequestsEqual: JSON.stringify(metrics.assetRequests) === JSON.stringify(baseline.assetRequests),
          decodedAssetBytesEqual: metrics.decodedAssetBytes === baseline.decodedAssetBytes,
          assetResourceCountEqual: metrics.assetResourceCount === baseline.assetResourceCount,
          pixelDiff,
        },
      })
      await context.close()
    }
  }
} finally {
  await browser.close()
}

await writeFile(resolve(OUTPUT, 'metrics.json'), `${JSON.stringify(results, null, 2)}\n`)
const failures = results.filter(result => (
  Object.entries(result.comparisons).some(([key, value]) => key !== 'pixelDiff' && value !== true)
  || result.comparisons.pixelDiff.unexpectedPixels !== 0
  || result.metrics.library.length !== (['spawn', 'library', 'objects', 'minimap-library'].includes(result.screen) ? 1 : 0)
  || result.metrics.objectGroundGroups !== 0
  || result.metrics.objectForegroundGroups !== 0
  || result.metrics.objectOverlayGroups !== 0
  || result.consoleErrors.length > 0
  || result.consoleWarnings.length > 0
  || result.missingAssets.length > 0
  || result.metrics.failedAssetCount !== 0
))
const summary = {
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  comparisons: results.length,
  staticPixelExact: results.filter(result => ['objects', 'foreground', 'collision'].includes(result.screen) && result.comparisons.pixelDiff.changedPixels === 0).length,
  unexpectedPixels: results.reduce((sum, result) => sum + result.comparisons.pixelDiff.unexpectedPixels, 0),
  imageNodeMismatches: results.filter(result => !result.comparisons.imageNodesEqual).length,
  visibleObjectOrderMismatches: results.filter(result => !result.comparisons.visibleObjectIdsEqual).length,
  assetRequestMismatches: results.filter(result => !result.comparisons.assetRequestsEqual).length,
  decodedAssetByteMismatches: results.filter(result => !result.comparisons.decodedAssetBytesEqual).length,
  consoleErrors: results.reduce((sum, result) => sum + result.consoleErrors.length, 0),
  consoleWarnings: results.reduce((sum, result) => sum + result.consoleWarnings.length, 0),
  missingAssets: results.reduce((sum, result) => sum + result.missingAssets.length, 0),
  failures: failures.map(result => `${result.screen}-${result.viewport}`),
}
await writeFile(resolve(OUTPUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
if (failures.length > 0) process.exitCode = 1
