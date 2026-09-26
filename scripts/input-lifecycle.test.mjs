import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const gameEngineSource = await readFile(new URL('../components/GameEngine.js', import.meta.url), 'utf8')

test('movement state resets when keyboard release events can be lost', () => {
  assert.match(gameEngineSource, /window\.addEventListener\('blur', reset\)/)
  assert.match(gameEngineSource, /document\.addEventListener\('visibilitychange', visibility\)/)
  assert.match(gameEngineSource, /if \(document\.visibilityState !== 'visible'\) reset\(\)/)
  assert.match(gameEngineSource, /keys\.up = false/)
  assert.match(gameEngineSource, /keys\.down = false/)
  assert.match(gameEngineSource, /keys\.left = false/)
  assert.match(gameEngineSource, /keys\.right = false/)
  assert.match(gameEngineSource, /if \(disabled\) clearMovementKeys\(keys\.current\)/)
})

test('movement lifecycle listeners are removed on unmount', () => {
  assert.match(gameEngineSource, /window\.removeEventListener\('blur', reset\)/)
  assert.match(gameEngineSource, /document\.removeEventListener\('visibilitychange', visibility\)/)
})
