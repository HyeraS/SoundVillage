import {
  CHARACTER_IDENTITY_CATALOG,
  CHARACTER_STUDIO_ITEMS as GENERATED_CHARACTER_STUDIO_ITEMS,
} from '@/lib/generated/characterIdentityCatalog.mjs'

export const BASIC_CHARACTER_ITEM = Object.freeze({
  id: 'basic',
  name: '기본 의상',
  type: 'outfit',
  productGroup: 'outfit',
  runtimeAsset: '/assets/world/player_clothes.png',
  previewAsset: null,
  cost: Object.freeze({}),
  starterFree: true,
})

// The checked-in Economy V1 catalog remains the single source of truth for
// the 18 paid outfits and 8 accessories. QA projects that exact public shape
// locally instead of calling a production API.
export const CHARACTER_STUDIO_ITEMS = GENERATED_CHARACTER_STUDIO_ITEMS
export { CHARACTER_IDENTITY_CATALOG }

export const CHARACTER_STUDIO_OUTFITS = Object.freeze(
  CHARACTER_STUDIO_ITEMS.filter((item) => item.productGroup === 'outfit'),
)

export const CHARACTER_STUDIO_ACCESSORIES = Object.freeze(
  CHARACTER_STUDIO_ITEMS.filter((item) => item.productGroup === 'accessory'),
)
