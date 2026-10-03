import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

async function loadQueueModule() {
  let source = await readFile(new URL('../../lib/userEvents.js', import.meta.url), 'utf8')
  source = source.replace(/^import .*$/gm, '')
  source = source.replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replaceAll('export class ', 'class ')
  source = source.slice(0, source.indexOf('\nlet queue = null'))
  return Function(`${source}\nreturn { USER_EVENT_NAMES, UserEventQueue, sanitizeObject, sanitizeValue, MAX_BATCH }`)()
}

const memoryStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

const uuidFactory = () => {
  let value = 0
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`
}

test('event identity, sequence, client instance, and strict-mode dedupe are stable', async () => {
  const { UserEventQueue } = await loadQueueModule()
  const ids = uuidFactory()
  const q = new UserEventQueue({ randomUUID: ids, now: () => 1_700_000_000_000 })
  q.bind({ userId: 'user-a', studySessionId: 'session-a' })
  const first = q.track('screen_viewed', { target_id: 'world' }, { dedupeKey: 'world-once' })
  const second = q.track('zone_entered', { target_id: 'zone-music' })
  assert.equal(first.sequence_no, 1)
  assert.equal(second.sequence_no, 2)
  assert.equal(q.track('screen_viewed', {}, { dedupeKey: 'world-once' }), null)
  const other = new UserEventQueue({ randomUUID: ids, now: () => 1_700_000_000_000 })
  other.bind({ userId: 'user-a', studySessionId: 'session-a' })
  assert.notEqual(other.clientInstanceId, q.clientInstanceId)
  assert.equal(other.track('screen_viewed').sequence_no, 1)
})

test('failed delivery retains the same IDs and successful retry removes them', async () => {
  const { UserEventQueue } = await loadQueueModule()
  const sent = []
  let fail = true
  const q = new UserEventQueue({
    randomUUID: uuidFactory(), now: () => 1_700_000_000_000,
    transport: async (_session, events) => { sent.push(events); return fail ? { ok: false, error: new Error('offline') } : { ok: true } },
  })
  q.bind({ userId: 'user-a', studySessionId: 'session-a' })
  const event = q.track('annotation_submit_attempted', {}, { critical: true })
  await assert.rejects(q.flush())
  assert.equal(q.queue.length, 1)
  fail = false
  q.nextRetryAt = 0
  await q.flush()
  assert.equal(q.queue.length, 0)
  assert.equal(sent[0][0].id, event.id)
  assert.equal(sent[1][0].id, event.id)
})

test('batch size is capped and participant storage is isolated', async () => {
  const { UserEventQueue, MAX_BATCH } = await loadQueueModule()
  const storage = memoryStorage()
  let delivered = 0
  const q = new UserEventQueue({
    storage, randomUUID: uuidFactory(), now: () => 1_700_000_000_000,
    transport: async (_session, events) => { delivered = events.length; return { ok: true } },
  })
  q.bind({ userId: 'user-a', studySessionId: 'session-a' })
  for (let i = 0; i < MAX_BATCH + 4; i++) q.track('screen_viewed', { target_id: `screen-${i}` })
  await q.flush()
  assert.equal(delivered, MAX_BATCH)
  assert.equal(q.queue.length, 4)
  q.bind({ userId: 'user-a', studySessionId: 'session-a-new' })
  assert.equal(q.queue.length, 0, 'old-session events must never be relabeled into a new study session')
  q.bind({ userId: 'user-b', studySessionId: 'session-b' })
  assert.equal(q.queue.length, 0)
})

test('sensitive and expression text fields are removed and payload remains bounded', async () => {
  const { UserEventQueue } = await loadQueueModule()
  const q = new UserEventQueue({ randomUUID: uuidFactory(), now: () => 1_700_000_000_000 })
  q.bind({ userId: 'user-a', studySessionId: 'session-a' })
  const event = q.track('expression_input_changed', {
    value_before: { expression_text: 'secret', api_key: 'secret', length: 4 },
    value_after: { text: 'also secret', participant_id: 'P001', length: 7, empty: false },
    metadata: { token: 'secret', retryable: true, position: { row: 2, col: 3, access_key: 'secret' } },
  })
  assert.deepEqual(event.value_before, { length: 4 })
  assert.deepEqual(event.value_after, { length: 7, empty: false })
  assert.deepEqual(event.metadata, { retryable: true, position: { row: 2, col: 3 } })
  const oversized = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`field_${i}`, i]))
  const bounded = q.create('unexpected_error', { value_after: oversized })
  assert.deepEqual(bounded.value_after, {})
  assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).length <= 4096)
})

test('unknown event names are rejected', async () => {
  const { UserEventQueue } = await loadQueueModule()
  const q = new UserEventQueue({ randomUUID: uuidFactory() })
  q.bind({ userId: 'user-a', studySessionId: 'session-a' })
  assert.throws(() => q.create('click'), /unknown_user_event/)
})

test('Character preview load records panel viewing but no attendance claim outcome', async () => {
  const source = await readFile(new URL('../../app/economy-v1-character-preview/EconomyV1CharacterPreview.js', import.meta.url), 'utf8')
  const loadStart = source.indexOf('const load = useCallback')
  const loadEnd = source.indexOf('\n  useEffect(', loadStart)
  const load = source.slice(loadStart, loadEnd)
  assert.match(load, /trackEvent\('attendance_panel_opened'/)
  assert.doesNotMatch(load, /attendance_check_(?:attempted|succeeded|failed)/)

  const claimStart = source.indexOf('const claimAttendance = async')
  const claimEnd = source.indexOf("\n  if (status === 'loading')", claimStart)
  const claim = source.slice(claimStart, claimEnd)
  for (const eventName of ['attendance_check_attempted', 'attendance_check_succeeded', 'attendance_check_failed']) {
    assert.match(claim, new RegExp(`trackEvent\\('${eventName}'`))
  }
})

test('client catalog matches migration and migration keeps writes RPC-only', async () => {
  const { USER_EVENT_NAMES } = await loadQueueModule()
  const sql = [
    await readFile(new URL('./004_user_event_logging.sql', import.meta.url), 'utf8'),
    await readFile(new URL('./009_multi_village_character_loadout.sql', import.meta.url), 'utf8'),
    await readFile(new URL('./010_multi_village_runtime_cutover.sql', import.meta.url), 'utf8'),
    await readFile(new URL('./011_multi_village_interior_cutover.sql', import.meta.url), 'utf8'),
    await readFile(new URL('./012_duo_session_v2.sql', import.meta.url), 'utf8'),
    await readFile(new URL('./013_character_identity_loadout.sql', import.meta.url), 'utf8'),
  ].join('\n')
  for (const name of USER_EVENT_NAMES) assert.match(sql, new RegExp(`\\('${name}'`), `migration missing ${name}`)
  assert.match(sql, /alter table public\.user_events enable row level security/i)
  assert.match(sql, /revoke all on public\.study_sessions, public\.user_events/i)
  assert.doesNotMatch(sql, /create policy [^\n]+ on public\.user_events for (insert|update|delete)/i)
  assert.match(sql, /security definer set search_path = ''/i)
  assert.match(sql, /grant execute on function public\.record_user_events_v1\(uuid,jsonb\) to authenticated/i)
  assert.match(sql, /v_metadata_allowed_keys constant text\[\]/i)
  assert.match(sql, /v_value_allowed_keys constant text\[\]/i)
})
