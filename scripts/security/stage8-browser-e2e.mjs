import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import metadata from '../../data/sound_metadata.json' with { type: 'json' }
import { canonicalAudioId } from '../../lib/soundIdentity.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.STAGE8_BROWSER_BASE_URL
if (!supabaseUrl || !anonKey || !serviceKey || !baseUrl) throw new Error('Stage 8 browser environment is incomplete')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')
await requireLoopbackSupabaseUrl(baseUrl, 'STAGE8_BROWSER_BASE_URL')

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const pidA = `E2E_A_${suffix}`
const pidB = `E2E_B_${suffix}`
const tracked = [pidA, pidB]
const summaries = []
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function poll(label, fn, { timeout = 20_000, interval = 250 } = {}) {
  const deadline = Date.now() + timeout
  let value
  while (Date.now() < deadline) {
    value = await fn()
    if (value) return value
    await sleep(interval)
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
async function playAnnotation(page) {
  const input = page.getByPlaceholder(/먼저 소리를 들어보세요|예: 쨍그랑/)
  assert.equal(await input.isDisabled(), true, 'annotation input must be locked before playback')
  await page.getByRole('main').locator('button:has(svg)').click()
  await poll('annotation playback start', async () => !(await input.isDisabled()))
  await page.getByText('1회 재생').waitFor({ timeout: 10_000 })
  return input
}
async function submitAnnotation(page, expression, { expectFeedback = false } = {}) {
  const input = await playAnnotation(page)
  await input.fill(expression)
  const submit = page.getByRole('button', { name: '✅ 제출하기' })
  await poll('annotation submit enabled', async () => !(await submit.isDisabled()))
  await submit.evaluate((button) => {
    button.click()
    button.click()
  })
  try {
    await page.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor({ timeout: 20_000 })
  } catch (error) {
    const publicError = await page.getByText(/저장 오류:|먼저 소리를|의성어를 입력/).allTextContents()
    throw new Error(`annotation completion unavailable; public errors=${JSON.stringify(publicError)}`, { cause: error })
  }
  if (expectFeedback) {
    const feedback = page.getByText('소리 수집 완료!')
    await feedback.waitFor()
    await sleep(1_900)
    assert.equal(await feedback.isVisible(), true, 'feedback must remain visible near two seconds')
    await feedback.waitFor({ state: 'detached', timeout: 1_500 })
  }
  return JSON.parse(await page.getByTestId('stage8-result').textContent())
}
async function submitVote(page, expression) {
  await page.keyboard.down('ArrowUp')
  await sleep(750)
  await page.keyboard.up('ArrowUp')
  await page.getByText('🕮 열람하기').waitFor({ timeout: 10_000 })
  await page.keyboard.press('Enter')
  const submit = page.getByRole('button', { name: '✅ 다음 소리로' })
  await page.getByText('음원을 실제로 재생한 뒤 투표할 수 있어요.').waitFor()
  assert.equal(await submit.isDisabled(), true, 'vote must be locked before playback')
  await page.getByRole('button', { name: '▶ PLAY CLIP' }).click()
  await page.getByText('1회 재생').waitFor({ timeout: 10_000 })
  await page.getByText(`“${expression}”`).click()
  assert.equal(await submit.isDisabled(), false, 'vote must unlock after playback and selection')
  await submit.evaluate((button) => {
    button.click()
    button.click()
  })
  await page.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor({ timeout: 20_000 })
}
async function assertBrowserExclusion(page, mode, sound) {
  await openInternal(page, { mode, sound })
  await page.getByRole('button', { name: 'Check canonical exclusion' }).click()
  await page.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor()
  assert.equal(JSON.parse(await page.getByTestId('stage8-result').textContent()).excluded, true)
  await page.reload()
  await page.getByRole('button', { name: 'Run Stage 8B E2E' }).click()
  await page.getByTestId('stage8-status').filter({ hasText: 'ready' }).waitFor({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Check canonical exclusion' }).click()
  await page.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor()
  assert.equal(JSON.parse(await page.getByTestId('stage8-result').textContent()).excluded, true)
}
async function eventCount(participantId, eventName) {
  const result = await admin.from('user_events').select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId).eq('event_name', eventName)
  ok(result, `event count ${eventName}`)
  return result.count || 0
}
async function seedCompletionBoundary(excludedCanonical) {
  const assigned = new Map()
  for (const row of metadata.sounds.filter((sound) => sound.group === 'A')) {
    const canonical = canonicalAudioId(row)
    if (!assigned.has(canonical)) assigned.set(canonical, row)
  }
  const existing = ok(await admin.from('annotations').select('canonical_audio_id').eq('participant_id', pidA).eq('is_skipped', false), 'existing A annotations')
  const completed = new Set(existing.map((row) => row.canonical_audio_id))
  const rows = [...assigned.entries()]
    .filter(([canonical]) => canonical !== excludedCanonical && !completed.has(canonical))
    .map(([canonical, row]) => ({
      participant_id: pidA,
      session_id: 'A',
      experiment_round: 1,
      canonical_audio_id: canonical,
      sound_id: row.sound_id,
      zone: row.game_zone,
      source_type: row.source_type,
      sub_category: row.sub_category,
      audioset_class: row.audioset_class,
      expression_text: 'stage8 browser boundary seed',
      selected_features: null,
      confidence: 3,
      difficulty: null,
      play_count: 1,
      listening_time_sec: 0,
      is_skipped: false,
      skip_reason: '',
      device_info: 'stage8-browser-boundary-seed',
      stage: 1,
      is_verified: false,
      vote_count: 0,
      version: 'stage8-browser',
    }))
  for (let index = 0; index < rows.length; index += 200) {
    ok(await admin.from('annotations').insert(rows.slice(index, index + 200)), `completion seed ${index / 200 + 1}`)
  }
  return assigned.size
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
    { participant_id: pidA, group_id: 'A' },
    { participant_id: pidB, group_id: 'B' },
  ]), 'browser participants')
  ok(await admin.from('participant_room').insert({ participant_id: pidA, room: { version: 1, items: [] } }), 'host room')

  browser = await chromium.launch({ headless: true })
  contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  contextB = await browser.newContext({ viewport: { width: 1180, height: 820 } })
  assert.notEqual(contextA, contextB)
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  await Promise.all([login(pageA, pidA, 'A'), login(pageB, pidB, 'B')])

  const claimed = await poll('claimed identities', async () => {
    const rows = ok(await admin.from('study_participants').select('participant_id,auth_user_id').in('participant_id', tracked), 'claimed participants')
    return rows.length === 2 && rows.every((row) => row.auth_user_id) ? rows : null
  })
  authA = claimed.find((row) => row.participant_id === pidA).auth_user_id
  authB = claimed.find((row) => row.participant_id === pidB).auth_user_id
  assert.notEqual(authA, authB, 'A/B auth identities must differ')
  assert.equal(ok(await admin.from('study_sessions').select('id').in('participant_id', tracked), 'initial sessions').length, 2)
  summaries.push('separate contexts and distinct auth identities')

  const share = await poll('host share', async () => {
    const row = ok(await admin.from('participant_room_shares').select('share_token').eq('participant_id', pidA).maybeSingle(), 'host share')
    return row?.share_token || null
  })
  await Promise.all([
    openInternal(pageA, { mode: 'duo', token: share, role: 'host' }),
    openInternal(pageB, { mode: 'duo', token: share, role: 'visitor' }),
  ])
  await Promise.all([
    pageA.getByTestId('duo-presence').filter({ hasText: 'present' }).waitFor({ timeout: 20_000 }),
    pageB.getByTestId('duo-presence').filter({ hasText: 'present' }).waitFor({ timeout: 20_000 }),
    pageA.getByTestId('duo-broadcast').filter({ hasText: 'received' }).waitFor({ timeout: 20_000 }),
    pageB.getByTestId('duo-broadcast').filter({ hasText: 'received' }).waitFor({ timeout: 20_000 }),
  ])
  await pageB.goto(`${baseUrl}/stage8-e2e-test?mode=isolation`)
  await pageA.getByTestId('duo-presence').filter({ hasText: 'absent' }).waitFor({ timeout: 20_000 })
  await openInternal(pageB, { mode: 'duo', token: share, role: 'visitor' })
  await pageA.getByTestId('duo-presence').filter({ hasText: 'present' }).waitFor({ timeout: 20_000 })
  await pageA.getByTestId('duo-broadcast').filter({ hasText: 'received' }).waitFor({ timeout: 20_000 })
  await Promise.all([
    pageA.goto(`${baseUrl}/`),
    pageB.goto(`${baseUrl}/?duo=${encodeURIComponent(share)}`),
  ])
  await poll('WorldMap initial duo connection event', () => eventCount(pidA, 'duo_connected'), { timeout: 30_000, interval: 500 })
  await pageB.goto(`${baseUrl}/stage8-e2e-test?mode=isolation`)
  await poll('WorldMap duo disconnect event', () => eventCount(pidA, 'duo_disconnected'), { timeout: 30_000, interval: 500 })
  await pageB.goto(`${baseUrl}/?duo=${encodeURIComponent(share)}`)
  await poll('WorldMap duo reconnect event', () => eventCount(pidA, 'duo_reconnected'), { timeout: 30_000, interval: 500 })
  summaries.push('private Presence, Broadcast, unmount absence, and observed WorldMap reconnect')

  await openInternal(pageA, { mode: 'annotation', sound: 'MUS_13433' })
  const musicResult = await submitAnnotation(pageA, 'stage8-music-expression', { expectFeedback: true })
  assert.equal(musicResult.isComplete, false)
  assert.equal(ok(await admin.from('annotations').select('id').eq('participant_id', pidA).eq('canonical_audio_id', 'fsd50k:13433'), 'music rows').length, 1)
  await assertBrowserExclusion(pageA, 'progress', 'MUS_13433')

  await openInternal(pageA, { mode: 'annotation', sound: 'NAT_147182' })
  await submitAnnotation(pageA, 'stage8-alias-expression')
  await openInternal(pageA, { mode: 'annotation', sound: 'Nature_147182' })
  const aliasResult = await submitAnnotation(pageA, 'stage8-alias-second')
  assert.equal(aliasResult.alreadyCompleted, true)
  assert.equal(ok(await admin.from('annotations').select('id').eq('participant_id', pidA).eq('canonical_audio_id', 'fsd50k:147182'), 'alias rows').length, 1)
  summaries.push('normal annotation, feedback timer, double-click, and alias convergence')

  await openInternal(pageB, { mode: 'museum', sound: 'MUS_13433' })
  await submitVote(pageB, 'stage8-music-expression')
  await assertBrowserExclusion(pageB, 'vote-progress', 'MUS_13433')
  await openInternal(pageB, { mode: 'museum', sound: 'NAT_147182' })
  await submitVote(pageB, 'stage8-alias-expression')
  await openInternal(pageB, { mode: 'museum', sound: 'Nature_147182' })
  await submitVote(pageB, 'stage8-alias-expression')
  assert.equal(ok(await admin.from('votes').select('id').eq('participant_id', pidB).eq('canonical_audio_id', 'fsd50k:147182'), 'alias vote rows').length, 1)
  assert.equal(ok(await admin.from('votes').select('id').eq('participant_id', pidB).eq('canonical_audio_id', 'fsd50k:13433'), 'music vote rows').length, 1)
  summaries.push('vote playback gate, double-click, and alias convergence')

  await openInternal(pageA, { mode: 'isolation', target: pidB })
  await pageA.getByRole('button', { name: 'Run isolation probe' }).click()
  await pageA.getByTestId('stage8-status').filter({ hasText: 'done' }).waitFor()
  const isolation = JSON.parse(await pageA.getByTestId('stage8-result').textContent())
  assert.equal(isolation.crossReadRows, 0)
  assert.equal(isolation.crossWriteRows, 0)
  summaries.push('browser-originated cross-participant read/write isolation')

  const completionSound = metadata.sounds.find((sound) => sound.sound_id === 'Lab_270587')
  const assignedCount = await seedCompletionBoundary(canonicalAudioId(completionSound))
  await openInternal(pageA, { mode: 'annotation', sound: completionSound.sound_id })
  const completionResult = await submitAnnotation(pageA, 'stage8-final-expression')
  assert.equal(completionResult.isComplete, true)
  const completedSession = ok(await admin.from('study_sessions').select('id,status,completion_annotation_id').eq('participant_id', pidA).single(), 'completed session')
  assert.equal(completedSession.status, 'completed')
  const completedAnnotations = ok(await admin.from('annotations').select('id').eq('participant_id', pidA).eq('is_skipped', false), 'completed annotations')
  assert.equal(completedAnnotations.length, assignedCount)
  assert(completedAnnotations.some((row) => row.id === completedSession.completion_annotation_id))
  await poll('completion event', () => eventCount(pidA, 'session_completed'))
  const completionEvents = ok(await admin.from('user_events').select('result_entity_type,result_entity_id').eq('participant_id', pidA).eq('event_name', 'session_completed'), 'completion event linkage')
  assert.equal(completionEvents.length, 1)
  assert.equal(completionEvents[0].result_entity_type, 'annotation')
  assert.equal(completionEvents[0].result_entity_id, completedSession.completion_annotation_id)

  const storageA = await contextA.storageState()
  await contextA.close()
  contextA = null
  replacementA = await browser.newContext({ storageState: storageA, viewport: { width: 1280, height: 900 } })
  const restartPage = await replacementA.newPage()
  await restartPage.goto(`${baseUrl}/`)
  await restartPage.getByText('모든 소리 과제를 완료했어요').waitFor({ timeout: 20_000 })
  await restartPage.reload()
  await restartPage.getByText('모든 소리 과제를 완료했어요').waitFor({ timeout: 20_000 })
  assert.equal(ok(await admin.from('study_sessions').select('id').eq('participant_id', pidA), 'post restart sessions').length, 1)
  assert.equal(ok(await admin.from('participant_attendance').select('participant_id').eq('participant_id', pidA), 'post restart attendance').length, 1)
  summaries.push('final annotation completion and new-context recovery')

  const events = ok(await admin.from('user_events').select('event_name,sound_id,metadata,value_before,value_after,result_entity_type,result_entity_id').in('participant_id', tracked).range(0, 5000), 'browser events')
  const names = new Set(events.map((event) => event.event_name))
  for (const required of ['audio_play_attempted', 'audio_play_started', 'annotation_submit_succeeded', 'museum_audio_play_started', 'museum_vote_submit_succeeded', 'session_completed']) {
    assert(names.has(required), `missing required browser event ${required}`)
  }
  assert.equal(await eventCount(pidA, 'session_completed'), 1)
  assert.equal(events.filter((event) => event.event_name === 'annotation_submit_attempted' && event.sound_id === 'MUS_13433').length, 1)
  assert.equal(events.filter((event) => event.event_name === 'annotation_submit_succeeded' && event.sound_id === 'MUS_13433').length, 1)
  assert.equal(events.filter((event) => event.event_name === 'museum_vote_submit_attempted' && event.sound_id === 'MUS_13433').length, 1)
  assert.equal(events.filter((event) => event.event_name === 'museum_vote_submit_succeeded' && event.sound_id === 'MUS_13433').length, 1)
  const serialized = JSON.stringify(events)
  assert.doesNotMatch(serialized, /service[_-]?role|authorization|bearer|share[_-]?token|select\s|insert\s|update\s|delete\s|stack\s*trace/i)
  assert.doesNotMatch(serialized, /pointer[_-]?(?:x|y|movement)|client[XY]|screen[XY]|page[XY]/i)
  summaries.push('event reconciliation and sensitive-payload scan')

  console.log(JSON.stringify({ ok: true, checks: summaries, event_rows: events.length }, null, 2))
} finally {
  await replacementA?.close().catch(() => {})
  await contextA?.close().catch(() => {})
  await contextB?.close().catch(() => {})
  await browser?.close().catch(() => {})
  await cleanup()
  const participantResult = await admin.from('study_participants').select('*', { count: 'exact', head: true }).in('participant_id', tracked)
  ok(participantResult, 'participant cleanup count')
  const ownedResult = await admin.from('annotations').select('*', { count: 'exact', head: true }).in('participant_id', tracked)
  ok(ownedResult, 'owned cleanup count')
  const participantCount = participantResult.count || 0
  const ownedCount = ownedResult.count || 0
  const catalog = await admin.from('study_sound_catalog').select('canonical_audio_id', { count: 'exact' }).range(0, 1199)
  ok(catalog, 'catalog cleanup check')
  assert.equal(participantCount, 0)
  assert.equal(ownedCount, 0)
  assert.equal(catalog.count, 1000)
  assert.equal(new Set(catalog.data.map((row) => row.canonical_audio_id)).size, 995)
  console.log(JSON.stringify({ cleanup: true, tracked_participants: 0, tracked_owned_rows: 0, catalog: '1000/995' }))
}
