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
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey) throw new Error('Local Character browser environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authClient = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantId = `CHAR_BROWSER_${suffix}`
const reviewDir = path.resolve('_review/economy-v1-character-shop')
let browser
let user

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function screenshot(page, filename) {
  await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0))
  await page.screenshot({ path: path.join(reviewDir, filename), fullPage: true })
}

async function setAllBalances(balance) {
  ok(await admin.from('participant_village_wallets').update({ balance }).eq('participant_id', participantId), `set balances ${balance}`)
}

async function waitReady(page) {
  await page.getByRole('heading', { name: '스타일 상점' }).waitFor({ state: 'visible' })
  await page.getByTestId('shop-item-overalls').waitFor({ state: 'visible' })
}

try {
  await fs.mkdir(reviewDir, { recursive: true })
  const auth = ok(await authClient.auth.signInAnonymously(), 'browser QA sign-in')
  user = auth.user
  ok(await admin.from('study_participants').insert({
    participant_id: participantId, auth_user_id: user.id, group_id: 'A', status: 'active',
  }), 'create browser QA participant')
  ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id: user.id }), 'initialize browser profile')
  await setAllBalances(100)

  const shopResponse = await fetch(new URL('/api/economy-v1/character-shop', appUrl), {
    headers: { authorization: `Bearer ${auth.session.access_token}` },
  })
  assert.equal(shopResponse.status, 200)
  const shop = await shopResponse.json()
  assert.equal(shop.items.filter((item) => item.productGroup === 'outfit').length, 18)
  assert.equal(shop.items.filter((item) => item.productGroup === 'accessory').length, 8)
  for (const asset of new Set(shop.items.flatMap((item) => [item.previewAsset, item.runtimeAsset]))) {
    const response = await fetch(new URL(asset, appUrl))
    assert.equal(response.status, 200, `asset failed: ${asset}`)
  }

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: storageKey,
    session: auth.session,
  })
  const page = await context.newPage()
  const failedAssets = []
  page.on('response', (response) => {
    if (response.url().includes('/assets/') && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(new URL('/economy-v1-character-preview', appUrl).href, { waitUntil: 'networkidle' })
  await waitReady(page)
  assert.equal(await page.getByTestId(/^shop-item-/).count(), 19)
  assert.equal(await page.getByText(/오늘의 특가|할인/).count(), 0)
  for (const villageName of ['동물', '인간', '자연', '도시', '음악', '연구']) {
    await page.locator('header').getByText(villageName, { exact: true }).waitFor()
  }
  await page.waitForTimeout(5_500)
  const previewEvents = ok(await admin.from('user_events').select('event_name')
    .eq('participant_id', participantId), 'read preview-load events')
  const previewEventNames = previewEvents.map((event) => event.event_name)
  assert(previewEventNames.includes('attendance_panel_opened'))
  assert.equal(previewEventNames.some((name) => name.startsWith('attendance_check_')), false,
    'preview load must not record attendance claim events')

  const outfitTab = page.getByRole('tab', { name: /의상/ })
  await outfitTab.focus()
  await page.keyboard.press('ArrowRight')
  const accessoryTab = page.getByRole('tab', { name: /액세서리/ })
  assert.equal(await accessoryTab.getAttribute('aria-selected'), 'true')
  assert.equal(await accessoryTab.getAttribute('aria-controls'), 'accessory-panel')
  await page.keyboard.press('ArrowLeft')
  assert.equal(await outfitTab.getAttribute('aria-selected'), 'true')

  const overallsPreview = page.getByRole('button', { name: '멜빵바지 미리보기' })
  await overallsPreview.focus()
  await page.keyboard.press('Enter')
  await page.locator('aside').getByText('멜빵바지', { exact: true }).waitFor()
  await screenshot(page, 'desktop-shop-outfits.png')
  await page.locator('header').screenshot({ path: path.join(reviewDir, 'currency-icons-in-context.png') })

  await page.getByRole('tab', { name: /액세서리/ }).click()
  await page.getByTestId('shop-item-acc_glasses').waitFor()
  assert.equal(await page.getByTestId(/^shop-item-/).count(), 8)
  await screenshot(page, 'desktop-shop-accessories.png')

  ok(await admin.from('participant_village_wallets').update({ balance: 0 })
    .eq('participant_id', participantId).in('village', ['Animal', 'Nature']), 'create partial shortage')
  await page.reload({ waitUntil: 'networkidle' })
  await waitReady(page)
  const insufficientCard = page.getByTestId('shop-item-overalls')
  await insufficientCard.getByText(/동물 \d+ 부족/).waitFor()
  await insufficientCard.getByText(/자연 \d+ 부족/).waitFor()
  const disabledPurchase = insufficientCard.locator('button:disabled').last()
  const disabledLabel = await disabledPurchase.getAttribute('aria-label')
  assert.match(disabledLabel, /구매 불가:.*동물.*자연/)
  assert.doesNotMatch(disabledLabel, /Animal|Nature/)
  await screenshot(page, 'desktop-insufficient-wallets.png')

  await setAllBalances(100)
  await page.reload({ waitUntil: 'networkidle' })
  await waitReady(page)
  const purchaseKeysByItem = new Map()
  let reusedInjected = false
  let retryableInjected = false
  let profileSyncRequests = 0
  let walletSyncRequests = 0
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname === '/api/economy-v1/character-profile') profileSyncRequests += 1
    if (pathname === '/api/economy-v1/wallets') walletSyncRequests += 1
  })
  await page.route('**/api/economy-v1/purchase', async (route) => {
    const body = route.request().postDataJSON()
    const keys = purchaseKeysByItem.get(body.itemId) || []
    keys.push(body.idempotencyKey)
    purchaseKeysByItem.set(body.itemId, keys)
    if (body.itemId === 'overalls' && !reusedInjected) {
      reusedInjected = true
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, code: 'idempotency_key_reused', reason: 'idempotency_key_reused' }),
      })
      return
    }
    if (body.itemId === 'acc_glasses' && !retryableInjected) {
      retryableInjected = true
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, code: 'storage_retryable', retryable: true }),
      })
      return
    }
    await route.continue()
  })
  const overalls = page.getByTestId('shop-item-overalls')
  const overallsBuy = overalls.getByRole('button', { name: '구매하기' })
  await overallsBuy.click()
  const unlockButton = page.getByRole('button', { name: '영구 해금하기' })
  await unlockButton.waitFor()
  assert.equal(await unlockButton.evaluate((element) => element === document.activeElement), true,
    'purchase modal must focus its primary action')
  await page.getByRole('button', { name: '구매 창 닫기' }).focus()
  await page.keyboard.press('Shift+Tab')
  assert.equal(await unlockButton.evaluate((element) => element === document.activeElement), true,
    'modal focus must wrap from the first to the last control')
  await page.keyboard.press('Escape')
  assert.equal(await overallsBuy.evaluate((element) => element === document.activeElement), true,
    'Escape must close the modal and restore purchase-button focus')

  await overallsBuy.click()
  await page.getByRole('button', { name: '영구 해금하기' }).click()
  await page.getByText('요청 상태를 다시 확인했으며 새 요청으로 재시도할 수 있어요.').first().waitFor()
  assert(profileSyncRequests >= 1, 'reused-key recovery must refresh the Character profile')
  assert(walletSyncRequests >= 1, 'reused-key recovery must refresh the six wallets')
  await screenshot(page, 'desktop-purchase-retry.png')
  await page.getByRole('button', { name: '새 요청으로 재시도' }).click()
  await page.getByRole('heading', { name: /멜빵바지.*보유했어요/ }).waitFor()
  const overallsKeys = purchaseKeysByItem.get('overalls')
  assert.equal(overallsKeys.length, 2)
  assert.notEqual(overallsKeys[0], overallsKeys[1], 'reused-key retry must create a fresh UUID')
  await screenshot(page, 'desktop-purchase-success.png')
  await page.getByRole('button', { name: '바로 장착' }).click()
  await page.getByText('멜빵바지 장착 완료').waitFor()

  await page.getByRole('tab', { name: /액세서리/ }).click()
  const glasses = page.getByTestId('shop-item-acc_glasses')
  await glasses.getByRole('button', { name: '구매하기' }).click()
  await page.getByRole('button', { name: '영구 해금하기' }).click()
  await page.getByRole('button', { name: '같은 요청 재시도' }).click()
  await page.getByRole('button', { name: '바로 장착' }).click()
  await page.getByText('안경 장착 완료').waitFor()
  const glassesKeys = purchaseKeysByItem.get('acc_glasses')
  assert.equal(glassesKeys.length, 2)
  assert.equal(glassesKeys[0], glassesKeys[1], 'retryable storage failure must retain the UUID')
  await screenshot(page, 'desktop-equipped-outfit-accessory.png')

  const claimButton = page.getByRole('button', { name: '오늘 출석 보상 받기' })
  if (await claimButton.count()) {
    await claimButton.click()
    await page.getByText(/화폐 \d+개를 받았어요/).first().waitFor()
  }
  await page.waitForTimeout(5_500)
  const claimedEvents = ok(await admin.from('user_events').select('event_name')
    .eq('participant_id', participantId)
    .in('event_name', ['attendance_check_attempted', 'attendance_check_succeeded', 'attendance_check_failed']),
  'read attendance-claim events')
  const claimedEventNames = claimedEvents.map((event) => event.event_name)
  assert(claimedEventNames.includes('attendance_check_attempted'))
  assert(claimedEventNames.includes('attendance_check_succeeded'))
  assert.equal(claimedEventNames.includes('attendance_check_failed'), false)
  await screenshot(page, 'desktop-attendance.png')

  await page.setViewportSize({ width: 844, height: 390 })
  await page.reload({ waitUntil: 'networkidle' })
  await waitReady(page)
  const landscapeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert(landscapeOverflow <= 1, `844px layout overflows by ${landscapeOverflow}px`)
  await screenshot(page, 'mobile-landscape.png')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await waitReady(page)
  const portraitOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert(portraitOverflow <= 1, `390px layout overflows by ${portraitOverflow}px`)
  await screenshot(page, 'mobile-portrait.png')
  assert.deepEqual(failedAssets, [], `asset request failures:\n${failedAssets.join('\n')}`)

  const required = [
    'desktop-shop-outfits.png','desktop-shop-accessories.png','desktop-insufficient-wallets.png',
    'desktop-purchase-retry.png','desktop-purchase-success.png','desktop-equipped-outfit-accessory.png','desktop-attendance.png',
    'mobile-landscape.png','mobile-portrait.png','currency-icons-in-context.png',
  ]
  for (const filename of required) assert((await fs.stat(path.join(reviewDir, filename))).size > 1000, `${filename} is empty`)
  console.log('Multi-village Character browser E2E and review captures passed.')
} finally {
  if (browser) await browser.close().catch(() => {})
  await admin.from('study_participants').delete().eq('participant_id', participantId)
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
