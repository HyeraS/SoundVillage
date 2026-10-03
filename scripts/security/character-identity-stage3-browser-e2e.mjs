import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { WORLD_HOME, WORLD_MUSEUM, WORLD_PORTALS } from '../../lib/worldMapGeometry.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const appUrl = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const browserPhase = process.env.CHARACTER_IDENTITY_BROWSER_PHASE || 'all'
if (!appUrl || !supabaseUrl || !anonKey || !serviceKey) throw new Error('Local Stage 3 browser environment is incomplete')
if (!['all', 'live', 'qa'].includes(browserPhase)) throw new Error('Invalid Character Identity browser phase')
await requireLoopbackSupabaseUrl(appUrl, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const authClient = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantId = `IDENTITY_BROWSER_${suffix}`
const reviewDir = path.resolve('_review/character-studio-stage3')
let browser
let user

const savedIdentity = {
  skin_id:'skin_04', eyes_id:'eyes_blue', hair_style_id:'hair_braids', hair_color_id:'pink',
}
const identityAssets = [
  '/assets/character-v2/skin/skin-04-walk.png',
  '/assets/character-v2/eyes/blue-walk.png',
  '/assets/world/outfits/overalls.png',
  '/assets/character-v2/hair/braids/pink-walk.png',
  '/assets/character-v2/accessories/glasses-walk.png',
]

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function shot(page, filename) {
  const target = path.join(reviewDir, filename)
  await page.screenshot({ path:target, fullPage:true })
  assert((await fs.stat(target)).size > 500, `${filename} is empty`)
}

function worldQuery(target, extra = {}) {
  return new URLSearchParams({ worldStart:`${target.approach.x / 32},${target.approach.y / 32}`, ...extra }).toString()
}

async function waitWorld(page, query = '') {
  await page.goto(`${appUrl}/${query ? `?${query}` : ''}`, { waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:30_000 })
  await page.getByLabel('여섯 마을 지갑').waitFor({ timeout:20_000 })
}

async function enter(page, target, name, extra = {}) {
  await waitWorld(page, worldQuery(target, extra))
  await page.waitForFunction((expected) => document.querySelector('[data-testid="world-map"]')?.dataset.nearDestination === expected, name)
  await page.keyboard.press('Enter')
}

async function assetPaths(locator) {
  return locator.locator('img,image').evaluateAll((elements) => elements.map((element) => {
    const value = element.getAttribute('src') || element.getAttribute('href') || ''
    try { return new URL(value, location.href).pathname } catch { return value }
  }))
}

async function expectIdentityLayers(locator) {
  await locator.locator('img[src="/assets/character-v2/skin/skin-04-walk.png"],image[href="/assets/character-v2/skin/skin-04-walk.png"]').first().waitFor({ timeout:20_000 })
  const paths = await assetPaths(locator)
  const start = paths.findIndex((value) => value === identityAssets[0])
  assert.deepEqual(paths.slice(start, start + identityAssets.length), identityAssets)
}

async function expectInteriorIdentityLayers(locator) {
  await locator.locator('[data-interior-character-layer="skin"]').waitFor({ timeout:20_000 })
  assert.deepEqual(
    await locator.locator('[data-interior-character-layer]').evaluateAll((elements) => elements.map((element) => element.dataset.layerSrc)),
    identityAssets,
  )
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  const auth = ok(await authClient.auth.signInAnonymously(), 'browser sign-in')
  user = auth.user
  ok(await admin.from('study_participants').insert({
    participant_id:participantId, auth_user_id:user.id, group_id:'A', status:'active',
  }), 'browser participant')
  ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:user.id }), 'initialize profile')
  ok(await admin.from('participant_catalog_items').insert([
    { participant_id:participantId, item_id:'overalls', acquisition_source:'completion_reward' },
    { participant_id:participantId, item_id:'acc_glasses', acquisition_source:'completion_reward' },
  ]), 'seed owned items')
  ok(await admin.from('participant_multi_village_character_loadouts').update({
    outfit_id:'overalls', accessory_id:'acc_glasses',
  }).eq('participant_id', participantId), 'seed commerce loadout')

  browser = await chromium.launch({ headless:true })
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, deviceScaleFactor:1 })
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session))
    localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  }, { key:storageKey, session:auth.session })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const consoleErrors = []
  const pageErrors = []
  const failedAssets = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/assets/') && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`)
  })

  if (browserPhase !== 'qa') {
  await enter(page, WORLD_MUSEUM, 'Sound Library', { libraryQaCard:'shop' })
  await page.getByTestId('character-studio').waitFor()
  const identityTab = page.getByRole('tab', { name:'기본 외형' })
  await identityTab.waitFor()
  await identityTab.click()
  await page.getByTestId('identity-customization-panel').waitFor()
  await shot(page, 'live-identity-tab.png')

  const beforePreview = ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'before preview')
  await page.getByTestId('identity-option-skin_04').click()
  await page.getByTestId('character-studio-preview').locator('img[src="/assets/character-v2/skin/skin-04-walk.png"]').waitFor()
  await shot(page, 'live-skin-preview-unsaved.png')
  await page.getByTestId('identity-option-hair_braids').click()
  await page.getByTestId('identity-option-pink').click()
  await page.getByTestId('character-studio-preview').locator('img[src="/assets/character-v2/hair/braids/pink-walk.png"]').waitFor()
  await shot(page, 'live-hair-preview-unsaved.png')
  await page.getByTestId('identity-option-eyes_blue').click()
  await page.getByTestId('character-studio-preview').locator('img[src="/assets/character-v2/eyes/blue-walk.png"]').waitFor()
  await shot(page, 'live-eyes-preview-unsaved.png')
  const afterPreview = ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'after preview')
  assert.deepEqual(afterPreview, beforePreview, 'preview changed the database')

  const saveKeys = []
  let failOnce = true
  await page.route('**/api/economy-v1/character-identity', async (route) => {
    saveKeys.push(route.request().postDataJSON().idempotencyKey)
    if (failOnce) {
      failOnce = false
      await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ ok:false, code:'storage_retryable', retryable:true }) })
    } else await route.continue()
  })
  await page.getByTestId('identity-save').click()
  await page.getByRole('alert').filter({ hasText:'같은 요청으로 안전하게 다시 시도' }).waitFor()
  await shot(page, 'live-save-network-retry.png')
  assert.deepEqual(ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'after failed save'), beforePreview)
  await page.getByRole('button', { name:'같은 요청 재시도' }).click()
  await page.getByRole('status').filter({ hasText:'현재 캐릭터에 바로 적용' }).waitFor()
  await page.unroute('**/api/economy-v1/character-identity')
  assert.equal(saveKeys.length, 2)
  assert.equal(saveKeys[0], saveKeys[1], 'retryable identity save must retain the key')
  const saved = ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'saved identity')
  assert.deepEqual({
    skin_id:saved.skin_id, eyes_id:saved.eyes_id, hair_style_id:saved.hair_style_id, hair_color_id:saved.hair_color_id,
  }, savedIdentity)
  assert.equal(saved.outfit_id, 'overalls')
  assert.equal(saved.accessory_id, 'acc_glasses')
  assert.equal(ok(await admin.from('multi_village_character_identity_results').select('idempotency_key').eq('idempotency_key', saveKeys[0]), 'save result rows').length, 1)
  await expectIdentityLayers(page.getByTestId('character-studio-preview'))
  await shot(page, 'live-identity-save-success.png')

  await page.reload({ waitUntil:'domcontentloaded' })
  await page.getByTestId('world-map').waitFor({ timeout:30_000 })
  await page.waitForFunction(() => document.querySelector('[data-testid="world-map"]')?.dataset.nearDestination === 'Sound Library')
  await page.keyboard.press('Enter')
  await page.getByTestId('character-studio').waitFor()
  await page.getByRole('tab', { name:'기본 외형' }).click()
  await expectIdentityLayers(page.getByTestId('character-studio-preview'))
  await shot(page, 'live-reload-restored.png')

  await page.setViewportSize({ width:390, height:844 })
  await shot(page, 'mobile-live-customization.png')
  await page.setViewportSize({ width:1440, height:1000 })

  await waitWorld(page)
  await expectIdentityLayers(page.getByTestId('world-player'))
  await shot(page, 'live-world-saved-character.png')
  const villageFiles = new Map([
    ['Animal','live-animal-saved-character.png'], ['Human','live-human-saved-character.png'],
    ['Nature','live-nature-saved-character.png'], ['Urban','live-urban-saved-character.png'],
    ['Music','live-music-saved-character.png'], ['Lab','live-lab-saved-character.png'],
  ])
  for (const portal of WORLD_PORTALS) {
    await enter(page, portal, portal.zone)
    const zoneRoot = portal.zone === 'Lab'
      ? page.getByTestId('lab-village')
      : page.locator(`[data-zone-hud="${portal.zone}"]`)
    await zoneRoot.waitFor()
    await expectIdentityLayers(page.locator('body'))
    await shot(page, villageFiles.get(portal.zone))
  }

  await enter(page, WORLD_MUSEUM, 'Sound Library')
  await expectIdentityLayers(page.getByTestId('museum-player'))
  await shot(page, 'live-library-saved-character.png')

  await enter(page, WORLD_HOME, 'Home')
  await page.getByTestId('interior-player').waitFor()
  await expectInteriorIdentityLayers(page.getByTestId('interior-player'))
  await shot(page, 'live-interior-saved-character.png')
  }

  if (browserPhase !== 'live') {
  const identityMutations = []
  const beforeQa = ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'before QA')
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/economy-v1/character-identity') identityMutations.push(request.url())
  })
  await page.goto(`${appUrl}/character-studio-test?mode=qa`, { waitUntil:'domcontentloaded' })
  await page.getByRole('tab', { name:'기본 외형' }).click()
  await page.getByTestId('identity-option-skin_06').click()
  await page.getByTestId('identity-save').click()
  await page.getByRole('status').filter({ hasText:'실제 DB에는 저장되지 않았어요' }).waitFor()
  await shot(page, 'qa-identity-local-only.png')
  assert.deepEqual(identityMutations, [])
  assert.deepEqual(ok(await admin.from('participant_multi_village_character_loadouts').select('*').eq('participant_id', participantId).single(), 'after QA'), beforeQa)

  await page.goto(`${appUrl}/character-studio-test?mode=legacy`, { waitUntil:'domcontentloaded' })
  await page.getByTestId('character-studio').waitFor()
  assert.equal(await page.getByRole('tab', { name:'기본 외형' }).count(), 0)
  await shot(page, 'legacy-identity-hidden.png')
  }

  assert.deepEqual(failedAssets, [], `asset request failures:\n${failedAssets.join('\n')}`)
  assert.deepEqual(pageErrors, [], `page errors:\n${pageErrors.join('\n')}`)
  assert.deepEqual(consoleErrors, [], `console errors:\n${consoleErrors.join('\n')}`)
  assert.equal(await page.locator('nextjs-portal').count(), 0, 'Next.js error overlay found')
  console.log(`Stage 3 Character Identity ${browserPhase} browser E2E passed.`)
} finally {
  if (browser) await browser.close().catch(() => {})
  await admin.from('study_participants').delete().eq('participant_id', participantId)
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
