import { duoResponseWithRealtime, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { createOrRotateDuoSession, deriveDuoJoinToken, hashDuoJoinToken } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['clientId', 'idempotencyKey'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['clientId', 'idempotencyKey'])
  if (invalid) return invalid
  let inviteToken
  try {
    inviteToken = deriveDuoJoinToken(auth.user.id, parsed.body.idempotencyKey)
  } catch (error) {
    return duoStorageFailure('host-secret', error)
  }
  const { data, error } = await createOrRotateDuoSession(
    auth.user.id,
    parsed.body.clientId,
    hashDuoJoinToken(inviteToken),
    parsed.body.idempotencyKey,
    auth.mode === 'cutover' ? 'economy_v1' : 'legacy',
  )
  if (error) return duoStorageFailure('host', error)
  return duoResponseWithRealtime(data, auth.user.id, parsed.body.clientId, data?.ok ? { inviteToken } : {})
}
