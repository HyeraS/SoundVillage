import { duoResponse, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { leaveDuoSession } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['sessionId', 'clientId', 'idempotencyKey'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['sessionId', 'clientId', 'idempotencyKey'])
  if (invalid) return invalid
  const { data, error } = await leaveDuoSession(auth.user.id, parsed.body.sessionId, parsed.body.clientId, parsed.body.idempotencyKey)
  if (error) return duoStorageFailure('leave', error)
  return duoResponse(data)
}
