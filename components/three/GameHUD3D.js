'use client'

import styles from './prototype.module.css'
import Link from 'next/link'
import { HUB_EXITS } from '@/lib/three/worldConfig.mjs'

export default function GameHUD3D({ participantId, groupId, completed, total, nearbySound, nearbyHubTarget, sceneMode, mockMode, debugColliders, onToggleDebug }) {
  const hubMode = sceneMode === 'hub'
  const percent = total ? Math.round((completed / total) * 100) : 0
  const status = hubMode
    ? nearbyHubTarget?.kind === 'village-exit'
      ? `${nearbyHubTarget.label} · Enter 또는 마을 입장`
      : nearbyHubTarget?.kind === 'landmark'
        ? '중앙 광장 랜드마크 · 여섯 마을을 연결하는 기준점입니다'
        : '캐릭터 중심 3인칭 시점으로 여섯 마을 입구를 찾아보세요'
    : completed === total && total > 0
    ? 'Music Block 1 수집 완료!'
    : nearbySound
      ? `${nearbySound.label} 발견 · Enter 또는 Space`
      : '반짝이는 소리 조각 가까이 이동하세요'

  return (
    <>
      <section className={styles.hud} aria-label="연구 프로토타입 상태">
        <div>
          <span className={styles.eyebrow}>{hubMode ? '3D ART PREVIEW · B THEME' : '3D RESEARCH · MUSIC VILLAGE'}</span>
          <strong>{hubMode ? 'Central Plaza' : 'Block 1'}</strong>
          <span>그룹 {groupId} · {participantId}</span>
        </div>
        {hubMode ? (
          <div className={styles.progressWrap} aria-label="마을 입구 6개 미리보기"><span>6 VILLAGES</span><div className={styles.hubDots}>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div></div>
        ) : (
          <div className={styles.progressWrap} aria-label={`진행률 ${percent}%`}>
            <span>{completed}/{total}</span>
            <div className={styles.progressTrack}><i style={{ width: `${percent}%` }} /></div>
          </div>
        )}
      </section>
      {hubMode && <div className={styles.hubVillageLegend} aria-label="마을 입구 6개">{HUB_EXITS.map((exit, index) => <span key={exit.id}><i style={{ background: exit.color }} />{index + 1}. {exit.label}</span>)}</div>}
      <div className={`${styles.statusPill} ${nearbySound || nearbyHubTarget ? styles.statusReady : ''}`}>{status}</div>
      <div className={styles.tools}>
        {mockMode && <span className={styles.mockBadge}>MOCK · 저장 안 함</span>}
        <button onClick={onToggleDebug}>{debugColliders ? '충돌체 숨기기' : '충돌체 보기'}</button>
        <Link href="/">2D로 이동</Link>
      </div>
      <div className={styles.keyboardHint}>{hubMode ? '3인칭 · 드래그로 둘러보기 · WASD 이동 · 입구에서 Enter · Esc 나가기' : 'WASD / 방향키 이동 · Enter / Space 상호작용 · Esc 나가기'}</div>
    </>
  )
}
