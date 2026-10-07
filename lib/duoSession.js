'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDuoCharacterIdentity, heartbeatDuo, leaveDuo } from '@/lib/duoApi.client'
import {
  DUO_HEARTBEAT_MS,
  DUO_POSITION_STALE_MS,
  DUO_POSITION_THROTTLE_MS,
  DUO_RECONNECT_BASE_MS,
  DUO_RECONNECT_MAX_ATTEMPTS,
  DUO_RECONNECT_MAX_MS,
  duoRealtimeTopic,
  normalizeDuoScreen,
  validateDuoPositionPayload,
} from '@/lib/duoSessionContract.mjs'
import { getClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/userEvents'
import { DUO_PEER_NEVER_SEEN, reduceDuoPeerPresence } from '@/lib/duoPresenceLifecycle.mjs'
import {
  DUO_CHARACTER_IDENTITY_CONTRACT_VERSION,
  DUO_CHARACTER_INVALIDATION_EVENT,
  DUO_CHARACTER_REFRESH_COALESCE_MS,
  createDuoCharacterNonceCache,
  normalizeDuoCharacterLoadout,
  validateDuoCharacterInvalidation,
} from '@/lib/duoCharacterIdentityContract.mjs'

const TERMINAL_CODES = new Set(['participant_inactive', 'session_closed', 'invite_expired', 'invite_revoked', 'already_open_elsewhere'])
const CHARACTER_SAVED_EVENT = 'soundvillage:character-loadout-saved'

export function duoChannelName(sessionId) {
  return duoRealtimeTopic(sessionId)
}

export function useDuoSession(session, clientId, currentScreen = 'waiting') {
  const [status, setStatus] = useState(session ? 'connecting' : 'idle')
  const [errorCode, setErrorCode] = useState(null)
  const [partnerId, setPartnerId] = useState(null)
  const [partnerPos, setPartnerPos] = useState(null)
  const [peerCharacterLoadout, setPeerCharacterLoadout] = useState(null)
  const [peerCharacterStatus, setPeerCharacterStatus] = useState('idle')
  const [peerStateLifecycleKey, setPeerStateLifecycleKey] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const channelRef = useRef(null)
  const joinedRef = useRef(false)
  const lastSentRef = useRef(0)
  const screenRef = useRef(normalizeDuoScreen(currentScreen) || 'waiting')
  const lastPositionRef = useRef({ x:0, y:0, facing:'down', moving:false })
  const peerLifecycleRef = useRef(DUO_PEER_NEVER_SEEN)
  const peerLifecycleKeyRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const terminalRef = useRef(false)
  const characterRequestSequenceRef = useRef(0)
  const characterRefreshTimerRef = useRef(null)
  const characterNonceCacheRef = useRef(createDuoCharacterNonceCache())

  const sessionId = session?.sessionId || null
  const role = session?.role || null
  const reconnectKey = session?.reconnectKey || null
  const peerRole = role === 'host' ? 'visitor' : role === 'visitor' ? 'host' : null
  const peerLifecycleKey = sessionId && clientId && role ? `${sessionId}:${clientId}:${role}` : null

  useEffect(() => {
    const screen = normalizeDuoScreen(currentScreen) || 'waiting'
    screenRef.current = screen
    const channel = channelRef.current
    if (!channel || !joinedRef.current || document.visibilityState !== 'visible') return
    const payload = validateDuoPositionPayload({ senderRole:role, ...lastPositionRef.current, screen })
    if (payload) void channel.send({ type:'broadcast', event:'pos', payload })
  }, [currentScreen, role])

  useEffect(() => {
    if (peerLifecycleKeyRef.current === peerLifecycleKey) return
    peerLifecycleKeyRef.current = peerLifecycleKey
    peerLifecycleRef.current = DUO_PEER_NEVER_SEEN
    characterRequestSequenceRef.current += 1
    window.clearTimeout(characterRefreshTimerRef.current)
    characterRefreshTimerRef.current = null
    characterNonceCacheRef.current.clear()
    reconnectAttemptsRef.current = 0
    lastSentRef.current = 0
    joinedRef.current = false
    terminalRef.current = false
    setPeerStateLifecycleKey(peerLifecycleKey)
    setPartnerId(null)
    setPartnerPos(null)
    setPeerCharacterLoadout(null)
    setPeerCharacterStatus('idle')
    setErrorCode(null)
    setStatus(peerLifecycleKey ? 'connecting' : 'idle')
  }, [peerLifecycleKey])

  useEffect(() => {
    const topic = duoRealtimeTopic(sessionId)
    if (!topic || !clientId || !peerRole) return undefined
    let active = true
    let retryTimer = null
    let channel = null
    let peerObservedOnChannel = false
    terminalRef.current = false
    joinedRef.current = false
    queueMicrotask(() => {
      if (!active) return
      setStatus('connecting')
      setErrorCode(null)
    })

    const recordPeerPresence = (peerPresent, code = null) => {
      const transition = reduceDuoPeerPresence(peerLifecycleRef.current, peerPresent)
      peerLifecycleRef.current = transition.phase
      if (!transition.eventName) return
      trackEvent(transition.eventName, {
        target_type:'duo_session', target_id:'duo-peer',
        outcome:transition.eventName === 'duo_disconnected' ? 'disconnected' : 'succeeded',
        ...(transition.eventName === 'duo_disconnected' && code ? { error_code:code } : {}),
      })
    }

    const isCurrentLifecycle = () => active && peerLifecycleKeyRef.current === peerLifecycleKey

    const clearPeerState = ({ clearNonce = false } = {}) => {
      characterRequestSequenceRef.current += 1
      window.clearTimeout(characterRefreshTimerRef.current)
      characterRefreshTimerRef.current = null
      if (clearNonce) characterNonceCacheRef.current.clear()
      setPartnerId(null)
      setPartnerPos(null)
      setPeerCharacterLoadout(null)
      setPeerCharacterStatus('idle')
    }

    const markLost = (code = null) => {
      if (!isCurrentLifecycle() || terminalRef.current) return
      joinedRef.current = false
      setStatus('disconnected')
      clearPeerState()
      recordPeerPresence(false, code)
      if (navigator.onLine && reconnectAttemptsRef.current < DUO_RECONNECT_MAX_ATTEMPTS) {
        const delay = Math.min(DUO_RECONNECT_MAX_MS, DUO_RECONNECT_BASE_MS * (2 ** reconnectAttemptsRef.current))
        reconnectAttemptsRef.current += 1
        retryTimer = window.setTimeout(() => setRetryNonce((value) => value + 1), delay)
      }
    }

    const loadCharacterSnapshot = async (attempt = 0) => {
      const sequence = ++characterRequestSequenceRef.current
      setPeerCharacterStatus('loading')
      const result = await getDuoCharacterIdentity(sessionId, clientId)
      if (!isCurrentLifecycle() || sequence !== characterRequestSequenceRef.current) return
      if (result.ok && result.contractVersion === DUO_CHARACTER_IDENTITY_CONTRACT_VERSION) {
        setPeerCharacterLoadout(normalizeDuoCharacterLoadout(result.peer))
        setPeerCharacterStatus('ready')
        return
      }
      if ((result.retryable || result.status === 0) && attempt < 2) {
        characterRefreshTimerRef.current = window.setTimeout(() => { void loadCharacterSnapshot(attempt + 1) }, 400 * (attempt + 1))
        return
      }
      setPeerCharacterLoadout(null)
      setPeerCharacterStatus(result.code === 'capability_mismatch' ? 'disabled' : 'fallback')
    }

    const scheduleCharacterSnapshot = () => {
      if (!isCurrentLifecycle() || terminalRef.current) return
      window.clearTimeout(characterRefreshTimerRef.current)
      characterRefreshTimerRef.current = window.setTimeout(() => { void loadCharacterSnapshot() }, DUO_CHARACTER_REFRESH_COALESCE_MS)
    }

    const startRealtime = async () => {
      const supabase = getClient()
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session?.access_token) throw new Error('realtime_auth_required')
      await supabase.realtime.setAuth(data.session.access_token)
      if (!isCurrentLifecycle()) return
      channel = supabase.channel(topic, {
        config:{ private: true, presence:{ key:role } },
      })
      channelRef.current = channel
      channel.on('presence', { event:'sync' }, () => {
        if (!isCurrentLifecycle()) return
        const state = channel.presenceState()
        const allowed = Object.hasOwn(state, peerRole) ? peerRole : null
        if (allowed) {
          peerObservedOnChannel = true
          recordPeerPresence(true)
          scheduleCharacterSnapshot()
        } else if (peerObservedOnChannel) {
          peerObservedOnChannel = false
          recordPeerPresence(false)
          clearPeerState()
        }
        setPartnerId(allowed)
        if (!allowed) setPartnerPos(null)
      })
      channel.on('broadcast', { event:'pos' }, ({ payload }) => {
        if (!isCurrentLifecycle()) return
        const position = validateDuoPositionPayload(payload)
        if (!position || position.senderRole !== peerRole) return
        setPartnerPos({ ...position, at:Date.now() })
      })
      channel.on('broadcast', { event:DUO_CHARACTER_INVALIDATION_EVENT }, ({ payload }) => {
        if (!isCurrentLifecycle()) return
        const invalidation = validateDuoCharacterInvalidation(payload, { sessionId, peerRole })
        if (!invalidation || !characterNonceCacheRef.current.accept(peerLifecycleKey, invalidation.nonce)) return
        scheduleCharacterSnapshot()
      })
      channel.subscribe(async (subscriptionStatus) => {
        if (!isCurrentLifecycle()) return
        if (subscriptionStatus === 'SUBSCRIBED') {
          await channel.track({ role })
          if (!isCurrentLifecycle()) return
          joinedRef.current = true
          reconnectAttemptsRef.current = 0
          setStatus('joined')
          scheduleCharacterSnapshot()
        } else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(subscriptionStatus)) {
          markLost(subscriptionStatus.toLowerCase())
        }
      })
    }
    startRealtime().catch(() => markLost('realtime_auth_failed'))

    const announceCharacterSaved = () => {
      if (!active || !joinedRef.current || !channel) return
      void channel.send({
        type:'broadcast',
        event:DUO_CHARACTER_INVALIDATION_EVENT,
        payload:{
          version:DUO_CHARACTER_IDENTITY_CONTRACT_VERSION,
          sessionId,
          senderRole:role,
          changedAt:Date.now(),
          nonce:crypto.randomUUID(),
        },
      }).catch(() => {})
    }
    window.addEventListener(CHARACTER_SAVED_EVENT, announceCharacterSaved)

    const heartbeat = async () => {
      if (!isCurrentLifecycle() || !navigator.onLine) return
      const result = await heartbeatDuo(sessionId, clientId, screenRef.current)
      if (!isCurrentLifecycle()) return
      if (result.ok) return
      if (result.code === 'lease_stale') {
        terminalRef.current = true
        joinedRef.current = false
        recordPeerPresence(false, 'lease_stale')
        setStatus('stale')
        setErrorCode('lease_stale')
        clearPeerState({ clearNonce:true })
        await channel?.unsubscribe().catch(() => {})
        if (channel) getClient().removeChannel(channel)
      } else if (TERMINAL_CODES.has(result.code)) {
        terminalRef.current = true
        joinedRef.current = false
        setStatus('closed')
        setErrorCode(result.code)
        clearPeerState({ clearNonce:true })
        await channel?.unsubscribe().catch(() => {})
        if (channel) getClient().removeChannel(channel)
      }
    }
    heartbeat().catch(() => {})
    const heartbeatTimer = window.setInterval(() => { heartbeat().catch(() => {}) }, DUO_HEARTBEAT_MS)
    const staleTimer = window.setInterval(() => {
      setPartnerPos((previous) => previous && Date.now() - previous.at > DUO_POSITION_STALE_MS ? null : previous)
    }, 1_000)
    const onOffline = () => markLost('offline')
    const onOnline = () => {
      if (!isCurrentLifecycle() || joinedRef.current || terminalRef.current) return
      reconnectAttemptsRef.current = 0
      setRetryNonce((value) => value + 1)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      active = false
      joinedRef.current = false
      clearTimeout(retryTimer)
      clearTimeout(characterRefreshTimerRef.current)
      characterRefreshTimerRef.current = null
      characterRequestSequenceRef.current += 1
      clearInterval(heartbeatTimer)
      clearInterval(staleTimer)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      window.removeEventListener(CHARACTER_SAVED_EVENT, announceCharacterSaved)
      channel?.unsubscribe().catch(() => {})
      if (channel) getClient().removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [clientId, peerLifecycleKey, peerRole, reconnectKey, retryNonce, role, sessionId])

  useEffect(() => {
    if (!sessionId || !clientId) return undefined
    const onPageHide = () => {
      joinedRef.current = false
      characterRequestSequenceRef.current += 1
      window.clearTimeout(characterRefreshTimerRef.current)
      characterRefreshTimerRef.current = null
      characterNonceCacheRef.current.clear()
      setPartnerId(null)
      setPartnerPos(null)
      setPeerCharacterLoadout(null)
      setPeerCharacterStatus('idle')
      leaveDuo(sessionId, clientId, undefined, true).catch(() => {})
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [clientId, sessionId])

  const sendPosition = useCallback((x, y, facing, screen, moving = false) => {
    const channel = channelRef.current
    if (!channel || !joinedRef.current || document.visibilityState !== 'visible') return
    const payload = validateDuoPositionPayload({ senderRole:role, x, y, facing, screen, moving:Boolean(moving) })
    if (!payload) return
    lastPositionRef.current = { x:payload.x, y:payload.y, facing:payload.facing, moving:payload.moving }
    const now = Date.now()
    if (now - lastSentRef.current < DUO_POSITION_THROTTLE_MS) return
    lastSentRef.current = now
    channel.send({ type:'broadcast', event:'pos', payload })
  }, [role])

  const peerStateIsCurrent = Boolean(peerLifecycleKey && peerStateLifecycleKey === peerLifecycleKey)

  return {
    status:sessionId ? status : 'idle',
    errorCode,
    partnerId:peerStateIsCurrent ? partnerId : null,
    partnerPos:peerStateIsCurrent ? partnerPos : null,
    peerCharacterLoadout:peerStateIsCurrent ? peerCharacterLoadout : null,
    peerCharacterStatus:peerStateIsCurrent ? peerCharacterStatus : 'idle',
    sendPosition,
  }
}

export async function probeHost() {
  return { online:false, screen:null, code:'server_status_required' }
}

export async function isHostOnline() {
  return false
}
