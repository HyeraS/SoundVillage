'use client'

import { getClient } from '@/lib/supabase'

async function duoRequest(path, { method = 'GET', body, keepalive = false } = {}) {
  const { data, error } = await getClient().auth.getSession()
  if (error || !data.session) return { ok:false, code:'auth_required', status:401 }
  try {
    const response = await fetch(path, {
      method,
      cache:'no-store',
      keepalive,
      referrerPolicy:'no-referrer',
      headers:{
        Authorization:`Bearer ${data.session.access_token}`,
        ...(body ? { 'Content-Type':'application/json' } : {}),
      },
      ...(body ? { body:JSON.stringify(body) } : {}),
    })
    const result = await response.json().catch(() => ({}))
    return { ...result, ok:response.ok && result?.ok === true, status:response.status }
  } catch {
    return { ok:false, code:'storage_retryable', retryable:true, status:0 }
  }
}

export const newDuoOperationKey = () => crypto.randomUUID()

export function createDuoInvite(clientId, idempotencyKey = newDuoOperationKey()) {
  return duoRequest('/api/duo-v2/host', { method:'POST', body:{ clientId, idempotencyKey } })
}

export function joinDuoInvite(inviteToken, clientId, idempotencyKey = newDuoOperationKey()) {
  return duoRequest('/api/duo-v2/join', { method:'POST', body:{ inviteToken, clientId, idempotencyKey } })
}

export function getDuoStatus(sessionId, clientId) {
  const query = new URLSearchParams({ sessionId, clientId })
  return duoRequest(`/api/duo-v2/status?${query}`)
}

export function getDuoRoom(sessionId, clientId) {
  return duoRequest(`/api/duo-v2/room?${new URLSearchParams({ sessionId, clientId })}`)
}

export function recoverDuo(sessionId, clientId) {
  return duoRequest('/api/duo-v2/recover', { method:'POST', body:{ sessionId, clientId } })
}

export function heartbeatDuo(sessionId, clientId, screen, idempotencyKey = newDuoOperationKey()) {
  return duoRequest('/api/duo-v2/heartbeat', { method:'POST', body:{ sessionId, clientId, screen, idempotencyKey } })
}

export function leaveDuo(sessionId, clientId, idempotencyKey = newDuoOperationKey(), keepalive = false) {
  return duoRequest('/api/duo-v2/leave', { method:'POST', body:{ sessionId, clientId, idempotencyKey }, keepalive })
}

export function revokeDuo(sessionId, idempotencyKey = newDuoOperationKey()) {
  return duoRequest('/api/duo-v2/revoke', { method:'POST', body:{ sessionId, idempotencyKey } })
}
