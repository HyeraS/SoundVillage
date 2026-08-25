'use client'
import { useState } from 'react'
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

export default function NatureTestPage() {
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [blockNum, setBlockNum] = useState(maxBlock)

  return (
    <>
      <NatureZoneMap
        sounds={natureSounds}
        onCollectSound={(sound) => setCollectedIds(prev => new Set([...prev, sound.sound_id]))}
        onExit={() => {}}
        collectedIds={collectedIds}
        blockNum={blockNum}
        blockTotal={maxBlock}
      />
      <div style={{
        position: 'fixed', top: 8, right: 8, zIndex: 999,
        background: '#000c', color: '#fff', padding: '6px 10px',
        borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
      }}>
        blockNum: {blockNum} / {maxBlock}{' '}
        <button onClick={() => setBlockNum(b => Math.max(1, b - 1))}>-</button>{' '}
        <button onClick={() => setBlockNum(b => Math.min(maxBlock, b + 1))}>+</button>
      </div>
    </>
  )
}
