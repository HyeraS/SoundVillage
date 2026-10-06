'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AnimalZoneMap from '@/components/AnimalZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { WALK_ANIMATION_QA_CHARACTER } from '@/lib/walkAnimationQa.mjs'

// 격리된 Animal Zone(동물 마을, handoff 이식) 테스트 — 실제 게임 흐름(app/page.js,
// WorldMap 내비게이션)은 건드리지 않는다. nature-test와 같은 패턴: 순수 시각 검증
// 전용 페이지. 실제 sound_metadata.json의 Animal 소리(그룹 A)를 그대로 써서(mock
// 아님) block 배치가 실제 게임과 동일하게 계산되도록 한다.
const animalSounds = (soundMetadata.sounds || []).filter(
  s => s.game_zone === 'Animal' && (!s.group || s.group === 'A')
)
const maxBlock = animalSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)

function AnimalTestContent() {
  const searchParams = useSearchParams()
  const walkAnimationQa = searchParams.get('walkAnimationQa') === '1'
  const worldScale = Math.max(0.25, Number(searchParams.get('worldScale')) || 1)
  const startX = Number(searchParams.get('startX'))
  const startY = Number(searchParams.get('startY'))
  const debugStart = searchParams.has('startX') && searchParams.has('startY')
    && Number.isFinite(startX) && Number.isFinite(startY) ? { x: startX, y: startY } : null
  const [baseOnlyOverride, setBaseOnlyOverride] = useState(false)
  const baseOnly = baseOnlyOverride || searchParams.get('baseOnly') === '1'
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [activeSound, setActiveSound] = useState(null)
  const [blockNum, setBlockNum] = useState(maxBlock)
  const [debugOptions, setDebugOptions] = useState({
    colliders: false,
    bounds: false,
    sortLines: false,
    spawnSlots: false,
    blocks: false,
    coordinates: true,
    mask: searchParams.get('collision') === '1',
  })

  const toggle = (key) => setDebugOptions((current) => ({ ...current, [key]: !current[key] }))
  const finishAnnotation = () => {
    if (activeSound) setCollectedIds((current) => new Set(current).add(activeSound.sound_id))
    setActiveSound(null)
  }

  return (
    <>
      <AnimalZoneMap
        {...(walkAnimationQa ? WALK_ANIMATION_QA_CHARACTER : {})}
        sounds={animalSounds}
        onCollectSound={setActiveSound}
        onExit={() => {}}
        collectedIds={collectedIds}
        isAnnotating={Boolean(activeSound)}
        blockNum={blockNum}
        blockTotal={maxBlock}
        debugOptions={debugOptions}
        baseOnly={baseOnly}
        debugFirstItem={searchParams.get('firstItem') === '1'}
        debugStart={debugStart}
        currentWorldWidth={1536 * worldScale}
        currentWorldHeight={1024 * worldScale}
      />
      {activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Animal"
          participantId="ANIMAL_QA_LOCAL"
          sessionId="A"
          dryRun
          onClose={() => setActiveSound(null)}
          onComplete={finishAnnotation}
        />
      )}
      {!baseOnly && (
      <div style={{
        position: 'fixed', top: 8, right: 8, zIndex: 999,
        background: '#000c', color: '#fff', padding: '6px 10px',
        borderRadius: 6, fontSize: 11, fontFamily: 'monospace', maxWidth: 360,
      }}>
        <div style={{ marginBottom: 5 }}>
          blockNum: {blockNum} / {maxBlock}{' '}
          <button onClick={() => setBlockNum(b => Math.max(1, b - 1))}>-</button>{' '}
          <button onClick={() => setBlockNum(b => Math.min(maxBlock, b + 1))}>+</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
          <input type="checkbox" checked={baseOnly} onChange={() => setBaseOnlyOverride(true)} /> base only
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
          {[
            ['colliders', '충돌'], ['bounds', '오브젝트'], ['sortLines', 'Y-sort'],
            ['spawnSlots', 'spawn'], ['blocks', '6블록'], ['coordinates', '좌표'],
            ['mask', 'PNG mask'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={debugOptions[key]} onChange={() => toggle(key)} /> {label}
            </label>
          ))}
        </div>
      </div>
      )}
    </>
  )
}

export default function AnimalTestPage() {
  return (
    <Suspense fallback={null}>
      <AnimalTestContent />
    </Suspense>
  )
}
