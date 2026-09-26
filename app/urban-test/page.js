'use client'

import { useMemo, useState } from 'react'
import UrbanZoneMap from '@/components/UrbanZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

const allUrbanSounds = (soundMetadata.sounds || []).filter((sound) => sound.game_zone === 'Urban')

export default function UrbanTestPage() {
  const [group, setGroup] = useState('A')
  const urbanSounds = useMemo(() => allUrbanSounds.filter((sound) => sound.group === group), [group])
  const maxBlock = urbanSounds.reduce((max, sound) => Math.max(max, sound.block || 1), 1)
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [blockNum, setBlockNum] = useState(maxBlock)
  const [view, setView] = useState('entrance')
  const [controlsVisible, setControlsVisible] = useState(true)

  const selectGroup = (nextGroup) => {
    setGroup(nextGroup)
    setBlockNum(maxBlock)
    setCollectedIds(new Set())
    setView('entrance')
  }

  return (
    <>
      <style>{`
        @media (max-width: 600px) { .urban-test-controls { display: none !important; } }
        @media (min-width: 601px) and (max-width: 900px) {
          .urban-test-controls { transform: scale(.72); transform-origin: top right; }
        }
      `}</style>
      <UrbanZoneMap
        key={`${group}-${view}`}
        sounds={urbanSounds}
        onCollectSound={(sound) => setCollectedIds((previous) => new Set([...previous, sound.sound_id]))}
        onExit={() => {}}
        collectedIds={collectedIds}
        blockNum={blockNum}
        blockTotal={maxBlock}
        debugStart={
          view === 'metro'
            ? { tx: 24, ty: 11 }
            : view === 'midcity'
              ? { tx: 24, ty: 20 }
              : null
        }
      />
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
