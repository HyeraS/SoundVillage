'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AnnotationPanel from '@/components/AnnotationPanel'
import ZoneMap from '@/components/ZoneMap'
import LabZoneMap from '@/components/LabZoneMap'
import soundMetadata from '@/data/sound_metadata.json'
import { WALK_ANIMATION_QA_CHARACTER } from '@/lib/walkAnimationQa.mjs'

// 격리된 Lab Zone("미지의 소리 마을") 코너 재배치 테스트 — 실제 게임 흐름(app/page.js,
// WorldMap 내비게이션)은 건드리지 않는다. urban-test/fence-test/library-test와 같은
// 패턴: 순수 시각 검증 전용 페이지. 실제 sound_metadata.json의 Lab 소리를 그대로 써서
// block 격자/스폰이 실제 게임과 동일하게 계산되도록 한다.
const labSounds = (soundMetadata.sounds || []).filter(s => s.game_zone === 'Lab')

function LabTestContent() {
  const searchParams = useSearchParams()
  const walkAnimationQa = searchParams.get('walkAnimationQa') === '1'
  const worldScale = Math.max(0.25, Number(searchParams.get('worldScale')) || 1)
  const startX = Number(searchParams.get('startX'))
  const startY = Number(searchParams.get('startY'))
  const debugStart = searchParams.has('startX') && searchParams.has('startY')
    && Number.isFinite(startX) && Number.isFinite(startY) ? { x: startX, y: startY } : null
  const [revision, setRevision] = useState(0)
  const [blockNum, setBlockNum] = useState(6)
  const [collectedIds, setCollectedIds] = useState(() => new Set())
  const [activeSound, setActiveSound] = useState(null)
  // Deliberately rebuild an equivalent array/object graph on every parent
  // render. ZoneMap placement must ignore this reference-only change.
  const equivalentSounds = labSounds.map(sound => ({ ...sound }))
  if (searchParams.get('runtime') === '1') {
    return (
      <LabZoneMap
        {...(walkAnimationQa ? WALK_ANIMATION_QA_CHARACTER : {})}
        sounds={equivalentSounds}
        onCollectSound={setActiveSound}
        onExit={() => setRevision(value => value + 1)}
        collectedIds={collectedIds}
        isAnnotating={Boolean(activeSound)}
        blockNum={blockNum}
        blockTotal={6}
        debugFirstItem={searchParams.get('firstItem') === '1'}
        debugStart={debugStart}
        debugCollision={searchParams.get('collision') === '1'}
        currentWorldWidth={1536 * worldScale}
        currentWorldHeight={1152 * worldScale}
      />
    )
  }
  return (
    <main data-zone-regression-revision={revision}>
      <ZoneMap
        {...(walkAnimationQa ? WALK_ANIMATION_QA_CHARACTER : {})}
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

export default function LabTestPage() {
  return <Suspense fallback={null}><LabTestContent /></Suspense>
}
