import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { WORLD_MINIMAP_DESTINATIONS } from '../lib/worldMapMinimap.mjs'

const baseUrl = process.env.WORLD_MINIMAP_BROWSER_BASE_URL
if (!baseUrl) throw new Error('WORLD_MINIMAP_BROWSER_BASE_URL is required')
const parsedBaseUrl = new URL(baseUrl)
assert.ok(['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname), 'WORLD_MINIMAP_BROWSER_BASE_URL must be loopback')

const browser = await chromium.launch({ headless:true })
try {
  for (const viewport of [{ width:1440, height:900 }, { width:390, height:844 }, { width:844, height:390 }]) {
    const context = await browser.newContext({ viewport })
    await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
    const page = await context.newPage()
    await page.goto(`${baseUrl}/?natureQa=1&worldMinimapQa=1`, { waitUntil:'domcontentloaded' })
    await page.getByTestId('world-map').waitFor({ timeout:30_000 })
    assert.equal(await page.getByTestId('world-minimap').count(), 0, 'the redundant minimap stays hidden')
    assert.equal(await page.getByRole('dialog', { name:'전체 지도' }).count(), 0, 'the redundant full-map dialog stays hidden')
    assert.equal(await page.getByRole('button', { name:/전체 지도/ }).count(), 0, 'the redundant full-map button stays hidden')
    assert.equal(await page.getByTestId('world-minimap-qa').count(), 1, 'internal destination QA data remains available')
    assert.match(await page.getByTestId('world-minimap-qa').textContent(), new RegExp(`markers: ${WORLD_MINIMAP_DESTINATIONS.length}`))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
    await context.close()
  }
  console.log(JSON.stringify({ status:'PASS', checks:['minimap hidden', 'full-map button/dialog hidden', '8 destination records retained', 'no horizontal overflow'] }, null, 2))
} finally {
  await browser.close()
}
