import { scaleZonePosition } from './modelConfig.mjs'

export const BASE_SOUND_POSITIONS = Object.freeze([
  [-8.2, 5.2], [-5.5, 4.8], [-2.7, 5.3], [0, 5.2], [2.7, 5.3],
  [5.5, 4.8], [8.2, 5.2], [-8.4, 1.2], [-2.4, 1.2], [0, 0.5],
  [2.4, 1.2], [8.4, 1.2], [-7.2, -6], [0, -5.7], [7.2, -6],
].map(Object.freeze))

export const MUSIC_SOUND_POSITIONS = Object.freeze(BASE_SOUND_POSITIONS.map(position => Object.freeze(scaleZonePosition(position))))

export const BASE_ANIMAL_SOUND_POSITIONS = Object.freeze([
  [-8, 5], [-5.2, 5.5], [-2.4, 5.2], [0, 4.8], [2.8, 5.1],
  [5.5, 5.4], [8, 4.7], [-7.6, 1.2], [-4.2, 1.5], [-1, 1],
  [2, 1.3], [4.7, 1.7], [-6.2, -6], [-1.2, -5.7], [3.2, -5.8],
].map(Object.freeze))

export const ANIMAL_SOUND_POSITIONS = Object.freeze(BASE_ANIMAL_SOUND_POSITIONS.map(position => Object.freeze(scaleZonePosition(position))))

export const ZONE_SOUND_POSITIONS = Object.freeze({
  Music: MUSIC_SOUND_POSITIONS,
  Animal: ANIMAL_SOUND_POSITIONS,
})

export function normalizeGroupLabel(groupId) {
  const normalized = String(groupId || '').trim().toUpperCase().replace(/^G/, '')
  if (normalized === '1') return 'A'
  if (normalized === '2') return 'B'
  return normalized
}

export function selectZoneBlockSounds(sounds, zone, block, groupId, bypassGroupFilter = false) {
  const group = normalizeGroupLabel(groupId)
  return (sounds || [])
    .filter(sound => sound.game_zone === zone && (sound.block || 1) === block)
    .filter(sound => bypassGroupFilter || !group || !sound.group || sound.group === group)
    .sort((a, b) => a.sound_id.localeCompare(b.sound_id, 'en', { numeric: true }))
}

export function selectMusicBlockOneSounds(sounds, groupId, bypassGroupFilter = false) {
  return selectZoneBlockSounds(sounds, 'Music', 1, groupId, bypassGroupFilter)
}

export function createSoundPlacements(sounds, zone = 'Music') {
  const positions = ZONE_SOUND_POSITIONS[zone] || MUSIC_SOUND_POSITIONS
  return sounds.map((sound, index) => {
    const position = positions[index % positions.length]
    const lap = Math.floor(index / positions.length)
    const offset = lap ? (index % 2 ? -0.52 : 0.52) * lap : 0
    return {
      id: sound.sound_id,
      label: `소리 조각 ${String(index + 1).padStart(2, '0')}`,
      sound,
      position: [position[0] + offset, 0.72, position[1] + offset],
    }
  })
}

export function canonicalSoundNumber(soundId) {
  const value = Number.parseInt(String(soundId || '').split('_').pop(), 10)
  return Number.isFinite(value) ? value : null
}

export function normalizeCompletedIds(databaseIds, sounds) {
  const completedNumbers = new Set(databaseIds.map(canonicalSoundNumber).filter(Number.isFinite))
  return new Set(sounds.filter(sound => completedNumbers.has(canonicalSoundNumber(sound.sound_id))).map(sound => sound.sound_id))
}
