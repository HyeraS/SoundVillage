import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { WORLD_MUSEUM, WORLD_PORTALS } from '../../lib/worldMapGeometry.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const expectedMode = process.env.EXPECTED_ECONOMY_MODE
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey || !['legacy', 'preview', 'cutover', 'maintenance'].includes(expectedMode)) {
  throw new Error('Main-runtime browser environment is incomplete')
}
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authA = createClient(supabaseUrl, anonKey, options)
const authB = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantId = `MAIN_${expectedMode.toUpperCase()}_${suffix}`
const sourceParticipantId = `MAIN_SOURCE_${suffix}`
const reviewDir = path.resolve('_review/economy-v1-main-runtime-hardening')
const outfitAsset = '/assets/world/outfits/overalls.png'
const accessoryAsset = '/assets/character-v2/accessories/glasses-walk.png'
const characterLayers = ['/assets/world/player_body.png', outfitAsset, '/assets/world/player_hair.png', accessoryAsset]
let browser
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function screenshot(page, filename, locator = null) {
  const target = path.join(reviewDir, filename)
  if (locator) await locator.screenshot({ path: target })
  else await page.screenshot({ path: target, fullPage: true })
  assert((await fs.stat(target)).size > 500, `${filename} is empty`)
}

async function walletMap(id = participantId) {
  const rows = ok(await admin.from('participant_village_wallets').select('village,balance').eq('participant_id', id), 'wallet read')
  return Object.fromEntries(rows.map((row) => [row.village, Number(row.balance)]))
}

async function request(pathname, token, body) {
  const response = await fetch(new URL(pathname, appUrl), {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { response, body: await response.json() }
}

async function waitForLayerOrder(page) {
  await page.waitForFunction((expected) => {
    const refs = [...document.querySelectorAll('img,image')]
      .map((element) => element.getAttribute('src') || element.getAttribute('href') || '')
      .map((value) => { try { return new URL(value, location.href).pathname } catch { return value } })
    return refs.some((_, index) => expected.every((asset, offset) => refs[index + offset] === asset))
  }, characterLayers, { timeout: 20_000 })
}

async function waitForAssetPath(page, assetPath) {
  await page.waitForFunction((expected) => [...document.querySelectorAll('img,image')].some((element) => {
    const value = element.getAttribute('src') || element.getAttribute('href') || ''
    try { return new URL(value, location.href).pathname === expected } catch { return value === expected }
  }), assetPath, { timeout:20_000 })
}

function worldQuery(target, extra = {}) {
  return new URLSearchParams({
    worldStart: `${target.approach.x / 32},${target.approach.y / 32}`,
    ...extra,
  }).toString()
}

async function waitForWorld(page, query = '') {
  await page.goto(`${appUrl}/${query ? `?${query}` : ''}`, { waitUntil: 'domcontentloaded' })
  const world = page.getByTestId('world-map')
  await world.waitFor({ timeout: 30_000 })
  if (expectedMode === 'cutover') await page.getByLabel('여섯 마을 지갑').waitFor({ timeout: 20_000 })
  else await page.getByText('보유 화폐', { exact: true }).waitFor({ timeout: 20_000 })
  await world.filter({ has: page.locator('[data-testid="world-player"]') }).waitFor()
  return world
}

async function enterDestination(page, target, expected, extra = {}) {
  const world = await waitForWorld(page, worldQuery(target, extra))
  await page.waitForFunction((name) => document.querySelector('[data-testid="world-map"]')?.dataset.nearDestination === name, expected)
  await page.keyboard.press('Enter')
}

async function createContext(session, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
    localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  }, { key: storageKey, value: session })
  return context
}

async function assertBlockedBootstrapScenarios(session) {
  const scenarios = [
    ['bootstrap-http-503', 503, { ok:false, code:'storage_retryable', retryable:true }],
    ['bootstrap-auth-failure', 401, { ok:false, code:'auth_required' }],
    ['bootstrap-catalog-mismatch', 200, { ok:true, economyMode:'cutover', catalogVersion:'invalid-catalog' }],
    ['bootstrap-invalid-mode', 200, { ok:true, economyMode:'unsafe', catalogVersion:'soundvillage-launch-v1:1.1.0' }],
    ['bootstrap-missing-fields', 200, { ok:true, economyMode:'cutover', catalogVersion:'soundvillage-launch-v1:1.1.0', items:[], runtimeItems:[], profile:{} }],
    ['cutover-bootstrap-temporary-failure', 503, { ok:false, code:'storage_retryable', retryable:true }],
  ]
  for (const [name, status, payload] of scenarios) {
    const beforeWallets = await walletMap()
    const beforeLegacy = ok(await admin.from('participant_currency').select('balance').eq('participant_id', participantId).maybeSingle(), `${name} legacy before`)
    const context = await createContext(session)
    const page = await context.newPage()
    const mutationRequests = []
    page.on('request', (request) => {
      const url = request.url()
      if (request.method() === 'POST' && (
        /\/api\/economy-v1\/(annotation|vote|purchase|equip|attendance)/.test(url)
        || /submit_annotation_v4|submit_museum_vote_v4|ensure_today_check_in_v4/.test(url)
      )) mutationRequests.push(`${request.method()} ${url}`)
    })
    await page.route('**/api/economy-v1/bootstrap', (route) => route.fulfill({
      status,
      contentType:'application/json',
      body:JSON.stringify(payload),
    }))
    await page.goto(`${appUrl}/`, { waitUntil:'domcontentloaded' })
    await page.getByText('경제 상태를 확인하지 못했습니다. 저장을 진행하지 말고 다시 시도해 주세요', { exact:true }).waitFor({ timeout:30_000 })
    await page.waitForTimeout(250)
    assert.deepEqual(await walletMap(), beforeWallets, `${name} changed village wallets while blocked`)
    assert.deepEqual(ok(await admin.from('participant_currency').select('balance').eq('participant_id', participantId).maybeSingle(), `${name} legacy after`), beforeLegacy,
      `${name} changed legacy currency while blocked`)
    assert.deepEqual(mutationRequests, [], `${name} emitted an economy mutation while blocked`)
    if (name === 'bootstrap-http-503') await screenshot(page, 'blocked-economy-state.png')
    await page.unroute('**/api/economy-v1/bootstrap')
    await page.getByRole('button', { name:'경제 상태 다시 조회' }).click()
    await page.getByText('경제 상태를 확인하지 못했습니다. 저장을 진행하지 말고 다시 시도해 주세요', { exact:true }).waitFor({ state:'hidden', timeout:30_000 })
    await page.getByLabel('여섯 마을 지갑').waitFor({ timeout:20_000 })
    await context.close()
  }
}

try {
  await fs.mkdir(reviewDir, { recursive: true })
  const signedA = ok(await authA.auth.signInAnonymously(), 'main browser sign-in')
  userA = signedA.user
  ok(await admin.from('study_participants').insert({
    participant_id: participantId, auth_user_id: userA.id, group_id: 'A', status: 'active',
  }), 'main browser participant')

  browser = await chromium.launch({ headless: true })
  const context = await createContext(signedA.session)
  const page = await context.newPage()
  const assetFailures = []
  page.on('response', (response) => {
    if (response.url().includes('/assets/') && response.status() >= 400) assetFailures.push(`${response.status()} ${response.url()}`)
  })

  if (expectedMode === 'legacy' || expectedMode === 'preview') {
    if (expectedMode === 'preview') {
      ok(await admin.from('participant_outfits').insert({ participant_id:participantId, outfit_id:'overalls' }), 'preview legacy outfit ownership')
      ok(await admin.from('participant_equipped_outfit').insert({ participant_id:participantId, outfit_id:'overalls' }), 'preview legacy equipped outfit')
    }
    await page.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('world-map').waitFor({ timeout: 30_000 })
    await page.getByText('보유 화폐', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('여섯 마을 지갑').count(), 0)
    if (expectedMode === 'preview') {
      await waitForAssetPath(page, outfitAsset)
      await page.getByText(/출석 완료! 연속/).waitFor({ timeout:20_000 })
      const attendance = ok(await admin.from('participant_attendance').select('*').eq('participant_id', participantId), 'preview legacy attendance')
      assert.equal(attendance.length, 1, 'preview main must keep legacy automatic attendance')
    }
    await page.waitForTimeout(1_000)
    assert.equal(ok(await admin.from('participant_village_wallets').select('*').eq('participant_id', participantId), 'legacy wallets').length, 0,
      'flag OFF must not initialize village wallets')
    await screenshot(page, expectedMode === 'preview' ? 'preview-legacy-main-hud.png' : 'legacy-flag-off-main.png')
    console.log(`${expectedMode} main-runtime legacy behavior browser check passed.`)
  } else if (expectedMode === 'maintenance') {
    await page.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('world-map').waitFor({ timeout:30_000 })
    await page.getByRole('alertdialog', { name:'경제 시스템 점검 중' }).waitFor({ timeout:20_000 })
    assert.equal(ok(await admin.from('participant_village_wallets').select('*').eq('participant_id', participantId), 'maintenance wallets').length, 0)
    assert.equal(ok(await admin.from('participant_attendance').select('*').eq('participant_id', participantId), 'maintenance attendance').length, 0)
    await screenshot(page, 'maintenance-economy-notice.png')
    console.log('Maintenance write-blocking browser check passed.')
  } else {
    const signedB = ok(await authB.auth.signInAnonymously(), 'source browser sign-in')
    userB = signedB.user
    ok(await admin.from('study_participants').insert({
      participant_id: sourceParticipantId, auth_user_id: userB.id, group_id: 'B', status: 'active',
    }), 'source participant')
    ok(await authB.rpc('start_or_resume_study_session_v2', { p_client_instance_id: crypto.randomUUID() }), 'source session')

    ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id: userA.id }), 'initialize main profile')
    ok(await admin.from('participant_village_wallets').update({ balance: 30 }).eq('participant_id', participantId), 'fund main wallets')
    ok(await admin.from('participant_catalog_items').insert([
      { participant_id: participantId, item_id: 'overalls', acquisition_source: 'individual_purchase' },
      { participant_id: participantId, item_id: 'acc_glasses', acquisition_source: 'individual_purchase' },
    ]), 'seed owned Character items')
    ok(await admin.from('participant_multi_village_character_loadouts').update({
      outfit_id: 'overalls', accessory_id: 'acc_glasses',
    }).eq('participant_id', participantId), 'seed main loadout')

    const groupBSound = ok(await admin.from('study_sound_catalog').select('sound_id,zone').eq('group_id', 'B').order('sound_id').limit(1).single(), 'group B sound')
    const sourceAnnotation = ok(await admin.rpc('submit_annotation_economy_v1_admin', {
      p_auth_user_id: userB.id,
      p_idempotency_key: crypto.randomUUID(),
      p_sound_id: groupBSound.sound_id,
      p_zone: groupBSound.zone,
      p_expression_text: '브라우저 투표 원본',
      p_confidence: 3,
      p_play_count: 1,
      p_listening_time_sec: 1,
    }), 'source annotation')

    const world = await waitForWorld(page)
    for (const village of ['동물', '인간', '자연', '도시', '음악', '연구']) {
      await page.getByLabel(new RegExp(`^${village} 화폐 30개$`)).waitFor()
    }
    assert.equal(await page.getByText('보유 화폐', { exact: true }).count(), 0)
    await waitForLayerOrder(page)
    await screenshot(page, 'main-world-six-wallet-hud.png')
    await screenshot(page, 'main-world-outfit-accessory.png', world.locator('[data-testid="world-player"]'))

    await page.getByRole('button', { name: '출석 보상 열기' }).click()
    await page.getByLabel('📅 주간 출석').waitFor()
    await screenshot(page, 'main-attendance-panel.png')
    const beforeClaim = await walletMap()
    const claimButton = page.getByRole('button', { name: '오늘 출석 보상 받기' })
    if (await claimButton.isEnabled()) {
      await claimButton.click()
      await page.getByRole('status').filter({ hasText: /화폐 \d+개를 받았어요/ }).waitFor()
      const afterClaim = await walletMap()
      assert.equal(Object.values(afterClaim).reduce((sum, value) => sum + value, 0)
        - Object.values(beforeClaim).reduce((sum, value) => sum + value, 0) > 0, true)
    }

    for (const portal of WORLD_PORTALS) {
      await enterDestination(page, portal, portal.zone)
      await page.locator(`[data-zone-hud="${portal.zone}"]`).waitFor({ timeout: 30_000 })
      await waitForLayerOrder(page)
      await screenshot(page, `village-${portal.zone.toLowerCase()}-same-loadout.png`)
    }

    await enterDestination(page, WORLD_MUSEUM, 'Sound Library')
    await page.getByTestId('museum-player').waitFor({ timeout: 30_000 })
    await waitForLayerOrder(page)
    await screenshot(page, 'sound-library-same-loadout.png')

    await enterDestination(page, WORLD_MUSEUM, 'Sound Library', { libraryQaCard: 'shop' })
    await page.getByLabel('Character 상점').waitFor({ timeout: 30_000 })
    assert.equal(await page.getByTestId(/^shop-item-/).count(), 19)
    await screenshot(page, 'main-character-shop-outfits.png')
    await page.getByTestId('shop-item-sailor').getByRole('button', { name:'세일러 룩 미리보기' }).click()
    await page.getByTestId('museum-player').locator('img[src="/assets/world/outfits/sailor.png"]').waitFor()
    await screenshot(page, 'shop-live-outfit-preview.png')
    const outfitTab = page.getByRole('tab', { name:/의상 18/ })
    await outfitTab.focus()
    await page.keyboard.press('ArrowRight')
    const accessoryTab = page.getByRole('tab', { name:/액세서리 8/ })
    assert.equal(await accessoryTab.getAttribute('aria-selected'), 'true')
    assert.equal(await accessoryTab.evaluate((element) => element === document.activeElement), true)
    await screenshot(page, 'shop-keyboard-focus.png')
    assert.equal(await page.getByTestId(/^shop-item-/).count(), 8)
    await page.getByTestId('shop-item-acc_sunglasses').getByRole('button', { name:'선글라스 미리보기' }).click()
    await page.getByTestId('museum-player').locator('img[src="/assets/character-v2/accessories/sunglasses-walk.png"]').waitFor()
    await screenshot(page, 'shop-live-accessory-preview.png')
    await page.setViewportSize({ width:390, height:844 })
    await screenshot(page, 'mobile-shop-preview.png')
    await page.setViewportSize({ width:1440, height:1000 })
    await screenshot(page, 'main-character-shop-accessories.png')
    await page.getByRole('button', { name:'🛍 옷가게 닫기' }).click()
    await page.getByTestId('museum-player').locator(`img[src="${outfitAsset}"]`).waitFor()
    await page.getByTestId('museum-player').locator(`img[src="${accessoryAsset}"]`).waitFor()
    assert.equal(await page.getByTestId('museum-player').locator('img[src="/assets/character-v2/accessories/sunglasses-walk.png"]').count(), 0)

    ok(await admin.from('participant_village_wallets').update({ balance: 0 }).eq('participant_id', participantId), 'empty wallets')
    await enterDestination(page, WORLD_MUSEUM, 'Sound Library', { libraryQaCard: 'shop' })
    const shortage = page.getByTestId('shop-item-sailor')
    await shortage.getByRole('button', { name: /구매 불가:/ }).waitFor()
    assert.match(await shortage.getByRole('button').last().getAttribute('aria-label'), /인간.*자연.*도시.*음악/)
    await screenshot(page, 'main-character-shop-insufficient.png')

    ok(await admin.from('participant_village_wallets').update({ balance: 30 }).eq('participant_id', participantId), 'refill wallets')
    await enterDestination(page, WORLD_MUSEUM, 'Sound Library', { libraryQaCard: 'shop' })
    const sailorBuy = page.getByTestId('shop-item-sailor').getByRole('button', { name: '구매하기' })
    await sailorBuy.click()
    const purchasePrimary = page.getByRole('button', { name: '구매하고 장착' })
    await purchasePrimary.waitFor()
    assert.equal(await purchasePrimary.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.activeElement?.closest('[data-testid="shop-item-sailor"]'))
    await sailorBuy.click()
    const purchaseKeys = []
    let retryableFailurePending = true
    await page.route('**/api/economy-v1/purchase', async (route) => {
      purchaseKeys.push(route.request().postDataJSON().idempotencyKey)
      if (retryableFailurePending) {
        retryableFailurePending = false
        await route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ ok:false, code:'storage_retryable', retryable:true }) })
      } else await route.continue()
    })
    await page.getByRole('button', { name: '구매하고 장착' }).click()
    await page.getByRole('alert').filter({ hasText:'같은 요청으로 안전하게 다시 시도' }).waitFor()
    await screenshot(page, 'purchase-modal-network-retry.png')
    await page.getByRole('button', { name:'같은 요청 재시도' }).click()
    await page.getByRole('status').filter({ hasText: '세일러 룩 구매 및 장착 완료' }).waitFor()
    await page.unroute('**/api/economy-v1/purchase')
    assert.equal(purchaseKeys.length, 2)
    assert.equal(purchaseKeys[0], purchaseKeys[1], 'retryable purchase must retain the UUID')
    await page.waitForFunction(() => document.activeElement?.closest('[data-testid="shop-item-sailor"]'))
    const equipped = ok(await admin.from('participant_multi_village_character_loadouts').select('outfit_id,accessory_id').eq('participant_id', participantId).single(), 'purchased loadout')
    assert.deepEqual(equipped, { outfit_id: 'sailor', accessory_id: 'acc_glasses' })
    await screenshot(page, 'main-character-shop-purchase-and-equip.png')

    ok(await admin.from('participant_village_wallets').update({ balance:30 }).eq('participant_id', participantId), 'refill wallets for reused key')
    await enterDestination(page, WORLD_MUSEUM, 'Sound Library', { libraryQaCard:'shop' })
    const sportyBuy = page.getByTestId('shop-item-sporty').getByRole('button', { name:'구매하기' })
    const reusedKeys = []
    let reusedFailurePending = true
    await page.route('**/api/economy-v1/purchase', async (route) => {
      reusedKeys.push(route.request().postDataJSON().idempotencyKey)
      if (reusedFailurePending) {
        reusedFailurePending = false
        await route.fulfill({ status:409, contentType:'application/json', body:JSON.stringify({ ok:false, code:'idempotency_key_reused', retryable:false }) })
      } else await route.continue()
    })
    await sportyBuy.click()
    await page.getByRole('button', { name:'구매하고 장착' }).click()
    await page.getByRole('alert').filter({ hasText:'새 요청으로 다시 시도' }).waitFor()
    await screenshot(page, 'purchase-modal-reused-key.png')
    await page.getByRole('button', { name:'구매하고 장착' }).click()
    await page.getByRole('status').filter({ hasText:'스포티 세트 구매 및 장착 완료' }).waitFor()
    await page.unroute('**/api/economy-v1/purchase')
    assert.equal(reusedKeys.length, 2)
    assert.notEqual(reusedKeys[0], reusedKeys[1], 'reused purchase key must be discarded before retry')

    const groupASound = ok(await admin.from('study_sound_catalog').select('sound_id,zone').eq('group_id', 'A').order('sound_id').limit(1).single(), 'group A sound')
    const beforeAnnotation = await walletMap()
    const annotation = await request('/api/economy-v1/annotation', signedA.session.access_token, {
      idempotencyKey: crypto.randomUUID(),
      soundId: groupASound.sound_id,
      expressionText: '메인 런타임 브라우저 전사',
      confidence: 3,
      playCount: 1,
      listeningTimeSec: 1,
    })
    assert.equal(annotation.response.status, 200)
    assert.equal(annotation.body.reward.awarded, 5)
    assert.equal(annotation.body.reward.village, groupASound.zone)
    assert.equal(annotation.body.reward.balances[groupASound.zone], beforeAnnotation[groupASound.zone] + 5)
    await waitForWorld(page)
    await page.getByLabel(new RegExp(`화폐 ${beforeAnnotation[groupASound.zone] + 5}개$`)).first().waitFor()
    await screenshot(page, 'annotation-reward-village-plus-5.png')

    const beforeVote = await walletMap()
    const vote = await request('/api/economy-v1/vote', signedA.session.access_token, {
      idempotencyKey: crypto.randomUUID(),
      soundId: groupBSound.sound_id,
      annotationId: sourceAnnotation.annotationId,
      confidence: 3,
      playCount: 1,
      listeningTimeSec: 1,
    })
    assert.equal(vote.response.status, 200)
    assert.equal(vote.body.reward.awarded, 2)
    assert.equal(vote.body.reward.village, groupBSound.zone)
    assert.equal(vote.body.reward.balances[groupBSound.zone], beforeVote[groupBSound.zone] + 2)
    await waitForWorld(page)
    await page.getByLabel(new RegExp(`화폐 ${beforeVote[groupBSound.zone] + 2}개$`)).first().waitFor()
    await screenshot(page, 'vote-reward-village-plus-2.png')

    await assertBlockedBootstrapScenarios(signedA.session)

    await page.setViewportSize({ width: 844, height: 390 })
    await waitForWorld(page)
    assert((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1)
    await screenshot(page, 'main-mobile-844x390.png')
    await page.setViewportSize({ width: 390, height: 844 })
    await waitForWorld(page)
    assert((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1)
    await screenshot(page, 'main-mobile-390x844.png')

    assert.deepEqual(assetFailures, [], `asset request failures:\n${assetFailures.join('\n')}`)
    const required = [
      'main-world-six-wallet-hud.png', 'main-world-outfit-accessory.png',
      ...WORLD_PORTALS.map((portal) => `village-${portal.zone.toLowerCase()}-same-loadout.png`),
      'sound-library-same-loadout.png', 'main-character-shop-outfits.png',
      'main-character-shop-accessories.png', 'main-character-shop-insufficient.png',
      'main-character-shop-purchase-and-equip.png', 'main-attendance-panel.png',
      'shop-live-outfit-preview.png', 'shop-live-accessory-preview.png', 'mobile-shop-preview.png',
      'shop-keyboard-focus.png', 'purchase-modal-network-retry.png', 'purchase-modal-reused-key.png',
      'blocked-economy-state.png',
      'annotation-reward-village-plus-5.png', 'vote-reward-village-plus-2.png',
      'main-mobile-844x390.png', 'main-mobile-390x844.png',
    ]
    for (const filename of required) assert((await fs.stat(path.join(reviewDir, filename))).size > 500, `${filename} missing`)
    console.log('Cutover main-runtime browser E2E and review captures passed.')
  }
} finally {
  if (browser) await browser.close().catch(() => {})
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
