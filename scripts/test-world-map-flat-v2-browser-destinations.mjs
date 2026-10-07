import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.WORLD_FLAT_V2_BROWSER_BASE_URL || 'http://localhost:3000'
const parsedBaseUrl = new URL(baseUrl)
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedBaseUrl.hostname), 'browser QA must use a loopback URL')

const DESTINATIONS = Object.freeze(['Lab', 'Animal', 'Urban', 'Music', 'Human', 'Nature', 'Home', 'Sound Library'])
const browser = await chromium.launch({ headless:true })
const results = []

try {
  for (const destination of DESTINATIONS) {
    const context = await browser.newContext({ viewport:{ width:1440, height:900 } })
    await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
    page.on('response', response => { if (response.status() >= 500) errors.push(`http ${response.status()}: ${response.url()}`) })

    const url = new URL('/', parsedBaseUrl)
    url.searchParams.set('natureQa', '1')
    url.searchParams.set('worldAutoWalk', destination)
    await page.goto(url.href, { waitUntil:'domcontentloaded', timeout:45_000 })
    const world = page.getByTestId('world-map')
    await world.waitFor({ timeout:45_000 })
    await page.waitForFunction(expected => {
      const map = document.querySelector('[data-testid="world-map"]')
      return map?.dataset.autoWalkArrived === 'true' && map.dataset.nearDestination === expected
    }, destination, { timeout:45_000 })
    const arrival = await page.getByTestId('world-player').evaluate(node => ({ x:Number(node.dataset.playerX), y:Number(node.dataset.playerY) }))

    await page.keyboard.press('Enter')
    await world.waitFor({ state:'detached', timeout:30_000 })
    let entered
    if (destination === 'Home') {
      await page.locator('[data-interior-room]').waitFor({ timeout:30_000 })
      entered = 'house'
    } else if (destination === 'Sound Library') {
      await page.getByTestId('museum-player').waitFor({ timeout:30_000 })
      entered = 'museum'
    } else {
      await page.locator('[data-zone-hud-back]').waitFor({ timeout:30_000 })
      entered = 'zone'
    }

    await page.evaluate(() => {
      const next = new URL(location.href)
      next.searchParams.delete('worldAutoWalk')
      history.replaceState(null, '', `${next.pathname}${next.search}${next.hash}`)
    })
    if (destination === 'Home') {
      await page.getByRole('button', { name:/나가기/ }).first().click()
    } else if (destination === 'Sound Library') {
      await page.keyboard.press('Escape')
    } else {
      await page.locator('[data-zone-hud-back]').click()
      const confirmExit = page.getByRole('button', { name:'네, 나갈게요' })
      await Promise.race([
        page.getByTestId('world-map').waitFor({ timeout:3_000 }).catch(() => null),
        confirmExit.waitFor({ timeout:3_000 }).catch(() => null),
      ])
      if (await confirmExit.isVisible().catch(() => false)) await confirmExit.click()
    }
    await page.getByTestId('world-map').waitFor({ timeout:30_000 })
    const returned = await page.getByTestId('world-player').evaluate(node => ({ x:Number(node.dataset.playerX), y:Number(node.dataset.playerY) }))
    const returnNear = await page.getByTestId('world-map').getAttribute('data-near-destination')
    if (!['Home', 'Sound Library'].includes(destination)) assert.equal(returnNear, destination, `${destination} return must restore its portal position`)
    assert.deepEqual(errors, [], `${destination}: ${errors.join('\n')}`)
    results.push({ destination, entered, arrival, returned, returnNear })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ status:'PASS', destinations:results }, null, 2))
