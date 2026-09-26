'use client'
import { useState } from 'react'
import AnnotationPanel from '@/components/AnnotationPanel'
import ZoneMap from '@/components/ZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

// 격리된 Lab Zone("미지의 소리 마을") 코너 재배치 테스트 — 실제 게임 흐름(app/page.js,
// WorldMap 내비게이션)은 건드리지 않는다. urban-test/fence-test/library-test와 같은
// 패턴: 순수 시각 검증 전용 페이지. 실제 sound_metadata.json의 Lab 소리를 그대로 써서
// block 격자/스폰이 실제 게임과 동일하게 계산되도록 한다.
const labSounds = (soundMetadata.sounds || []).filter(s => s.game_zone === 'Lab')

export default function LabTestPage() {
  const [revision, setRevision] = useState(0)
  const [blockNum, setBlockNum] = useState(6)
  const [collectedIds, setCollectedIds] = useState(() => new Set())
  const [activeSound, setActiveSound] = useState(null)
  // Deliberately rebuild an equivalent array/object graph on every parent
  // render. ZoneMap placement must ignore this reference-only change.
  const equivalentSounds = labSounds.map(sound => ({ ...sound }))
  return (
    <main data-zone-regression-revision={revision}>
      <ZoneMap
        zone="Lab"
        sounds={equivalentSounds}
        onCollectSound={setActiveSound}
        onExit={() => setRevision(value => value + 1)}
        collectedIds={collectedIds}
        isAnnotating={Boolean(activeSound)}
        blockNum={blockNum}
        blockTotal={6}
      />
      <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 70, display: 'flex', gap: 6 }}>
        <button data-testid="zone-parent-rerender" onClick={() => setRevision(value => value + 1)}>Parent rerender</button>
        <button data-testid="zone-progress-change" onClick={() => setCollectedIds(previous => {
          const next = new Set(previous)
          const first = equivalentSounds[0]?.sound_id
          if (first) next.has(first) ? next.delete(first) : next.add(first)
          return next
        })}>Progress change</button>
        <button data-testid="zone-block-change" onClick={() => setBlockNum(value => value === 6 ? 1 : 6)}>Block change</button>
      </div>
      {activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Lab"
          participantId="ZONE_BROWSER_QA"
          sessionId="A"
          onClose={() => setActiveSound(null)}
          onComplete={() => setActiveSound(null)}
        />
      )}
    </main>
  )
}
