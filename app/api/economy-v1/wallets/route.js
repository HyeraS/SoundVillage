import { NextResponse } from 'next/server'
import { economyStorageFailure, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { getMultiVillageWallets } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response

  const { data, error } = await getMultiVillageWallets(auth.user.id)
  if (error) return economyStorageFailure('wallets', error)
  if (!data?.ok) {
    return NextResponse.json({ ...data, code: data?.reason || 'participant_inactive' }, { status: 403 })
  }
  return NextResponse.json({ ...data, code: 'success' })
}
