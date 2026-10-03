export const DUO_PEER_NEVER_SEEN = 'never_seen'
export const DUO_PEER_CONNECTED = 'connected'
export const DUO_PEER_DISCONNECTED = 'disconnected'

export function reduceDuoPeerPresence(phase, peerPresent) {
  if (peerPresent) {
    if (phase === DUO_PEER_CONNECTED) return { phase, eventName:null }
    return {
      phase:DUO_PEER_CONNECTED,
      eventName:phase === DUO_PEER_DISCONNECTED ? 'duo_reconnected' : 'duo_connected',
    }
  }

  if (phase !== DUO_PEER_CONNECTED) return { phase, eventName:null }
  return { phase:DUO_PEER_DISCONNECTED, eventName:'duo_disconnected' }
}
