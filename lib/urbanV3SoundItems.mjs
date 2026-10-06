import {
  SPAWN_POINTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collidesPlayerAt,
  overlapsExitTrigger,
  reachableGridKeys,
} from './urbanV3WorldConfig.mjs'

export const URBAN_V3_SOUND_INTERACTION_RADIUS = 34

function hash32(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function buildCandidateSlots() {
  const reachable = reachableGridKeys(SPAWN_POINTS.entrance, 8)
  const spawns = Object.values(SPAWN_POINTS)
  const slots = []
  for (let y = 224; y <= WORLD_HEIGHT - 24; y += 16) {
    for (let x = 24; x <= WORLD_WIDTH - 24; x += 16) {
      if (!reachable.has(`${x},${y}`) || collidesPlayerAt(x, y) || overlapsExitTrigger({ x, y })) continue
      if (spawns.some((spawn) => Math.hypot(x - spawn.x, y - spawn.y) < 44)) continue
      slots.push(Object.freeze({ x, y }))
    }
  }
  return slots
}

const CANDIDATE_SLOTS = Object.freeze(buildCandidateSlots())

function spreadSlots(count, seed) {
  if (count > CANDIDATE_SLOTS.length) {
    throw new Error(`Urban V3 sound capacity exceeded (${CANDIDATE_SLOTS.length} safe slots for ${count} sounds)`)
  }
  const pool = CANDIDATE_SLOTS.map((slot) => ({
    ...slot,
    nearestDistanceSquared: Infinity,
    tie: hash32(`${seed}|${slot.x},${slot.y}`),
  }))
  const selected = []
  while (selected.length < count) {
    let bestIndex = 0
    for (let index = 1; index < pool.length; index += 1) {
      const candidate = pool[index]
      const best = pool[bestIndex]
      if (candidate.nearestDistanceSquared > best.nearestDistanceSquared
        || (candidate.nearestDistanceSquared === best.nearestDistanceSquared && candidate.tie < best.tie)) {
        bestIndex = index
      }
    }
    const chosen = pool.splice(bestIndex, 1)[0]
    selected.push(chosen)
    for (const candidate of pool) {
      const distanceSquared = (candidate.x - chosen.x) ** 2 + (candidate.y - chosen.y) ** 2
      candidate.nearestDistanceSquared = Math.min(candidate.nearestDistanceSquared, distanceSquared)
    }
  }
  return selected
}

export function spawnUrbanV3SoundItems(sounds) {
  const sortedSounds = (sounds || []).slice().sort((left, right) => (
    (Number(left.block) || 1) - (Number(right.block) || 1)
      || String(left.sound_id).localeCompare(String(right.sound_id))
  ))
  const seed = sortedSounds.map((sound) => `${sound.sound_id}:${Number(sound.block) || 1}`).join('|')
  const slots = spreadSlots(sortedSounds.length, seed)
  return Object.freeze(sortedSounds.map((sound, index) => Object.freeze({
    id: sound.sound_id,
    sound,
    block: Number(sound.block) || 1,
    x: slots[index].x,
    y: slots[index].y,
    phase: (index * 2.399963229728653) % (Math.PI * 2),
  })))
}
