import { CHARACTER_STUDIO_ITEMS } from './generated/characterIdentityCatalog.mjs'
import { hasCompleteCharacterLoadout } from './characterIdentityContract.mjs'
import { DEFAULT_CHARACTER_LOADOUT, normalizeCharacterLoadout } from './characterStudioState.mjs'

export const DUO_CHARACTER_IDENTITY_CONTRACT_VERSION = 1
export const DUO_CHARACTER_INVALIDATION_EVENT = 'character-loadout-invalidated'
export const DUO_CHARACTER_REFRESH_COALESCE_MS = 250
export const DUO_CHARACTER_NONCE_CACHE_LIMIT = 64

const STRICT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const itemAssets = new Map(CHARACTER_STUDIO_ITEMS.map((item) => [item.id, item.runtimeAsset]))

export function normalizeDuoCharacterLoadout(value) {
  if (!hasCompleteCharacterLoadout(value)) return normalizeCharacterLoadout(DEFAULT_CHARACTER_LOADOUT)
  return normalizeCharacterLoadout(value)
}

export function resolveCharacterEquipmentAssets(loadout) {
  const normalized = normalizeDuoCharacterLoadout(loadout)
  return Object.freeze({
    outfitSrc:itemAssets.get(normalized.outfitId) || '/assets/world/player_clothes.png',
    accessorySrc:normalized.accessoryId ? itemAssets.get(normalized.accessoryId) : undefined,
  })
}

export function validateDuoCharacterInvalidation(payload, { sessionId, peerRole } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const keys = Object.keys(payload)
  const allowed = ['version', 'sessionId', 'senderRole', 'changedAt', 'nonce']
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) return null
  if (payload.version !== DUO_CHARACTER_IDENTITY_CONTRACT_VERSION) return null
  if (typeof payload.sessionId !== 'string' || payload.sessionId.toLowerCase() !== sessionId?.toLowerCase()) return null
  if (payload.senderRole !== peerRole) return null
  // changedAt is informational only. Peers can have substantially different wall
  // clocks, so freshness comes from the authenticated snapshot, not this value.
  if (!Number.isSafeInteger(payload.changedAt) || payload.changedAt < 0) return null
  if (typeof payload.nonce !== 'string' || !STRICT_UUID_PATTERN.test(payload.nonce)) return null
  return Object.freeze({
    version:payload.version,
    sessionId:payload.sessionId.toLowerCase(),
    senderRole:payload.senderRole,
    changedAt:payload.changedAt,
    nonce:payload.nonce,
  })
}

export function createDuoCharacterNonceCache(limit = DUO_CHARACTER_NONCE_CACHE_LIMIT) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('nonce cache limit must be a positive integer')
  let lifecycleKey = null
  const seen = new Set()
  return Object.freeze({
    accept(nextLifecycleKey, nonce) {
      if (typeof nextLifecycleKey !== 'string' || !nextLifecycleKey || !STRICT_UUID_PATTERN.test(nonce)) return false
      if (lifecycleKey !== nextLifecycleKey) {
        lifecycleKey = nextLifecycleKey
        seen.clear()
      }
      if (seen.has(nonce)) return false
      seen.add(nonce)
      if (seen.size > limit) seen.delete(seen.values().next().value)
      return true
    },
    clear() {
      lifecycleKey = null
      seen.clear()
    },
    size() {
      return seen.size
    },
  })
}
