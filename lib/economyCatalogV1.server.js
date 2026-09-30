import 'server-only'

import catalog from '@/data/economy/catalog-v1.json'
import { makeCatalogIndex, resolveCatalogPurchase, validateEconomyCatalogV1 } from '@/lib/economyCatalogContract.mjs'

const validatedCatalog = validateEconomyCatalogV1(catalog)
const itemIndex = makeCatalogIndex(validatedCatalog)
const CHARACTER_GROUPS = new Set(['outfit', 'accessory'])
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
