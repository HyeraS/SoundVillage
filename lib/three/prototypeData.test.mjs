import test from 'node:test'
import assert from 'node:assert/strict'
import { createSoundPlacements, normalizeCompletedIds, selectMusicBlockOneSounds } from './prototypeData.mjs'

const sounds = [
  { sound_id: 'Music_20', game_zone: 'Music', block: 1, group: 'B' },
  { sound_id: 'Music_10', game_zone: 'Music', block: 1, group: 'A' },
  { sound_id: 'Music_30', game_zone: 'Music', block: 2, group: 'A' },
]

test('Music Block 1 selection preserves the A/B contract', () => {
  assert.deepEqual(selectMusicBlockOneSounds(sounds, 'A').map(sound => sound.sound_id), ['Music_10'])
  assert.deepEqual(selectMusicBlockOneSounds(sounds, 'B').map(sound => sound.sound_id), ['Music_20'])
})

test('placements are deterministic and legacy ids normalize by audio number', () => {
  const selected = selectMusicBlockOneSounds(sounds, '', true)
  assert.deepEqual(createSoundPlacements(selected), createSoundPlacements(selected))
  assert.deepEqual([...normalizeCompletedIds(['MUS_000010'], selected)], ['Music_10'])
})
