import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { makeCatalogIndex, resolveCatalogPurchase, validateEconomyCatalogV1 } from './economyCatalogContract.mjs'
import {
  ATTENDANCE_AMOUNTS,
  VILLAGES,
  attendanceDay7TieOrder,
  attendanceVillagePermutation,
  getKstWeekContext,
} from './multiVillageEconomyCore.mjs'

const catalog = JSON.parse(await readFile(new URL('../data/economy/catalog-v1.json', import.meta.url), 'utf8'))
const index = makeCatalogIndex(catalog)
const secret = 'test-only-secret-that-is-longer-than-thirty-two-characters'

test('catalog contract and server purchase projection use six canonical wallets', () => {
  assert.equal(validateEconomyCatalogV1(catalog), catalog)
  assert.deepEqual(VILLAGES, ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab'])
  const general = catalog.items.find((item) => item.officialStoreStatus === 'approved'
    && item.type !== 'theme_set' && Object.values(item.cost).filter(Boolean).length === 4)
  const all = catalog.items.find((item) => item.officialStoreStatus === 'approved'
    && item.type !== 'theme_set' && Object.values(item.cost).filter(Boolean).length === 6)
  assert.equal(Object.values(resolveCatalogPurchase(catalog, index, general.id).product.cost).filter(Boolean).length, 4)
  assert.equal(Object.values(resolveCatalogPurchase(catalog, index, all.id).product.cost).filter(Boolean).length, 6)
})

test('unapproved, free, unknown, and placeholder products cannot be purchased', () => {
  const pending = catalog.items.find((item) => item.officialStoreStatus === 'pending_interior_review')
  const free = catalog.items.find((item) => item.officialStoreStatus === 'free_customization')
  assert.equal(resolveCatalogPurchase(catalog, index, pending.id).reason, 'official_store_unapproved')
  assert.equal(resolveCatalogPurchase(catalog, index, free.id).reason, 'official_store_unapproved')
  assert.equal(resolveCatalogPurchase(catalog, index, 'missing-product').reason, 'unknown_item')
  for (const set of catalog.items.filter((item) => item.type === 'theme_set')) {
    assert.equal(index.has(set.collectionCompletionReward.assetId), false)
    assert.match(set.collectionCompletionReward.assetId, /^placeholder_/)
  }
})

test('theme sets project one charge and all component grants', () => {
  for (const set of catalog.items.filter((item) => item.type === 'theme_set')) {
    const resolved = resolveCatalogPurchase(catalog, index, set.id)
    assert.equal(resolved.ok, true)
    assert.equal(resolved.product.isBundle, true)
    assert.deepEqual(resolved.product.grantItemIds, set.bundleItemIds)
    assert.equal(Object.values(resolved.product.cost).reduce((sum, amount) => sum + amount, 0), 90)
  }
})

test('participant-week HMAC decisions are deterministic and cover each village once', () => {
  const input = { secret, participantId: 'P-001', weekKey: '2026-09-28' }
  const permutation = attendanceVillagePermutation(input)
  assert.deepEqual(attendanceVillagePermutation(input), permutation)
  assert.deepEqual([...permutation].sort(), [...VILLAGES].sort())
  assert.deepEqual([...attendanceDay7TieOrder(input)].sort(), [...VILLAGES].sort())
  assert.throws(() => attendanceVillagePermutation({ ...input, secret: '' }), /HMAC_SECRET/)
  assert.throws(() => attendanceVillagePermutation({ ...input, secret: 'x'.repeat(31) }), /at least 32/)
})

test('KST Monday boundary and weekly reward total are fixed', () => {
  assert.deepEqual(getKstWeekContext(new Date('2026-09-27T14:59:59Z')), {
    localDate: '2026-09-27', weekKey: '2026-09-21', attendanceDay: 7, amount: 5,
  })
  assert.deepEqual(getKstWeekContext(new Date('2026-09-27T15:00:00Z')), {
    localDate: '2026-09-28', weekKey: '2026-09-28', attendanceDay: 1, amount: 2,
  })
  assert.equal(ATTENDANCE_AMOUNTS.reduce((sum, amount) => sum + amount, 0), 21)
})
