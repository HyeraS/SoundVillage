import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ZONE_LINEAR_SCALE } from './modelConfig.mjs'
import { BASE_SOUND_POSITIONS, MUSIC_SOUND_POSITIONS, createSoundPlacements, normalizeCompletedIds, selectMusicBlockOneSounds } from './prototypeData.mjs'

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

test('Music positions scale from the zone center by Math.SQRT2', () => {
  assert.equal(MUSIC_SOUND_POSITIONS.length, 15)
  for (let index = 0; index < BASE_SOUND_POSITIONS.length; index += 1) {
    assert.equal(MUSIC_SOUND_POSITIONS[index][0], BASE_SOUND_POSITIONS[index][0] * ZONE_LINEAR_SCALE)
    assert.equal(MUSIC_SOUND_POSITIONS[index][1], BASE_SOUND_POSITIONS[index][1] * ZONE_LINEAR_SCALE)
  }
})

test('real metadata preserves exactly 15 Music Block 1 sounds and identical travel layouts per group', () => {
  const metadata = JSON.parse(readFileSync(new URL('../../data/sound_metadata.json', import.meta.url), 'utf8'))
  const groupA = selectMusicBlockOneSounds(metadata.sounds, 'A')
  const groupB = selectMusicBlockOneSounds(metadata.sounds, 'B')
  assert.equal(groupA.length, 15)
  assert.equal(groupB.length, 15)
  assert.deepEqual(createSoundPlacements(groupA).map(item => item.position), createSoundPlacements(groupB).map(item => item.position))
})
