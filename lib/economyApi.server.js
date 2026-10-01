import 'server-only'

import { NextResponse } from 'next/server'
import { requireSupabaseUser } from '@/lib/supabaseAdmin'
import { UUID_PATTERN } from '@/lib/multiVillageEconomyCore.mjs'
import { getEconomyRuntimeMode, isEconomyApiEnabled } from '@/lib/economyRuntime.server'

export async function requireEconomyUser(request) {
  const { user } = await requireSupabaseUser(request)
  if (!user) return { response: NextResponse.json({ ok: false, code: 'auth_required' }, { status: 401 }) }
  return { user }
}

export function requireEconomyApiEnabled() {
  const mode = getEconomyRuntimeMode()
  if (isEconomyApiEnabled()) return { mode }
  const maintenance = mode === 'maintenance'
  return {
    response: NextResponse.json({
      ok: false,
      code: maintenance ? 'maintenance' : mode === 'legacy' ? 'feature_disabled' : 'unsafe_economy_mode',
      economyMode: mode,
    }, {
      status: maintenance ? 503 : 404,
      headers: { 'Cache-Control': 'private, no-store' },
    }),
  }
}

export async function requireEnabledEconomyUser(request) {
  const feature = requireEconomyApiEnabled()
  if (feature.response) return feature
  return { ...await requireEconomyUser(request), mode: feature.mode }
}

export async function readIdempotencyKey(request) {
  const body = await request.json().catch(() => null)
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : ''
  if (!UUID_PATTERN.test(idempotencyKey)) {
    return { response: NextResponse.json({ ok: false, code: 'invalid_idempotency_key' }, { status: 400 }) }
  }
  return { body, idempotencyKey }
}

export function economyStorageFailure(scope, error) {
  console.error(`[economy-v1:${scope}] storage failure`, { code: error?.code, message: error?.message })
  return NextResponse.json({ ok: false, code: 'storage_retryable', retryable: true }, { status: 503 })
}

export function economyResultResponse(data) {
  if (data?.ok) return NextResponse.json({ ...data, code: 'success' })
  const statusByReason = {
    participant_inactive: 403,
    already_owned: 409,
    bundle_partially_owned: 409,
    insufficient_funds: 409,
    idempotency_key_reused: 409,
    asset_selection_required: 409,
    invalid_slot: 400,
    unknown_item: 404,
    official_store_unapproved: 403,
    item_not_owned: 409,
    invalid_item_type: 409,
    invalid_room: 400,
    invalid_room_item: 400,
    unknown_room_item: 400,
    room_conflict: 409,
    shared_room_not_found: 404,
  }
  return NextResponse.json({ ...(data || {}), ok: false, code: data?.reason || 'storage_retryable' }, {
    status: statusByReason[data?.reason] || 503,
  })
}

function cleanVillageObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const villages = ['Animal','Human','Nature','Urban','Music','Lab']
  return Object.fromEntries(villages.filter((village) => Object.hasOwn(value, village)).map((village) => [village, value[village]]))
}

export function economyPurchaseResultResponse(data) {
  if (data?.ok) {
    return NextResponse.json({
      ok:true,
      code:'success',
      itemId:data.itemId,
      itemType:data.itemType,
      grantedItemIds:Array.isArray(data.grantedItemIds) ? data.grantedItemIds.slice(0, 16) : [],
      balances:cleanVillageObject(data.balances) || {},
      transactionId:data.purchaseId,
    }, { headers:{ 'Cache-Control':'private, no-store' } })
  }
  const reason = data?.reason || 'storage_retryable'
  const statusByReason = {
    participant_inactive:403,
    already_owned:409,
    bundle_partially_owned:409,
    insufficient_funds:409,
    idempotency_key_reused:409,
  }
  return NextResponse.json({
    ok:false,
    code:reason,
    ...(Array.isArray(data?.ownedItemIds) ? { ownedItemIds:data.ownedItemIds.slice(0, 16) } : {}),
    ...(data?.balances ? { balances:cleanVillageObject(data.balances) } : {}),
    ...(data?.cost ? { cost:cleanVillageObject(data.cost) } : {}),
    ...(data?.wallets ? { wallets:cleanVillageObject(data.wallets) } : {}),
    ...(data?.shortages ? { shortages:cleanVillageObject(data.shortages) } : {}),
  }, {
    status:statusByReason[reason] || 503,
    headers:{ 'Cache-Control':'private, no-store' },
  })
}
