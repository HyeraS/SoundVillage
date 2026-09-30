import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const dbContainer = process.env.SECURITY_TEST_DB_CONTAINER
if (!url || !anonKey || !serviceKey || !dbContainer) throw new Error('Local Stage 3C environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')
assert.match(dbContainer, /^supabase_db_[a-z0-9-]+$/)

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const serviceA = createClient(url, serviceKey, options)
const serviceB = createClient(url, serviceKey, options)
const a = createClient(url, anonKey, options)
const b = createClient(url, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const pidA = `RUNTIME_A_${suffix}`
const pidB = `RUNTIME_B_${suffix}`
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

async function walletMap(participantId) {
  const rows = ok(await admin.from('participant_village_wallets').select('village,balance').eq('participant_id', participantId), 'wallet read')
  return Object.fromEntries(rows.map((row) => [row.village, Number(row.balance)]))
}

async function runCleanup() {
  const sql = `
    begin;
    alter table public.village_currency_ledger disable trigger village_currency_ledger_immutable;
    delete from public.multi_village_attendance_claims where participant_id in ('${pidA}','${pidB}');
    delete from public.multi_village_attendance_weeks where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_multi_village_character_loadouts where participant_id in ('${pidA}','${pidB}');
    delete from public.multi_village_character_equip_results where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_catalog_items where participant_id in ('${pidA}','${pidB}');
    delete from public.village_currency_ledger where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_village_wallets where participant_id in ('${pidA}','${pidB}');
    alter table public.village_currency_ledger enable trigger village_currency_ledger_immutable;
    delete from public.votes where participant_id in ('${pidA}','${pidB}');
    delete from public.annotations where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_daily_quests where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_attendance where participant_id in ('${pidA}','${pidB}');
    delete from public.idempotent_operations where participant_id in ('${pidA}','${pidB}');
    delete from public.study_sessions where participant_id in ('${pidA}','${pidB}');
    delete from public.participant_currency where participant_id in ('${pidA}','${pidB}');
    delete from public.study_participants where participant_id in ('${pidA}','${pidB}');
    commit;`
  await new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio:['ignore','ignore','pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr)))
  })
}

try {
  userA = ok(await a.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await b.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.from('study_participants').insert([
    { participant_id:pidA, auth_user_id:userA.id, group_id:'A', status:'active' },
    { participant_id:pidB, auth_user_id:userB.id, group_id:'B', status:'active' },
  ]), 'participants')
  ok(await a.rpc('start_or_resume_study_session_v2', { p_client_instance_id:crypto.randomUUID() }), 'session A')
  ok(await b.rpc('start_or_resume_study_session_v2', { p_client_instance_id:crypto.randomUUID() }), 'session B')
  const sounds = ok(await admin.from('study_sound_catalog').select('*').eq('group_id','A').order('sound_id').limit(3), 'catalog')
  assert(sounds.length >= 2)
  const [sound, skipSound] = sounds

  const legacyBalanceBefore = ok(await admin.from('participant_currency').select('*').in('participant_id',[pidA,pidB]), 'legacy balance before')
  const legacyLedgerBefore = ok(await admin.from('currency_transactions').select('id').in('participant_id',[pidA,pidB]), 'legacy ledger before').length
  const annotationKey = crypto.randomUUID()
  const annotationArgs = {
    p_auth_user_id:userA.id, p_idempotency_key:annotationKey, p_sound_id:sound.sound_id, p_zone:sound.zone,
    p_expression_text:'통합', p_confidence:3, p_play_count:1, p_listening_time_sec:1,
  }
  const annotationPair = await Promise.all([
    serviceA.rpc('submit_annotation_economy_v1_admin', annotationArgs),
    serviceB.rpc('submit_annotation_economy_v1_admin', annotationArgs),
  ])
  const annotation = ok(annotationPair[0], 'annotation one')
  const annotationReplay = ok(annotationPair[1], 'annotation replay')
  assert.equal(annotation.annotationId, annotationReplay.annotationId)
  assert.equal(annotation.reward.awarded, 5)
  assert.equal(annotation.reward.village, sound.zone)
  assert.equal(annotation.quests.currencyAwarded, 0)
  const afterAnnotation = await walletMap(pidA)
  assert.equal(afterAnnotation[sound.zone], 5)
  assert(Object.entries(afterAnnotation).every(([village,balance]) => balance === (village === sound.zone ? 5 : 0)))

  const duplicate = ok(await admin.rpc('submit_annotation_economy_v1_admin', {
    ...annotationArgs, p_idempotency_key:crypto.randomUUID(), p_expression_text:'중복',
  }), 'business duplicate')
  assert.equal(duplicate.alreadyCompleted, true)
  assert.equal(duplicate.reward.awarded, 0)
  assert.deepEqual(await walletMap(pidA), afterAnnotation)

  const skipped = ok(await admin.rpc('submit_annotation_economy_v1_admin', {
    ...annotationArgs, p_idempotency_key:crypto.randomUUID(), p_sound_id:skipSound.sound_id,
    p_zone:skipSound.zone, p_expression_text:'', p_is_skipped:true, p_skip_reason:'user_skip',
  }), 'skip')
  assert.equal(skipped.reward.awarded, 0)
  assert.deepEqual(await walletMap(pidA), afterAnnotation)

  const voteKey = crypto.randomUUID()
  const voteArgs = {
    p_auth_user_id:userB.id, p_idempotency_key:voteKey, p_sound_id:sound.sound_id, p_zone:sound.zone,
    p_annotation_id:annotation.annotationId, p_confidence:3, p_play_count:1, p_listening_time_sec:1,
  }
  const votePair = await Promise.all([
    serviceA.rpc('submit_museum_vote_economy_v1_admin', voteArgs),
    serviceB.rpc('submit_museum_vote_economy_v1_admin', voteArgs),
  ])
  const vote = ok(votePair[0], 'vote one')
  assert.equal(ok(votePair[1], 'vote replay').voteId, vote.voteId)
  assert.equal(vote.reward.awarded, 2)
  assert.equal(vote.reward.village, sound.zone)
  const afterVote = await walletMap(pidB)
  assert.equal(afterVote[sound.zone], 2)
  assert(Object.entries(afterVote).every(([village,balance]) => balance === (village === sound.zone ? 2 : 0)))

  const annotationLedger = ok(await admin.from('village_currency_ledger').select('*').eq('participant_id',pidA).eq('entry_type','earn_annotation'), 'annotation ledger')
  const voteLedger = ok(await admin.from('village_currency_ledger').select('*').eq('participant_id',pidB).eq('entry_type','earn_vote'), 'vote ledger')
  assert.equal(annotationLedger.length, 1)
  assert.equal(voteLedger.length, 1)
  assert.equal(ok(await admin.from('currency_transactions').select('id').in('participant_id',[pidA,pidB]), 'legacy ledger after').length, legacyLedgerBefore)
  assert.deepEqual(ok(await admin.from('participant_currency').select('*').in('participant_id',[pidA,pidB]), 'legacy balance after'), legacyBalanceBefore)
  assert((await a.rpc('submit_annotation_economy_v1_admin', annotationArgs)).error, 'browser must not execute admin writer')
  assert.deepEqual(ok(await b.from('participant_village_wallets').select('*').eq('participant_id',pidA), 'cross wallet read'), [])
  console.log('Stage 3C runtime integration checks passed.')
} finally {
  await runCleanup().catch((error) => console.error('cleanup failed', error))
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
