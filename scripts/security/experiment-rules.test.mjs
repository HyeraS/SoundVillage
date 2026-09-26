import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import metadata from '../../data/sound_metadata.json' with { type: 'json' }
import { canonicalAudioId, uniqueSoundsByCanonicalAudio } from '../../lib/soundIdentity.mjs'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
const [migration, preflight, verify, supabase, page, museum, events, register, engine] = await Promise.all([
  'scripts/security/006_experiment_rules_and_uniqueness.sql',
  'scripts/security/experiment-rules-preflight.sql',
  'scripts/security/experiment-rules-verify.sql',
  'lib/supabase.js', 'app/page.js', 'components/SoundMuseum.js', 'lib/userEvents.js',
  'scripts/security/register-study-data.mjs',
  'components/GameEngine.js',
].map(read))

test('source-backed canonical identity merges only the five actual alias pairs', () => {
  const sounds = metadata.sounds
  const ids = sounds.map(canonicalAudioId)
  assert.equal(sounds.length, 1000)
  assert.equal(new Set(ids).size, 995)
  assert.equal(uniqueSoundsByCanonicalAudio(sounds).length, 995)
  const grouped = new Map()
  for (const sound of sounds) {
    const id = canonicalAudioId(sound)
    grouped.set(id, [...(grouped.get(id) || []), sound])
  }
  assert.equal([...grouped.values()].filter(rows => rows.length > 1).length, 5)
  for (const rows of grouped.values()) {
    assert.equal(new Set(rows.map(row => row.file_path)).size, 1)
  }
})

test('numeric suffixes are not the canonical identity algorithm', () => {
  const one = { sound_id:'Animal_42', source_dataset:'dataset-a', original_fname:'42', file_path:'Audio/Animal/42' }
  const two = { sound_id:'Urban_42', source_dataset:'dataset-b', original_fname:'42', file_path:'Audio/Urban/42' }
  assert.notEqual(canonicalAudioId(one), canonicalAudioId(two))
  assert.doesNotMatch(page, /function getAudioIdentity/)
})

test('catalog synchronization persists reviewed source identity fields', () => {
  for (const field of ['canonical_audio_id','file_path','source_dataset','original_filename']) assert.match(register, new RegExp(field))
  assert.match(register, /canonicalAudioId\(sound\)/)
  assert.match(register, /Canonical mapping conflict/)
  assert.match(register, /Catalog row .* conflicts in/)
  assert.ok(register.indexOf('Catalog compatibility check failed before writes') < register.indexOf("\.upsert(catalog.slice"))
})

test('annotation and vote uniqueness are canonical, round-scoped, and concurrency-safe', () => {
  assert.match(migration, /annotations_one_normal_result_per_audio_round_uq/)
  assert.match(migration, /where not is_skipped/)
  assert.match(migration, /votes_one_result_per_audio_round_uq/)
  assert.match(migration, /on conflict\(participant_id,experiment_round,canonical_audio_id\)/)
  assert.match(migration, /'alreadyCompleted',not v_inserted/)
  assert.match(migration, /select canonical_audio_id into v_canonical from public\.study_sound_catalog/)
})

test('normal annotation completion is DB-derived and atomically completes the active session', () => {
  assert.match(migration, /count\(distinct a\.canonical_audio_id\)/)
  assert.match(migration, /completion_reason='all_assigned_annotations_completed'/)
  assert.match(migration, /completion_operation_key=p_idempotency_key/)
  assert.match(migration, /'progress',v_progress/)
  assert.match(page, /experimentProgress\?\.isComplete/)
  assert.match(page, /completeStudySession\('all_assigned_annotations_completed'/)
  assert.ok(events.indexOf("rpc('complete_study_session_v1'") < events.indexOf("q.track('session_completed'"))
})

test('session resume is server-side and completed rounds never create a new session', () => {
  assert.match(migration, /start_or_resume_study_session_v2/)
  assert.match(migration, /status='completed' order by completed_at desc/)
  assert.match(migration, /study_sessions_one_active_round_uq/)
  assert.match(events, /rpc\('start_or_resume_study_session_v2'/)
  assert.match(events, /if \(data\.status === 'active'\)/)
  assert.match(migration, /revoke execute on function public\.start_or_resume_study_session_v1[\s\S]*from authenticated/i)
  assert.match(migration, /complete_study_session_v1[\s\S]*status='completed'/i)
  assert.match(migration, /EXPERIMENT_NOT_COMPLETED/)
})

test('unmeasured annotation fields are null and preflight blocks incompatible schemas', () => {
  assert.match(supabase, /p_selected_features: data\.selected_features \?\? null/)
  assert.match(supabase, /p_difficulty: data\.difficulty \?\? null/)
  assert.match(migration, /column_name in \('difficulty','selected_features'\) and is_nullable='NO'/)
  assert.match(migration, /p_selected_features is not null or p_difficulty is not null/)
  assert.match(migration, /null,p_confidence,null,p_play_count/)
  assert.match(preflight, /difficulty','selected_features/)
})

test('KST is the single DB study-day boundary', () => {
  assert.match(migration, /at time zone 'Asia\/Seoul'/)
  assert.match(migration, /study_day_start_kst\(v_today\+1\)/)
  assert.doesNotMatch(migration, /time zone 'utc'/i)
  assert.match(verify, /14:59:59\+00/)
  assert.match(verify, /15:00:00\+00/)
  assert.doesNotMatch(supabase, /toISOString\(\)\.slice\(0, 10\)/)
})

test('museum voting requires successful playback and uses canonical RPCs', () => {
  assert.match(museum, /playCount < 1/)
  assert.match(museum, /playCount > 0 &&/)
  assert.match(museum, /setPlayCount\(0\)/)
  assert.match(page, /key=\{activeSound \? canonicalAudioId\(activeSound\) : 'museum-empty'\}/)
  assert.match(migration, /p_play_count<1 then raise exception 'AUDIO_PLAY_REQUIRED'/)
  assert.match(supabase, /submit_museum_vote_v4/)
  assert.match(supabase, /museum_candidate_expressions_v2/)
  assert.match(supabase, /museum_voted_audio_ids_v1/)
})

test('preflight reports conflicts without deleting or merging data', () => {
  assert.match(preflight, /duplicate normal annotations/i)
  assert.match(preflight, /kst_created_date/)
  assert.doesNotMatch(preflight, /\b(delete|update|insert|alter|drop|truncate)\b/i)
  assert.doesNotMatch(migration, /delete from public\.(annotations|votes)/i)
  assert.match(migration, /legacy completed sessions need explicit reconciliation/)
})

test('quest and collectible events use semantic edges', () => {
  assert.match(events, /quest_row_impression/)
  assert.match(page + museum, /museum_audio_play_started/)
  assert.match(engine, /previousTargetRef/)
  assert.match(engine, /collectible_approached/)
})
