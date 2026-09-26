import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { canonicalAudioId } from '../../lib/soundIdentity.mjs'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

if (process.env.CONFIRM_STUDY_DATA_SYNC !== 'true') {
  throw new Error('Refusing to write: set CONFIRM_STUDY_DATA_SYNC=true after reviewing the target project')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const registryFile = process.env.PARTICIPANT_REGISTRY_FILE
if (!url || !serviceRoleKey || !registryFile) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PARTICIPANT_REGISTRY_FILE are required')
}
if (process.env.REQUIRE_LOOPBACK_SUPABASE === 'true') {
  await requireLoopbackSupabaseUrl(url, 'NEXT_PUBLIC_SUPABASE_URL')
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function parseRegistry(csv) {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const header = lines.shift()?.toLowerCase()
  if (!['participant_id,group_id', 'participant_id,group_id,access_scope'].includes(header)) {
    throw new Error('Registry header must be participant_id,group_id[,access_scope]')
  }
  const hasScope = header.endsWith(',access_scope')
  const seen = new Set()
  return lines.map((line, index) => {
    const fields = line.split(',').map((value) => value.trim())
    const [rawId, rawGroup, rawScope] = fields
    const participant_id = rawId?.toUpperCase()
    const group_id = rawGroup?.toUpperCase()
    const access_scope = hasScope ? rawScope?.toLowerCase() : 'group'
    if (fields.length !== (hasScope ? 3 : 2) || !/^[A-Z0-9_-]{1,64}$/.test(participant_id) || !['A', 'B'].includes(group_id) || !['group', 'all'].includes(access_scope)) {
      throw new Error(`Invalid registry row ${index + 2}`)
    }
    if (seen.has(participant_id)) throw new Error(`Duplicate registry row ${index + 2}`)
    seen.add(participant_id)
    return { participant_id, group_id, access_scope, status: 'active' }
  })
}

const registry = parseRegistry(await readFile(resolve(registryFile), 'utf8'))
const metadata = JSON.parse(await readFile(new URL('../../data/sound_metadata.json', import.meta.url), 'utf8'))
const catalog = (metadata.sounds || []).map((sound) => ({
  sound_id: String(sound.sound_id),
  zone: String(sound.game_zone),
  sub_category: sound.sub_category || null,
  group_id: ['A', 'B'].includes(sound.group) ? sound.group : null,
  canonical_audio_id: canonicalAudioId(sound),
  file_path: String(sound.file_path),
  source_dataset: String(sound.source_dataset),
  original_filename: String(sound.original_fname),
  source_type: sound.source_type || null,
  audioset_class: sound.audioset_class || null,
}))

const catalogById = new Map(catalog.map((row) => [row.sound_id, row]))
if (catalogById.size !== catalog.length) throw new Error('Metadata contains duplicate sound_id values')
const sourceByCanonical = new Map()
for (const row of catalog) {
  const source = `${row.source_dataset}:${row.original_filename}:${row.file_path}`
  const previous = sourceByCanonical.get(row.canonical_audio_id)
  if (previous && previous !== source) {
    throw new Error(`Canonical mapping conflict for ${row.canonical_audio_id}; no catalog rows were written`)
  }
  sourceByCanonical.set(row.canonical_audio_id, source)
}

const { data: existing, error: existingError } = await client
  .from('study_participants')
  .select('participant_id,group_id,access_scope')
  .in('participant_id', registry.map((row) => row.participant_id))
if (existingError) throw existingError
const requested = new Map(registry.map((row) => [row.participant_id, row.group_id]))
for (const row of existing || []) {
  const next = registry.find((candidate) => candidate.participant_id === row.participant_id)
  if (requested.get(row.participant_id) !== row.group_id || next.access_scope !== row.access_scope) {
    throw new Error('Registry conflicts with an existing immutable participant group/scope; no participant rows were inserted')
  }
}

// Catalog identity is an audited mapping. Never let an ordinary sync silently
// reinterpret an already-registered sound ID; investigate and migrate it first.
const identityFields = [
  'canonical_audio_id', 'file_path', 'source_dataset', 'original_filename',
  'zone', 'sub_category', 'group_id', 'source_type', 'audioset_class',
]
for (let index = 0; index < catalog.length; index += 200) {
  const batch = catalog.slice(index, index + 200)
  const { data: existingCatalog, error } = await client
    .from('study_sound_catalog')
    .select(`sound_id,${identityFields.join(',')}`)
    .in('sound_id', batch.map((row) => row.sound_id))
  if (error) {
    throw new Error(`Catalog compatibility check failed before writes: ${error.message}`)
  }
  for (const row of existingCatalog || []) {
    const expected = catalogById.get(row.sound_id)
    const changed = identityFields.filter((field) => (row[field] ?? null) !== (expected[field] ?? null))
    if (changed.length > 0) {
      throw new Error(`Catalog row ${row.sound_id} conflicts in ${changed.join(', ')}; no catalog rows were written`)
    }
  }
}

for (let index = 0; index < catalog.length; index += 200) {
  const { error } = await client.from('study_sound_catalog').upsert(catalog.slice(index, index + 200), {
    onConflict: 'sound_id',
  })
  if (error) throw error
}

const { error: participantError } = await client.from('study_participants').upsert(registry, {
  onConflict: 'participant_id',
  ignoreDuplicates: true,
})
if (participantError) throw participantError

console.log(`Registered ${registry.length} participant rows and synchronized ${catalog.length} sound catalog rows.`)
