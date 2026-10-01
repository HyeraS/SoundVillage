import { NextResponse } from 'next/server'
import { economyPurchaseResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { resolveEconomyPurchase } from '@/lib/economyCatalogV1.server'
import { purchaseMultiVillageItem } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  if (!parsed.body || Object.keys(parsed.body).some((key) => !['itemId', 'idempotencyKey'].includes(key))) {
    return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 })
  }

  const itemId = typeof parsed.body?.itemId === 'string' ? parsed.body.itemId : ''
  const resolved = resolveEconomyPurchase(itemId)
  if (!resolved.ok) {
    const status = resolved.reason === 'unknown_item' ? 404 : 403
    return NextResponse.json({ ok: false, code: resolved.reason }, { status })
  }

  const { data, error } = await purchaseMultiVillageItem(auth.user.id, resolved.product, parsed.idempotencyKey)
  if (error) return economyStorageFailure('purchase', error)
  return economyPurchaseResultResponse(data)
}
