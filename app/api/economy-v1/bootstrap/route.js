import { NextResponse } from 'next/server'
import {
  ECONOMY_CATALOG_VERSION,
  getCharacterRuntimeItems,
  getCharacterShopItems,
  getInteriorShopItems,
  getInteriorStarterItems,
  getInteriorThemeSets,
} from '@/lib/economyCatalogV1.server'
import { economyStorageFailure, requireEconomyUser } from '@/lib/economyApi.server'
import { getEconomyRuntimeMode } from '@/lib/economyRuntime.server'
import { getMultiVillageRuntimeState } from '@/lib/multiVillageEconomy.server'
import { CHARACTER_IDENTITY_CATALOG_VERSION, hasCompleteCharacterLoadout } from '@/lib/characterIdentityContract.mjs'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEconomyUser(request)
  if (auth.response) return auth.response

  const economyMode = getEconomyRuntimeMode()
  if (!economyMode) {
    return NextResponse.json({ ok: false, code: 'unsafe_economy_mode' }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
  // The main runtime only needs the server-owned mode in legacy/preview.
  // Preview data is deliberately consumed through the authenticated internal
  // preview APIs, so merely visiting the main runtime cannot create wallets.
  if (economyMode === 'legacy' || economyMode === 'preview' || economyMode === 'maintenance') {
    return NextResponse.json({
      ok: true,
      code: 'success',
      economyMode,
      catalogVersion: ECONOMY_CATALOG_VERSION,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  let state
  try {
    state = await getMultiVillageRuntimeState(auth.user.id)
  } catch (error) {
    return economyStorageFailure('bootstrap-config', error)
  }
  if (state.profile.error) return economyStorageFailure('bootstrap-profile', state.profile.error)
  if (state.attendance.error) return economyStorageFailure('bootstrap-attendance', state.attendance.error)
  if (!state.profile.data?.ok || !state.attendance.data?.ok) {
    const result = state.profile.data?.ok ? state.attendance.data : state.profile.data
    return NextResponse.json({ ...result, code: result?.reason || 'participant_inactive' }, { status: 403 })
  }

  const items = getCharacterShopItems()
  const runtimeItems = getCharacterRuntimeItems()
  const interiorItems = getInteriorShopItems()
  const interiorSets = getInteriorThemeSets()
  const interiorStarters = getInteriorStarterItems()
  return NextResponse.json({
    ok: true,
    code: 'success',
    economyMode,
    catalogVersion: ECONOMY_CATALOG_VERSION,
    identityCatalogVersion: CHARACTER_IDENTITY_CATALOG_VERSION,
    capabilities: {
      characterIdentityCustomization:hasCompleteCharacterLoadout(state.profile.data.loadout),
    },
    items,
    runtimeItems,
    interiorItems,
    interiorSets,
    interiorStarters,
    profile: {
      ...state.profile.data,
      // Keep discontinued and unknown ownership visible for audit. Rendering
      // resolves known retained assets and safely falls back for missing ones.
      ownedItemIds: state.profile.data.ownedItemIds || [],
    },
    attendance: state.attendance.data,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
