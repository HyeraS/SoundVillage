'use client'

import styles from './prototype.module.css'
import Link from 'next/link'

export default function GameHUD3D({ participantId, groupId, completed, total, nearbySound, mockMode, debugColliders, onToggleDebug }) {
  const percent = total ? Math.round((completed / total) * 100) : 0
  const status = completed === total && total > 0
    ? 'Music Block 1 수집 완료!'
    : nearbySound
      ? `${nearbySound.label} 발견 · Enter 또는 Space`
      : '반짝이는 소리 조각 가까이 이동하세요'

  return (
    <>
      <section className={styles.hud} aria-label="연구 프로토타입 상태">
        <div>
          <span className={styles.eyebrow}>3D RESEARCH · MUSIC VILLAGE</span>
          <strong>Block 1</strong>
          <span>그룹 {groupId} · {participantId}</span>
        </div>
        <div className={styles.progressWrap} aria-label={`진행률 ${percent}%`}>
          <span>{completed}/{total}</span>
          <div className={styles.progressTrack}><i style={{ width: `${percent}%` }} /></div>
        </div>
      </section>
      <div className={`${styles.statusPill} ${nearbySound ? styles.statusReady : ''}`}>{status}</div>
      <div className={styles.tools}>
        {mockMode && <span className={styles.mockBadge}>MOCK · 저장 안 함</span>}
        <button onClick={onToggleDebug}>{debugColliders ? '충돌체 숨기기' : '충돌체 보기'}</button>
        <Link href="/">2D로 이동</Link>
      </div>
      <div className={styles.keyboardHint}>WASD / 방향키 이동 · Enter / Space 상호작용 · Esc 나가기</div>
    </>
  )
}
