import { duoResponse, duoStorageFailure, readDuoBody, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { normalizeDuoScreen } from '@/lib/duoSessionContract.mjs'
import { heartbeatDuoSession } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const parsed = await readDuoBody(request, ['sessionId', 'clientId', 'screen', 'idempotencyKey'])
  if (parsed.response) return parsed.response
  const invalid = requireDuoUuids(parsed.body, ['sessionId', 'clientId', 'idempotencyKey'])
  if (invalid || !normalizeDuoScreen(parsed.body.screen)) return invalid || duoResponse({ ok:false, code:'invalid_request' })
  const { data, error } = await heartbeatDuoSession(auth.user.id, parsed.body.sessionId, parsed.body.clientId, parsed.body.screen, parsed.body.idempotencyKey)
  if (error) return duoStorageFailure('heartbeat', error)
  return duoResponse(data)
}
