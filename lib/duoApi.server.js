import 'server-only'

import { NextResponse } from 'next/server'
import { requireSupabaseUser } from '@/lib/supabaseAdmin'
import { getEconomyRuntimeMode } from '@/lib/economyRuntime.server'
import { isAllowedDuoRequest, isUuid } from '@/lib/duoSessionContract.mjs'

const STATUS_BY_CODE = Object.freeze({
  auth_required:401,
  participant_inactive:403,
  invite_locked:403,
  invalid_invite:404,
  invite_expired:410,
  invite_revoked:410,
  session_full:409,
  already_open_elsewhere:409,
  session_closed:410,
  lease_stale:409,
  lease_mismatch:409,
  shared_room_not_found:404,
  session_not_found:404,
  membership_required:403,
  peer_inactive:403,
  session_expired:409,
  session_left:409,
  peer_unavailable:409,
  role_mismatch:409,
  capability_mismatch:503,
  invalid_request:400,
  idempotency_key_reused:409,
  storage_retryable:503,
})

export async function requireDuoUser(request) {
  const mode = getEconomyRuntimeMode()
  if (!['legacy', 'preview', 'cutover'].includes(mode)) {
    return { response:duoResponse({ ok:false, code:'session_closed' }) }
  }
  const { user } = await requireSupabaseUser(request)
  if (!user) return { response:duoResponse({ ok:false, code:'auth_required' }) }
  return { user, mode }
}

export async function readDuoBody(request, allowedKeys) {
  const body = await request.json().catch(() => null)
  if (!isAllowedDuoRequest(body, allowedKeys)) return { response:duoResponse({ ok:false, code:'invalid_request' }) }
  return { body }
}

export function requireDuoUuids(body, keys) {
  if (keys.every((key) => isUuid(body?.[key]))) return null
  return duoResponse({ ok:false, code:'invalid_request' })
}

export function duoStorageFailure(scope, error) {
  console.error(`[duo-v2:${scope}] storage failure`, { code:error?.code })
  return duoResponse({ ok:false, code:'storage_retryable', retryable:true })
}

export function duoResponse(data, additions = {}) {
  const ok = data?.ok === true
  const code = ok ? 'success' : data?.reason || data?.code || 'storage_retryable'
  const payload = ok ? {
    ok:true,
    code,
    ...(isUuid(data.sessionId) ? { sessionId:data.sessionId } : {}),
    ...(['host', 'visitor'].includes(data.role) ? { role:data.role } : {}),
    ...(typeof data.expiresAt === 'string' ? { expiresAt:data.expiresAt } : {}),
    ...(typeof data.leaseExpiresAt === 'string' ? { leaseExpiresAt:data.leaseExpiresAt } : {}),
    ...(typeof data.peerPresent === 'boolean' ? { peerPresent:data.peerPresent } : {}),
    ...(['worldmap', 'interior', 'waiting'].includes(data.peerScreen) ? { peerScreen:data.peerScreen } : {}),
    ...additions,
  } : {
    ok:false,
    code,
    ...(data?.retryable || code === 'storage_retryable' ? { retryable:true } : {}),
  }
  return NextResponse.json(payload, {
    status:ok ? 200 : STATUS_BY_CODE[code] || 503,
    headers:{ 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' },
  })
}
