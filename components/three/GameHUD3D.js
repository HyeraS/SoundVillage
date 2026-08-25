'use client'

import styles from './prototype.module.css'
import Link from 'next/link'
import { HUB_EXITS } from '@/lib/three/worldConfig.mjs'

export default function GameHUD3D({ participantId, groupId, zone, zoneProgress, nearbySound, nearbyHubTarget, sceneMode, enteredFromHub, villagesUnlocked, mockMode, debugColliders, onToggleDebug }) {
  const hubMode = sceneMode === 'hub'
  const { completed, total } = zoneProgress[zone]
  const music = zoneProgress.Music
  const animal = zoneProgress.Animal
  const percent = total ? Math.round((completed / total) * 100) : 0
  const status = hubMode
    ? nearbyHubTarget?.kind === 'village-exit'
      ? nearbyHubTarget.villageId !== 'music' && !villagesUnlocked
        ? `🔒 ${nearbyHubTarget.label} · Music 15개를 완료하면 열립니다 (${music.completed}/${music.total})`
        : !['music', 'animal'].includes(nearbyHubTarget.villageId)
          ? `✓ ${nearbyHubTarget.label} · 해금됨 · 내부 공간 미리보기`
          : `${nearbyHubTarget.label} · Enter 또는 마을 입장`
      : nearbyHubTarget?.kind === 'landmark'
        ? '중앙 광장 랜드마크 · 여섯 마을을 연결하는 기준점입니다'
        : '캐릭터 중심 3인칭 시점으로 여섯 마을 입구를 찾아보세요'
    : nearbySound?.kind === 'music-exit'
      ? '↩ 중앙 광장으로 돌아가기 · Enter 또는 Space'
      : completed === total && total > 0
    ? zone === 'Animal' ? 'Animal Block 1 완료! · Block 2는 아직 구현되지 않았습니다' : 'Music Block 1 수집 완료!'
    : nearbySound
      ? `${nearbySound.label} 발견 · Enter 또는 Space`
      : '반짝이는 소리 조각 가까이 이동하세요'

  return (
    <>
      <section className={styles.hud} aria-label="연구 프로토타입 상태">
        <div>
          <span className={styles.eyebrow}>{hubMode ? '3D ART PREVIEW · B THEME' : `3D RESEARCH · ${zone.toUpperCase()} VILLAGE`}</span>
          <strong>{hubMode ? '중앙 광장' : zone === 'Animal' ? '동물 마을' : '음악 마을'}</strong>
          {!hubMode && <span>{zone} Block 1</span>}
          <span>그룹 {groupId} · {participantId}</span>
        </div>
        {hubMode ? (
          <div className={styles.hubProgressList}>
            <div className={styles.progressWrap} aria-label={`Music 진행률 ${music.completed}/${music.total}`}><span>Music {music.completed}/{music.total}</span><div className={styles.progressTrack}><i style={{ width: `${music.total ? (music.completed / music.total) * 100 : 0}%` }} /></div></div>
            <div className={styles.progressWrap} aria-label={`Animal 진행률 ${animal.completed}/${animal.total}`}><span>Animal {animal.completed}/{animal.total}</span><div className={styles.progressTrack}><i style={{ width: `${animal.total ? (animal.completed / animal.total) * 100 : 0}%` }} /></div></div>
          </div>
        ) : (
          <div className={styles.progressWrap} aria-label={`진행률 ${percent}%`}>
            <span>{completed}/{total}</span>
            <div className={styles.progressTrack}><i style={{ width: `${percent}%` }} /></div>
          </div>
        )}
      </section>
      {hubMode && <div className={styles.hubVillageLegend} aria-label="마을 입구 6개">{HUB_EXITS.map((exit, index) => {
        const locked = exit.id !== 'music' && !villagesUnlocked
        const playable = ['music', 'animal'].includes(exit.id)
        return <span key={exit.id}><i style={{ background: locked ? '#8D8A82' : exit.color }} />{locked ? '🔒' : playable ? '●' : '✓'} {index + 1}. {exit.label}</span>
      })}</div>}
      <div className={`${styles.statusPill} ${nearbySound || nearbyHubTarget ? styles.statusReady : ''}`}>{status}</div>
      <div className={styles.tools}>
        {mockMode && <span className={styles.mockBadge}>MOCK · 저장 안 함</span>}
        <button onClick={onToggleDebug}>{debugColliders ? '충돌체 숨기기' : '충돌체 보기'}</button>
        <Link href="/">2D로 이동</Link>
      </div>
      <div className={styles.keyboardHint}>{hubMode ? '3인칭 · 드래그로 둘러보기 · WASD 이동 · 입구에서 Enter · Esc 나가기' : `WASD / 방향키 이동 · Enter / Space 상호작용 · Esc ${enteredFromHub ? '광장 복귀' : '나가기'}`}</div>
    </>
  )
}
