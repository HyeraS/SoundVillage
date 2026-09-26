import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('./005_functional_fixes.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/page.js', import.meta.url), 'utf8')
const supabase = await readFile(new URL('../../lib/supabase.js', import.meta.url), 'utf8')
const authFoundation = await readFile(new URL('./001_auth_foundation.sql', import.meta.url), 'utf8')
const experimentRules = await readFile(new URL('./006_experiment_rules_and_uniqueness.sql', import.meta.url), 'utf8')

test('museum annotation eligibility is aggregated in one constrained RPC', () => {
  assert.match(migration, /create or replace function public\.museum_annotation_counts\(\)/i)
  assert.match(migration, /group by a\.sound_id/i)
  assert.match(migration, /private\.current_participant_id\(\) is not null/i)
  assert.match(migration, /security definer\s+set search_path = ''/i)
  assert.match(migration, /revoke all on function public\.museum_annotation_counts\(\) from public, anon/i)
  assert.match(experimentRules, /create or replace function public\.museum_annotation_counts_v2\(\)/i)
  assert.match(experimentRules, /group by a\.canonical_audio_id/i)
  assert.match(supabase, /rpc\('museum_annotation_counts_v2'\)/)
  assert.doesNotMatch(page, /getAnnotationCountForSound/)
})

test('museum eligibility uses source-backed canonical audio IDs', () => {
  assert.match(page, /canonicalAudioId\(candidateSound\)/)
  assert.match(page, /const votedSet = new Set\(votedIds\)/)
  assert.match(supabase, /museum_voted_audio_ids_v1/)
  assert.match(supabase, /row\.canonical_audio_id/)
  assert.match(page, /otherSoundsByIdentity\.get\(identity\)/)
})

test('expression candidates are randomized in the database before limiting', () => {
  assert.match(authFoundation, /order by random\(\) limit least\(greatest\(p_limit, 1\), 10\)/i)
})
