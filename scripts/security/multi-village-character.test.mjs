import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('009 adds an isolated, one-row-per-participant Character loadout', async () => {
  const sql = await read('scripts/security/009_multi_village_character_loadout.sql')
  assert.match(sql, /create table public\.participant_multi_village_character_loadouts/i)
  assert.match(sql, /participant_id text primary key/i)
  assert.match(sql, /outfit_id text not null default 'basic'/i)
  assert.match(sql, /accessory_id text/i)
  assert.doesNotMatch(sql, /(?:alter|update|delete from|insert into) public\.participant_equipped_outfit/i)
  assert.doesNotMatch(sql, /(?:alter|update|delete from|insert into) public\.participant_currency/i)
})

test('009 keeps browser writes disabled and equips through service role with ownership checks', async () => {
  const sql = await read('scripts/security/009_multi_village_character_loadout.sql')
  assert.match(sql, /participant_multi_village_character_loadouts_select_own[\s\S]*private\.current_participant_id\(\)/i)
  assert.match(sql, /revoke all on public\.participant_multi_village_character_loadouts[\s\S]*from public,anon,authenticated/i)
  assert.match(sql, /grant select on public\.participant_multi_village_character_loadouts to authenticated/i)
  assert.match(sql, /equip_multi_village_character_item_admin[\s\S]*service_role_required/i)
  assert.match(sql, /participant_catalog_items[\s\S]*participant_id=v_pid[\s\S]*item_id=p_item_id/i)
  assert.match(sql, /idempotency_key_reused/i)
  assert.match(sql, /for update/i)
})

test('Character shop API is catalog-backed and exposes only the approved 18 plus 8', async () => {
  const catalog = JSON.parse(await read('data/economy/catalog-v1.json'))
  const items = catalog.items.filter((item) => ['outfit', 'accessory'].includes(item.productGroup)
    && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
  assert.equal(items.filter((item) => item.productGroup === 'outfit').length, 18)
  assert.equal(items.filter((item) => item.productGroup === 'accessory').length, 8)
  assert.ok(items.every((item) => item.previewAsset?.startsWith('/assets/economy/previews/')))
  assert.ok(items.every((item) => !item.previewAsset.includes('..')))
  const adapter = await read('lib/economyCatalogV1.server.js')
  const route = await read('app/api/economy-v1/character-shop/route.js')
  assert.match(adapter, /CHARACTER_SHOP_FIELDS/)
  for (const forbidden of ['sourceAsset', 'plannedRuntimeAsset']) {
    assert.doesNotMatch(adapter.match(/CHARACTER_SHOP_FIELDS[\s\S]*?\]\)/)?.[0] || '', new RegExp(forbidden))
  }
  assert.match(route, /requireEnabledEconomyUser/)
  assert.match(route, /getCharacterShopItems/)
})

test('preview localizes village labels through one shared display mapping', async () => {
  const [icon, wallet, preview] = await Promise.all([
    read('components/economy-v1/VillageCurrencyIcon.js'),
    read('components/economy-v1/VillageWalletBar.js'),
    read('app/economy-v1-character-preview/EconomyV1CharacterPreview.js'),
  ])
  for (const [village, escapedKorean] of Object.entries({
    Animal: '\\uB3D9\\uBB3C', Human: '\\uC778\\uAC04', Nature: '\\uC790\\uC5F0',
    Urban: '\\uB3C4\\uC2DC', Music: '\\uC74C\\uC545', Lab: '\\uC5F0\\uAD6C',
  })) {
    assert.equal(icon.includes(`${village}: { ko: '${escapedKorean}'`), true)
  }
  assert.match(wallet, /villageKoreanName\(village\)/)
  assert.match(preview, /villageKoreanName\(village\)/)
  assert.doesNotMatch(preview, /`\$\{village\} \$\{(?:shortage|value\.shortage)\}/)
})

test('preview recovers a reused purchase key and includes the required keyboard semantics', async () => {
  const ui = await read('app/economy-v1-character-preview/EconomyV1CharacterPreview.js')
  const reused = ui.slice(ui.indexOf("result.code === 'idempotency_key_reused'"), ui.indexOf("setPendingPurchases", ui.indexOf("result.code === 'idempotency_key_reused'")))
  assert.match(reused, /purchaseKeys\.current\.delete\(item\.id\)/)
  assert.match(reused, /getCharacterProfile\(\)/)
  assert.match(reused, /getVillageWallets\(\)/)
  assert.match(ui, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*onKeyDown=\{handleModalKeyDown\}/)
  assert.match(ui, /event\.key === 'Escape'/)
  assert.match(ui, /FOCUSABLE_SELECTOR/)
  assert.match(ui, /role="tab"[\s\S]*aria-selected[\s\S]*aria-controls/)
  assert.match(ui, /role="tabpanel"/)
  assert.match(ui, /className=\{styles\.cardPreviewButton\}[\s\S]*type="button"/)
  assert.match(ui, /aria-describedby=\{!owned && !canBuy/)
})

test('preview remains internal and contains no deal, discount, or balance mutation controls', async () => {
  const [routes, proxy, ui] = await Promise.all([
    read('lib/internalTestRoutes.mjs'), read('proxy.js'), read('app/economy-v1-character-preview/EconomyV1CharacterPreview.js'),
  ])
  assert.match(routes, /economy-v1-character-preview/)
  assert.match(proxy, /economy-v1-character-preview\/:path\*/)
  assert.doesNotMatch(ui, /daily.?deal|discount|무료 충전|잔액 변경/i)
  assert.match(ui, /body → clothes → hair → accessories/)
})

test('protected legacy persistence files retain the Stage 3B baseline hashes while Stage 3C uses explicit branches', async () => {
  const snapshot = JSON.parse(await read('scripts/security/economy-v1-character-regression.snapshot.json'))
  const stage3cIntegrationFiles = new Set([
    'app/page.js', 'components/SoundMuseum.js', 'components/AssetRegistry.js',
    'components/InteriorDecorRoom.js',
  ])
  for (const [path, expected] of Object.entries(snapshot).filter(([path]) => !stage3cIntegrationFiles.has(path))) {
    const bytes = await readFile(new URL(path, root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `${path} changed`)
  }
  const [page, museum, interior] = await Promise.all([
    read('app/page.js'), read('components/SoundMuseum.js'), read('components/InteriorDecorRoom.js'),
  ])
  assert.match(page, /economy\.effectiveMainMode !== 'legacy'/)
  assert.match(page, /ensureTodayCheckIn\(participantId\)/)
  assert.match(museum, /economyViewMode === 'cutover'[\s\S]*CharacterShopPanel[\s\S]*<Shop /)
  assert.match(interior, /economy\.runtimeState === 'cutover'/)
  assert.match(interior, /economyV1[\s\S]*saveEconomyRoom[\s\S]*saveRoom/)
  assert.match(interior, /economyV1 \? await economy\.purchase\(item\) : await purchaseInteriorItem/)
})
