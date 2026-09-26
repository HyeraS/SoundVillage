import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('service role key remains in server-only modules', async () => {
  const [admin, auth, browserClient] = await Promise.all([
    read('lib/supabaseAdmin.js'),
    read('lib/participantAuth.js'),
    read('lib/supabase.js'),
  ])
  assert.match(admin, /^import 'server-only'/)
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(auth, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(browserClient, /SUPABASE_SERVICE_ROLE_KEY/)
})

test('browser reward and purchase paths no longer call legacy mutators', async () => {
  const sources = await Promise.all([
    read('lib/supabase.js'), read('lib/currency.js'), read('lib/interiorDecor.js'), read('lib/houseDecor.js'),
  ])
  const joined = sources.join('\n')
  assert.doesNotMatch(joined, /\.rpc\(['"]increment_(?:vote_count|currency_balance|house_item_quantity)/)
  assert.doesNotMatch(joined, /award_participant_currency/)
  assert.match(joined, /submit_annotation_v4/)
  assert.match(joined, /submit_museum_vote_v4/)
  assert.match(joined, /\/api\/participant-purchase/)
  assert.match(joined, /save_participant_room_v3/)
  assert.doesNotMatch(joined, /from\(['"]participant_room['"]\)[\s\S]{0,160}\.(?:insert|upsert|update|delete)\(/)
})

test('RLS enforcement has WITH CHECK and revokes anon access', async () => {
  const sql = await read('scripts/security/002_enforce_participant_rls.sql')
  for (const table of [
    'annotations','votes','participant_currency','currency_transactions','participant_outfits',
    'participant_equipped_outfit','participant_daily_quests','participant_attendance',
    'participant_interior_items','participant_room','participant_house_items','participant_house_layout',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.%I enable row level security|on public\\.${table}`))
  }
  assert.match(sql, /with check \(/i)
  assert.match(sql, /revoke all on table public\.%I from public, anon, authenticated/i)
  assert.match(sql, /private\.current_participant_id\(\)/)
})

test('museum, shared rooms, and Realtime use constrained interfaces', async () => {
  const [foundation, realtime, interior] = await Promise.all([
    read('scripts/security/001_auth_foundation.sql'),
    read('lib/duoSession.js'),
    read('lib/interiorDecor.js'),
  ])
  assert.match(foundation, /museum_candidate_expressions/)
  assert.match(foundation, /get_shared_room/)
  assert.match(foundation, /participant_realtime_room_members/)
  assert.match(realtime, /private: true/)
  assert.match(interior, /get_shared_room/)
})

test('room save events link by operation key without participant-backed room IDs', async () => {
  const interior = await read('components/InteriorDecorRoom.js')
  const successEvent = interior.match(/trackEvent\('room_save_succeeded',[\s\S]*?\}, \{ critical: true, flush: true \}\)/)?.[0] || ''
  assert.match(successEvent, /operation_idempotency_key/)
  assert.match(successEvent, /result_entity_type: 'participant_room'/)
  assert.doesNotMatch(successEvent, /result_entity_id/)
  assert.doesNotMatch(successEvent, /shareToken|auth_user_id|participant_id|p_room/)
})
