export const SCENE_IDS = Object.freeze({
  HUB: 'hub',
  MUSIC: 'music',
  ANIMAL: 'animal',
})

export const PLAYABLE_VILLAGE_IDS = Object.freeze([SCENE_IDS.MUSIC, SCENE_IDS.ANIMAL])

export const VILLAGE_SCENE_CONFIG = Object.freeze({
  animal: Object.freeze({ dataZone: 'Animal', implemented: true, requiresUnlock: true, sceneId: SCENE_IDS.ANIMAL }),
  human: Object.freeze({ dataZone: 'Human', implemented: false, sceneId: null }),
  nature: Object.freeze({ dataZone: 'Nature', implemented: false, sceneId: null }),
  urban: Object.freeze({ dataZone: 'Urban', implemented: false, sceneId: null }),
  music: Object.freeze({ dataZone: 'Music', implemented: true, requiresUnlock: false, sceneId: SCENE_IDS.MUSIC }),
  unknown: Object.freeze({ dataZone: 'Lab', implemented: false, sceneId: null }),
})

export function isPlayableVillage(villageId) {
  return PLAYABLE_VILLAGE_IDS.includes(villageId)
}

export function getVillageAccessState(villageId, villagesUnlocked = false) {
  const config = VILLAGE_SCENE_CONFIG[villageId]
  if (!config) return { unlocked: false, implemented: false, mode: 'locked', sceneId: null, dataZone: null }
  if (config.implemented && (!config.requiresUnlock || villagesUnlocked)) return { ...config, unlocked: true, mode: 'enter' }
  if (config.implemented) return { ...config, unlocked: false, mode: 'locked' }
  return { ...config, unlocked: villagesUnlocked, mode: villagesUnlocked ? 'unlocked-preview' : 'locked' }
}

export function getVillageOverlayMode(villageId, villagesUnlocked = false) {
  return getVillageAccessState(villageId, villagesUnlocked).mode
}

export function hasCompletedRequiredSounds(requiredIds, completedIds) {
  const required = new Set(requiredIds)
  if (required.size === 0) return false
  return [...required].every(soundId => completedIds.has(soundId))
}

export function getRequiredCompletionCount(requiredIds, completedIds) {
  return new Set(requiredIds.filter(soundId => completedIds.has(soundId))).size
}

export function createMockCompletedIds(requiredIds, count, preferredIncompleteIndex = 3) {
  const unique = [...new Set(requiredIds)]
  const safeCount = Math.max(0, Math.min(unique.length, Number.parseInt(count, 10) || 0))
  if (safeCount === unique.length - 1 && unique[preferredIncompleteIndex]) {
    return new Set(unique.filter((_, index) => index !== preferredIncompleteIndex))
  }
  return new Set(unique.slice(0, safeCount))
}

export function createReleasedInputState() {
  return { up: false, down: false, left: false, right: false }
}

export function canTransitionScene({ transitioning, annotationOpen }) {
  return !transitioning && !annotationOpen
}

export function shouldLoadRemoteProgress(mockMode) {
  return !mockMode
}

export function resolveSceneTransition({ currentScene, targetScene, transitioning = false, annotationOpen = false }) {
  if (!canTransitionScene({ transitioning, annotationOpen })) return { type: 'blocked', scene: currentScene }
  if (targetScene === currentScene) return { type: 'noop', scene: currentScene }
  const villageScenes = new Set(PLAYABLE_VILLAGE_IDS)
  if (villageScenes.has(targetScene) && currentScene !== SCENE_IDS.HUB) return { type: 'blocked', scene: currentScene }
  if (targetScene === SCENE_IDS.HUB && !villageScenes.has(currentScene)) return { type: 'blocked', scene: currentScene }
  if (targetScene !== SCENE_IDS.HUB && !villageScenes.has(targetScene)) return { type: 'blocked', scene: currentScene }
  return { type: 'transition', scene: targetScene }
}

export function addCompletedSound(completedIds, soundId, saved) {
  if (!saved || !soundId) return new Set(completedIds)
  return new Set([...completedIds, soundId])
}

export function createVillageInteractionTargets(placements, exitTarget, includeExit) {
  return includeExit ? [...placements, exitTarget] : [...placements]
}

export function createMusicInteractionTargets(placements, exitTarget, includeExit) {
  return createVillageInteractionTargets(placements, exitTarget, includeExit)
}

export function resolveVillageInteraction(target) {
  if (target?.kind === 'music-exit' || target?.kind === 'village-exit') return { type: 'return-hub', target }
  if (target?.sound) return { type: 'annotate-sound', sound: target.sound }
  return { type: 'none' }
}

export const resolveMusicInteraction = resolveVillageInteraction

export function updateZoneCompletedIds(completedByZone, zone, soundId, saved) {
  if (!zone) return { ...completedByZone }
  return { ...completedByZone, [zone]: addCompletedSound(completedByZone[zone] || new Set(), soundId, saved) }
}

export function findNearestInteractionTarget(targets, completedIds, position, defaultRadius) {
  let nearest = null
  let nearestDistance = Infinity
  for (const target of targets) {
    if (completedIds.has(target.id)) continue
    const distance = Math.hypot(position.x - target.position[0], position.z - target.position[2])
    const radius = target.interactionRadius ?? defaultRadius
    if (distance < radius && distance < nearestDistance) {
      nearest = target
      nearestDistance = distance
    }
  }
  return nearest
}
