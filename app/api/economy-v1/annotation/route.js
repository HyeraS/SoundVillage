import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { resolveMultiVillageSound, submitMultiVillageAnnotation } from '@/lib/multiVillageEconomy.server'

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  if (auth.mode !== 'cutover') return NextResponse.json({ ok:false, code:'cutover_required' }, { status:403 })
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  const allowed = new Set(['idempotencyKey','soundId','expressionText','selectedFeatures','confidence','difficulty','playCount','listeningTimeSec','isSkipped','skipReason','stage','version'])
  if (!parsed.body || Object.keys(parsed.body).some((key) => !allowed.has(key))) {
    return NextResponse.json({ ok:false, code:'invalid_request' }, { status:400 })
  }
  const sound = await resolveMultiVillageSound(parsed.body.soundId)
  if (sound.error) return economyStorageFailure('annotation-sound', sound.error)
  if (!sound.data) return NextResponse.json({ ok:false, code:'invalid_sound' }, { status:404 })
  const input = { ...parsed.body, zone:sound.data.zone, deviceInfo: request.headers.get('user-agent') || '' }
  const { data, error } = await submitMultiVillageAnnotation(auth.user.id, input)
  if (error) return economyStorageFailure('annotation', error)
  return economyResultResponse(data)
}
