import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('official Interior projection exposes exactly 40 approved products and 3 sets', async () => {
  const catalog = JSON.parse(await read('data/economy/catalog-v1.json'))
  const products = catalog.items.filter((item) => item.productGroup === 'interior'
    && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
  const sets = catalog.items.filter((item) => item.type === 'theme_set'
    && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
  const starters = catalog.items.filter((item) => item.productGroup === 'interior_starter'
    && item.starterFree && item.officialStoreStatus === 'free_customization')
  assert.equal(products.length, 40)
  assert.equal(sets.length, 3)
  assert.equal(starters.length, 2)
  assert.ok(starters.every((starter) => !products.some((product) => product.id === starter.id)))
  assert.equal(catalog.items.filter((item) => item.officialStoreStatus === 'pending_interior_review').length, 6)
})

test('official cutover UI contains no daily deal and purchases without Character equip', async () => {
  const [room, renderCatalog, provider, serverCatalog, purchaseRoute] = await Promise.all([
    read('components/InteriorDecorRoom.js'), read('lib/interiorCatalog.js'),
    read('components/economy-v1/EconomyRuntimeProvider.js'),
    read('lib/economyCatalogV1.server.js'), read('app/api/economy-v1/purchase/route.js'),
  ])
  assert.doesNotMatch(room, /getInteriorDailyDeal|getInteriorPrice|dailyDeal|SALE|오늘의 특가/)
  const renderItems = renderCatalog.slice(renderCatalog.indexOf('export const INTERIOR_CATALOG'), renderCatalog.indexOf('export const INTERIOR_ITEM_BY_ID'))
  assert.doesNotMatch(renderItems, /dailyDeal|discount|\bprice\s*:/i)
  assert.doesNotMatch(serverCatalog, /interiorLegacyCatalog|getInteriorDailyDeal|getInteriorPrice|LEGACY_INTERIOR/)
  assert.doesNotMatch(purchaseRoute, /interiorLegacyCatalog|getInteriorDailyDeal|getInteriorPrice|LEGACY_INTERIOR|daily.?deal|discount/i)
  const generic = provider.slice(provider.indexOf('const purchase = useCallback'), provider.indexOf('const equip = useCallback'))
  assert.match(generic, /purchaseEconomyItem/)
  assert.doesNotMatch(generic, /equipCharacterItem/)
  assert.match(room, /copyError && <div role="alert"/)
  assert.match(room, /data-room-toast role="status" aria-live="polite"/)
  assert.match(room, /<VillageCostVector cost=\{item\.cost\} balances=\{balances\}/)
})

test('011 isolates secure rooms and leaves legacy room, balance, ledger and ownership untouched', async () => {
  const sql = await read('scripts/security/011_multi_village_interior_cutover.sql')
  assert.match(sql, /participant_economy_v1_rooms/)
  assert.match(sql, /save_economy_v1_room_admin/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /idempotency_key_reused/)
  assert.match(sql, /room_conflict/)
  assert.match(sql, /participant_catalog_items owned/)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table) public\.participant_room\b/i)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table) public\.participant_interior_items\b/i)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table) public\.participant_currency\b/i)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table) public\.currency_transactions\b/i)
})

test('cutover room routes are authenticated, mode-gated, allow-listed and service-backed', async () => {
  const [room, share, shared, server] = await Promise.all([
    read('app/api/economy-v1/room/route.js'), read('app/api/economy-v1/room-share/route.js'),
    read('app/api/economy-v1/shared-room/route.js'), read('lib/economyInteriorRoom.server.js'),
  ])
  for (const source of [room, share, shared]) {
    assert.match(source, /requireEnabledEconomyUser/)
    assert.match(source, /auth\.mode !== 'cutover'|cutoverOnly/)
  }
  assert.match(room, /\['room','expectedRevision','idempotencyKey'\]/)
  assert.match(server, /validateEconomyInteriorRoom/)
  assert.doesNotMatch([room, share, shared].join('\n'), /participantId|service_role|SUPABASE_SERVICE_ROLE_KEY/)
})
