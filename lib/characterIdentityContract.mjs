import { CHARACTER_IDENTITY_CATALOG } from './generated/characterIdentityCatalog.mjs'
import { normalizeCharacterLoadout } from './characterStudioState.mjs'

export const CHARACTER_IDENTITY_CATALOG_VERSION = CHARACTER_IDENTITY_CATALOG.version

const allowed = Object.freeze({
  skinId:new Set(CHARACTER_IDENTITY_CATALOG.skins.filter((item) => item.available).map((item) => item.id)),
  eyesId:new Set(CHARACTER_IDENTITY_CATALOG.eyes.filter((item) => item.available).map((item) => item.id)),
  hairStyleId:new Set(CHARACTER_IDENTITY_CATALOG.hairStyles.filter((item) => item.available).map((item) => item.id)),
  hairColorId:new Set(CHARACTER_IDENTITY_CATALOG.hairColors.filter((item) => item.available).map((item) => item.id)),
})

export const CHARACTER_IDENTITY_FIELDS = Object.freeze(Object.keys(allowed))
export const COMPLETE_CHARACTER_LOADOUT_FIELDS = Object.freeze([
  ...CHARACTER_IDENTITY_FIELDS,
  'outfitId',
  'accessoryId',
])

export function validateCharacterIdentity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok:false, code:'invalid_request' }
  for (const field of CHARACTER_IDENTITY_FIELDS) {
    if (typeof input[field] !== 'string' || !allowed[field].has(input[field])) {
      return { ok:false, code:`invalid_${field.replace(/Id$/, '').replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_id` }
    }
  }
  return {
    ok:true,
    identity:Object.fromEntries(CHARACTER_IDENTITY_FIELDS.map((field) => [field, input[field]])),
  }
}

export function hasCompleteCharacterLoadout(loadout) {
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) return false
  if (!COMPLETE_CHARACTER_LOADOUT_FIELDS.every((field) => Object.hasOwn(loadout, field))) return false
  if (loadout.accessoryId !== null && typeof loadout.accessoryId !== 'string') return false
  if (typeof loadout.outfitId !== 'string' || !loadout.outfitId) return false
  return validateCharacterIdentity(loadout).ok
}

export function identityRequestFromLoadout(loadout) {
  const normalized = normalizeCharacterLoadout(loadout)
  return Object.fromEntries(CHARACTER_IDENTITY_FIELDS.map((field) => [field, normalized[field]]))
}

export const __testing = Object.freeze({
  allowed:Object.freeze(Object.fromEntries(Object.entries(allowed).map(([key, values]) => [key, Object.freeze([...values])]))),
})
