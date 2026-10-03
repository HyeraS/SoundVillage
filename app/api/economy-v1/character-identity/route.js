import { NextResponse } from 'next/server'
import { CHARACTER_IDENTITY_FIELDS, validateCharacterIdentity } from '@/lib/characterIdentityContract.mjs'
import { economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { saveMultiVillageCharacterIdentity } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

const REQUEST_FIELDS = new Set([...CHARACTER_IDENTITY_FIELDS, 'idempotencyKey'])
const NO_STORE = { 'Cache-Control':'private, no-store' }

function response(body, status) {
  return NextResponse.json(body, { status, headers:NO_STORE })
}

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) {
    auth.response.headers.set('Cache-Control', 'private, no-store')
    return auth.response
  }
  if (auth.mode !== 'cutover') return response({ ok:false, code:'feature_disabled' }, 404)

  const parsed = await readIdempotencyKey(request)
  if (parsed.response) {
    parsed.response.headers.set('Cache-Control', 'private, no-store')
    return parsed.response
  }
  const keys = parsed.body && typeof parsed.body === 'object' && !Array.isArray(parsed.body)
    ? Object.keys(parsed.body)
    : []
  if (keys.length !== REQUEST_FIELDS.size || keys.some((key) => !REQUEST_FIELDS.has(key))) {
    return response({ ok:false, code:'invalid_request' }, 400)
  }
  const validated = validateCharacterIdentity(parsed.body)
  if (!validated.ok) return response({ ok:false, code:validated.code }, 400)

  let data
  let error
  try {
    ({ data, error } = await saveMultiVillageCharacterIdentity(auth.user.id, validated.identity, parsed.idempotencyKey))
  } catch (caught) {
    const failure = economyStorageFailure('character-identity', caught)
    failure.headers.set('Cache-Control', 'private, no-store')
    return failure
  }
  if (error) {
    const failure = economyStorageFailure('character-identity', error)
    failure.headers.set('Cache-Control', 'private, no-store')
    return failure
  }
  if (data?.ok) return response({ ok:true, code:'success', loadout:data.loadout }, 200)
  const reason = data?.reason || 'storage_retryable'
  const status = reason === 'participant_inactive' ? 403
    : reason === 'idempotency_key_reused' ? 409
      : reason.startsWith('invalid_') ? 400
        : 503
  return response({ ok:false, code:reason, ...(status >= 500 ? { retryable:true } : {}) }, status)
}
