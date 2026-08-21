import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SCENE_IDS,
  addCompletedSound,
  canTransitionScene,
  createMusicInteractionTargets,
  createReleasedInputState,
  getVillageOverlayMode,
  findNearestInteractionTarget,
  isPlayableVillage,
  resolveMusicInteraction,
  resolveSceneTransition,
  shouldLoadRemoteProgress,
} from './sceneFlow.mjs'

test('only Music is playable while the other gateways remain previews', () => {
  assert.equal(isPlayableVillage('music'), true)
  for (const id of ['animal', 'human', 'nature', 'urban', 'unknown']) {
    assert.equal(getVillageOverlayMode(id), 'preview')
  }
  assert.equal(getVillageOverlayMode('music'), 'enter')
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
