'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import LibraryRoom from '@/components/LibraryRoom'
import QaCharacterStudioPanel from '@/components/character-studio/QaCharacterStudioPanel'

// 격리된 Library 룸 워크스루 테스트 — 실제 게임 흐름(SoundMuseum/app/page.js)은
// 건드리지 않는다. fence-test와 같은 패턴: 순수 시각+상호작용 검증 전용 페이지.
//
// 쿼리 파라미터:
//   ?open=vote|exhibits|shop            — 외부 쓰기 없는 QA 카드 열기
//   ?qa=collision|depth|interactions|clean
//   ?state=empty|partial|complete       — 6개 전시 상태 fixture
//   ?walk=dir:ms,dir:ms,enter,esc,...  — keydown 이벤트 없이 물리/상호작용
//     로직을 동기 시뮬레이션으로 그대로 재현(헤드리스 스크린샷용 자동 재생).
//     "enter"/"esc"는 그 시점에 실제 Enter/Esc 키 입력과 같은 효과를 낸다.
function parseWalk(spec) {
  if (!spec) return null
  return spec.split(',').map(seg => {
    if (seg === 'enter' || seg === 'esc') return { action: seg }
    const [dir, ms] = seg.split(':')
    return { dir, ms: Number(ms) || 1000 }
  })
}

function LibraryTestInner() {
  const params = useSearchParams()
  const [exited, setExited] = useState(false)
  const autoWalk = parseWalk(params.get('walk'))
  const open = ['vote', 'exhibits', 'shop'].includes(params.get('open')) ? params.get('open') : null
  const qa = ['collision', 'depth', 'interactions', 'clean'].includes(params.get('qa')) ? params.get('qa') : 'clean'
  const state = ['empty', 'partial', 'complete'].includes(params.get('state')) ? params.get('state') : 'partial'
  const zones = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']
  const zoneCounts = Object.fromEntries(zones.map((zone, index) => [zone, state === 'empty'
    ? { collected:0, total:8 }
    : state === 'complete'
      ? { collected:8, total:8 }
      : { collected:index + 1, total:8 }]))
  if (exited) return <main data-testid="library-test-world-return" style={{ minHeight:'100dvh', display:'grid', placeItems:'center', background:'#E8F0DC', fontFamily:'Nunito, sans-serif' }}>
    <section style={{ textAlign:'center', color:'#29401F' }}>
      <h1>월드맵 복귀 완료</h1>
      <button type="button" onClick={() => setExited(false)}>Sound Museum 다시 들어가기</button>
    </section>
  </main>
  return <LibraryRoom
    autoWalk={autoWalk}
    initialOpen={open}
    qaMode={qa}
    zoneCounts={zoneCounts}
    activeStations={state === 'empty' ? 0 : state === 'complete' ? 5 : 3}
    cards={{
      shop:{ render:() => <QaCharacterStudioPanel sessionKey="library-test-shop"/> },
    }}
    onExit={() => setExited(true)}
  />
}

export default function LibraryTestPage() {
  return (
    <Suspense fallback={null}>
      <LibraryTestInner/>
    </Suspense>
  )
}
