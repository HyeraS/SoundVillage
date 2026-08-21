export const SCENE_IDS = Object.freeze({
  HUB: 'hub',
  MUSIC: 'music',
})

export const PLAYABLE_VILLAGE_IDS = Object.freeze([SCENE_IDS.MUSIC])

export function isPlayableVillage(villageId) {
  return PLAYABLE_VILLAGE_IDS.includes(villageId)
}

export function getVillageOverlayMode(villageId) {
  return isPlayableVillage(villageId) ? 'enter' : 'preview'
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
  if (targetScene === SCENE_IDS.MUSIC && currentScene !== SCENE_IDS.HUB) return { type: 'blocked', scene: currentScene }
  if (targetScene === SCENE_IDS.HUB && currentScene !== SCENE_IDS.MUSIC) return { type: 'blocked', scene: currentScene }
  return { type: 'transition', scene: targetScene }
}

export function addCompletedSound(completedIds, soundId, saved) {
  if (!saved || !soundId) return new Set(completedIds)
  return new Set([...completedIds, soundId])
}

export function createMusicInteractionTargets(placements, exitTarget, includeExit) {
  return includeExit ? [...placements, exitTarget] : [...placements]
}

export function resolveMusicInteraction(target) {
  if (target?.kind === 'music-exit') return { type: 'return-hub', target }
  if (target?.sound) return { type: 'annotate-sound', sound: target.sound }
  return { type: 'none' }
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
