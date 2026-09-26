import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildAudioCorpusManifest,
  detectAudioMime,
  MANIFEST_FORMAT,
  validateAudioCorpusManifest,
} from './audio-corpus-readiness.mjs'

const verifiedReview = canonical => ({
  license: { status: 'verified', identifier: 'TEST-ONLY', terms_uri: 'https://example.invalid/license' },
  provenance: {
    status: 'verified', source_uri: `https://example.invalid/${canonical}`,
    reviewed_by: 'test-reviewer', reviewed_at: '2026-09-13T00:00:00.000Z',
  },
})

const sound = (id, zone = 'Animal', category = 'Bark') => ({
  sound_id: `${zone}_${id}`,
  game_zone: zone,
  source_type: 'Biological',
  sub_category: category,
  audioset_class: category,
  file_path: `Audio/${zone}/${id}`,
  source_dataset: 'FSD50K',
  original_fname: id,
  group: 'A',
})

const fakeProbe = async () => ({
  codec: 'pcm_s16le', duration_seconds: 1.25, decode_ok: true, probe_tool: 'unit-test', probe_error: null,
})

test('magic-byte MIME detection does not trust the extension', () => {
  assert.equal(detectAudioMime(Buffer.from('RIFF0000WAVE')), 'audio/wav')
  assert.equal(detectAudioMime(Buffer.from('OggS0000')), 'audio/ogg')
  assert.equal(detectAudioMime(Buffer.from('ID3testing')), 'audio/mpeg')
  assert.equal(detectAudioMime(Buffer.from('not audio')), 'application/octet-stream')
})

test('corpus manifest records checksum, size, probe, and verified provenance', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'soundvillage-audio-manifest-'))
  try {
    await mkdir(path.join(root, 'Animal'))
    await writeFile(path.join(root, 'Animal/1.wav'), Buffer.from('RIFF0000WAVEpayload'))
    const canonical = 'fsd50k:1'
    const manifest = await buildAudioCorpusManifest({
      metadata: { sounds: [sound('1')] }, corpusRoot: root,
      reviews: { [canonical]: verifiedReview(canonical) }, probeFile: fakeProbe,
      generatedAt: '2026-09-13T00:00:00.000Z',
    })
    assert.equal(manifest.entries[0].fully_verified, true)
    assert.equal(manifest.entries[0].file.byte_size, 19)
    assert.match(manifest.entries[0].file.sha256, /^[a-f0-9]{64}$/)
    assert.equal(manifest.entries[0].file.mime, 'audio/wav')
    assert.equal(manifest.entries[0].file.decode_ok, true)
    assert.deepEqual(manifest.entries[0].issues, [])
    assert.equal(manifest.validation.ok, false, 'a one-file fixture must never satisfy 995/995')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('same bytes under different canonicals and unresolved categories block readiness', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'soundvillage-audio-duplicates-'))
  try {
    await mkdir(path.join(root, 'Animal'))
    await mkdir(path.join(root, 'Nature'))
    const bytes = Buffer.from('RIFF0000WAVEpayload')
    await writeFile(path.join(root, 'Animal/1.wav'), bytes)
    await writeFile(path.join(root, 'Nature/2.wav'), bytes)
    const aliasA = sound('1', 'Animal', 'Bark')
    const aliasB = { ...aliasA, sound_id: 'ALT_1', sub_category: 'Growl', audioset_class: 'Growl' }
    const manifest = await buildAudioCorpusManifest({
      metadata: { sounds: [aliasA, aliasB, sound('2', 'Nature', 'Rain')] }, corpusRoot: root,
      reviews: {
        'fsd50k:1': verifiedReview('fsd50k:1'),
        'fsd50k:2': verifiedReview('fsd50k:2'),
      },
      probeFile: fakeProbe,
    })
    assert.equal(manifest.summary.duplicate_blob_groups, 1)
    assert(manifest.entries.find(entry => entry.canonical_audio_id === 'fsd50k:1').issues.includes('canonical_category_conflict'))
    assert(manifest.entries.every(entry => entry.issues.includes('duplicate_blob_across_canonical')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('validator requires exactly 1,000 metadata rows and 995 fully verified canonicals', () => {
  const passing = {
    format: MANIFEST_FORMAT,
    summary: { metadata_rows: 1000, canonical_identities: 995, fully_verified_canonical: 995 },
    global_issues: [], duplicate_blobs: [], cross_zone_filename_collisions: [],
  }
  assert.deepEqual(validateAudioCorpusManifest(passing), { ok: true, errors: [] })
  passing.summary.fully_verified_canonical = 994
  assert.deepEqual(validateAudioCorpusManifest(passing).errors, ['canonical_coverage_not_995_of_995'])
})
