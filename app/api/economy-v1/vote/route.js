import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { resolveMultiVillageSound, submitMultiVillageVote } from '@/lib/multiVillageEconomy.server'

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  if (auth.mode !== 'cutover') return NextResponse.json({ ok:false, code:'cutover_required' }, { status:403 })
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  const allowed = new Set(['idempotencyKey','soundId','annotationId','confidence','playCount','listeningTimeSec','stage','version'])
  if (!parsed.body || Object.keys(parsed.body).some((key) => !allowed.has(key))) {
    return NextResponse.json({ ok:false, code:'invalid_request' }, { status:400 })
  }
  const sound = await resolveMultiVillageSound(parsed.body.soundId)
  if (sound.error) return economyStorageFailure('vote-sound', sound.error)
  if (!sound.data) return NextResponse.json({ ok:false, code:'invalid_sound' }, { status:404 })
  const { data, error } = await submitMultiVillageVote(auth.user.id, { ...parsed.body, zone:sound.data.zone })
  if (error) return economyStorageFailure('vote', error)
  return economyResultResponse(data)
}
