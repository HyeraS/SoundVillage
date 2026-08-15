'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import LibraryRoom from '@/components/LibraryRoom'

// 격리된 Library 룸 워크스루 테스트 — 실제 게임 흐름(SoundMuseum/app/page.js)은
// 건드리지 않는다. fence-test와 같은 패턴: 순수 시각+상호작용 검증 전용 페이지.
//
// 쿼리 파라미터:
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
  const autoWalk = parseWalk(params.get('walk'))
  return <LibraryRoom autoWalk={autoWalk}/>
}

export default function LibraryTestPage() {
  return (
    <Suspense fallback={null}>
      <LibraryTestInner/>
    </Suspense>
  )
}
