import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local quest/attendance environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const a = createClient(url, anonKey, options)
const b = createClient(url, anonKey, options)
const unauthenticated = createClient(url, anonKey, options)
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const participantA = `REWARD_A_${suffix}`
const participantB = `REWARD_B_${suffix}`
let userA
let userB

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

try {
  userA = ok(await a.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await b.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.from('study_participants').insert([
    { participant_id:participantA, auth_user_id:userA.id, group_id:'A', status:'active' },
    { participant_id:participantB, auth_user_id:userB.id, group_id:'B', status:'active' },
  ]), 'participants')
  ok(await a.rpc('start_or_resume_study_session_v2', { p_client_instance_id:crypto.randomUUID() }), 'session A')
  ok(await b.rpc('start_or_resume_study_session_v2', { p_client_instance_id:crypto.randomUUID() }), 'session B')

  const questPair = await Promise.all([
    a.rpc('ensure_today_quests', { p_known_sub_categories:[] }),
    a.rpc('ensure_today_quests', { p_known_sub_categories:[] }),
  ])
  const questsA = ok(questPair[0], 'quests A first')
  const questsAReplay = ok(questPair[1], 'quests A replay')
  assert.deepEqual(questsAReplay.map((row) => row.id).sort(), questsA.map((row) => row.id).sort())
  assert(questsA.length > 0, 'active quest templates must create at least one quest')
  const assignedDate = questsA[0].assigned_date
  const storedQuestsA = ok(await admin.from('participant_daily_quests').select('id,quest_template_id')
    .eq('participant_id', participantA).eq('assigned_date', assignedDate), 'stored quests A')
  assert.equal(storedQuestsA.length, questsA.length)
  assert.equal(new Set(storedQuestsA.map((row) => row.quest_template_id)).size, storedQuestsA.length)

  const questsB = ok(await b.rpc('ensure_today_quests', { p_known_sub_categories:[] }), 'quests B')
  assert(questsB.length > 0)
  assert.deepEqual(ok(await b.from('participant_daily_quests').select('id').eq('participant_id', participantA), 'B reads A quests'), [])
  assert((await unauthenticated.rpc('ensure_today_quests', { p_known_sub_categories:[] })).error, 'unauthenticated quest creation must fail')

  const attendanceKeys = [crypto.randomUUID(), crypto.randomUUID()]
  const attendancePair = await Promise.all(attendanceKeys.map((key) => (
    a.rpc('ensure_today_check_in_v4', { p_idempotency_key:key })
  )))
  const attendanceFirst = ok(attendancePair[0], 'attendance A first')
  const attendanceSecond = ok(attendancePair[1], 'attendance A repeat with another key')
  assert.equal(attendanceFirst.row.id, attendanceSecond.row.id)
  assert.equal(Number(attendanceFirst.isNew) + Number(attendanceSecond.isNew), 1)
  const sameKeyReplay = ok(await a.rpc('ensure_today_check_in_v4', { p_idempotency_key:attendanceKeys[0] }), 'attendance same-key replay')
  assert.deepEqual(sameKeyReplay, attendanceFirst)

  const expectedKstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit',
  }).format(new Date())
  assert.equal(attendanceFirst.row.check_in_date, expectedKstDate)
  const attendanceRows = ok(await admin.from('participant_attendance').select('*')
    .eq('participant_id', participantA).eq('check_in_date', expectedKstDate), 'attendance rows A')
  assert.equal(attendanceRows.length, 1)
  const attendanceLedger = ok(await admin.from('currency_transactions').select('amount,related_id')
    .eq('participant_id', participantA).eq('type', 'earn_attendance'), 'legacy attendance ledger')
  assert.equal(attendanceLedger.length, 1)
  assert.equal(Number(attendanceLedger[0].amount), Number(attendanceRows[0].reward_currency))
  assert.equal(String(attendanceLedger[0].related_id), String(attendanceRows[0].id))
  const legacyBalance = ok(await admin.from('participant_currency').select('balance')
    .eq('participant_id', participantA).single(), 'legacy balance A')
  assert.equal(Number(legacyBalance.balance), Number(attendanceRows[0].reward_currency))

  const statusA = ok(await a.rpc('get_attendance_status'), 'attendance status A')
  assert.equal(statusA.today.id, attendanceRows[0].id)
  ok(await b.rpc('ensure_today_check_in_v4', { p_idempotency_key:crypto.randomUUID() }), 'attendance B')
  assert.deepEqual(ok(await b.from('participant_attendance').select('id').eq('participant_id', participantA), 'B reads A attendance'), [])
  assert((await unauthenticated.rpc('get_attendance_status')).error, 'unauthenticated attendance status must fail')
  assert((await unauthenticated.rpc('ensure_today_check_in_v4', { p_idempotency_key:crypto.randomUUID() })).error,
    'unauthenticated attendance mutation must fail')

  console.log('Quest and attendance local DB integrity checks passed.')
} finally {
  const participants = [participantA, participantB]
  for (const table of ['user_events','idempotent_operations','currency_transactions','participant_currency','participant_daily_quests','participant_attendance','study_sessions']) {
    await admin.from(table).delete().in('participant_id', participants)
  }
  await admin.from('study_participants').delete().in('participant_id', participants)
  if (userA) await admin.auth.admin.deleteUser(userA.id).catch(() => {})
  if (userB) await admin.auth.admin.deleteUser(userB.id).catch(() => {})
}
