import { duoResponse, duoStorageFailure, requireDuoUuids, requireDuoUser } from '@/lib/duoApi.server'
import { getDuoCharacterIdentity } from '@/lib/duoSession.server'
import { DUO_CHARACTER_IDENTITY_CONTRACT_VERSION, normalizeDuoCharacterLoadout } from '@/lib/duoCharacterIdentityContract.mjs'

export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' }

export async function GET(request) {
  const auth = await requireDuoUser(request)
  if (auth.response) return auth.response
  const url = new URL(request.url)
  const entries = [...url.searchParams.entries()]
  if (entries.length !== 2
    || url.searchParams.getAll('sessionId').length !== 1
    || url.searchParams.getAll('clientId').length !== 1
    || entries.some(([key]) => !['sessionId', 'clientId'].includes(key))) {
    return duoResponse({ ok:false, code:'invalid_request' })
  }
  const body = { sessionId:url.searchParams.get('sessionId'), clientId:url.searchParams.get('clientId') }
  const invalid = requireDuoUuids(body, ['sessionId', 'clientId'])
  if (invalid) return invalid

  const { data, error } = await getDuoCharacterIdentity(auth.user.id, body.sessionId, body.clientId)
  if (error) return duoStorageFailure('character-identity', error)
  if (!data?.ok) return duoResponse(data)
  if (data.contractVersion !== DUO_CHARACTER_IDENTITY_CONTRACT_VERSION) {
    return Response.json({ ok:false, code:'capability_mismatch', retryable:false }, { status:503, headers:HEADERS })
  }
  return Response.json({
    ok:true,
    code:'success',
    contractVersion:DUO_CHARACTER_IDENTITY_CONTRACT_VERSION,
    self:normalizeDuoCharacterLoadout(data.self),
    peer:normalizeDuoCharacterLoadout(data.peer),
  }, { status:200, headers:HEADERS })
}
