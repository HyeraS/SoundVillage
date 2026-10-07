import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUTPUT = resolve(ROOT, '_review/world-map-object-model-step6/visual/rollback-flat-reference')
const STEP5 = resolve(ROOT, '_review/world-map-object-model-step5/visual/current-native-presentation')
const baseUrl = process.env.WORLD_RENDER_LAYER_BASE_URL
if (!baseUrl) throw new Error('WORLD_RENDER_LAYER_BASE_URL is required')
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(baseUrl).hostname)) throw new Error('WORLD_RENDER_LAYER_BASE_URL must be loopback')

const viewports = [{ width:1280, height:720 }, { width:1440, height:900 }, { width:390, height:844 }, { width:844, height:390 }]
const screens = [
  { id:'spawn', query:'natureQa=1&worldCapture=1' },
  { id:'library', query:'natureQa=1&worldCapture=1&worldStart=59.9375,44.9375' },
  { id:'objects', query:'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=objects', static:true },
  { id:'foreground', query:'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=foreground', static:true },
  { id:'collision', query:'natureQa=1&worldCapture=1&worldOverview=1&worldLayer=collision', static:true },
  { id:'minimap-library', query:'natureQa=1&worldCapture=1&worldMinimapQa=1&worldStart=59.9375,44.9375' },
]
const step5Metrics = JSON.parse(await readFile(resolve(STEP5, 'metrics.json'), 'utf8'))
const step5ByKey = new Map(step5Metrics.map(entry => [`${entry.screen}-${entry.viewport}`, entry.metrics]))

await mkdir(OUTPUT, { recursive:true })
const browser = await chromium.launch({ headless:true })
const results = []
try {
  for (const viewport of viewports) {
    for (const screen of screens) {
      const context = await browser.newContext({ viewport })
      await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
      const page = await context.newPage()
      await page.goto(`${baseUrl}/?${screen.query}`, { waitUntil:'load' })
      await page.getByTestId('world-map').waitFor({ timeout:20_000 })
      await page.waitForFunction(() => document.fonts?.status === 'loaded')
      if (!screen.static) await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.mapReady === 'true')
      await page.waitForTimeout(450)
      const viewportId = `${viewport.width}x${viewport.height}`
      const key = `${screen.id}-${viewportId}`
      const file = resolve(OUTPUT, `${key}.png`)
      await page.screenshot({ path:file })
      const metrics = await page.evaluate(() => {
        const map = document.querySelector('[data-testid="world-map"]')
        return {
          imageNodes:document.querySelectorAll('svg image').length,
          visibleObjectIds:[...document.querySelectorAll('svg image[data-object-id]')].map(node => node.getAttribute('data-object-id')),
          failedAssetCount:Number(map?.dataset.failedAssetCount ?? 0),
          decodedAssetBytes:Number(map?.dataset.assetDecodedBytes ?? 0),
          assetResourceCount:Number(map?.dataset.assetResourceCount ?? 0),
          assetRequests:[...new Set(performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname).filter(path => path.startsWith('/assets/')))].sort(),
        }
      })
      metrics.animated = step5ByKey.get(key).animated
      results.push({ screen:screen.id, viewport:viewportId, file, metrics })
      await context.close()
    }
  }
} finally {
  await browser.close()
}
await writeFile(resolve(OUTPUT, 'metrics.json'), `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify({ status:'PASS', captures:results.length }, null, 2))
