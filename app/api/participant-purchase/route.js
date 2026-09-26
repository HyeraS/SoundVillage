import { NextResponse } from 'next/server'
import { HOUSE_ITEMS } from '@/lib/houseCatalog'
import {
  INTERIOR_SETS,
  getInteriorDailyDeal,
  getInteriorItem,
  getInteriorPrice,
} from '@/lib/interiorCatalog'
import { getSupabaseAdmin, requireSupabaseUser } from '@/lib/supabaseAdmin'
import { getDailyDeal, getEffectivePrice, SHOP_PRODUCTS } from '@/lib/shopCatalog'

export const dynamic = 'force-dynamic'

function resolvePurchase(kind, itemId) {
  if (kind === 'outfit') {
    const item = SHOP_PRODUCTS.find((candidate) => candidate.id === itemId)
    if (!item) return null
    return {
      price: getEffectivePrice(item, getDailyDeal()),
      ledgerType: 'spend_shop',
      grantItemIds: [item.id],
    }
  }
  if (kind === 'interior_item') {
    const item = getInteriorItem(itemId)
    if (!item) return null
    return {
      price: getInteriorPrice(item.id, getInteriorDailyDeal()),
      ledgerType: 'spend_interior',
      grantItemIds: [item.id],
    }
  }
  if (kind === 'interior_set') {
    const set = INTERIOR_SETS.find((candidate) => candidate.id === itemId)
    if (!set) return null
    return { price: set.price, ledgerType: 'spend_interior', grantItemIds: set.items }
  }
  if (kind === 'house_item') {
    const item = HOUSE_ITEMS.find((candidate) => candidate.id === itemId)
    if (!item) return null
    return { price: item.price, ledgerType: 'spend_shop', grantItemIds: [item.id] }
  }
  return null
}

export async function POST(request) {
  const { user } = await requireSupabaseUser(request)
  if (!user) return NextResponse.json({ code: 'session_required' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const kind = typeof body?.kind === 'string' ? body.kind : ''
  const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return NextResponse.json({ code: 'invalid_idempotency_key' }, { status: 400 })
  }
  const purchase = resolvePurchase(kind, itemId)
  if (!purchase) return NextResponse.json({ code: 'unknown_item' }, { status: 400 })

  const { data, error } = await getSupabaseAdmin().rpc('secure_purchase_admin', {
    p_auth_user_id: user.id,
    p_kind: kind,
    p_item_id: itemId,
    p_price: purchase.price,
    p_ledger_type: purchase.ledgerType,
    p_grant_item_ids: purchase.grantItemIds,
    p_request_id: idempotencyKey,
  })
  if (error) {
    console.error('[participant-purchase] secure purchase failed', { code: error.code, operationType: `purchase:${kind}`, idempotencyKey })
    return NextResponse.json({ code: 'purchase_failed' }, { status: 500 })
  }
  if (!data?.ok) {
    const status = data?.reason === 'participant_inactive' ? 403 : 409
    return NextResponse.json({ ...(data || {}), code: data?.reason || 'purchase_failed' }, { status })
  }
  return NextResponse.json(data)
}
