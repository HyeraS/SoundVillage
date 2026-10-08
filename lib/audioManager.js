import { Howl, Howler } from 'howler'
import { createListeningTimer } from './listeningTimer.mjs'
import {
  AudioPlaybackCancelledError,
  AudioPlaybackError,
  buildAudioSources as buildSources,
  createAudioPlaybackManager,
  isAudioPlaybackCancelled,
} from './audioPlaybackCore.mjs'

const AUDIO_BASE = process.env.NEXT_PUBLIC_AUDIO_BASE_URL || ''

const manager = createAudioPlaybackManager({
  Howl,
  Howler,
  listeningTimer: createListeningTimer(),
  audioBase: AUDIO_BASE,
})

export { AudioPlaybackCancelledError, AudioPlaybackError, isAudioPlaybackCancelled }
export const buildAudioSources = filePath => buildSources(filePath, AUDIO_BASE)
export const playSound = (...args) => {
  if (process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'
    && typeof window !== 'undefined') {
    window.__soundVillageAudioDiagnostics = window.__soundVillageAudioDiagnostics || { requests: 0 }
    window.__soundVillageAudioDiagnostics.requests += 1
  }
  return manager.playSound(...args)
}
export const pauseSound = manager.pauseSound
export const resumeSound = manager.resumeSound
export const stopSound = manager.stopSound
export const getListeningTime = manager.getListeningTime
export const resetListeningTime = manager.resetListeningTime
export const resetAudio = manager.resetAudio
export const isPlaying = manager.isPlaying
export const isSoundPaused = manager.isSoundPaused
export const getCurrentTime = manager.getCurrentTime
export const seekTo = manager.seekTo
export const getPlaybackProgress = manager.getPlaybackProgress
export const unlockAudio = manager.unlockAudio
