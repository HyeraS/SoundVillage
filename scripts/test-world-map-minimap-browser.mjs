import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { WORLD_MINIMAP_DESTINATIONS } from '../lib/worldMapMinimap.mjs'

const baseUrl = process.env.WORLD_MINIMAP_BROWSER_BASE_URL
if (!baseUrl) throw new Error('WORLD_MINIMAP_BROWSER_BASE_URL is required')
const parsedBaseUrl = new URL(baseUrl)
if (!['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname)) throw new Error('WORLD_MINIMAP_BROWSER_BASE_URL must be loopback')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const playerPosition = async page => {
  const player = page.getByTestId('world-player')
  return {
    x:Number(await player.getAttribute('data-player-x')),
    y:Number(await player.getAttribute('data-player-y')),
  }
}

let browser
try {
  browser = await chromium.launch({ headless:true })
  const context = await browser.newContext({ viewport:{ width:1440, height:900 } })
  await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) errors.push(`${response.status()} ${response.url()}`) })

  await page.goto(`${baseUrl}/?natureQa=1&worldLockQa=1&worldMinimapQa=1`)
  await page.getByTestId('world-map').waitFor({ timeout:20_000 })
  await page.getByTestId('world-minimap').waitFor()
  await page.getByTestId('world-minimap-qa').waitFor()

  const compactMarkers = page.getByTestId('world-minimap').locator('[data-destination-id]')
  assert.equal(await compactMarkers.count(), 8, 'compact minimap renders all destinations')
  for (const destination of WORLD_MINIMAP_DESTINATIONS) {
    const marker = page.getByTestId('world-minimap').locator(`[data-destination-id="${destination.id}"]`)
    assert.equal(Number(await marker.getAttribute('data-world-x')), destination.worldPoint.x)
    assert.equal(Number(await marker.getAttribute('data-world-y')), destination.worldPoint.y)
  }
  assert.equal(await page.getByTestId('world-minimap').locator('[data-destination-id="Music"]').getAttribute('data-current'), 'true')
  assert.equal(await page.getByTestId('world-minimap').locator('[data-destination-id="Music"]').getAttribute('data-locked'), 'false')
  assert.equal(await page.getByTestId('world-minimap').locator('[data-destination-id="Animal"]').getAttribute('data-locked'), 'true')
  assert.equal(await page.getByTestId('world-minimap').locator('[data-destination-id="Sound Library"]').getAttribute('data-locked'), 'false')

  const openButton = page.getByTestId('world-minimap-open')
  const beforeMove = await playerPosition(page)
  await openButton.click()
  await page.getByRole('dialog', { name:'전체 지도' }).waitFor()
  assert.equal(await page.getByRole('dialog').locator('[data-destination-id]').count(), 8)
  await page.keyboard.down('ArrowRight')
  await sleep(250)
  await page.keyboard.up('ArrowRight')
  assert.deepEqual(await playerPosition(page), beforeMove, 'world movement pauses behind full map')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state:'detached' })
  await sleep(50)
  assert.equal(await openButton.evaluate(node => document.activeElement === node), true, 'focus returns to minimap opener')

  await openButton.click()
  await page.getByTestId('world-map-overlay-backdrop').click({ position:{ x:5, y:5 } })
  await page.getByRole('dialog').waitFor({ state:'detached' })
  await openButton.click()
  await page.getByRole('button', { name:'전체 지도 닫기' }).click()
  await page.getByRole('dialog').waitFor({ state:'detached' })

  const compactPlayer = page.getByTestId('world-minimap').getByTestId('world-minimap-player')
  const beforeLeft = await compactPlayer.evaluate(node => node.style.left)
  const beforeDirection = await page.locator('.world-map-direction__arrow').evaluate(node => node.style.transform)
  await page.keyboard.down('ArrowRight')
  await sleep(300)
  await page.keyboard.up('ArrowRight')
  const afterLeft = await compactPlayer.evaluate(node => node.style.left)
  const afterDirection = await page.locator('.world-map-direction__arrow').evaluate(node => node.style.transform)
  assert.notEqual(afterLeft, beforeLeft, 'minimap player follows world movement')
  assert.notEqual(afterDirection, beforeDirection, 'objective direction updates as the player moves')

  for (const viewport of [{ width:390, height:844 }, { width:1440, height:900 }]) {
    await page.setViewportSize(viewport)
    await sleep(120)
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const node = document.querySelector(selector)
        if (!node) return null
        const value = node.getBoundingClientRect()
        return { left:value.left, right:value.right, top:value.top, bottom:value.bottom }
      }
      const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
      const minimap = rect('[data-testid="world-minimap"]')
      const hud = rect('.world-map-hud')
      const objective = rect('.world-map-objective')
      const dpad = rect('.world-map-dpad')
      const direction = rect('.world-map-direction')
      return {
        scrollWidth:document.documentElement.scrollWidth,
        width:window.innerWidth,
        minimap,
        clipped:!minimap || minimap.left < 0 || minimap.top < 0 || minimap.right > window.innerWidth || minimap.bottom > window.innerHeight,
        overlaps:[overlaps(minimap, hud), overlaps(minimap, objective), overlaps(minimap, dpad), overlaps(minimap, direction)],
      }
    })
    assert.equal(layout.scrollWidth, layout.width, `${viewport.width} viewport has no horizontal scroll`)
    assert.equal(layout.clipped, false, `${viewport.width} minimap stays in viewport`)
    assert.deepEqual(layout.overlaps, [false, false, false, false], `${viewport.width} minimap does not overlap persistent UI`)
  }

  await page.goto(`${baseUrl}/?natureQa=1&worldLockQa=1&worldMinimapQa=1&worldStart=98.9375,77.1875`)
  await page.getByTestId('world-map').waitFor({ timeout:20_000 })
  await page.getByText('음악 마을 · 도착').waitFor()
  assert.match(await page.getByTestId('world-minimap-qa').textContent(), /target: Music \(arrived\)/)

  assert.equal(errors.length, 0, `browser errors: ${JSON.stringify(errors)}`)
  console.log(JSON.stringify({
    ok:true,
    checks:[
      '8 canonical destination markers, lock state and current target',
      'full-map open/close, backdrop, Escape and focus restoration',
      'movement blocked behind dialog, minimap player synchronization and live target direction',
      'arrival state plus 390x844 and 1440x900 clipping/overlap',
      'console and asset loading errors',
    ],
  }, null, 2))
} finally {
  await browser?.close().catch(() => {})
}
