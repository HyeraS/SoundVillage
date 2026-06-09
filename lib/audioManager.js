import { Howl, Howler } from 'howler'

let currentHowl = null
let currentSoundId = 0

let listeningStart = null
let totalListeningMs = 0

/**
 * filePath를 실제 public/audio 경로로 변환한다.
 *
 * 지원하는 입력 예시:
 * 1. Unity-style: "Audio/Forest/forest_bird_01"
 *    → /audio/Forest/forest_bird_01.wav
 *    → /audio/Forest/forest_bird_01.mp3
 *
 * 2. Web full path: "/audio/Forest/forest_bird_01.wav"
 *    → 그대로 사용
 *
 * 3. Web path without extension: "/audio/Forest/forest_bird_01"
 *    → /audio/Forest/forest_bird_01.wav
 *    → /audio/Forest/forest_bird_01.mp3
 *
 * 4. Relative path: "Forest/forest_bird_01"
 *    → /audio/Forest/forest_bird_01.wav
 *    → /audio/Forest/forest_bird_01.mp3
 */
// Supabase Storage public URL (배포 환경)
// 로컬 개발 시에는 NEXT_PUBLIC_AUDIO_BASE_URL 환경변수를 비워두면 /audio/ 경로 사용
const AUDIO_BASE = process.env.NEXT_PUBLIC_AUDIO_BASE_URL || ''

function buildAudioSources(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return []
  }

  const trimmed = filePath.trim()

  // 이미 http(s):// 절대 URL인 경우 그대로 사용
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return [trimmed]
  }

  // 이미 /audio/ 경로 + 확장자까지 있는 경우
  if (
    trimmed.startsWith('/audio/') &&
    (trimmed.endsWith('.wav') || trimmed.endsWith('.mp3') || trimmed.endsWith('.ogg'))
  ) {
    const path = trimmed.replace(/^\/audio\//, '')
    return AUDIO_BASE
      ? [`${AUDIO_BASE}/${path}`]
      : [trimmed]
  }

  // Unity Resources 스타일: Audio/Forest/xxx
  if (trimmed.startsWith('Audio/')) {
    const base = trimmed.replace(/^Audio\//, '')
    return AUDIO_BASE
      ? [`${AUDIO_BASE}/${base}.mp3`, `${AUDIO_BASE}/${base}.wav`]
      : [`/audio/${base}.mp3`, `/audio/${base}.wav`, `/audio/${base}.ogg`]
  }

  // /audio/ 경로이지만 확장자 없는 경우
  if (trimmed.startsWith('/audio/')) {
    const base = trimmed.replace(/^\/audio\//, '')
    return AUDIO_BASE
      ? [`${AUDIO_BASE}/${base}.mp3`, `${AUDIO_BASE}/${base}.wav`]
      : [`${trimmed}.mp3`, `${trimmed}.wav`, `${trimmed}.ogg`]
  }

  // fallback
  return AUDIO_BASE
    ? [`${AUDIO_BASE}/${trimmed}.mp3`, `${AUDIO_BASE}/${trimmed}.wav`]
    : [`/audio/${trimmed}.mp3`, `/audio/${trimmed}.wav`, `/audio/${trimmed}.ogg`]
}

function accumulateListeningTime() {
  if (listeningStart !== null) {
    totalListeningMs += Date.now() - listeningStart
    listeningStart = null
  }
}

function safelyUnloadCurrentSound() {
  if (!currentHowl) return

  try {
    if (currentHowl.playing()) {
      currentHowl.stop()
    }

    currentHowl.unload()
  } catch (error) {
    console.warn('[audioManager] 기존 오디오 정리 중 경고:', error)
  } finally {
    currentHowl = null
  }
}

/**
 * 오디오 재생
 *
 * AnnotationPanel.js에서 사용하는 방식:
 *
 * await playSound(sound.file_path, {
 *   onEnd: () => {...},
 *   onLoad: (duration) => {...},
 *   onPlayError: (err) => {...}
 * })
 */
export function playSound(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const sources = buildAudioSources(filePath)

    if (sources.length === 0) {
      reject(new Error('[audioManager] filePath가 비어 있습니다.'))
      return
    }

    // 새 소리를 재생하기 전에 이전 소리의 청취 시간 누적
    accumulateListeningTime()

    // 이전 소리 정리
    safelyUnloadCurrentSound()

    const soundId = currentSoundId + 1
    currentSoundId = soundId

    let howlInstance
    try {
      howlInstance = new Howl({
      src: sources,
      html5: true,
      preload: true,
      volume: 0.85,

      onload() {
        // 이전 사운드의 늦은 callback이면 무시
        if (soundId !== currentSoundId || !currentHowl) return

        const duration = currentHowl.duration()

        if (typeof options.onLoad === 'function') {
          options.onLoad(duration)
        }

        resolve(duration)
      },

      onloaderror(_, error) {
        if (soundId !== currentSoundId) return

        console.error('[audioManager] 오디오 로드 실패:', {
          filePath,
          sources,
          error,
        })

        reject(new Error(`오디오 로드 실패: ${String(error)}`))
      },

      onplay() {
        if (soundId !== currentSoundId) return

        // 중복 누적 방지를 위해 기존 start가 있으면 먼저 누적
        accumulateListeningTime()
        listeningStart = Date.now()
      },

      onend() {
        if (soundId !== currentSoundId) return

        accumulateListeningTime()

        if (typeof options.onEnd === 'function') {
          options.onEnd()
        }
      },

      onstop() {
        if (soundId !== currentSoundId) return
        accumulateListeningTime()
      },

      onpause() {
        if (soundId !== currentSoundId) return
        accumulateListeningTime()
      },

      onplayerror(_, error) {
        if (soundId !== currentSoundId) return

        console.error('[audioManager] 오디오 재생 오류:', {
          filePath,
          sources,
          error,
        })

        if (typeof options.onPlayError === 'function') {
          options.onPlayError(error)
        }

        reject(new Error(`오디오 재생 오류: ${String(error)}`))
      },
      })
    } catch (initErr) {
      reject(new Error(`Howl 초기화 실패: ${String(initErr)}`))
      return
    }

    currentHowl = howlInstance

    try {
      currentHowl.play()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 현재 재생 중인 소리 일시정지 (언로드하지 않음 → 재개 가능)
 */
export function pauseSound() {
  if (!currentHowl) return
  try {
    if (currentHowl.playing()) {
      accumulateListeningTime()
      currentHowl.pause()
    }
  } catch (e) {
    console.warn('[audioManager] pauseSound 중 경고:', e)
  }
}

/**
 * 일시정지된 소리 재개 (같은 Howl 인스턴스 유지 → 재다운로드 없음)
 */
export function resumeSound() {
  if (!currentHowl) return
  try {
    if (!currentHowl.playing()) {
      listeningStart = Date.now()
      currentHowl.play()
    }
  } catch (e) {
    console.warn('[audioManager] resumeSound 중 경고:', e)
  }
}

/**
 * 현재 소리가 일시정지 상태인지 확인
 */
export function isSoundPaused() {
  return Boolean(currentHowl && !currentHowl.playing() && currentHowl.duration() > 0)
}

/**
 * 현재 재생 중인 소리 정지
 *
 * AnnotationPanel.js에서 재생 중 버튼을 다시 누르거나,
 * 패널이 닫힐 때 호출됨.
 */
export function stopSound() {
  if (!currentHowl) return

  try {
    if (currentHowl.playing()) {
      currentHowl.stop()
    } else {
      accumulateListeningTime()
    }
  } catch (error) {
    console.warn('[audioManager] stopSound 중 경고:', error)
    accumulateListeningTime()
  }
}

/**
 * 지금까지 실제로 들은 시간을 초 단위로 반환
 *
 * 제출 직전에 호출되어 Supabase의 listening_time_sec로 저장됨.
 */
export function getListeningTime() {
  let currentTotal = totalListeningMs

  // 아직 stop/end가 안 된 상태에서 제출하는 경우도 반영
  if (listeningStart !== null) {
    currentTotal += Date.now() - listeningStart
  }

  return Number((currentTotal / 1000).toFixed(2))
}

/**
 * 청취 시간 초기화
 *
 * Stage 1 제출 후, Stage 2 투표 제출 후 AnnotationPanel.js에서 호출됨.
 */
export function resetListeningTime() {
  totalListeningMs = 0
  listeningStart = null
}

/**
 * 선택 기능: 전체 오디오 상태 초기화
 *
 * 현재 AnnotationPanel.js에서는 직접 import하지 않지만,
 * 나중에 page 이동, 새 trial 시작, 디버깅 시 사용할 수 있게 둠.
 */
export function resetAudio() {
  accumulateListeningTime()
  safelyUnloadCurrentSound()
  resetListeningTime()
}

/**
 * 선택 기능: 현재 재생 중인지 확인
 */
export function isPlaying() {
  return Boolean(currentHowl && currentHowl.playing())
}

/**
 * 현재 재생 위치(초)를 반환한다.
 * 재생 중이 아니거나 위치를 읽을 수 없으면 null.
 */
export function getCurrentTime() {
  if (!currentHowl) return null
  try {
    const t = currentHowl.seek()
    return typeof t === 'number' ? t : null
  } catch { return null }
}

/**
 * 재생 위치를 특정 초로 이동한다.
 * html5 모드에서 seek()은 비동기적으로 반영될 수 있다.
 */
export function seekTo(seconds) {
  if (!currentHowl) return
  try { currentHowl.seek(seconds) } catch {}
}

/**
 * 선택 기능: 현재 재생 진행률 반환
 * 0~1 사이 숫자, 재생 중이 아니면 null.
 *
 * 현재 AnnotationPanel.js의 WaveformBar는 자체 timer로 progress를 계산하고 있어서
 * 이 함수는 필수는 아님.
 */
export function getPlaybackProgress() {
  if (!currentHowl || !currentHowl.playing()) return null

  const seek = currentHowl.seek()
  const duration = currentHowl.duration()

  if (!duration || typeof seek !== 'number') return null

  return seek / duration
}

/**
 * 선택 기능: iOS/Safari에서 오디오 컨텍스트가 suspend된 경우 resume 시도
 */
export async function unlockAudio() {
  try {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume()
    }
    return true
  } catch (error) {
    console.warn('[audioManager] unlockAudio 실패:', error)
    return false
  }
}