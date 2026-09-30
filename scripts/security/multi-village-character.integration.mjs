import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Character integration environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
const admin = createClient(url, serviceKey, options)
const serviceA = createClient(url, serviceKey, options)
const serviceB = createClient(url, serviceKey, options)
const a = createClient(url, anonKey, options)
const b = createClient(url, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `CHAR_A_${suffix}`
const participantB = `CHAR_B_${suffix}`
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function equipArgs(userId, slot, itemId, itemType, key = crypto.randomUUID()) {
  return {
    p_auth_user_id: userId,
    p_slot: slot,
    p_item_id: itemId,
    p_item_type: itemType,
    p_is_approved: true,
    p_idempotency_key: key,
  }
}

try {
  userA = ok(await a.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await b.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.from('study_participants').insert([
    { participant_id: participantA, auth_user_id: userA.id, group_id: 'A', status: 'active' },
    { participant_id: participantB, auth_user_id: userB.id, group_id: 'B', status: 'active' },
  ]), 'create Character participants')

  const legacyBefore = ok(await admin.from('participant_equipped_outfit').select('*')
    .in('participant_id', [participantA, participantB]), 'legacy outfit before')
  const scalarBefore = ok(await admin.from('participant_currency').select('*')
    .in('participant_id', [participantA, participantB]), 'legacy balance before')

  const profile = ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id: userA.id }), 'default profile')
  assert.deepEqual(profile.balances, { Animal: 0, Human: 0, Nature: 0, Urban: 0, Music: 0, Lab: 0 })
  assert.deepEqual(profile.ownedItemIds, [])
  assert.deepEqual(profile.loadout, { outfitId: 'basic', accessoryId: null })
  assert.equal(profile.defaultOutfitId, 'basic')

  const own = ok(await a.from('participant_multi_village_character_loadouts').select('*'), 'A own loadout')
  const cross = ok(await b.from('participant_multi_village_character_loadouts').select('*'), 'B cross loadout')
  assert.equal(own.length, 1)
  assert.equal(cross.length, 0)
  assert((await a.from('participant_multi_village_character_loadouts').insert({ participant_id: participantA, outfit_id: 'basic' })).error)
  assert((await a.from('participant_multi_village_character_loadouts').update({ outfit_id: 'forbidden' }).eq('participant_id', participantA)).error)
  assert((await a.from('participant_multi_village_character_loadouts').delete().eq('participant_id', participantA)).error)

  ok(await admin.from('participant_catalog_items').insert([
    { participant_id: participantA, item_id: 'overalls', acquisition_source: 'completion_reward' },
    { participant_id: participantA, item_id: 'sailor', acquisition_source: 'completion_reward' },
    { participant_id: participantA, item_id: 'acc_glasses', acquisition_source: 'completion_reward' },
  ]), 'seed Character ownership')

  const outfit = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'overalls', 'outfit')), 'equip outfit')
  assert.deepEqual(outfit.loadout, { outfitId: 'overalls', accessoryId: null })
  const accessoryKey = crypto.randomUUID()
  const accessoryArgs = equipArgs(userA.id, 'accessory', 'acc_glasses', 'accessory', accessoryKey)
  const accessory = ok(await admin.rpc('equip_multi_village_character_item_admin', accessoryArgs), 'equip accessory')
  const accessoryReplay = ok(await admin.rpc('equip_multi_village_character_item_admin', accessoryArgs), 'replay accessory')
  assert.deepEqual(accessoryReplay, accessory)

  const reused = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'sailor', 'outfit', accessoryKey)), 'reuse key')
  assert.equal(reused.reason, 'idempotency_key_reused')
  const notOwned = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'witch', 'outfit')), 'not owned')
  assert.equal(notOwned.reason, 'item_not_owned')
  const wrongType = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'accessory', 'overalls', 'outfit')), 'wrong type')
  assert.equal(wrongType.reason, 'invalid_item_type')
  const invalidSlot = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'hat', 'acc_glasses', 'accessory')), 'invalid slot')
  assert.equal(invalidSlot.reason, 'invalid_slot')

  const [concurrentA, concurrentB] = await Promise.all([
    serviceA.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'overalls', 'outfit')),
    serviceB.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'sailor', 'outfit')),
  ])
  ok(concurrentA, 'concurrent outfit A')
  ok(concurrentB, 'concurrent outfit B')
  const afterConcurrent = ok(await admin.from('participant_multi_village_character_loadouts')
    .select('outfit_id,accessory_id').eq('participant_id', participantA).single(), 'loadout after concurrency')
  assert(['overalls', 'sailor'].includes(afterConcurrent.outfit_id))
  assert.equal(afterConcurrent.accessory_id, 'acc_glasses')

  const unequipped = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'accessory', null, null)), 'unequip accessory')
  assert.equal(unequipped.loadout.accessoryId, null)
  const basic = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'basic', 'outfit')), 'equip basic')
  assert.equal(basic.loadout.outfitId, 'basic')

  const legacyAfter = ok(await admin.from('participant_equipped_outfit').select('*')
    .in('participant_id', [participantA, participantB]), 'legacy outfit after')
  const scalarAfter = ok(await admin.from('participant_currency').select('*')
    .in('participant_id', [participantA, participantB]), 'legacy balance after')
  assert.deepEqual(legacyAfter, legacyBefore)
  assert.deepEqual(scalarAfter, scalarBefore)
  console.log('Multi-village Character loadout integration checks passed.')
} finally {
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
