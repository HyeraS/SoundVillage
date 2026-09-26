'use client'
import { useEffect, useState } from 'react'
import NatureZoneMap from '@/components/NatureZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

// 격리된 Nature Zone(자연 마을, handoff 이식) 테스트 — 실제 게임 흐름(app/page.js,
// WorldMap 내비게이션)은 건드리지 않는다. music-test와 같은 패턴: 순수 시각 검증
// 전용 페이지. 실제 sound_metadata.json의 Nature 소리(그룹 A)를 그대로 써서(mock
// 아님) block 배치가 실제 게임과 동일하게 계산되도록 한다.
const natureSounds = (soundMetadata.sounds || []).filter(
  s => s.game_zone === 'Nature' && (!s.group || s.group === 'A')
)
const maxBlock = natureSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)

const REVIEW_VIEWS = {
  entrance: { label: '남쪽 입구', target: { x: 18, y: 33 } },
  exit: { label: '월드맵 출구 트리거', target: { x: 12, y: 34 } },
  lowerBridge: { label: '아래 다리', target: { x: 26, y: 28 } },
  orchard: { label: '동쪽 과수원', target: { x: 37, y: 21 } },
  upperBridge: { label: '위쪽 다리', target: { x: 21, y: 11 } },
  mill: { label: '북서 물레방앗간', target: { x: 13, y: 9 } },
  greenhouse: { label: '북동 온실', target: { x: 40, y: 9 } },
  westFields: { label: '서쪽 밭', target: { x: 15, y: 18 } },
  overview: { label: '전체 조감', target: null, overview: true },
  staticArt: { label: '배경 전용 전체 조감', target: null, overview: true, staticArt: true },
}

export default function NatureTestPage() {
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [blockNum, setBlockNum] = useState(maxBlock)
  const [reviewView, setReviewView] = useState('entrance')
  const [captureClean, setCaptureClean] = useState(false)
  const review = REVIEW_VIEWS[reviewView]

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('capture') !== '1') return
    const timer = window.setTimeout(() => {
      setReviewView('staticArt')
      setCaptureClean(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <NatureZoneMap
        sounds={natureSounds}
        onCollectSound={(sound) => setCollectedIds(prev => new Set([...prev, sound.sound_id]))}
        onExit={() => {}}
        collectedIds={collectedIds}
        blockNum={blockNum}
        blockTotal={maxBlock}
        debugTarget={review.target}
        debugOverview={!!review.overview}
        debugStaticArt={!!review.staticArt}
      />
      <div style={{
        position: 'fixed', top: 8, right: 8, zIndex: 999,
        background: '#000c', color: '#fff', padding: '6px 10px',
        borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
        opacity: captureClean ? 0 : 1,
        pointerEvents: captureClean ? 'none' : 'auto',
      }}>
        blockNum: {blockNum} / {maxBlock}{' '}
        <button onClick={() => setBlockNum(b => Math.max(1, b - 1))}>-</button>{' '}
        <button onClick={() => setBlockNum(b => Math.min(maxBlock, b + 1))}>+</button>{' '}
        <select aria-label="Nature 리뷰 위치" value={reviewView} onChange={(event) => setReviewView(event.target.value)}>
          {Object.entries(REVIEW_VIEWS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
        {review.staticArt && <> <a href="/nature-test?capture=1" style={{ color: '#fff' }}>깨끗한 캡처</a></>}
      </div>
    </>
  )
}
