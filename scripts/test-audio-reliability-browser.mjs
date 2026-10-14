import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(repositoryRoot, '.next-audio-qa')
const port = Number(process.env.AUDIO_RELIABILITY_PORT || 3147)
const baseUrl = `http://localhost:${port}`
const zones = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']
const groups = ['A', 'B', 'A', 'B', 'A', 'B']
const serverLog = []
let server
let browser

const mediaPattern = /\.(?:mp3|wav|ogg)(?:\?|$)/i
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js server exited early\n${serverLog.slice(-30).join('')}`)
    try {
      const response = await fetch(`${baseUrl}/audio-reliability-test`)
      if (response.status === 200) return
    } catch {}
    await delay(250)
  }
  throw new Error(`Timed out waiting for Next.js server\n${serverLog.slice(-30).join('')}`)
}

async function instrumentPage(page) {
  await page.addInitScript(() => {
    window.__audioQa = { playCalls: 0, maxCurrentTime: 0, rejectNextPlay: false, events: [] }
    window.__soundVillageEventDiagnostics = (eventName, payload) => {
      window.__audioQa.events.push({ eventName, payload })
    }
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      window.__audioQa.playCalls += 1
      if (new URL(window.location.href).searchParams.get('rejectPlay') === '1' || window.__audioQa.rejectNextPlay) {
        window.__audioQa.rejectNextPlay = false
        return Promise.reject(new DOMException('QA playback rejection', 'NotAllowedError'))
      }
      const media = this
      const sample = window.setInterval(() => {
        window.__audioQa.maxCurrentTime = Math.max(window.__audioQa.maxCurrentTime, Number(media.currentTime) || 0)
        if (media.paused || media.ended) window.clearInterval(sample)
      }, 25)
      return originalPlay.apply(media, args)
    }
  })
}

async function installReadOnlyMediaProxy(page) {
  const state = { mode: 'normal', requests: 0, failedOnce: false }
  await page.route(mediaPattern, async route => {
    state.requests += 1
    if (state.mode === 'delay') await delay(600)
    if (state.mode === 'fail-once' && !state.failedOnce) {
      state.failedOnce = true
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'temporary audio failure' })
      return
    }

    const requestHeaders = route.request().headers()
    const upstream = await fetch(route.request().url(), {
      headers: requestHeaders.range ? { Range: requestHeaders.range } : {},
      redirect: 'follow',
    })
    const headers = {}
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
      const value = upstream.headers.get(name)
      if (value) headers[name] = value
    }
    await route.fulfill({
      status: upstream.status,
      headers,
      body: Buffer.from(await upstream.arrayBuffer()),
    })
  })
  return state
}

async function waitForRealPlayback(page, testId = 'annotation-audio-toggle', browserErrors = []) {
  try {
    await page.waitForFunction(() => document.querySelector('[data-testid="audio-reliability-harness"]')?.dataset.hydrated === 'true', null, { timeout: 60_000 })
  } catch (error) {
    throw new Error(`Audio harness did not hydrate: ${JSON.stringify({ browserErrors, serverLog: serverLog.slice(-40) })}`, { cause: error })
  }
  const toggle = page.getByTestId(testId)
  await toggle.waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
  await toggle.evaluate(element => element.click())
  try {
    await page.waitForFunction((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`)
      return element?.dataset.audioStatus === 'playing' || Number(element?.dataset.audioProgress) > 0
    }, testId, { timeout: 20_000 })
    await page.waitForFunction(() => window.__audioQa?.maxCurrentTime > 0, null, { timeout: 20_000 })
  } catch (error) {
    const snapshot = await page.evaluate((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`)
      return {
        status: element?.dataset.audioStatus,
        progress: element?.dataset.audioProgress,
        alert: document.querySelector('[role="alert"]')?.textContent,
        qa: window.__audioQa,
      }
    }, testId)
    snapshot.browserErrors = browserErrors
    snapshot.serverLog = serverLog.slice(-40)
    throw new Error(`Playback did not start: ${JSON.stringify(snapshot)}`, { cause: error })
  }
  return toggle
}

async function countTrackedEvents(page, eventName) {
  return page.evaluate(name => window.__audioQa.events.filter(event => event.eventName === name).length, eventName)
}

try {
  await rm(distDir, { recursive: true, force: true })
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(port)], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ENABLE_INTERNAL_TEST_ROUTES: 'true',
      NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA: 'true',
      NEXT_AUDIO_QA: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', chunk => serverLog.push(chunk.toString()))
  server.stderr.on('data', chunk => serverLog.push(chunk.toString()))
  await waitForServer()

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const browserErrors = []
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/_next/')) {
      browserErrors.push(`asset ${new URL(response.url()).pathname} -> ${response.status()}`)
    }
  })
  page.on('requestfailed', request => {
    if (request.url().includes('/_next/')) browserErrors.push(`asset failed ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`)
  })
  await instrumentPage(page)
  const mediaProxy = await installReadOnlyMediaProxy(page)

  const villageResults = []
  for (let index = 0; index < zones.length; index += 1) {
    const zone = zones[index]
    const group = groups[index]
    await page.goto(`${baseUrl}/audio-reliability-test?zone=${zone}&group=${group}`, { waitUntil: 'domcontentloaded' })
    const harness = page.getByTestId('audio-reliability-harness')
    await harness.waitFor({ state: 'attached' })
    assert.equal(await harness.getAttribute('data-zone'), zone)
    assert.equal(await harness.getAttribute('data-group'), group)
    await waitForRealPlayback(page, 'annotation-audio-toggle', browserErrors)
    assert.equal(await page.locator('input[type="text"]').isEnabled(), true)
    assert.match(await page.locator('body').innerText(), /1회 재생/)
    villageResults.push(`${zone}:${group}`)
  }

  // A delayed response must keep the UI locked until onplay, including fast duplicate clicks.
  mediaProxy.mode = 'delay'
  mediaProxy.requests = 0
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Animal&group=A`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    window.__audioQa.playCalls = 0
    window.__soundVillageAudioDiagnostics = { requests: 0 }
  })
  const delayedToggle = page.getByTestId('annotation-audio-toggle')
  await delayedToggle.waitFor()
  await page.waitForTimeout(500)
  await delayedToggle.evaluate(element => element.click())
  await delayedToggle.dispatchEvent('click')
  await page.waitForFunction(() => document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus === 'loading')
  assert.equal(await delayedToggle.isDisabled(), true)
  assert.equal(await page.locator('input[type="text"]').isDisabled(), true)
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioProgress) > 0, null, { timeout: 20_000 })
  assert.equal(await page.evaluate(() => window.__soundVillageAudioDiagnostics.requests), 1, 'rapid duplicate clicks must create one manager request')

  // Replacing the component while a request is loading must cancel it without stale UI updates.
  mediaProxy.mode = 'delay'
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Nature&group=A`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('[data-testid="audio-reliability-harness"]')?.dataset.hydrated === 'true')
  const staleToggle = page.getByTestId('annotation-audio-toggle')
  await staleToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus === 'loading')
  mediaProxy.mode = 'normal'
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Music&group=B`, { waitUntil: 'domcontentloaded' })
  await waitForRealPlayback(page, 'annotation-audio-toggle', browserErrors)
  assert.equal(await page.getByRole('alert').filter({ hasText: '소리를 재생하지 못했어요' }).count(), 0)

  // The first transport failure is retried once without recording a false play.
  mediaProxy.mode = 'fail-once'
  mediaProxy.requests = 0
  mediaProxy.failedOnce = false
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Human&group=B`, { waitUntil: 'domcontentloaded' })
  await waitForRealPlayback(page, 'annotation-audio-toggle', browserErrors)
  assert(mediaProxy.requests >= 2)
  assert.match(await page.locator('body').innerText(), /1회 재생/)
  const expected503 = 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'
  assert.notEqual(browserErrors.indexOf(expected503), -1, 'the deliberate first-attempt 503 should be observable')
  browserErrors.splice(browserErrors.indexOf(expected503), 1)

  // A failed replay must not revoke an annotation gate earned by an earlier onplay.
  mediaProxy.mode = 'normal'
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Animal&group=A`, { waitUntil: 'domcontentloaded' })
  const replayToggle = await waitForRealPlayback(page, 'annotation-audio-toggle', browserErrors)
  assert.equal(await page.locator('input[type="text"]').isEnabled(), true)
  assert.match(await page.locator('body').innerText(), /1회 재생/)
  assert.equal(await countTrackedEvents(page, 'audio_play_started'), 1)
  await replayToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus === 'stopped')
  await page.evaluate(() => { window.__audioQa.rejectNextPlay = true })
  await replayToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus === 'error', null, { timeout: 20_000 })
  await page.getByRole('alert').filter({ hasText: '소리를 재생하지 못했어요' }).waitFor()
  assert.equal(await page.locator('input[type="text"]').isEnabled(), true)
  assert.match(await page.locator('body').innerText(), /1회 재생/)
  assert.equal(await countTrackedEvents(page, 'audio_play_started'), 1, 'failed replay must not emit another playback success')

  const annotationSoundId = await page.getByTestId('audio-reliability-harness').getAttribute('data-sound-id')
  await page.getByTestId('audio-fixture-switch').evaluate(element => element.click())
  await page.waitForFunction(previousId => {
    const harness = document.querySelector('[data-testid="audio-reliability-harness"]')
    const toggle = document.querySelector('[data-testid="annotation-audio-toggle"]')
    return harness?.dataset.soundId !== previousId && toggle?.dataset.audioStatus === 'idle'
  }, annotationSoundId)
  assert.equal(await page.locator('input[type="text"]').isDisabled(), true)
  assert.doesNotMatch(await page.locator('body').innerText(), /1회 재생/)

  // A rejected HTMLMediaElement.play() must restore retryable error UI and keep gates closed.
  mediaProxy.mode = 'normal'
  mediaProxy.requests = 0
  await page.goto(`${baseUrl}/audio-reliability-test?zone=Nature&group=A&rejectPlay=1`, { waitUntil: 'domcontentloaded' })
  const rejectedToggle = page.getByTestId('annotation-audio-toggle')
  await rejectedToggle.waitFor()
  await page.waitForTimeout(500)
  await rejectedToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus === 'error', null, { timeout: 20_000 })
  await page.getByRole('alert').filter({ hasText: '소리를 재생하지 못했어요' }).waitFor()
  assert.equal(await rejectedToggle.getAttribute('data-audio-status'), 'error')
  assert.equal(await rejectedToggle.getAttribute('aria-label'), '소리 재생')
  assert.equal(await page.locator('input[type="text"]').isDisabled(), true)
  assert.doesNotMatch(await page.locator('body').innerText(), /1회 재생/)

  // Museum candidates and submission remain gated until its own onplay succeeds.
  await page.goto(`${baseUrl}/audio-reliability-test?mode=museum&libraryQaCard=vote&zone=Urban&group=B`, { waitUntil: 'domcontentloaded' })
  const museumToggle = page.getByTestId('museum-audio-toggle')
  await museumToggle.waitFor({ timeout: 15_000 })
  const candidate = page.locator('[aria-disabled]').first()
  await candidate.waitFor()
  assert.equal(await candidate.getAttribute('aria-disabled'), 'true')
  assert.equal(await page.getByTestId('museum-submit').isDisabled(), true)
  await waitForRealPlayback(page, 'museum-audio-toggle', browserErrors)
  assert.equal(await candidate.getAttribute('aria-disabled'), 'false')

  // A failed resume must preserve the earned museum gate without counting or logging success.
  await candidate.click()
  assert.equal(await page.getByTestId('museum-submit').isEnabled(), true)
  assert.match(await page.locator('body').innerText(), /1회 재생/)
  assert.equal(await countTrackedEvents(page, 'museum_audio_play_started'), 1)
  await museumToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="museum-audio-toggle"]')?.dataset.audioStatus === 'stopped')
  await page.evaluate(() => { window.__audioQa.rejectNextPlay = true })
  await museumToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="museum-audio-toggle"]')?.dataset.audioStatus === 'error', null, { timeout: 20_000 })
  await page.getByRole('alert').filter({ hasText: '소리 재생을 재개하지 못했어요' }).waitFor()
  assert.equal(await candidate.getAttribute('aria-disabled'), 'false')
  assert.equal(await page.getByTestId('museum-submit').isEnabled(), true)
  assert.match(await page.locator('body').innerText(), /1회 재생/)
  assert.equal(await countTrackedEvents(page, 'museum_audio_play_started'), 1, 'failed resume must not emit another playback success')
  assert.equal(await countTrackedEvents(page, 'audio_resumed'), 0, 'failed resume must not emit audio_resumed')

  const museumSoundId = await page.getByTestId('audio-reliability-harness').getAttribute('data-sound-id')
  await page.getByTestId('audio-fixture-switch').evaluate(element => element.click())
  await page.waitForFunction(previousId => {
    const harness = document.querySelector('[data-testid="audio-reliability-harness"]')
    const toggle = document.querySelector('[data-testid="museum-audio-toggle"]')
    return harness?.dataset.soundId !== previousId && toggle?.dataset.audioStatus === 'idle'
  }, museumSoundId)
  assert.equal(await page.locator('[aria-disabled]').first().getAttribute('aria-disabled'), 'true')
  assert.equal(await page.getByTestId('museum-submit').isDisabled(), true)
  assert.doesNotMatch(await page.locator('body').innerText(), /1회 재생/)

  // A museum play rejection must keep both candidate selection and submission gated.
  await page.goto(`${baseUrl}/audio-reliability-test?mode=museum&libraryQaCard=vote&zone=Urban&group=B&rejectPlay=1`, { waitUntil: 'domcontentloaded' })
  const rejectedMuseumToggle = page.getByTestId('museum-audio-toggle')
  const rejectedMuseumCandidate = page.locator('[aria-disabled]').first()
  await rejectedMuseumCandidate.waitFor()
  await rejectedMuseumToggle.evaluate(element => element.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="museum-audio-toggle"]')?.dataset.audioStatus === 'error', null, { timeout: 20_000 })
  assert.equal(await rejectedMuseumCandidate.getAttribute('aria-disabled'), 'true')
  assert.equal(await page.getByTestId('museum-submit').isDisabled(), true)
  assert.doesNotMatch(await page.locator('body').innerText(), /1회 재생/)
  assert.deepEqual(browserErrors, [], 'browser scenarios must not produce page or Next.js asset errors')

  await context.close()

  // Mobile-like Chromium context exercises the click/unlock path with touch and a phone viewport.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'SoundVillageAudioQA Mobile Chromium',
  })
  const mobilePage = await mobileContext.newPage()
  await instrumentPage(mobilePage)
  await installReadOnlyMediaProxy(mobilePage)
  await mobilePage.goto(`${baseUrl}/audio-reliability-test?zone=Lab&group=A`, { waitUntil: 'domcontentloaded' })
  await waitForRealPlayback(mobilePage)
  await mobileContext.close()

  console.log(JSON.stringify({
    ok: true,
    villages: villageResults,
    scenarios: ['real-currentTime', 'loading-lock', 'stale-unmount-cancellation', 'bounded-network-retry', 'replay-failure-gate-retention', 'annotation-audio-switch-reset', 'play-rejection', 'museum-gate', 'resume-failure-gate-retention', 'museum-audio-switch-reset', 'museum-play-rejection', 'mobile-like-policy'],
  }))
} finally {
  await browser?.close().catch(() => {})
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      delay(5_000).then(() => server.kill('SIGKILL')),
    ])
  }
  await rm(distDir, { recursive: true, force: true })
}
