'use client'

export const PERSISTENCE_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PARTICIPANT_NOT_CLAIMED: 'PARTICIPANT_NOT_CLAIMED',
  PARTICIPANT_INACTIVE: 'PARTICIPANT_INACTIVE',
  INVALID_SOUND: 'INVALID_SOUND',
  INVALID_ANNOTATION: 'INVALID_ANNOTATION',
  AUDIO_PLAY_REQUIRED: 'AUDIO_PLAY_REQUIRED',
  EXPERIMENT_COMPLETED: 'EXPERIMENT_COMPLETED',
  DUPLICATE_OPERATION: 'DUPLICATE_OPERATION',
  DUPLICATE_ANNOTATION: 'DUPLICATE_ANNOTATION',
  DUPLICATE_VOTE: 'DUPLICATE_VOTE',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ALREADY_OWNED: 'ALREADY_OWNED',
  INVALID_ITEM: 'INVALID_ITEM',
  INVALID_REWARD_SOURCE: 'INVALID_REWARD_SOURCE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  ECONOMY_RUNTIME_BLOCKED: 'ECONOMY_RUNTIME_BLOCKED',
})

export const newOperationKey = () => crypto.randomUUID()

export function getOrCreateOperationKey(scope) {
  if (typeof sessionStorage === 'undefined') return newOperationKey()
  const storageKey = `sound-village:operation:${scope}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const created = newOperationKey()
  sessionStorage.setItem(storageKey, created)
  return created
}

export function clearOperationKey(scope) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(`sound-village:operation:${scope}`)
}

const RETRYABLE = new Set(['NETWORK_ERROR', 'DATABASE_ERROR', 'UNKNOWN_ERROR'])

export function persistenceFailure(error, operationType, idempotencyKey) {
  const rawCode = String(error?.code || '').toUpperCase()
  const message = String(error?.message || '')
  const signal = `${rawCode} ${message}`.toUpperCase()
  let code = PERSISTENCE_ERROR_CODES.UNKNOWN_ERROR
  if (/ECONOMY_RUNTIME_BLOCKED/.test(signal)) code = PERSISTENCE_ERROR_CODES.ECONOMY_RUNTIME_BLOCKED
  else if (/JWT|AUTH|SESSION_REQUIRED/.test(signal)) code = PERSISTENCE_ERROR_CODES.AUTH_REQUIRED
  else if (/PARTICIPANT_INACTIVE/.test(signal)) code = PERSISTENCE_ERROR_CODES.PARTICIPANT_INACTIVE
  else if (/PARTICIPANT/.test(signal)) code = PERSISTENCE_ERROR_CODES.PARTICIPANT_NOT_CLAIMED
  else if (/INVALID_SOUND/.test(signal)) code = PERSISTENCE_ERROR_CODES.INVALID_SOUND
  else if (/INVALID_ANNOTATION/.test(signal)) code = PERSISTENCE_ERROR_CODES.INVALID_ANNOTATION
  else if (/AUDIO_PLAY_REQUIRED/.test(signal)) code = PERSISTENCE_ERROR_CODES.AUDIO_PLAY_REQUIRED
  else if (/EXPERIMENT_(?:COMPLETED|NOT_COMPLETED)/.test(signal)) code = PERSISTENCE_ERROR_CODES.EXPERIMENT_COMPLETED
  else if (/23505|DUPLICATE/.test(signal)) code = PERSISTENCE_ERROR_CODES.DUPLICATE_OPERATION
  else if (/INSUFFICIENT/.test(signal)) code = PERSISTENCE_ERROR_CODES.INSUFFICIENT_FUNDS
  else if (/ALREADY_OWNED/.test(signal)) code = PERSISTENCE_ERROR_CODES.ALREADY_OWNED
  else if (/INVALID_ITEM|UNKNOWN_ITEM/.test(signal)) code = PERSISTENCE_ERROR_CODES.INVALID_ITEM
  else if (/INVALID_REWARD|UNSUPPORTED_REWARD/.test(signal)) code = PERSISTENCE_ERROR_CODES.INVALID_REWARD_SOURCE
  else if (/NETWORK|FETCH/.test(signal)) code = PERSISTENCE_ERROR_CODES.NETWORK_ERROR
  else if (rawCode) code = PERSISTENCE_ERROR_CODES.DATABASE_ERROR

  console.error('[persistence]', { code, operationType, idempotencyKey, causeCode: error?.code })
  return { ok: false, error: { code, message: '저장하지 못했습니다. 잠시 후 다시 시도해주세요.', retryable: RETRYABLE.has(code) }, operationType, idempotencyKey }
}

export function persistenceSuccess(data, operationType, idempotencyKey) {
  return { ok: true, data, operationType, idempotencyKey }
}
