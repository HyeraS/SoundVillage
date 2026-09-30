import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(repositoryRoot, 'data/economy/catalog-v1.json')
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const villages = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']
const combinationKeys = ['A', 'B', 'C', 'D', 'E', 'F']
const requiredFields = [
  'id', 'name', 'type', 'productGroup', 'sourceAsset', 'runtimeAsset', 'plannedRuntimeAsset',
  'animation', 'rarity', 'cost', 'requiredVillageCount', 'estimatedAnnotationCount',
  'minimumFreshAnnotationCount', 'starterFree', 'existingGameConnected', 'officialStoreStatus',
]

function idsFromJavaScript(relativePath) {
  const source = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
  return new Set([...source.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map(([, id]) => id))
}

function emptyCombinationCounts() {
  return Object.fromEntries(combinationKeys.map((key) => [key, 0]))
}

function spread(values) {
  return Math.max(...values) - Math.min(...values)
}

function assertNoRemovedCatalogFields(value, trail = 'catalog') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRemovedCatalogFields(entry, `${trail}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll('_', '')
    assert.ok(!normalized.includes('dailydeal'), `${trail}.${key}: daily-deal fields were removed from v1`)
    assert.ok(!normalized.includes('discount'), `${trail}.${key}: discount fields were removed from v1`)
    assertNoRemovedCatalogFields(child, `${trail}.${key}`)
  }
}

const currentIds = {
  shop: idsFromJavaScript('lib/shopCatalog.js'),
  interior: idsFromJavaScript('lib/interiorCatalog.js'),
  interiorSet: idsFromJavaScript('lib/interiorCatalog.js'),
  house: new Set([
    ...idsFromJavaScript('lib/houseCatalog.js'),
    ...JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'lib/generatedHouseAssets.json'), 'utf8')).items.map((item) => item.id),
  ]),
  defaultOutfit: new Set(['basic']),
}

assert.equal(catalog.schemaVersion, '1.1.0', 'catalog schemaVersion must be 1.1.0')
assert.deepEqual(catalog.currencyOrder, villages, 'currencyOrder must be the canonical six-village order')
assert.deepEqual(Object.keys(catalog.currencyCombinations), combinationKeys, 'currency combinations must be A-F')
assert.equal(catalog.rewardRules.annotation.amount, 5, 'annotation reward must be 5')
assert.equal(catalog.rewardRules.annotation.skipAmount, 0, 'skip reward must be 0')
assert.equal(catalog.rewardRules.vote.amount, 2, 'vote reward must be 2')
assert.equal(catalog.rewardRules.expressionBonus, 0, 'expression bonus must be 0')
assert.equal(catalog.rewardRules.agreementBonus, 0, 'agreement bonus must be 0')
assert.equal(catalog.rewardRules.currencyExchange, false, 'currency exchange must remain disabled')

assert.equal(catalog.priceRules.small.totalCost, 15, 'small total cost must be 15')
assert.deepEqual(catalog.priceRules.small.costShape, [3, 4, 4, 4], 'small cost shape must be 3/4/4/4')
assert.equal(catalog.priceRules.small.minimumFreshAnnotationCount, 4, 'small items must require four fresh village participations')
assert.equal(catalog.priceRules.small.uiParticipationRequirement, '서로 다른 4개 마을에서 각각 한 번 이상 참여', 'small-item UI requirement changed')

const attendance = catalog.attendanceRewardRules
assert.equal(attendance.enabled, true, 'attendance rewards must remain enabled')
assert.equal(attendance.scheduleScope, 'participant_week', 'attendance shuffle must be participant-week scoped')
assert.equal(attendance.weekKey, 'iso_week_monday_00_00_asia_seoul', 'attendance week must use the existing Asia/Seoul study-date boundary')
assert.equal(attendance.days1To6.villageSelection, 'seeded_permutation_of_all_six_villages', 'days 1-6 must use a seeded permutation')
assert.equal(attendance.days1To6.eachVillageOccursExactlyOnce, true, 'days 1-6 must cover every village exactly once')
assert.deepEqual(attendance.days1To6.amountBySequence, [2, 2, 2, 3, 3, 4], 'attendance day 1-6 amounts changed')
assert.equal(attendance.day7.amount, 5, 'day 7 attendance reward must be 5')
assert.equal(attendance.day7.villageSelection, 'lowest_current_balance_at_first_eligible_claim', 'day 7 must use the lowest current wallet')
assert.match(attendance.day7.tieBreak, /^server_/, 'day 7 tie break must be server-defined')
assert.equal(attendance.weeklyTotal, attendance.days1To6.amountBySequence.reduce((sum, amount) => sum + amount, 0) + attendance.day7.amount, 'weekly attendance total mismatch')
assert.equal(attendance.weeklyTotal, 21, 'weekly attendance total must be 21')
assert.equal(attendance.serverDecision.authoritative, true, 'attendance decisions must be server authoritative')
assert.equal(attendance.serverDecision.persistBeforeGrant, true, 'attendance decision must be persisted before grant')
assert.equal(attendance.serverDecision.retryReturnsPersistedDecision, true, 'attendance retries must return the persisted decision')
assert.ok(attendance.serverDecision.claimIdempotencyKey, 'attendance claim idempotency key is required')

assert.deepEqual(catalog.excludedEconomyFeatures, ['daily_deal', 'catalog_discount'], 'daily deals and discounts must be excluded')
assertNoRemovedCatalogFields(catalog)

assert.equal(catalog.decorSystemPolicy.officialSystem, 'InteriorDecorRoom', 'InteriorDecorRoom must be the official decor system')
assert.deepEqual(catalog.decorSystemPolicy.testOnlyUnofficialSystems, ['HouseDecorRoom'], 'HouseDecorRoom must be test-only and unofficial')
assert.equal(catalog.decorSystemPolicy.ownership, 'permanent_unique_unlock', 'furniture must permanently unlock')
assert.equal(catalog.decorSystemPolicy.placement, 'unlimited_instances_per_unlocked_item', 'unlocked furniture must support repeated placement')
assert.equal(catalog.decorSystemPolicy.ownershipCollectionAndInviteCounting, 'one_per_unique_item_id', 'ownership/progress/invite counts must be unique-item based')
assert.equal(catalog.decorSystemPolicy.generatedHouseCatalog.itemCount, 8457, 'generated House catalog count changed')
assert.equal(catalog.decorSystemPolicy.generatedHouseCatalog.officialStoreVisible, false, 'generated House items must be hidden from the official store')
assert.equal(catalog.decorSystemPolicy.destructiveDatabaseOrProductIdMergeAllowedNow, false, 'destructive decor-system merging is forbidden in this phase')
assert.equal(catalog.decorSystemPolicy.migrationPhase, 'mapping_plan_only', 'decor migration must remain planning-only')
assert.deepEqual(
  catalog.decorSystemPolicy.futureCategoryMappings.map((mapping) => mapping.houseCategory),
  ['TV', '벽난로', '조명', '문', '펫'],
  'House animation/door/pet category mapping plan changed',
)

assert.equal(catalog.launchWalletPolicy.scalarBalanceDistribution, 'none', 'legacy scalar balance must not be distributed')
assert.equal(catalog.launchWalletPolicy.initializeAllSixVillageWalletsTo, 0, 'all launch wallets must initialize to zero')
assert.equal(catalog.launchWalletPolicy.preserveLegacyScalarData, 'read_only_audit_and_rollback_snapshot', 'legacy balance audit/rollback data must be preserved')
assert.equal(catalog.launchWalletPolicy.resetOwnedItems, false, 'owned items must not be reset by this policy')
assert.equal(catalog.launchWalletPolicy.resetRoomPlacements, false, 'room placements must not be reset by this policy')

const seenIds = new Set()
const paidItems = []
const demand = Object.fromEntries(villages.map((village) => [village, 0]))
const combinationUse = emptyCombinationCounts()
const tierCombinationUse = {}
const groupCombinationUse = Object.fromEntries(catalog.balancePolicy.validatedProductGroups.map((group) => [group, emptyCombinationCounts()]))
const completionRewardIds = new Set()

for (const item of catalog.items) {
  for (const field of requiredFields) {
    assert.ok(Object.hasOwn(item, field), `${item.id ?? '<missing-id>'}: missing ${field}`)
  }
  assert.match(item.id, /^[a-z0-9][a-z0-9_-]*$/, `${item.id}: unstable/unsafe ID format`)
  assert.ok(!seenIds.has(item.id), `${item.id}: duplicate ID`)
  seenIds.add(item.id)

  assert.equal(typeof item.animation, 'boolean', `${item.id}: animation must be boolean`)
  assert.equal(typeof item.starterFree, 'boolean', `${item.id}: starterFree must be boolean`)
  assert.equal(typeof item.existingGameConnected, 'boolean', `${item.id}: existingGameConnected must be boolean`)
  assert.ok(['approved', 'free_customization', 'pending_interior_review'].includes(item.officialStoreStatus), `${item.id}: invalid officialStoreStatus`)
  assert.ok(item.runtimeAsset || item.plannedRuntimeAsset, `${item.id}: runtimeAsset or plannedRuntimeAsset is required`)

  const sourcePath = path.resolve(repositoryRoot, item.sourceAsset)
  assert.ok(
    sourcePath.startsWith(path.join(repositoryRoot, 'assets/Character v.2') + path.sep)
      || sourcePath.startsWith(path.join(repositoryRoot, 'assets/interior full') + path.sep),
    `${item.id}: sourceAsset must stay inside one of the two audited source packs`,
  )
  assert.ok(fs.existsSync(sourcePath), `${item.id}: sourceAsset does not exist: ${item.sourceAsset}`)

  if (item.existingGameConnected && item.runtimeAsset) {
    const runtimePath = path.join(repositoryRoot, 'public', item.runtimeAsset.replace(/^\//, ''))
    assert.ok(fs.existsSync(runtimePath), `${item.id}: connected runtimeAsset does not exist: ${item.runtimeAsset}`)
  }
  if (item.currentCatalog) {
    assert.ok(currentIds[item.currentCatalog], `${item.id}: unknown currentCatalog ${item.currentCatalog}`)
    assert.ok(currentIds[item.currentCatalog].has(item.id), `${item.id}: current product ID was changed or removed from ${item.currentCatalog}`)
  }

  assert.deepEqual(Object.keys(item.cost), villages, `${item.id}: cost must use all six keys in canonical order`)
  for (const village of villages) {
    assert.ok(Number.isInteger(item.cost[village]) && item.cost[village] >= 0, `${item.id}: ${village} cost must be a non-negative integer`)
  }

  const positiveVillages = villages.filter((village) => item.cost[village] > 0)
  const positiveCosts = positiveVillages.map((village) => item.cost[village])
  const totalCost = villages.reduce((sum, village) => sum + item.cost[village], 0)
  assert.equal(item.requiredVillageCount, positiveVillages.length, `${item.id}: requiredVillageCount mismatch`)
  assert.equal(item.estimatedAnnotationCount, totalCost / 5, `${item.id}: estimatedAnnotationCount mismatch`)
  const minimumFresh = villages.reduce((sum, village) => sum + Math.ceil(item.cost[village] / 5), 0)
  assert.equal(item.minimumFreshAnnotationCount, minimumFresh, `${item.id}: minimumFreshAnnotationCount mismatch`)

  if (item.starterFree) {
    assert.equal(totalCost, 0, `${item.id}: starter/free item cannot have a cost`)
    assert.equal(item.requiredVillageCount, 0, `${item.id}: starter/free item cannot require a village wallet`)
    assert.equal(item.officialStoreStatus, 'free_customization', `${item.id}: free item status mismatch`)
    continue
  }

  paidItems.push(item)
  const priceRule = catalog.priceRules[item.priceTier]
  assert.ok(priceRule, `${item.id}: unknown priceTier ${item.priceTier}`)
  assert.equal(totalCost, priceRule.totalCost, `${item.id}: total cost does not match ${item.priceTier}`)

  const isAllVillageClass = item.rarity === 'rare'
    || item.rarity === 'event'
    || item.type === 'pet'
    || item.type === 'theme_set'
    || item.animation
  if (isAllVillageClass) {
    assert.equal(positiveVillages.length, 6, `${item.id}: rare/event/animated/pet/theme-set item must require all six currencies`)
    assert.equal(item.currencyCombination, 'ALL', `${item.id}: six-wallet item must use ALL`)
  } else {
    assert.equal(positiveVillages.length, 4, `${item.id}: general item must require exactly four village currencies`)
    assert.notEqual(item.currencyCombination, 'ALL', `${item.id}: only special classes may use ALL`)
  }

  if (item.priceTier === 'small') {
    assert.deepEqual([...positiveCosts].sort((a, b) => a - b), [3, 4, 4, 4], `${item.id}: small item must use 3/4/4/4`)
    assert.equal(item.minimumFreshAnnotationCount, 4, `${item.id}: small item minimumFreshAnnotationCount must be 4`)
  }

  for (const village of villages) demand[village] += item.cost[village]
  if (item.currencyCombination !== 'ALL') {
    const expected = catalog.currencyCombinations[item.currencyCombination]
    assert.ok(expected, `${item.id}: unknown currencyCombination`)
    assert.deepEqual(positiveVillages, villages.filter((village) => expected.includes(village)), `${item.id}: cost vector does not match combination ${item.currencyCombination}`)
    combinationUse[item.currencyCombination] += 1
    tierCombinationUse[item.priceTier] ??= emptyCombinationCounts()
    tierCombinationUse[item.priceTier][item.currencyCombination] += 1
    if (groupCombinationUse[item.productGroup]) groupCombinationUse[item.productGroup][item.currencyCombination] += 1
  }

  if (item.type === 'theme_set') {
    assert.equal(item.bundlePurchasePolicy.eligibility, 'owned_bundle_item_count_equals_zero', `${item.id}: bundle eligibility changed`)
    assert.equal(item.bundlePurchasePolicy.blockWhenAnyBundleItemOwned, true, `${item.id}: partial-overlap bundle purchase must be blocked`)
    assert.equal(item.bundlePurchasePolicy.showCollectionProgressWhenBlocked, true, `${item.id}: collection progress must be shown when blocked`)
    assert.ok(item.bundleItemIds.length > 0, `${item.id}: bundleItemIds are required`)
    for (const componentId of item.bundleItemIds) assert.ok(catalog.items.some((candidate) => candidate.id === componentId), `${item.id}: unknown bundle component ${componentId}`)
    const reward = item.collectionCompletionReward
    assert.match(reward.rewardId, /^[a-z0-9][a-z0-9_-]*$/, `${item.id}: invalid completion reward ID`)
    assert.ok(!completionRewardIds.has(reward.rewardId), `${item.id}: duplicate completion reward ID`)
    completionRewardIds.add(reward.rewardId)
    assert.match(reward.assetId, /^placeholder_/, `${item.id}: unresolved completion asset must use an explicit placeholder ID`)
    assert.equal(reward.assetSelectionRequired, true, `${item.id}: unresolved completion asset must require selection`)
    assert.equal(reward.trigger, 'individual_item_collection_only', `${item.id}: bulk purchase must not trigger the completion reward`)
    assert.equal(reward.bundlePurchaseEligible, false, `${item.id}: bundle purchase cannot receive the collection reward`)
    assert.equal(reward.storePurchasable, false, `${item.id}: completion reward cannot be sold`)
    assert.equal(reward.grantLimitPerAccount, 1, `${item.id}: completion reward must be account-once`)
    assert.ok(reward.serverIdempotencyKey, `${item.id}: completion reward needs a server idempotency key`)
  }
}

const paidOutfits = paidItems.filter((item) => item.type === 'outfit')
assert.equal(paidOutfits.length, 18, 'all 18 non-basic Character v2 outfits must be paid catalog items')
const clothingDir = path.join(repositoryRoot, 'assets/Character v.2/clothes')
const nonBasicClothingSources = fs.readdirSync(clothingDir)
  .filter((filename) => filename.endsWith('.png') && filename !== 'basic.png')
  .map((filename) => path.join('assets/Character v.2/clothes', filename))
  .sort()
assert.deepEqual(paidOutfits.map((item) => item.sourceAsset).sort(), nonBasicClothingSources, 'paid outfit source coverage must match all 18 non-basic clothing masters')

const houseMappings = catalog.decorSystemPolicy.houseToInteriorReviewMappings
assert.equal(houseMappings.length, 6, 'all selected House animation/door/pet candidates need mappings')
for (const mapping of houseMappings) {
  const item = catalog.items.find((candidate) => candidate.id === mapping.sourceItemId)
  assert.ok(item, `${mapping.sourceItemId}: mapped House item is missing from the catalog`)
  assert.equal(item.currentCatalog, 'house', `${mapping.sourceItemId}: mapping source must be the House catalog`)
  assert.equal(item.officialStoreStatus, 'pending_interior_review', `${mapping.sourceItemId}: House candidate must remain hidden pending review`)
  assert.equal(mapping.targetSystem, 'InteriorDecorRoom', `${mapping.sourceItemId}: mapping target must be the official system`)
  assert.equal(mapping.targetItemId, mapping.sourceItemId, `${mapping.sourceItemId}: mapping must preserve the product ID`)
}

const demandValues = Object.values(demand)
const minimumDemand = Math.min(...demandValues)
const maximumDemand = Math.max(...demandValues)
const demandSpreadPercent = maximumDemand === 0 ? 0 : ((maximumDemand - minimumDemand) / maximumDemand) * 100
assert.ok(demandSpreadPercent <= catalog.balancePolicy.allowedVillageDemandSpreadPercent, `village demand spread ${demandSpreadPercent.toFixed(2)}% exceeds ${catalog.balancePolicy.allowedVillageDemandSpreadPercent}%`)

assert.ok(spread(Object.values(combinationUse)) <= catalog.balancePolicy.allowedCombinationCountSpread, 'overall A-F combinations are not evenly rotated')
for (const [tier, counts] of Object.entries(tierCombinationUse)) {
  assert.ok(spread(Object.values(counts)) <= catalog.balancePolicy.allowedCombinationCountSpread, `${tier}: A-F combinations are not evenly rotated`)
}
for (const [group, counts] of Object.entries(groupCombinationUse)) {
  assert.ok(spread(Object.values(counts)) <= catalog.balancePolicy.allowedCombinationCountSpread, `${group}: A-F combinations are not evenly rotated`)
}

const freeCount = catalog.items.length - paidItems.length
const byTier = paidItems.reduce((counts, item) => {
  counts[item.priceTier] = (counts[item.priceTier] ?? 0) + 1
  return counts
}, {})
const byOfficialStoreStatus = catalog.items.reduce((counts, item) => {
  counts[item.officialStoreStatus] = (counts[item.officialStoreStatus] ?? 0) + 1
  return counts
}, {})

console.log('catalog-v1 validation passed')
console.log(JSON.stringify({
  totalItems: catalog.items.length,
  paidItems: paidItems.length,
  freeCustomizations: freeCount,
  paidOutfits: paidOutfits.length,
  paidItemsByTier: byTier,
  byOfficialStoreStatus,
  combinationUse,
  groupCombinationUse,
  villageDemand: demand,
  demandSpreadPercent: Number(demandSpreadPercent.toFixed(2)),
  attendanceWeeklyTotal: attendance.weeklyTotal,
}, null, 2))
