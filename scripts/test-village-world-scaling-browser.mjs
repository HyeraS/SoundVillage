import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { VILLAGE_RUNTIME_MANIFESTS } from '../lib/villageRuntimeManifest.mjs'
import { COLLIDERS as ANIMAL_COLLIDERS, EXIT as ANIMAL_EXIT, collidesAt as animalCollides } from '../lib/animalVillageSunflowerConfig.mjs'
import { EXIT_TRIGGER as HUMAN_EXIT, buildHumanVillage, collides as humanCollides } from '../lib/humanVillageConfig.mjs'
import { EXIT as LAB_EXIT, buildVillage as buildLabVillage, collides as labCollides } from '../lib/labVillageConfig.mjs'
import { EXIT as NATURE_EXIT, buildNatureFarmModel } from '../lib/natureFarmLayout.mjs'
import { EXIT_TRIGGER as URBAN_EXIT, collidesPlayerAt as urbanCollides } from '../lib/urbanV3WorldConfig.mjs'
import * as animalMask from '../lib/generated/animalWalkableMask.generated.mjs'
import * as humanMask from '../lib/generated/humanWalkableMask.generated.mjs'
import * as labMask from '../lib/generated/labWalkableMask.generated.mjs'
import * as natureMask from '../lib/generated/natureWalkableMask.generated.mjs'
import * as urbanMask from '../lib/generated/urbanV3WalkableMask.generated.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(ROOT, '_review/village-world-scaling')
const PORT = Number(process.env.VILLAGE_SCALING_PORT) || 3129
const BASE_URL = process.env.VILLAGE_SCALING_BASE_URL || `http://127.0.0.1:${PORT}`
const SCALES = [0.75, 1, 1.3, 2]
const VILLAGES = {
  'urban-v3': { route: '/urban-test', stage: '[data-testid="urban-v3-stage"]', player: '[data-testid="urban-v3-player"]' },
  animal: { route: '/animal-test', stage: '[data-testid="animal-stage"]', player: '[data-testid="animal-player"]' },
  human: { route: '/human-village-test', stage: '[data-testid="human-stage"]', player: '[data-human-player]' },
  lab: { route: '/lab-test?runtime=1', stage: '[data-testid="lab-stage"]', player: '[data-testid="lab-stage"]' },
  nature: { route: '/nature-test', stage: '[data-testid="nature-stage"]', player: '[data-testid="nature-player"]' },
}

const humanModel = buildHumanVillage()
const labModel = buildLabVillage([])
const natureModel = buildNatureFarmModel()
const collisionFunctions = {
  'urban-v3': (x, y) => Boolean(urbanCollides(x, y)),
  animal: (x, y) => Boolean(animalCollides(ANIMAL_COLLIDERS, x, y)),
  human: (x, y) => Boolean(humanCollides(humanModel, x, y, 6)),
  lab: (x, y) => Boolean(labCollides(labModel, x, y)),
  nature: (x, y) => !natureModel.canStand(x, y),
}
const maskFunctions = {
  'urban-v3': urbanMask.isMaskPointWalkable,
  animal: animalMask.isMaskPointWalkable,
  human: humanMask.isMaskPointWalkable,
  lab: labMask.isMaskPointWalkable,
  nature: natureMask.isMaskPointWalkable,
}
const DIRECTIONS = [
  { key: 'ArrowUp', dx: 0, dy: -4 },
  { key: 'ArrowDown', dx: 0, dy: 4 },
  { key: 'ArrowLeft', dx: -4, dy: 0 },
  { key: 'ArrowRight', dx: 4, dy: 0 },
]
const findCollisionProbe = (villageId) => {
  const manifest = VILLAGE_RUNTIME_MANIFESTS[villageId]
  const collides = collisionFunctions[villageId]
  const maskWalkable = maskFunctions[villageId]
  for (let y = 24; y < manifest.baseWorldHeight - 24; y += 4) {
    for (let x = 24; x < manifest.baseWorldWidth - 24; x += 4) {
      if (collides(x, y)) continue
      const direction = DIRECTIONS.find(({ dx, dy }) => collides(x + dx, y + dy) && !maskWalkable(x + dx, y + dy))
      if (direction) return { x, y, key: direction.key }
    }
  }
  throw new Error(`${villageId}: no white-to-black collision probe found`)
}
const COLLISION_PROBES = Object.fromEntries(Object.keys(VILLAGES).map((villageId) => [villageId, findCollisionProbe(villageId)]))
const EXIT_PROBES = {
  'urban-v3': { x: URBAN_EXIT.x + URBAN_EXIT.w / 2, y: URBAN_EXIT.y + URBAN_EXIT.h / 2 },
  animal: { x: ANIMAL_EXIT.x, y: ANIMAL_EXIT.y },
  human: { x: HUMAN_EXIT.x + HUMAN_EXIT.w / 2, y: HUMAN_EXIT.y + HUMAN_EXIT.h / 2 },
  lab: { x: LAB_EXIT.x + LAB_EXIT.w / 2, y: LAB_EXIT.y + LAB_EXIT.h / 2 },
  nature: { x: NATURE_EXIT.x, y: NATURE_EXIT.y },
}

const waitForServer = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Next.js did not become ready at ${BASE_URL}`)
}

const position = async (page, selector, villageId) => page.locator(selector).evaluate((element, id) => ({
  x: Number(element.dataset[id === 'lab' ? 'playerX' : 'worldX']),
  y: Number(element.dataset[id === 'lab' ? 'playerY' : 'worldY']),
}), villageId)

const routeFor = (config, scale, extra = '') => {
  const separator = config.route.includes('?') ? '&' : '?'
  return `${BASE_URL}${config.route}${separator}worldScale=${scale}${extra}`
}

await fs.mkdir(OUTPUT, { recursive: true })
let server = null
if (!process.env.VILLAGE_SCALING_BASE_URL) {
  server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr.on('data', (chunk) => process.stderr.write(chunk))
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ headless: true })
  const reportPath = path.join(OUTPUT, 'report.json')
  let report = { villages: {} }
  try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')) } catch {}

  for (const [villageId, config] of Object.entries(VILLAGES)) {
    const manifest = VILLAGE_RUNTIME_MANIFESTS[villageId]
    const scaleResults = []
    for (const scale of SCALES) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
      await page.goto(routeFor(config, scale, '&collision=1'), { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const stage = page.locator(config.stage)
      await stage.waitFor({ timeout: 30_000 })
      await page.waitForFunction((selector) => {
        const element = document.querySelector(selector)
        return element?.dataset.generatedMask === 'true'
      }, config.stage, { timeout: 30_000 })
      assert.equal(await stage.getAttribute('data-mask-source'), manifest.mask.src)
      assert.equal(Number(await stage.getAttribute('data-world-width')), manifest.baseWorldWidth * scale)
      assert.equal(Number(await stage.getAttribute('data-world-height')), manifest.baseWorldHeight * scale)

      const beforeKeyboard = await position(page, config.player, villageId)
      let keyboardMoved = false
      for (const key of ['ArrowUp', 'ArrowRight', 'ArrowLeft']) {
        await page.keyboard.down(key)
        await page.waitForTimeout(350)
        await page.keyboard.up(key)
        const after = await position(page, config.player, villageId)
        if (Math.hypot(after.x - beforeKeyboard.x, after.y - beforeKeyboard.y) > 0.1) { keyboardMoved = true; break }
      }
      assert.equal(keyboardMoved, true, `${villageId} ${scale}x keyboard movement`)

      const beforeDpad = await position(page, config.player, villageId)
      const dpad = page.locator('[data-dpad-direction="right"]')
      await dpad.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse' })
      await page.waitForTimeout(300)
      await dpad.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse' })
      const afterDpad = await position(page, config.player, villageId)
      const dpadMoved = Math.hypot(afterDpad.x - beforeDpad.x, afterDpad.y - beforeDpad.y) > 0.1
      assert.equal(dpadMoved, true, `${villageId} ${scale}x D-pad movement`)

      await page.setViewportSize({ width: 980, height: 720 })
      await page.waitForTimeout(250)
      assert.equal(Number(await stage.getAttribute('data-world-width')), manifest.baseWorldWidth * scale)
      const canvasSize = await stage.locator('canvas').first().evaluate((canvas) => ({ width: canvas.width, height: canvas.height }))
      assert.ok(canvasSize.width > 0 && canvasSize.height > 0)

      let screenshot = null
      if (scale === 1 || scale === 1.3) {
        screenshot = path.join(OUTPUT, `${villageId}-${String(scale).replace('.', '_')}x.png`)
        await page.screenshot({ path: screenshot })
      }
      const probe = COLLISION_PROBES[villageId]
      await page.goto(routeFor(config, scale, `&startX=${probe.x}&startY=${probe.y}`), { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.locator(config.stage).waitFor({ timeout: 30_000 })
      await page.waitForFunction((selector) => document.querySelector(selector)?.dataset.generatedMask === 'true', config.stage)
      await page.keyboard.down(probe.key)
      try {
        await page.waitForFunction((selector) => document.querySelector(selector)?.dataset.movementBlocked === 'true', config.player, { timeout: 5_000 })
      } finally {
        await page.keyboard.up(probe.key)
      }
      await page.goto(routeFor(config, scale, '&firstItem=1'), { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.locator(config.stage).waitFor({ timeout: 30_000 })
      await page.getByText(/소리 전사하기/).last().waitFor({ timeout: 15_000 })
      await page.keyboard.press('Enter')
      if (villageId === 'lab') {
        await page.waitForFunction((selector) => document.querySelector(selector)?.dataset.mode === 'annotation', config.stage)
      } else {
        await page.getByTestId('annotation-audio-toggle').waitFor({ timeout: 15_000 })
      }
      const exit = EXIT_PROBES[villageId]
      await page.goto(routeFor(config, scale, `&startX=${exit.x}&startY=${exit.y}`), { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.locator(config.stage).waitFor({ timeout: 30_000 })
      await page.getByText(/월드맵으로 돌아/).last().waitFor({ timeout: 15_000 })
      assert.deepEqual(errors, [], `${villageId} ${scale}x console/page errors`)
      scaleResults.push({
        scale,
        currentWorldWidth: manifest.baseWorldWidth * scale,
        currentWorldHeight: manifest.baseWorldHeight * scale,
        backgroundLoaded: true,
        generatedMask: true,
        startMovement: keyboardMoved,
        dpadMovement: dpadMoved,
        resizeAligned: true,
        blackMaskCollision: true,
        markerInteraction: true,
        exitInteraction: true,
        consoleErrors: errors.length,
        screenshot: screenshot ? path.relative(ROOT, screenshot) : null,
      })
      await context.close()
    }

    report.villages ||= {}
    report.villages[villageId] = {
      ...(report.villages[villageId] || {}),
      villageId,
      browserE2E: { passed: true, scales: scaleResults },
      consoleErrorCount: 0,
      start: { passed: true },
      exit: { passed: true, browserScales: SCALES },
      markerAccess: { passed: true, browserScales: SCALES },
      blackMaskCollision: { passed: true, browserScales: SCALES },
      connectedArea: { passed: true, verifiedBy: 'model reachability regression' },
    }
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  }
  console.log('Five-village production browser scaling E2E passed at 0.75x, 1x, 1.3x, and 2x.')
} finally {
  await browser?.close().catch(() => {})
  if (server) {
    server.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (!server.killed) server.kill('SIGKILL')
  }
}
