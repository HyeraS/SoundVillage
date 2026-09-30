import { NextResponse } from 'next/server'
import { getCharacterShopItems, ECONOMY_CATALOG_VERSION } from '@/lib/economyCatalogV1.server'
import { requireEnabledEconomyUser } from '@/lib/economyApi.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const items = getCharacterShopItems()
  return NextResponse.json({
    ok: true,
    code: 'success',
    economyVersion: ECONOMY_CATALOG_VERSION,
    economyMode: auth.mode,
    items,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
