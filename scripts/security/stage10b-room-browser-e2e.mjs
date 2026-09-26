import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.STAGE10B_BROWSER_BASE_URL
if (!supabaseUrl || !anonKey || !serviceKey || !baseUrl) throw new Error('Stage 10B browser environment is incomplete')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')
await requireLoopbackSupabaseUrl(baseUrl, 'STAGE10B_BROWSER_BASE_URL')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `ROOM_A_${suffix}`
const participantB = `ROOM_B_${suffix}`
const tracked = [participantA, participantB]
let browser
let contextA
let contextB
let replacementA
let authA
let authB

const ok = (result, label) => {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function poll(label, fn, timeout = 20_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await fn()
    if (value) return value
    await sleep(200)
  }
  throw new Error(`${label} timed out`)
}
async function login(page, participantId, group) {
  await page.goto(`${baseUrl}/`)
  await page.getByPlaceholder('예: P01').fill(participantId)
  await page.locator('select').selectOption(group)
  await page.getByRole('button', { name: '🌿 마을 입장하기' }).dblclick({ delay: 15 })
  await page.getByPlaceholder('예: P01').waitFor({ state: 'detached', timeout: 20_000 })
}
async function openInternal(page, query) {
  await page.goto(`${baseUrl}/stage8-e2e-test?${new URLSearchParams(query)}`)
  await page.getByRole('button', { name: 'Run Stage 8B E2E' }).click()
  await page.getByTestId('stage8-status').filter({ hasText: 'ready' }).waitFor({ timeout: 20_000 })
}
async function openRoom(page) {
  await openInternal(page, { mode: 'room' })
  await page.locator('[data-interior-room="ready"]').waitFor({ timeout: 20_000 })
}
async function saveWallpaperWithFailureRetry(page, wallpaperId) {
  await page.getByRole('button', { name: '꾸미기 시작' }).click()
  await page.getByRole('button', { name: '벽지' }).click()
  await page.locator(`[data-interior-tray-item="${wallpaperId}"]`).click()
  assert.equal(await page.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), wallpaperId)

  let failedRequest = false
  await page.route('**/rest/v1/rpc/save_participant_room_v3', async route => {
    failedRequest = true
    await route.abort('failed')
  }, { times: 1 })
  await page.getByRole('button', { name: '저장하기' }).click()
  await page.locator('[data-room-toast]').filter({ hasText: '저장에 실패했어요' }).waitFor({ timeout: 10_000 })
  assert.equal(failedRequest, true)
  assert.equal(await page.locator('[data-interior-room]').getAttribute('data-interior-mode'), 'edit')
  assert.equal(await page.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), wallpaperId)

  const save = page.getByRole('button', { name: '저장하기' })
  await save.evaluate(button => { button.click(); button.click() })
  await page.locator('[data-interior-room][data-interior-mode="view"]').waitFor({ timeout: 20_000 })
  await page.locator('[data-room-toast]').filter({ hasText: '방을 저장했어요' }).waitFor()
}
async function assertRecoveredWallpaper(page, wallpaperId) {
  await openRoom(page)
  assert.equal(await page.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), wallpaperId)
}
async function cleanup() {
  const tables = [
    'user_events', 'study_sessions', 'idempotent_operations', 'currency_transactions',
    'participant_currency', 'votes', 'annotations', 'participant_daily_quests',
    'participant_attendance', 'equipped_outfits', 'participant_outfits',
    'participant_interior_items', 'participant_room', 'participant_house_layout',
    'participant_house_items', 'participant_room_memberships', 'participant_realtime_room_members',
    'participant_room_shares',
  ]
  for (const table of tables) {
    const result = await admin.from(table).delete().in('participant_id', tracked)
    if (result.error && !/participant_id|schema cache|does not exist/i.test(result.error.message)) throw result.error
  }
  ok(await admin.from('study_participants').delete().in('participant_id', tracked), 'participant cleanup')
  if (authA) ok(await admin.auth.admin.deleteUser(authA), 'auth A cleanup')
  if (authB) ok(await admin.auth.admin.deleteUser(authB), 'auth B cleanup')
}

try {
  ok(await admin.from('study_participants').insert([
    { participant_id: participantA, group_id: 'A' },
    { participant_id: participantB, group_id: 'B' },
  ]), 'register browser participants')
  ok(await admin.from('participant_room').insert([
    { participant_id: participantA, room: { wallpaper: 'wp_clover', floor: 'fl_brown', items: [] } },
    { participant_id: participantB, room: { wallpaper: 'wp_clover', floor: 'fl_brown', items: [] } },
  ]), 'seed rooms')
  ok(await admin.from('participant_interior_items').insert([
    { participant_id: participantA, item_id: 'wp_hearts' },
    { participant_id: participantB, item_id: 'wp_hearts' },
  ]), 'seed browser-owned decor')

  browser = await chromium.launch({ headless: true })
  contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  contextB = await browser.newContext({ viewport: { width: 1280, height: 840 } })
  assert.notEqual(contextA, contextB)
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  await Promise.all([login(pageA, participantA, 'A'), login(pageB, participantB, 'B')])

  const claimed = await poll('independent participant claims', async () => {
    const rows = ok(await admin.from('study_participants').select('participant_id,group_id,auth_user_id').in('participant_id', tracked), 'claimed participants')
    return rows.length === 2 && rows.every(row => row.auth_user_id) ? rows : null
  })
  authA = claimed.find(row => row.participant_id === participantA).auth_user_id
  authB = claimed.find(row => row.participant_id === participantB).auth_user_id
  assert.notEqual(authA, authB)
  assert.deepEqual(new Set(claimed.map(row => row.group_id)), new Set(['A', 'B']))

  const [stateA, stateB] = await Promise.all([contextA.storageState(), contextB.storageState()])
  assert.notDeepEqual(stateA.origins, stateB.origins, 'A/B local storage must be independent')
  const sessionA = await pageA.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  const sessionB = await pageB.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  assert.notDeepEqual(sessionA, sessionB, 'A/B session storage must be independent')

  await openRoom(pageA)
  assert.equal(await pageA.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), 'wp_clover')
  await saveWallpaperWithFailureRetry(pageA, 'wp_hearts')
  assert.equal(ok(await admin.from('participant_room').select('room').eq('participant_id', participantA).single(), 'A stored room').room.wallpaper, 'wp_hearts')
  await pageA.reload()
  await pageA.getByRole('button', { name: 'Run Stage 8B E2E' }).click()
  await pageA.locator('[data-interior-room="ready"]').waitFor({ timeout: 20_000 })
  assert.equal(await pageA.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), 'wp_hearts')

  const approvedAState = await contextA.storageState()
  await contextA.close()
  contextA = null
  replacementA = await browser.newContext({ storageState: approvedAState, viewport: { width: 1440, height: 900 } })
  const restoredA = await replacementA.newPage()
  await assertRecoveredWallpaper(restoredA, 'wp_hearts')

  await openRoom(pageB)
  await pageB.getByRole('button', { name: '꾸미기 시작' }).click()
  await pageB.getByRole('button', { name: '벽지' }).click()
  await pageB.locator('[data-interior-tray-item="wp_hearts"]').click()
  await pageB.getByRole('button', { name: '저장하기' }).click()
  await pageB.locator('[data-interior-room][data-interior-mode="view"]').waitFor({ timeout: 20_000 })
  await pageB.reload()
  await pageB.getByRole('button', { name: 'Run Stage 8B E2E' }).click()
  await pageB.locator('[data-interior-room="ready"]').waitFor({ timeout: 20_000 })
  assert.equal(await pageB.locator('[data-interior-room]').getAttribute('data-room-wallpaper'), 'wp_hearts')

  const operationA = crypto.randomUUID()
  await openInternal(restoredA, { mode: 'room-boundary', target: participantB, operationKey: operationA })
  await restoredA.getByRole('button', { name: 'Run room boundary probe' }).click()
  await restoredA.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor({ timeout: 20_000 })
  const probeA = JSON.parse(await restoredA.getByTestId('stage8-result').textContent())
  assert.deepEqual(probeA, {
    kind: 'room-boundary', directInsertBlocked: true, directUpdateBlocked: true,
    directDeleteBlocked: true, crossReadRows: 0, crossUpdateBlocked: true,
    rpcSaved: true, replayStable: true, payloadStayedOnCaller: true,
  })

  const operationB = crypto.randomUUID()
  await openInternal(pageB, { mode: 'room-boundary', target: participantA, operationKey: operationB })
  await pageB.getByRole('button', { name: 'Run room boundary probe' }).click()
  await pageB.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor({ timeout: 20_000 })
  const probeB = JSON.parse(await pageB.getByTestId('stage8-result').textContent())
  assert.equal(probeB.payloadStayedOnCaller, true)
  assert.equal(probeB.crossReadRows, 0)
  assert.equal(probeB.directInsertBlocked && probeB.directUpdateBlocked && probeB.directDeleteBlocked, true)
  const finalRooms = ok(await admin.from('participant_room').select('participant_id,room').in('participant_id', tracked), 'final isolated rooms')
  assert.equal(finalRooms.length, 2)
  assert(finalRooms.every(row => row.room.wallpaper === 'boundary-probe'))
  assert(finalRooms.every(row => row.room.participant_id_like && row.room.participant_id_like !== row.participant_id))

  const events = await poll('room browser events', async () => {
    const rows = ok(await admin.from('user_events').select('participant_id,study_session_id,client_instance_id,event_name,target_id,metadata,value_before,value_after,operation_type,operation_idempotency_key,result_entity_type,result_entity_id,error_code').in('participant_id', tracked).in('event_name', ['room_save_attempted', 'room_save_succeeded', 'room_save_failed']), 'room events')
    return rows.filter(row => row.event_name === 'room_save_succeeded').length >= 2 ? rows : null
  }, 30_000)
  for (const participant of tracked) {
    assert.equal(events.filter(row => row.participant_id === participant && row.event_name === 'room_save_succeeded').length, 1)
  }
  assert.equal(events.filter(row => row.participant_id === participantA && row.event_name === 'room_save_failed').length, 1)
  for (const event of events.filter(row => row.event_name === 'room_save_succeeded')) {
    assert.equal(event.operation_type, 'room_save')
    assert(event.operation_idempotency_key)
    assert.equal(event.result_entity_type, 'participant_room')
    assert.equal(event.result_entity_id, null)
  }
  assert.equal(new Set(events.filter(row => row.participant_id === participantA).map(row => row.study_session_id)).size, 1)
  assert.equal(new Set(events.filter(row => row.participant_id === participantB).map(row => row.study_session_id)).size, 1)
  assert.notEqual(events.find(row => row.participant_id === participantA).study_session_id, events.find(row => row.participant_id === participantB).study_session_id)
  const payload = JSON.stringify(events.map(({ participant_id: _participant, study_session_id: _session, client_instance_id: _client, ...event }) => event))
  assert.doesNotMatch(payload, /participant_id|auth_user_id|share[_-]?token|authorization|bearer|select\s|insert\s|update\s|delete\s|truncate\s|stack\s*trace/i)
  assert.equal(payload.includes(participantA) || payload.includes(participantB) || payload.includes(authA) || payload.includes(authB), false)

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'independent A/B contexts, auth, cookies and Web Storage',
      'initial room read, UI failure retention, retry, save, reload and replacement-context recovery',
      'single logical save result and same-key replay',
      'direct INSERT/UPDATE/DELETE and cross-participant access blocked',
      'identity-like payload stayed on the authenticated caller row',
      'room event ownership, linkage, deduplication and redaction',
    ],
    event_rows: events.length,
  }, null, 2))
} finally {
  await replacementA?.close().catch(() => {})
  await contextA?.close().catch(() => {})
  await contextB?.close().catch(() => {})
  await browser?.close().catch(() => {})
  await cleanup()
  const participants = await admin.from('study_participants').select('*', { count: 'exact', head: true }).in('participant_id', tracked)
  ok(participants, 'participant cleanup count')
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  assert.equal(users.error, null)
  assert.equal(users.data.users.filter(user => [authA, authB].includes(user.id)).length, 0)
  assert.equal(participants.count || 0, 0)
  const catalog = await admin.from('study_sound_catalog').select('canonical_audio_id', { count: 'exact' }).range(0, 1199)
  ok(catalog, 'catalog cleanup check')
  assert.equal(catalog.count, 1000)
  assert.equal(new Set(catalog.data.map(row => row.canonical_audio_id)).size, 995)
  console.log(JSON.stringify({ cleanup: true, tracked_auth_users: 0, tracked_participants: 0, catalog: '1000/995' }))
}
