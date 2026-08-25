'use client'

import { useEffect } from 'react'
import styles from './prototype.module.css'

export default function MusicExitOverlay({ zone = 'Music', color = '#E88C72', onConfirm, onClose }) {
  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onConfirm() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onConfirm])

  return (
    <section className={styles.villageEntryOverlay} role="dialog" aria-modal="true" aria-labelledby="music-exit-title">
      <div className={styles.villageEntryCard} style={{ '--village-color': color }}>
        <span className={styles.villageEntryIcon} aria-hidden="true">↩</span>
        <span className={styles.eyebrow}>{zone.toUpperCase()} VILLAGE EXIT</span>
        <h2 id="music-exit-title">중앙 광장으로 돌아갈까요?</h2>
        <p>{zone} 진행 상태를 유지한 채 입구 근처의 중앙 광장으로 돌아갑니다.</p>
        <div className={styles.villageEntryActions}>
          <button onClick={onConfirm}>광장으로 돌아가기</button>
          <button className={styles.secondaryButton} onClick={onClose}>취소</button>
        </div>
      </div>
    </section>
  )
}
