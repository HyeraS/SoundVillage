import 'server-only'

import { attendanceDay7TieOrder, attendanceVillagePermutation, getKstWeekContext } from '@/lib/multiVillageEconomyCore.mjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function attendanceSecret() {
  const secret = process.env.MULTI_VILLAGE_ECONOMY_HMAC_SECRET
  if (!secret) throw new Error('MULTI_VILLAGE_ECONOMY_HMAC_SECRET is not configured')
  return secret
}

export async function getMultiVillageWallets(authUserId) {
  return getSupabaseAdmin().rpc('get_multi_village_wallets_admin', { p_auth_user_id: authUserId })
}

export async function resolveMultiVillageSound(soundId) {
  if (typeof soundId !== 'string' || !soundId) return { data: null, error: null }
  const { data, error } = await getSupabaseAdmin()
    .from('study_sound_catalog')
    .select('sound_id,zone')
    .eq('sound_id', soundId)
    .limit(2)
  if (error) return { data: null, error }
  // Refuse ambiguous aliases: the server must be able to derive exactly one
  // village from the canonical catalog rather than accepting a client hint.
  return { data: data?.length === 1 ? data[0] : null, error: null }
}

export async function purchaseMultiVillageItem(authUserId, product, idempotencyKey) {
  return getSupabaseAdmin().rpc('purchase_multi_village_item_admin', {
    p_auth_user_id: authUserId,
    p_item_id: product.id,
    p_item_type: product.type,
    p_cost: product.cost,
    p_grant_item_ids: product.grantItemIds,
    p_is_bundle: product.isBundle,
    p_completion_candidates: product.completionCandidates,
    p_idempotency_key: idempotencyKey,
  })
}

export async function getMultiVillageCharacterProfile(authUserId) {
  return getSupabaseAdmin().rpc('get_multi_village_character_profile_admin', {
    p_auth_user_id: authUserId,
  })
}

export async function getMultiVillageRuntimeState(authUserId, now = new Date()) {
  const [profile, attendance] = await Promise.all([
    getMultiVillageCharacterProfile(authUserId),
    getMultiVillageAttendanceStatus(authUserId, now),
  ])
  return { profile, attendance }
}

export async function equipMultiVillageCharacterItem(authUserId, selection, idempotencyKey) {
  return getSupabaseAdmin().rpc('equip_multi_village_character_item_admin', {
    p_auth_user_id: authUserId,
    p_slot: selection.slot,
    p_item_id: selection.itemId,
    p_item_type: selection.itemType,
    p_is_approved: selection.approved,
    p_idempotency_key: idempotencyKey,
  })
}

export async function saveMultiVillageCharacterIdentity(authUserId, identity, idempotencyKey) {
  return getSupabaseAdmin().rpc('save_multi_village_character_identity_admin', {
    p_auth_user_id:authUserId,
    p_skin_id:identity.skinId,
    p_eyes_id:identity.eyesId,
    p_hair_style_id:identity.hairStyleId,
    p_hair_color_id:identity.hairColorId,
    p_idempotency_key:idempotencyKey,
  })
}

export async function submitMultiVillageAnnotation(authUserId, input) {
  return getSupabaseAdmin().rpc('submit_annotation_economy_v1_admin', {
    p_auth_user_id: authUserId,
    p_idempotency_key: input.idempotencyKey,
    p_sound_id: input.soundId,
    p_zone: input.zone,
    p_expression_text: input.expressionText || '',
    p_selected_features: input.selectedFeatures ?? null,
    p_confidence: input.confidence ?? null,
    p_difficulty: input.difficulty ?? null,
    p_play_count: input.playCount ?? 0,
    p_listening_time_sec: input.listeningTimeSec ?? 0,
    p_is_skipped: input.isSkipped ?? false,
    p_skip_reason: input.skipReason || '',
    p_device_info: input.deviceInfo || '',
    p_stage: input.stage ?? 1,
    p_version: input.version || 'v0.4-web',
  })
}

export async function submitMultiVillageVote(authUserId, input) {
  return getSupabaseAdmin().rpc('submit_museum_vote_economy_v1_admin', {
    p_auth_user_id: authUserId,
    p_idempotency_key: input.idempotencyKey,
    p_sound_id: input.soundId,
    p_zone: input.zone,
    p_annotation_id: input.annotationId,
    p_confidence: input.confidence ?? 3,
    p_play_count: input.playCount ?? 0,
    p_listening_time_sec: input.listeningTimeSec ?? 0,
    p_stage: input.stage ?? 2,
    p_version: input.version || 'v0.4-web',
  })
}

function attendanceDecision(participantId, now = new Date()) {
  const context = getKstWeekContext(now)
  const input = { secret: attendanceSecret(), participantId, weekKey: context.weekKey }
  return {
    ...context,
    permutation: attendanceVillagePermutation(input),
    tieOrder: attendanceDay7TieOrder(input),
  }
}

export async function getMultiVillageAttendanceStatus(authUserId, now = new Date()) {
  const { data: participant, error } = await getSupabaseAdmin().rpc('get_multi_village_participant_admin', {
    p_auth_user_id: authUserId,
  })
  if (error || !participant?.participantId) return { data: participant, error }
  const decision = attendanceDecision(participant.participantId, now)
  return getSupabaseAdmin().rpc('get_multi_village_attendance_admin', {
    p_auth_user_id: authUserId,
    p_week_start: decision.weekKey,
    p_permutation: decision.permutation,
    p_hmac_version: 'hmac-sha256-v1',
  })
}

export async function claimMultiVillageAttendance(authUserId, idempotencyKey, now = new Date()) {
  const { data: participant, error } = await getSupabaseAdmin().rpc('get_multi_village_participant_admin', {
    p_auth_user_id: authUserId,
  })
  if (error || !participant?.participantId) return { data: participant, error }
  const decision = attendanceDecision(participant.participantId, now)
  return getSupabaseAdmin().rpc('claim_multi_village_attendance_admin', {
    p_auth_user_id: authUserId,
    p_expected_local_date: decision.localDate,
    p_expected_week_start: decision.weekKey,
    p_permutation: decision.permutation,
    p_day7_tie_order: decision.tieOrder,
    p_hmac_version: 'hmac-sha256-v1',
    p_idempotency_key: idempotencyKey,
  })
}
