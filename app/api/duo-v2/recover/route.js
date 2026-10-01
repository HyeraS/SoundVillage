import { duoResponseWithRealtime, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { recoverDuoSession } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['sessionId', 'clientId'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['sessionId', 'clientId'])
  if (invalid) return invalid
  const { data, error } = await recoverDuoSession(auth.user.id, parsed.body.sessionId, parsed.body.clientId)
  if (error) return duoStorageFailure('recover', error)
  return duoResponseWithRealtime(data, auth.user.id, parsed.body.clientId)
}
