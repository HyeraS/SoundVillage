export const ECONOMY_INTERIOR_MAX_ITEMS = 100
export const ECONOMY_INTERIOR_MAX_BYTES = 64 * 1024
export const ECONOMY_INTERIOR_COLS = 12
export const ECONOMY_INTERIOR_ROWS = 5
export const ECONOMY_INTERIOR_WALL_ROWS = 2

const ROOM_KEYS = new Set(['wallpaper','floor','items'])
const ITEM_KEYS = new Set(['uid','itemId','layer','col','row','flip'])
const VALID_LAYERS = new Set(['wall','floor','rug'])

function exactKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key))
}
export function validateEconomyInteriorRoom(room, runtimeItems) {
  if (!room || typeof room !== 'object' || Array.isArray(room) || !exactKeys(room, ROOM_KEYS)) {
    return { ok:false, code:'invalid_room' }
  }
  let bytes
  try { bytes = new TextEncoder().encode(JSON.stringify(room)).length } catch { return { ok:false, code:'invalid_room' } }
  if (bytes > ECONOMY_INTERIOR_MAX_BYTES || !Array.isArray(room.items) || room.items.length > ECONOMY_INTERIOR_MAX_ITEMS) {
    return { ok:false, code:'invalid_room' }
  }
  const index = runtimeItems instanceof Map ? runtimeItems : new Map((runtimeItems || []).map((item) => [item.id, item]))
  const wallpaper = index.get(room.wallpaper)
  const floor = index.get(room.floor)
  if (wallpaper?.kind !== 'wallpaper' || floor?.kind !== 'floor') return { ok:false, code:'unknown_room_item' }

  const uids = new Set()
  const referencedIds = new Set([room.wallpaper, room.floor])
  const uniqueMovableItemIds = new Set()
  for (const placement of room.items) {
    if (!placement || typeof placement !== 'object' || Array.isArray(placement) || !exactKeys(placement, ITEM_KEYS)) {
      return { ok:false, code:'invalid_room_item' }
    }
    if (!Number.isSafeInteger(placement.uid) || placement.uid < 1 || placement.uid > 2_147_483_647 || uids.has(placement.uid)) {
      return { ok:false, code:'invalid_room_item' }
    }
    if (typeof placement.itemId !== 'string' || placement.itemId.length > 96 || !VALID_LAYERS.has(placement.layer)
      || !Number.isInteger(placement.col) || !Number.isInteger(placement.row) || typeof placement.flip !== 'boolean') {
      return { ok:false, code:'invalid_room_item' }
    }
    const item = index.get(placement.itemId)
    if (!item || item.starter || item.kind === 'wallpaper' || item.kind === 'floor' || item.layer !== placement.layer) {
      return { ok:false, code:'unknown_room_item' }
    }
    const fw = Number(item.fw) || 1
    const fh = Number(item.fh) || 1
    const maxRows = placement.layer === 'wall' ? ECONOMY_INTERIOR_WALL_ROWS : ECONOMY_INTERIOR_ROWS
    if (placement.col < 0 || placement.col + fw > ECONOMY_INTERIOR_COLS || placement.row < fh - 1 || placement.row >= maxRows) {
      return { ok:false, code:'invalid_room_item' }
    }
    uids.add(placement.uid)
    referencedIds.add(placement.itemId)
    uniqueMovableItemIds.add(placement.itemId)
  }
  return {
    ok:true,
    room:{ wallpaper:room.wallpaper, floor:room.floor, items:room.items.map((item) => ({ ...item })) },
    referencedItemIds:[...referencedIds],
    uniqueMovableItemIds:[...uniqueMovableItemIds],
    uniqueItemCount:uniqueMovableItemIds.size,
  }
}
