import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { requireLoopbackSupabaseUrl } from './security/local-supabase-guard.mjs'

const baseUrl = process.env.WALK_ANIMATION_BASE_URL || 'http://127.0.0.1:3107'
await requireLoopbackSupabaseUrl(baseUrl, 'WALK_ANIMATION_BASE_URL')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const allVillages = Object.freeze([
  { name: 'Animal', path: '/animal-test?walkAnimationQa=1', player: '[data-testid="animal-player"]' },
  { name: 'Human', path: '/human-village-test?walkAnimationQa=1', player: '[data-human-player]' },
  { name: 'Nature', path: '/nature-test?walkAnimationQa=1', player: '[data-testid="nature-player"]' },
  { name: 'Urban', path: '/urban-test?walkAnimationQa=1', player: '[data-testid="urban-player"]' },
  { name: 'Music', path: '/music-test?walkAnimationQa=1', player: '[data-testid="music-player"]' },
  { name: 'Lab', path: '/lab-test?runtime=1&walkAnimationQa=1', player: '[data-testid="lab-player"]', position: '[data-testid="lab-stage"]' },
])
const villages = allVillages.filter((village) => !process.env.WALK_ANIMATION_ZONE || village.name === process.env.WALK_ANIMATION_ZONE)
const directionKeys = Object.freeze({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' })

async function frameState(page, village) {
  const player = page.locator(village.player)
  const character = player.locator('[data-pixel-character]').first()
  return {
    moving: await character.getAttribute('data-character-moving'),
    frame: Number(await character.getAttribute('data-frame-index')),
    column: Number(await character.getAttribute('data-source-column')),
  }
}

async function positionState(page, village) {
  const locator = page.locator(village.position || village.player)
  const xName = village.position ? 'data-player-x' : 'data-world-x'
  const yName = village.position ? 'data-player-y' : 'data-world-y'
  return {
    x: Number(await locator.getAttribute(xName)),
    y: Number(await locator.getAttribute(yName)),
  }
}

async function waitVillageReady(page, village) {
  await page.locator(`${village.player} [data-pixel-character]`).first().waitFor({ timeout: 20_000 })
  await page.locator(`${village.player} [data-character-layer]`).first().waitFor({ timeout: 20_000 })
  await page.waitForFunction(({ selector }) => document.querySelectorAll(`${selector} [data-character-layer]`).length === 5, { selector: village.player })
  await page.waitForFunction(({ selector, positionSelector }) => {
    const node = document.querySelector(positionSelector || selector)
    return positionSelector ? node?.dataset.playerX : node?.dataset.worldX
  }, { selector: village.player, positionSelector: village.position || null })
  await assertIdle(page, village, 'route load')
}

async function assertSynchronizedLayers(page, village) {
  const player = page.locator(village.player)
  const character = player.locator('[data-pixel-character]').first()
  const { rootFrame, rootColumn, layers } = await character.evaluate((root) => ({
    rootFrame: root.getAttribute('data-frame-index'),
    rootColumn: root.getAttribute('data-source-column'),
    layers: [...root.querySelectorAll('[data-character-layer]')].map((node) => ({
      kind: node.getAttribute('data-character-layer'),
      frame: node.getAttribute('data-frame-index'),
      column: node.getAttribute('data-source-column'),
      x: node.getAttribute('x'),
    })),
  }))
  assert.deepEqual(layers.map(({ kind }) => kind), ['skin', 'eyes', 'outfit', 'hair', 'accessory'], `${village.name}: five appearance layers`)
  assert.ok(layers.every((layer) => layer.frame === rootFrame), `${village.name}: every layer uses frame ${rootFrame}`)
  assert.ok(layers.every((layer) => layer.column === rootColumn), `${village.name}: every layer uses source column ${rootColumn}`)
  assert.equal(new Set(layers.map((layer) => layer.x)).size, 1, `${village.name}: every layer uses the same source offset`)
}

async function sampleFrames(page, village, durationMs = 900) {
  const frames = []
  const started = performance.now()
  while (performance.now() - started < durationMs) {
    const state = await frameState(page, village)
    frames.push({ ...state, at: performance.now() - started })
    await assertSynchronizedLayers(page, village)
    await sleep(70)
  }
  return frames
}

async function assertIdle(page, village, label) {
  await page.waitForFunction(({ selector }) => {
    const character = document.querySelector(`${selector} [data-pixel-character]`)
    return character?.dataset.characterMoving === 'false' && character?.dataset.frameIndex === '0'
  }, { selector: village.player })
  assert.deepEqual(await frameState(page, village), { moving: 'false', frame: 0, column: 0 }, `${village.name}: ${label} returns to idle frame 0`)
  await assertSynchronizedLayers(page, village)
}

async function findOpenDirection(page, village) {
  for (const direction of ['up', 'left', 'right', 'down']) {
    const key = directionKeys[direction]
    const before = await positionState(page, village)
    await page.keyboard.down(key)
    try {
      await page.waitForFunction(({ selector }) => document.querySelector(`${selector} [data-pixel-character]`)?.dataset.characterMoving === 'true', { selector: village.player }, { timeout: 1_200 })
      await sleep(650)
      const after = await positionState(page, village)
      const state = await frameState(page, village)
      await page.keyboard.up(key)
      await assertIdle(page, village, `${direction} probe release`)
      if (state.moving === 'true' && Math.hypot(after.x - before.x, after.y - before.y) > 20) return direction
    } catch {
      await page.keyboard.up(key)
    }
  }
  assert.fail(`${village.name}: no movement direction was available from the QA spawn`)
}

async function exerciseInput(page, village, kind, direction) {
  const key = directionKeys[direction]
  console.log(`[walk-animation] ${village.name}: ${kind} ${direction}`)
  if (kind === 'keyboard') {
    await page.keyboard.down(key)
  } else {
    const box = await page.locator(`[data-dpad-direction="${direction}"]`).boundingBox()
    assert.ok(box, `${village.name}: D-pad ${direction} button is visible`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
  }

  await page.waitForFunction(({ selector }) => document.querySelector(`${selector} [data-pixel-character]`)?.dataset.characterMoving === 'true', { selector: village.player }, { timeout: 2_000 })
  const before = await positionState(page, village)
  const frames = await sampleFrames(page, village)
  const after = await positionState(page, village)

  if (kind === 'keyboard') {
    await page.keyboard.up(key)
  } else {
    await page.mouse.up()
  }

  const signedDistance = direction === 'up' ? before.y - after.y
    : direction === 'down' ? after.y - before.y
      : direction === 'left' ? before.x - after.x : after.x - before.x
  assert.ok(signedDistance > 20, `${village.name}: ${kind} ${direction} input moves the character`)
  const movingFrames = frames.filter((sample) => sample.moving === 'true')
  assert.ok(new Set(movingFrames.map((sample) => sample.frame)).size >= 3, `${village.name}: ${kind} changes at least three frames in 900ms`)
  assert.ok(new Set(movingFrames.map((sample) => sample.column)).size >= 3, `${village.name}: ${kind} changes at least three source columns in 900ms`)
  await assertIdle(page, village, `${kind} release`)
  return [...new Set(movingFrames.map((sample) => sample.frame))]
}

async function assertCollisionStopsWalking(page, village, direction) {
  const player = page.locator(village.player)
  const blockedLocator = village.position ? page.locator(village.position) : player
  const key = directionKeys[direction]
  await page.keyboard.down(key)
  await page.waitForFunction(({ selector }) => document.querySelector(selector)?.dataset.movementBlocked === 'true', { selector: village.position || village.player }, { timeout: 15_000 })
  let blockedAt = await positionState(page, village)
  let stillBlockedAt = null
  let collisionStable = false
  const stableDeadline = performance.now() + 3_000
  while (performance.now() < stableDeadline) {
    await sleep(250)
    stillBlockedAt = await positionState(page, village)
    const blocked = await blockedLocator.getAttribute('data-movement-blocked')
    const state = await frameState(page, village)
    if (blocked === 'true' && state.moving === 'false' && stillBlockedAt.x === blockedAt.x && stillBlockedAt.y === blockedAt.y) {
      collisionStable = true
      break
    }
    blockedAt = stillBlockedAt
  }
  assert.equal(collisionStable, true, `${village.name}: collision keeps world coordinates fixed for 250ms`)
  assert.equal(await blockedLocator.getAttribute('data-movement-blocked'), 'true', `${village.name}: collision diagnostic remains active`)
  assert.deepEqual(await frameState(page, village), { moving: 'false', frame: 0, column: 0 }, `${village.name}: held input against collision stays idle`)
  await assertSynchronizedLayers(page, village)
  await page.keyboard.up(key)
  await assertIdle(page, village, 'collision release')
}

let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })

  const results = []
  for (const village of villages) {
    console.log(`[walk-animation] ${village.name}: loading ${village.path}`)
    await page.goto(new URL(village.path, baseUrl).href, { waitUntil: 'domcontentloaded' })
    await waitVillageReady(page, village)

    const direction = await findOpenDirection(page, village)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitVillageReady(page, village)
    console.log(`[walk-animation] ${village.name}: exercising ${direction}`)
    const keyboardFrames = await exerciseInput(page, village, 'keyboard', direction)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitVillageReady(page, village)
    const dpadFrames = await exerciseInput(page, village, 'dpad', direction)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitVillageReady(page, village)
    await assertCollisionStopsWalking(page, village, direction)
    results.push({ village: village.name, direction, keyboardFrames, dpadFrames })
  }

  assert.deepEqual(browserErrors, [], `browser errors: ${JSON.stringify(browserErrors)}`)
  console.log(JSON.stringify({ ok: true, intervalMs: 100, frameCount: 8, results }, null, 2))
} finally {
  await browser?.close().catch(() => {})
}
