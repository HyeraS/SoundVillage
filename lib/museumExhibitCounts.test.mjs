import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCatalogExhibitCounts, mergeExhibitCounts } from './museumExhibitCounts.mjs'

const metadata = JSON.parse(await readFile(new URL('../data/sound_metadata.json', import.meta.url), 'utf8'))

test('catalog totals are available before any participant annotations exist', () => {
  const groupA = buildCatalogExhibitCounts(metadata.sounds, { groupId: 'A' })
  const groupB = buildCatalogExhibitCounts(metadata.sounds, { groupId: 'G2' })

  assert.deepEqual(groupA.Animal, { collected: 0, total: 83 })
  assert.deepEqual(groupA.Lab, { collected: 0, total: 84 })
  assert.deepEqual(groupB.Human, { collected: 0, total: 84 })
  assert.deepEqual(groupB.Lab, { collected: 0, total: 85 })
})

test('authoritative progress replaces catalog fallback without losing other zone totals', () => {
  const catalog = buildCatalogExhibitCounts(metadata.sounds, { groupId: 'B' })
  const merged = mergeExhibitCounts(catalog, {
    Human: { collected: 7, total: 84 },
    Nature: { collected: 2, total: 0 },
  })

  assert.deepEqual(merged.Human, { collected: 7, total: 84 })
  assert.deepEqual(merged.Nature, catalog.Nature)
  assert.deepEqual(merged.Animal, catalog.Animal)
})

test('progress count is clamped to its assigned total', () => {
  const catalog = buildCatalogExhibitCounts(metadata.sounds, { groupId: 'A' })
  const merged = mergeExhibitCounts(catalog, { Music: { collected: 99, total: 83 } })

  assert.deepEqual(merged.Music, { collected: 83, total: 83 })
})
