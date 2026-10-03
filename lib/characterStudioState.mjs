export const DEFAULT_CHARACTER_LOADOUT = Object.freeze({
  skinId: 'skin_01',
  eyesId: 'eyes_green_light',
  hairStyleId: 'hair_buzzcut',
  hairColorId: 'black',
  outfitId: 'basic',
  accessoryId: null,
})

const SLOT_KEYS = Object.freeze({
  skin:'skinId',
  eyes:'eyesId',
  hairStyle:'hairStyleId',
  hairColor:'hairColorId',
  outfit:'outfitId',
  accessory:'accessoryId',
})

export function normalizeCharacterLoadout(loadout) {
  return {
    skinId: loadout?.skinId || DEFAULT_CHARACTER_LOADOUT.skinId,
    eyesId: loadout?.eyesId || DEFAULT_CHARACTER_LOADOUT.eyesId,
    hairStyleId: loadout?.hairStyleId || DEFAULT_CHARACTER_LOADOUT.hairStyleId,
    hairColorId: loadout?.hairColorId || DEFAULT_CHARACTER_LOADOUT.hairColorId,
    outfitId: loadout?.outfitId || DEFAULT_CHARACTER_LOADOUT.outfitId,
    accessoryId: loadout?.accessoryId || null,
  }
}

export function previewCharacterItem(savedLoadout, previewLoadout, slot, itemId) {
  const saved = normalizeCharacterLoadout(savedLoadout)
  const key = SLOT_KEYS[slot]
  if (!key) throw new TypeError(`Unknown character loadout slot: ${slot}`)
  return {
    ...saved,
    ...(previewLoadout || {}),
    [key]: itemId,
  }
}

export function effectiveCharacterLoadout(savedLoadout, previewLoadout) {
  return normalizeCharacterLoadout(previewLoadout || savedLoadout)
}

export function characterLoadoutsEqual(left, right) {
  const a = normalizeCharacterLoadout(left)
  const b = normalizeCharacterLoadout(right)
  return Object.values(SLOT_KEYS).every((key) => a[key] === b[key])
}

export function characterStudioAction({ owned, equipped }) {
  if (equipped) return 'equipped'
  return owned ? 'equip' : 'purchase'
}

export function applyQaCharacterPurchase(state, item) {
  const shortages = Object.entries(item.cost || {}).filter(([village, amount]) => Number(state.balances[village] || 0) < Number(amount || 0))
  if (shortages.length > 0) return { ok:false, code:'insufficient_funds', retryable:false, state }
  const balances = { ...state.balances }
  for (const [village, amount] of Object.entries(item.cost || {})) balances[village] = Number(balances[village] || 0) - Number(amount || 0)
  const loadout = {
    ...normalizeCharacterLoadout(state.savedLoadout),
    [item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId']: item.id,
  }
  return {
    ok:true,
    state:{ ...state, balances, ownedItemIds:[...new Set([...state.ownedItemIds, item.id])], savedLoadout:loadout },
    loadout,
  }
}

export function applyQaCharacterEquip(state, slot, itemId) {
  if (itemId !== null && itemId !== 'basic' && !state.ownedItemIds.includes(itemId)) {
    return { ok:false, code:'item_not_owned', retryable:false, state }
  }
  const loadout = {
    ...normalizeCharacterLoadout(state.savedLoadout),
    [SLOT_KEYS[slot]]: itemId,
  }
  return { ok:true, state:{ ...state, savedLoadout:loadout }, loadout }
}

export function applyQaCharacterIdentity(state, loadout) {
  const normalized = normalizeCharacterLoadout(loadout)
  const savedLoadout = {
    ...normalizeCharacterLoadout(state.savedLoadout),
    skinId:normalized.skinId,
    eyesId:normalized.eyesId,
    hairStyleId:normalized.hairStyleId,
    hairColorId:normalized.hairColorId,
  }
  return { ok:true, state:{ ...state, savedLoadout }, loadout:savedLoadout }
}
