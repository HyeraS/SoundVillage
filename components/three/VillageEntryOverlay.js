'use client'

import { useEffect } from 'react'
import { HUB_EXITS } from '@/lib/three/worldConfig.mjs'
import { getVillageOverlayMode } from '@/lib/three/sceneFlow.mjs'
import styles from './prototype.module.css'

export default function VillageEntryOverlay({ village, completed, total, onEnter, onClose }) {
  const mode = getVillageOverlayMode(village.villageId)
  const isMusic = mode === 'enter'

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
        <span className={styles.villageEntryIcon} aria-hidden="true">⌂</span>
        <span className={styles.eyebrow}>{isMusic ? 'MUSIC VILLAGE · BLOCK 1' : 'VILLAGE GATEWAY CONNECTED'}</span>
        <h2 id="village-entry-title">{isMusic ? '음악 마을' : `${village.label.replace(' 입구', '')}에 도착했어요`}</h2>
        <p>{isMusic ? '음악과 관련된 소리를 듣고, 들리는 느낌과 표현을 직접 남기는 연구 마을입니다.' : '중앙 광장에서 이 마을 입구로 진입하는 연결을 확인했습니다.'}</p>
        <p className={styles.villageEntryNote}>{isMusic ? `현재 완료 ${completed}/${total}` : '마을 내부의 건물과 연구 콘텐츠는 다음 제작 단계에서 추가됩니다.'}</p>
        <div className={styles.villageEntryList} aria-label="연결된 마을 6개">
          {HUB_EXITS.map(exit => <span key={exit.id} className={exit.id === village.villageId ? styles.villageEntryCurrent : ''}>{exit.label}</span>)}
        </div>
        {isMusic ? (
          <div className={styles.villageEntryActions}>
            <button onClick={onEnter}>마을 들어가기</button>
            <button className={styles.secondaryButton} onClick={onClose}>취소</button>
          </div>
        ) : <button onClick={onClose}>중앙 광장으로 돌아가기</button>}
      </div>
    </section>
  )
}
