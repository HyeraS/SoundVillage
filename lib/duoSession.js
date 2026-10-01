'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { heartbeatDuo, leaveDuo } from '@/lib/duoApi.client'
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

const TERMINAL_CODES = new Set(['participant_inactive', 'session_closed', 'invite_expired', 'invite_revoked', 'already_open_elsewhere'])

export function duoChannelName(sessionId) {
  return duoRealtimeTopic(sessionId)
}

export function useDuoSession(session, clientId, currentScreen = 'waiting') {
  const [status, setStatus] = useState(session ? 'connecting' : 'idle')
  const [errorCode, setErrorCode] = useState(null)
  const [partnerId, setPartnerId] = useState(null)
  const [partnerPos, setPartnerPos] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const channelRef = useRef(null)
  const joinedRef = useRef(false)
  const lastSentRef = useRef(0)
  const screenRef = useRef(normalizeDuoScreen(currentScreen) || 'waiting')
  const everSubscribedRef = useRef(false)
  const lostAfterSubscribeRef = useRef(false)
  const disconnectTrackedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const terminalRef = useRef(false)

  const sessionId = session?.sessionId || null
  const role = session?.role || null
  const reconnectKey = session?.reconnectKey || null
  const realtimeToken = session?.realtimeToken || null
  const peerRole = role === 'host' ? 'visitor' : role === 'visitor' ? 'host' : null

  useEffect(() => {
    screenRef.current = normalizeDuoScreen(currentScreen) || 'waiting'
  }, [currentScreen])

  useEffect(() => {
    const topic = duoRealtimeTopic(sessionId)
    if (!topic || !clientId || !peerRole || !realtimeToken) return undefined
    let active = true
    let retryTimer = null
    let channel = null
    terminalRef.current = false
    joinedRef.current = false
    queueMicrotask(() => {
      if (!active) return
      setStatus('connecting')
      setErrorCode(null)
    })

    const markLost = (code = null) => {
      if (!active || terminalRef.current) return
      joinedRef.current = false
      setStatus('disconnected')
      setPartnerId(null)
      setPartnerPos(null)
      if (everSubscribedRef.current) {
        lostAfterSubscribeRef.current = true
        if (!disconnectTrackedRef.current) {
          disconnectTrackedRef.current = true
          trackEvent('duo_disconnected', {
            target_type:'duo_session', target_id:role, outcome:'disconnected',
            ...(code ? { error_code:code } : {}),
          })
        }
      }
      if (navigator.onLine && reconnectAttemptsRef.current < DUO_RECONNECT_MAX_ATTEMPTS) {
        const delay = Math.min(DUO_RECONNECT_MAX_MS, DUO_RECONNECT_BASE_MS * (2 ** reconnectAttemptsRef.current))
        reconnectAttemptsRef.current += 1
        retryTimer = window.setTimeout(() => setRetryNonce((value) => value + 1), delay)
      }
    }

    const startRealtime = async () => {
      await getClient().realtime.setAuth(realtimeToken)
      if (!active) return
      channel = getClient().channel(topic, {
        config:{ private: true, presence:{ key:role } },
      })
      channelRef.current = channel
      channel.on('presence', { event:'sync' }, () => {
        if (!active) return
        const state = channel.presenceState()
        const allowed = Object.hasOwn(state, peerRole) ? peerRole : null
        setPartnerId(allowed)
        if (!allowed) setPartnerPos(null)
      })
      channel.on('broadcast', { event:'pos' }, ({ payload }) => {
        if (!active) return
        const position = validateDuoPositionPayload(payload)
        if (!position || position.senderRole !== peerRole) return
        setPartnerPos({ ...position, at:Date.now() })
      })
      channel.subscribe(async (subscriptionStatus) => {
        if (!active) return
        if (subscriptionStatus === 'SUBSCRIBED') {
          await channel.track({ role })
          if (!active) return
          joinedRef.current = true
          reconnectAttemptsRef.current = 0
          setStatus('joined')
          if (!everSubscribedRef.current) {
            everSubscribedRef.current = true
            trackEvent('duo_connected', { target_type:'duo_session', target_id:role, outcome:'succeeded' })
          } else if (lostAfterSubscribeRef.current) {
            lostAfterSubscribeRef.current = false
            disconnectTrackedRef.current = false
            trackEvent('duo_reconnected', { target_type:'duo_session', target_id:role, outcome:'succeeded' })
          }
        } else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(subscriptionStatus)) {
          markLost(subscriptionStatus.toLowerCase())
        }
      })
    }
    startRealtime().catch(() => markLost('realtime_auth_failed'))

    const heartbeat = async () => {
      if (!active || !navigator.onLine) return
      const result = await heartbeatDuo(sessionId, clientId, screenRef.current)
      if (!active) return
      if (result.ok) {
        if (result.realtimeToken) await getClient().realtime.setAuth(result.realtimeToken)
        return
      }
      if (result.code === 'lease_stale') {
        terminalRef.current = true
        joinedRef.current = false
        if (everSubscribedRef.current) {
          lostAfterSubscribeRef.current = true
          if (!disconnectTrackedRef.current) {
            disconnectTrackedRef.current = true
            trackEvent('duo_disconnected', {
              target_type:'duo_session', target_id:role, outcome:'disconnected', error_code:'lease_stale',
            })
          }
        }
        setStatus('stale')
        setErrorCode('lease_stale')
        await channel?.unsubscribe().catch(() => {})
        if (channel) getClient().removeChannel(channel)
      } else if (TERMINAL_CODES.has(result.code)) {
        terminalRef.current = true
        joinedRef.current = false
        setStatus('closed')
        setErrorCode(result.code)
        setPartnerId(null)
        setPartnerPos(null)
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
      if (!active || joinedRef.current || terminalRef.current) return
      reconnectAttemptsRef.current = 0
      setRetryNonce((value) => value + 1)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      active = false
      joinedRef.current = false
      clearTimeout(retryTimer)
      clearInterval(heartbeatTimer)
      clearInterval(staleTimer)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      channel?.unsubscribe().catch(() => {})
      if (channel) getClient().removeChannel(channel)
      getClient().realtime.setAuth().catch(() => {})
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [clientId, peerRole, realtimeToken, reconnectKey, retryNonce, role, sessionId])

  useEffect(() => {
    if (!sessionId || !clientId) return undefined
    const onPageHide = () => { leaveDuo(sessionId, clientId, undefined, true).catch(() => {}) }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [clientId, sessionId])

  const sendPosition = useCallback((x, y, facing, screen, moving = false) => {
    const channel = channelRef.current
    if (!channel || !joinedRef.current || document.visibilityState !== 'visible') return
    const payload = validateDuoPositionPayload({ senderRole:role, x, y, facing, screen, moving:Boolean(moving) })
    if (!payload) return
    const now = Date.now()
    if (now - lastSentRef.current < DUO_POSITION_THROTTLE_MS) return
    lastSentRef.current = now
    channel.send({ type:'broadcast', event:'pos', payload })
  }, [role])

  return { status:sessionId ? status : 'idle', errorCode, partnerId:sessionId ? partnerId : null, partnerPos:sessionId ? partnerPos : null, sendPosition }
}

export async function probeHost() {
  return { online:false, screen:null, code:'server_status_required' }
}

export async function isHostOnline() {
  return false
}
