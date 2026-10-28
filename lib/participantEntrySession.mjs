export const PARTICIPANT_ENTRY_SESSION_KEY = 'soundvillage-participant-entry-v1'
export const PARTICIPANT_SESSION_NOTICE_KEY = 'soundvillage-participant-session-notice-v1'

const PARTICIPANT_SESSION_NOTICES = new Set(['session_moved'])

function normalizeParticipantId(participantId) {
  const normalized = String(participantId || '').trim().toUpperCase()
  return normalized || null
}

export function readParticipantEntrySession(storage) {
  if (!storage) return null
  try {
    return normalizeParticipantId(storage.getItem(PARTICIPANT_ENTRY_SESSION_KEY))
  } catch {
    return null
  }
}

export function writeParticipantEntrySession(storage, participantId) {
  const normalized = normalizeParticipantId(participantId)
  if (!storage || !normalized) return false
  try {
    storage.setItem(PARTICIPANT_ENTRY_SESSION_KEY, normalized)
    return true
  } catch {
    return false
  }
}

export function clearParticipantEntrySession(storage) {
  if (!storage) return false
  try {
    storage.removeItem(PARTICIPANT_ENTRY_SESSION_KEY)
    return true
  } catch {
    return false
  }
}

export function writeParticipantSessionNotice(storage, notice) {
  if (!storage || !PARTICIPANT_SESSION_NOTICES.has(notice)) return false
  try {
    storage.setItem(PARTICIPANT_SESSION_NOTICE_KEY, notice)
    return true
  } catch {
    return false
  }
}

export function consumeParticipantSessionNotice(storage) {
  if (!storage) return null
  try {
    const notice = storage.getItem(PARTICIPANT_SESSION_NOTICE_KEY)
    storage.removeItem(PARTICIPANT_SESSION_NOTICE_KEY)
    return PARTICIPANT_SESSION_NOTICES.has(notice) ? notice : null
  } catch {
    return null
  }
}
