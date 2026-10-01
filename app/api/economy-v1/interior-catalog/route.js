import { NextResponse } from 'next/server'
import {
  ECONOMY_CATALOG_VERSION,
  getInteriorShopItems,
  getInteriorStarterItems,
  getInteriorThemeSets,
} from '@/lib/economyCatalogV1.server'
import { requireEnabledEconomyUser } from '@/lib/economyApi.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  return NextResponse.json({
    ok:true,
    code:'success',
    economyMode:auth.mode,
    economyVersion:ECONOMY_CATALOG_VERSION,
    items:getInteriorShopItems(),
    sets:getInteriorThemeSets(),
    starters:getInteriorStarterItems(),
  }, { headers:{ 'Cache-Control':'private, no-store' } })
}
