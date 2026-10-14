export const PARTICIPANT_ENTRY_SESSION_KEY = 'soundvillage-participant-entry-v1'

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
