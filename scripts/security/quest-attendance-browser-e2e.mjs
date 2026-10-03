import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const dbContainer = process.env.SECURITY_TEST_DB_CONTAINER
const expectedMode = process.env.EXPECTED_ECONOMY_MODE
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey || !dbContainer || !['legacy','preview','cutover','maintenance'].includes(expectedMode)) {
  throw new Error('Quest/attendance browser environment is incomplete')
}
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')
assert.match(dbContainer, /^supabase_db_[a-z0-9-]+$/)

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const auth = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantId = `REWARD_BROWSER_${expectedMode.toUpperCase()}_${suffix}`
const reviewDir = path.resolve('_review/pre-experiment-quest-attendance')
const rewardRpcPattern = /\/rest\/v1\/rpc\/(?:ensure_today_quests|get_attendance_status|ensure_today_check_in_v4)$/
const rewardMutationPattern = /(?:\/api\/economy-v1\/(?:attendance|purchase|room)|\/rest\/v1\/rpc\/(?:ensure_today_check_in_v4|secure_purchase|save_participant_room))/
let browser
let user

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function screenshot(page, filename) {
  const target = path.join(reviewDir, filename)
  await page.screenshot({ path:target, fullPage:true })
  assert((await fs.stat(target)).size > 500, `${filename} is empty`)
}

async function createContext(session = null, viewport = { width:1280, height:850 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor:1 })
  await context.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status:200,
    contentType:'text/css',
    body:'/* Local browser rehearsal intentionally uses the system fallback font. */',
  }))
  await context.addInitScript(() => {
    window.__rewardUnhandledRejections = []
    window.addEventListener('unhandledrejection', (event) => {
      window.__rewardUnhandledRejections.push(String(event.reason?.message || event.reason || 'unknown'))
    })
    localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  })
  if (session) {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key:storageKey, value:session,
    })
  }
  return context
}

function observePage(page) {
  const errors = []
  const failedRequests = []
  const unexpectedHttp = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const source = message.location().url
    errors.push(source ? `${message.text()} @ ${source}` : message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`))
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('/rest/v1/rpc/ensure_today_quests')) {
      unexpectedHttp.push(`${response.status()} ${response.url()}`)
    }
  })
  return { errors, failedRequests, unexpectedHttp }
}

async function assertCleanPage(page, diagnostics, label) {
  const unhandled = await page.evaluate(() => window.__rewardUnhandledRejections || [])
  const overlayCount = await page.locator('nextjs-portal [data-nextjs-dialog-overlay], [data-nextjs-error-overlay]').count()
  assert.deepEqual(diagnostics.errors, [], `${label} console/page errors`)
  assert.deepEqual(unhandled, [], `${label} unhandled rejections`)
  assert.deepEqual(diagnostics.failedRequests, [], `${label} unexpected failed requests`)
  assert.deepEqual(diagnostics.unexpectedHttp, [], `${label} unexpected HTTP failures`)
  assert.equal(overlayCount, 0, `${label} Next.js error overlay`)
}

async function waitForWorld(page, query = '') {
  await page.goto(`${appUrl}/${query ? `?${query}` : ''}`, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:30_000 })
  await page.getByRole('button', { name:'오늘의 퀘스트 열기' }).waitFor()
}

async function waitPanelState(page, testId, state) {
  await page.waitForFunction(({ testId: id, state: expected }) => (
    document.querySelector(`[data-testid="${id}"]`)?.dataset.state === expected
  ), { testId, state }, { timeout:20_000 })
}

async function cleanupCutoverRows() {
  if (expectedMode !== 'cutover') return
  const sql = `
    begin;
    alter table public.village_currency_ledger disable trigger village_currency_ledger_immutable;
    delete from public.multi_village_attendance_claims where participant_id='${participantId}';
    delete from public.multi_village_attendance_weeks where participant_id='${participantId}';
    delete from public.multi_village_character_equip_results where participant_id='${participantId}';
    delete from public.participant_multi_village_character_loadouts where participant_id='${participantId}';
    delete from public.participant_catalog_items where participant_id='${participantId}';
    delete from public.village_currency_ledger where participant_id='${participantId}';
    delete from public.participant_village_wallets where participant_id='${participantId}';
    alter table public.village_currency_ledger enable trigger village_currency_ledger_immutable;
    commit;`
  await new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      stdio:['ignore','ignore','pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr)))
  })
}

async function openQuest(page) {
  await page.getByRole('button', { name:'오늘의 퀘스트 열기' }).click()
  return page.getByTestId('quest-panel-state')
}

async function openAttendance(page) {
  await page.getByRole('button', { name:'출석 보상 열기' }).click()
  return page.getByTestId('attendance-panel-state')
}

async function runQaPreview() {
  const context = await createContext(null)
  const page = await context.newPage()
  const diagnostics = observePage(page)
  const rewardRequests = []
  const mutations = []
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (rewardRpcPattern.test(pathname) || pathname === '/api/economy-v1/attendance') rewardRequests.push(`${request.method()} ${pathname}`)
    if (request.method() !== 'GET' && rewardMutationPattern.test(pathname)) mutations.push(`${request.method()} ${pathname}`)
  })
  await waitForWorld(page, 'natureQa=1&worldHomeState=decorating')

  let panel = await openQuest(page)
  await waitPanelState(page, 'quest-panel-state', 'ready')
  await page.getByText('자연의 소리 3개 수집하기', { exact:true }).waitFor()
  await page.getByText('미리보기 · 실제 데이터와 보상은 변경되지 않음', { exact:true }).waitFor()
  await screenshot(page, 'qa-quest-panel.png')
  await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()
  panel = await openQuest(page)
  await waitPanelState(page, 'quest-panel-state', 'ready')
  await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()

  panel = await openAttendance(page)
  await waitPanelState(page, 'attendance-panel-state', 'ready')
  await page.getByText('오늘은 아직 출석 전이에요 · 연속 2일차 🔥', { exact:true }).waitFor()
  await screenshot(page, 'qa-attendance-before.png')
  const claim = page.getByRole('button', { name:'오늘 출석 보상 받기' })
  await claim.click()
  await page.getByRole('button', { name:'오늘 보상 받음' }).waitFor()
  assert.equal(await page.getByRole('button', { name:'오늘 보상 받음' }).isDisabled(), true)
  await screenshot(page, 'qa-attendance-claimed.png')
  await page.getByRole('button', { name:'출석 보상 닫기' }).click()

  await page.setViewportSize({ width:390, height:844 })
  panel = await openQuest(page)
  await waitPanelState(page, 'quest-panel-state', 'ready')
  await screenshot(page, 'mobile-portrait.png')
  await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()
  await page.setViewportSize({ width:1280, height:850 })

  assert.deepEqual(rewardRequests, [], 'QA preview called a real quest/attendance data source')
  assert.deepEqual(mutations, [], 'QA reward preview emitted a reward, purchase, or room mutation')
  assert.deepEqual(ok(await admin.from('study_participants').select('participant_id').in('participant_id', ['NATURE_QA_LOCAL','HUMAN_QA_LOCAL']), 'QA participants'), [])
  await assertCleanPage(page, diagnostics, 'QA preview')
  await context.close()
}

async function runAuthenticated(session) {
  const context = await createContext(session)
  const page = await context.newPage()
  const diagnostics = observePage(page)
  const rewardRequests = []
  const attendanceMutations = []
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (rewardRpcPattern.test(pathname) || pathname === '/api/economy-v1/attendance') rewardRequests.push(`${request.method()} ${pathname}`)
    if (request.method() === 'POST' && pathname === '/api/economy-v1/attendance') attendanceMutations.push(pathname)
  })
  await waitForWorld(page)

  if (expectedMode === 'maintenance') {
    await page.evaluate(() => document.querySelector('[aria-label="오늘의 퀘스트 열기"]')?.click())
    await page.getByTestId('quest-panel-state').getByText('점검 중에는 보상 정보를 조회하거나 지급하지 않아요.', { exact:true }).waitFor()
    await page.evaluate(() => document.querySelector('[aria-label="오늘의 퀘스트 닫기"]')?.click())
    await page.evaluate(() => document.querySelector('[aria-label="출석 보상 열기"]')?.click())
    await page.getByTestId('attendance-panel-state').getByText('점검 중에는 보상 정보를 조회하거나 지급하지 않아요.', { exact:true }).waitFor()
    assert.deepEqual(rewardRequests, [], 'maintenance made a reward request')
    assert.equal(ok(await admin.from('participant_attendance').select('id').eq('participant_id', participantId), 'maintenance attendance').length, 0)
    await assertCleanPage(page, diagnostics, 'maintenance')
    await context.close()
    return
  }

  if (expectedMode === 'cutover') {
    await page.evaluate(() => {
      const originalFetch = window.fetch.bind(window)
      let forcedQuestFailure = true
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url || ''
        if (forcedQuestFailure && url.includes('/rest/v1/rpc/ensure_today_quests')) {
          forcedQuestFailure = false
          return Promise.reject(new TypeError('Failed to fetch'))
        }
        return originalFetch(input, init)
      }
    })
    let panel = await openQuest(page)
    await waitPanelState(page, 'quest-panel-state', 'error')
    await page.getByText('네트워크 연결을 확인한 뒤 다시 시도해 주세요.', { exact:true }).waitFor()
    await screenshot(page, 'network-error-retry.png')
    await page.getByRole('button', { name:'다시 시도' }).click()
    await waitPanelState(page, 'quest-panel-state', 'ready')
    await screenshot(page, 'runtime-quest-panel.png')
    await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()

    panel = await openAttendance(page)
    await waitPanelState(page, 'attendance-panel-state', 'ready')
    await screenshot(page, 'runtime-attendance-before.png')

    const claimButton = page.getByRole('button', { name:'오늘 출석 보상 받기' })
    await claimButton.evaluate((button) => { button.click(); button.click() })
    await page.getByRole('button', { name:'오늘 보상 받음' }).waitFor({ timeout:20_000 })
    assert.equal(attendanceMutations.length, 1, 'rapid double click emitted duplicate attendance requests')
    await screenshot(page, 'runtime-attendance-claimed.png')
    const claims = ok(await admin.from('multi_village_attendance_claims').select('*').eq('participant_id', participantId), 'browser attendance claims')
    const ledger = ok(await admin.from('village_currency_ledger').select('*').eq('participant_id', participantId).eq('entry_type', 'earn_attendance'), 'browser attendance ledger')
    assert.equal(claims.length, 1, 'rapid double click created duplicate attendance claims')
    assert.equal(ledger.length, 1, 'rapid double click created duplicate attendance ledger rows')
    assert.equal(claims[0].operation_id, ledger[0].operation_id)

    await page.reload({ waitUntil:'domcontentloaded' })
    await page.getByTestId('world-map').waitFor({ timeout:30_000 })
    await openAttendance(page)
    await page.getByRole('button', { name:'오늘 보상 받음' }).waitFor({ timeout:20_000 })
  } else {
    let panel = await openQuest(page)
    await waitPanelState(page, 'quest-panel-state', 'ready')
    await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()
    panel = await openAttendance(page)
    await waitPanelState(page, 'attendance-panel-state', 'ready')
    await panel.getByText(/연속 \d+일차/).waitFor()
    const rows = ok(await admin.from('participant_attendance').select('*').eq('participant_id', participantId), 'legacy/preview attendance')
    const ledger = ok(await admin.from('currency_transactions').select('*').eq('participant_id', participantId).eq('type', 'earn_attendance'), 'legacy/preview ledger')
    assert.equal(rows.length, 1)
    assert.equal(ledger.length, 1)
  }

  await assertCleanPage(page, diagnostics, `${expectedMode} runtime`)
  await context.close()
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  browser = await chromium.launch({ headless:true })
  if (expectedMode === 'legacy') await runQaPreview()

  const signed = ok(await auth.auth.signInAnonymously(), 'browser sign in')
  user = signed.user
  ok(await admin.from('study_participants').insert({
    participant_id:participantId, auth_user_id:user.id, group_id:'A', status:'active',
  }), 'browser participant')
  ok(await auth.rpc('start_or_resume_study_session_v2', { p_client_instance_id:crypto.randomUUID() }), 'browser study session')
  await runAuthenticated(signed.session)
  console.log(`Quest/attendance ${expectedMode} browser E2E passed.`)
} finally {
  if (browser) await browser.close().catch(() => {})
  const participants = [participantId]
  await cleanupCutoverRows().catch((error) => console.error('cutover cleanup failed', error))
  for (const table of ['user_events','idempotent_operations','currency_transactions','participant_currency','participant_daily_quests','participant_attendance','study_sessions']) {
    await admin.from(table).delete().in('participant_id', participants)
  }
  await admin.from('study_participants').delete().in('participant_id', participants)
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
