import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reviewRootArgument = process.argv.find(argument => argument.startsWith('--review-root='))?.slice('--review-root='.length)
const REVIEW_ROOT = reviewRootArgument
  ? path.resolve(ROOT, reviewRootArgument)
  : path.join(ROOT, '_review/world-map-scale-prototype-2026-10-05')
const PHASES = Object.freeze({
  baseline: { directory:'00-baseline', scale:1, queryValue:'1' },
  scale80: { directory:'01-scale-80', scale:.8, queryValue:'.8' },
  scale75: { directory:'02-scale-75', scale:.75, queryValue:'.75' },
  production: { directory:'04-production-80', scale:.8, queryValue:null },
})
const VIEWPORTS = Object.freeze([
  { width:1280, height:720 },
  { width:1440, height:900 },
  { width:1920, height:1080 },
  { width:390, height:844 },
  { width:844, height:390 },
])
const LOCATIONS = Object.freeze([
  { id:'library', label:'기본 스폰 및 도서관', tx:60, ty:47, landmarkId:'landmark-library', labelTestId:'world-museum' },
  { id:'home', label:'우리 집', tx:51.5, ty:55, landmarkId:'landmark-home', labelTestId:'world-home' },
  { id:'lab', label:'연구소 마을 입구', tx:59.9375, ty:20.9375, landmarkId:'landmark-lab', labelTestId:'world-portal-lab' },
  { id:'nature', label:'자연 마을 입구', tx:18.8125, ty:41.5625, landmarkId:'landmark-nature', labelTestId:'world-portal-nature' },
  { id:'music', label:'음악 마을 입구', tx:98.9375, ty:77.1875, landmarkId:'landmark-music', labelTestId:'world-portal-music' },
  { id:'animal', label:'동물 마을 입구', tx:100.4375, ty:23.1875, landmarkId:'landmark-animal', labelTestId:'world-portal-animal' },
  { id:'urban', label:'도시 마을 입구', tx:106.6875, ty:48.5625, landmarkId:'landmark-urban', labelTestId:'world-portal-urban' },
  { id:'human', label:'인간 마을 입구', tx:13.6875, ty:78.0625, landmarkId:'landmark-human', labelTestId:'world-portal-human' },
])

const getArgument = name => process.argv.find(argument => argument.startsWith(`${name}=`))?.slice(name.length + 1)
const phaseName = getArgument('--phase')
const baseUrl = getArgument('--base-url') || process.env.WORLD_SCALE_BROWSER_BASE_URL || 'http://localhost:3000'
const dpr = Number(getArgument('--dpr') || 1)
const viewportFilter = getArgument('--viewport')
const captureViewports = viewportFilter
  ? VIEWPORTS.filter(viewport => `${viewport.width}x${viewport.height}` === viewportFilter)
  : VIEWPORTS
const compareOnly = process.argv.includes('--compare')
assert.ok(compareOnly || PHASES[phaseName], `Use --phase=${Object.keys(PHASES).join('|')} or --compare`)
assert.ok([1, 2].includes(dpr), '--dpr must be 1 or 2')
assert.ok(compareOnly || captureViewports.length > 0, '--viewport must name one of the configured viewports')

const round = value => Number(Number(value || 0).toFixed(3))
const intersects = (rect, viewport) => rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height

async function createComparisons() {
  const comparisonDirectory = path.join(REVIEW_ROOT, '03-comparisons')
  await mkdir(comparisonDirectory, { recursive:true })
  const productionComparison = process.argv.includes('--production-compare')
  for (const viewport of VIEWPORTS) {
    for (const location of LOCATIONS) {
      const name = `${viewport.width}x${viewport.height}-${location.id}-dpr1.png`
      const comparisonPhases = productionComparison
        ? [PHASES.baseline, PHASES.scale80]
        : [PHASES.baseline, PHASES.scale80, PHASES.scale75]
      const inputs = comparisonPhases.map(phase => path.join(REVIEW_ROOT, phase.directory, name))
      const images = await Promise.all(inputs.map(input => sharp(input).metadata()))
      const width = images[0].width
      const height = images[0].height
      const labels = productionComparison ? ['개발 비교 100%', '정식 기본 80%'] : ['100%', '80%', '75%']
      const labelHeight = 44
      const panels = await Promise.all(inputs.map(async (input, index) => {
        const image = await sharp(input).png().toBuffer()
        return sharp({ create:{ width, height:height + labelHeight, channels:4, background:'#172014' } })
          .composite([
            { input:image, top:labelHeight, left:0 },
            { input:Buffer.from(`<svg width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#172014"/><text x="18" y="30" fill="white" font-family="sans-serif" font-size="22" font-weight="800">${labels[index]} · ${location.label} · ${viewport.width}×${viewport.height}</text></svg>`), top:0, left:0 },
          ]).png().toBuffer()
      }))
      await sharp({ create:{ width:width * panels.length, height:height + labelHeight, channels:4, background:'#172014' } })
        .composite(panels.map((input, index) => ({ input, left:index * width, top:0 })))
        .png().toFile(path.join(comparisonDirectory, `full-${viewport.width}x${viewport.height}-${location.id}.png`))

      const cropWidth = Math.min(520, width)
      const cropHeight = Math.min(360, height)
      const left = Math.max(0, Math.floor((width - cropWidth) / 2))
      const top = Math.max(0, Math.floor((height - cropHeight) / 2))
      const crops = await Promise.all(inputs.map(input => sharp(input).extract({ left, top, width:cropWidth, height:cropHeight }).png().toBuffer()))
      await sharp({ create:{ width:cropWidth * crops.length, height:cropHeight, channels:4, background:'#172014' } })
        .composite(crops.map((input, index) => ({ input, left:index * cropWidth, top:0 })))
        .png().toFile(path.join(comparisonDirectory, `crop-100pct-${viewport.width}x${viewport.height}-${location.id}.png`))
      const zoomed = await Promise.all(crops.map(input => sharp(input).resize(cropWidth * 2, cropHeight * 2, { kernel:'nearest' }).png().toBuffer()))
      await sharp({ create:{ width:cropWidth * 2 * zoomed.length, height:cropHeight * 2, channels:4, background:'#172014' } })
        .composite(zoomed.map((input, index) => ({ input, left:index * cropWidth * 2, top:0 })))
        .png().toFile(path.join(comparisonDirectory, `crop-200pct-${viewport.width}x${viewport.height}-${location.id}.png`))
    }
  }
  console.log(JSON.stringify({ status:'PASS', comparisonDirectory }, null, 2))
}

if (compareOnly) {
  await createComparisons()
  process.exit(0)
}

const phase = PHASES[phaseName]
const outputDirectory = path.join(REVIEW_ROOT, phase.directory)
await mkdir(outputDirectory, { recursive:true })
const browser = await chromium.launch({ headless:true })
const records = []

try {
  for (const viewport of captureViewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor:dpr })
    await context.addInitScript(() => localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen'))
    for (const location of LOCATIONS) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
      page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`) })
      const query = new URLSearchParams({ natureQa:'1', worldStart:`${location.tx},${location.ty}` })
      if (phase.queryValue !== null) query.set('worldVisualScale', phase.queryValue)
      await page.goto(`${baseUrl}/?${query}`, { waitUntil:'domcontentloaded', timeout:30_000 })
      const map = page.getByTestId('world-map')
      await map.waitFor({ timeout:30_000 })
      await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.mapReady === 'true', null, { timeout:30_000 })
      await page.waitForTimeout(350)
      const metrics = await page.evaluate(async ({ viewport, location, expectedScale }) => {
        const map = document.querySelector('[data-testid="world-map"]')
        const rectOf = node => {
          if (!node) return null
          const rect = node.getBoundingClientRect()
          return { x:rect.x, y:rect.y, left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height }
        }
        const playerNode = document.querySelector('[data-testid="world-player"] svg')
        const player = rectOf(playerNode)
        const playerWrapper = rectOf(document.querySelector('[data-testid="world-player"]'))
        const playerFootScreen = playerWrapper ? {
          x:playerWrapper.left + playerWrapper.width / 2,
          y:playerWrapper.top + playerWrapper.height * (80 / 88),
        } : null
        const landmarkNode = document.querySelector(`[data-object-id="${location.landmarkId}"]`)
        const landmark = rectOf(landmarkNode)
        const labelGroup = document.querySelector(`[data-testid="${location.labelTestId}"]`)
        const labelText = labelGroup?.querySelector('text:last-of-type') || labelGroup?.querySelector('text')
        const label = rectOf(labelText)
        const touchTarget = rectOf(document.querySelector('[data-testid="world-confirm"]'))
        const visibleImages = [...document.querySelectorAll('svg image[data-object-id], svg image[data-terrain-id]')]
          .filter(node => {
            const rect = node.getBoundingClientRect()
            return rect.right > 0 && rect.bottom > 56 && rect.left < viewport.width && rect.top < viewport.height
          })
        const densities = await Promise.all(visibleImages.slice(0, 80).map(async node => {
          const rect = node.getBoundingClientRect()
          const href = node.href?.baseVal || node.getAttribute('href')
          const image = new Image()
          const loaded = new Promise(resolve => { image.onload = resolve; image.onerror = resolve })
          image.src = href
          await loaded
          return {
            id:node.dataset.objectId || node.dataset.terrainId,
            sourceWidth:image.naturalWidth,
            sourceHeight:image.naturalHeight,
            cssWidth:rect.width,
            cssHeight:rect.height,
            x:image.naturalWidth && rect.width ? image.naturalWidth / rect.width : 0,
            y:image.naturalHeight && rect.height ? image.naturalHeight / rect.height : 0,
          }
        }))
        const validDensity = densities.filter(item => item.x > 0 && item.y > 0)
        const worldScale = Number(map.dataset.worldVisualScale || 1)
        const cameraWidth = Number(map.dataset.cameraViewW)
        const cameraHeight = Number(map.dataset.cameraViewH)
        return {
          expectedScale,
          worldVisualScale:worldScale,
          camera:{
            viewW:cameraWidth,
            viewH:cameraHeight,
            cssPxPerWorldX:viewport.width / cameraWidth,
            cssPxPerWorldY:(viewport.height - 56) / cameraHeight,
          },
          player,
          playerWrapper,
          playerFootScreen,
          playerRenderScale:Number(playerNode?.dataset.characterRenderScale || 0),
          landmark,
          landmarkViewportOccupancy:landmark ? { width:landmark.width / viewport.width, height:landmark.height / (viewport.height - 56) } : null,
          label,
          labelCssHeight:label?.height || 0,
          touchTarget,
          visibleAssetCount:visibleImages.length,
          pixelDensity:{
            samples:validDensity.length,
            meanX:validDensity.reduce((sum, item) => sum + item.x, 0) / (validDensity.length || 1),
            meanY:validDensity.reduce((sum, item) => sum + item.y, 0) / (validDensity.length || 1),
            minX:Math.min(...validDensity.map(item => item.x), Infinity),
            minY:Math.min(...validDensity.map(item => item.y), Infinity),
          },
          performance:{
            mapReadyMs:Number(map.dataset.mapReadyMs),
            failedAssetCount:Number(map.dataset.failedAssetCount),
            assetResourceCount:Number(map.dataset.assetResourceCount),
          },
        }
      }, { viewport, location, expectedScale:phase.scale })
      assert.ok(metrics.camera.viewW > 0 && metrics.camera.viewH > 0, 'camera metrics are available')
      assert.ok(metrics.player?.width > 0 && metrics.player?.height > 0, 'player is visible')
      const screenshot = path.join(outputDirectory, `${viewport.width}x${viewport.height}-${location.id}-dpr${dpr}.png`)
      await page.screenshot({ path:screenshot })
      records.push({ phase:phaseName, scale:phase.scale, dpr, viewport, location, screenshot, ...metrics, errors })
      await page.close()
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const metricsPath = path.join(outputDirectory, `metrics-dpr${dpr}.json`)
await writeFile(metricsPath, `${JSON.stringify(records, null, 2)}\n`)
console.log(JSON.stringify({ status:'PASS', phase:phaseName, dpr, captures:records.length, errors:records.reduce((sum, record) => sum + record.errors.length, 0), metricsPath }, null, 2))
