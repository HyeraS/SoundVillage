import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey) throw new Error('Local Stage 4 browser environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authClients = Array.from({ length:3 }, () => createClient(supabaseUrl, anonKey, options))
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['A','B','C'].map((role) => `STAGE4_BROWSER_${role}_${suffix}`)
const users = []
const reviewDir = path.resolve('_review/character-studio-stage4-hardening')
let browser
let contextA
let contextB
let contextC

const initialA = {
  skin_id:'skin_02', eyes_id:'eyes_blue', hair_style_id:'hair_braids', hair_color_id:'pink',
  outfit_id:'overalls', accessory_id:'acc_glasses',
}
const initialB = {
  skin_id:'skin_07', eyes_id:'eyes_red', hair_style_id:'hair_extra_long', hair_color_id:'turquoise',
  outfit_id:'skirt', accessory_id:'acc_hat_lucky',
}
const initialC = {
  skin_id:'skin_08', eyes_id:'eyes_green', hair_style_id:'hair_ponytail', hair_color_id:'copper',
  outfit_id:'basic', accessory_id:null,
}

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function createContext(session, viewport = { width:1280, height:720 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor:1, permissions:['clipboard-read','clipboard-write'] })
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(({ key, value }) => {
    let clipboardText = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable:true,
      value:{
        writeText:async (text) => { clipboardText = String(text) },
        readText:async () => clipboardText,
      },
    })
    localStorage.setItem(key, JSON.stringify(value))
    localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  }, { key:storageKey, value:session })
  return context
}

async function screenshot(page, filename) {
  const target = path.join(reviewDir, filename)
  await page.screenshot({ path:target, fullPage:true })
  assert((await fs.stat(target)).size > 500, `${filename} is empty`)
}

function diagnosticClock() {
  const startedAt = performance.now()
  return () => Math.round(performance.now() - startedAt)
}

function safeCode(value) {
  return typeof value === 'string' ? value.replace(/[^a-z0-9_-]/gi, '').slice(0, 64) || null : null
}

function safeSkinId(value) {
  return typeof value === 'string' && /^skin_[a-z0-9_-]{1,32}$/i.test(value) ? value : null
}

function watchPage(page, errors, diagnostic, now) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const locationUrl = message.location().url || ''
    if (/Failed to load resource/.test(message.text()) && /\/api\/duo-v2\//.test(locationUrl)) {
      errors.duoNetworkConsole.push(`${message.text()} ${locationUrl}`)
      return
    }
    errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  page.on('response', (response) => {
    if (/\/api\/duo-v2\//.test(response.url()) && response.status() >= 400) {
      errors.duoHttp.push(`${response.status()} ${new URL(response.url()).pathname}`)
    }
    if (response.url().includes('/assets/character-v2/') && response.status() >= 400) {
      errors.assets.push(`${response.status()} ${response.url()}`)
    }
    if (new URL(response.url()).pathname === '/api/duo-v2/character-identity') {
      void response.json().catch(() => ({})).then((body) => {
        diagnostic.identityResponses.push({
          atMs:now(),
          status:response.status(),
          ok:body?.ok === true,
          code:safeCode(body?.code),
          contractVersion:Number.isInteger(body?.contractVersion) ? body.contractVersion : null,
          peerSkinId:body?.ok === true ? safeSkinId(body?.peer?.skinId) : null,
        })
      })
    }
  })
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/duo-v2/character-identity') {
      diagnostic.identityRequests.push({ atMs:now() })
    }
  })
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return
      try {
        const message = JSON.parse(payload)
        if (!Array.isArray(message) || message.length < 5) return
        const event = message[3]
        const body = message[4]
        if (event === 'phx_reply' && body?.status === 'ok') {
          diagnostic.realtime.push({ atMs:now(), phase:'SUBSCRIBED' })
        } else if (event === 'presence_state' || event === 'presence_diff') {
          diagnostic.realtime.push({ atMs:now(), phase:'sync' })
        } else if (event === 'broadcast' && body?.event === 'pos') {
          diagnostic.realtime.push({ atMs:now(), phase:'position_broadcast' })
        }
      } catch {}
    })
  })
}

async function capturePartnerDiagnostic(page, locator, diagnostic, now, filename) {
  const target = path.join(reviewDir, filename)
  await page.screenshot({ path:target, fullPage:true })
  const dataCharacterSync = await locator.getAttribute('data-character-sync').catch(() => null)
  const dataLayerSrc = await locator.locator('[data-layer-src]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-layer-src')).filter(Boolean),
  ).catch(() => [])
  const imageSrc = await locator.locator('image').evaluateAll((elements) =>
    elements.map((element) => new URL(element.getAttribute('href'), location.href).pathname),
  ).catch(() => [])
  const snapshot = {
    atMs:now(),
    dataCharacterSync,
    dataLayerSrc,
    imageSrc,
    characterIdentityRequestCount:diagnostic.identityRequests.length,
    characterIdentityResponses:diagnostic.identityResponses,
    realtimeLifecycle:diagnostic.realtime,
    screenshot:path.basename(target),
  }
  console.error(JSON.stringify({ stage4PartnerDiagnostic:snapshot }))
  return snapshot
}

async function openWorld(page, target = appUrl) {
  await page.goto(target, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:45_000 })
}

async function enterHome(page) {
  await page.getByRole('button', { name:'우리 집 꾸미기 열기' }).click()
  await page.locator('[data-interior-room="ready"]').waitFor({ timeout:30_000 })
}

function libraryUrl() {
  const query = new URLSearchParams({
    stage4DuoQa:'1',
    libraryQaCard:'shop',
  })
  return `${appUrl}/?${query}`
}

async function openStudio(page, { activeDuo = false } = {}) {
  await openWorld(page, libraryUrl())
  if (activeDuo) {
    await page.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:45_000 })
  }
  await page.getByTestId('stage4-enter-library').click()
  await page.getByTestId('character-studio').waitFor({ timeout:30_000 })
  await page.getByRole('tab', { name:'기본 외형' }).click()
  await page.getByTestId('identity-customization-panel').waitFor()
}

async function layerSources(locator) {
  return locator.locator('[data-interior-character-layer]').evaluateAll((elements) => elements.map((element) => element.dataset.layerSrc))
}

async function imageSources(locator) {
  return locator.locator('image').evaluateAll((elements) => elements.map((element) => new URL(element.getAttribute('href'), location.href).pathname))
}

async function expectLayer(locator, expected, interior = false) {
  await locator.locator(interior ? `[data-layer-src="${expected}"]` : `image[href="${expected}"]`).waitFor({ timeout:30_000 })
}

async function saveIdentity(page, { skin, eyes, hairStyle, hairColor }) {
  await page.getByTestId(`identity-option-${skin}`).click()
  await page.getByTestId(`identity-option-${eyes}`).click()
  await page.getByTestId(`identity-option-${hairStyle}`).click()
  await page.getByTestId(`identity-option-${hairColor}`).click()
  await page.getByTestId('identity-save').click()
  await page.getByRole('status').filter({ hasText:'현재 캐릭터에 바로 적용' }).waitFor({ timeout:30_000 })
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  const signed = []
  for (const client of authClients) {
    const auth = ok(await client.auth.signInAnonymously(), 'browser sign-in')
    signed.push(auth)
    users.push(auth.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'participants')
  for (const user of users) ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:user.id }), 'initialize profile')
  ok(await admin.from('participant_catalog_items').insert([
    { participant_id:participantIds[0], item_id:'overalls', acquisition_source:'completion_reward' },
    { participant_id:participantIds[0], item_id:'acc_glasses', acquisition_source:'completion_reward' },
    { participant_id:participantIds[1], item_id:'skirt', acquisition_source:'completion_reward' },
    { participant_id:participantIds[1], item_id:'acc_hat_lucky', acquisition_source:'completion_reward' },
    ...['plant_tall','plant_bush','books','fruitbowl'].map((item_id) => ({ participant_id:participantIds[0], item_id, acquisition_source:'individual_purchase' })),
  ]), 'ownership')
  ok(await admin.from('participant_multi_village_character_loadouts').update(initialA).eq('participant_id', participantIds[0]), 'loadout A')
  ok(await admin.from('participant_multi_village_character_loadouts').update(initialB).eq('participant_id', participantIds[1]), 'loadout B')
  ok(await admin.from('participant_multi_village_character_loadouts').update(initialC).eq('participant_id', participantIds[2]), 'loadout C')
  const roomItems = ['plant_tall','plant_bush','books','fruitbowl']
  ok(await admin.from('participant_economy_v1_rooms').insert({
    participant_id:participantIds[0], revision:1, invite_unique_item_count:4,
    room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:roomItems.map((itemId, index) => ({ uid:index + 1, itemId, layer:'floor', col:index * 2, row:0, flip:false })) },
  }), 'host room')

  browser = await chromium.launch({ headless:true })
  contextA = await createContext(signed[0].session)
  contextB = await createContext(signed[1].session)
  contextC = await createContext(signed[2].session)
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  const pageC = await contextC.newPage()
  const errors = { console:[], page:[], assets:[], duoHttp:[], duoNetworkConsole:[] }
  const now = diagnosticClock()
  const diagnostics = [pageA, pageB, pageC].map(() => ({ identityRequests:[], identityResponses:[], realtime:[] }))
  for (const [index, page] of [pageA, pageB, pageC].entries()) {
    page.setDefaultTimeout(30_000)
    watchPage(page, errors, diagnostics[index], now)
  }

  await openWorld(pageA)
  await enterHome(pageA)
  await pageA.getByRole('button', { name:'초대', exact:true }).click()
  const inviteDialog = pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' })
  await inviteDialog.getByRole('button', { name:'실시간 초대 링크 만들기' }).click()
  await inviteDialog.getByTestId('duo-invite-ready').waitFor()
  await inviteDialog.getByRole('button', { name:'복사', exact:true }).click()
  const inviteUrl = await pageA.evaluate(() => navigator.clipboard.readText())
  await inviteDialog.getByRole('button', { name:'닫기' }).click()

  await pageB.goto(inviteUrl, { waitUntil:'domcontentloaded' })
  await pageB.locator('[data-interior-room="ready"][data-room-visitor="true"]').waitFor({ timeout:45_000 })
  const interiorPartnerB = pageB.getByTestId('interior-duo-partner')
  await interiorPartnerB.waitFor()
  diagnostics[1].realtime.push({ atMs:now(), phase:'position_broadcast_observed' })
  await pageA.keyboard.down('ArrowRight')
  await pageA.waitForTimeout(900)
  await pageA.keyboard.up('ArrowRight')
  try {
    await expectLayer(interiorPartnerB, '/assets/character-v2/skin/skin-02-walk.png', true)
  } catch (error) {
    await capturePartnerDiagnostic(pageB, interiorPartnerB, diagnostics[1], now, 'stage4-partner-failure.png')
    throw error
  }
  await expectLayer(pageB.getByTestId('interior-player'), '/assets/character-v2/skin/skin-07-walk.png', true)
  assert((await layerSources(interiorPartnerB)).includes('/assets/world/outfits/overalls.png'))
  await screenshot(pageB, 'interior-different-characters.png')
  assert.equal(await pageB.getByTestId('character-studio-onboarding').count(), 0)
  await screenshot(pageB, 'visitor-onboarding-hidden.png')

  await pageA.getByRole('button', { name:/나가기/ }).click()
  await pageA.getByTestId('world-map').waitFor()
  await pageB.getByTestId('world-map').waitFor({ timeout:30_000 })
  await pageB.keyboard.down('ArrowRight')
  await pageB.waitForTimeout(650)
  await pageB.keyboard.up('ArrowRight')
  const worldPartnerA = pageA.getByTestId('duo-partner')
  await expectLayer(worldPartnerA, '/assets/character-v2/skin/skin-07-walk.png')
  assert((await imageSources(worldPartnerA)).includes('/assets/character-v2/outfits/skirt-walk.png'))
  await screenshot(pageA, 'worldmap-different-host-visitor.png')

  await openStudio(pageA, { activeDuo:true })
  const onboarding = pageA.getByTestId('character-studio-onboarding')
  await onboarding.waitFor()
  await onboarding.getByRole('button', { name:'캐릭터 스타일 안내 닫기' }).focus()
  assert.equal(await pageA.evaluate(() => document.activeElement?.getAttribute('aria-label')), '캐릭터 스타일 안내 닫기')
  await screenshot(pageA, 'onboarding-desktop.png')
  await pageA.setViewportSize({ width:390, height:844 })
  await screenshot(pageA, 'onboarding-mobile-portrait.png')
  await pageA.setViewportSize({ width:844, height:390 })
  await screenshot(pageA, 'onboarding-mobile-landscape.png')
  await pageA.keyboard.press('Escape')
  await onboarding.waitFor({ state:'detached' })
  await pageA.setViewportSize({ width:1280, height:720 })

  const peerBefore = pageB.getByTestId('duo-partner')
  await peerBefore.waitFor({ state:'detached' })
  assert.equal(await peerBefore.count(), 0, 'peer remained visible after leaving the shared world screen')
  const identityBeforePreview = ok(await admin.rpc('get_multi_village_character_profile_admin', {
    p_auth_user_id:users[0].id,
  }), 'identity before unsaved preview')
  assert.equal(identityBeforePreview.loadout.skinId, 'skin_02')
  await pageA.getByTestId('identity-option-skin_04').click()
  await pageA.waitForTimeout(800)
  const identityDuringPreview = ok(await admin.rpc('get_multi_village_character_profile_admin', {
    p_auth_user_id:users[0].id,
  }), 'identity during unsaved preview')
  assert.equal(identityDuringPreview.loadout.skinId, 'skin_02', 'unsaved preview reached the server')
  await screenshot(pageA, 'realtime-before-save.png')
  await saveIdentity(pageA, { skin:'skin_04', eyes:'eyes_brown', hairStyle:'hair_curly', hairColor:'red' })
  await openWorld(pageA)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor()
  await pageA.keyboard.press('ArrowRight')
  await expectLayer(peerBefore, '/assets/character-v2/skin/skin-04-walk.png')
  await screenshot(pageB, 'realtime-after-save.png')

  await openStudio(pageB, { activeDuo:true })
  await pageB.getByTestId('character-studio-onboarding').waitFor()
  await pageB.getByTestId('character-studio-onboarding').getByRole('button', { name:'확인했어요' }).click()
  await saveIdentity(pageB, { skin:'skin_06', eyes:'eyes_grey', hairStyle:'hair_spacebuns', hairColor:'lilac' })
  await openWorld(pageB)
  await pageB.keyboard.down('ArrowLeft')
  await pageB.waitForTimeout(650)
  await pageB.keyboard.up('ArrowLeft')
  await expectLayer(pageA.getByTestId('duo-partner'), '/assets/character-v2/skin/skin-06-walk.png')

  await contextA.setOffline(true)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'다시 연결하는 중' }).waitFor()
  await contextA.setOffline(false)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:45_000 })
  await pageB.keyboard.press('ArrowRight')
  await expectLayer(pageA.getByTestId('duo-partner'), '/assets/character-v2/skin/skin-06-walk.png')
  await screenshot(pageA, 'reconnect-restored.png')

  await pageA.route('**/api/duo-v2/character-identity**', (route) => route.fulfill({
    status:503, contentType:'application/json', body:JSON.stringify({ ok:false, code:'storage_retryable', retryable:true }),
  }))
  await contextA.setOffline(true)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'다시 연결하는 중' }).waitFor()
  await contextA.setOffline(false)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:45_000 })
  await pageB.keyboard.press('ArrowLeft')
  const fallbackPartner = pageA.getByTestId('duo-partner')
  await fallbackPartner.waitFor()
  await expectLayer(fallbackPartner, '/assets/character-v2/skin/skin-01-walk.png')
  await screenshot(pageA, 'appearance-load-fallback.png')
  await pageA.unroute('**/api/duo-v2/character-identity**')

  let releaseStaleBResponse
  let markStaleBRequestSeen
  const staleBRequestSeen = new Promise((resolve) => { markStaleBRequestSeen = resolve })
  await pageA.route('**/api/duo-v2/character-identity**', async (route) => {
    const response = await route.fetch()
    markStaleBRequestSeen()
    await new Promise((resolve) => { releaseStaleBResponse = resolve })
    await route.fulfill({ response })
  }, { times:1 })
  await pageB.evaluate(() => window.dispatchEvent(new CustomEvent('soundvillage:character-loadout-saved')))
  await staleBRequestSeen

  await enterHome(pageA)
  await pageA.getByRole('button', { name:'초대', exact:true }).click()
  await pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' }).getByRole('button', { name:'실시간 세션 종료' }).click()
  await pageA.getByTestId('interior-duo-partner').waitFor({ state:'detached' })
  await screenshot(pageA, 'ab-ended-peer-removed.png')
  await pageB.locator('[data-interior-room="ready"][data-room-visitor="true"]').waitFor({ timeout:45_000 })
  await pageB.getByTestId('duo-connection-state').filter({ hasText:'실시간 세션 종료됨' }).waitFor()
  assert.equal(await pageB.getByTestId('interior-duo-partner').count(), 0)
  await screenshot(pageB, 'ab-ended-visitor-peer-removed.png')

  const secondInviteDialog = pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' })
  await secondInviteDialog.getByRole('button', { name:'실시간 초대 링크 만들기' }).click()
  await secondInviteDialog.getByTestId('duo-invite-ready').waitFor()
  assert.equal(await pageA.getByTestId('interior-duo-partner').count(), 0, 'B remained visible before C joined')
  await screenshot(pageA, 'ac-before-connect-no-previous-peer.png')
  await secondInviteDialog.getByRole('button', { name:'복사', exact:true }).click()
  const secondInviteUrl = await pageA.evaluate(() => navigator.clipboard.readText())
  await secondInviteDialog.getByRole('button', { name:'닫기' }).click()

  await pageC.goto(secondInviteUrl, { waitUntil:'domcontentloaded' })
  await pageC.locator('[data-interior-room="ready"][data-room-visitor="true"]').waitFor({ timeout:45_000 })
  await pageC.keyboard.down('ArrowRight')
  await pageC.waitForTimeout(700)
  await pageC.keyboard.up('ArrowRight')
  const peerCInInterior = pageA.getByTestId('interior-duo-partner')
  await expectLayer(peerCInInterior, '/assets/character-v2/skin/skin-08-walk.png', true)
  assert.equal((await layerSources(peerCInInterior)).includes('/assets/character-v2/skin/skin-06-walk.png'), false, 'B appearance leaked into A-C')
  await screenshot(pageA, 'ac-new-peer-server-appearance.png')

  releaseStaleBResponse()
  await pageA.waitForTimeout(500)
  await expectLayer(peerCInInterior, '/assets/character-v2/skin/skin-08-walk.png', true)
  assert.equal((await layerSources(peerCInInterior)).includes('/assets/character-v2/skin/skin-06-walk.png'), false, 'late B snapshot replaced C')
  await pageA.unroute('**/api/duo-v2/character-identity**')

  await pageA.getByRole('button', { name:/나가기/ }).click()
  await pageA.getByTestId('world-map').waitFor()
  await pageC.getByTestId('world-map').waitFor({ timeout:30_000 })
  await pageC.keyboard.press('ArrowRight')
  await expectLayer(pageA.getByTestId('duo-partner'), '/assets/character-v2/skin/skin-08-walk.png')
  await screenshot(pageA, 'clock-skew-before-save.png')

  await pageC.evaluate(() => {
    window.__stage4OriginalDateNow = Date.now
    Date.now = () => window.__stage4OriginalDateNow() + 600_000
  })
  await openStudio(pageC, { activeDuo:true })
  const cOnboarding = pageC.getByTestId('character-studio-onboarding')
  if (await cOnboarding.count()) await cOnboarding.getByRole('button', { name:'확인했어요' }).click()
  await saveIdentity(pageC, { skin:'skin_05', eyes:'eyes_pink', hairStyle:'hair_wavy', hairColor:'navy' })
  await pageC.evaluate(() => {
    Date.now = window.__stage4OriginalDateNow
    delete window.__stage4OriginalDateNow
  })
  await openWorld(pageC)
  await pageC.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:45_000 })
  await pageC.keyboard.press('ArrowLeft')
  await expectLayer(pageA.getByTestId('duo-partner'), '/assets/character-v2/skin/skin-05-walk.png')
  await screenshot(pageA, 'clock-skew-after-save.png')

  await contextA.setOffline(true)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'다시 연결하는 중' }).waitFor()
  await contextA.setOffline(false)
  await pageA.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:45_000 })
  await pageC.keyboard.press('ArrowRight')
  await expectLayer(pageA.getByTestId('duo-partner'), '/assets/character-v2/skin/skin-05-walk.png')
  await screenshot(pageA, 'ac-reconnect-latest-c-restored.png')

  await enterHome(pageA)
  await pageA.getByRole('button', { name:'초대', exact:true }).click()
  await pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' }).getByRole('button', { name:'실시간 세션 종료' }).click()
  await pageA.getByTestId('interior-duo-partner').waitFor({ state:'detached' })
  assert.equal(await pageA.getByTestId('interior-duo-partner').count(), 0)
  await screenshot(pageA, 'ac-ended-all-peer-state-cleared.png')

  await openStudio(pageA)
  assert.equal(await pageA.getByTestId('character-studio-onboarding').count(), 0, 'dismissed onboarding returned after navigation')

  for (const page of [pageA, pageB, pageC]) assert.equal(await page.locator('nextjs-portal').count(), 0, 'Next.js error overlay found')
  assert.deepEqual(errors.assets, [], `Character V2 asset failures:\n${errors.assets.join('\n')}`)
  assert.deepEqual(errors.page, [], `page errors:\n${errors.page.join('\n')}`)
  assert.deepEqual(errors.console, [], `console errors:\n${errors.console.join('\n')}`)
  assert(errors.duoHttp.every((entry) => /^(409|410|503) /.test(entry)), `unexpected Duo HTTP failures:\n${errors.duoHttp.join('\n')}`)
  assert(errors.duoNetworkConsole.every((entry) => /(?:409 \(Conflict\)|410 \(Gone\)|503 \(Service Unavailable\))/.test(entry)), `unexpected Duo network console failures:\n${errors.duoNetworkConsole.join('\n')}`)
  console.log('Stage 4 A-B to A-C isolation, skew-safe sync, reconnect, fallback, lifecycle, and onboarding E2E passed.')
} finally {
  for (const context of [contextC, contextB, contextA]) if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  if (users.length) {
    await admin.from('user_events').delete().in('participant_id', participantIds)
    await admin.from('study_sessions').delete().in('participant_id', participantIds)
    await admin.from('duo_v2_operation_results').delete().in('auth_user_id', users.map((user) => user.id))
    await admin.from('duo_v2_sessions').delete().in('host_auth_user_id', users.map((user) => user.id))
  }
  await admin.from('participant_economy_v1_rooms').delete().in('participant_id', participantIds)
  await admin.from('participant_catalog_items').delete().in('participant_id', participantIds)
  await admin.from('participant_village_wallets').delete().in('participant_id', participantIds)
  await admin.from('participant_multi_village_character_loadouts').delete().in('participant_id', participantIds)
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
