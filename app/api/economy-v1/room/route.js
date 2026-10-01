import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { getEconomyInteriorRoom, saveEconomyInteriorRoom } from '@/lib/economyInteriorRoom.server'

export const dynamic = 'force-dynamic'

function cutoverOnly(auth) {
  return auth.mode === 'cutover' ? null : NextResponse.json({ ok:false, code:'feature_disabled' }, { status:404 })
}
export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const blocked = cutoverOnly(auth)
  if (blocked) return blocked
  const { data, error } = await getEconomyInteriorRoom(auth.user.id)
  if (error) return economyStorageFailure('interior-room-get', error)
  return economyResultResponse(data)
}

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const blocked = cutoverOnly(auth)
  if (blocked) return blocked
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  if (!parsed.body || Object.keys(parsed.body).some((key) => !['room','expectedRevision','idempotencyKey'].includes(key))
    || !Number.isSafeInteger(parsed.body.expectedRevision) || parsed.body.expectedRevision < 0) {
    return NextResponse.json({ ok:false, code:'invalid_request' }, { status:400 })
  }
  const { data, error } = await saveEconomyInteriorRoom(
    auth.user.id,
    parsed.body.room,
    parsed.body.expectedRevision,
    parsed.idempotencyKey,
  )
  if (error) return economyStorageFailure('interior-room-save', error)
  return economyResultResponse(data)
}
