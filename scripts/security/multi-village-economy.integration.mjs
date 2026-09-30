import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import {
  ATTENDANCE_AMOUNTS,
  attendanceDay7TieOrder,
  attendanceVillagePermutation,
  getKstWeekContext,
  VILLAGES,
} from '../../lib/multiVillageEconomyCore.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const hmacSecret = process.env.MULTI_VILLAGE_ECONOMY_HMAC_SECRET
const dbContainer = process.env.SECURITY_TEST_DB_CONTAINER

if (!url || !anonKey || !serviceKey || !hmacSecret || !dbContainer) {
  throw new Error('Local economy integration environment is incomplete')
}
if (hmacSecret.length < 32) throw new Error('The local HMAC secret must contain at least 32 characters')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')
assert.match(dbContainer, /^supabase_db_[a-z0-9-]+$/, 'unsafe local DB container name')

const clientOptions = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
const admin = createClient(url, serviceKey, clientOptions)
const serviceConnections = Array.from({ length: 4 }, () => createClient(url, serviceKey, clientOptions))
const anonymous = createClient(url, anonKey, clientOptions)
const clientA = createClient(url, anonKey, clientOptions)
const clientB = createClient(url, anonKey, clientOptions)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `ECON_A_${suffix}`
const participantB = `ECON_B_${suffix}`
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function cost(overrides = {}) {
  return Object.fromEntries(VILLAGES.map((village) => [village, overrides[village] || 0]))
}

function purchaseArgs(userId, itemId, itemCost, key = crypto.randomUUID(), options = {}) {
  return {
    p_auth_user_id: userId,
    p_item_id: itemId,
    p_item_type: options.type || 'integration_item',
    p_cost: itemCost,
    p_grant_item_ids: options.grants || [itemId],
    p_is_bundle: options.bundle || false,
    p_completion_candidates: options.completions || [],
    p_idempotency_key: key,
  }
}

async function balances(participantId) {
  const rows = ok(await admin.from('participant_village_wallets')
    .select('village,balance').eq('participant_id', participantId), 'read balances')
  return Object.fromEntries(rows.map((row) => [row.village, row.balance]))
}

async function setBalances(participantId, balance) {
  ok(await admin.from('participant_village_wallets').update({ balance })
    .eq('participant_id', participantId), `set ${participantId} balances`)
}

async function holdWalletLock(participantId, seconds = 1.2) {
  assert.match(participantId, /^[A-Z0-9_]+$/, 'unsafe participant id')
  const sql = `begin; select 1 from public.participant_village_wallets where participant_id='${participantId}' order by village for update; select pg_sleep(${seconds}); commit;`
  const child = spawn('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const wait = new Promise((resolve, reject) => child.once('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`local lock helper failed (${code}): ${stderr.trim()}`))
  }))
  await delay(250)
  return { wait, held: true }
}

async function runLocalSql(sql, label) {
  const child = spawn('docker', [
    'exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  await new Promise((resolve, reject) => child.once('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`${label} failed (${code}): ${stderr.trim()}`))
  }))
}

function rewardRow(participantId, sound, overrides = {}) {
  const { skipped = false, ...storedOverrides } = overrides
  return {
    participant_id: participantId,
    session_id: `ECON_SESSION_${suffix}`,
    experiment_round: 1,
    canonical_audio_id: sound.canonical_audio_id,
    sound_id: sound.sound_id,
    zone: sound.zone,
    source_type: null,
    sub_category: null,
    audioset_class: null,
    expression_text: skipped ? '' : 'economy integration',
    selected_features: null,
    confidence: skipped ? null : 3,
    difficulty: null,
    play_count: 1,
    listening_time_sec: 1,
    is_skipped: skipped,
    skip_reason: skipped ? 'user_skip' : '',
    device_info: 'economy-integration',
    stage: 1,
    is_verified: false,
    vote_count: 0,
    version: 'economy-integration',
    ...storedOverrides,
  }
}

try {
  userA = ok(await clientA.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await clientB.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.from('study_participants').insert([
    { participant_id: participantA, auth_user_id: userA.id, group_id: 'A', status: 'active' },
    { participant_id: participantB, auth_user_id: userB.id, group_id: 'B', status: 'active' },
  ]), 'create participants')

  const walletA = ok(await admin.rpc('get_multi_village_wallets_admin', { p_auth_user_id: userA.id }), 'initialize A wallets')
  const walletB = ok(await admin.rpc('get_multi_village_wallets_admin', { p_auth_user_id: userB.id }), 'initialize B wallets')
  assert.deepEqual(walletA.balances, cost())
  assert.deepEqual(walletB.balances, cost())
  assert.equal(Object.keys(walletA.balances).length, 6)

  const invalidVillage = await admin.from('participant_village_wallets')
    .insert({ participant_id: participantA, village: 'Invalid', balance: 0 })
  assert(invalidVillage.error, 'invalid village must be rejected')
  const negativeBalance = await admin.from('participant_village_wallets')
    .update({ balance: -1 }).eq('participant_id', participantA).eq('village', 'Animal')
  assert(negativeBalance.error, 'negative balance must be rejected')

  const anonRead = await anonymous.from('participant_village_wallets').select('*')
  assert(anonRead.error, 'anon wallet read must be denied')
  const ownWallets = ok(await clientA.from('participant_village_wallets').select('*'), 'A reads own wallets')
  assert.equal(ownWallets.length, 6)
  assert(ownWallets.every((row) => row.participant_id === participantA))
  const crossWallets = ok(await clientA.from('participant_village_wallets')
    .select('*').eq('participant_id', participantB), 'A queries B wallets')
  assert.deepEqual(crossWallets, [])
  for (const mutation of [
    clientA.from('participant_village_wallets').insert({ participant_id: participantA, village: 'Animal', balance: 1 }),
    clientA.from('participant_village_wallets').update({ balance: 1 }).eq('participant_id', participantA),
    clientA.from('participant_village_wallets').delete().eq('participant_id', participantA),
  ]) assert((await mutation).error, 'authenticated direct wallet mutation must be denied')

  await setBalances(participantA, 100)
  const fourKey = crypto.randomUUID()
  const four = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, `four_${suffix}`, cost({ Animal: 5, Human: 5, Nature: 5, Urban: 5 }), fourKey,
  )), 'four-wallet purchase')
  assert.equal(four.ok, true)
  const fourLedger = ok(await admin.from('village_currency_ledger').select('*')
    .eq('participant_id', participantA).eq('related_id', `four_${suffix}`), 'four-wallet ledger')
  assert.equal(fourLedger.length, 4)
  assert.equal(new Set(fourLedger.map((row) => row.operation_id)).size, 1)
  assert(fourLedger.every((row) => row.balance_after === 95))

  const all = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, `all_${suffix}`, cost(Object.fromEntries(VILLAGES.map((village) => [village, 10]))),
  )), 'all-wallet purchase')
  assert.equal(all.ok, true)
  const allLedger = ok(await admin.from('village_currency_ledger').select('*')
    .eq('participant_id', participantA).eq('related_id', `all_${suffix}`), 'all-wallet ledger')
  assert.equal(allLedger.length, 6)
  assert.equal(new Set(allLedger.map((row) => row.operation_id)).size, 1)
  const afterAll = await balances(participantA)
  for (const row of allLedger) assert.equal(row.balance_after, afterAll[row.village])

  const zeroPurchase = await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, `zero_${suffix}`, cost(),
  ))
  assert(zeroPurchase.error, 'zero-price RPC purchase must fail')
  assert.match(zeroPurchase.error.message, /INVALID_CATALOG_PURCHASE/)

  const beforeInsufficient = await balances(participantA)
  const ledgerBefore = ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantA), 'ledger before insufficient').length
  const insufficientKey = crypto.randomUUID()
  const insufficientArgs = purchaseArgs(userA.id, `insufficient_${suffix}`, cost({ Animal: 9999, Human: 1 }), insufficientKey)
  const insufficient = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', insufficientArgs), 'insufficient purchase')
  const insufficientReplay = ok(await serviceConnections[1].rpc('purchase_multi_village_item_admin', insufficientArgs), 'insufficient replay')
  assert.deepEqual(insufficientReplay, insufficient)
  assert.equal(insufficient.reason, 'insufficient_funds')
  assert.deepEqual(insufficient.wallets.Animal, { balance: beforeInsufficient.Animal, required: 9999, shortage: 9999 - beforeInsufficient.Animal })
  assert.deepEqual(await balances(participantA), beforeInsufficient)
  assert.equal(ok(await admin.from('village_currency_ledger').select('id').eq('participant_id', participantA), 'ledger after insufficient').length, ledgerBefore)
  assert.equal(ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantA).eq('item_id', `insufficient_${suffix}`), 'insufficient ownership').length, 0)
  ok(await admin.from('participant_village_wallets').update({ balance: 9999 })
    .eq('participant_id', participantA).eq('village', 'Animal'), 'fund retry wallet')
  const fundedRetry = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', {
    ...insufficientArgs, p_idempotency_key: crypto.randomUUID(),
  }), 'new-key funded retry')
  assert.equal(fundedRetry.ok, true)

  await setBalances(participantB, 100)
  const bundleId = `bundle_${suffix}`
  const bundleParts = [`bundle_a_${suffix}`, `bundle_b_${suffix}`, `bundle_c_${suffix}`]
  const bundle = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userB.id, bundleId, cost(Object.fromEntries(VILLAGES.map((village) => [village, 15]))), crypto.randomUUID(),
    { type: 'theme_set', bundle: true, grants: bundleParts },
  )), 'bundle purchase')
  assert.equal(bundle.ok, true)
  assert.equal(ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantB).in('item_id', bundleParts), 'bundle ownership').length, bundleParts.length)
  const bundleLedger = ok(await admin.from('village_currency_ledger').select('operation_id,amount')
    .eq('participant_id', participantB).eq('related_id', bundleId), 'bundle ledger')
  assert.equal(bundleLedger.length, 6)
  assert.equal(bundleLedger.reduce((sum, row) => sum + row.amount, 0), -90)
  assert.equal(new Set(bundleLedger.map((row) => row.operation_id)).size, 1)

  const partialComponent = `partial_a_${suffix}`
  ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, partialComponent, cost({ Human: 1 }),
  )), 'partial component purchase')
  const partial = ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, `partial_bundle_${suffix}`, cost(Object.fromEntries(VILLAGES.map((village) => [village, 1]))), crypto.randomUUID(),
    { type: 'theme_set', bundle: true, grants: [partialComponent, `partial_b_${suffix}`] },
  )), 'partial bundle rejection')
  assert.equal(partial.reason, 'bundle_partially_owned')

  const completionA = `completion_a_${suffix}`
  const completionB = `completion_b_${suffix}`
  const rewardId = `reward_${suffix}`
  ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, completionA, cost({ Music: 1 }),
  )), 'completion component A')
  ok(await serviceConnections[0].rpc('purchase_multi_village_item_admin', purchaseArgs(
    userA.id, completionB, cost({ Lab: 1 }), crypto.randomUUID(), {
      completions: [{
        setId: `completion_set_${suffix}`, rewardId, assetId: `placeholder_${rewardId}`,
        assetSelectionRequired: true, bundleItemIds: [completionA, completionB],
      }],
    },
  )), 'completion component B')
  const completion = ok(await admin.from('participant_collection_completions').select('*')
    .eq('participant_id', participantA).eq('reward_id', rewardId).single(), 'completion record')
  assert.equal(completion.status, 'eligible_pending_asset')
  assert.equal(ok(await admin.from('participant_catalog_items').select('item_id')
    .eq('participant_id', participantA).like('item_id', 'placeholder_%'), 'placeholder ownership').length, 0)

  await setBalances(participantB, 80)
  const sameKey = crypto.randomUUID()
  const inFlightItem = `inflight_${suffix}`
  const held = await holdWalletLock(participantB)
  const startedAt = Date.now()
  const inFlightArgs = purchaseArgs(userB.id, inFlightItem, cost({ Animal: 5 }), sameKey)
  const firstInFlight = serviceConnections[0].rpc('purchase_multi_village_item_admin', inFlightArgs)
  await delay(100)
  const secondInFlight = serviceConnections[1].rpc('purchase_multi_village_item_admin', inFlightArgs)
  const inFlightResults = await Promise.all([firstInFlight, secondInFlight])
  await held.wait
  const inFlightA = ok(inFlightResults[0], 'in-flight purchase')
  const inFlightB = ok(inFlightResults[1], 'in-flight replay')
  assert.deepEqual(inFlightB, inFlightA)
  if (held.held) assert(Date.now() - startedAt >= 900, 'lock probe did not overlap processing')
  assert.equal(ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantB).eq('related_id', inFlightItem), 'in-flight ledger').length, 1)

  const sameItem = `same_item_${suffix}`
  const sameItemResults = await Promise.all(serviceConnections.slice(0, 2).map((connection) => connection.rpc(
    'purchase_multi_village_item_admin', purchaseArgs(userB.id, sameItem, cost({ Human: 5 })),
  )))
  const sameItemData = sameItemResults.map((result, index) => ok(result, `same item ${index + 1}`))
  assert.equal(sameItemData.filter((result) => result.ok).length, 1)
  assert.equal(sameItemData.filter((result) => result.reason === 'already_owned').length, 1)
  assert.equal(ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantB).eq('related_id', sameItem), 'same-item ledger').length, 1)

  await setBalances(participantB, 0)
  ok(await admin.from('participant_village_wallets').update({ balance: 5 })
    .eq('participant_id', participantB).eq('village', 'Nature'), 'limited shared wallet')
  const competingItems = [`compete_a_${suffix}`, `compete_b_${suffix}`]
  const competing = await Promise.all(competingItems.map((itemId, index) => serviceConnections[index].rpc(
    'purchase_multi_village_item_admin', purchaseArgs(userB.id, itemId, cost({ Nature: 5 })),
  )))
  const competingData = competing.map((result, index) => ok(result, `competing purchase ${index + 1}`))
  assert.equal(competingData.filter((result) => result.ok).length, 1)
  assert.equal(competingData.filter((result) => result.reason === 'insufficient_funds').length, 1)
  assert.equal((await balances(participantB)).Nature, 0)

  const week = getKstWeekContext()
  const decision = {
    permutation: attendanceVillagePermutation({ secret: hmacSecret, participantId: participantB, weekKey: week.weekKey }),
    tieOrder: attendanceDay7TieOrder({ secret: hmacSecret, participantId: participantB, weekKey: week.weekKey }),
  }
  assert.equal(new Set(decision.permutation).size, 6)
  assert.equal(ATTENDANCE_AMOUNTS.reduce((sum, amount) => sum + amount, 0), 21)
  const attendanceArgs = (key) => ({
    p_auth_user_id: userB.id,
    p_expected_local_date: week.localDate,
    p_expected_week_start: week.weekKey,
    p_permutation: decision.permutation,
    p_day7_tie_order: decision.tieOrder,
    p_hmac_version: 'hmac-sha256-v1',
    p_idempotency_key: key,
  })
  const attendanceResults = await Promise.all(serviceConnections.slice(0, 2).map((connection) => connection.rpc(
    'claim_multi_village_attendance_admin', attendanceArgs(crypto.randomUUID()),
  )))
  const attendanceA = ok(attendanceResults[0], 'attendance concurrent A')
  const attendanceB = ok(attendanceResults[1], 'attendance concurrent B')
  assert.deepEqual(attendanceB, attendanceA)
  assert.equal(attendanceA.attendanceDay, week.attendanceDay)
  assert.equal(attendanceA.amount, week.amount)
  const claims = ok(await admin.from('multi_village_attendance_claims').select('*')
    .eq('participant_id', participantB).eq('week_start', week.weekKey), 'attendance claims')
  assert.equal(claims.length, 1)
  const storedWeek = ok(await admin.from('multi_village_attendance_weeks').select('*')
    .eq('participant_id', participantB).eq('week_start', week.weekKey).single(), 'stored attendance week')
  assert.deepEqual(storedWeek.village_permutation, decision.permutation)
  const changedPermutation = [...decision.permutation.slice(1), decision.permutation[0]]
  const changedDecision = await serviceConnections[0].rpc('get_multi_village_attendance_admin', {
    p_auth_user_id: userB.id, p_week_start: week.weekKey,
    p_permutation: changedPermutation, p_hmac_version: 'hmac-sha256-v1',
  })
  assert(changedDecision.error, 'stored attendance permutation must not change')

  const sounds = [0, 1, 2, 3].map((index) => ({
    sound_id: `ECON_SOUND_${index}_${suffix}`,
    zone: index === 0 ? 'Music' : index === 1 ? 'Lab' : index === 2 ? 'Animal' : 'Invalid',
    group_id: 'A',
    canonical_audio_id: `economy:${index}:${suffix}`,
    file_path: `Audio/economy-${index}-${suffix}`,
    source_dataset: 'economy-integration',
    original_filename: `economy-${index}-${suffix}`,
  }))
  ok(await admin.from('study_sound_catalog').insert(sounds.slice(0, 3)), 'reward sounds')
  const annotation = ok(await admin.from('annotations').insert(rewardRow(participantA, sounds[0])).select('id').single(), 'reward annotation')
  const skipped = ok(await admin.from('annotations').insert(rewardRow(participantA, sounds[2], { skipped: true })).select('id').single(), 'skipped annotation')
  let invalidAnnotationId = null
  const invalidSound = await admin.from('study_sound_catalog').insert(sounds[3])
  let invalidAnnotation = null
  if (!invalidSound.error) {
    invalidAnnotation = await admin.from('annotations').insert(rewardRow(participantA, sounds[3])).select('id').single()
    if (!invalidAnnotation.error) invalidAnnotationId = invalidAnnotation.data.id
  }
  const vote = ok(await admin.from('votes').insert({
    participant_id: participantA,
    session_id: `ECON_SESSION_${suffix}`,
    experiment_round: 1,
    canonical_audio_id: sounds[1].canonical_audio_id,
    sound_id: sounds[1].sound_id,
    zone: sounds[1].zone,
    annotation_id: annotation.id,
    confidence: 3,
    play_count: 1,
    listening_time_sec: 1,
    stage: 2,
    version: 'economy-integration',
  }).select('id').single(), 'reward vote')

  const rewardBefore = await balances(participantA)
  const annotationRewards = await Promise.all(serviceConnections.slice(0, 2).map((connection) => connection.rpc(
    'credit_verified_activity_village_admin', {
      p_auth_user_id: userA.id, p_activity_type: 'annotation', p_result_id: annotation.id,
      p_idempotency_key: crypto.randomUUID(),
    },
  )))
  annotationRewards.forEach((result, index) => ok(result, `annotation reward ${index + 1}`))
  const afterAnnotationReward = await balances(participantA)
  assert.equal(afterAnnotationReward.Music, rewardBefore.Music + 5)
  assert.equal(ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantA).eq('entry_type', 'earn_annotation').eq('related_id', annotation.id), 'annotation reward ledger').length, 1)

  const voteRewards = await Promise.all(serviceConnections.slice(0, 2).map((connection) => connection.rpc(
    'credit_verified_activity_village_admin', {
      p_auth_user_id: userA.id, p_activity_type: 'vote', p_result_id: vote.id,
      p_idempotency_key: crypto.randomUUID(),
    },
  )))
  voteRewards.forEach((result, index) => ok(result, `vote reward ${index + 1}`))
  assert.equal((await balances(participantA)).Lab, afterAnnotationReward.Lab + 2)
  assert.equal(ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantA).eq('entry_type', 'earn_vote').eq('related_id', vote.id), 'vote reward ledger').length, 1)

  const beforeInvalidRewards = await balances(participantA)
  const skippedReward = await serviceConnections[0].rpc('credit_verified_activity_village_admin', {
    p_auth_user_id: userA.id, p_activity_type: 'annotation', p_result_id: skipped.id,
    p_idempotency_key: crypto.randomUUID(),
  })
  assert(skippedReward.error, 'skipped annotation must not be rewarded')
  if (invalidAnnotationId) {
    const invalidReward = await serviceConnections[0].rpc('credit_verified_activity_village_admin', {
      p_auth_user_id: userA.id, p_activity_type: 'annotation', p_result_id: invalidAnnotationId,
      p_idempotency_key: crypto.randomUUID(),
    })
    assert(invalidReward.error, 'invalid stored zone must fail before reward')
  } else {
    assert(invalidSound.error || invalidAnnotation?.error, 'invalid zone must be rejected at storage or reward boundary')
  }
  assert.deepEqual(await balances(participantA), beforeInvalidRewards)

  const otherLedger = ok(await clientB.from('village_currency_ledger').select('*')
    .eq('participant_id', participantA), 'B queries A ledger')
  assert.deepEqual(otherLedger, [])
  const ledgerRow = ok(await admin.from('village_currency_ledger').select('id')
    .eq('participant_id', participantA).limit(1).single(), 'immutable ledger row')
  const ledgerUpdate = await admin.from('village_currency_ledger').update({ related_id: 'mutated' }).eq('id', ledgerRow.id)
  assert(ledgerUpdate.error, 'ledger UPDATE must be blocked')
  const ledgerDelete = await admin.from('village_currency_ledger').delete().eq('id', ledgerRow.id)
  assert(ledgerDelete.error, 'ledger DELETE must be blocked')

  console.log('Multi-village economy local integration and concurrency checks passed.')
} finally {
  const cleanupSql = `
    begin;
    alter table public.village_currency_ledger disable trigger village_currency_ledger_immutable;
    delete from public.multi_village_attendance_claims where participant_id in ('${participantA}','${participantB}');
    delete from public.multi_village_attendance_weeks where participant_id in ('${participantA}','${participantB}');
    delete from public.participant_collection_completions where participant_id in ('${participantA}','${participantB}');
    delete from public.participant_catalog_items where participant_id in ('${participantA}','${participantB}');
    delete from public.village_currency_ledger where participant_id in ('${participantA}','${participantB}');
    delete from public.multi_village_purchase_results where participant_id in ('${participantA}','${participantB}');
    delete from public.participant_village_wallets where participant_id in ('${participantA}','${participantB}');
    alter table public.village_currency_ledger enable trigger village_currency_ledger_immutable;
    delete from public.votes where participant_id in ('${participantA}','${participantB}');
    delete from public.annotations where participant_id in ('${participantA}','${participantB}');
    delete from public.study_sound_catalog where sound_id like 'ECON_SOUND_%_${suffix}';
    delete from public.study_participants where participant_id in ('${participantA}','${participantB}');
    commit;
  `
  await runLocalSql(cleanupSql, 'economy integration cleanup')
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
