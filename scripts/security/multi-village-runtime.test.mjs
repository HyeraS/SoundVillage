import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  ECONOMY_CATALOG_VERSION,
  EMPTY_ECONOMY_RUNTIME,
  economyWriteAllowed,
  normalizeEconomyReward,
  purchaseFailureAction,
  rewardEventFields,
  resolveEconomyBootstrap,
} from '../../lib/economyRuntimeState.mjs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('010 keeps legacy v4 writers intact and creates service-only atomic economy writers', async () => {
  const sql = await read('scripts/security/010_multi_village_runtime_cutover.sql')
  assert.doesNotMatch(sql, /create or replace function public\.submit_(?:annotation|museum_vote)_v4/i)
  assert.match(sql, /submit_annotation_economy_v1_admin/i)
  assert.match(sql, /submit_museum_vote_economy_v1_admin/i)
  assert.match(sql, /service_role_required/i)
  assert.match(sql, /revoke all on function public\.submit_annotation_economy_v1_admin[\s\S]*authenticated/i)
  assert.match(sql, /grant execute on function public\.submit_annotation_economy_v1_admin[\s\S]*service_role/i)
  assert.match(sql, /private\.credit_activity_village_economy_v1/i)
  assert.match(sql, /v_amount:=5/i)
  assert.match(sql, /v_amount:=2/i)
})

test('new result functions derive village and amount from stored rows and never touch legacy currency', async () => {
  const sql = await read('scripts/security/010_multi_village_runtime_cutover.sql')
  const reward = sql.match(/create or replace function private\.credit_activity_village_economy_v1[\s\S]*?end \$\$;/i)?.[0] || ''
  assert.match(reward, /select zone into v_village from public\.annotations/i)
  assert.match(reward, /select zone into v_village from public\.votes/i)
  assert.match(reward, /participant_village_wallets[\s\S]*for update/i)
  assert.match(reward, /village_currency_ledger/i)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.participant_currency/i)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.currency_transactions/i)
  assert.match(sql, /economy_v1_no_quest_currency/i)
})

test('the server-only mode defaults to legacy and gates every economy mutation path', async () => {
  const [mode, api, annotation, vote, attendance, purchase, equip] = await Promise.all([
    read('lib/economyRuntime.server.js'), read('lib/economyApi.server.js'),
    read('app/api/economy-v1/annotation/route.js'), read('app/api/economy-v1/vote/route.js'),
    read('app/api/economy-v1/attendance/route.js'), read('app/api/economy-v1/purchase/route.js'),
    read('app/api/economy-v1/equip/route.js'),
  ])
  assert.match(mode, /if \(!configured\) return 'legacy'/)
  assert.match(mode, /'maintenance'/)
  assert.match(mode, /ECONOMY_RUNTIME_MODES\.includes\(configured\) \? configured : null/)
  assert.doesNotMatch(mode, /NEXT_PUBLIC_/)
  assert.match(api, /feature_disabled/)
  for (const route of [annotation, vote, attendance, purchase, equip]) assert.match(route, /requireEnabledEconomyUser/)
  assert.match(annotation, /auth\.mode !== 'cutover'/)
  assert.match(vote, /auth\.mode !== 'cutover'/)
})

test('main runtime uses one shared economy state and renders the loadout across all locations', async () => {
  const [page, provider, actor, pixel, museum] = await Promise.all([
    read('app/page.js'), read('components/economy-v1/EconomyRuntimeProvider.js'),
    read('components/world-map/WorldMapActors.js'), read('components/ZoneMap.js'), read('components/LibraryRoom.js'),
  ])
  assert.match(provider, /getEconomyBootstrap\(\)/)
  assert.match(provider, /purchaseAndEquip/)
  assert.match(page, /economy\.effectiveMainMode/)
  assert.equal((page.match(/accessorySrc=\{runtimeAccessorySrc\}/g) || []).length, 11)
  assert.equal((page.match(/characterLoadout=\{runtimeCharacterLoadout\}/g) || []).length, 11)
  assert.match(actor, /resolveWorldCharacterLayers\(\{ outfitSrc, accessorySrc, \.\.\.\(characterLoadout \|\| \{\}\) \}\)/)
  assert.match(pixel, /resolveWorldCharacterLayers\(\{ outfitSrc, accessorySrc, \.\.\.\(characterLoadout \|\| \{\}\) \}\)/)
  assert.match(museum, /resolveWorldCharacterLayers\(\{ outfitSrc, accessorySrc, \.\.\.\(characterLoadout \|\| \{\}\) \}\)/)
})

test('cutover submissions use gated route handlers and quest UI promises no currency', async () => {
  const [client, supabase, ui, page] = await Promise.all([
    read('lib/economyV1.client.js'), read('lib/supabase.js'),
    read('components/world-map/WorldMapUI.js'), read('app/page.js'),
  ])
  assert.match(client, /\/api\/economy-v1\/annotation/)
  assert.match(client, /\/api\/economy-v1\/vote/)
  assert.doesNotMatch(client, /soundId: data\.sound_id,\s*zone:/)
  assert.doesNotMatch(client, /soundId: sound_id,\s*zone,/)
  assert.match(supabase, /data\.economyMode === 'cutover'/)
  assert.match(ui, /economyMode === 'legacy'[\s\S]*reward_currency/)
  assert.match(ui, /진행도만 기록되며 화폐 보상은 지급되지 않습니다/)
  assert.match(page, /economy\.effectiveMainMode !== 'legacy'[\s\S]*ensureTodayCheckIn/)
})

test('runtime state transitions fail closed and preview has an explicitly legacy main mode', () => {
  assert.equal(EMPTY_ECONOMY_RUNTIME.runtimeState, 'unknown')
  assert.equal(EMPTY_ECONOMY_RUNTIME.effectiveMainMode, null)

  const legacy = resolveEconomyBootstrap({ ok:true, economyMode:'legacy', catalogVersion:ECONOMY_CATALOG_VERSION })
  const preview = resolveEconomyBootstrap({ ok:true, economyMode:'preview', catalogVersion:ECONOMY_CATALOG_VERSION })
  const maintenance = resolveEconomyBootstrap({ ok:true, economyMode:'maintenance', catalogVersion:ECONOMY_CATALOG_VERSION })
  assert.deepEqual([legacy.runtimeState, legacy.effectiveMainMode], ['legacy', 'legacy'])
  assert.deepEqual([preview.runtimeState, preview.effectiveMainMode], ['preview', 'legacy'])
  assert.deepEqual([maintenance.runtimeState, maintenance.effectiveMainMode], ['maintenance', null])

  for (const failed of [
    { ok:false, code:'storage_retryable', status:503 },
    { ok:false, code:'auth_required', status:401 },
    { ok:true, economyMode:'preview', catalogVersion:'wrong' },
    { ok:true, economyMode:'unsafe', catalogVersion:ECONOMY_CATALOG_VERSION },
    { ok:true, economyMode:'cutover', catalogVersion:ECONOMY_CATALOG_VERSION, items:[], runtimeItems:[], profile:{} },
  ]) {
    const state = resolveEconomyBootstrap(failed)
    assert.equal(state.runtimeState, 'blocked')
    assert.equal(state.effectiveMainMode, null)
    for (const kind of ['legacy-annotation', 'legacy-vote', 'legacy-attendance', 'purchase', 'equip']) {
      assert.equal(economyWriteAllowed(state.runtimeState, kind), false)
    }
  }

  const recovered = resolveEconomyBootstrap({ ok:true, economyMode:'preview', catalogVersion:ECONOMY_CATALOG_VERSION })
  assert.equal(recovered.runtimeState, 'preview')
  assert.equal(economyWriteAllowed(recovered.runtimeState, 'legacy-annotation'), true)
  assert.equal(economyWriteAllowed(recovered.runtimeState, 'purchase'), false)
})

test('cutover bootstrap requires the full profile payload and never falls back to v4', () => {
  const failed = resolveEconomyBootstrap({ ok:false, code:'storage_retryable', status:503 })
  assert.equal(failed.runtimeState, 'blocked')
  assert.equal(failed.mode, null)
  assert.equal(failed.effectiveMainMode, null)

  const ready = resolveEconomyBootstrap({
    ok:true,
    economyMode:'cutover',
    catalogVersion:ECONOMY_CATALOG_VERSION,
    items:[],
    runtimeItems:[],
    interiorItems:[],
    interiorSets:[],
    interiorStarters:[],
    profile:{ balances:{}, ownedItemIds:[], loadout:{ outfitId:'basic', accessoryId:null } },
    attendance:{ ok:true },
  })
  assert.equal(ready.runtimeState, 'cutover')
  assert.equal(ready.effectiveMainMode, 'cutover')
})

test('purchase recovery retains only retryable keys and resynchronizes confirmed conflicts', () => {
  assert.equal(purchaseFailureAction({ code:'storage_retryable', retryable:true }), 'keep-key')
  assert.equal(purchaseFailureAction({ code:'idempotency_key_reused' }), 'discard-key-and-resync')
  assert.equal(purchaseFailureAction({ code:'already_owned' }), 'discard-key-and-resync')
  assert.equal(purchaseFailureAction({ code:'official_store_unapproved' }), 'discard-key-and-resync')
  assert.equal(purchaseFailureAction({ code:'insufficient_funds' }), 'discard-key-and-resync')
  assert.equal(purchaseFailureAction({ code:'invalid_item' }), 'discard-key')
})

test('reward adapter exposes one canonical transactionId backed by the ledger operation UUID', () => {
  const operationId = '11111111-1111-4111-8111-111111111111'
  const normalized = normalizeEconomyReward({ reward:{ ledgerOperationId:operationId, village:'Music', awarded:5 } })
  assert.equal(normalized.reward.transactionId, operationId)
  assert.equal(Object.hasOwn(normalized.reward, 'ledgerOperationId'), false)
  assert.equal(normalized.reward.village, 'Music')
  const event = rewardEventFields(normalized)
  assert.deepEqual(event, {
    zone:'Music',
    metadata:{ transaction_id:operationId, reward_amount:5 },
  })
  assert.equal(JSON.stringify(event).includes('expression'), false)
})
