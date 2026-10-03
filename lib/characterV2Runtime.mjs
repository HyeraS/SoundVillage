import { CHARACTER_IDENTITY_CATALOG } from './generated/characterIdentityCatalog.mjs'
import { DEFAULT_CHARACTER_LOADOUT, normalizeCharacterLoadout } from './characterStudioState.mjs'

const skinMap = new Map(CHARACTER_IDENTITY_CATALOG.skins.map((item) => [item.id, item]))
const eyeMap = new Map(CHARACTER_IDENTITY_CATALOG.eyes.map((item) => [item.id, item]))
const hairStyleMap = new Map(CHARACTER_IDENTITY_CATALOG.hairStyles.map((item) => [item.id, item]))
const hairColorIds = new Set(CHARACTER_IDENTITY_CATALOG.hairColors.map((item) => item.id))
const skirtOutfitIds = new Set(CHARACTER_IDENTITY_CATALOG.skirtVariantOutfitIds)

function invalid(message, strict) {
  if (strict) throw new RangeError(message)
  return normalizeCharacterLoadout(DEFAULT_CHARACTER_LOADOUT)
}

export function hairRuntimeAsset(hairStyleId, hairColorId, outfitId = 'basic') {
  const style = hairStyleMap.get(hairStyleId)
  if (!style || !hairColorIds.has(hairColorId)) return null
  const colorSlug = hairColorId.replaceAll('_', '-')
  // The pack's *_skirt masters preserve the same 32px alpha anchors and only
  // adjust lower hair pixels for the skirt animation. They are replacement
  // front-hair sheets, not a separate behind-body layer.
  const skirtSuffix = style.hasSkirtVariant && skirtOutfitIds.has(outfitId) ? '-skirt' : ''
  return `/assets/character-v2/hair/${style.slug}/${colorSlug}${skirtSuffix}-walk.png`
}

export function resolveCharacterIdentityAssets(loadout, { strict = process.env.NODE_ENV !== 'production' } = {}) {
  let normalized = normalizeCharacterLoadout(loadout)
  const valid = skinMap.has(normalized.skinId)
    && eyeMap.has(normalized.eyesId)
    && hairStyleMap.has(normalized.hairStyleId)
    && hairColorIds.has(normalized.hairColorId)
  if (!valid) normalized = invalid(`Unsupported Character V2 loadout: ${JSON.stringify(normalized)}`, strict)
  const skin = skinMap.get(normalized.skinId)
  const eyes = eyeMap.get(normalized.eyesId)
  const hairAsset = hairRuntimeAsset(normalized.hairStyleId, normalized.hairColorId, normalized.outfitId)
  if (!skin || !eyes || !hairAsset) {
    normalized = invalid('Character V2 runtime asset resolver failed', strict)
    return resolveCharacterIdentityAssets(normalized, { strict:true })
  }
  return {
    loadout:normalized,
    skinAsset:skin.runtimeAsset,
    // The source skin sheets already contain the historical green-light eye
    // pixels. Omitting only this default overlay keeps the old character
    // pixel-identical; every other catalog eye color replaces those pixels.
    eyesAsset:normalized.eyesId === DEFAULT_CHARACTER_LOADOUT.eyesId ? null : eyes.runtimeAsset,
    hairAsset,
  }
}

export { CHARACTER_IDENTITY_CATALOG }
