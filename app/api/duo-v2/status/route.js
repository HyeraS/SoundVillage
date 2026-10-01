import { duoResponse, duoResponseWithRealtime, duoStorageFailure, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { getDuoSessionStatus } from '@/lib/duoSession.server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const url = new URL(request.url)
  if ([...url.searchParams.keys()].some((key) => !['sessionId', 'clientId'].includes(key))) {
    return duoResponse({ ok:false, code:'invalid_request' })
  }
  const body = { sessionId:url.searchParams.get('sessionId'), clientId:url.searchParams.get('clientId') }
  const invalid = requireDuoUuids(body, ['sessionId', 'clientId'])
  if (invalid) return invalid
  const { data, error } = await getDuoSessionStatus(auth.user.id, body.sessionId, body.clientId)
  if (error) return duoStorageFailure('status', error)
  return duoResponseWithRealtime(data, auth.user.id, body.clientId)
}
