import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function tokenSecret() {
  const secret = process.env.DUO_SESSION_HMAC_SECRET
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('duo_session_secret_missing')
  return secret
}

function realtimeJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('duo_realtime_secret_missing')
  return secret
}

function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function issueDuoRealtimeToken(authUserId, sessionId, clientId, role) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + 60
  const header = jwtPart({ alg:'HS256', typ:'JWT' })
  const payload = jwtPart({
    iss:'supabase', aud:'authenticated', role:'authenticated', sub:authUserId,
    iat:issuedAt, exp:expiresAt,
    duo_session_id:sessionId, duo_client_id:clientId, duo_role:role,
  })
  const signature = createHmac('sha256', realtimeJwtSecret())
    .update(`${header}.${payload}`)
    .digest('base64url')
  return { realtimeToken:`${header}.${payload}.${signature}`, realtimeTokenExpiresAt:new Date(expiresAt * 1000).toISOString() }
}

export function deriveDuoJoinToken(authUserId, idempotencyKey) {
  return createHmac('sha256', tokenSecret())
    .update(`duo-v2\0${authUserId}\0${idempotencyKey}`)
    .digest('base64url')
}

export function hashDuoJoinToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function duoRequestHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function createOrRotateDuoSession(authUserId, clientId, tokenHash, idempotencyKey, roomSystem) {
  return getSupabaseAdmin().rpc('create_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_client_id:clientId,
    p_token_hash:tokenHash,
    p_idempotency_key:idempotencyKey,
    p_request_hash:duoRequestHash([clientId, tokenHash, roomSystem]),
    p_room_system:roomSystem,
  })
}

export function joinDuoSession(authUserId, clientId, tokenHash, idempotencyKey) {
  return getSupabaseAdmin().rpc('join_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_client_id:clientId,
    p_token_hash:tokenHash,
    p_idempotency_key:idempotencyKey,
    p_request_hash:duoRequestHash([clientId, tokenHash]),
  })
}

export function getDuoSessionStatus(authUserId, sessionId, clientId) {
  return getSupabaseAdmin().rpc('get_duo_v2_session_status_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_client_id:clientId,
  })
}

export function getDuoSharedRoom(authUserId, sessionId, clientId) {
  return getSupabaseAdmin().rpc('get_duo_v2_shared_room_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_client_id:clientId,
  })
}

export function recoverDuoSession(authUserId, sessionId, clientId) {
  return getSupabaseAdmin().rpc('recover_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_client_id:clientId,
  })
}

export function heartbeatDuoSession(authUserId, sessionId, clientId, screen, idempotencyKey) {
  return getSupabaseAdmin().rpc('heartbeat_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_client_id:clientId,
    p_screen:screen,
    p_idempotency_key:idempotencyKey,
  })
}

export function leaveDuoSession(authUserId, sessionId, clientId, idempotencyKey) {
  return getSupabaseAdmin().rpc('leave_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_client_id:clientId,
    p_idempotency_key:idempotencyKey,
  })
}

export function closeDuoSession(authUserId, sessionId, idempotencyKey) {
  return getSupabaseAdmin().rpc('close_duo_v2_session_admin', {
    p_auth_user_id:authUserId,
    p_session_id:sessionId,
    p_idempotency_key:idempotencyKey,
  })
}

export function isDuoVisitorMutationBlocked(authUserId) {
  return getSupabaseAdmin().rpc('is_duo_v2_visitor_mutation_blocked_admin', {
    p_auth_user_id:authUserId,
  })
}
