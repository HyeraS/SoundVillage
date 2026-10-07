import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const baseUrl = process.env.STAGE10B_BROWSER_BASE_URL
if (!baseUrl) throw new Error('STAGE10B_BROWSER_BASE_URL is required')
await requireLoopbackSupabaseUrl(baseUrl, 'STAGE10B_BROWSER_BASE_URL')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const placements = async page => page.locator('[data-sound-item-id]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [
  node.getAttribute('data-sound-item-id'),
  [Number(node.getAttribute('data-sound-tx')), Number(node.getAttribute('data-sound-ty'))],
])))
const character = async page => {
  const node = page.locator('[data-zone-character]')
  return {
    x: Number(await node.getAttribute('data-character-x')),
    y: Number(await node.getAttribute('data-character-y')),
    moving: await node.getAttribute('data-character-moving'),
  }
}
async function assertStable(page, expected, label) {
  assert.deepEqual(await placements(page), expected, `${label} changed sound placement`)
}

let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${baseUrl}/lab-test`)
  await page.locator('[data-zone-map="Lab"]').waitFor({ timeout: 20_000 })
  await page.locator('[data-zone-character]').waitFor()
  assert.equal(await page.locator('[data-zone-hud="Lab"]').count(), 1)
  assert.equal(await page.locator('[data-zone-dpad]').count(), 1)
  const initial = await placements(page)
  assert(Object.keys(initial).length > 0)

  await sleep(250)
  await assertStable(page, initial, 'animation tick')
  await page.getByTestId('zone-parent-rerender').click()
  await assertStable(page, initial, 'equivalent-array parent rerender')
  await page.getByTestId('zone-progress-change').click()
  await assertStable(page, initial, 'HUD/collected-set change')
  await page.getByTestId('zone-block-change').click()
  await assertStable(page, initial, 'block unlock change')
  await page.getByTestId('zone-block-change').click()

  const beforeKeyboard = await character(page)
  await page.keyboard.down('ArrowLeft')
  await sleep(180)
  assert.equal((await character(page)).moving, 'true')
  await page.keyboard.up('ArrowLeft')
  const afterKeyboard = await character(page)
  assert(afterKeyboard.x < beforeKeyboard.x, 'keyboard movement must move the character')

  const beforePointer = await character(page)
  const right = page.locator('[data-dpad-direction="right"]')
  await right.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse' })
  await sleep(180)
  await right.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse' })
  assert((await character(page)).x > beforePointer.x, 'pointer D-pad must move the character')

  await page.reload()
  await page.locator('[data-zone-map="Lab"]').waitFor({ timeout: 20_000 })
  // The element can arrive in prerendered HTML before useKeys attaches its
  // client key listeners; wait one paint so the held key is not lost.
  await sleep(150)
  await page.keyboard.down('ArrowLeft')
  await sleep(5_000)
  await page.keyboard.up('ArrowLeft')
  const atBoundary = await character(page)
  await page.keyboard.down('ArrowLeft')
  await sleep(350)
  await page.keyboard.up('ArrowLeft')
  const beyondBoundary = await character(page)
  assert.equal(Math.round(atBoundary.x), Math.round(beyondBoundary.x), 'map boundary collision must stop movement')

  await page.reload()
  await page.locator('[data-zone-map="Lab"]').waitFor({ timeout: 20_000 })
  const candidates = await page.locator('[data-sound-item-id][data-sound-state="active"]').evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('data-sound-item-id'),
    x: Number(node.getAttribute('data-sound-tx')) * 32 + 16,
    y: Number(node.getAttribute('data-sound-ty')) * 32 + 16,
  })))
  const start = await character(page)
  const target = candidates.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y))[0]
  assert(target)
  for (let step = 0; step < 240 && await page.locator('[data-collectible-prompt]').count() === 0; step++) {
    const pos = await character(page)
    const dx = target.x - (pos.x + 11)
    const dy = target.y - (pos.y + 14)
    const key = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft')
      : (dy > 0 ? 'ArrowDown' : 'ArrowUp')
    await page.keyboard.down(key)
    await sleep(45)
    await page.keyboard.up(key)
  }
  await page.locator('[data-collectible-prompt]').waitFor({ timeout: 5_000 })
  await page.keyboard.press('Enter')
  await page.getByPlaceholder(/먼저 소리를 들어보세요|예: 쨍그랑/).waitFor({ timeout: 10_000 })
  const overlayPosition = await character(page)
  await page.keyboard.down('ArrowRight')
  await sleep(250)
  await page.keyboard.up('ArrowRight')
  assert.deepEqual(await character(page).then(({ x, y }) => ({ x, y })), { x: overlayPosition.x, y: overlayPosition.y })
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true })))
  assert.equal(await page.getByPlaceholder(/먼저 소리를 들어보세요|예: 쨍그랑/).count(), 1)
  await page.keyboard.press('Escape')
  await page.getByPlaceholder(/먼저 소리를 들어보세요|예: 쨍그랑/).waitFor({ state: 'detached' })
  const beforeResume = await character(page)
  await page.keyboard.press('ArrowRight')
  await sleep(80)
  assert((await character(page)).x > beforeResume.x, 'movement must recover after overlay close')
  await assertStable(page, initial, 'annotation open/close')

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await sleep(150)
    assert.equal(await page.locator('[data-zone-character]').count(), 1)
    assert.equal(await page.locator('[data-zone-hud="Lab"]').count(), 1)
    await assertStable(page, initial, `viewport ${viewport.width}x${viewport.height}`)
  }

  await page.reload()
  await page.locator('[data-zone-map="Lab"]').waitFor({ timeout: 20_000 })
  await assertStable(page, initial, 'reload')
  await page.goto(`${baseUrl}/`)
  await page.goto(`${baseUrl}/lab-test`)
  await page.locator('[data-zone-map="Lab"]').waitFor({ timeout: 20_000 })
  await sleep(150)
  await assertStable(page, initial, 'route re-entry')

  await page.keyboard.down('ArrowDown')
  await sleep(900)
  await page.keyboard.up('ArrowDown')
  await page.getByText('월드맵으로 돌아갈까요?').waitFor({ timeout: 5_000 })
  const modalPosition = await character(page)
  await page.keyboard.press('ArrowLeft')
  await sleep(80)
  assert.deepEqual(await character(page).then(({ x, y }) => ({ x, y })), { x: modalPosition.x, y: modalPosition.y })
  await page.getByRole('button', { name: '더 둘러볼래요' }).click()
  const revision = Number(await page.locator('main').getAttribute('data-zone-regression-revision'))
  await page.keyboard.press('Escape')
  await page.waitForFunction(value => Number(document.querySelector('main')?.dataset.zoneRegressionRevision) > value, revision)

  assert.equal(errors.length, 0, `browser errors: ${JSON.stringify(errors)}`)
  console.log(JSON.stringify({
    ok: true,
    direct_usage: [{ route: '/lab-test', zone: 'Lab', production: false }],
    production_direct_usage: [],
    checks: [
      'hydration/console, character, HUD, keyboard and pointer movement',
      'map-boundary collision, collectible approach and annotation overlay lifecycle',
      'overlay input blocking, Enter repeat suppression, Escape and exit confirmation',
      '390x844, 1440x900 and 1920x1080 responsive camera render',
      'stable item identity/coordinates across tick, parent equivalent-array rerender, progress, block, overlay, resize, reload and route re-entry',
    ],
  }, null, 2))
} finally {
  await browser?.close().catch(() => {})
}
