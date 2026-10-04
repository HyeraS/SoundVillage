import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { chromium } from 'playwright'
import { getNatureReferenceScale } from '../lib/characterRenderMetrics.mjs'
import { WORLD_PORTALS, worldDestinationInteractionPoint } from '../lib/worldMapGeometry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FRAME_SIZE = 32
const HUD_HEIGHT = 56
const DIRECTIONS = Object.freeze({ down: 0, up: 1, right: 2, left: 3 })
const ROW_DIRECTIONS = Object.freeze(Object.fromEntries(Object.entries(DIRECTIONS).map(([direction, row]) => [row, direction])))
const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...rest] = entry.split('=')
  return [key.replace(/^--/, ''), rest.join('=')]
}))
const baseUrl = args['base-url'] || 'http://localhost:3417'
const allowedOrigin = new URL(baseUrl).origin
const outputDir = path.resolve(args.output || `/private/tmp/soundvillage-character-render-final-qa.${process.pid}-${Date.now()}`)
const viewports = [
  { width: 1440, height: 900, dpr: 1 },
  { width: 1280, height: 720, dpr: 1 },
  { width: 390, height: 844, dpr: 2 },
  { width: 844, height: 390, dpr: 2 },
].filter((viewport) => !args.viewport || `${viewport.width}x${viewport.height}` === args.viewport)
const selectors = Object.freeze({
  Nature: '[data-testid="nature-player"]',
  Animal: '[data-testid="animal-player"]',
  Human: '[data-human-player]',
  Urban: '[data-testid="urban-player"]',
  Music: '[data-testid="music-player"]',
  Lab: '[data-testid="lab-player"]',
})
const zones = Object.keys(selectors).filter((zone) => !args.zone || zone === args.zone)
const portalByZone = new Map(WORLD_PORTALS.map((portal) => [portal.zone, portal]))
const loadoutFiles = Object.freeze({
  default: [
    'public/assets/world/player_body.png',
    'public/assets/world/player_clothes.png',
    'public/assets/world/player_hair.png',
  ],
  layeredV2: [
    'public/assets/character-v2/skin/skin-02-walk.png',
    'public/assets/character-v2/eyes/red-walk.png',
    'public/assets/character-v2/outfits/skirt-walk.png',
    'public/assets/character-v2/hair/bob/black-walk.png',
    'public/assets/character-v2/accessories/hat_cowboy-walk.png',
  ],
})
const requestedLoadouts = Object.keys(loadoutFiles).filter((loadout) => !args.loadout || loadout === args.loadout)

async function loadAlphaSheet(relativePath) {
  const { data, info } = await sharp(path.join(ROOT, relativePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width % FRAME_SIZE, 0, `${relativePath} width uses 32px frames`)
  assert.ok(info.height >= FRAME_SIZE * 4, `${relativePath} includes four direction rows`)
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    href: `/${relativePath.replace(/^public\//, '')}`,
  }
}

function frameUnionBounds(images, row, frame) {
  let minX = FRAME_SIZE
  let minY = FRAME_SIZE
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const sourceX = frame * FRAME_SIZE + x
      const sourceY = row * FRAME_SIZE + y
      const visible = images.some((image) => (
        sourceX < image.width
        && sourceY < image.height
        && image.data[(sourceY * image.width + sourceX) * image.channels + 3] > 0
      ))
      if (!visible) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  assert.ok(maxX >= minX && maxY >= minY, `frame ${frame}, row ${row} has visible alpha`)
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

const loadouts = {}
for (const [name, files] of Object.entries(loadoutFiles)) {
  const images = await Promise.all(files.map(loadAlphaSheet))
  const bounds = {}
  for (const [direction, row] of Object.entries(DIRECTIONS)) {
    bounds[direction] = Array.from({ length: 8 }, (_, frame) => frameUnionBounds(images, row, frame))
  }
  loadouts[name] = {
    layers: images.map(({ href, width, height }) => ({ href, sheetW: width, sheetH: height })),
    bounds,
  }
}
assert.deepEqual(loadouts.default.bounds.down[0], { x: 9, y: 12, w: 14, h: 20 })
assert.deepEqual(loadouts.layeredV2.bounds.down[0], { x: 8, y: 9, w: 16, h: 23 })
for (const loadout of Object.values(loadouts)) {
  for (const frames of Object.values(loadout.bounds)) {
    for (const bounds of frames) {
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.w <= 32 && bounds.y + bounds.h <= 32, 'tracked alpha stays inside the full source frame')
    }
  }
}

const worldMapSource = await readFile(new URL('../components/WorldMap.js', import.meta.url), 'utf8')
const actorsSource = await readFile(new URL('../components/world-map/WorldMapActors.js', import.meta.url), 'utf8')
const zoneMapSource = await readFile(new URL('../components/ZoneMap.js', import.meta.url), 'utf8')
assert.match(worldMapSource, /partnerOnMap[\s\S]{0,900}<WorldCharacter/, 'Duo partner uses the shared WorldCharacter renderer')
assert.match(worldMapSource, /key="local-player"[\s\S]{0,700}<WorldCharacter/, 'local player uses the shared WorldCharacter renderer')
assert.match(actorsSource, /transformOrigin:'50% 100%'/, 'World character scales around its bottom center')
assert.match(worldMapSource, /style=\{\{ overflow:'visible' \}\}/, 'World foreignObject intentionally allows render compensation overflow')
assert.match(zoneMapSource, /resolveWorldCharacterLayers\(\{ outfitSrc, accessorySrc, \.\.\.\(characterLoadout \|\| \{\}\) \}\)/, 'Village PixelChar resolves the runtime loadout')

const results = []
const liveResizeResults = []
const animationResults = []
const diagnostics = []
const unexpectedExternalRequests = []
const maxErrors = { width: 0, height: 0, gap: 0, footX: 0, footY: 0, wrapperWidth: 0, wrapperHeight: 0 }

function attachDiagnostics(page, label) {
  const record = { label, consoleErrors: [], pageErrors: [], reactWarnings: [], externalRequests: [] }
  page.on('pageerror', (error) => record.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') record.consoleErrors.push(message.text())
    if (message.type() === 'warning' && /hydration|resize|react/i.test(message.text())) record.reactWarnings.push(message.text())
  })
  diagnostics.push(record)
  return record
}

async function createContext(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
  })
  await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
  await context.route('**/*', async (route) => {
    const url = route.request().url()
    if (/^(data|blob):/.test(url) || new URL(url).origin === allowedOrigin) {
      await route.continue()
      return
    }
    if (url.startsWith('https://fonts.googleapis.com/')) {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '/* local QA: remote font disabled */' })
      return
    }
    unexpectedExternalRequests.push(url)
    await route.fulfill({ status: 204, body: '' })
  })
  return context
}

async function gotoWorldForZone(page, zone) {
  const portal = portalByZone.get(zone)
  const interaction = worldDestinationInteractionPoint(portal)
  const start = `${interaction.x / 32},${interaction.y / 32}`
  await page.goto(`${baseUrl}/?natureQa=1&worldStart=${start}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="world-map"][data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await page.locator(`[data-testid="world-map"][data-near-destination="${zone}"]`).waitFor({ timeout: 10_000 })
  const world = page.locator('[data-testid="world-player"]')
  await world.locator('svg[data-character-render-scale]').waitFor()
  return world
}

async function injectLoadout(locator, loadoutName) {
  if (loadoutName === 'default') return
  const layers = loadouts[loadoutName].layers
  await locator.evaluate(async (wrapper, payload) => {
    const svg = wrapper.matches('svg') ? wrapper : wrapper.querySelector('svg')
    if (!svg) throw new Error('character SVG not found for loadout injection')
    await Promise.all(payload.layers.map((layer) => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = resolve
      image.onerror = () => reject(new Error(`failed to preload ${layer.href}`))
      image.src = layer.href
    })))
    const existing = [...svg.querySelectorAll('image')]
    if (existing.length === 0) throw new Error('character SVG image layers not found')
    const sourceX = existing[0].getAttribute('x') || '0'
    const sourceY = existing[0].getAttribute('y') || '0'
    const clipPath = existing[0].getAttribute('clip-path')
    existing.forEach((image) => image.remove())
    for (const [index, layer] of payload.layers.entries()) {
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      image.setAttribute('href', layer.href)
      image.setAttribute('x', sourceX)
      image.setAttribute('y', sourceY)
      image.setAttribute('width', String(layer.sheetW))
      image.setAttribute('height', String(layer.sheetH))
      if (clipPath) image.setAttribute('clip-path', clipPath)
      image.setAttribute('data-qa-layer', String(index))
      image.style.imageRendering = 'pixelated'
      svg.append(image)
    }
    svg.dataset.qaLoadout = payload.name
  }, { layers, name: loadoutName })
}

async function measureCharacter(locator, loadoutName) {
  return locator.evaluate((wrapper, payload) => {
    const svg = wrapper.matches('svg') ? wrapper : wrapper.querySelector('svg')
    if (!svg) throw new Error('character SVG not found')
    const ctm = svg.getScreenCTM()
    if (!ctm) throw new Error('character SVG getScreenCTM returned null')
    const preserve = svg.preserveAspectRatio.baseVal
    if (preserve.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
      throw new Error('preserveAspectRatio none is not allowed')
    }
    if (preserve.align !== SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_XMIDYMID
      || preserve.meetOrSlice !== SVGPreserveAspectRatio.SVG_MEETORSLICE_MEET) {
      throw new Error('character SVG must use xMidYMid meet')
    }
    const image = svg.querySelector('image')
    if (!image) throw new Error('character SVG image layer not found')
    const frame = Math.max(0, Math.round(-Number(image.getAttribute('x') || 0) / payload.frameSize)) % 8
    const row = Math.max(0, Math.round(-Number(image.getAttribute('y') || 0) / payload.frameSize)) % 4
    const direction = payload.rowDirections[row]
    const alpha = payload.bounds[direction][frame]
    const points = [
      new DOMPoint(alpha.x, alpha.y),
      new DOMPoint(alpha.x + alpha.w, alpha.y),
      new DOMPoint(alpha.x, alpha.y + alpha.h),
      new DOMPoint(alpha.x + alpha.w, alpha.y + alpha.h),
    ].map((point) => point.matrixTransform(ctm))
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const visible = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    }
    visible.width = visible.right - visible.left
    visible.height = visible.bottom - visible.top
    const wrapperRect = svg.getBoundingClientRect()
    const gameplayFoot = { x: wrapperRect.left + wrapperRect.width / 2, y: wrapperRect.bottom }
    const footX = Number(wrapper.dataset.footScreenX)
    const footY = Number(wrapper.dataset.footScreenY)
    const offsetParent = wrapper.offsetParent?.getBoundingClientRect()
    const datasetFoot = Number.isFinite(footX) && Number.isFinite(footY)
      ? { x: (offsetParent?.left || 0) + footX, y: (offsetParent?.top || 0) + footY }
      : null
    const viewBox = svg.viewBox.baseVal
    return {
      wrapper: {
        left: wrapperRect.left,
        top: wrapperRect.top,
        right: wrapperRect.right,
        bottom: wrapperRect.bottom,
        width: wrapperRect.width,
        height: wrapperRect.height,
      },
      visible,
      gameplayFoot,
      datasetFoot,
      gap: gameplayFoot.y - visible.bottom,
      alpha,
      direction,
      frame,
      viewBox: { x: viewBox.x, y: viewBox.y, w: viewBox.width, h: viewBox.height },
      preserveAspectRatio: svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet (default)',
      renderScale: svg.dataset.characterRenderScale || getComputedStyle(wrapper).transform,
      imageHrefs: [...svg.querySelectorAll('image')].map((element) => element.getAttribute('href')),
      transformFinite: !/NaN|Infinity/.test(`${svg.style.transform} ${wrapper.style.transform}`),
    }
  }, {
    bounds: loadouts[loadoutName].bounds,
    rowDirections: ROW_DIRECTIONS,
    frameSize: FRAME_SIZE,
  })
}

function expectedFor(viewport, alpha) {
  const scale = getNatureReferenceScale(viewport.width, viewport.height - HUD_HEIGHT)
  const sourceScale = 2.25 * scale
  return {
    wrapperWidth: 72 * scale,
    wrapperHeight: 88 * scale,
    visibleWidth: alpha.w * sourceScale,
    visibleHeight: alpha.h * sourceScale,
    gap: (88 - (8 + (alpha.y + alpha.h) * 2.25)) * scale,
  }
}

function assertMeetMeasurement(measurement, viewport, label) {
  assert.deepEqual(measurement.viewBox, { x: 0, y: 0, w: 32, h: 32 }, `${label} uses the full source viewBox`)
  assert.equal(measurement.preserveAspectRatio, 'xMidYMid meet (default)', `${label} keeps the SVG default meet mapping`)
  assert.equal(measurement.transformFinite, true, `${label} transform stays finite`)
  const expected = expectedFor(viewport, measurement.alpha)
  const errors = {
    wrapperWidth: Math.abs(measurement.wrapper.width - expected.wrapperWidth),
    wrapperHeight: Math.abs(measurement.wrapper.height - expected.wrapperHeight),
    width: Math.abs(measurement.visible.width - expected.visibleWidth),
    height: Math.abs(measurement.visible.height - expected.visibleHeight),
    gap: Math.abs(measurement.gap - expected.gap),
  }
  assert.ok(errors.wrapperWidth <= 1, `${label} wrapper width error ${errors.wrapperWidth}`)
  assert.ok(errors.wrapperHeight <= 1, `${label} wrapper height error ${errors.wrapperHeight}`)
  assert.ok(errors.width <= Math.max(1, expected.visibleWidth * .02), `${label} visible width error ${errors.width}`)
  assert.ok(errors.height <= Math.max(1, expected.visibleHeight * .02), `${label} visible height error ${errors.height}`)
  assert.ok(errors.gap <= 1, `${label} visible-to-wrapper-foot gap error ${errors.gap}`)
  for (const key of Object.keys(errors)) maxErrors[key] = Math.max(maxErrors[key], errors[key])
  if (measurement.datasetFoot) {
    const footX = Math.abs(measurement.gameplayFoot.x - measurement.datasetFoot.x)
    const footY = Math.abs(measurement.gameplayFoot.y - measurement.datasetFoot.y)
    maxErrors.footX = Math.max(maxErrors.footX, footX)
    maxErrors.footY = Math.max(maxErrors.footY, footY)
    assert.ok(footX <= 1, `${label} dataset gameplay foot X error ${footX}`)
    assert.ok(footY <= 1, `${label} dataset gameplay foot Y error ${footY}`)
  }
  return errors
}

function assertSceneMatchesNature(world, village, label) {
  assert.deepEqual(village.alpha, world.alpha, `${label} compares the same frame alpha`)
  const errors = {
    width: Math.abs(village.visible.width - world.visible.width),
    height: Math.abs(village.visible.height - world.visible.height),
    gap: Math.abs(village.gap - world.gap),
    wrapperWidth: Math.abs(village.wrapper.width - world.wrapper.width),
    wrapperHeight: Math.abs(village.wrapper.height - world.wrapper.height),
  }
  assert.ok(errors.width <= Math.max(1, world.visible.width * .02), `${label} scene width mismatch ${errors.width} (${world.visible.width} vs ${village.visible.width}; wrappers ${world.wrapper.width} vs ${village.wrapper.width}; frames ${world.direction}/${world.frame} vs ${village.direction}/${village.frame}; scales ${world.renderScale} vs ${village.renderScale})`)
  assert.ok(errors.height <= Math.max(1, world.visible.height * .02), `${label} scene height mismatch ${errors.height} (${world.visible.height} vs ${village.visible.height})`)
  assert.ok(errors.gap <= 1, `${label} scene gap mismatch ${errors.gap}`)
  assert.ok(errors.wrapperWidth <= 1, `${label} wrapper width mismatch ${errors.wrapperWidth}`)
  assert.ok(errors.wrapperHeight <= 1, `${label} wrapper height mismatch ${errors.wrapperHeight}`)
  for (const key of Object.keys(errors)) maxErrors[key] = Math.max(maxErrors[key], errors[key])
  return errors
}

function assertNoDiagnostics(record) {
  assert.deepEqual(record.consoleErrors, [], `${record.label} console errors`)
  assert.deepEqual(record.pageErrors, [], `${record.label} page errors`)
  assert.deepEqual(record.reactWarnings, [], `${record.label} hydration/resize warnings`)
  assert.deepEqual(record.externalRequests, [], `${record.label} attempted external requests`)
}

async function runTransitionMatrix(browser) {
  for (const viewport of viewports) {
    for (const loadoutName of requestedLoadouts) {
      const context = await createContext(browser, viewport)
      try {
        for (const zone of zones) {
          const label = `${loadoutName}-${viewport.width}x${viewport.height}-dpr${viewport.dpr}-${zone}`
          const page = await context.newPage()
          const record = attachDiagnostics(page, label)
          const worldLocator = await gotoWorldForZone(page, zone)
          await injectLoadout(worldLocator, loadoutName)
          const world = await measureCharacter(worldLocator, loadoutName)
          const worldErrors = assertMeetMeasurement(world, viewport, `${label} World`)
          const worldPath = path.join(outputDir, `${loadoutName}-${viewport.width}x${viewport.height}-${zone.toLowerCase()}-world.png`)
          await page.screenshot({ path: worldPath })

          await page.keyboard.press('Enter')
          const zoneLocator = page.locator(selectors[zone])
          await zoneLocator.waitFor({ state: 'visible', timeout: 30_000 })
          await page.keyboard.down('ArrowDown')
          await page.waitForTimeout(80)
          await page.keyboard.up('ArrowDown')
          await page.waitForTimeout(220)
          await injectLoadout(zoneLocator, loadoutName)
          const village = await measureCharacter(zoneLocator, loadoutName)
          const villageErrors = assertMeetMeasurement(village, viewport, label)
          const sceneErrors = assertSceneMatchesNature(world, village, label)
          const villagePath = path.join(outputDir, `${loadoutName}-${viewport.width}x${viewport.height}-${zone.toLowerCase()}-village.png`)
          await page.screenshot({ path: villagePath })

          let musicOcclusion = null
          if (zone === 'Music') {
            const silhouette = page.locator('[data-testid="music-player-silhouette"]')
            await page.addStyleTag({ content: '[data-testid="music-player-silhouette"] { display: block !important; }' })
            await page.waitForTimeout(100)
            await injectLoadout(silhouette, loadoutName)
            const silhouetteMetrics = await measureCharacter(silhouette, loadoutName)
            assertSceneMatchesNature(village, silhouetteMetrics, `${label} silhouette`)
            const frontZ = await page.locator('canvas[aria-label="Music Village objects in front of player"]').evaluate((element) => getComputedStyle(element).zIndex)
            const playerZ = await zoneLocator.evaluate((element) => getComputedStyle(element).zIndex)
            const silhouetteZ = await silhouette.evaluate((element) => getComputedStyle(element).zIndex)
            assert.equal(Number(playerZ), 2)
            assert.equal(Number(frontZ), 3)
            assert.equal(Number(silhouetteZ), 4)
            const shadow = await zoneLocator.locator('div[aria-hidden="true"]').first().evaluate((element) => {
              const rect = element.getBoundingClientRect()
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
            })
            const shadowCenterError = Math.abs((shadow.left + shadow.right) / 2 - village.gameplayFoot.x)
            assert.ok(shadowCenterError <= 1, `${label} shadow center error ${shadowCenterError}`)
            musicOcclusion = { silhouette: silhouetteMetrics, frontZ, playerZ, silhouetteZ, shadow, shadowCenterError }
          }

          results.push({
            viewport,
            loadout: loadoutName,
            zone,
            world,
            village,
            errors: { world: worldErrors, village: villageErrors, scene: sceneErrors },
            musicOcclusion,
            screenshots: { world: worldPath, village: villagePath },
          })
          assertNoDiagnostics(record)
          await page.close()
        }
      } finally {
        await context.close()
      }
    }
  }
}

async function openScene(page, scene) {
  const world = await gotoWorldForZone(page, scene === 'World' ? 'Nature' : scene)
  if (scene === 'World') return world
  await page.keyboard.press('Enter')
  const locator = page.locator(selectors[scene])
  await locator.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(250)
  return locator
}

async function runLiveResize(browser) {
  if (args.viewport || args.zone || args.loadout || args['skip-extra']) return
  for (const scene of ['World', 'Nature', 'Animal', 'Music']) {
    const context = await createContext(browser, { width: 1440, height: 900, dpr: 1 })
    const page = await context.newPage()
    const record = attachDiagnostics(page, `live-resize-${scene}`)
    try {
      const locator = await openScene(page, scene)
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 1280, height: 720 },
      ]) {
        await page.setViewportSize(viewport)
        await page.waitForTimeout(350)
        const measurement = await measureCharacter(locator, 'default')
        const errors = assertMeetMeasurement(measurement, viewport, `live resize ${scene} ${viewport.width}x${viewport.height}`)
        const screenshot = path.join(outputDir, `resize-${scene.toLowerCase()}-${viewport.width}x${viewport.height}.png`)
        await page.screenshot({ path: screenshot })
        liveResizeResults.push({ scene, viewport, measurement, errors, screenshot })
      }
      assertNoDiagnostics(record)
    } finally {
      await page.close()
      await context.close()
    }
  }
}

async function runAnimation(browser) {
  if (args.viewport || args.zone || args.loadout || args['skip-extra']) return
  const viewport = { width: 1280, height: 720, dpr: 1 }
  const context = await createContext(browser, viewport)
  const page = await context.newPage()
  const record = attachDiagnostics(page, 'animation-Music')
  try {
    const locator = await openScene(page, 'Music')
    const idle = await measureCharacter(locator, 'default')
    assertMeetMeasurement(idle, viewport, 'Music idle down')
    assert.equal(idle.direction, 'down', 'Music starts idle facing down')
    assert.equal(idle.frame, 0, 'Music idle uses frame zero')
    for (const [direction, key] of Object.entries({
      up: 'ArrowUp',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      down: 'ArrowDown',
    })) {
      await page.keyboard.down(key)
      const samples = []
      for (let sample = 0; sample < 8; sample += 1) {
        await page.waitForTimeout(110)
        const measurement = await measureCharacter(locator, 'default')
        assert.equal(measurement.direction, direction, `Music moving direction is ${direction}`)
        assert.ok(Math.abs(measurement.wrapper.width - idle.wrapper.width) <= 1, `${direction} wrapper width stays fixed`)
        assert.ok(Math.abs(measurement.wrapper.height - idle.wrapper.height) <= 1, `${direction} wrapper height stays fixed`)
        assertMeetMeasurement(measurement, viewport, `Music moving ${direction} frame ${measurement.frame}`)
        samples.push(measurement)
      }
      await page.keyboard.up(key)
      assert.ok(samples.some((measurement) => measurement.frame > 0), `Music ${direction} advances walking frames`)
      await page.waitForTimeout(140)
      const idleAfter = await measureCharacter(locator, 'default')
      assert.equal(idleAfter.direction, direction, `Music idle keeps the ${direction} direction`)
      assert.equal(idleAfter.frame, 0, `Music ${direction} returns to idle frame zero`)
      assertMeetMeasurement(idleAfter, viewport, `Music idle ${direction}`)
      animationResults.push({ direction, samples, idleAfter })
    }
    assertNoDiagnostics(record)
  } finally {
    await page.close()
    await context.close()
  }
}

async function labelTile(file, label) {
  const overlay = Buffer.from(`<svg width="320" height="200" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="320" height="25" fill="rgba(0,0,0,.72)"/><text x="9" y="18" fill="white" font-family="sans-serif" font-size="14" font-weight="700">${label}</text></svg>`)
  return sharp(file).resize(320, 200, { fit: 'cover' }).composite([{ input: overlay }]).png().toBuffer()
}

async function createContactSheets() {
  if (args.viewport || args.zone || args.loadout) return []
  const sheets = []
  for (const loadoutName of requestedLoadouts) {
    for (const viewport of viewports) {
      const entries = [
        ['World', path.join(outputDir, `${loadoutName}-${viewport.width}x${viewport.height}-nature-world.png`)],
        ...['Nature', 'Animal', 'Music', 'Lab'].map((zone) => [
          zone,
          path.join(outputDir, `${loadoutName}-${viewport.width}x${viewport.height}-${zone.toLowerCase()}-village.png`),
        ]),
      ]
      const tiles = await Promise.all(entries.map(([label, file]) => labelTile(file, label)))
      const target = path.join(outputDir, `contact-${loadoutName}-${viewport.width}x${viewport.height}.png`)
      await sharp({ create: { width: 320 * tiles.length, height: 200, channels: 4, background: '#111' } })
        .composite(tiles.map((input, index) => ({ input, left: index * 320, top: 0 })))
        .png()
        .toFile(target)
      sheets.push(target)
    }
  }
  return sheets
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
let contactSheets = []
try {
  await runTransitionMatrix(browser)
  await runLiveResize(browser)
  await runAnimation(browser)
  contactSheets = await createContactSheets()
  assert.deepEqual(unexpectedExternalRequests, [], 'no unexpected external requests')
} finally {
  await browser.close()
}

const consoleReport = diagnostics.map((record) => ({
  label: record.label,
  consoleErrors: record.consoleErrors,
  pageErrors: record.pageErrors,
  reactWarnings: record.reactWarnings,
  externalRequests: record.externalRequests,
}))
await writeFile(path.join(outputDir, 'console-errors.json'), `${JSON.stringify(consoleReport, null, 2)}\n`)
await writeFile(path.join(outputDir, 'metrics.json'), `${JSON.stringify({
  pass: true,
  baseUrl,
  measurement: 'SVG source alpha corners transformed through getScreenCTM()',
  characterV2Fixture: 'Tracked V2 layers injected into the production World/PixelChar SVG DOM while preserving frame, clip, wrapper and transforms',
  duoSharedRenderer: true,
  unexpectedExternalRequests,
  alphaBounds: Object.fromEntries(Object.entries(loadouts).map(([name, loadout]) => [name, loadout.bounds])),
  maxErrors,
  results,
  liveResizeResults,
  animationResults,
  contactSheets,
}, null, 2)}\n`)
console.log(JSON.stringify({
  pass: true,
  outputDir,
  comparisons: results.length,
  liveResizeChecks: liveResizeResults.length,
  animationDirections: animationResults.length,
  contactSheets: contactSheets.length,
  maxErrors,
}))
