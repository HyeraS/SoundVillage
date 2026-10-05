import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const appUrl = process.env.CHARACTER_STUDIO_APP_URL || 'http://127.0.0.1:3100'
const parsed = new URL(appUrl)
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('CHARACTER_STUDIO_APP_URL must be loopback-only')

const reviewDir = path.resolve(process.env.CHARACTER_STUDIO_REVIEW_DIR || '_review/character-studio-stage1')
const stage2ReviewDir = path.resolve(process.env.CHARACTER_STUDIO_STAGE2_REVIEW_DIR || '_review/character-studio-stage2')
const baseQuery = 'natureQa=1&worldHomeState=decorating&worldAutoWalk=Sound%20Library&libraryQaCard=shop'
const mutationRequests = []
const consoleErrors = []
const pageErrors = []
let browser

function watch(page) {
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return
    const url = new URL(request.url())
    const persistence = url.pathname === '/api/participant-purchase'
      || /^\/api\/economy-v1\/(?:purchase|equip|room|attendance)$/.test(url.pathname)
      || /\/rest\/v1\/(?:rpc\/(?:set_equipped_outfit|secure_purchase|equip_multi_village_character_item)|participant_(?:outfits|catalog_items|multi_village_character_loadouts))/.test(url.pathname)
    if (persistence) mutationRequests.push(`${request.method()} ${request.url()}`)
  })
}

async function contextFor(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor:1 })
  await context.addInitScript(() => {
    window.__characterStudioUnhandled = []
    window.addEventListener('unhandledrejection', (event) => {
      window.__characterStudioUnhandled.push(String(event.reason?.message || event.reason || 'unknown'))
    })
    window.localStorage.setItem('soundvillage-home-hub-intro-v1', 'seen')
  })
  return context
}

async function enterStudio(page, extra = '') {
  watch(page)
  await page.goto(`${appUrl}/?${baseQuery}${extra}`, { waitUntil:'domcontentloaded' })
  await page.waitForSelector('[data-testid="world-map"][data-auto-walk-arrived="true"]', { timeout:30_000 })
  await page.keyboard.press('Enter')
  const studio = page.getByTestId('character-studio')
  await studio.waitFor({ timeout:20_000 })
  return studio
}

async function screenshot(page, filename, directory = reviewDir) {
  const target = path.join(directory, filename)
  await page.screenshot({ path:target, fullPage:true })
  assert((await fs.stat(target)).size > 1_000, `${filename} is empty`)
}

async function assertNoRuntimeFailure(page) {
  const unhandled = await page.evaluate(() => window.__characterStudioUnhandled || [])
  assert.deepEqual(unhandled, [], `unhandledrejection: ${unhandled.join('\n')}`)
  const overlay = await page.evaluate(() => {
    const shadow = document.querySelector('nextjs-portal')?.shadowRoot
    return shadow?.querySelector('[data-nextjs-dialog-overlay], [data-nextjs-dialog]')?.textContent?.slice(0, 500) || ''
  })
  assert.equal(overlay, '', `Next.js error overlay: ${overlay}`)
}

async function assertPreviewGeometry(page, expected, label) {
  const geometry = await page.getByTestId('character-studio-preview').evaluate((stage) => {
    const sprite = stage.querySelector(':scope > div')
    if (!sprite) throw new Error('large preview sprite not found')
    const matrix = new DOMMatrixReadOnly(getComputedStyle(sprite).transform)
    const stageRect = stage.getBoundingClientRect()
    const thumbnail = document.querySelector('[data-testid="studio-item-basic"] button')?.getBoundingClientRect()
    return {
      stageWidth:stageRect.width,
      stageHeight:stageRect.height,
      spriteScale:Math.hypot(matrix.a, matrix.b),
      thumbnailWidth:thumbnail?.width,
      thumbnailHeight:thumbnail?.height,
    }
  })
  assert.ok(Math.abs(geometry.spriteScale - expected.spriteScale) < .001, `${label} large preview scale changed: ${geometry.spriteScale}`)
  assert.ok(Math.abs(geometry.stageWidth - expected.stageSize) < .01, `${label} circular stage width changed: ${geometry.stageWidth}`)
  assert.ok(Math.abs(geometry.stageHeight - expected.stageSize) < .01, `${label} circular stage height changed: ${geometry.stageHeight}`)
  assert.ok(Math.abs(geometry.thumbnailWidth - expected.thumbnailSize) < .01, `${label} product thumbnail width changed: ${geometry.thumbnailWidth}`)
  assert.ok(Math.abs(geometry.thumbnailHeight - expected.thumbnailSize) < .01, `${label} product thumbnail height changed: ${geometry.thumbnailHeight}`)
}

try {
  await fs.mkdir(reviewDir, { recursive:true })
  await fs.mkdir(stage2ReviewDir, { recursive:true })
  browser = await chromium.launch({ headless:true })

  const desktopContext = await contextFor({ width:1280, height:800 })
  const page = await desktopContext.newPage()
  const studio = await enterStudio(page)
  assert.equal(await studio.getAttribute('data-studio-environment'), 'qa')
  assert.equal(await page.getByTestId('studio-qa-notice').count(), 1)
  assert.equal(await page.locator('[data-testid^="studio-item-"]').count(), 19, '18 paid outfits plus basic must be visible')
  assert.equal(await page.locator('[data-character-layer]').count(), 4, 'saved outfit and accessory must use four world layers')
  await assertPreviewGeometry(page, { spriteScale:.8, stageSize:210, thumbnailSize:84 }, 'desktop')
  await screenshot(page, 'qa-dry-run.png')

  const outfitTab = page.getByRole('tab', { name:/의상 19/ })
  await outfitTab.focus()
  await page.keyboard.press('End')
  assert.equal(await page.getByRole('tab', { name:/액세서리 8/ }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByRole('tab', { name:/액세서리 8/ }).getAttribute('tabindex'), '0')
  await page.keyboard.press('Home')
  assert.equal(await page.getByRole('tab', { name:'기본 외형' }).getAttribute('aria-selected'), 'true')
  await page.keyboard.press('ArrowRight')
  assert.equal(await outfitTab.getAttribute('aria-selected'), 'true')

  const savedOutfitLayer = await page.locator('[data-character-layer="1"]').getAttribute('data-layer-src')
  await page.getByTestId('studio-item-witch').locator('button').first().click()
  assert.equal(await studio.getAttribute('data-preview-active'), 'true')
  assert.equal(await page.locator('[data-character-layer="1"]').getAttribute('data-layer-src'), '/assets/world/outfits/witch.png')
  assert.deepEqual(mutationRequests, [], 'preview emitted a persistence mutation')
  await screenshot(page, 'desktop-outfit-preview.png')
  await page.getByRole('button', { name:'저장된 상태로 원래대로' }).click()
  assert.equal(await page.locator('[data-character-layer="1"]').getAttribute('data-layer-src'), savedOutfitLayer)

  await page.getByRole('tab', { name:/액세서리 8/ }).click()
  assert.equal(await page.locator('[data-testid^="studio-item-acc_"]').count(), 8)
  await page.getByTestId('studio-item-acc_hat_cowboy').locator('button').first().click()
  assert.equal(await page.locator('[data-character-layer="3"]').getAttribute('data-layer-src'), '/assets/character-v2/accessories/hat_cowboy-walk.png')
  await screenshot(page, 'desktop-accessory-preview.png')

  await page.getByRole('tab', { name:/의상 19/ }).click()
  const sailor = page.getByTestId('studio-item-sailor')
  await sailor.getByTestId('studio-action-sailor').click()
  const dialog = page.getByRole('dialog', { name:/세일러 룩/ })
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /미리 착용/)
  assert.match(await dialog.innerText(), /구매 후 바로 장착/)
  const purchaseButton = page.getByRole('button', { name:'구매하고 장착' })
  await purchaseButton.waitFor()
  assert.equal(await purchaseButton.evaluate((button) => document.activeElement === button), true, 'dialog primary action did not receive focus')
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('button', { name:'취소' }).evaluate((button) => document.activeElement === button), true, 'dialog focus did not wrap to the first control')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await purchaseButton.evaluate((button) => document.activeElement === button), true, 'dialog focus did not wrap back to the last control')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state:'detached' })
  await page.waitForFunction(() => document.activeElement?.closest('[data-testid="studio-item-sailor"]'))
  assert.equal(await sailor.getByTestId('studio-action-sailor').evaluate((button) => document.activeElement === button), true, 'dialog trigger focus was not restored')
  await sailor.getByTestId('studio-action-sailor').click()
  await page.getByRole('dialog', { name:/세일러 룩/ }).waitFor()
  await screenshot(page, 'desktop-purchase-confirmation.png')
  await page.getByRole('button', { name:'구매하고 장착' }).click()
  await page.getByText('세일러 룩 구매 및 장착을 완료했어요.').waitFor()
  assert.equal(await sailor.getByTestId('studio-action-sailor').textContent(), '장착됨')
  assert.equal(await studio.getAttribute('data-preview-active'), 'false')
  await screenshot(page, 'desktop-equipped.png')

  await page.getByRole('tab', { name:/액세서리 8/ }).click()
  const cowboy = page.getByTestId('studio-item-acc_hat_cowboy')
  await cowboy.getByTestId('studio-action-acc_hat_cowboy').click()
  await page.getByRole('button', { name:'구매하고 장착' }).click()
  await page.getByText('카우보이 모자 구매 및 장착을 완료했어요.').waitFor()
  await page.getByTestId('studio-item-none').getByRole('button', { name:'미착용으로 저장' }).click()
  await page.getByText('액세서리 미착용 상태를 저장했어요.').waitFor()
  assert.equal(await page.locator('[data-character-layer="3"]').count(), 0)

  await page.reload({ waitUntil:'domcontentloaded' })
  await page.waitForSelector('[data-testid="world-map"][data-auto-walk-arrived="true"]', { timeout:30_000 })
  await page.keyboard.press('Enter')
  await page.getByTestId('character-studio').waitFor()
  await page.getByRole('tab', { name:/의상 19/ }).click()
  assert.equal(await page.getByTestId('studio-action-sailor').textContent(), '장착됨', 'QA session did not retain the saved outfit')
  assert.deepEqual(mutationRequests, [], 'QA flow emitted a persistence mutation')
  await assertNoRuntimeFailure(page)
  await desktopContext.close()

  for (const [filename, viewport, expected] of [
    ['mobile-600x800.png', { width:600, height:800 }, { spriteScale:.6, stageSize:142, thumbnailSize:70 }],
    ['mobile-portrait.png', { width:390, height:844 }, { spriteScale:.544, stageSize:128, thumbnailSize:74 }],
    ['mobile-landscape.png', { width:844, height:390 }, { spriteScale:.456, stageSize:108, thumbnailSize:64 }],
  ]) {
    const context = await contextFor(viewport)
    const mobile = await context.newPage()
    await enterStudio(mobile)
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${filename} has horizontal page scroll`)
    await mobile.getByRole('button', { name:'저장된 상태로 원래대로' }).waitFor()
    await assertPreviewGeometry(mobile, expected, filename)
    await mobile.getByTestId('studio-action-sailor').scrollIntoViewIfNeeded()
    await screenshot(mobile, filename)
    await assertNoRuntimeFailure(mobile)
    await context.close()
  }

  const errorContext = await contextFor({ width:1280, height:800 })
  const errorPage = await errorContext.newPage()
  await enterStudio(errorPage, '&characterStudioLoadError=1')
  await errorPage.getByTestId('studio-load-error').waitFor()
  await screenshot(errorPage, 'load-error-retry.png')
  await errorPage.getByRole('button', { name:'다시 시도' }).click()
  await errorPage.getByTestId('character-studio').getByTestId('character-studio-preview').waitFor()
  await assertNoRuntimeFailure(errorPage)
  await errorContext.close()

  const stage2Context = await contextFor({ width:1280, height:800 })
  const stage2 = await stage2Context.newPage()
  watch(stage2)
  await stage2.goto(`${appUrl}/character-studio-test?mode=qa`, { waitUntil:'domcontentloaded' })
  const stage2Studio = stage2.getByTestId('character-studio')
  await stage2Studio.waitFor({ timeout:20_000 })
  await stage2.getByRole('tab', { name:'기본 외형' }).click()
  assert.equal(await stage2.getByTestId('identity-skins').locator('button').count(), 8)
  assert.equal(await stage2.getByTestId('identity-hair-styles').locator('button').count(), 13)
  assert.equal(await stage2.getByTestId('identity-hair-colors').locator('button').count(), 14)
  assert.equal(await stage2.getByTestId('identity-eyes').locator('button').count(), 14)

  await stage2.getByTestId('identity-option-skin_02').focus()
  await stage2.keyboard.press('Space')
  assert.equal(await stage2.getByTestId('identity-option-skin_02').getAttribute('aria-pressed'), 'true', 'keyboard selection failed')

  await stage2.getByTestId('identity-option-skin_08').click()
  assert.equal(await stage2.locator('[data-layer-kind="skin"]').getAttribute('data-layer-src'), '/assets/character-v2/skin/skin-08-walk.png')
  await screenshot(stage2, 'desktop-skin-preview.png', stage2ReviewDir)
  await stage2.getByTestId('identity-option-hair_wavy').click()
  assert.equal(await stage2.locator('[data-layer-kind="hair"]').getAttribute('data-layer-src'), '/assets/character-v2/hair/wavy/black-walk.png')
  await screenshot(stage2, 'desktop-hair-style-preview.png', stage2ReviewDir)
  await stage2.getByTestId('identity-option-turquoise').click()
  assert.equal(await stage2.locator('[data-layer-kind="hair"]').getAttribute('data-layer-src'), '/assets/character-v2/hair/wavy/turquoise-walk.png')
  await screenshot(stage2, 'desktop-hair-color-preview.png', stage2ReviewDir)
  await stage2.getByTestId('identity-option-eyes_red').click()
  assert.equal(await stage2.locator('[data-layer-kind="eyes"]').getAttribute('data-layer-src'), '/assets/character-v2/eyes/red-walk.png')
  await screenshot(stage2, 'desktop-eyes-preview.png', stage2ReviewDir)

  await stage2.getByRole('tab', { name:/의상 19/ }).click()
  await stage2.getByTestId('studio-item-witch').locator('button').first().click()
  await stage2.getByRole('tab', { name:/액세서리 8/ }).click()
  await stage2.getByTestId('studio-item-acc_hat_cowboy').locator('button').first().click()
  assert.equal(await stage2.locator('[data-layer-kind="outfit"]').getAttribute('data-layer-src'), '/assets/world/outfits/witch.png')
  assert.equal(await stage2.locator('[data-layer-kind="accessory"]').getAttribute('data-layer-src'), '/assets/character-v2/accessories/hat_cowboy-walk.png')
  await screenshot(stage2, 'desktop-full-combination.png', stage2ReviewDir)

  const directionFiles = []
  for (const [name, label] of [['down', '앞 보기'], ['left', '왼쪽 보기'], ['up', '뒤 보기'], ['right', '오른쪽 보기']]) {
    await stage2.getByRole('button', { name:label }).click()
    assert.equal(await stage2.getByRole('button', { name:label }).getAttribute('aria-pressed'), 'true')
    const target = path.join(stage2ReviewDir, `.direction-${name}.png`)
    await stage2.getByTestId('character-studio-preview').screenshot({ path:target })
    directionFiles.push(target)
  }
  const montage = spawnSync('python3', ['-c', [
    'from PIL import Image,ImageDraw',
    'import sys',
    'ims=[Image.open(p).convert("RGBA") for p in sys.argv[2:]]',
    'out=Image.new("RGBA",(sum(i.width for i in ims),max(i.height for i in ims)+28),"#f8f0df")',
    'x=0; d=ImageDraw.Draw(out)',
    'labels=["Front","Left","Back","Right"]',
    'for label,im in zip(labels,ims): out.alpha_composite(im,(x,28)); d.text((x+8,7),label,fill="#352414"); x+=im.width',
    'out.save(sys.argv[1])',
  ].join('\n'), path.join(stage2ReviewDir, 'desktop-four-directions.png'), ...directionFiles], { encoding:'utf8' })
  assert.equal(montage.status, 0, montage.stderr)
  await Promise.all(directionFiles.map((file) => fs.unlink(file)))

  await stage2.getByRole('tab', { name:'기본 외형' }).click()
  await stage2.getByRole('button', { name:/QA 상태로 저장/ }).click()
  await stage2.getByText(/QA 로컬 외형 상태로 저장했어요/).waitFor()
  await stage2.reload({ waitUntil:'domcontentloaded' })
  await stage2.getByTestId('character-studio').waitFor()
  assert.equal(await stage2.locator('[data-layer-kind="skin"]').getAttribute('data-layer-src'), '/assets/character-v2/skin/skin-08-walk.png', 'QA session identity did not survive reload')
  assert.deepEqual(mutationRequests, [], 'Stage 2 QA emitted a persistence mutation')
  await assertNoRuntimeFailure(stage2)
  await stage2Context.close()

  for (const [filename, viewport] of [
    ['mobile-portrait-customization.png', { width:390, height:844 }],
    ['mobile-landscape-customization.png', { width:844, height:390 }],
  ]) {
    const context = await contextFor(viewport)
    const mobile = await context.newPage()
    watch(mobile)
    await mobile.goto(`${appUrl}/character-studio-test?mode=qa`, { waitUntil:'domcontentloaded' })
    await mobile.getByTestId('character-studio').waitFor()
    await mobile.getByRole('tab', { name:'기본 외형' }).click()
    await mobile.getByTestId('identity-hair-colors').scrollIntoViewIfNeeded()
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${filename} has horizontal page scroll`)
    await screenshot(mobile, filename, stage2ReviewDir)
    await assertNoRuntimeFailure(mobile)
    await context.close()
  }

  for (const mode of ['legacy', 'cutover']) {
    const context = await contextFor({ width:1280, height:800 })
    const live = await context.newPage()
    watch(live)
    await live.goto(`${appUrl}/character-studio-test?mode=${mode}`, { waitUntil:'domcontentloaded' })
    const liveStudio = live.getByTestId('character-studio')
    await liveStudio.waitFor()
    assert.equal(await live.getByRole('tab', { name:'기본 외형' }).count(), 0, `${mode} exposed identity customization`)
    await live.getByTestId('studio-item-witch').locator('button').first().click()
    assert.equal(await live.locator('[data-layer-kind="outfit"]').getAttribute('data-layer-src'), '/assets/world/outfits/witch.png')
    const action = live.getByTestId('studio-action-sailor')
    await action.click()
    await live.getByRole('button', { name:'구매하고 장착' }).click()
    await live.getByText('세일러 룩 구매 및 장착을 완료했어요.').waitFor()
    if (mode === 'cutover') await screenshot(live, 'live-mode-identity-hidden.png', stage2ReviewDir)
    await assertNoRuntimeFailure(live)
    await context.close()
  }

  assert.deepEqual(consoleErrors, [], `console.error: ${consoleErrors.join('\n')}`)
  assert.deepEqual(pageErrors, [], `pageerror: ${pageErrors.join('\n')}`)
  assert.deepEqual(mutationRequests, [], `persistence mutations: ${mutationRequests.join('\n')}`)
  console.log('Character Studio Stage 1 + Stage 2 browser E2E passed with QA identity, live-mode hiding, mobile layouts, and zero persistence mutations.')
} finally {
  await browser?.close()
}
