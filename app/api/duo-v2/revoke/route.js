import { duoResponse, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { closeDuoSession } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['sessionId', 'idempotencyKey'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['sessionId', 'idempotencyKey'])
  if (invalid) return invalid
  const { data, error } = await closeDuoSession(auth.user.id, parsed.body.sessionId, parsed.body.idempotencyKey)
  if (error) return duoStorageFailure('revoke', error)
  return duoResponse(data)
}
