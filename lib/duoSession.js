'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient } from '@/lib/supabase'

/* ─────────────────────────────────────────────
   실시간 초대 동행("맵에서 같이 게임하는 기능") 1단계 — 배관.
   Supabase Realtime의 Presence(누가 접속해 있는지)와 Broadcast(위치를
   자주 쏘기)를 합쳐서, 초대한 사람(hostId)과 그 링크로 들어온 친구가
   같은 채널에 join하면 서로의 위치를 실시간으로 주고받게 한다.

   채널 하나 = 호스트 한 명의 세션(1:1). 이름은 hostId로만 정해지므로,
   호스트가 접속해 있을 때 그 링크로 들어온 사람과만 짝지어진다 —
   월드맵 전체 참여자가 다 보이는 오픈월드가 아니라 딱 둘만.

   이 단계에서는 WorldMap/InteriorRoom을 아직 건드리지 않는다. 위치를
   "어디에" 그릴지(2단계: 월드맵, 4단계: 집 안)는 다음 단계에서 이 훅을
   가져다 쓰기만 하면 되도록, 화면(screen) 좌표계에 대한 가정을 아예
   갖지 않고 x/y/facing/screen을 그대로 전달만 한다.
───────────────────────────────────────────── */

const POS_THROTTLE_MS = 120 // 초당 최대 ~8회 — 캐릭터 이동엔 충분하고 Realtime 요금/대역폭엔 부담 없는 선
const STALE_MS = 4000 // 이 시간 동안 위치를 못 받으면 "나갔다"로 간주 — 탭을 깨끗이 닫으면
// presence leave가 빨리 오지만, 와이파이가 끊기거나 노트북이 잠드는 등 소켓
// close 핸드셰이크 없이 연결이 끊기면 presence만으로는 한참(서버 하트비트
// 타임아웃까지) 감지가 안 돼서, 화면에 상대가 멈춘 채로 계속 남아있게 된다.
// 매 프레임 screen과 무관하게 계속 위치를 쏘는 관례(WorldMap/InteriorRoom)
// 덕분에, 마지막 수신 후 이 시간만 지나면 안전하게 "없어짐"으로 볼 수 있다.

export function duoChannelName(hostId) {
  return `duo:${hostId}`
}

/* status: 'connecting' | 'joined' | 'closed'
   partnerId: presence로 확인된 상대의 selfId (아직 위치를 한 번도 못 받았어도 true) | null
   partnerPos: 상대가 broadcast한 마지막 위치 { x, y, facing, moving, screen, at } | null
   sendPosition(x, y, facing, screen, moving?): 내 위치를 상대에게 쏜다(스로틀 적용,
     호출부는 매 프레임 불러도 된다) */
export function useDuoSession(hostId, selfId) {
  const [status, setStatus] = useState('connecting')
  const [partnerId, setPartnerId] = useState(null)
  const [partnerPos, setPartnerPos] = useState(null)
  const channelRef = useRef(null)
  const lastSentRef = useRef(0)
  const joinedRef = useRef(false) // 소켓이 SUBSCRIBED되기 전에 send()를 부르면 supabase-js가
  // 매번 REST로 폴백해서 느리고(곧 deprecate 경고도 뜬다) — 아직 안 붙었으면
  // sendPosition을 조용히 무시한다. status(state)는 리렌더를 거쳐야 반영되니
  // 매 프레임 호출되는 sendPosition 안에서는 이 ref로 즉시 확인한다.

  useEffect(() => {
    if (!hostId || !selfId) return
    // React가 이펙트를 두 번 태우는 경우(StrictMode dev, 빠른 리마운트 등) 먼저
    // 만든 채널이 언마운트 이후에도 비동기 콜백을 늦게 던질 수 있다. active로
    // "지금 이 채널이 최신인지"를 확인해서, 이미 정리된 채널의 늦은 응답이
    // 최신 채널의 상태를 덮어쓰지 않게 막는다.
    let active = true
    joinedRef.current = false

    const channel = getClient().channel(duoChannelName(hostId), {
      config: { presence: { key: selfId } },
    })
    channelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      if (!active) return
      const state = channel.presenceState()
      const otherKey = Object.keys(state).find(k => k !== selfId)
      setPartnerId(otherKey || null)
      if (!otherKey) setPartnerPos(null)
    })

    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!active || !payload || payload.id === selfId) return
      setPartnerPos({ x: payload.x, y: payload.y, facing: payload.facing, moving: !!payload.moving, screen: payload.screen, at: Date.now() })
    })

    channel.subscribe(async subStatus => {
      if (subStatus === 'SUBSCRIBED') {
        await channel.track({ id: selfId, joinedAt: Date.now() })
        if (!active) return
        joinedRef.current = true
        setStatus('joined')
      } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
        if (!active) return
        joinedRef.current = false
        setStatus('closed')
      }
    })

    return () => {
      active = false
      joinedRef.current = false
      channel.unsubscribe()
      getClient().removeChannel(channel)
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [hostId, selfId])

  // presence leave가 안 오는 지저분한 연결 끊김(네트워크 끊김/절전 등)에 대비한
  // 안전망 — 마지막으로 받은 위치가 STALE_MS보다 오래됐으면 정리한다.
  useEffect(() => {
    const id = setInterval(() => {
      setPartnerPos(prev => (prev && Date.now() - prev.at > STALE_MS ? null : prev))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const sendPosition = useCallback((x, y, facing, screen, moving = false) => {
    const channel = channelRef.current
    if (!channel || !joinedRef.current) return
    const now = Date.now()
    if (now - lastSentRef.current < POS_THROTTLE_MS) return
    lastSentRef.current = now
    channel.send({ type: 'broadcast', event: 'pos', payload: { id: selfId, x, y, facing, moving, screen } })
  }, [selfId])

  return { status, partnerId, partnerPos, sendPosition }
}

/* 초대 흐름(3단계 월드맵, 4단계 집 안) — 링크를 연 사람이 "지금 호스트가
   접속해 있는지", 접속해 있다면 "어느 화면에 있는지"를 한 번만 확인할 때
   쓰는 일회성 프로브. useDuoSession처럼 계속 붙어있지 않고, 같은 채널
   (duo:<hostId>)에 잠깐 구독만 해서 presence 스냅샷 + 첫 위치 broadcast를
   엿보고 바로 나간다 — 내 쪽 presence는 track()하지 않으므로 호스트 화면에
   이 프로브가 "친구 접속함"으로 잘못 잡히지 않는다.
   host의 useDuoSession은 WorldMap/InteriorDecorRoom이 떠 있는 동안 자기
   자신을 기본 hostId로 자동 track하고 매 프레임 screen 필드가 담긴 위치를
   쏘므로(2/4단계), presence만으론 "접속함"까지만 알 수 있고 "월드맵인지
   집 안인지"는 실제 broadcast를 한 번 받아봐야 안다 — presence sync가
   와도 바로 끝내지 않고 짧게 더 기다려 broadcast를 노려본다.
   반환: { online, screen } — screen은 'worldmap' | 'interior:<참여자ID>' | null
   (접속해 있어도 timeoutMs 안에 broadcast를 못 받으면 null). */
export function probeHost(hostId, timeoutMs = 1500) {
  return new Promise(resolve => {
    if (!hostId) { resolve({ online: false, screen: null }); return }
    let settled = false
    let online = false
    const channel = getClient().channel(duoChannelName(hostId))
    const settle = screen => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      channel.unsubscribe()
      getClient().removeChannel(channel)
      resolve({ online: online || !!screen, screen: screen || null })
    }
    const timer = setTimeout(() => settle(null), timeoutMs)
    channel.on('presence', { event: 'sync' }, () => {
      if (Object.keys(channel.presenceState()).length > 0) online = true
    })
    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (payload?.screen) settle(payload.screen)
    })
    channel.subscribe(subStatus => {
      if (subStatus === 'SUBSCRIBED') {
        if (Object.keys(channel.presenceState()).length > 0) online = true
      } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
        settle(null)
      }
    })
  })
}

/* 3단계 초기 버전과의 호환용 — 접속 여부만 필요할 때. */
export async function isHostOnline(hostId, timeoutMs = 1500) {
  const { online } = await probeHost(hostId, timeoutMs)
  return online
}
