import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('SECURITY_TEST_SUPABASE_* variables are required')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const anonymous = createClient(url, anonKey, { auth: { persistSession: false } })
const a = createClient(url, anonKey, { auth: { persistSession: false } })
const b = createClient(url, anonKey, { auth: { persistSession: false } })
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const pidA = `LOG_A_${suffix}`
const pidB = `LOG_B_${suffix}`
let userA
let userB
let sessionA
let sessionB

const ok = (result, label) => {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}
const startArgs = resume => ({
  p_resume_session_id: resume || null,
  p_client_instance_id: crypto.randomUUID(),
  p_initial_screen: 'world',
  p_experiment_version: 'integration',
  p_user_agent: 'integration-test',
  p_viewport_width: 1280,
  p_viewport_height: 720,
  p_locale: 'ko-KR',
  p_timezone: 'Asia/Seoul',
})
const event = (overrides = {}) => ({
  id: crypto.randomUUID(),
  client_instance_id: crypto.randomUUID(),
  sequence_no: 1,
  event_name: 'screen_viewed',
  occurred_at: new Date().toISOString(),
  screen: 'world',
  target_type: 'screen',
  target_id: 'world',
  interaction_method: 'programmatic',
  app_version: 'integration',
  ...overrides,
})

try {
  assert((await anonymous.rpc('start_or_resume_study_session_v2', startArgs())).error, 'anonymous session start must fail')
  ok(await admin.from('study_participants').insert([
    { participant_id: pidA, group_id: 'A' }, { participant_id: pidB, group_id: 'B' },
  ]), 'participants')
  userA = ok(await a.auth.signInAnonymously(), 'sign in A').user
  userB = ok(await b.auth.signInAnonymously(), 'sign in B').user
  ok(await admin.rpc('claim_study_participant_admin', { p_auth_user_id: userA.id, p_group_id: 'A', p_participant_id: pidA }), 'claim A')
  ok(await admin.rpc('claim_study_participant_admin', { p_auth_user_id: userB.id, p_group_id: 'B', p_participant_id: pidB }), 'claim B')

  const startedA = ok(await a.rpc('start_or_resume_study_session_v2', startArgs()), 'start A')
  sessionA = startedA.studySessionId
  assert.equal(startedA.participantId, pidA)
  assert.equal(startedA.groupId, 'A')
  assert.equal(startedA.resumed, false)
  const resumedA = ok(await a.rpc('start_or_resume_study_session_v2', startArgs(sessionA)), 'resume A')
  assert.equal(resumedA.studySessionId, sessionA)
  assert.equal(resumedA.resumed, true)
  sessionB = ok(await b.rpc('start_or_resume_study_session_v2', startArgs()), 'start B').studySessionId

  const row = event()
  const first = ok(await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [row] }), 'record A')
  assert.equal(first.stored, 1)
  const replay = ok(await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [row] }), 'replay A')
  assert.equal(replay.stored, 0)
  assert.equal(replay.duplicates, 1)

  assert((await b.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [event()] })).error, 'B cannot write A session')
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [{ ...event(), participant_id: pidB }] })).error, 'participant spoof field must be rejected')
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [event({ event_name: 'click' })] })).error, 'unknown event must fail')
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: Array.from({ length: 26 }, () => event()) })).error, 'oversized batch must fail')
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [event({ metadata: { value: 'x'.repeat(3000) } })] })).error, 'oversized metadata must fail')
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [event({ id: crypto.randomUUID(), client_instance_id: row.client_instance_id, sequence_no: row.sequence_no })] })).error, 'sequence collision must fail')

  assert((await a.from('user_events').insert({ ...row, study_session_id: sessionA })).error, 'direct INSERT must fail')
  assert((await a.from('user_events').update({ outcome: 'tampered' }).eq('id', row.id)).error, 'UPDATE must fail')
  assert((await a.from('user_events').delete().eq('id', row.id)).error, 'DELETE must fail')
  assert.deepEqual(ok(await a.from('user_events').select('*'), 'participant select'), [])
  assert.equal(ok(await admin.from('user_events').select('id').eq('id', row.id), 'service read').length, 1)

  ok(await admin.from('study_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), completion_reason: 'integration_fixture' }).eq('id', sessionA), 'complete logging fixture')
  const finalEvent = ok(await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [event({ event_name: 'session_completed' })] }), 'final completed-session event')
  assert.equal(finalEvent.stored, 1)
  const tooLate = event({ occurred_at: new Date(Date.now() + 11 * 60 * 1000).toISOString() })
  assert((await a.rpc('record_user_events_v1', { p_study_session_id: sessionA, p_events: [tooLate] })).error, 'completed session rejects events outside the final flush window')
  console.log('User-event logging integration checks passed.')
} finally {
  if (sessionA || sessionB) await admin.from('user_events').delete().in('study_session_id', [sessionA, sessionB].filter(Boolean))
  if (sessionA || sessionB) await admin.from('study_sessions').delete().in('id', [sessionA, sessionB].filter(Boolean))
  await admin.from('study_participants').delete().in('participant_id', [pidA, pidB])
  if (userA) await admin.auth.admin.deleteUser(userA.id)
  if (userB) await admin.auth.admin.deleteUser(userB.id)
}
