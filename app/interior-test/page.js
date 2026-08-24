'use client'

import { useEffect, useState } from 'react'
import InteriorDecorRoom from '@/components/InteriorDecorRoom'
import { FRIEND_ROOM } from '@/lib/interiorFixtures'
import { getRoom } from '@/lib/interiorDecor'
import { probeHost } from '@/lib/duoSession'

/* ─────────────────────────────────────────────
   집꾸미기 검증용 라우트 — 지금까지의 전체 단계(스테이지/편집/보관함/상점/
   공개 게이팅/초대/실시간 동행)를 한 화면에서 확인한다.

   ?house=<참가자ID>로 들어오면 "친구 방 보기"인데, duoSession.js의
   probeHost로 호스트가 "지금 어느 화면에 있는지"까지 확인한다:
     - 정확히 월드맵에 있으면 "/?duo=<호스트>"로 보내서 월드맵에서 같이
       돌아다니게 한다(2단계의 ?duo= 처리 재사용 — 여기선 리다이렉트만 함).
     - 집 안에 있거나(4단계) 오프라인이면 그대로 아래 방문 화면으로 들어간다
       — InteriorDecorRoom이 방문 모드에서도 같은 duo 채널에 접속하므로,
       호스트가 지금 집 안에 있다면 그 자리에서 실시간으로 같이 보이고,
       오프라인이면 저장된 방을 읽기 전용으로 구경하게 된다(room은
       lib/interiorDecor.js의 getRoom → 스키마 미실행/미저장 시 FRIEND_ROOM
       픽스처로 대체).
───────────────────────────────────────────── */
export default function InteriorTestPage() {
  const [visiting, setVisiting] = useState(null) // null | { id, room }
  const [checkedVisit, setCheckedVisit] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  // 내 방 테스트용 참여자ID — ?me=로 바꿔가며 실제 Supabase 저장/구매 연동을
  // 여러 계정으로 확인할 수 있게 한다(기본값은 지금까지 쓰던 AUDIOTEST 그대로).
  // SSR에서는 window가 없으니 기본값으로 시작하고, 마운트 후 실제 쿼리로 갱신한다.
  const [meId, setMeId] = useState('AUDIOTEST')
  useEffect(() => {
    setMeId(new URLSearchParams(window.location.search).get('me')?.trim() || 'AUDIOTEST')
  }, [])

  useEffect(() => {
    const houseId = new URLSearchParams(window.location.search).get('house')?.trim()
    if (!houseId) { setCheckedVisit(true); return }
    let cancelled = false
    probeHost(houseId).then(({ screen }) => {
      if (cancelled) return
      if (screen === 'worldmap') {
        setRedirecting(true)
        window.location.assign(`/?duo=${encodeURIComponent(houseId)}`)
        return
      }
      getRoom(houseId).then(room => {
        if (cancelled) return
        setVisiting({ id: houseId, room: room ?? FRIEND_ROOM })
        setCheckedVisit(true)
      })
    })
    return () => { cancelled = true }
  }, [])

  if (redirecting) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EDE2C6', fontFamily: "'Gothic A1', sans-serif" }}>
        지금 접속해 있어요 — 같이 놀 수 있는 곳으로 이동할게요…
      </main>
    )
  }
  if (!checkedVisit) return null

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#6E5844',
      backgroundImage:
        'linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px)',
      backgroundSize: '8px 8px',
      padding: '24px',
    }}>
      {visiting ? (
        <InteriorDecorRoom
          visitorMode
          visitorName={visiting.id}
          initialRoom={visiting.room}
          onLeaveVisit={() => window.location.assign(window.location.pathname)}
        />
      ) : (
        <InteriorDecorRoom participantId={meId} />
      )}
    </main>
  )
}
