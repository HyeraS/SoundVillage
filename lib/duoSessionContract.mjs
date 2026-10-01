export const DUO_SESSION_TTL_MS = 2 * 60 * 60 * 1000
export const DUO_HEARTBEAT_MS = 15_000
export const DUO_LEASE_STALE_MS = 45_000
export const DUO_POSITION_STALE_MS = 4_000
export const DUO_POSITION_THROTTLE_MS = 120
export const DUO_RECONNECT_BASE_MS = 500
export const DUO_RECONNECT_MAX_MS = 8_000
export const DUO_RECONNECT_MAX_ATTEMPTS = 5

export const DUO_SUPPORTED_SCREENS = Object.freeze(['worldmap', 'interior', 'waiting'])
export const DUO_FACINGS = Object.freeze(['up', 'down', 'left', 'right'])
export const DUO_API_CODES = Object.freeze([
  'auth_required',
  'participant_inactive',
  'invite_locked',
  'invalid_invite',
  'invite_expired',
  'invite_revoked',
  'session_full',
  'already_open_elsewhere',
  'session_closed',
  'lease_stale',
  'lease_mismatch',
  'storage_retryable',
  'success',
])

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const JOIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

const POSITION_LIMIT = 100_000

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isJoinToken(value) {
  return typeof value === 'string' && JOIN_TOKEN_PATTERN.test(value)
}

export function duoRealtimeTopic(sessionId) {
  if (!isUuid(sessionId)) return null
  return `duo-v2:${sessionId.toLowerCase()}`
}

export function normalizeDuoScreen(value) {
  return DUO_SUPPORTED_SCREENS.includes(value) ? value : null
}

export function validateDuoPositionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (!['host', 'visitor'].includes(payload.senderRole)) return null
  const x = Number(payload.x)
  const y = Number(payload.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (Math.abs(x) > POSITION_LIMIT || Math.abs(y) > POSITION_LIMIT) return null
  if (!DUO_FACINGS.includes(payload.facing)) return null
  const screen = normalizeDuoScreen(payload.screen)
  if (!screen || typeof payload.moving !== 'boolean') return null
  return Object.freeze({
    senderRole:payload.senderRole,
    x,
    y,
    facing:payload.facing,
    screen,
    moving:payload.moving,
  })
}

export function isAllowedDuoRequest(body, allowedKeys) {
  return Boolean(body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).every((key) => allowedKeys.includes(key)))
}
