export const QA_SHOP_FIXTURE = Object.freeze({
  balance:100,
  ownedOutfits:Object.freeze(['overalls']),
  equipped:'basic',
  totalEarned:80,
})

const SHOP_FIELD_LOADERS = Object.freeze({
  balance:'getCurrencyBalance',
  ownedOutfits:'getOwnedOutfits',
  equipped:'getEquippedOutfit',
  totalEarned:'getTotalEarned',
})

export async function loadShopSnapshot(loaders) {
  const fields = Object.keys(SHOP_FIELD_LOADERS)
  const settled = await Promise.allSettled(fields.map((field) => loaders[SHOP_FIELD_LOADERS[field]]()))
  const data = {}
  const failedFields = []
  settled.forEach((result, index) => {
    const field = fields[index]
    if (result.status === 'fulfilled') data[field] = result.value
    else failedFields.push(field)
  })
  return { ok:failedFields.length === 0, data, failedFields }
}

export function buyQaOutfit(snapshot, outfitId, price) {
  if (snapshot.ownedOutfits.includes(outfitId) || snapshot.balance < price) return snapshot
  return {
    ...snapshot,
    balance:snapshot.balance - price,
    ownedOutfits:[...snapshot.ownedOutfits, outfitId],
    equipped:outfitId,
  }
}

export function equipQaOutfit(snapshot, outfitId) {
  if (outfitId !== 'basic' && !snapshot.ownedOutfits.includes(outfitId)) return snapshot
  return { ...snapshot, equipped:outfitId }
}
