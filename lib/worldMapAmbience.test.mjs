import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { WORLD_MAP_AMBIENCE } from './worldMapAmbience.mjs'

test('world-map ambience starts at 1:30 and references a bundled asset', () => {
  assert.equal(WORLD_MAP_AMBIENCE.startMs, 90_000)
  assert.equal(
    WORLD_MAP_AMBIENCE.segmentDurationMs,
    WORLD_MAP_AMBIENCE.sourceDurationMs - WORLD_MAP_AMBIENCE.startMs,
  )
  assert.equal(WORLD_MAP_AMBIENCE.src, '/audio/world/birds-wind-synth-final-b-mix.ogg')
  assert.ok(existsSync(new URL(`../public${WORLD_MAP_AMBIENCE.src}`, import.meta.url)))
})
