import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Stage 3 Character Identity environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const serviceA = createClient(url, serviceKey, options)
const serviceB = createClient(url, serviceKey, options)
const clientA = createClient(url, anonKey, options)
const clientB = createClient(url, anonKey, options)
const anon = createClient(url, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `IDENTITY_A_${suffix}`
const participantB = `IDENTITY_B_${suffix}`
const participantInactive = `IDENTITY_I_${suffix}`
let userA
let userB
let inactiveUser

const DEFAULT = {
  skinId:'skin_01', eyesId:'eyes_green_light', hairStyleId:'hair_buzzcut', hairColorId:'black',
  outfitId:'basic', accessoryId:null,
}
const IDENTITY = {
  skinId:'skin_04', eyesId:'eyes_blue', hairStyleId:'hair_long_straight', hairColorId:'pink',
}

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function saveArgs(userId, identity = IDENTITY, key = crypto.randomUUID()) {
  return {
    p_auth_user_id:userId,
    p_skin_id:identity.skinId,
    p_eyes_id:identity.eyesId,
    p_hair_style_id:identity.hairStyleId,
    p_hair_color_id:identity.hairColorId,
    p_idempotency_key:key,
  }
}

function equipArgs(userId, slot, itemId, itemType, key = crypto.randomUUID()) {
  return {
    p_auth_user_id:userId, p_slot:slot, p_item_id:itemId, p_item_type:itemType,
    p_is_approved:true, p_idempotency_key:key,
  }
}

try {
  userA = ok(await clientA.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await clientB.auth.signInAnonymously(), 'sign in B').user
  inactiveUser = ok(await admin.auth.admin.createUser({ email:`inactive-${suffix}@example.test`, email_confirm:true }), 'create inactive auth').user
  ok(await admin.from('study_participants').insert([
    { participant_id:participantA, auth_user_id:userA.id, group_id:'A', status:'active' },
    { participant_id:participantB, auth_user_id:userB.id, group_id:'B', status:'active' },
    { participant_id:participantInactive, auth_user_id:inactiveUser.id, group_id:'A', status:'inactive' },
  ]), 'create identity participants')

  const profileA = ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userA.id }), 'new profile A')
  const profileB = ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userB.id }), 'new profile B')
  assert.deepEqual(profileA.loadout, DEFAULT)
  assert.deepEqual(profileB.loadout, DEFAULT)

  assert((await anon.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id))).error, 'anon RPC must be denied')
  assert((await clientA.from('participant_multi_village_character_loadouts')
    .update({ skin_id:'skin_08' }).eq('participant_id', participantA)).error, 'authenticated direct update must be denied')
  const inactive = ok(await admin.rpc('save_multi_village_character_identity_admin', saveArgs(inactiveUser.id)), 'inactive save')
  assert.equal(inactive.reason, 'participant_inactive')

  ok(await admin.from('participant_catalog_items').insert([
    { participant_id:participantA, item_id:'overalls', acquisition_source:'completion_reward' },
    { participant_id:participantA, item_id:'acc_glasses', acquisition_source:'completion_reward' },
  ]), 'seed ownership')
  const equippedOutfit = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'overalls', 'outfit')), 'equip outfit')
  assert.deepEqual(equippedOutfit.loadout, { ...DEFAULT, outfitId:'overalls' })
  const equippedAccessory = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'accessory', 'acc_glasses', 'accessory')), 'equip accessory')
  assert.deepEqual(equippedAccessory.loadout, { ...DEFAULT, outfitId:'overalls', accessoryId:'acc_glasses' })

  const walletsBefore = ok(await admin.from('participant_village_wallets').select('village,balance').eq('participant_id', participantA).order('village'), 'wallets before')
  const ownedBefore = ok(await admin.from('participant_catalog_items').select('item_id').eq('participant_id', participantA).order('item_id'), 'owned before')
  const key = crypto.randomUUID()
  const saved = ok(await admin.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, IDENTITY, key)), 'save identity')
  assert.deepEqual(saved.loadout, { ...IDENTITY, outfitId:'overalls', accessoryId:'acc_glasses' })
  const replay = ok(await admin.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, IDENTITY, key)), 'replay identity')
  assert.deepEqual(replay, saved)
  const conflict = ok(await admin.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, { ...IDENTITY, skinId:'skin_05' }, key)), 'reuse identity key')
  assert.equal(conflict.reason, 'idempotency_key_reused')

  for (const [field, value, reason] of [
    ['skinId','skin_99','invalid_skin_id'],
    ['eyesId','eyes_orange','invalid_eyes_id'],
    ['hairStyleId','hair_unknown','invalid_hair_style_id'],
    ['hairColorId','orange','invalid_hair_color_id'],
  ]) {
    const invalid = ok(await admin.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, { ...IDENTITY, [field]:value })), `reject ${field}`)
    assert.equal(invalid.reason, reason)
  }

  const concurrentKey = crypto.randomUUID()
  const concurrentIdentity = { skinId:'skin_07', eyesId:'eyes_red', hairStyleId:'hair_braids', hairColorId:'turquoise' }
  const [first, second] = await Promise.all([
    serviceA.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, concurrentIdentity, concurrentKey)),
    serviceB.rpc('save_multi_village_character_identity_admin', saveArgs(userA.id, concurrentIdentity, concurrentKey)),
  ])
  assert.deepEqual(ok(first, 'concurrent first'), ok(second, 'concurrent second'))
  const resultRows = ok(await admin.from('multi_village_character_identity_results')
    .select('idempotency_key').eq('auth_user_id', userA.id).eq('idempotency_key', concurrentKey), 'concurrent result rows')
  assert.equal(resultRows.length, 1)

  const profileAfter = ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userA.id }), 'profile after save')
  assert.deepEqual(profileAfter.loadout, { ...concurrentIdentity, outfitId:'overalls', accessoryId:'acc_glasses' })
  const bAfter = ok(await admin.rpc('get_multi_village_character_profile_admin', { p_auth_user_id:userB.id }), 'B unchanged')
  assert.deepEqual(bAfter.loadout, DEFAULT)

  const afterOutfit = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'outfit', 'basic', 'outfit')), 'outfit after identity')
  assert.deepEqual(afterOutfit.loadout, { ...concurrentIdentity, outfitId:'basic', accessoryId:'acc_glasses' })
  const afterUnequip = ok(await admin.rpc('equip_multi_village_character_item_admin', equipArgs(userA.id, 'accessory', null, null)), 'accessory after identity')
  assert.deepEqual(afterUnequip.loadout, { ...concurrentIdentity, outfitId:'basic', accessoryId:null })

  const walletsAfter = ok(await admin.from('participant_village_wallets').select('village,balance').eq('participant_id', participantA).order('village'), 'wallets after')
  const ownedAfter = ok(await admin.from('participant_catalog_items').select('item_id').eq('participant_id', participantA).order('item_id'), 'owned after')
  assert.deepEqual(walletsAfter, walletsBefore)
  assert.deepEqual(ownedAfter, ownedBefore)
  console.log('Stage 3 Character Identity DB/RLS/idempotency integration checks passed.')
} finally {
  await admin.from('study_participants').delete().in('participant_id', [participantA, participantB, participantInactive])
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
  if (inactiveUser) await admin.auth.admin.deleteUser(inactiveUser.id).catch(() => {})
}
