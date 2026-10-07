import { duoResponse, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { isJoinToken } from '@/lib/duoSessionContract.mjs'
import { hashDuoJoinToken, joinDuoSession } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['inviteToken', 'clientId', 'idempotencyKey'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['clientId', 'idempotencyKey'])
  if (invalid) return invalid
  if (!isJoinToken(parsed.body.inviteToken)) return duoResponse({ ok:false, code:'invalid_invite' })
  const { data, error } = await joinDuoSession(
    auth.user.id,
    parsed.body.clientId,
    hashDuoJoinToken(parsed.body.inviteToken),
    parsed.body.idempotencyKey,
  )
  if (error) return duoStorageFailure('join', error)
  return duoResponse(data)
}
