import test from 'node:test'
import assert from 'node:assert/strict'

import { createListeningTimer } from './listeningTimer.mjs'

test('counts only active listening intervals', () => {
  let currentMs = 1000
  const timer = createListeningTimer(() => currentMs)

  timer.start()
  currentMs = 2250
  timer.pause()
  currentMs = 9000

  assert.equal(timer.seconds(), 1.25)

  timer.start()
  currentMs = 9755
  assert.equal(timer.seconds(), 2)
})

test('reset starts a clean trial even when audio was active', () => {
  let currentMs = 0
  const timer = createListeningTimer(() => currentMs)

  timer.start()
  currentMs = 3200
  timer.reset()
  currentMs = 8000

  assert.equal(timer.seconds(), 0)

  timer.start()
  currentMs = 8600
  assert.equal(timer.seconds(), 0.6)
})

test('restarting an active timer preserves elapsed time without overlap', () => {
  let currentMs = 0
  const timer = createListeningTimer(() => currentMs)

  timer.start()
  currentMs = 400
  timer.start()
  currentMs = 1000

  assert.equal(timer.seconds(), 1)
})
