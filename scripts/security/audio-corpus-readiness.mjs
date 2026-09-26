import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalAudioId } from '../../lib/soundIdentity.mjs'

export const MANIFEST_FORMAT = 'sound-village-audio-corpus-v1'
export const REQUIRED_METADATA_ROWS = 1000
export const REQUIRED_CANONICAL_COUNT = 995
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg']

const exists = async filePath => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const unique = values => [...new Set(values)]

export function metadataBasePath(sound) {
  const value = String(sound?.file_path || '').replaceAll('\\', '/')
  if (!/^Audio\/[^/]+\/[^/]+$/.test(value)) {
    throw new Error(`Invalid metadata file_path for ${String(sound?.sound_id || '(missing)')}`)
  }
  return value.slice('Audio/'.length)
}

export function detectAudioMime(buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg'
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  return 'application/octet-stream'
}

function commandAvailable(command) {
  return spawnSync(command, ['-version'], { encoding: 'utf8', stdio: 'ignore' }).status === 0
}

export function probeAudioFile(filePath) {
  if (!commandAvailable('ffprobe') || !commandAvailable('ffmpeg')) {
    return {
      codec: null,
      duration_seconds: null,
      decode_ok: false,
      probe_tool: null,
      probe_error: 'ffprobe_and_ffmpeg_required',
    }
  }

  try {
    const raw = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,duration:format=duration,format_name',
      '-of', 'json', filePath,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 })
    const parsed = JSON.parse(raw)
    const stream = parsed.streams?.[0] || {}
    const duration = Number(stream.duration ?? parsed.format?.duration)
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', filePath, '-f', 'null', '-'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    return {
      codec: stream.codec_name || null,
      duration_seconds: Number.isFinite(duration) && duration > 0 ? duration : null,
      decode_ok: decoded.status === 0,
      probe_tool: 'ffprobe+ffmpeg',
      probe_error: decoded.status === 0 ? null : 'decode_failed',
    }
  } catch {
    return {
      codec: null,
      duration_seconds: null,
      decode_ok: false,
      probe_tool: 'ffprobe+ffmpeg',
      probe_error: 'probe_failed',
    }
  }
}

async function listAudioFiles(root) {
  if (!await exists(root)) return []
  const result = []
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(fullPath)
      else if (entry.isFile() && AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) result.push(fullPath)
    }
  }
  await visit(root)
  return result.sort()
}

function defaultReview(canonical) {
  return {
    license: {
      status: 'unverified',
      identifier: null,
      terms_uri: null,
      attribution: null,
    },
    provenance: {
      status: 'unverified',
      source_uri: null,
      source_record_id: canonical.split(':').slice(1).join(':') || null,
      rights_holder: null,
      acquired_at: null,
      evidence_uri: null,
      reviewed_by: null,
      reviewed_at: null,
      notes: null,
    },
    classification: {
      status: 'unverified',
      sub_category: null,
      audioset_class: null,
      decided_by: null,
      decided_at: null,
    },
  }
}

function mergeReview(canonical, supplied = {}) {
  const defaults = defaultReview(canonical)
  return {
    license: { ...defaults.license, ...(supplied.license || {}) },
    provenance: { ...defaults.provenance, ...(supplied.provenance || {}) },
    classification: { ...defaults.classification, ...(supplied.classification || {}) },
  }
}

function reviewIssues(review, categories) {
  const issues = []
  if (review.license.status !== 'verified' || !review.license.identifier || !review.license.terms_uri) {
    issues.push('license_unverified')
  }
  if (review.provenance.status !== 'verified' || !review.provenance.source_uri
    || !review.provenance.reviewed_by || !review.provenance.reviewed_at) {
    issues.push('provenance_unverified')
  }
  if (categories.length > 1) {
    if (review.classification.status !== 'approved' || !review.classification.sub_category
      || !review.classification.decided_by || !review.classification.decided_at) {
      issues.push('canonical_category_conflict')
    } else if (!categories.includes(review.classification.sub_category)) {
      issues.push('classification_not_in_metadata_candidates')
    }
  }
  return issues
}

export async function buildAudioCorpusManifest({
  metadata,
  corpusRoot,
  reviews = {},
  probeFile = probeAudioFile,
  generatedAt = new Date().toISOString(),
} = {}) {
  const sounds = metadata?.sounds
  if (!Array.isArray(sounds)) throw new Error('metadata.sounds must be an array')
  const absoluteRoot = path.resolve(corpusRoot)
  const canonicalRows = new Map()
  const soundIds = new Set()
  const globalIssues = []

  for (const sound of sounds) {
    if (!sound.sound_id || soundIds.has(sound.sound_id)) globalIssues.push(`duplicate_sound_id:${String(sound.sound_id)}`)
    soundIds.add(sound.sound_id)
    const canonical = canonicalAudioId(sound)
    const rows = canonicalRows.get(canonical) || []
    rows.push(sound)
    canonicalRows.set(canonical, rows)
  }

  const actualFiles = await listAudioFiles(absoluteRoot)
  const filesByBasename = new Map()
  for (const filePath of actualFiles) {
    const basename = path.basename(filePath).toLowerCase()
    const values = filesByBasename.get(basename) || []
    values.push(path.relative(absoluteRoot, filePath).replaceAll(path.sep, '/'))
    filesByBasename.set(basename, values)
  }
  const crossZoneFilenameCollisions = [...filesByBasename.entries()]
    .filter(([, values]) => unique(values.map(value => value.split('/')[0])).length > 1)
    .map(([filename, paths]) => ({ filename, paths }))

  const entries = []
  for (const [canonical, rows] of [...canonicalRows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const issues = []
    let expectedBases = []
    try {
      expectedBases = unique(rows.map(metadataBasePath))
    } catch {
      issues.push('invalid_metadata_file_path')
    }
    const zones = unique(rows.map(row => row.game_zone))
    const pathZones = unique(expectedBases.map(value => value.split('/')[0]))
    const subCategories = unique(rows.map(row => row.sub_category).filter(Boolean))
    const audiosetClasses = unique(rows.map(row => row.audioset_class).filter(Boolean))
    const groups = unique(rows.map(row => row.group ?? row.group_id).filter(Boolean))
    const sourceMappings = unique(rows.map(row => `${String(row.source_dataset).trim().toLowerCase()}:${String(row.original_fname).trim().toLowerCase()}`))
    if (expectedBases.length !== 1) issues.push('canonical_expected_path_conflict')
    if (zones.length !== 1 || pathZones.length !== 1 || zones[0] !== pathZones[0]) issues.push('zone_path_mismatch')
    if (sourceMappings.length !== 1 || sourceMappings[0] !== canonical) issues.push('canonical_source_conflict')
    if (groups.length !== 1) issues.push('canonical_group_conflict')

    const candidates = []
    for (const base of expectedBases) {
      for (const extension of AUDIO_EXTENSIONS) {
        const candidate = path.join(absoluteRoot, `${base}${extension}`)
        if (await exists(candidate)) candidates.push(candidate)
      }
    }
    if (candidates.length === 0) issues.push('audio_missing')
    if (candidates.length > 1) issues.push('multiple_audio_candidates')

    let file = null
    if (candidates.length === 1) {
      const filePath = candidates[0]
      const bytes = await readFile(filePath)
      const fileStat = await stat(filePath)
      const mime = detectAudioMime(bytes.subarray(0, 16))
      const probe = await probeFile(filePath)
      const extension = path.extname(filePath).toLowerCase()
      const expectedMime = extension === '.mp3' ? 'audio/mpeg' : extension === '.wav' ? 'audio/wav' : 'audio/ogg'
      if (fileStat.size <= 0) issues.push('audio_empty')
      if (mime !== expectedMime) issues.push('mime_extension_mismatch')
      if (!probe.codec) issues.push('codec_unverified')
      if (!(probe.duration_seconds > 0)) issues.push('duration_unverified')
      if (!probe.decode_ok) issues.push('decode_unverified')
      file = {
        relative_path: path.relative(absoluteRoot, filePath).replaceAll(path.sep, '/'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
        byte_size: fileStat.size,
        mime,
        codec: probe.codec,
        duration_seconds: probe.duration_seconds,
        decode_ok: probe.decode_ok,
        probe_tool: probe.probe_tool || null,
        probe_error: probe.probe_error || null,
      }
    }

    const review = mergeReview(canonical, reviews[canonical])
    issues.push(...reviewIssues(review, subCategories))
    entries.push({
      canonical_audio_id: canonical,
      sound_ids: rows.map(row => row.sound_id).sort(),
      alias_count: rows.length,
      zone: zones.length === 1 ? zones[0] : null,
      group_id: groups.length === 1 ? groups[0] : null,
      expected_base_paths: expectedBases,
      metadata_categories: subCategories,
      metadata_audioset_classes: audiosetClasses,
      source_dataset: rows[0]?.source_dataset || null,
      original_filename: rows[0]?.original_fname || null,
      file,
      ...review,
      issues: unique(issues),
      fully_verified: false,
    })
  }

  const byChecksum = new Map()
  for (const entry of entries) {
    if (!entry.file?.sha256) continue
    const values = byChecksum.get(entry.file.sha256) || []
    values.push(entry.canonical_audio_id)
    byChecksum.set(entry.file.sha256, values)
  }
  const duplicateBlobs = [...byChecksum.entries()]
    .filter(([, canonicals]) => canonicals.length > 1)
    .map(([sha256, canonical_audio_ids]) => ({ sha256, canonical_audio_ids }))
  for (const collision of duplicateBlobs) {
    for (const canonical of collision.canonical_audio_ids) {
      entries.find(entry => entry.canonical_audio_id === canonical).issues.push('duplicate_blob_across_canonical')
    }
  }
  for (const entry of entries) entry.fully_verified = entry.issues.length === 0

  const manifest = {
    format: MANIFEST_FORMAT,
    generated_at: generatedAt,
    corpus_root: absoluteRoot,
    requirements: {
      metadata_rows: REQUIRED_METADATA_ROWS,
      canonical_identities: REQUIRED_CANONICAL_COUNT,
      full_verification_required: true,
    },
    summary: {
      metadata_rows: sounds.length,
      canonical_identities: entries.length,
      alias_pairs: entries.filter(entry => entry.alias_count > 1).length,
      files_discovered: actualFiles.length,
      files_present_canonical: entries.filter(entry => entry.file).length,
      fully_verified_canonical: entries.filter(entry => entry.fully_verified).length,
      unverified_canonical: entries.filter(entry => !entry.fully_verified).length,
      category_conflict_canonical: entries.filter(entry => entry.issues.includes('canonical_category_conflict')).length,
      duplicate_blob_groups: duplicateBlobs.length,
      cross_zone_filename_collisions: crossZoneFilenameCollisions.length,
    },
    global_issues: globalIssues,
    duplicate_blobs: duplicateBlobs,
    cross_zone_filename_collisions: crossZoneFilenameCollisions,
    entries,
  }
  manifest.validation = validateAudioCorpusManifest(manifest)
  return manifest
}

export function validateAudioCorpusManifest(manifest) {
  const errors = []
  if (manifest?.format !== MANIFEST_FORMAT) errors.push('manifest_format_invalid')
  if (manifest?.summary?.metadata_rows !== REQUIRED_METADATA_ROWS) errors.push('metadata_row_count_not_1000')
  if (manifest?.summary?.canonical_identities !== REQUIRED_CANONICAL_COUNT) errors.push('canonical_count_not_995')
  if (manifest?.summary?.fully_verified_canonical !== REQUIRED_CANONICAL_COUNT) errors.push('canonical_coverage_not_995_of_995')
  if (manifest?.global_issues?.length) errors.push('metadata_global_issues_present')
  if (manifest?.duplicate_blobs?.length) errors.push('duplicate_blobs_present')
  if (manifest?.cross_zone_filename_collisions?.length) errors.push('cross_zone_filename_collisions_present')
  return { ok: errors.length === 0, errors }
}

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!['--metadata', '--corpus-root', '--reviews', '--output', '--validate'].includes(value)) {
      throw new Error(`Unknown argument: ${value}`)
    }
    result[value.slice(2).replaceAll('-', '_')] = argv[++index]
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.validate) {
    const manifest = JSON.parse(await readFile(path.resolve(args.validate), 'utf8'))
    const validation = validateAudioCorpusManifest(manifest)
    console.log(JSON.stringify(validation, null, 2))
    if (!validation.ok) process.exitCode = 1
    return
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const metadataPath = path.resolve(args.metadata || path.join(repositoryRoot, 'data/sound_metadata.json'))
  const corpusRoot = path.resolve(args.corpus_root || path.join(repositoryRoot, 'public/audio'))
  const reviews = args.reviews ? JSON.parse(await readFile(path.resolve(args.reviews), 'utf8')) : {}
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  const manifest = await buildAudioCorpusManifest({ metadata, corpusRoot, reviews })
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  if (args.output) await writeFile(path.resolve(args.output), serialized, { flag: 'wx' })
  else console.log(serialized.trimEnd())
  if (!manifest.validation.ok) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
