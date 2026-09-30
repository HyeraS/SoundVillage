import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { claimMultiVillageAttendance, getMultiVillageAttendanceStatus } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  try {
    const { data, error } = await getMultiVillageAttendanceStatus(auth.user.id)
    if (error) return economyStorageFailure('attendance-status', error)
    return economyResultResponse(data)
  } catch (error) {
    return economyStorageFailure('attendance-status-config', error)
  }
}

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  if (!parsed.body || Object.keys(parsed.body).some((key) => key !== 'idempotencyKey')) {
    return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 })
  }
  try {
    const { data, error } = await claimMultiVillageAttendance(auth.user.id, parsed.idempotencyKey)
    if (error) return economyStorageFailure('attendance-claim', error)
    return economyResultResponse(data)
  } catch (error) {
    return economyStorageFailure('attendance-claim-config', error)
  }
}
