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

  ok(await admin.from('participant_village_wallets').update({ balance: 100 })
    .eq('participant_id', participantId), 'fund HTTP wallet')

  const component = await purchase('wp_clover')
  assert.equal(component.response.status, 200)
  assert.equal(component.json.code, 'success')
  const partialBundle = await purchase('set_clover')
  assert.equal(partialBundle.response.status, 409)
  assert.equal(partialBundle.json.code, 'bundle_partially_owned')

  const success = await purchase('plant_tall')
  assert.equal(success.response.status, 200)
  assert.equal(success.json.code, 'success')

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

  const combined = [characterShop, wallets, profile, unknown, pending, free, insufficient, partialBundle, success,
    purchasedOutfit, purchasedAccessory, notOwnedEquip, wrongSlot, equippedOutfit, equippedAccessory, unequipped,
    attendanceStatus, attendanceClaim, forgedVillage]
    .map(({ serialized }) => serialized).join('\n')
  assert.equal(combined.includes(participantId), false, 'HTTP responses leaked the participant id')

  console.log('Multi-village economy HTTP boundary checks passed.')
} finally {
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
