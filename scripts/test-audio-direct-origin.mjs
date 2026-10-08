import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nextEnv from '@next/env'
import { chromium, firefox, webkit } from 'playwright'

import { buildAudioSources } from '../lib/audioPlaybackCore.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(repositoryRoot)

const audioBase = String(process.env.NEXT_PUBLIC_AUDIO_BASE_URL || '').trim().replace(/\/+$/, '')
if (!audioBase) {
  throw new Error('NEXT_PUBLIC_AUDIO_BASE_URL is required for the direct-origin audio test; no URL was inferred')
}

const audioOrigin = new URL(audioBase).origin
const metadata = JSON.parse(await readFile(path.join(repositoryRoot, 'data/sound_metadata.json'), 'utf8'))
const zones = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']
const combinations = zones.flatMap(zone => ['A', 'B'].map(group => ({ zone, group })))
const representatives = combinations.map(({ zone, group }) => {
  // The first entry in the committed metadata stream is stable and is also what
  // the internal QA page selects for the same zone/group query.
  const sound = metadata.sounds.find(candidate => candidate.game_zone === zone && candidate.group === group)
  assert(sound, `missing metadata representative for ${zone}/${group}`)
  return { zone, group, sound }
})

const distDir = path.join(repositoryRoot, '.next-audio-qa')
const port = Number(process.env.AUDIO_DIRECT_ORIGIN_PORT || 3148)
const appOrigin = `http://localhost:${port}`
const serverLog = []
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
let server

function safeUrl(rawUrl) {
  const parsed = new URL(rawUrl)
  return `${parsed.origin}${parsed.pathname}`
}

function safeError(error) {
  return String(error?.message || error || 'unknown error').replace(/https?:\/\/[^\s"'<>]+/g, value => {
    try { return safeUrl(value) } catch { return '[redacted-url]' }
  })
}

function pickedHeaders(headers) {
  return Object.fromEntries([
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'access-control-allow-origin',
  ].map(name => [name, headers.get(name)]))
}

async function fetchWithRedirectChain(rawUrl, init) {
  const chain = []
  let currentUrl = rawUrl
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(currentUrl, { ...init, redirect: 'manual' })
    chain.push({ status: response.status, url: safeUrl(currentUrl) })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, chain }
    const location = response.headers.get('location')
    if (!location) return { response, chain }
    currentUrl = new URL(location, currentUrl).href
  }
  throw new Error(`too many redirects for ${safeUrl(rawUrl)}`)
}

async function inspectHttp(sound) {
  const sources = buildAudioSources(sound.file_path, audioBase)
  let selected = null
  for (const source of sources) {
    const head = await fetchWithRedirectChain(source, { method: 'HEAD' })
    if (head.response.ok) {
      selected = { source, head }
      break
    }
    await head.response.body?.cancel().catch(() => {})
  }
  assert(selected, `no direct-origin source returned a successful HEAD for ${sound.sound_id}`)

  const range = await fetchWithRedirectChain(selected.source, {
    method: 'GET',
    headers: { Range: 'bytes=0-1' },
  })
  const transferredBytes = (await range.response.arrayBuffer()).byteLength
  const headHeaders = pickedHeaders(selected.head.response.headers)
  const rangeHeaders = pickedHeaders(range.response.headers)
  const contentLength = Number(headHeaders['content-length'])

  assert.equal(new URL(selected.source).origin, audioOrigin)
  assert(selected.head.response.ok, `HEAD failed for ${sound.sound_id}`)
  assert.match(headHeaders['content-type'] || '', /^audio\//i, `invalid Content-Type for ${sound.sound_id}`)
  assert(Number.isFinite(contentLength) && contentLength > 0, `invalid Content-Length for ${sound.sound_id}`)
  assert([200, 206].includes(range.response.status), `Range request failed for ${sound.sound_id}`)
  if (range.response.status === 206) {
    assert.match(rangeHeaders['content-range'] || '', /^bytes 0-1\/\d+$/i, `invalid Content-Range for ${sound.sound_id}`)
    assert.equal(transferredBytes, 2, `Range response was not limited to two bytes for ${sound.sound_id}`)
  }

  return {
    selectedUrl: safeUrl(selected.source),
    head: { status: selected.head.response.status, redirectChain: selected.head.chain, headers: headHeaders },
    range: { status: range.response.status, redirectChain: range.chain, headers: rangeHeaders, transferredBytes },
  }
}

async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js server exited early: ${serverLog.slice(-30).join('').slice(-4000)}`)
    try {
      const response = await fetch(`${appOrigin}/audio-reliability-test`)
      if (response.status === 200) return
    } catch {}
    await delay(250)
  }
  throw new Error(`timed out waiting for Next.js server: ${serverLog.slice(-30).join('').slice(-4000)}`)
}

async function executableAvailable(browserType) {
  try {
    await access(browserType.executablePath())
    return true
  } catch {
    return false
  }
}

async function installPassiveDiagnostics(page) {
  await page.addInitScript(() => {
    window.__directAudioQa = {
      playCalls: 0,
      playResolved: 0,
      playRejected: [],
      maxCurrentTime: 0,
      maxDuration: 0,
      maxReadyState: 0,
      networkStates: [],
      mediaErrorCodes: [],
      mediaEvents: [],
      appEvents: [],
    }
    window.__soundVillageEventDiagnostics = (eventName, payload) => {
      window.__directAudioQa.appEvents.push({ eventName, payload })
    }

    const observed = new WeakSet()
    const observe = media => {
      if (observed.has(media)) return
      observed.add(media)
      const sample = eventName => {
        const qa = window.__directAudioQa
        qa.maxCurrentTime = Math.max(qa.maxCurrentTime, Number(media.currentTime) || 0)
        qa.maxDuration = Math.max(qa.maxDuration, Number.isFinite(media.duration) ? media.duration : 0)
        qa.maxReadyState = Math.max(qa.maxReadyState, Number(media.readyState) || 0)
        qa.networkStates.push(Number(media.networkState))
        if (media.error?.code) qa.mediaErrorCodes.push(media.error.code)
        if (eventName) qa.mediaEvents.push(eventName)
      }
      for (const eventName of ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'timeupdate', 'pause', 'ended', 'error']) {
        media.addEventListener(eventName, () => sample(eventName))
      }
      sample()
    }

    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function directOriginObservedPlay(...args) {
      observe(this)
      window.__directAudioQa.playCalls += 1
      const originalPromise = originalPlay.apply(this, args)
      originalPromise.then(
        () => { window.__directAudioQa.playResolved += 1 },
        error => { window.__directAudioQa.playRejected.push({ name: error?.name, message: error?.message }) },
      )
      return originalPromise
    }
  })
}

async function inspectCorsFromAppPage(page, mediaUrl) {
  return page.evaluate(async url => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: { Range: 'bytes=0-1' },
      })
      const bytes = (await response.arrayBuffer()).byteLength
      return {
        ok: response.ok,
        status: response.status,
        bytes,
        allowOrigin: response.headers.get('access-control-allow-origin'),
        contentRange: response.headers.get('content-range'),
      }
    } catch (error) {
      return { ok: false, errorName: error?.name, errorMessage: error?.message }
    }
  }, mediaUrl)
}

async function runRepresentative(page, representative, { corsProbe = false } = {}) {
  const { zone, group, sound, http } = representative
  const audioRequests = []
  const audioResponses = []
  const relevantConsoleErrors = []
  const requestFailures = []
  const responseHeaderPromises = []

  const onRequest = request => {
    try {
      if (new URL(request.url()).origin !== audioOrigin) return
      audioRequests.push({
        url: safeUrl(request.url()),
        redirectFrom: request.redirectedFrom() ? safeUrl(request.redirectedFrom().url()) : null,
      })
    } catch {}
  }
  const onResponse = response => {
    try {
      if (new URL(response.url()).origin !== audioOrigin) return
      const pending = response.allHeaders().then(headers => {
        audioResponses.push({
          url: safeUrl(response.url()),
          status: response.status(),
          headers: Object.fromEntries(['content-type', 'content-length', 'content-range', 'accept-ranges', 'access-control-allow-origin'].map(name => [name, headers[name] || null])),
        })
      })
      responseHeaderPromises.push(pending)
    } catch {}
  }
  const onRequestFailed = request => {
    try {
      if (new URL(request.url()).origin === audioOrigin) {
        requestFailures.push({ url: safeUrl(request.url()), error: request.failure()?.errorText || 'unknown' })
      }
    } catch {}
  }
  const onConsole = message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/cors|mixed.content|decode|unsupported|media|source/i.test(text)) relevantConsoleErrors.push(safeError(text))
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfailed', onRequestFailed)
  page.on('console', onConsole)
  try {
    await page.goto(`${appOrigin}/audio-reliability-test?zone=${encodeURIComponent(zone)}&group=${group}`, { waitUntil: 'domcontentloaded' })
    const harness = page.getByTestId('audio-reliability-harness')
    await harness.waitFor({ state: 'attached', timeout: 30_000 })
    await page.waitForFunction(() => document.querySelector('[data-testid="audio-reliability-harness"]')?.dataset.hydrated === 'true', null, { timeout: 30_000 })
    assert.equal(await harness.getAttribute('data-sound-id'), sound.sound_id, `QA fixture selection drifted for ${zone}/${group}`)

    const input = page.locator('input[type="text"]')
    assert.equal(await input.isDisabled(), true, `gate was open before playback for ${sound.sound_id}`)
    const cors = corsProbe ? await inspectCorsFromAppPage(page, http.selectedUrl) : null
    if (corsProbe) {
      assert.equal(cors.ok, true, `browser CORS probe failed for ${sound.sound_id}: ${cors.errorName || cors.status}`)
      assert([200, 206].includes(cors.status), `browser CORS Range status failed for ${sound.sound_id}`)
    }

    const toggle = page.getByTestId('annotation-audio-toggle')
    await toggle.waitFor({ timeout: 15_000 })
    await toggle.click()
    await page.waitForFunction(() => {
      const qa = window.__directAudioQa
      const toggleElement = document.querySelector('[data-testid="annotation-audio-toggle"]')
      return qa?.playResolved > 0
        && qa?.maxCurrentTime > 0
        && qa?.mediaEvents.includes('play')
        && qa?.mediaEvents.includes('playing')
        && toggleElement?.dataset.audioStatus !== 'loading'
    }, null, { timeout: 30_000 })
    await page.waitForFunction(() => !document.querySelector('input[type="text"]')?.disabled, null, { timeout: 10_000 })

    await Promise.allSettled(responseHeaderPromises)
    const state = await page.evaluate(() => window.__directAudioQa)
    const status = await toggle.getAttribute('data-audio-status')
    const progress = Number(await toggle.getAttribute('data-audio-progress')) || 0
    const bodyText = await page.locator('body').innerText()
    const playStartedEvents = state.appEvents.filter(event => event.eventName === 'audio_play_started').length

    assert(audioRequests.length > 0, `no direct audio request observed for ${sound.sound_id}`)
    assert(audioRequests.every(request => new URL(request.url).origin === audioOrigin), `unexpected media origin for ${sound.sound_id}`)
    assert.equal(requestFailures.length, 0, `media request failed for ${sound.sound_id}`)
    assert.equal(state.playResolved, 1, `native play() did not resolve exactly once for ${sound.sound_id}`)
    assert.equal(state.playRejected.length, 0, `native play() rejected for ${sound.sound_id}`)
    assert(state.maxCurrentTime > 0, `currentTime did not advance for ${sound.sound_id}`)
    assert(state.maxDuration > 0 || state.maxReadyState >= 2, `media never became ready for ${sound.sound_id}`)
    assert.equal(state.mediaErrorCodes.length, 0, `media element error for ${sound.sound_id}`)
    assert.notEqual(status, 'loading', `loading state did not settle for ${sound.sound_id}`)
    assert.equal(await input.isEnabled(), true, `gate did not open after playback for ${sound.sound_id}`)
    assert.match(bodyText, /1회 재생/, `playCount was not exactly one for ${sound.sound_id}`)
    assert.equal(playStartedEvents, 1, `audio_play_started was not emitted exactly once for ${sound.sound_id}`)
    assert.deepEqual(relevantConsoleErrors, [], `browser media console errors for ${sound.sound_id}`)

    return {
      zone,
      group,
      soundId: sound.sound_id,
      ok: true,
      nativePlay: { calls: state.playCalls, resolved: state.playResolved, rejected: state.playRejected },
      media: {
        maxCurrentTime: state.maxCurrentTime,
        duration: state.maxDuration,
        readyState: state.maxReadyState,
        networkStates: [...new Set(state.networkStates)],
        errorCodes: state.mediaErrorCodes,
        events: [...new Set(state.mediaEvents)],
      },
      app: { status, progress, playCount: 1, gateOpen: true, playStartedEvents },
      requests: audioRequests,
      responses: audioResponses,
      cors,
      consoleErrors: relevantConsoleErrors,
    }
  } catch (error) {
    const snapshot = await page.evaluate(() => ({
      diagnostics: window.__directAudioQa,
      status: document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioStatus,
      progress: document.querySelector('[data-testid="annotation-audio-toggle"]')?.dataset.audioProgress,
      gateDisabled: document.querySelector('input[type="text"]')?.disabled,
      alert: document.querySelector('[role="alert"]')?.textContent,
    })).catch(() => null)
    return {
      zone,
      group,
      soundId: sound.sound_id,
      ok: false,
      error: safeError(error),
      snapshot,
      requests: audioRequests,
      responses: audioResponses,
      requestFailures,
      consoleErrors: relevantConsoleErrors,
    }
  } finally {
    page.off('request', onRequest)
    page.off('response', onResponse)
    page.off('requestfailed', onRequestFailed)
    page.off('console', onConsole)
  }
}

async function runBrowserMatrix({ name, browserType, selectedRepresentatives, contextOptions, corsProbe = false }) {
  if (!(await executableAvailable(browserType))) {
    return { name, available: false, ok: null, reason: `Playwright ${name} executable is not installed` }
  }

  let browser
  try {
    browser = await browserType.launch({ headless: true })
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    await installPassiveDiagnostics(page)
    const results = []
    for (const representative of selectedRepresentatives) {
      results.push(await runRepresentative(page, representative, { corsProbe }))
    }
    await context.close()
    return {
      name,
      available: true,
      version: browser.version(),
      ok: results.every(result => result.ok),
      results,
    }
  } catch (error) {
    return { name, available: true, ok: false, error: safeError(error), results: [] }
  } finally {
    await browser?.close().catch(() => {})
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  appOrigin,
  audioOrigin,
  selectionRule: 'first matching entry in committed data/sound_metadata.json order',
  prohibitedInterceptionUsed: false,
  http: [],
  browsers: [],
}

try {
  for (const representative of representatives) {
    const http = await inspectHttp(representative.sound)
    representative.http = http
    report.http.push({
      zone: representative.zone,
      group: representative.group,
      soundId: representative.sound.sound_id,
      ...http,
    })
  }

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

  const onePerZone = representatives.filter(representative => representative.group === 'A')
  report.browsers.push(await runBrowserMatrix({
    name: 'Chromium',
    browserType: chromium,
    selectedRepresentatives: representatives,
    contextOptions: { viewport: { width: 1280, height: 900 } },
    corsProbe: true,
  }))
  report.browsers.push(await runBrowserMatrix({
    name: 'Firefox',
    browserType: firefox,
    selectedRepresentatives: onePerZone,
    contextOptions: { viewport: { width: 1280, height: 900 } },
  }))
  report.browsers.push(await runBrowserMatrix({
    name: 'WebKit',
    browserType: webkit,
    selectedRepresentatives: onePerZone,
    contextOptions: { viewport: { width: 1280, height: 900 } },
  }))
  report.browsers.push(await runBrowserMatrix({
    name: 'mobile-like Chromium',
    browserType: chromium,
    selectedRepresentatives: onePerZone,
    contextOptions: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'SoundVillageAudioQA Mobile Chromium',
    },
  }))

  const availableBrowsers = report.browsers.filter(browser => browser.available)
  const successfulBrowsers = availableBrowsers.filter(browser => browser.ok)
  report.browserSummary = {
    available: availableBrowsers.length,
    successful: successfulBrowsers.length,
  }
  report.ok = availableBrowsers.length > 0
    && successfulBrowsers.length === availableBrowsers.length
  console.log(`AUDIO_DIRECT_ORIGIN_RESULT=${JSON.stringify(report)}`)
  if (!report.ok) process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      delay(5_000).then(() => server.kill('SIGKILL')),
    ])
  }
  await rm(distDir, { recursive: true, force: true })
}
