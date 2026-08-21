'use client'

import { HUB_EXITS } from '@/lib/three/worldConfig.mjs'
import styles from './prototype.module.css'

export default function VillageEntryOverlay({ village, onClose }) {
  return (
    <section className={styles.villageEntryOverlay} role="dialog" aria-modal="true" aria-labelledby="village-entry-title">
      <div className={styles.villageEntryCard} style={{ '--village-color': village.color }}>
        <span className={styles.villageEntryIcon} aria-hidden="true">⌂</span>
        <span className={styles.eyebrow}>VILLAGE GATEWAY CONNECTED</span>
        <h2 id="village-entry-title">{village.label.replace(' 입구', '')}에 도착했어요</h2>
        <p>중앙 광장에서 이 마을 입구로 진입하는 연결을 확인했습니다.</p>
        <p className={styles.villageEntryNote}>마을 내부의 건물과 연구 콘텐츠는 다음 제작 단계에서 추가됩니다.</p>
        <div className={styles.villageEntryList} aria-label="연결된 마을 6개">
          {HUB_EXITS.map(exit => <span key={exit.id} className={exit.id === village.villageId ? styles.villageEntryCurrent : ''}>{exit.label}</span>)}
        </div>
        <button onClick={onClose}>중앙 광장으로 돌아가기</button>
      </div>
    </section>
  )
}
