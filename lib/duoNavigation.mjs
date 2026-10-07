export const DUO_VISITOR_FOLLOW_ACTIONS = Object.freeze({
  STAY:'stay',
  ENTER_SHARED_INTERIOR:'enter-shared-interior',
  LEAVE_SHARED_INTERIOR:'leave-shared-interior',
})

// Duo only shares avatar presence on the world map and the host's room.
// Every village, museum, annotation and other participant-owned screen is
// deliberately collapsed to the existing `waiting` protocol state.
export function resolveDuoPresenceScreen({ screen, visiting = false } = {}) {
  if (visiting || screen === 'house') return 'interior'
  if (screen === 'world') return 'worldmap'
  return 'waiting'
}

export function resolveDuoVisitorFollowAction({
  role,
  peerScreen,
  visiting = false,
  hasSharedRoom = false,
} = {}) {
  if (role !== 'visitor') return DUO_VISITOR_FOLLOW_ACTIONS.STAY
  if (peerScreen === 'interior' && hasSharedRoom && !visiting) {
    return DUO_VISITOR_FOLLOW_ACTIONS.ENTER_SHARED_INTERIOR
  }
  if (peerScreen === 'worldmap' && visiting) {
    return DUO_VISITOR_FOLLOW_ACTIONS.LEAVE_SHARED_INTERIOR
  }
  return DUO_VISITOR_FOLLOW_ACTIONS.STAY
}

