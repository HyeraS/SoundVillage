'use client'

import { useState } from 'react'
import WorldMapDiagram from './WorldMapDiagram'
import styles from './WorldMapMinimap.module.css'

export default function WorldMinimap({ playerFoot, lockedZones, objective, nearDestinationId, homeState = 'default', onOpen }) {
  const [collapsed, setCollapsed] = useState(false)
  const targetText = objective?.destinationId
    ? `${objective.arrived ? '도착한 ' : '현재 목표 '} ${objective.destinationId}`
    : '현재 목표 없음'

  return (
    <aside className={`${styles.minimapShell} ${collapsed ? styles.collapsed : ''}`} aria-label="월드맵 미니맵" data-testid="world-minimap">
      <div className={styles.minimapHeader}>
        <span aria-hidden="true">🗺</span>
        <strong>마을 지도</strong>
        <button type="button" className={styles.collapseButton} onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed} aria-label={collapsed ? '미니맵 펼치기' : '미니맵 접기'}>{collapsed ? '＋' : '−'}</button>
      </div>
      {!collapsed && (
        <button type="button" className={styles.openButton} onClick={onOpen} aria-label={`전체 지도 열기, ${targetText}`} data-testid="world-minimap-open">
          <WorldMapDiagram playerFoot={playerFoot} lockedZones={lockedZones} objective={objective} nearDestinationId={nearDestinationId} homeState={homeState}/>
          <span className={styles.openHint} aria-hidden="true">눌러서 크게 보기</span>
        </button>
      )}
    </aside>
  )
}
