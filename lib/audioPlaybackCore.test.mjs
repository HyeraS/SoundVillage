import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AudioPlaybackCancelledError,
  buildAudioSources,
  createAudioPlaybackManager,
} from './audioPlaybackCore.mjs'

function createHarness({ maxRetries = 0 } = {}) {
  const instances = []
  const scheduled = []
  const timer = {
    active: false,
    starts: 0,
    pauses: 0,
    resets: 0,
    start() { this.active = true; this.starts += 1 },
    pause() { this.active = false; this.pauses += 1 },
    reset() { this.active = false; this.resets += 1 },
    seconds() { return 0 },
  }

  class MockHowl {
    constructor(options) {
      this.options = options
      this.playCalls = 0
      this.pauseCalls = 0
      this.stopCalls = 0
      this.unloadCalls = 0
      this.playingValue = false
      this.durationValue = 12.5
      this.seekValue = 0
      instances.push(this)
    }

    play() { this.playCalls += 1; return this.playCalls }
    pause() { this.pauseCalls += 1; this.playingValue = false; this.options.onpause?.(1) }
    stop() { this.stopCalls += 1; this.playingValue = false; this.options.onstop?.(1) }
    unload() { this.unloadCalls += 1 }
    playing() { return this.playingValue }
    duration() { return this.durationValue }
    seek(value) {
      if (value !== undefined) this.seekValue = value
      return this.seekValue
    }
    emit(event, error) {
      if (event === 'play') this.playingValue = true
      if (event === 'pause' || event === 'stop' || event === 'end') this.playingValue = false
      this.options[`on${event}`]?.(1, error)
    }
  }

  const manager = createAudioPlaybackManager({
    Howl: MockHowl,
    Howler: { ctx: null },
    listeningTimer: timer,
    maxRetries,
    retryDelayMs: 1,
    schedule(callback) {
      const entry = { callback, cancelled: false }
      scheduled.push(entry)
      return entry
    },
    cancelSchedule(entry) { entry.cancelled = true },
  })

  return {
    manager,
    instances,
    timer,
    scheduled,
    flushRetry() {
      const entry = scheduled.shift()
      if (entry && !entry.cancelled) entry.callback()
    },
  }
}

async function rejectsCancellation(promise) {
  await assert.rejects(promise, error => {
    assert(error instanceof AudioPlaybackCancelledError)
    assert.equal(error.code, 'audio_cancelled')
    return true
  })
}

test('audio source URL joining removes duplicate slashes and preserves supported extensions', () => {
  assert.deepEqual(
    buildAudioSources('Audio/Animal/clip', 'https://storage.example/audio/'),
    ['https://storage.example/audio/Animal/clip.mp3', 'https://storage.example/audio/Animal/clip.wav'],
  )
  assert.deepEqual(buildAudioSources('/audio/Animal/clip.mp3', ''), ['/audio/Animal/clip.mp3'])
})

test('load success does not resolve until actual play success', async () => {
  const { manager, instances, timer } = createHarness()
  let settled = false
  const playback = manager.playSound('Audio/Animal/clip').then(value => {
    settled = true
    return value
  })
  instances[0].emit('load')
  await Promise.resolve()
  assert.equal(settled, false)
  assert.equal(timer.starts, 0)

  instances[0].emit('play')
  assert.equal(await playback, 12.5)
  assert.equal(timer.starts, 1)
})

test('load failure rejects with a stable non-URL error contract', async () => {
  const { manager, instances } = createHarness()
  const playback = manager.playSound('Audio/Animal/private-clip')
  instances[0].emit('loaderror', 3)
  await assert.rejects(playback, error => error.code === 'audio_load_failed' && !error.message.includes('private-clip'))
})

test('play failure after load rejects and never starts listening time', async () => {
  const { manager, instances, timer } = createHarness()
  const playback = manager.playSound('Audio/Human/clip')
  instances[0].emit('load')
  instances[0].emit('playerror', 'NotAllowedError')
  await assert.rejects(playback, error => error.code === 'audio_play_failed')
  assert.equal(timer.starts, 0)
})

test('duplicate load and play errors reject and notify at most once', async () => {
  for (const [event, rawError] of [['loaderror', 3], ['playerror', 'NotAllowedError']]) {
    let errorNotifications = 0
    const { manager, instances } = createHarness()
    const playback = manager.playSound('Audio/Human/duplicate-error', {
      onPlayError() { errorNotifications += 1 },
    })
    instances[0].emit(event, rawError)
    instances[0].emit(event, rawError)
    await assert.rejects(playback)
    assert.equal(errorNotifications, 1, event)
  }
})

test('a replacement request explicitly cancels the previous pending request', async () => {
  const { manager, instances } = createHarness()
  const first = manager.playSound('Audio/Nature/first')
  const second = manager.playSound('Audio/Nature/second')
  await rejectsCancellation(first)
  assert.equal(instances[0].unloadCalls, 1)
  instances[1].emit('play')
  assert.equal(await second, 12.5)
})

test('reset rejects a pending request instead of leaving it pending', async () => {
  const { manager, instances, timer } = createHarness()
  const playback = manager.playSound('Audio/Urban/clip')
  manager.resetAudio()
  await rejectsCancellation(playback)
  assert.equal(instances[0].unloadCalls, 1)
  assert.equal(timer.resets, 1)
})

test('rapid requests leave only the newest Howl active', async () => {
  const { manager, instances } = createHarness()
  const first = manager.playSound('Audio/Music/clip')
  const second = manager.playSound('Audio/Music/clip')
  await rejectsCancellation(first)
  assert.equal(instances.length, 2)
  assert.equal(instances[0].unloadCalls, 1)
  instances[1].emit('play')
  await second
})

test('late callbacks from an old request cannot settle or start the new request', async () => {
  const { manager, instances, timer } = createHarness()
  const first = manager.playSound('Audio/Lab/old')
  const second = manager.playSound('Audio/Lab/new')
  await rejectsCancellation(first)
  instances[0].emit('play')
  assert.equal(timer.starts, 0)
  let secondSettled = false
  second.then(() => { secondSettled = true })
  await Promise.resolve()
  assert.equal(secondSettled, false)
  instances[1].emit('play')
  await second
  assert.equal(timer.starts, 1)
})

test('pause, resume, stop, and end pause the listening timer without overlapping starts', async () => {
  const { manager, instances, timer } = createHarness()
  const playback = manager.playSound('Audio/Animal/clip')
  instances[0].emit('play')
  await playback
  assert.equal(timer.active, true)
  manager.pauseSound()
  assert.equal(timer.active, false)
  const resumed = manager.resumeSound()
  instances[0].emit('play')
  await resumed
  assert.equal(timer.starts, 2)
  manager.stopSound()
  assert.equal(timer.active, false)
  const restarted = manager.resumeSound()
  instances[0].emit('play')
  await restarted
  assert.equal(timer.starts, 3)
  instances[0].emit('end')
  assert.equal(timer.active, false)
})

test('error and reset both stop an active listening timer', async () => {
  {
    const { manager, instances, timer } = createHarness()
    const playback = manager.playSound('Audio/Animal/error-after-play')
    instances[0].emit('play')
    await playback
    assert.equal(timer.active, true)
    instances[0].emit('playerror', 'late playback failure')
    assert.equal(timer.active, false)
  }

  {
    const { manager, instances, timer } = createHarness()
    const playback = manager.playSound('Audio/Animal/reset-after-play')
    instances[0].emit('play')
    await playback
    assert.equal(timer.active, true)
    manager.resetAudio()
    assert.equal(timer.active, false)
    assert.equal(timer.resets, 1)
  }
})

test('a transient network failure retries once and resolves only the successful attempt', async () => {
  const { manager, instances, flushRetry } = createHarness({ maxRetries: 1 })
  const playback = manager.playSound('Audio/Animal/retry')
  instances[0].emit('loaderror', 2)
  flushRetry()
  assert.equal(instances.length, 2)
  instances[1].emit('load')
  instances[1].emit('play')
  assert.equal(await playback, 12.5)
})

test('a transient failure never creates more than one retry', async () => {
  const { manager, instances, flushRetry } = createHarness({ maxRetries: 1 })
  const playback = manager.playSound('Audio/Animal/retry-limit')
  instances[0].emit('loaderror', 2)
  flushRetry()
  instances[1].emit('loaderror', 2)
  await assert.rejects(playback, error => error.code === 'audio_network_failed')
  flushRetry()
  assert.equal(instances.length, 2)
})

test('a late error from an unloaded attempt cannot alter its scheduled retry', async () => {
  const { manager, instances, scheduled, flushRetry, timer } = createHarness({ maxRetries: 1 })
  const playback = manager.playSound('Audio/Animal/retry-stale-error')
  let outcome = 'pending'
  playback.then(
    () => { outcome = 'resolved' },
    () => { outcome = 'rejected' },
  )

  instances[0].emit('loaderror', 2)
  assert.equal(instances[0].unloadCalls, 1)
  assert.equal(scheduled.length, 1)

  instances[0].emit('loaderror', 2)
  await Promise.resolve()
  assert.equal(outcome, 'pending')
  assert.equal(scheduled.length, 1)
  assert.equal(timer.starts, 0)

  flushRetry()
  assert.equal(instances.length, 2)
  instances[1].emit('play')
  assert.equal(await playback, 12.5)
  assert.equal(timer.starts, 1)
})

test('cancellation also clears a scheduled retry and settles exactly once', async () => {
  const { manager, instances, flushRetry } = createHarness({ maxRetries: 1 })
  const playback = manager.playSound('Audio/Animal/retry-reset')
  instances[0].emit('loaderror', 2)
  manager.resetAudio()
  await rejectsCancellation(playback)
  flushRetry()
  assert.equal(instances.length, 1)
})
