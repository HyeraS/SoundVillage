import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const apiBase = process.env.ECONOMY_TEST_APP_URL
const supabaseUrl = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const hmacSecret = process.env.MULTI_VILLAGE_ECONOMY_HMAC_SECRET
if (!apiBase || !supabaseUrl || !anonKey || !serviceKey || !hmacSecret) {
  throw new Error('Local economy HTTP integration environment is incomplete')
}
await requireLoopbackSupabaseUrl(apiBase, 'ECONOMY_TEST_APP_URL')
await requireLoopbackSupabaseUrl(supabaseUrl, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
const admin = createClient(supabaseUrl, serviceKey, options)
const browser = createClient(supabaseUrl, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantId = `ECON_HTTP_${suffix}`
let user

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function request(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(new URL(path, apiBase), {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await response.json()
  const serialized = JSON.stringify(json)
  assert.equal(serialized.includes(serviceKey), false, `${path} leaked the service-role key`)
  assert.equal(serialized.includes(hmacSecret), false, `${path} leaked the HMAC secret`)
  return { response, json, serialized }
}

try {
  const unauthenticatedShop = await request('/api/economy-v1/character-shop')
  assert.equal(unauthenticatedShop.response.status, 401)

  const unauthenticatedInterior = await request('/api/economy-v1/interior-catalog')
  assert.equal(unauthenticatedInterior.response.status, 401)

  const unauthenticated = await request('/api/economy-v1/wallets')
  assert.equal(unauthenticated.response.status, 401)
  assert.equal(unauthenticated.json.code, 'auth_required')

  const auth = ok(await browser.auth.signInAnonymously(), 'HTTP test sign-in')
  user = auth.user
  const token = auth.session.access_token
  ok(await admin.from('study_participants').insert({
    participant_id: participantId,
    auth_user_id: user.id,
    group_id: 'A',
    status: 'active',
  }), 'HTTP test participant')

  const characterShop = await request('/api/economy-v1/character-shop', { token })
  assert.equal(characterShop.response.status, 200)
  assert.equal(characterShop.json.items.filter((item) => item.productGroup === 'outfit').length, 18)
  assert.equal(characterShop.json.items.filter((item) => item.productGroup === 'accessory').length, 8)
  assert(characterShop.json.items.every((item) => item.previewAsset && item.runtimeAsset))
  const publicCharacterFields = [
    'cost', 'currencyCombination', 'estimatedAnnotationCount', 'id', 'minimumFreshAnnotationCount',
    'name', 'previewAsset', 'priceTier', 'productGroup', 'rarity', 'requiredVillageCount',
    'runtimeAsset', 'type',
  ]
  for (const item of characterShop.json.items) {
    assert.deepEqual(Object.keys(item).sort(), publicCharacterFields, `unexpected public fields for ${item.id}`)
  }
  for (const forbidden of ['sourceAsset', 'plannedRuntimeAsset', 'serviceRole', 'hmac']) {
    assert.equal(characterShop.serialized.toLowerCase().includes(forbidden.toLowerCase()), false)
  }

  const interiorCatalog = await request('/api/economy-v1/interior-catalog', { token })
  assert.equal(interiorCatalog.response.status, 200)
  assert.equal(interiorCatalog.json.items.length, 40)
  assert.equal(interiorCatalog.json.sets.length, 3)
  assert.equal(interiorCatalog.json.starters.length, 2)
  assert.deepEqual(interiorCatalog.json.starters.map((item) => item.id).sort(), ['starter_floor_beige', 'starter_wall_neutral'])
  assert.equal(interiorCatalog.serialized.includes('pending_interior_review'), false)
  assert.equal(interiorCatalog.serialized.includes('house_tv_sun'), false)
  for (const forbidden of ['sourceAsset', 'plannedRuntimeAsset', 'completionReward', 'review']) {
    assert.equal(interiorCatalog.serialized.toLowerCase().includes(forbidden.toLowerCase()), false)
  }

  const wallets = await request('/api/economy-v1/wallets', { token })
  assert.equal(wallets.response.status, 200)
  assert.equal(wallets.json.code, 'success')
  assert.deepEqual(wallets.json.balances, { Animal: 0, Human: 0, Nature: 0, Urban: 0, Music: 0, Lab: 0 })

  const profile = await request('/api/economy-v1/character-profile', { token })
  assert.equal(profile.response.status, 200)
  assert.deepEqual(profile.json.loadout, { outfitId: 'basic', accessoryId: null })
  assert.deepEqual(profile.json.ownedItemIds, [])
  assert.equal(Object.keys(profile.json.balances).length, 6)
  assert.equal(typeof profile.json.economyVersion, 'string')

  const purchase = (itemId, idempotencyKey = crypto.randomUUID()) => request('/api/economy-v1/purchase', {
    token,
    body: { itemId, idempotencyKey },
  })
  const unknown = await purchase(`unknown_${suffix}`)
  assert.equal(unknown.response.status, 404)
  assert.equal(unknown.json.code, 'unknown_item')

  const pending = await purchase('house_tv_sun')
  assert.equal(pending.response.status, 403)
  assert.equal(pending.json.code, 'official_store_unapproved')

  const free = await purchase('skin_01')
  assert.equal(free.response.status, 403)
  assert.equal(free.json.code, 'official_store_unapproved')

  const insufficientKey = crypto.randomUUID()
  const insufficient = await purchase('plant_tall', insufficientKey)
  assert.equal(insufficient.response.status, 409)
  assert.equal(insufficient.json.code, 'insufficient_funds')
  const insufficientReplay = await purchase('plant_tall', insufficientKey)
  assert.deepEqual(insufficientReplay.json, insufficient.json)

  const legacyBefore = {
    currency:ok(await admin.from('participant_currency').select('*').eq('participant_id', participantId), 'legacy currency before'),
    ledger:ok(await admin.from('currency_transactions').select('*').eq('participant_id', participantId), 'legacy ledger before'),
    owned:ok(await admin.from('participant_interior_items').select('*').eq('participant_id', participantId), 'legacy ownership before'),
  }

  ok(await admin.from('participant_village_wallets').update({ balance: 100 })
    .eq('participant_id', participantId), 'fund HTTP wallet')

  const zeroOwnedSet = interiorCatalog.json.sets.find((set) => set.id === 'set_heart')
  const walletsBeforeSet = ok(await admin.from('participant_village_wallets').select('village,balance')
    .eq('participant_id', participantId), 'wallets before zero-owned set')
  const bundleSuccess = await purchase(zeroOwnedSet.id)
  assert.equal(bundleSuccess.response.status, 200)
  assert.equal(bundleSuccess.json.code, 'success')
  assert.deepEqual(bundleSuccess.json.grantedItemIds.slice().sort(), zeroOwnedSet.bundleItemIds.slice().sort())
  const walletsAfterSet = ok(await admin.from('participant_village_wallets').select('village,balance')
    .eq('participant_id', participantId), 'wallets after zero-owned set')
  for (const before of walletsBeforeSet) {
    const after = walletsAfterSet.find((row) => row.village === before.village)
    assert.equal(Number(after.balance), Number(before.balance) - zeroOwnedSet.cost[before.village], `${before.village} bundle debit mismatch`)
  }

  const component = await purchase('wp_clover')
  assert.equal(component.response.status, 200)
  assert.equal(component.json.code, 'success')
  const partialBundle = await purchase('set_clover')
  assert.equal(partialBundle.response.status, 409)
  assert.equal(partialBundle.json.code, 'bundle_partially_owned')

  const individuallyCollectedSet = interiorCatalog.json.sets.find((set) => set.id === 'set_night')
  for (const itemId of individuallyCollectedSet.bundleItemIds) {
    const result = await purchase(itemId)
    assert.equal(result.response.status, 200)
    assert.equal(result.json.code, 'success')
  }
  const collectedOwnership = ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantId), 'individual collection ownership')
  const collectedIds = new Set(collectedOwnership.map((row) => row.item_id))
  assert(individuallyCollectedSet.bundleItemIds.every((itemId) => collectedIds.has(itemId)))
  assert.equal([...collectedIds].some((itemId) => itemId.startsWith('placeholder_completion_asset_')
    || itemId.startsWith('completion_reward_')), false, 'placeholder completion reward was granted')

  const success = await purchase('plant_tall')
  assert.equal(success.response.status, 200)
  assert.equal(success.json.code, 'success')
  for (const itemId of ['plant_bush', 'books', 'fruitbowl']) {
    const result = await purchase(itemId)
    assert.equal(result.response.status, 200)
    assert.equal(result.json.code, 'success')
  }

  assert.deepEqual(ok(await admin.from('participant_currency').select('*').eq('participant_id', participantId), 'legacy currency after'), legacyBefore.currency)
  assert.deepEqual(ok(await admin.from('currency_transactions').select('*').eq('participant_id', participantId), 'legacy ledger after'), legacyBefore.ledger)
  assert.deepEqual(ok(await admin.from('participant_interior_items').select('*').eq('participant_id', participantId), 'legacy ownership after'), legacyBefore.owned)

  const runtimeItem = (id) => interiorCatalog.json.items.find((item) => item.id === id)
  const placement = (uid, itemId, col, row) => ({ uid, itemId, layer:runtimeItem(itemId).layer, col, row, flip:false })
  const room = {
    wallpaper:'starter_wall_neutral', floor:'starter_floor_beige',
    items:[
      placement(1, 'plant_tall', 0, runtimeItem('plant_tall').fh - 1),
      placement(2, 'plant_tall', 2, runtimeItem('plant_tall').fh - 1),
      placement(3, 'plant_bush', 4, runtimeItem('plant_bush').fh - 1),
      placement(4, 'books', 6, runtimeItem('books').fh - 1),
      placement(5, 'fruitbowl', 8, runtimeItem('fruitbowl').fh - 1),
    ],
  }
  const saveKey = crypto.randomUUID()
  const savedRoom = await request('/api/economy-v1/room', { token, body:{ room, expectedRevision:0, idempotencyKey:saveKey } })
  assert.equal(savedRoom.response.status, 200)
  assert.equal(savedRoom.json.code, 'success')
  assert.equal(savedRoom.json.revision, 1)
  assert.equal(savedRoom.json.inviteUniqueItemCount, 4, 'duplicate placement must count once')
  const savedReplay = await request('/api/economy-v1/room', { token, body:{ room, expectedRevision:0, idempotencyKey:saveKey } })
  assert.deepEqual(savedReplay.json, savedRoom.json, 'same room-save key must replay exactly')

  const reused = await request('/api/economy-v1/room', {
    token, body:{ room:{ ...room, items:room.items.slice(0, 1) }, expectedRevision:1, idempotencyKey:saveKey },
  })
  assert.equal(reused.response.status, 409)
  assert.equal(reused.json.code, 'idempotency_key_reused')

  const ownedAfterPurchases = new Set(ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantId), 'ownership before forged room').map((row) => row.item_id))
  const unownedInteriorItem = interiorCatalog.json.items.find((item) => !ownedAfterPurchases.has(item.id)
    && !['wallpaper', 'floor'].includes(item.kind) && ['wall', 'floor', 'rug'].includes(item.layer))
  assert(unownedInteriorItem, 'HTTP room forgery check requires an unowned approved Interior item')
  const forgedRoom = await request('/api/economy-v1/room', {
    token,
    body:{ room:{ ...room, items:[placement(9, unownedInteriorItem.id, 0, (unownedInteriorItem.fh || 1) - 1)] }, expectedRevision:1, idempotencyKey:crypto.randomUUID() },
  })
  assert.equal(forgedRoom.response.status, 409)
  assert.equal(forgedRoom.json.code, 'item_not_owned')

  const malformedRoom = await request('/api/economy-v1/room', {
    token,
    body:{ room:{ ...room, admin:true }, expectedRevision:1, idempotencyKey:crypto.randomUUID() },
  })
  assert.equal(malformedRoom.response.status, 400)
  assert.equal(malformedRoom.json.code, 'invalid_room')

  const competingRooms = await Promise.all([
    request('/api/economy-v1/room', { token, body:{ room:{ ...room, items:room.items.slice(0, 4) }, expectedRevision:1, idempotencyKey:crypto.randomUUID() } }),
    request('/api/economy-v1/room', { token, body:{ room:{ ...room, items:room.items.slice(0, 3) }, expectedRevision:1, idempotencyKey:crypto.randomUUID() } }),
  ])
  assert.deepEqual(competingRooms.map((entry) => entry.json.code).sort(), ['room_conflict', 'success'])
  const loadedRoom = await request('/api/economy-v1/room', { token })
  assert.equal(loadedRoom.response.status, 200)
  assert.equal(loadedRoom.json.revision, 2)
  assert.equal(loadedRoom.serialized.includes(participantId), false)

  const purchasedOutfit = await purchase('overalls')
  const purchasedAccessory = await purchase('acc_glasses')
  assert.equal(purchasedOutfit.json.code, 'success')
  assert.equal(purchasedAccessory.json.code, 'success')
  const equip = (slot, itemId, idempotencyKey = crypto.randomUUID()) => request('/api/economy-v1/equip', {
    token,
    body: { slot, itemId, idempotencyKey },
  })
  const notOwnedEquip = await equip('outfit', 'witch')
  assert.equal(notOwnedEquip.response.status, 409)
  assert.equal(notOwnedEquip.json.code, 'item_not_owned')
  const wrongSlot = await equip('accessory', 'overalls')
  assert.equal(wrongSlot.response.status, 409)
  assert.equal(wrongSlot.json.code, 'invalid_item_type')
  const equippedOutfit = await equip('outfit', 'overalls')
  const equippedAccessory = await equip('accessory', 'acc_glasses')
  assert.deepEqual(equippedOutfit.json.loadout, { outfitId: 'overalls', accessoryId: null })
  assert.deepEqual(equippedAccessory.json.loadout, { outfitId: 'overalls', accessoryId: 'acc_glasses' })
  const unequipped = await equip('accessory', null)
  assert.deepEqual(unequipped.json.loadout, { outfitId: 'overalls', accessoryId: null })

  const attendanceStatus = await request('/api/economy-v1/attendance', { token })
  assert.equal(attendanceStatus.response.status, 200)
  assert.equal(attendanceStatus.json.code, 'success')
  const attendanceClaim = await request('/api/economy-v1/attendance', {
    token,
    body: { idempotencyKey: crypto.randomUUID() },
  })
  assert.equal(attendanceClaim.response.status, 200)
  assert.equal(attendanceClaim.json.code, 'success')

  const forgedVillage = await request('/api/economy-v1/annotation', {
    token,
    body: {
      idempotencyKey: crypto.randomUUID(), soundId: 'forged-sound', zone: 'Lab',
      expressionText: 'forged', playCount: 1, listeningTimeSec: 1,
    },
  })
  assert.equal(forgedVillage.response.status, 400)
  assert.equal(forgedVillage.json.code, 'invalid_request')

  const combined = [characterShop, interiorCatalog, wallets, profile, unknown, pending, free, insufficient, bundleSuccess, partialBundle, success,
    purchasedOutfit, purchasedAccessory, notOwnedEquip, wrongSlot, equippedOutfit, equippedAccessory, unequipped,
    attendanceStatus, attendanceClaim, forgedVillage, savedRoom, savedReplay, reused, forgedRoom, malformedRoom, loadedRoom]
    .map(({ serialized }) => serialized).join('\n')
  assert.equal(combined.includes(participantId), false, 'HTTP responses leaked the participant id')

  console.log('Multi-village economy HTTP boundary checks passed.')
} finally {
  await admin.from('study_participants').delete().eq('participant_id', participantId)
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
