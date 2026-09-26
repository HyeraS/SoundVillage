import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('restored core schema fixes the historical result-table prerequisite', async () => {
  const sql = await read('scripts/core_schema.sql')
  assert.match(sql,/2113e189eb8e788ac8efbddb48178a3d08a13e01/)
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.annotations/)
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.votes/)
  assert.match(sql,/FOREIGN KEY \(annotation_id\) REFERENCES public\.annotations\(id\)/)
  assert.match(sql,/FUNCTION increment_vote_count\(annotation_id uuid\)/)
})

test('house compatibility is explicitly local-only and preflighted', async () => {
  const sql = await read('scripts/security/local-test-only-house-compatibility.sql')
  assert.match(sql,/LOCAL TEST ONLY \/ NON-PRODUCTION-AUTHORITATIVE/)
  assert.match(sql,/unexpected participant_house_layout primary key/)
  assert.match(sql,/add column quantity integer/)
  assert.match(sql,/add column id uuid default gen_random_uuid\(\)/)
})

test('quest timestamp compatibility is explicit and local-only', async () => {
  const sql = await read('scripts/security/local-test-only-quest-compatibility.sql')
  assert.match(sql,/LOCAL TEST ONLY \/ NON-PRODUCTION-AUTHORITATIVE/)
  assert.match(sql,/created_at already exists; review the actual schema instead/)
  assert.match(sql,/add column created_at timestamptz not null default now\(\)/)
})

test('historical daily quest SQL contains no stray psql commands', async () => {
  const sql = await read('scripts/daily_quest_schema.sql')
  assert.doesNotMatch(sql,/^\\\s*$/m)
})

test('loopback guard rejects remote hosts before a connection', async () => {
  await assert.rejects(requireLoopbackSupabaseUrl('https://example.supabase.co'),'must use localhost')
  assert.match(await requireLoopbackSupabaseUrl('http://127.0.0.1:54321'),/^http:\/\/127\.0\.0\.1:54321/)
  assert.match(await requireLoopbackSupabaseUrl('http://[::1]:54321'),/^http:\/\/\[::1\]:54321/)
})

test('full-catalog runner preserves shared catalog and fixes the completion boundary', async () => {
  const source = await read('scripts/security/experiment-rules.integration.mjs')
  assert.match(source,/count,1000/)
  assert.match(source,/canonical_audio_id\)\)\.size,995/)
  assert.match(source,/integration boundary seed/)
  assert.doesNotMatch(source,/study_sound_catalog'\)\.delete/)
  assert.doesNotMatch(source,/empty catalog/)
})

test('bootstrap is disposable, loopback-guarded, transactional, and ordered', async () => {
  const source = await read('scripts/security/stage8-local-bootstrap.sh')
  assert.match(source,/mktemp -d \/private\/tmp\/soundvillage-stage8/)
  assert.match(source,/requireLoopbackSupabaseUrl/)
  assert.match(source,/--single-transaction/)
  assert(source.indexOf('001_auth_foundation.sql') < source.indexOf('register-study-data.mjs'))
  assert(source.indexOf('register-study-data.mjs') < source.indexOf('002_enforce_participant_rls.sql'))
  assert(source.indexOf('experiment-rules-preflight.sql') < source.indexOf('006_experiment_rules_and_uniqueness.sql'))
  assert(source.indexOf('006_experiment_rules_and_uniqueness.sql') < source.indexOf('007_participant_room_rpc_only.sql'))
  assert.match(source, /schema-reconciliation-snapshot\.sql/)
  assert.match(source, /schema-reconciliation-validator\.mjs/)
  assert.match(source, /has_table_privilege\('authenticated','public\.participant_room','TRUNCATE'\)/)
  assert.match(source,/AUTH_USER_COUNT/)
  assert.match(source,/QA_PARTICIPANT_COUNT/)
})

test('007 makes participant room writes RPC-only without removing owner SELECT', async () => {
  const source = await read('scripts/security/007_participant_room_rpc_only.sql')
  assert.match(source, /revoke insert, update, delete, truncate on table public\.participant_room\s+from public, anon, authenticated/i)
  assert.match(source, /grant select on table public\.participant_room to authenticated/i)
  assert.match(source, /drop policy if exists participant_room_insert_own/i)
  assert.match(source, /drop policy if exists participant_room_update_own/i)
  assert.match(source, /drop policy if exists participant_room_delete_own/i)
  assert.match(source, /alter function public\.save_participant_room_v3\(uuid,jsonb\) security definer/i)
  assert.match(source, /alter function public\.save_participant_room_v3\(uuid,jsonb\) set search_path = ''/i)
  assert.match(source, /revoke all on function public\.save_participant_room_v3\(uuid,jsonb\)\s+from public, anon, authenticated/i)
  assert.match(source, /grant execute on function public\.save_participant_room_v3\(uuid,jsonb\)\s+to authenticated/i)
})

test('Realtime migration leaves the managed table intact while replacing policies', async () => {
  const source = await read('scripts/security/002_enforce_participant_rls.sql')
  assert.doesNotMatch(source,/alter table realtime\.messages/i)
  assert.match(source,/create policy duo_realtime_read on realtime\.messages/)
  assert.match(source,/create policy duo_realtime_send on realtime\.messages/)
})

test('006 preserves the existing ensure_today_quests parameter contract', async () => {
  const source = await read('scripts/security/006_experiment_rules_and_uniqueness.sql')
  assert.match(source,/function public\.ensure_today_quests\(p_known_sub_categories text\[\]/)
})
