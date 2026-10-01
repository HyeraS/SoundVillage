import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { getEconomyInteriorSharedRoom } from '@/lib/economyInteriorRoom.server'
import { UUID_PATTERN } from '@/lib/multiVillageEconomyCore.mjs'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  if (auth.mode !== 'cutover') return NextResponse.json({ ok:false, code:'feature_disabled' }, { status:404 })
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!UUID_PATTERN.test(token)) return NextResponse.json({ ok:false, code:'invalid_share_token' }, { status:400 })
  const { data, error } = await getEconomyInteriorSharedRoom(auth.user.id, token)
  if (error) return economyStorageFailure('interior-shared-room', error)
  return economyResultResponse(data)
}
