import 'server-only'

import catalog from '@/data/economy/catalog-v1.json'
import { makeCatalogIndex, resolveCatalogPurchase, validateEconomyCatalogV1 } from '@/lib/economyCatalogContract.mjs'
import { getInteriorItem, INTERIOR_STARTER_IDS } from '@/lib/interiorCatalog'

const validatedCatalog = validateEconomyCatalogV1(catalog)
const itemIndex = makeCatalogIndex(validatedCatalog)
const CHARACTER_GROUPS = new Set(['outfit', 'accessory'])
const INTERIOR_GROUP = 'interior'
const INTERIOR_SET_GROUP = 'theme_set'
const CHARACTER_SHOP_FIELDS = Object.freeze([
  'id',
  'name',
  'type',
  'productGroup',
  'runtimeAsset',
  'previewAsset',
  'rarity',
  'priceTier',
  'cost',
  'requiredVillageCount',
  'estimatedAnnotationCount',
  'minimumFreshAnnotationCount',
  'currencyCombination',
])

function publicCharacterItem(item) {
  return Object.fromEntries(CHARACTER_SHOP_FIELDS
    .filter((field) => item[field] !== undefined)
    .map((field) => [field, field === 'cost' ? { ...item.cost } : item[field]]))
}

const INTERIOR_SHOP_FIELDS = Object.freeze([
  'id', 'name', 'type', 'productGroup', 'runtimeAsset', 'rarity', 'priceTier',
  'cost', 'requiredVillageCount', 'estimatedAnnotationCount',
  'minimumFreshAnnotationCount', 'currencyCombination',
])
const INTERIOR_RENDER_FIELDS = Object.freeze([
  'cat', 'kind', 'layer', 'src', 'fw', 'fh', 'nw', 'nh', 'limited', 'starter',
])

function publicInteriorItem(item) {
  const render = getInteriorItem(item.id)
  if (!render) return null
  return Object.fromEntries([
    ...INTERIOR_SHOP_FIELDS
      .filter((field) => item[field] !== undefined)
      .map((field) => [field, field === 'cost' ? { ...item.cost } : item[field]]),
    ...INTERIOR_RENDER_FIELDS
      .filter((field) => render[field] !== undefined)
      .map((field) => [field, render[field]]),
  ])
}

function publicInteriorSet(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    productGroup: item.productGroup,
    rarity: item.rarity,
    priceTier: item.priceTier,
    cost: { ...item.cost },
    requiredVillageCount: item.requiredVillageCount,
    estimatedAnnotationCount: item.estimatedAnnotationCount,
    minimumFreshAnnotationCount: item.minimumFreshAnnotationCount,
    currencyCombination: item.currencyCombination,
    bundleItemIds: [...item.bundleItemIds],
  }
}

export function getEconomyCatalogItem(itemId) {
  return itemIndex.get(itemId) || null
}

export function resolveEconomyPurchase(itemId) {
  return resolveCatalogPurchase(validatedCatalog, itemIndex, itemId)
}

export function getCharacterShopItems() {
  return validatedCatalog.items
    .filter((item) => CHARACTER_GROUPS.has(item.productGroup))
    .filter((item) => item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
    .map(publicCharacterItem)
}

export function getCharacterRuntimeItems() {
  return validatedCatalog.items
    .filter((item) => CHARACTER_GROUPS.has(item.productGroup) && item.existingGameConnected === true)
    .map(publicCharacterItem)
}

export function getInteriorShopItems() {
  return validatedCatalog.items
    .filter((item) => item.productGroup === INTERIOR_GROUP)
    .filter((item) => item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
    .map(publicInteriorItem)
    .filter(Boolean)
}

export function getInteriorThemeSets() {
  return validatedCatalog.items
    .filter((item) => item.productGroup === INTERIOR_SET_GROUP && item.type === 'theme_set')
    .filter((item) => item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
    .map(publicInteriorSet)
}

export function getInteriorStarterItems() {
  return INTERIOR_STARTER_IDS.map((itemId) => itemIndex.get(itemId))
    .filter((item) => item?.starterFree === true
      && item.officialStoreStatus === 'free_customization'
      && item.existingGameConnected === true)
    .map(publicInteriorItem)
    .filter(Boolean)
}

export function resolveInteriorRuntimeItem(itemId) {
  const item = itemIndex.get(itemId) || null
  const render = getInteriorItem(itemId)
  const isStarter = INTERIOR_STARTER_IDS.includes(itemId)
  const approvedPaid = item?.productGroup === INTERIOR_GROUP && item?.officialStoreStatus === 'approved'
  const approvedStarter = isStarter && item?.starterFree === true && item?.officialStoreStatus === 'free_customization'
  if (!item || !render || item.existingGameConnected !== true || (!approvedPaid && !approvedStarter)) {
    return { ok:false, reason:'unknown_item' }
  }
  return { ok:true, item, render, starter:isStarter }
}

export function getInteriorRuntimeItemIds() {
  return [...getInteriorStarterItems(), ...getInteriorShopItems()].map((item) => item.id)
}

export function resolveCharacterRuntimeItem(itemId) {
  if (itemId === 'basic') return { ok: true, item: { id: 'basic', type: 'outfit', approved: true } }
  const item = itemIndex.get(itemId) || null
  if (!item || !CHARACTER_GROUPS.has(item.productGroup) || item.existingGameConnected !== true || !item.runtimeAsset) {
    return { ok: false, reason: 'unknown_item' }
  }
  return { ok: true, item: { id: item.id, type: item.productGroup, approved: true } }
}

export function resolveCharacterEquipItem(itemId) {
  if (itemId === 'basic') return { ok: true, item: { id: 'basic', type: 'outfit', approved: true } }
  const item = itemIndex.get(itemId) || null
  if (!item || !CHARACTER_GROUPS.has(item.productGroup)) return { ok: false, reason: 'unknown_item' }
  if (item.officialStoreStatus !== 'approved' || item.existingGameConnected !== true) {
    return { ok: false, reason: 'official_store_unapproved' }
  }
  return { ok: true, item: { id: item.id, type: item.productGroup, approved: true } }
}

export const ECONOMY_CATALOG_SCHEMA_VERSION = validatedCatalog.schemaVersion
export const ECONOMY_CATALOG_VERSION = `${validatedCatalog.catalogId}:${validatedCatalog.schemaVersion}`
