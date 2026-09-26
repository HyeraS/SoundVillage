'use client'
import { useMemo, useState } from 'react'
import AnnotationPanel from '@/components/AnnotationPanel'
import MusicZoneMap from '@/components/MusicZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

// 격리된 Moonlit Music Zone 테스트 — 실제 게임 흐름(app/page.js, WorldMap
// 내비게이션)은 건드리지 않는다. urban-test/library-test와 같은 패턴: 순수 시각 검증
// 전용 페이지. 실제 sound_metadata.json의 Music 소리(그룹 A)를 그대로 써서(mock 아님)
// district 배치가 실제 게임과 동일하게 계산되도록 한다.
const allMusicSounds = (soundMetadata.sounds || []).filter(s => s.game_zone === 'Music')

export default function MusicTestPage() {
  const [group, setGroup] = useState('A')
  const musicSounds = useMemo(() => allMusicSounds.filter(s => s.group === group), [group])
  const maxBlock = musicSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [blockNum, setBlockNum] = useState(1)
  const [activeSound, setActiveSound] = useState(null)
  const [debug, setDebug] = useState(false)

  const selectGroup = (nextGroup) => {
    setGroup(nextGroup)
    setBlockNum(1)
    setCollectedIds(new Set())
    setActiveSound(null)
  }

  const finishAnnotation = () => {
    if (activeSound) {
      setCollectedIds((current) => new Set(current).add(activeSound.sound_id))
    }
    setActiveSound(null)
  }

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .music-test-controls { top: auto !important; bottom: 8px; padding: 5px !important; }
          .music-test-controls .music-test-desktop-controls { display: none !important; }
        }
      `}</style>
      <MusicZoneMap
        sounds={musicSounds}
        onCollectSound={setActiveSound}
        onExit={() => {}}
        collectedIds={collectedIds}
        isAnnotating={Boolean(activeSound)}
        blockNum={blockNum}
        blockTotal={maxBlock}
        debug={debug}
      />
      {activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Music"
          participantId="MUSIC_QA_LOCAL"
          sessionId={group}
          dryRun
          onClose={() => setActiveSound(null)}
          onComplete={finishAnnotation}
        />
      )}
      <div className="music-test-controls" style={{
        position: 'fixed', top: 8, right: 8, zIndex: 999,
        background: '#000c', color: '#fff', padding: '6px 10px',
        borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
      }}>
        <span className="music-test-desktop-controls">
          Group {group}{' '}
          <button onClick={() => selectGroup('A')}>A</button>{' '}
          <button onClick={() => selectGroup('B')}>B</button>{' '}
          · blockNum: {blockNum} / {maxBlock}{' '}
          <button onClick={() => setBlockNum(b => Math.max(1, b - 1))}>-</button>{' '}
          <button onClick={() => setBlockNum(b => Math.min(maxBlock, b + 1))}>+</button>
          {' '}·{' '}
          <button onClick={() => setCollectedIds(new Set(
            musicSounds.filter(sound => (sound.block || 1) <= blockNum).map(sound => sound.sound_id)
          ))}>complete unlocked</button>{' '}
          <button onClick={() => setCollectedIds(new Set(musicSounds.map(sound => sound.sound_id)))}>complete 83</button>{' '}
          <button onClick={() => setCollectedIds(new Set())}>reset</button>
          {' '}·{' '}
        </span>
        <button data-testid="music-debug-toggle" onClick={() => setDebug(value => !value)}>
          debug {debug ? 'on' : 'off'}
        </button>
      </div>
    </>
  )
}
