import { NextResponse } from 'next/server'
import { economyResultResponse, economyStorageFailure, readIdempotencyKey, requireEnabledEconomyUser } from '@/lib/economyApi.server'
import { resolveCharacterRuntimeItem } from '@/lib/economyCatalogV1.server'
import { equipMultiVillageCharacterItem } from '@/lib/multiVillageEconomy.server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const auth = await requireEnabledEconomyUser(request)
  if (auth.response) return auth.response
  const parsed = await readIdempotencyKey(request)
  if (parsed.response) return parsed.response
  if (!parsed.body || Object.keys(parsed.body).some((key) => !['slot', 'itemId', 'idempotencyKey'].includes(key))) {
    return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 })
  }

  const slot = parsed.body.slot
  if (!['outfit', 'accessory'].includes(slot)) {
    return NextResponse.json({ ok: false, code: 'invalid_slot' }, { status: 400 })
  }
  if (slot === 'accessory' && parsed.body.itemId === null) {
    const { data, error } = await equipMultiVillageCharacterItem(auth.user.id, {
      slot,
      itemId: null,
      itemType: null,
      approved: true,
    }, parsed.idempotencyKey)
    if (error) return economyStorageFailure('character-equip', error)
    return economyResultResponse(data)
  }
  if (typeof parsed.body.itemId !== 'string' || !parsed.body.itemId) {
    return NextResponse.json({ ok: false, code: 'unknown_item' }, { status: 404 })
  }

  // Retired items are absent from the store but remain equippable by existing
  // owners. The database still performs the authoritative ownership check.
  const resolved = resolveCharacterRuntimeItem(parsed.body.itemId)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, code: resolved.reason }, {
      status: resolved.reason === 'unknown_item' ? 404 : 403,
    })
  }
  if (resolved.item.type !== slot) {
    return NextResponse.json({ ok: false, code: 'invalid_item_type' }, { status: 409 })
  }

  const { data, error } = await equipMultiVillageCharacterItem(auth.user.id, {
    slot,
    itemId: resolved.item.id,
    itemType: resolved.item.type,
    approved: resolved.item.approved,
  }, parsed.idempotencyKey)
  if (error) return economyStorageFailure('character-equip', error)
  return economyResultResponse(data)
}
