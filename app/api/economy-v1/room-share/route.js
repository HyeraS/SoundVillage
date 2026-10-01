import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { getOrCreateEconomyInteriorRoomShare } from '@/lib/economyInteriorRoom.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  if (auth.mode !== 'cutover') return NextResponse.json({ ok:false, code:'feature_disabled' }, { status:404 })
  const { data, error } = await getOrCreateEconomyInteriorRoomShare(auth.user.id)
  if (error) return economyStorageFailure('interior-room-share', error)
  return economyResultResponse(data)
}
