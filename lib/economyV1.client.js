'use client'

import { getClient } from '@/lib/supabase'
import { normalizeEconomyReward } from '@/lib/economyRuntimeState.mjs'

export async function economyRequest(path, { method = 'GET', body } = {}) {
  const { data, error } = await getClient().auth.getSession()
  if (error || !data.session) return { ok: false, code: 'auth_required', retryable: false }
  try {
    const response = await fetch(path, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = await response.json().catch(() => ({}))
    const normalized = normalizeEconomyReward(result)
    return {
      ...normalized,
      ok: response.ok && result?.ok === true,
      status: response.status,
    }
  } catch {
    return { ok: false, code: 'storage_retryable', retryable: true, status: 0 }
  }
}

export const newEconomyOperationKey = () => crypto.randomUUID()
export const getEconomyBootstrap = () => economyRequest('/api/economy-v1/bootstrap')
export const getVillageWallets = () => economyRequest('/api/economy-v1/wallets')
export const getCharacterShop = () => economyRequest('/api/economy-v1/character-shop')
export const getCharacterProfile = () => economyRequest('/api/economy-v1/character-profile')
export const getEconomyAttendance = () => economyRequest('/api/economy-v1/attendance')
export const getEconomyInteriorCatalog = () => economyRequest('/api/economy-v1/interior-catalog')

export function purchaseCharacterItem(itemId, idempotencyKey) {
  return economyRequest('/api/economy-v1/purchase', {
    method: 'POST',
    body: { itemId, idempotencyKey },
  })
}

export const purchaseEconomyItem = purchaseCharacterItem

export const getEconomyRoom = () => economyRequest('/api/economy-v1/room')
export function saveEconomyRoom(room, expectedRevision, idempotencyKey) {
  return economyRequest('/api/economy-v1/room', {
    method:'POST',
    body:{ room, expectedRevision, idempotencyKey },
  })
}
export const getOrCreateEconomyRoomShare = () => economyRequest('/api/economy-v1/room-share', { method:'POST' })
export function getEconomySharedRoom(shareToken) {
  return economyRequest(`/api/economy-v1/shared-room?token=${encodeURIComponent(shareToken)}`)
}

export function equipCharacterItem(slot, itemId, idempotencyKey) {
  return economyRequest('/api/economy-v1/equip', {
    method: 'POST',
    body: { slot, itemId, idempotencyKey },
  })
}

export function saveCharacterIdentity(identity, idempotencyKey) {
  return economyRequest('/api/economy-v1/character-identity', {
    method:'POST',
    body:{
      skinId:identity.skinId,
      eyesId:identity.eyesId,
      hairStyleId:identity.hairStyleId,
      hairColorId:identity.hairColorId,
      idempotencyKey,
    },
  })
}

export function claimEconomyAttendance(idempotencyKey) {
  return economyRequest('/api/economy-v1/attendance', {
    method: 'POST',
    body: { idempotencyKey },
  })
}

export function submitEconomyAnnotation(input) {
  return economyRequest('/api/economy-v1/annotation', { method: 'POST', body: input })
}

export function submitEconomyVote(input) {
  return economyRequest('/api/economy-v1/vote', { method: 'POST', body: input })
}
