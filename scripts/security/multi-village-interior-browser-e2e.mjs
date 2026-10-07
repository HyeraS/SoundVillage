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
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey) throw new Error('Local Interior browser environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authA = createClient(supabaseUrl, anonKey, options)
const authB = createClient(supabaseUrl, anonKey, options)
const catalog = JSON.parse(await fs.readFile(new URL('../../data/economy/catalog-v1.json', import.meta.url), 'utf8'))
const approvedItems = catalog.items.filter((item) => item.productGroup === 'interior'
  && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
const approvedSets = catalog.items.filter((item) => item.type === 'theme_set'
  && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
const pendingIds = catalog.items.filter((item) => item.officialStoreStatus === 'pending_interior_review').map((item) => item.id)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `INTERIOR_BROWSER_A_${suffix}`
const participantB = `INTERIOR_BROWSER_B_${suffix}`
const reviewDir = path.resolve('_review/economy-v1-interior-cutover')
let browser
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function screenshot(page, filename, locator = null, fullPage = true) {
  const target = path.join(reviewDir, filename)
  if (locator) await locator.screenshot({ path:target })
  else await page.screenshot({ path:target, fullPage })
  assert((await fs.stat(target)).size > 500, `${filename} is empty`)
}

async function captureStarterEntitlements(context) {
  const page = await context.newPage()
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:32px;background:#ead7b0;color:#35271e;font:700 18px system-ui}
    h1{font-size:24px;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(2,220px);gap:24px}
    figure{margin:0;padding:18px;background:#fff8e8;border:4px solid #35271e;box-shadow:7px 7px #8e6a4c}
    img{width:192px;height:192px;object-fit:fill;image-rendering:pixelated;border:2px solid #6d4c36}
    figcaption{margin-top:12px;line-height:1.4}.note{font-weight:500;font-size:14px;margin-top:18px;max-width:480px}
  </style><h1>Economy v1 starter entitlements</h1><div class="grid">
    <figure><img src="${new URL('/assets/interior/starter_wall_neutral.png', appUrl)}"><figcaption>starter_wall_neutral<br>기본 중성 벽지</figcaption></figure>
    <figure><img src="${new URL('/assets/interior/starter_floor_beige.png', appUrl)}"><figcaption>starter_floor_beige<br>기본 베이지 바닥</figcaption></figure>
  </div><p class="note">무료 시작 전용 · 상점 및 초대 고유 아이템 수에서 제외 · provisional locally-authored assets</p>`)
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
  await screenshot(page, 'starter-entitlements.png')
  await page.close()
}

async function createContext(session, viewport = { width:1280, height:720 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor:1, permissions:['clipboard-read','clipboard-write'] })
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(({ key, value }) => {
    let clipboardText = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => { clipboardText = String(text) },
        readText: async () => clipboardText,
      },
    })
    localStorage.setItem(key, JSON.stringify(value))
    localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  }, { key:storageKey, value:session })
  return context
}

async function enterHome(page, target = appUrl) {
  await page.goto(target, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:30_000 })
  await page.getByRole('button', { name:'우리 집 꾸미기 열기' }).click()
  const room = page.locator('[data-interior-room="ready"]')
  await room.waitFor({ timeout:30_000 })
  return room
}

async function walletMap(participantId = participantA) {
  const rows = ok(await admin.from('participant_village_wallets').select('village,balance')
    .eq('participant_id', participantId), 'wallet read')
  return Object.fromEntries(rows.map((row) => [row.village, Number(row.balance)]))
}

async function setBalances(value, participantId = participantA) {
  ok(await admin.from('participant_village_wallets').update({ balance:value })
    .eq('participant_id', participantId), `set balances ${value}`)
}

async function api(pathname, token, body) {
  const response = await fetch(new URL(pathname, appUrl), {
    method:body ? 'POST' : 'GET',
    headers:{ authorization:`Bearer ${token}`, ...(body ? { 'content-type':'application/json' } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {}),
  })
  return { status:response.status, body:await response.json() }
}

async function openShop(page) {
  const trigger = page.getByRole('button', { name:'상점', exact:true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name:'인테리어 상점' })
  await dialog.waitFor()
  return { trigger, dialog }
}

async function buyAndPlace(page, itemId, cellName) {
  const { dialog } = await openShop(page)
  const card = dialog.locator(`[data-interior-shop-item="${itemId}"]`)
  const buy = card.getByRole('button', { name:'구매하기' })
  await buy.focus()
  await page.keyboard.press('Enter')
  const reward = page.getByRole('dialog', { name:approvedItems.find((item) => item.id === itemId).name })
  await reward.getByRole('button', { name:'바로 놓기' }).focus()
  await page.keyboard.press('Enter')
  await reward.waitFor({ state:'hidden' })
  await dialog.waitFor({ state:'hidden' })
  const cell = page.getByRole('button', { name:cellName })
  await cell.focus()
  await page.keyboard.press('Enter')
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  const signedA = ok(await authA.auth.signInAnonymously(), 'browser sign-in A')
  const signedB = ok(await authB.auth.signInAnonymously(), 'browser sign-in B')
  userA = signedA.user
  userB = signedB.user
  ok(await admin.from('study_participants').insert([
    { participant_id:participantA, auth_user_id:userA.id, group_id:'A', status:'active' },
    { participant_id:participantB, auth_user_id:userB.id, group_id:'B', status:'active' },
  ]), 'create browser participants')
  ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userA.id }), 'initialize A Economy profile')
  ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userB.id }), 'initialize B Economy profile')
  await setBalances(0)

  const insufficientItem = approvedItems.find((item) => Object.values(item.cost).some((value) => value > 0))
  const beforeInsufficient = await walletMap()
  const insufficient = await api('/api/economy-v1/purchase', signedA.session.access_token, {
    itemId:insufficientItem.id, idempotencyKey:crypto.randomUUID(),
  })
  assert.equal(insufficient.status, 409)
  assert.equal(insufficient.body.code, 'insufficient_funds')
  assert.deepEqual(await walletMap(), beforeInsufficient)

  browser = await chromium.launch({ headless:true })
  const contextA = await createContext(signedA.session)
  await captureStarterEntitlements(contextA)
  const pageA = await contextA.newPage()
  const forbiddenInteriorRequests = []
  pageA.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'POST' && (
      pathname === '/api/economy-v1/equip'
      || pathname === '/api/participant-purchase'
      || /\/rest\/v1\/rpc\/(?:secure_purchase|save_participant_room)/.test(pathname)
    )) forbiddenInteriorRequests.push(`${request.method()} ${pathname}`)
  })
  let roomA = await enterHome(pageA)
  assert.equal(await roomA.getAttribute('data-room-wallpaper'), 'starter_wall_neutral')
  assert.equal(await roomA.getAttribute('data-room-floor'), 'starter_floor_beige')
  assert.equal(await roomA.getAttribute('data-room-revision'), '0')
  await screenshot(pageA, 'desktop-interior-room.png')
  const roomWallet = pageA.getByLabel('여섯 마을 지갑').first()
  await roomWallet.waitFor()
  assert.equal(await roomWallet.locator('strong').count(), 6)
  let shop = await openShop(pageA)
  assert.equal(await shop.dialog.locator('[data-interior-shop-item]').count(), 40)
  assert.equal(await shop.dialog.locator('[data-interior-shop-set]').count(), 3)
  assert.equal(await shop.dialog.getByText(/SALE|오늘의 특가|♪/).count(), 0)
  for (const pendingId of pendingIds) assert.equal(await shop.dialog.locator(`[data-interior-shop-item="${pendingId}"]`).count(), 0)
  assert.equal(await shop.dialog.locator(`[data-interior-shop-item="${insufficientItem.id}"] button`).isDisabled(), true)
  await screenshot(pageA, 'desktop-interior-shop-items.png', shop.dialog)
  await screenshot(pageA, 'desktop-interior-shop-sets.png', shop.dialog.locator('[data-interior-shop-set]').first().locator('..'))
  await screenshot(pageA, 'desktop-insufficient-wallets.png', shop.dialog.locator(`[data-interior-shop-item="${insufficientItem.id}"]`))
  assert.equal(await shop.dialog.getAttribute('aria-modal'), 'true')
  const closeButton = shop.dialog.getByRole('button', { name:'인테리어 상점 닫기' })
  assert.equal(await closeButton.evaluate((element) => element === document.activeElement), true)
  await pageA.keyboard.press('Shift+Tab')
  assert.equal(await shop.dialog.evaluate((element) => element.contains(document.activeElement)), true, 'shop focus escaped')
  await pageA.keyboard.press('Escape')
  await shop.dialog.waitFor({ state:'hidden' })
  await pageA.waitForFunction(() => document.activeElement?.textContent?.trim() === '상점')
  assert.equal(await pageA.evaluate(() => document.activeElement?.textContent?.trim()), '상점', 'shop focus was not restored')

  await setBalances(200)
  await pageA.getByRole('button', { name:/나가기/ }).click()
  roomA = await enterHome(pageA)
  for (const viewport of [{ width:844,height:390 }, { width:390,height:844 }, { width:768,height:1024 }, { width:1280,height:720 }]) {
    await pageA.setViewportSize(viewport)
    const overflow = await pageA.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert(overflow <= 1, `${viewport.width}x${viewport.height} Interior layout overflows by ${overflow}px`)
    if (viewport.width === 844) await screenshot(pageA, 'mobile-landscape.png', null, false)
    if (viewport.width === 390) await screenshot(pageA, 'mobile-portrait.png', null, false)
  }

  const item = approvedItems.find((candidate) => candidate.id === 'wp_night')
  const walletsBeforeItem = await walletMap()
  shop = await openShop(pageA)
  const itemButton = shop.dialog.locator(`[data-interior-shop-item="${item.id}"]`).getByRole('button', { name:'구매하기' })
  await itemButton.focus()
  await pageA.keyboard.press('Enter')
  const reward = pageA.getByRole('dialog', { name:item.name })
  await reward.getByRole('button', { name:'보관함에 넣기' }).focus()
  await pageA.keyboard.press('Enter')
  await reward.waitFor({ state:'hidden' })
  await shop.dialog.waitFor()
  const walletsAfterItem = await walletMap()
  for (const [village, amount] of Object.entries(item.cost)) {
    assert.equal(walletsAfterItem[village], walletsBeforeItem[village] - amount, `${village} item debit mismatch`)
  }
  await screenshot(pageA, 'desktop-item-purchased.png')
  assert.equal(await shop.dialog.locator(`[data-interior-shop-item="${item.id}"]`).getByRole('button', { name:'보유 중' }).isDisabled(), true)
  const nightSet = shop.dialog.locator('[data-interior-shop-set="set_night"]')
  const partialSetButton = nightSet.getByRole('button', { name:'부분 보유 · 구매 불가' })
  await partialSetButton.waitFor({ timeout:60_000 })
  assert.equal(await partialSetButton.isDisabled(), true)
  await screenshot(pageA, 'desktop-bundle-partially-owned.png', nightSet)
  console.log('Interior browser checkpoint: individual purchase and partial-set policy passed.')
  await pageA.keyboard.press('Escape')
  const duplicateItem = await api('/api/economy-v1/purchase', signedA.session.access_token, {
    itemId:item.id, idempotencyKey:crypto.randomUUID(),
  })
  assert.equal(duplicateItem.status, 409)
  assert.equal(duplicateItem.body.code, 'already_owned')
  const partialSet = await api('/api/economy-v1/purchase', signedA.session.access_token, {
    itemId:'set_night', idempotencyKey:crypto.randomUUID(),
  })
  assert.equal(partialSet.status, 409)
  assert.equal(partialSet.body.code, 'bundle_partially_owned')

  const nightSetProjection = approvedSets.find((candidate) => candidate.id === 'set_night')
  for (const itemId of nightSetProjection.bundleItemIds.filter((itemId) => itemId !== item.id)) {
    const collected = await api('/api/economy-v1/purchase', signedA.session.access_token, {
      itemId, idempotencyKey:crypto.randomUUID(),
    })
    assert.equal(collected.status, 200)
    assert.equal(collected.body.code, 'success')
  }
  const completionRows = ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantA), 'individual collection completion ownership')
  assert.equal(completionRows.some((row) => row.item_id.startsWith('placeholder_completion_asset_')
    || row.item_id.startsWith('completion_reward_')), false)
  await pageA.reload({ waitUntil:'domcontentloaded' })
  roomA = await enterHome(pageA)
  shop = await openShop(pageA)
  const completeNightSet = shop.dialog.locator('[data-interior-shop-set="set_night"]')
  const applyNightSet = completeNightSet.getByRole('button', { name:'방에 적용하기' })
  await applyNightSet.waitFor()
  await screenshot(pageA, 'desktop-bundle-complete-apply.png', completeNightSet)
  await applyNightSet.click()
  assert.equal(await roomA.getAttribute('data-interior-mode'), 'edit')
  await pageA.getByRole('button', { name:'되돌리기' }).click()

  const set = approvedSets.find((candidate) => candidate.id === 'set_clover')
  const walletsBeforeSet = await walletMap()
  shop = await openShop(pageA)
  const setButton = shop.dialog.locator('[data-interior-shop-set="set_clover"]').getByRole('button', { name:'세트 구매하기' })
  await setButton.focus()
  await pageA.keyboard.press('Enter')
  await roomA.waitFor()
  await pageA.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'edit')
  const walletsAfterSet = await walletMap()
  for (const [village, amount] of Object.entries(set.cost)) {
    assert.equal(walletsAfterSet[village], walletsBeforeSet[village] - amount, `${village} set debit mismatch`)
  }
  const setOwnership = ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantA).in('item_id', set.bundleItemIds), 'set ownership')
  assert.equal(setOwnership.length, set.bundleItemIds.length)
  console.log('Interior browser checkpoint: collection completion and set purchase passed.')

  const saveBodies = []
  let failSave = true
  await pageA.route('**/api/economy-v1/room', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    saveBodies.push(route.request().postDataJSON())
    if (failSave) {
      failSave = false
      return route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ ok:false, code:'storage_retryable', retryable:true }) })
    }
    return route.continue()
  })
  const itemCountBeforeFailure = await roomA.getAttribute('data-room-item-count')
  await pageA.getByRole('button', { name:'저장하기' }).click()
  await pageA.getByText('저장에 실패했어요. 다시 시도해주세요').waitFor()
  assert.equal(await roomA.getAttribute('data-interior-mode'), 'edit')
  assert.equal(await roomA.getAttribute('data-room-item-count'), itemCountBeforeFailure)
  await pageA.getByRole('button', { name:'저장하기' }).click()
  await pageA.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'view')
  assert.equal(saveBodies.length, 2)
  assert.equal(saveBodies[0].idempotencyKey, saveBodies[1].idempotencyKey, 'room retry must retain its key')
  await pageA.unroute('**/api/economy-v1/room')
  const savedRevision = Number(await roomA.getAttribute('data-room-revision'))
  const savedCount = Number(await roomA.getAttribute('data-room-item-count'))
  assert(savedRevision >= 1)
  await pageA.getByRole('button', { name:/나가기/ }).click()
  roomA = await enterHome(pageA)
  assert.equal(Number(await roomA.getAttribute('data-room-revision')), savedRevision)
  assert.equal(Number(await roomA.getAttribute('data-room-item-count')), savedCount)

  const reusedSaveBodies = []
  let reusedSaveInjected = false
  let reusedRecoveryReads = 0
  await pageA.route('**/api/economy-v1/room', async (route) => {
    if (route.request().method() === 'GET') {
      reusedRecoveryReads += 1
      return route.continue()
    }
    reusedSaveBodies.push(route.request().postDataJSON())
    if (!reusedSaveInjected) {
      reusedSaveInjected = true
      return route.fulfill({ status:409, contentType:'application/json', body:JSON.stringify({ ok:false, code:'idempotency_key_reused', retryable:false }) })
    }
    return route.continue()
  })
  await pageA.getByRole('button', { name:'꾸미기 시작' }).click()
  await pageA.getByRole('button', { name:'저장하기' }).click()
  await pageA.getByText('저장 요청 상태를 다시 확인하고 최신 방을 불러왔어요').waitFor()
  assert.equal(await roomA.getAttribute('data-interior-mode'), 'view')
  assert(reusedRecoveryReads >= 1, 'reused room-save key must re-read the latest room')
  await pageA.getByRole('button', { name:'꾸미기 시작' }).click()
  await pageA.getByRole('button', { name:'저장하기' }).click()
  await pageA.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'view')
  assert.equal(reusedSaveBodies.length, 2)
  assert.notEqual(reusedSaveBodies[0].idempotencyKey, reusedSaveBodies[1].idempotencyKey,
    'reused room-save key must be discarded before the next save')
  await pageA.unroute('**/api/economy-v1/room')

  await pageA.getByRole('button', { name:'꾸미기 시작' }).click()
  await buyAndPlace(pageA, 'plant_tall', '바닥 1행 1열에 배치')
  const plantTray = pageA.getByRole('button', { name:/^키 큰 화분/ })
  await plantTray.focus()
  await pageA.keyboard.press('Enter')
  const secondPlantCell = pageA.getByRole('button', { name:'바닥 1행 2열에 배치' })
  await secondPlantCell.focus()
  await pageA.keyboard.press('Enter')
  await pageA.getByText(/현재 2종/).waitFor()
  await pageA.getByRole('button', { name:'저장하기' }).press('Enter')
  await pageA.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'view')
  await pageA.getByText(/현재 3종/).waitFor()
  await screenshot(pageA, 'desktop-invite-progress-duplicate.png')

  await pageA.getByRole('button', { name:'꾸미기 시작' }).click()
  await buyAndPlace(pageA, 'books', '바닥 1행 3열에 배치')
  await pageA.getByText(/현재 3종/).waitFor()
  await pageA.getByRole('button', { name:'저장하기' }).click()
  await pageA.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'view')
  await pageA.getByRole('button', { name:'초대', exact:true }).waitFor()
  await screenshot(pageA, 'desktop-invite-ready-four-unique.png')
  console.log('Interior browser checkpoint: room persistence, retry, and unique-count invitation passed.')

  const inviteButton = pageA.getByRole('button', { name:'초대', exact:true })
  await inviteButton.click()
  const inviteDialog = pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' })
  await inviteDialog.waitFor()
  const copyInviteButton = inviteDialog.getByRole('button', { name:'링크 복사' })
  await copyInviteButton.waitFor()
  const displayedInviteUrl = await inviteDialog.getByTestId('invite-url').textContent()
  assert.equal(displayedInviteUrl, '저장된 방 링크 준비됨')
  await pageA.evaluate(() => {
    window.__capturedInviteUrl = null
    Object.defineProperty(navigator, 'clipboard', {
      configurable:true,
      value:{ writeText:async (value) => { window.__capturedInviteUrl = value } },
    })
  })
  await copyInviteButton.click()
  await pageA.waitForFunction(() => window.__capturedInviteUrl?.includes('?house='))
  assert.match(await pageA.evaluate(() => window.__capturedInviteUrl), /^http:\/\/127\.0\.0\.1:\d+\/\?house=[0-9a-f-]{36}$/)
  await inviteDialog.getByRole('button', { name:'복사됨' }).waitFor()
  await inviteDialog.getByRole('button', { name:'닫기' }).click()
  await inviteDialog.waitFor({ state:'hidden' })
  await screenshot(pageA, 'desktop-invite-closed.png')
  await pageA.waitForFunction(() => document.activeElement?.textContent?.trim() === '초대')
  assert.equal(await pageA.evaluate(() => document.activeElement?.textContent?.trim()), '초대', 'invite focus was not restored')
  const shareRow = ok(await admin.from('participant_economy_v1_room_shares').select('share_token')
    .eq('participant_id', participantA).single(), 'read local share token')
  const sharedResponse = await api(`/api/economy-v1/shared-room?token=${encodeURIComponent(shareRow.share_token)}`,
    signedB.session.access_token)
  assert.equal(sharedResponse.status, 200)
  const serializedShared = JSON.stringify(sharedResponse.body)
  assert.equal(serializedShared.includes(participantA), false)
  assert.equal(serializedShared.includes(shareRow.share_token), false)
  await screenshot(pageA, 'desktop-shared-response-verified.png')
  const ownerBeforeVisit = ok(await admin.from('participant_economy_v1_rooms').select('room,revision')
    .eq('participant_id', participantA).single(), 'owner room before visit')

  // This cutover covers the persisted, read-only visitor contract. Take the
  // owner offline before opening the share so the unrelated Realtime/Duo probe
  // cannot redirect the visitor into a live-session path.
  await pageA.waitForTimeout(5_500)
  await contextA.close()
  await new Promise((resolve) => setTimeout(resolve, 2_000))

  const contextB = await createContext(signedB.session, { width:844,height:390 })
  const pageB = await contextB.newPage()
  const visitorMutations = []
  pageB.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'POST' && (
      pathname.startsWith('/api/economy-v1/')
      || pathname === '/api/participant-purchase'
      || /\/rest\/v1\/rpc\/(?:secure_purchase|save_participant_room)/.test(pathname)
    )) visitorMutations.push(`${request.method()} ${pathname}`)
  })
  await pageB.goto(`${appUrl}/?house=${encodeURIComponent(shareRow.share_token)}`, { waitUntil:'domcontentloaded' })
  const visitorRoom = pageB.locator('[data-interior-room="ready"][data-room-visitor="true"]')
  await visitorRoom.waitFor({ timeout:30_000 })
  assert.equal(await pageB.getByRole('button', { name:'상점', exact:true }).count(), 0)
  assert.equal(await pageB.getByRole('button', { name:'꾸미기 시작' }).count(), 0)
  assert.equal(await pageB.getByRole('button', { name:'저장하기' }).count(), 0)
  await screenshot(pageB, 'desktop-friend-room-readonly.png')
  console.log('Interior browser checkpoint: shared-room visitor view opened read-only.')
  const attack = await api('/api/economy-v1/room', signedB.session.access_token, {
    participantId:participantA, room:ownerBeforeVisit.room, expectedRevision:ownerBeforeVisit.revision,
    idempotencyKey:crypto.randomUUID(),
  })
  assert.equal(attack.status, 400)
  const ownerAfterVisit = ok(await admin.from('participant_economy_v1_rooms').select('room,revision')
    .eq('participant_id', participantA).single(), 'owner room after visit')
  assert.deepEqual(ownerAfterVisit, ownerBeforeVisit)
  const visitorOwnRoom = ok(await admin.from('participant_economy_v1_rooms').select('room')
    .eq('participant_id', participantB).maybeSingle(), 'visitor room isolation')
  assert.equal(visitorOwnRoom, null)
  assert.deepEqual(visitorMutations, [], 'read-only visitor emitted a mutation')

  const events = ok(await admin.from('user_events').select('target_id,result_entity_id,metadata')
    .in('participant_id', [participantA, participantB]), 'read browser events')
  const serializedEvents = JSON.stringify(events)
  assert.equal(serializedEvents.includes(shareRow.share_token), false)
  assert.equal(serializedEvents.includes('?house='), false)
  assert(events.filter((event) => event.target_id === 'room-save').every((event) => event.result_entity_id === null), true)
  assert.deepEqual(forbiddenInteriorRequests, [], 'cutover Interior used a Character or legacy mutation path')

  const required = [
    'desktop-interior-room.png','desktop-interior-shop-items.png','desktop-interior-shop-sets.png',
    'desktop-insufficient-wallets.png','desktop-item-purchased.png','desktop-bundle-partially-owned.png',
    'desktop-bundle-complete-apply.png','desktop-invite-progress-duplicate.png',
    'desktop-invite-ready-four-unique.png','desktop-friend-room-readonly.png',
    'mobile-landscape.png','mobile-portrait.png','starter-entitlements.png',
  ]
  for (const filename of required) assert((await fs.stat(path.join(reviewDir, filename))).size > 500, `${filename} missing`)

  await contextB.close()
  console.log('Multi-village Interior product-path browser E2E passed.')
} finally {
  if (browser) await browser.close().catch(() => {})
  await admin.from('study_participants').delete().in('participant_id', [participantA, participantB])
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
