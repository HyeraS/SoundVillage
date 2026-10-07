'use client'

import { useEffect } from 'react'
import { Howl } from 'howler'
import { WORLD_MAP_AMBIENCE } from '@/lib/worldMapAmbience.mjs'

let ambienceHowl = null
let ambienceSoundId = null
let activeConsumers = 0
let unloadTimer = null
let visibilityListening = false
let gestureRetryArmed = false

function clearUnloadTimer() {
  if (unloadTimer === null) return
  window.clearTimeout(unloadTimer)
  unloadTimer = null
}

function removeGestureRetry() {
  if (!gestureRetryArmed) return
  gestureRetryArmed = false
  window.removeEventListener('click', retryFromGesture)
  window.removeEventListener('touchend', retryFromGesture)
  window.removeEventListener('keydown', retryFromGesture)
}

function retryFromGesture() {
  removeGestureRetry()
  playWorldMapAmbience()
}

function armGestureRetry() {
  if (gestureRetryArmed || activeConsumers === 0) return
  gestureRetryArmed = true
  // Howler unlocks its HTML5 pool on document-level gesture handlers. Listen
  // later in the bubble phase so the first retry uses the already-unlocked pool.
  window.addEventListener('click', retryFromGesture)
  window.addEventListener('touchend', retryFromGesture)
  window.addEventListener('keydown', retryFromGesture)
}

function createAmbienceHowl() {
  const howl = new Howl({
    src: [WORLD_MAP_AMBIENCE.src],
    html5: true,
    preload: true,
    volume: 0,
    sprite: {
      [WORLD_MAP_AMBIENCE.spriteName]: [
        WORLD_MAP_AMBIENCE.startMs,
        WORLD_MAP_AMBIENCE.segmentDurationMs,
        true,
      ],
    },
    onplayerror(soundId, error) {
      if (ambienceHowl !== howl || ambienceSoundId !== soundId) return
      try { howl.stop(soundId) } catch {}
      ambienceSoundId = null
      console.info('[worldMapAmbience] 사용자 입력 후 환경음 재생을 다시 시도합니다.', error)
      armGestureRetry()
    },
    onloaderror(_, error) {
      console.warn('[worldMapAmbience] 환경음을 불러오지 못했습니다.', error)
    },
  })
  return howl
}

function playWorldMapAmbience() {
  if (activeConsumers === 0 || document.visibilityState === 'hidden') return
  clearUnloadTimer()

  const howl = ambienceHowl || createAmbienceHowl()
  ambienceHowl = howl

  if (ambienceSoundId !== null) {
    if (!howl.playing(ambienceSoundId)) howl.play(ambienceSoundId)
    const currentVolume = Number(howl.volume(ambienceSoundId)) || 0
    howl.fade(currentVolume, WORLD_MAP_AMBIENCE.volume, WORLD_MAP_AMBIENCE.fadeInMs, ambienceSoundId)
    return
  }

  const soundId = howl.play(WORLD_MAP_AMBIENCE.spriteName)
  ambienceSoundId = soundId
  howl.volume(0, soundId)
  howl.fade(0, WORLD_MAP_AMBIENCE.volume, WORLD_MAP_AMBIENCE.fadeInMs, soundId)
}

function handleVisibilityChange() {
  const howl = ambienceHowl
  const soundId = ambienceSoundId
  if (!howl || soundId === null) {
    if (document.visibilityState === 'visible') playWorldMapAmbience()
    return
  }

  if (document.visibilityState === 'hidden') {
    if (howl.playing(soundId)) howl.pause(soundId)
  } else {
    playWorldMapAmbience()
  }
}

function startWorldMapAmbience() {
  activeConsumers += 1
  if (!visibilityListening) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityListening = true
  }
  playWorldMapAmbience()
}

function stopWorldMapAmbience() {
  activeConsumers = Math.max(0, activeConsumers - 1)
  if (activeConsumers > 0) return

  removeGestureRetry()
  if (visibilityListening) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    visibilityListening = false
  }

  const howl = ambienceHowl
  const soundId = ambienceSoundId
  if (!howl) return

  clearUnloadTimer()
  const unload = () => {
    try {
      if (soundId !== null) howl.stop(soundId)
      howl.unload()
    } catch {}
    if (ambienceHowl === howl) {
      ambienceHowl = null
      ambienceSoundId = null
    }
    unloadTimer = null
  }

  if (soundId !== null && howl.playing(soundId)) {
    const currentVolume = Number(howl.volume(soundId)) || WORLD_MAP_AMBIENCE.volume
    howl.fade(currentVolume, 0, WORLD_MAP_AMBIENCE.fadeOutMs, soundId)
    unloadTimer = window.setTimeout(unload, WORLD_MAP_AMBIENCE.fadeOutMs + 50)
  } else {
    unload()
  }
}

export function useWorldMapAmbience(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    startWorldMapAmbience()
    return stopWorldMapAmbience
  }, [enabled])
}
