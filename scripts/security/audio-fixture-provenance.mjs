import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const revision = process.argv[2] || 'b189395^'
const metadata = JSON.parse(await readFile(new URL('../../data/sound_metadata.json', import.meta.url), 'utf8'))
const pilotMetadata = JSON.parse(await readFile(new URL('../pilot_clips_v3.json', import.meta.url), 'utf8'))
const sounds = metadata.sounds

const treeOutput = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', revision, '--', 'public/audio'],
  { encoding: 'utf8' },
)
const historicalPaths = treeOutput.trim().split('\n').filter(Boolean)
const historicalSet = new Set(historicalPaths)

const normalizedPath = (filePath) => {
  assert.match(filePath, /^Audio\//, `Unexpected metadata audio path: ${filePath}`)
  return `public/audio/${filePath.slice('Audio/'.length)}.mp3`
}

const canonicalId = (sound) =>
  `${String(sound.source_dataset).trim().toLowerCase()}:${String(sound.original_fname).trim().toLowerCase()}`

const historicalByFilename = new Map()
for (const path of historicalPaths) {
  const filename = path.split('/').at(-1)
  const paths = historicalByFilename.get(filename) || []
  paths.push(path)
  historicalByFilename.set(filename, paths)
}

const recoverable = []
const wrongZone = []
const missing = []
for (const sound of sounds) {
  const expectedPath = normalizedPath(sound.file_path)
  if (historicalSet.has(expectedPath)) {
    recoverable.push({ ...sound, canonical_audio_id: canonicalId(sound), historical_path: expectedPath })
    continue
  }

  const filename = `${sound.original_fname}.mp3`
  const otherPaths = historicalByFilename.get(filename) || []
  const row = { sound_id: sound.sound_id, expected_path: expectedPath, historical_paths: otherPaths }
  if (otherPaths.length > 0) wrongZone.push(row)
  else missing.push(row)
}

const aliases = new Map()
for (const sound of sounds) {
  const canonical = canonicalId(sound)
  const rows = aliases.get(canonical) || []
  rows.push(sound)
  aliases.set(canonical, rows)
}
const aliasPairs = [...aliases.entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([canonical_audio_id, rows]) => ({
    canonical_audio_id,
    sound_ids: rows.map((row) => row.sound_id),
    metadata_paths: [...new Set(rows.map((row) => normalizedPath(row.file_path)))],
    blobs_present: [...new Set(rows.map((row) => normalizedPath(row.file_path)))].every((path) => historicalSet.has(path)),
  }))

const candidatesByGroup = Object.fromEntries(['A', 'B'].map((group) => [
  group,
  recoverable
    .filter((row) => row.group === group || row.group_id === group || row.group == null && row.group_id == null)
    .slice(0, 20)
    .map(({ sound_id, game_zone, file_path, canonical_audio_id, historical_path }) => ({
      sound_id, game_zone, file_path, canonical_audio_id, historical_path,
    })),
]))

const result = {
  revision,
  pilot_metadata_rows: pilotMetadata.sounds.length,
  metadata_rows: sounds.length,
  canonical_identities: new Set(sounds.map(canonicalId)).size,
  historical_audio_files: historicalPaths.length,
  exact_zone_path_recoverable_rows: recoverable.length,
  exact_zone_path_recoverable_canonical: new Set(recoverable.map((row) => row.canonical_audio_id)).size,
  filename_present_in_other_zone_rows: wrongZone.length,
  unrecoverable_metadata_rows: missing.length,
  alias_pairs: aliasPairs,
  group_candidate_samples: candidatesByGroup,
  wrong_zone_rows: wrongZone,
  missing_rows: missing,
}

assert.equal(result.metadata_rows, 1000)
assert.equal(result.canonical_identities, 995)
assert.equal(aliasPairs.length, 5)

console.log(JSON.stringify(result, null, 2))
