import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-flat-v2-release-candidate-2026-10-06')
const CAPTURES = path.join(REVIEW, 'browser')
const baseUrl = process.env.WORLD_FLAT_V2_BROWSER_BASE_URL || 'http://127.0.0.1:3000'
const parsedBaseUrl = new URL(baseUrl)
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(parsedBaseUrl.hostname), 'browser QA must use a loopback URL')

const CASES = Object.freeze([
  { width:1280, height:720, dpr:1 },
  { width:1440, height:900, dpr:1 },
  { width:1440, height:900, dpr:2 },
  { width:1920, height:1080, dpr:1 },
  { width:390, height:844, dpr:1 },
  { width:844, height:390, dpr:1 },
])

const round = value => Number(Number(value || 0).toFixed(3))
const rect = value => value && Object.fromEntries(['left', 'top', 'right', 'bottom', 'width', 'height'].map(key => [key, round(value[key])]))

await mkdir(CAPTURES, { recursive:true })
const browser = await chromium.launch({ headless:true })
const records = []

try {
  for (const testCase of CASES) {
    const context = await browser.newContext({
      viewport:{ width:testCase.width, height:testCase.height },
      deviceScaleFactor:testCase.dpr,
    })
    await context.addInitScript(() => {
      localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
      window.__worldFlatV2Unhandled = []
      window.addEventListener('unhandledrejection', event => window.__worldFlatV2Unhandled.push(String(event.reason || 'unknown')))
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
    page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`) })

    await page.goto(`${baseUrl}/?natureQa=1`, { waitUntil:'domcontentloaded', timeout:45_000 })
    await page.getByTestId('world-map').waitFor({ timeout:45_000 })
    await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.mapReady === 'true', null, { timeout:45_000 })
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="world-map"]')?.dataset.averageFps) > 0, null, { timeout:10_000 })

    const before = await page.evaluate(() => {
      const map = document.querySelector('[data-testid="world-map"]')
      const svg = map.querySelector('svg[viewBox="0 0 3840 2880"]')
      const stage = svg.parentElement
      const background = svg.querySelector('[data-layer="flat-background"]')
      const player = svg.querySelector('[data-testid="world-player"]')
      const character = player.querySelector('svg[data-character-render-scale]')
      const values = node => node?.getBoundingClientRect()
      return {
        mode:map.dataset.worldRenderMode,
        camera:{ width:Number(map.dataset.cameraViewW), height:Number(map.dataset.cameraViewH), scale:Number(map.dataset.cameraCssScale) },
        targetHeight:Number(map.dataset.characterTargetHeight),
        renderScale:Number(map.dataset.characterRenderScale),
        mapReadyMs:Number(map.dataset.mapReadyMs),
        transferBytes:Number(map.dataset.assetTransferBytes),
        decodedBytes:Number(map.dataset.assetDecodedBytes),
        assetResources:Number(map.dataset.assetResourceCount),
        averageFps:Number(map.dataset.averageFps),
        slowFrames:Number(map.dataset.slowFrames),
        maxFrameMs:Number(map.dataset.maxFrameMs),
        heapDelta:Number(map.dataset.heapDelta),
        failedAssets:Number(map.dataset.failedAssetCount),
        stage:values(stage),
        background:values(background),
        player:values(player),
        character:values(character),
        playerPosition:{ x:Number(player.dataset.playerX), y:Number(player.dataset.playerY) },
        characterTransformOrigin:getComputedStyle(character).transformOrigin,
        preserveAspectRatio:svg.getAttribute('preserveAspectRatio'),
        viewBox:svg.getAttribute('viewBox'),
        minimapCount:document.querySelectorAll('[data-testid="world-minimap"]').length,
        fullMapButtons:[...document.querySelectorAll('button')].filter(node => /전체 지도/.test(node.textContent || node.getAttribute('aria-label') || '')).length,
        horizontalOverflow:document.documentElement.scrollWidth - window.innerWidth,
        unhandled:window.__worldFlatV2Unhandled,
      }
    })

    assert.equal(before.mode, 'flat-v2')
    assert.deepEqual(before.camera.width, 3840)
    assert.deepEqual(before.camera.height, 2880)
    assert.equal(before.viewBox, '0 0 3840 2880')
    assert.equal(before.preserveAspectRatio, 'xMidYMid meet')
    assert.equal(before.minimapCount, 0)
    assert.equal(before.fullMapButtons, 0)
    assert.equal(before.horizontalOverflow, 0)
    assert.equal(before.failedAssets, 0)
    assert.deepEqual(before.unhandled, [])
    assert.ok(Math.abs(before.background.width / before.background.height - 4 / 3) < 0.002)
    assert.ok(before.background.left >= before.stage.left - 1 && before.background.right <= before.stage.right + 1)
    assert.ok(before.background.top >= before.stage.top - 1 && before.background.bottom <= before.stage.bottom + 1)
    assert.ok(Math.abs(before.character.height - before.targetHeight) <= 1.25, `character height ${before.character.height} must match ${before.targetHeight}`)
    assert.match(before.characterTransformOrigin, /(?:36px|50%).*(?:88px|100%)/)

    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(350)
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(100)
    const after = await page.evaluate(() => {
      const map = document.querySelector('[data-testid="world-map"]')
      const background = document.querySelector('[data-layer="flat-background"]')
      const player = document.querySelector('[data-testid="world-player"]')
      return {
        background:background.getBoundingClientRect(),
        playerPosition:{ x:Number(player.dataset.playerX), y:Number(player.dataset.playerY) },
        camera:{ width:Number(map.dataset.cameraViewW), height:Number(map.dataset.cameraViewH) },
      }
    })
    assert.ok(after.playerPosition.x > before.playerPosition.x, 'the player must move independently of the camera')
    assert.ok(Math.abs(after.background.left - before.background.left) < 0.1 && Math.abs(after.background.top - before.background.top) < 0.1, 'the full-map camera must remain fixed')
    assert.equal(after.camera.width, before.camera.width)
    assert.equal(after.camera.height, before.camera.height)

    const filename = `${testCase.width}x${testCase.height}-dpr${testCase.dpr}.png`
    await page.screenshot({ path:path.join(CAPTURES, filename) })
    records.push({
      ...testCase,
      screenshot:`browser/${filename}`,
      camera:before.camera,
      targetHeight:before.targetHeight,
      renderScale:round(before.renderScale),
      stage:rect(before.stage),
      background:rect(before.background),
      character:rect(before.character),
      playerMovement:{ before:before.playerPosition, after:after.playerPosition },
      performance:{
        mapReadyMs:round(before.mapReadyMs), transferBytes:before.transferBytes, decodedBytes:before.decodedBytes,
        assetResources:before.assetResources, averageFps:round(before.averageFps), slowFrames:before.slowFrames,
        maxFrameMs:round(before.maxFrameMs), heapDelta:before.heapDelta,
      },
      errors,
    })
    assert.deepEqual(errors, [], `${filename}: ${errors.join('\n')}`)
    await context.close()
  }
} finally {
  await browser.close()
}

const metricsPath = path.join(REVIEW, 'browser-metrics.json')
await writeFile(metricsPath, `${JSON.stringify({ baseUrl, generatedAt:new Date().toISOString(), records }, null, 2)}\n`)
console.log(JSON.stringify({ status:'PASS', cases:records.length, captures:CAPTURES, metricsPath }, null, 2))
