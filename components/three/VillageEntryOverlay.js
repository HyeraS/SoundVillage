'use client'

import { useEffect } from 'react'
import { HUB_EXITS } from '@/lib/three/worldConfig.mjs'
import { getVillageAccessState } from '@/lib/three/sceneFlow.mjs'
import styles from './prototype.module.css'

export default function VillageEntryOverlay({ village, completed, total, villagesUnlocked, onEnter, onClose }) {
  const access = getVillageAccessState(village.villageId, villagesUnlocked)
  const mode = access.mode
  const isMusic = mode === 'enter'
  const isLocked = mode === 'locked'
  const isUnlockedPreview = mode === 'unlocked-preview'

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (isMusic && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onEnter() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMusic, onClose, onEnter])

  return (
    <section className={styles.villageEntryOverlay} role="dialog" aria-modal="true" aria-labelledby="village-entry-title">
      <div className={styles.villageEntryCard} style={{ '--village-color': village.color }}>
        <span className={styles.villageEntryIcon} aria-hidden="true">{isLocked ? '🔒' : isUnlockedPreview ? '✓' : '⌂'}</span>
        <span className={styles.eyebrow}>{isMusic ? 'MUSIC VILLAGE · BLOCK 1' : isLocked ? 'VILLAGE LOCKED' : 'VILLAGE UNLOCKED · PREVIEW'}</span>
        <h2 id="village-entry-title">{isMusic ? '음악 마을' : `${village.label.replace(' 입구', '')} ${isLocked ? '잠김' : '해금됨'}`}</h2>
        <p>{isMusic ? '음악과 관련된 소리를 듣고, 들리는 느낌과 표현을 직접 남기는 연구 마을입니다.' : isLocked ? 'Music 15개를 완료하면 열립니다.' : '마을이 해금되었습니다 · 내부 공간은 다음 단계에서 연결됩니다.'}</p>
        <p className={styles.villageEntryNote}>{isMusic ? `현재 완료 ${completed}/${total}` : isLocked ? `Music 진행률 ${completed}/${total}` : `Music ${completed}/${total} 완료 · 데이터 구역 ${access.dataZone}`}</p>
        <div className={styles.villageEntryList} aria-label="연결된 마을 6개">
          {HUB_EXITS.map(exit => <span key={exit.id} className={exit.id === village.villageId ? styles.villageEntryCurrent : ''}>{exit.label}</span>)}
        </div>
        {isMusic ? (
          <div className={styles.villageEntryActions}>
            <button onClick={onEnter}>마을 들어가기</button>
            <button className={styles.secondaryButton} onClick={onClose}>취소</button>
          </div>
        ) : isLocked ? (
          <div className={styles.villageEntryActions}>
            <button disabled>마을 들어가기</button>
            <button className={styles.secondaryButton} onClick={onClose}>취소</button>
          </div>
        ) : <button onClick={onClose}>중앙 광장으로 돌아가기</button>}
      </div>
    </section>
  )
}
