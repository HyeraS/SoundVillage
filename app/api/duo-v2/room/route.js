import { duoResponse, duoStorageFailure, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { getDuoSharedRoom } from '@/lib/duoSession.server'

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
  const { data, error } = await getDuoSharedRoom(auth.user.id, body.sessionId, body.clientId)
  if (error) return duoStorageFailure('room', error)
  if (!data?.ok) return duoResponse(data)
  return Response.json({ ok:true, code:'success', room:data.room, revision:data.revision }, {
    headers:{ 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' },
  })
}
