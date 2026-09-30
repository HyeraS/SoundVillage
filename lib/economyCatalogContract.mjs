import { VILLAGES } from './multiVillageEconomyCore.mjs'

const ALLOWED_STATUS = new Set(['approved', 'free_customization', 'pending_interior_review'])

export function validateEconomyCatalogV1(catalog) {
  const errors = []
  if (catalog?.schemaVersion !== '1.1.0') errors.push('schemaVersion must be 1.1.0')
  if (JSON.stringify(catalog?.currencyOrder) !== JSON.stringify(VILLAGES)) errors.push('currencyOrder must use the canonical six-village order')
  if (!Array.isArray(catalog?.items)) errors.push('items must be an array')

  const ids = new Set()
  for (const item of catalog?.items || []) {
    const label = item?.id || '<missing-id>'
    if (!item?.id || ids.has(item.id)) errors.push(`${label}: missing or duplicate id`)
    ids.add(item?.id)
    if (!ALLOWED_STATUS.has(item?.officialStoreStatus)) errors.push(`${label}: invalid officialStoreStatus`)
    if (!item?.cost || JSON.stringify(Object.keys(item.cost)) !== JSON.stringify(VILLAGES)) {
      errors.push(`${label}: cost must contain exactly the six canonical keys in order`)
    } else if (VILLAGES.some((village) => !Number.isInteger(item.cost[village]) || item.cost[village] < 0)) {
      errors.push(`${label}: cost values must be non-negative integers`)
    }
    if (item?.type === 'theme_set') {
      if (!Array.isArray(item.bundleItemIds) || item.bundleItemIds.length === 0) errors.push(`${label}: bundleItemIds are required`)
      if (item.collectionCompletionReward?.assetSelectionRequired !== true) errors.push(`${label}: completion reward must remain asset-selection gated`)
    }
  }
  for (const item of catalog?.items || []) {
    for (const componentId of item.bundleItemIds || []) {
      if (!ids.has(componentId)) errors.push(`${item.id}: unknown bundle component ${componentId}`)
    }
  }
  if (errors.length > 0) throw new Error(`Invalid economy catalog v1:\n- ${errors.join('\n- ')}`)
  return catalog
}

export function makeCatalogIndex(catalog) {
  validateEconomyCatalogV1(catalog)
  return new Map(catalog.items.map((item) => [item.id, Object.freeze({ ...item, cost: Object.freeze({ ...item.cost }) })]))
}

export function resolveCatalogPurchase(catalog, itemIndex, itemId) {
  const item = itemIndex.get(itemId) || null
  if (!item) return { ok: false, reason: 'unknown_item' }
  if (item.officialStoreStatus !== 'approved') return { ok: false, reason: 'official_store_unapproved' }
  if (item.starterFree || Object.values(item.cost).every((amount) => amount === 0)) {
    return { ok: false, reason: 'official_store_unapproved' }
  }
  const isBundle = item.type === 'theme_set'
  const completionCandidates = isBundle ? [] : catalog.items
    .filter((candidate) => candidate.type === 'theme_set' && candidate.bundleItemIds.includes(item.id))
    .map((candidate) => ({
      setId: candidate.id,
      bundleItemIds: [...candidate.bundleItemIds],
      ...candidate.collectionCompletionReward,
    }))
  return {
    ok: true,
    product: {
      id: item.id,
      type: item.type,
      productGroup: item.productGroup,
      cost: { ...item.cost },
      isBundle,
      grantItemIds: isBundle ? [...item.bundleItemIds] : [item.id],
      completionCandidates,
    },
  }
}
