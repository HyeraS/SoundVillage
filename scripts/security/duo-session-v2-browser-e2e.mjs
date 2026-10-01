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
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey) throw new Error('Local Duo browser environment is incomplete')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authClients = Array.from({ length:3 }, () => createClient(supabaseUrl, anonKey, options))
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['A','B','C'].map((name) => `DUO_BROWSER_${name}_${suffix}`)
const users = []
const reviewDir = path.resolve('_review/duo-session-v2')
let browser
let contextA
let contextB
let contextC
let contextB2

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

async function openWorld(page, target = appUrl) {
  await page.goto(target, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:45_000 })
}

async function enterHome(page) {
  await page.getByRole('button', { name:'우리 집 꾸미기 열기' }).click()
  await page.locator('[data-interior-room="ready"]').waitFor({ timeout:30_000 })
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  const signed = []
  for (let index = 0; index < authClients.length; index += 1) {
    const result = ok(await authClients[index].auth.signInAnonymously(), `browser sign-in ${index}`)
    signed.push(result)
    users.push(result.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'create browser Duo participants')
  ok(await admin.from('participant_currency').upsert({ participant_id:participantIds[1], balance:1_000 }),
    'seed visitor legacy balance')
  for (const user of users) ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:user.id }), 'initialize Economy profile')
  const itemIds = ['plant_tall','plant_bush','books','fruitbowl']
  ok(await admin.from('participant_catalog_items').insert(itemIds.map((itemId) => ({
    participant_id:participantIds[0], item_id:itemId, acquisition_source:'individual_purchase',
  }))), 'seed host ownership')
  ok(await admin.from('participant_economy_v1_rooms').insert({
    participant_id:participantIds[0], revision:1, invite_unique_item_count:4,
    room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:itemIds.map((itemId, index) => ({
      uid:index + 1, itemId, layer:'floor', col:index * 2, row:0, flip:false,
    })) },
  }), 'seed host room')

  browser = await chromium.launch({ headless:true })
  contextA = await createContext(signed[0].session)
  contextB = await createContext(signed[1].session)
  contextC = await createContext(signed[2].session)
  const pageA = await contextA.newPage()
  await openWorld(pageA)
  await enterHome(pageA)
  await pageA.getByRole('button', { name:'초대', exact:true }).click()
  const inviteDialog = pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' })
  await inviteDialog.getByRole('button', { name:'실시간 초대 링크 만들기' }).click()
  await inviteDialog.getByTestId('duo-invite-ready').waitFor({ timeout:30_000 })
  await pageA.getByTestId('duo-connection-state').filter({ hasText:'연결됨' }).waitFor({ timeout:30_000 })
  await screenshot(pageA, 'host-invite-ready.png')
  await inviteDialog.getByRole('button', { name:'복사', exact:true }).click()
  const inviteUrl = await pageA.evaluate(() => navigator.clipboard.readText())
  assert.match(inviteUrl, /\?duo=[A-Za-z0-9_-]{43}$/)
  assert.equal(await inviteDialog.locator('text=/[A-Za-z0-9_-]{43}/').count(), 0, 'raw invite token is visible')

  const pageB = await contextB.newPage()
  let joinRequestObserved = false
  const visitorDuoResponses = []
  pageB.on('response', async (response) => {
    const pathname = new URL(response.url()).pathname
    if (!pathname.startsWith('/api/duo-v2/')) return
    const body = await response.json().catch(() => ({}))
    visitorDuoResponses.push({ pathname, status:response.status(), ok:body.ok === true, code:body.code, hasRoom:Boolean(body.room) })
  })
  await pageB.route('**/api/duo-v2/join', async (route) => {
    joinRequestObserved = true
    assert.equal(new URL(pageB.url()).searchParams.has('duo'), false, 'URL token was not removed before join request')
    await route.continue()
  })
  await pageB.goto(inviteUrl, { waitUntil:'domcontentloaded' })
  const visitorRoom = pageB.locator('[data-interior-room="ready"][data-room-visitor="true"]')
  try {
    await visitorRoom.waitFor({ timeout:45_000 })
  } catch (error) {
    const [visibleState, hostState] = await Promise.all([
      pageB.evaluate(() => ({
        hasWorld:Boolean(document.querySelector('[data-testid="world-map"]')),
        duoStatus:document.querySelector('[data-testid="duo-world-status"]')?.textContent || null,
        connectionStatus:document.querySelector('[data-testid="duo-connection-state"]')?.textContent || null,
        hasRecovery:Boolean(sessionStorage.getItem('soundvillage-duo-v2-recovery')),
        hasRawInvite:Boolean(sessionStorage.getItem('soundvillage-duo-v2-invite')),
        queryHasToken:new URL(location.href).searchParams.has('duo'),
      })),
      pageA.evaluate(() => ({
        hasWorld:Boolean(document.querySelector('[data-testid="world-map"]')),
        hasInterior:Boolean(document.querySelector('[data-interior-room="ready"]')),
        connectionStatus:document.querySelector('[data-testid="duo-connection-state"]')?.textContent || null,
      })),
    ])
    throw new Error(`Visitor room did not open: ${JSON.stringify({ visibleState, hostState, responses:visitorDuoResponses })}`, { cause:error })
  }
  await pageB.getByTestId('duo-connection-state').filter({ hasText:'연결됨' }).waitFor({ timeout:30_000 })
  assert.equal(new URL(pageB.url()).searchParams.has('duo'), false, 'join token remained in URL')
  assert.equal(joinRequestObserved, true, 'join request was not observed')
  assert.equal(await pageB.evaluate(() => sessionStorage.getItem('soundvillage-duo-v2-invite')), null)
  assert.equal((await pageB.locator('body').innerText()).includes(inviteUrl.split('duo=')[1]), false, 'raw invite token is in the DOM')
  await screenshot(pageB, 'visitor-join.png')
  assert.equal(await pageB.getByRole('button', { name:'상점', exact:true }).count(), 0)
  assert.equal(await pageB.getByRole('button', { name:'꾸미기 시작' }).count(), 0)
  for (const [path, body] of [
    ['/api/economy-v1/purchase', { itemId:'plant_tall', idempotencyKey:crypto.randomUUID() }],
    ['/api/economy-v1/room', { room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:[] }, expectedRevision:0, idempotencyKey:crypto.randomUUID() }],
  ]) {
    const response = await fetch(new URL(path, appUrl), {
      method:'POST', headers:{ Authorization:`Bearer ${signed[1].session.access_token}`, 'Content-Type':'application/json' },
      body:JSON.stringify(body),
    })
    assert.equal(response.status, 403, `${path} did not block the active visitor`)
    assert.equal((await response.json()).code, 'visitor_readonly')
  }
  const legacyPurchase = await fetch(new URL('/api/participant-purchase', appUrl), {
    method:'POST', headers:{ Authorization:`Bearer ${signed[1].session.access_token}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ kind:'interior_item', itemId:'plant_tall', idempotencyKey:crypto.randomUUID() }),
  })
  assert.equal(legacyPurchase.status, 500, 'protected legacy purchase path mutated an active visitor')
  assert.equal((await legacyPurchase.json()).code, 'purchase_failed')
  assert.equal(ok(await admin.from('participant_interior_items').select('item_id')
    .eq('participant_id', participantIds[1]).eq('item_id', 'plant_tall'),
  'read browser blocked legacy grant').length, 0)
  await screenshot(pageB, 'visitor-readonly.png')
  await inviteDialog.getByRole('button', { name:'닫기' }).click()
  await pageA.keyboard.down('ArrowRight')
  await pageA.waitForTimeout(700)
  await pageA.keyboard.up('ArrowRight')
  await pageA.waitForTimeout(300)
  await screenshot(pageB, 'interior-two-players.png')

  const pageC = await contextC.newPage()
  await openWorld(pageC, inviteUrl)
  await pageC.getByTestId('duo-world-status').filter({ hasText:'session_full' }).waitFor({ timeout:30_000 })
  await screenshot(pageC, 'session-full-third-user.png')

  contextB2 = await createContext(signed[1].session)
  const pageB2 = await contextB2.newPage()
  await openWorld(pageB2, inviteUrl)
  await pageB2.getByTestId('duo-world-status').filter({ hasText:'already_open_elsewhere' }).waitFor({ timeout:30_000 })
  await screenshot(pageB2, 'second-tab-blocked.png')

  if (await inviteDialog.isVisible()) {
    await inviteDialog.getByRole('button', { name:'닫기' }).click()
  }
  if (await pageA.locator('[data-interior-room="ready"]').isVisible()) {
    await pageA.getByRole('button', { name:/나가기/ }).click()
  }
  await pageA.getByTestId('world-map').waitFor()
  await pageB.getByTestId('world-map').waitFor({ timeout:30_000 })
  await pageA.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:30_000 })
  await pageB.keyboard.down('ArrowRight')
  await pageB.waitForTimeout(700)
  await pageB.keyboard.up('ArrowRight')
  await pageB.waitForTimeout(300)
  await screenshot(pageA, 'worldmap-two-players.png')

  await pageB.setViewportSize({ width:390, height:844 })
  await screenshot(pageB, 'mobile-portrait.png')
  await pageB.setViewportSize({ width:844, height:390 })
  await screenshot(pageB, 'mobile-landscape.png')
  await pageB.setViewportSize({ width:1280, height:720 })

  await contextB.setOffline(true)
  await pageB.getByTestId('duo-world-status').filter({ hasText:'다시 연결하는 중' }).waitFor({ timeout:20_000 })
  await screenshot(pageB, 'reconnect-notice.png')
  await contextB.setOffline(false)
  await pageB.getByTestId('duo-world-status').filter({ hasText:'연결됨' }).waitFor({ timeout:30_000 })

  await enterHome(pageA)
  await pageA.getByRole('button', { name:'초대', exact:true }).click()
  await pageA.getByRole('dialog', { name:'우리 집에 놀러 올래?' }).getByRole('button', { name:'실시간 세션 종료' }).click()
  await pageB.locator('[data-interior-room="ready"][data-room-visitor="true"]').waitFor({ timeout:45_000 })
  await pageB.getByTestId('duo-connection-state').filter({ hasText:'실시간 세션 종료됨' }).waitFor({ timeout:30_000 })
  await screenshot(pageB, 'invite-revoked.png')

  const secretPattern = /(?:\?duo=|eyJhbGci|service_role|DUO_BROWSER_[A-Z]_)/
  for (const filename of await fs.readdir(reviewDir)) {
    if (!filename.endsWith('.png')) continue
    assert.equal(secretPattern.test(filename), false)
  }
  const duoEvents = ok(await admin.from('user_events')
    .select('event_name,target_type,target_id,error_code,metadata')
    .in('participant_id', participantIds)
    .like('event_name', 'duo_%'), 'read Duo events')
  const serializedEvents = JSON.stringify(duoEvents)
  const sessionRows = ok(await admin.from('duo_v2_sessions').select('id').in('host_auth_user_id', users.map((user) => user.id)), 'read Duo sessions')
  for (const sensitive of [inviteUrl.split('duo=')[1], ...users.map((user) => user.id), ...sessionRows.map((row) => row.id)]) {
    assert.equal(serializedEvents.includes(sensitive), false, 'Duo event leaked a token or identity')
  }
  assert.doesNotMatch(serializedEvents, /"(?:x|y)"\s*:/, 'Duo event leaked coordinates')
  console.log('Duo Session V2 A/B/C product-path browser E2E and captures passed.')
} finally {
  for (const context of [contextB2, contextC, contextB, contextA]) if (context) await context.close().catch(() => {})
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
  await admin.from('participant_currency').delete().in('participant_id', participantIds)
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
