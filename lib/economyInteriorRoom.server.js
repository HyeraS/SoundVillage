import 'server-only'

import { createHash } from 'node:crypto'
import { getInteriorRuntimeItemIds, getInteriorShopItems, getInteriorStarterItems } from '@/lib/economyCatalogV1.server'
import { validateEconomyInteriorRoom } from '@/lib/economyInteriorRoom.mjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function runtimeMap() {
  return new Map([...getInteriorStarterItems(), ...getInteriorShopItems()].map((item) => [item.id, item]))
}

export function validateInteriorRoomForSave(room) {
  return validateEconomyInteriorRoom(room, runtimeMap())
}

export async function getEconomyInteriorRoom(authUserId) {
  return getSupabaseAdmin().rpc('get_economy_v1_room_admin', { p_auth_user_id:authUserId })
}

export async function saveEconomyInteriorRoom(authUserId, room, expectedRevision, idempotencyKey) {
  const validated = validateInteriorRoomForSave(room)
  if (!validated.ok) return { data:{ ok:false, reason:validated.code }, error:null }
  const requestHash = createHash('sha256')
    .update(JSON.stringify([expectedRevision, validated.room]))
    .digest('hex')
  return getSupabaseAdmin().rpc('save_economy_v1_room_admin', {
    p_auth_user_id:authUserId,
    p_idempotency_key:idempotencyKey,
    p_request_hash:requestHash,
    p_expected_revision:expectedRevision,
    p_room:validated.room,
    p_referenced_item_ids:validated.referencedItemIds,
    p_starter_item_ids:getInteriorStarterItems().map((item) => item.id),
    p_unique_item_count:validated.uniqueItemCount,
  })
}

export async function getOrCreateEconomyInteriorRoomShare(authUserId) {
  return getSupabaseAdmin().rpc('get_or_create_economy_v1_room_share_admin', { p_auth_user_id:authUserId })
}

export async function getEconomyInteriorSharedRoom(authUserId, shareToken) {
  return getSupabaseAdmin().rpc('get_economy_v1_shared_room_admin', {
    p_auth_user_id:authUserId,
    p_share_token:shareToken,
  })
}

export const ECONOMY_INTERIOR_RUNTIME_ITEM_IDS = Object.freeze(getInteriorRuntimeItemIds())
