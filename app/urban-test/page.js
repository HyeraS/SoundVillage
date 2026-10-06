'use client'

import { useEffect, useMemo, useState } from 'react'
import UrbanV3ZoneMap from '@/components/UrbanV3ZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { WALK_ANIMATION_QA_CHARACTER } from '@/lib/walkAnimationQa.mjs'

const allUrbanSounds = (soundMetadata.sounds || []).filter((sound) => sound.game_zone === 'Urban')

export default function UrbanTestPage() {
  const [group, setGroup] = useState('A')
  const urbanSounds = useMemo(() => allUrbanSounds.filter((sound) => sound.group === group), [group])
  const maxBlock = urbanSounds.reduce((max, sound) => Math.max(max, sound.block || 1), 1)
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [activeSound, setActiveSound] = useState(null)
  const [blockNum, setBlockNum] = useState(maxBlock)
  const [view, setView] = useState('entrance')
  const [controlsVisible, setControlsVisible] = useState(true)
  const [walkAnimationQa, setWalkAnimationQa] = useState(false)
  const [worldScale, setWorldScale] = useState(1)
  const [debugCollision, setDebugCollision] = useState(false)
  const [debugFirstItem, setDebugFirstItem] = useState(false)
  const [debugStart, setDebugStart] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search)
      setWalkAnimationQa(query.get('walkAnimationQa') === '1')
      setWorldScale(Math.max(0.25, Number(query.get('worldScale')) || 1))
      setDebugCollision(query.get('collision') === '1')
      setDebugFirstItem(query.get('firstItem') === '1')
      const startX = Number(query.get('startX'))
      const startY = Number(query.get('startY'))
      setDebugStart(query.has('startX') && query.has('startY') && Number.isFinite(startX) && Number.isFinite(startY) ? { x: startX, y: startY } : null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selectGroup = (nextGroup) => {
    setGroup(nextGroup)
    setBlockNum(maxBlock)
    setCollectedIds(new Set())
    setActiveSound(null)
    setView('entrance')
  }

  const finishAnnotation = () => {
    if (activeSound) setCollectedIds((current) => new Set(current).add(activeSound.sound_id))
    setActiveSound(null)
  }

  return (
    <>
      <style>{`
        @media (max-width: 600px) { .urban-test-controls { display: none !important; } }
        @media (min-width: 601px) and (max-width: 900px) {
          .urban-test-controls { transform: scale(.72); transform-origin: top right; }
        }
      `}</style>
      <UrbanV3ZoneMap
        {...(walkAnimationQa ? WALK_ANIMATION_QA_CHARACTER : {})}
        key={`${group}-${view}`}
        sounds={urbanSounds}
        onCollectSound={setActiveSound}
        onExit={() => {}}
        collectedIds={collectedIds}
        isAnnotating={Boolean(activeSound)}
        blockNum={blockNum}
        blockTotal={maxBlock}
        currentWorldWidth={1448 * worldScale}
        currentWorldHeight={1086 * worldScale}
        debugCollision={debugCollision}
        debugFirstItem={debugFirstItem}
        debugStart={debugStart}
      />
      {activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Urban"
          participantId="URBAN_QA_LOCAL"
          sessionId={group}
          dryRun
          onClose={() => setActiveSound(null)}
          onComplete={finishAnnotation}
        />
      )}
      {controlsVisible && <div className="urban-test-controls" data-urban-qa-controls style={{
        position: 'fixed', top: 62, right: 8, zIndex: 999,
        background: '#06112eea', color: '#eafcff', padding: '7px 10px',
        border: '1px solid #51d7f0', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
      }}>
        Group {group}{' '}
        <button data-qa-group="A" onClick={() => selectGroup('A')}>A</button>{' '}
        <button data-qa-group="B" onClick={() => selectGroup('B')}>B</button>{' '}
        · block {blockNum}/{maxBlock}{' '}
        <button data-qa-block-down onClick={() => setBlockNum((block) => Math.max(1, block - 1))}>-</button>{' '}
        <button data-qa-block-up onClick={() => setBlockNum((block) => Math.min(maxBlock, block + 1))}>+</button>{' '}
        · view <button data-qa-view-entrance onClick={() => setView('entrance')}>entrance</button>{' '}
        <button data-qa-view-midcity onClick={() => setView('midcity')}>midcity</button>{' '}
        <button data-qa-view-metro onClick={() => setView('metro')}>metro</button>{' '}
        <button data-qa-hide-controls onClick={() => setControlsVisible(false)}>hide QA</button>{' '}
        · <button data-qa-complete-unlocked onClick={() => setCollectedIds(new Set(
          urbanSounds.filter((sound) => (sound.block || 1) <= blockNum).map((sound) => sound.sound_id)
        ))}>complete unlocked</button>{' '}
        <button data-qa-reset onClick={() => setCollectedIds(new Set())}>reset</button>
      </div>}
    </>
  )
}
