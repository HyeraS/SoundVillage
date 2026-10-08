const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg']

export class AudioPlaybackError extends Error {
  constructor(message, { code = 'audio_failed', retryable = false, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'AudioPlaybackError'
    this.code = code
    this.retryable = retryable
  }
}

export class AudioPlaybackCancelledError extends AudioPlaybackError {
  constructor(reason = 'cancelled') {
    super('오디오 재생 요청이 취소되었습니다.', {
      code: 'audio_cancelled',
      retryable: false,
    })
    this.name = 'AudioPlaybackCancelledError'
    this.reason = reason
  }
}

export function isAudioPlaybackCancelled(error) {
  return error instanceof AudioPlaybackCancelledError || error?.code === 'audio_cancelled'
}

function cleanBaseUrl(audioBase) {
  return String(audioBase || '').trim().replace(/\/+$/, '')
}

function joinAudioUrl(audioBase, relativePath) {
  return `${cleanBaseUrl(audioBase)}/${String(relativePath).replace(/^\/+/, '')}`
}

export function buildAudioSources(filePath, audioBase = '') {
  if (!filePath || typeof filePath !== 'string') return []

  const trimmed = filePath.trim()
  if (!trimmed) return []
  if (/^https?:\/\//i.test(trimmed)) return [trimmed]

  const baseUrl = cleanBaseUrl(audioBase)
  const withoutAudioPrefix = trimmed.replace(/^\/?audio\//i, '')
  const hasExtension = AUDIO_EXTENSIONS.some(extension => withoutAudioPrefix.toLowerCase().endsWith(extension))

  if (hasExtension) {
    return baseUrl ? [joinAudioUrl(baseUrl, withoutAudioPrefix)] : [`/audio/${withoutAudioPrefix}`]
  }

  const base = trimmed.startsWith('Audio/')
    ? trimmed.slice('Audio/'.length)
    : withoutAudioPrefix
  const extensions = baseUrl ? ['.mp3', '.wav'] : AUDIO_EXTENSIONS
  return extensions.map(extension => (
    baseUrl ? joinAudioUrl(baseUrl, `${base}${extension}`) : `/audio/${base}${extension}`
  ))
}

function classifyPlaybackFailure(kind, rawError) {
  const numericCode = Number(rawError)
  const text = String(rawError?.message || rawError || '').toLowerCase()
  // HTML5 media collapses HTTP failures (including transient 5xx responses) and
  // unsupported/absent sources into MEDIA_ERR_SRC_NOT_SUPPORTED (4). One bounded
  // retry is therefore safe; repeated code 4 is treated as a permanent failure.
  const retryable = numericCode === 2 || (kind === 'load' && numericCode === 4)
    || /network|timeout|timed out|fetch|connection|5\d\d/.test(text)
  const code = retryable
    ? 'audio_network_failed'
    : kind === 'play'
      ? 'audio_play_failed'
      : kind === 'load'
        ? 'audio_load_failed'
        : 'audio_init_failed'

  return new AudioPlaybackError(
    kind === 'play' ? '오디오 재생을 시작하지 못했습니다.' : '오디오를 불러오지 못했습니다.',
    { code, retryable, cause: rawError },
  )
}

function positiveDuration(howl) {
  try {
    const duration = Number(howl?.duration?.())
    return Number.isFinite(duration) && duration > 0 ? duration : 0
  } catch {
    return 0
  }
}

export function createAudioPlaybackManager({
  Howl,
  Howler,
  listeningTimer,
  audioBase = '',
  maxRetries = 1,
  retryDelayMs = 150,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancelSchedule = timer => clearTimeout(timer),
} = {}) {
  if (typeof Howl !== 'function') throw new TypeError('Howl constructor is required')
  if (!listeningTimer) throw new TypeError('listeningTimer is required')

  let generation = 0
  let currentRequest = null

  const pauseTimer = () => listeningTimer.pause()

  function isCurrent(request, attemptToken) {
    return currentRequest === request
      && request.generation === generation
      && !request.cancelled
      && (!attemptToken || request.attemptToken === attemptToken)
  }

  function isCurrentAttempt(request, attemptToken, howlInstance) {
    return isCurrent(request, attemptToken) && request.howl === howlInstance
  }

  function settleInitial(request, outcome, value) {
    if (request.settled) return false
    request.settled = true
    if (outcome === 'resolve') request.resolve(value)
    else request.reject(value)
    return true
  }

  function settleResume(request, outcome, value) {
    const pending = request.pendingResume
    if (!pending || pending.settled) return false
    pending.settled = true
    request.pendingResume = null
    if (outcome === 'resolve') pending.resolve(value)
    else pending.reject(value)
    return true
  }

  function safelyStopAndUnload(request) {
    const howl = request?.howl
    if (!howl) return
    // Detach first so synchronous or delayed callbacks emitted by stop/unload
    // cannot mutate the request that is being cancelled or retried.
    request.howl = null
    try {
      if (howl.playing?.()) howl.stop?.()
    } catch {}
    try { howl.unload?.() } catch {}
  }

  function cancelRequest(request, reason, { unload = true } = {}) {
    if (!request || request.cancelled) return
    request.cancelled = true
    if (request.retryTimer) {
      cancelSchedule(request.retryTimer)
      request.retryTimer = null
    }
    pauseTimer()
    const cancellation = new AudioPlaybackCancelledError(reason)
    settleInitial(request, 'reject', cancellation)
    settleResume(request, 'reject', cancellation)
    if (unload) safelyStopAndUnload(request)
    if (currentRequest === request) currentRequest = null
  }

  function finishWithFailure(request, error) {
    if (!isCurrent(request)) return
    pauseTimer()
    request.status = 'error'
    settleInitial(request, 'reject', error)
    settleResume(request, 'reject', error)
    try { request.options.onPlayError?.(error) } catch {}
    safelyStopAndUnload(request)
    if (currentRequest === request) currentRequest = null
  }

  function retryOrFail(request, attemptToken, howlInstance, kind, rawError) {
    if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
    const error = classifyPlaybackFailure(kind, rawError)
    pauseTimer()

    if (!request.settled && error.retryable && request.retryCount < maxRetries) {
      request.retryCount += 1
      safelyStopAndUnload(request)
      try { request.options.onRetry?.({ attempt: request.retryCount + 1, code: error.code }) } catch {}
      request.retryTimer = schedule(() => {
        request.retryTimer = null
        if (isCurrent(request)) beginAttempt(request)
      }, retryDelayMs)
      return
    }

    finishWithFailure(request, error)
  }

  function beginAttempt(request) {
    if (!isCurrent(request)) return
    const attemptToken = Symbol(`audio-attempt-${request.retryCount + 1}`)
    request.attemptToken = attemptToken
    request.status = 'loading'
    let howlInstance = null

    const callbacks = {
      onload() {
        if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
        request.duration = positiveDuration(howlInstance)
        try { request.options.onLoad?.(request.duration) } catch {}
      },
      onloaderror(_soundId, error) {
        retryOrFail(request, attemptToken, howlInstance, 'load', error)
      },
      onplay() {
        if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
        request.duration = positiveDuration(howlInstance) || request.duration
        request.status = 'playing'
        pauseTimer()
        listeningTimer.start()
        settleResume(request, 'resolve', request.duration)
        settleInitial(request, 'resolve', request.duration)
      },
      onplayerror(_soundId, error) {
        retryOrFail(request, attemptToken, howlInstance, 'play', error)
      },
      onpause() {
        if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
        request.status = 'paused'
        pauseTimer()
      },
      onstop() {
        if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
        request.status = 'stopped'
        pauseTimer()
      },
      onend() {
        if (!isCurrentAttempt(request, attemptToken, howlInstance)) return
        request.status = 'ended'
        pauseTimer()
        try { request.options.onEnd?.() } catch {}
      },
    }

    try {
      howlInstance = new Howl({
        src: request.sources,
        html5: true,
        preload: true,
        volume: 0.85,
        ...callbacks,
      })
      if (!isCurrent(request, attemptToken)) {
        try { howlInstance.unload?.() } catch {}
        return
      }
      request.howl = howlInstance
      howlInstance.play()
    } catch (error) {
      if (howlInstance) request.howl = howlInstance
      retryOrFail(request, attemptToken, howlInstance, 'init', error)
    }
  }

  function playSound(filePath, options = {}) {
    const sources = buildAudioSources(filePath, audioBase)
    if (sources.length === 0) {
      return Promise.reject(new AudioPlaybackError('오디오 경로가 비어 있습니다.', {
        code: 'audio_path_missing',
      }))
    }

    const previous = currentRequest
    generation += 1
    if (previous) cancelRequest(previous, 'replaced')
    pauseTimer()

    const request = {
      generation,
      sources,
      options,
      howl: null,
      status: 'loading',
      duration: 0,
      retryCount: 0,
      retryTimer: null,
      attemptToken: null,
      settled: false,
      cancelled: false,
      pendingResume: null,
      resolve: null,
      reject: null,
    }
    currentRequest = request

    const promise = new Promise((resolve, reject) => {
      request.resolve = resolve
      request.reject = reject
    })
    beginAttempt(request)
    return promise
  }

  function pauseSound() {
    const request = currentRequest
    if (!request) return false
    if (!request.settled) {
      cancelRequest(request, 'paused_while_loading')
      return false
    }
    try {
      if (request.howl?.playing?.()) request.howl.pause?.()
      else pauseTimer()
      request.status = 'paused'
      return true
    } catch {
      pauseTimer()
      return false
    }
  }

  function resumeSound() {
    const request = currentRequest
    if (!request?.howl || request.cancelled) {
      return Promise.reject(new AudioPlaybackError('재개할 오디오가 없습니다.', { code: 'audio_resume_unavailable' }))
    }
    if (request.howl.playing?.()) return Promise.resolve(request.duration)
    if (request.pendingResume) return request.pendingResume.promise

    let resolveResume
    let rejectResume
    const promise = new Promise((resolve, reject) => {
      resolveResume = resolve
      rejectResume = reject
    })
    request.pendingResume = {
      promise,
      resolve: resolveResume,
      reject: rejectResume,
      settled: false,
    }
    try {
      request.howl.play()
    } catch (error) {
      finishWithFailure(request, classifyPlaybackFailure('play', error))
    }
    return promise
  }

  function stopSound() {
    const request = currentRequest
    if (!request) return false
    if (!request.settled) {
      generation += 1
      cancelRequest(request, 'stopped_while_loading')
      return true
    }
    pauseTimer()
    settleResume(request, 'reject', new AudioPlaybackCancelledError('stopped'))
    try { request.howl?.stop?.() } catch {}
    request.status = 'stopped'
    return true
  }

  function resetAudio() {
    const request = currentRequest
    generation += 1
    if (request) cancelRequest(request, 'reset')
    pauseTimer()
    listeningTimer.reset()
  }

  function isSoundPaused() {
    const request = currentRequest
    return Boolean(request?.howl && request.status === 'paused' && positiveDuration(request.howl) > 0)
  }

  function isPlaying() {
    try { return Boolean(currentRequest?.howl?.playing?.()) } catch { return false }
  }

  function getCurrentTime() {
    try {
      const value = currentRequest?.howl?.seek?.()
      return typeof value === 'number' ? value : null
    } catch { return null }
  }

  function seekTo(seconds) {
    try { currentRequest?.howl?.seek?.(seconds) } catch {}
  }

  function getPlaybackProgress() {
    const request = currentRequest
    if (!request?.howl || !isPlaying()) return null
    const currentTime = getCurrentTime()
    const duration = positiveDuration(request.howl)
    return currentTime === null || !duration ? null : currentTime / duration
  }

  async function unlockAudio() {
    try {
      if (Howler?.ctx?.state === 'suspended') await Howler.ctx.resume()
      return true
    } catch {
      return false
    }
  }

  return {
    playSound,
    pauseSound,
    resumeSound,
    stopSound,
    resetAudio,
    isSoundPaused,
    isPlaying,
    getCurrentTime,
    seekTo,
    getPlaybackProgress,
    getListeningTime: () => listeningTimer.seconds(),
    resetListeningTime: () => listeningTimer.reset(),
    unlockAudio,
  }
}
