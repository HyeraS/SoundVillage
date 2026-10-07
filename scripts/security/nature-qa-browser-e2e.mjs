import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const appUrl = process.env.NATURE_QA_APP_URL || 'http://127.0.0.1:3100'
const parsedAppUrl = new URL(appUrl)
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedAppUrl.hostname)) {
  throw new Error('NATURE_QA_APP_URL must be loopback-only')
}

const reproductionUrl = new URL('/?natureQa=1&worldHomeState=decorating', parsedAppUrl)
const museumUrl = new URL(reproductionUrl)
museumUrl.searchParams.set('worldAutoWalk', 'Sound Library')
museumUrl.searchParams.set('libraryQaCard', 'shop')

let browser
const consoleErrors = []
const pageErrors = []
const forbiddenPersistence = []

function watch(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return
    const { pathname, hostname } = new URL(request.url())
    const isKnownMutation = pathname === '/api/participant-purchase'
      || /^\/api\/economy-v1\/(?:purchase|equip|room)$/.test(pathname)
      || /\/rest\/v1\/rpc\/(?:ensure_today_quests|get_attendance_status|ensure_today_check_in_v4|set_equipped_outfit_v3|secure_purchase|save_participant_room)/.test(pathname)
      || hostname.includes('supabase') && pathname.startsWith('/rest/v1/') && !pathname.includes('/rpc/')
    if (isKnownMutation) forbiddenPersistence.push(`${request.method()} ${request.url()}`)
  })
}

async function installUnhandledRejectionProbe(context) {
  await context.addInitScript(() => {
    window.__natureQaUnhandledRejections = []
    window.addEventListener('unhandledrejection', (event) => {
      window.__natureQaUnhandledRejections.push(String(event.reason?.message || event.reason || 'unknown rejection'))
    })
    window.localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  })
}

async function assertNoNextOverlay(page) {
  const overlay = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal')
    const shadow = portal?.shadowRoot
    const text = shadow?.textContent || ''
    const dialog = shadow?.querySelector('[data-nextjs-dialog-overlay], [data-nextjs-dialog]')
    return dialog ? text.slice(0, 500) : ''
  })
  assert.equal(overlay, '', `Next.js error overlay is visible: ${overlay}`)
}

async function assertNoRuntimeFailures(page) {
  const unhandled = await page.evaluate(() => window.__natureQaUnhandledRejections || [])
  assert.deepEqual(unhandled, [], `unhandledrejection: ${unhandled.join('\n')}`)
  await assertNoNextOverlay(page)
}

try {
  browser = await chromium.launch({ headless:true })
  const context = await browser.newContext({ viewport:{ width:1280, height:800 }, deviceScaleFactor:1 })
  await installUnhandledRejectionProbe(context)
  const page = await context.newPage()
  watch(page)

  await page.goto(reproductionUrl.href, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:30_000 })

  await page.getByRole('button', { name:'오늘의 퀘스트 열기' }).click()
  const questState = page.getByTestId('quest-panel-state')
  await questState.waitFor({ timeout:5_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="quest-panel-state"]')?.dataset.state === 'ready')
  await page.getByText('자연의 소리 3개 수집하기').waitFor()
  assert.equal(await page.getByTestId('qa-preview-notice').count(), 1)
  await page.getByRole('button', { name:'오늘의 퀘스트 닫기' }).click()

  await page.getByRole('button', { name:'출석 보상 열기' }).click()
  const attendanceState = page.getByTestId('attendance-panel-state')
  await attendanceState.waitFor({ timeout:5_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="attendance-panel-state"]')?.dataset.state === 'ready')
  await page.getByRole('button', { name:'오늘 출석 보상 받기' }).click()
  await page.getByRole('button', { name:'오늘 보상 받음' }).waitFor()
  await page.getByRole('button', { name:'출석 보상 닫기' }).click()

  await page.getByRole('button', { name:'우리 집 꾸미기 열기' }).click()
  const room = page.locator('[data-interior-room="ready"]')
  await room.waitFor({ timeout:10_000 })
  await page.getByTestId('interior-preview-notice').waitFor()
  const initialRoomCount = Number(await room.getAttribute('data-room-item-count'))
  await page.getByRole('button', { name:'상점', exact:true }).click()
  const interiorShop = page.getByRole('dialog', { name:'인테리어 상점' })
  await interiorShop.waitFor()
  const plant = interiorShop.locator('[data-interior-shop-item="plant_tall"]')
  await plant.getByRole('button').click()
  await page.getByRole('dialog', { name:'키 큰 화분' }).getByRole('button', { name:'바로 놓기' }).click()
  await page.getByRole('button', { name:'바닥 5행 1열에 배치' }).click()
  await page.getByRole('button', { name:'저장하기' }).click()
  await page.waitForFunction(() => document.querySelector('[data-interior-room]')?.dataset.interiorMode === 'view')
  assert.equal(Number(await room.getAttribute('data-room-item-count')), initialRoomCount + 1)
  await page.getByText('미리보기 방을 저장했어요').waitFor()
  await assertNoRuntimeFailures(page)

  await page.goto(museumUrl.href, { waitUntil:'domcontentloaded' })
  const world = page.getByTestId('world-map')
  await world.waitFor({ timeout:30_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.autoWalkArrived === 'true', null, { timeout:30_000 })
  await page.keyboard.press('Enter')
  const outfitShop = page.getByTestId('character-studio')
  await outfitShop.waitFor({ timeout:10_000 })
  assert.equal(await outfitShop.getAttribute('data-studio-state'), 'ready')
  assert.equal(await outfitShop.getAttribute('data-studio-environment'), 'qa')
  await page.getByTestId('studio-qa-notice').waitFor()
  assert.equal(await outfitShop.locator('[data-testid^="studio-item-"]').count(), 19)

  const animalWallet = outfitShop.getByLabel('여섯 마을 지갑').locator('div').filter({ hasText:/^동물50$/ }).first()
  const beforeAnimal = Number(await animalWallet.locator('strong').textContent())
  await page.getByTestId('studio-action-sailor').click()
  await page.getByRole('button', { name:'구매하고 장착' }).click()
  await page.getByText(/세일러 룩 구매 및 장착을 완료/).waitFor()
  const afterAnimal = Number(await animalWallet.locator('strong').textContent())
  assert.equal(afterAnimal, beforeAnimal, 'sailor should not charge the Animal wallet')
  await page.getByTestId('studio-action-floral').click()
  await page.getByText(/플로럴 의상 장착을 저장/).waitFor()
  assert.equal(await page.getByTestId('studio-action-floral').textContent(), '장착됨')

  await assertNoRuntimeFailures(page)
  assert.deepEqual(consoleErrors, [], `console.error: ${consoleErrors.join('\n')}`)
  assert.deepEqual(pageErrors, [], `pageerror: ${pageErrors.join('\n')}`)
  assert.deepEqual(forbiddenPersistence, [], `QA persistence calls: ${forbiddenPersistence.join('\n')}`)
  console.log('Nature QA browser reliability passed: quests, attendance, outfit shop, and interior dry-run flows are finite and local-only.')
} finally {
  await browser?.close()
}
