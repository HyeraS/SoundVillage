import { NextResponse } from 'next/server'
import { ECONOMY_CATALOG_VERSION, getCharacterShopItems } from '@/lib/economyCatalogV1.server'
import { economyStorageFailure, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { getMultiVillageCharacterProfile } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response

  const { data, error } = await getMultiVillageCharacterProfile(auth.user.id)
  if (error) return economyStorageFailure('character-profile', error)
  if (!data?.ok) {
    return NextResponse.json({ ...data, code: data?.reason || 'participant_inactive' }, { status: 403 })
  }
  const characterItemIds = new Set(getCharacterShopItems().map((item) => item.id))
  const ownedItemIds = (data.ownedItemIds || []).filter((itemId) => characterItemIds.has(itemId))
  return NextResponse.json({ ...data, ownedItemIds, code: 'success', economyVersion: ECONOMY_CATALOG_VERSION }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
