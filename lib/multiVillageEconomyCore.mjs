import { createHmac } from 'node:crypto'

export const VILLAGES = Object.freeze(['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab'])
export const ATTENDANCE_AMOUNTS = Object.freeze([2, 2, 2, 3, 3, 4, 5])
export const ATTENDANCE_HMAC_VERSION = 'hmac-sha256-v1'
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('MULTI_VILLAGE_ECONOMY_HMAC_SECRET must contain at least 32 characters')
  }
  return secret
}
function hmacBytes(secret, purpose, participantId, weekKey) {
  return createHmac('sha256', requireSecret(secret))
    .update(`${ATTENDANCE_HMAC_VERSION}\0${purpose}\0${participantId}\0${weekKey}`)
    .digest()
}

function deterministicOrder(bytes) {
  const values = [...VILLAGES]
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[values.length - 1 - index] % (index + 1)
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
  return values
}

export function attendanceVillagePermutation({ secret, participantId, weekKey }) {
  return deterministicOrder(hmacBytes(secret, 'attendance-days-1-6', participantId, weekKey))
}

export function attendanceDay7TieOrder({ secret, participantId, weekKey }) {
  return deterministicOrder(hmacBytes(secret, 'attendance-day-7-tie', participantId, weekKey))
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

export function getKstWeekContext(at = new Date()) {
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error('A valid date is required')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
  const localDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
  const attendanceDay = localDate.getUTCDay() === 0 ? 7 : localDate.getUTCDay()
  const weekStart = new Date(localDate)
  weekStart.setUTCDate(localDate.getUTCDate() - (attendanceDay - 1))
  return {
    localDate: formatIsoDate(localDate),
    weekKey: formatIsoDate(weekStart),
    attendanceDay,
    amount: ATTENDANCE_AMOUNTS[attendanceDay - 1],
  }
}
