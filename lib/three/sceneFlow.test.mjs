import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SCENE_IDS,
  addCompletedSound,
  canTransitionScene,
  createMusicInteractionTargets,
  createMockCompletedIds,
  createReleasedInputState,
  getVillageAccessState,
  getVillageOverlayMode,
  findNearestInteractionTarget,
  getRequiredCompletionCount,
  hasCompletedRequiredSounds,
  isPlayableVillage,
  resolveMusicInteraction,
  resolveSceneTransition,
  shouldLoadRemoteProgress,
} from './sceneFlow.mjs'

test('only Music starts playable while the other gateways lock and unlock together', () => {
  assert.equal(isPlayableVillage('music'), true)
  for (const id of ['animal', 'human', 'nature', 'urban', 'unknown']) {
    assert.equal(getVillageOverlayMode(id, false), 'locked')
    assert.equal(getVillageOverlayMode(id, true), 'unlocked-preview')
  }
  assert.equal(getVillageOverlayMode('music'), 'enter')
  assert.equal(getVillageAccessState('unknown', true).dataZone, 'Lab')
  assert.equal(getVillageAccessState('unknown', true).implemented, false)
})

test('required Music ids stay locked at 0/15 and 14/15, then unlock at exactly 15/15', () => {
  const required = Array.from({ length: 15 }, (_, index) => `Music_A_${index + 1}`)
  assert.equal(hasCompletedRequiredSounds(required, new Set()), false)
  assert.equal(hasCompletedRequiredSounds(required, new Set(required.slice(0, 14))), false)
  assert.equal(hasCompletedRequiredSounds(required, new Set(required)), true)
  assert.equal(getRequiredCompletionCount(required, new Set([...required, required[0], required[1]])), 15)
})

test('duplicate or other-group ids cannot unlock the current group requirement', () => {
  const requiredA = ['Music_A_1', 'Music_A_2', 'Music_A_3']
  assert.equal(hasCompletedRequiredSounds(requiredA, new Set(Array(15).fill('Music_A_1'))), false)
  assert.equal(hasCompletedRequiredSounds(requiredA, new Set(['Music_A_1', 'Music_A_2', 'Music_B_3'])), false)
})

test('mock completion seeding stays in memory and leaves a nearby candidate for 14/15 testing', () => {
  const required = Array.from({ length: 15 }, (_, index) => `Music_${index + 1}`)
  const fourteen = createMockCompletedIds(required, 14)
  assert.equal(fourteen.size, 14)
  assert.equal(fourteen.has(required[3]), false)
  assert.equal(createMockCompletedIds(required, 15).size, 15)
})

test('hub and Music transition in both directions without duplicate transitions', () => {
  assert.deepEqual(resolveSceneTransition({ currentScene: 'hub', targetScene: 'music' }), { type: 'transition', scene: 'music' })
  assert.deepEqual(resolveSceneTransition({ currentScene: 'music', targetScene: 'hub' }), { type: 'transition', scene: 'hub' })
  assert.equal(resolveSceneTransition({ currentScene: 'hub', targetScene: 'music', transitioning: true }).type, 'blocked')
  assert.equal(resolveSceneTransition({ currentScene: 'music', targetScene: 'hub', annotationOpen: true }).type, 'blocked')
  assert.equal(resolveSceneTransition({ currentScene: 'hub', targetScene: 'hub' }).type, 'noop')
})

test('scene changes release all keyboard and D-pad directions', () => {
  assert.deepEqual(createReleasedInputState(), { up: false, down: false, left: false, right: false })
  assert.equal(canTransitionScene({ transitioning: false, annotationOpen: false }), true)
})

test('mock completion persists in shared session state but failed saves do not complete', () => {
  const initial = new Set()
  const completed = addCompletedSound(initial, 'Music_001', true)
  assert.equal(completed.has('Music_001'), true)
  assert.equal(addCompletedSound(initial, 'Music_001', false).has('Music_001'), false)
  assert.equal(addCompletedSound(completed, 'Music_001', true).size, 1)
  const required = ['Music_001', 'Music_002']
  const beforeLast = new Set(['Music_001'])
  assert.equal(hasCompletedRequiredSounds(required, addCompletedSound(beforeLast, 'Music_002', false)), false)
})

test('mock mode never loads remote progress', () => {
  assert.equal(shouldLoadRemoteProgress(true), false)
  assert.equal(shouldLoadRemoteProgress(false), true)
})

test('annotation orbs and the Music exit resolve to separate actions with nearest ordering preserved', () => {
  const sound = { id: 'Music_001', sound: { sound_id: 'Music_001' }, position: [0, 0, 0] }
  const exit = { id: 'music-village-exit', kind: 'music-exit', position: [3, 0, 3] }
  assert.deepEqual(createMusicInteractionTargets([sound], exit, false), [sound])
  assert.deepEqual(createMusicInteractionTargets([sound], exit, true), [sound, exit])
  assert.equal(resolveMusicInteraction(sound).type, 'annotate-sound')
  assert.equal(resolveMusicInteraction(exit).type, 'return-hub')
  assert.equal(resolveMusicInteraction(null).type, 'none')
  assert.equal(findNearestInteractionTarget([sound, exit], new Set(), { x: 2.8, z: 2.8 }, 1.62), exit)
  assert.equal(findNearestInteractionTarget([sound, exit], new Set(['music-village-exit']), { x: 2.8, z: 2.8 }, 1.62), null)
})

test('scene ids stay aligned with the hub and Music configuration', () => {
  assert.deepEqual(SCENE_IDS, { HUB: 'hub', MUSIC: 'music' })
})
