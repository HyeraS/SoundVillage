'use client'

import { useEffect, useRef } from 'react'
import WorldMapDiagram, { getWorldDestinationPresentation } from './WorldMapDiagram'
import { WORLD_MINIMAP_DESTINATIONS } from '@/lib/worldMapMinimap.mjs'
import styles from './WorldMapMinimap.module.css'

export default function WorldMapOverlay({ playerFoot, lockedZones, objective, nearDestinationId, homeState = 'default', onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose('escape')
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const objectiveDestination = WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === objective?.destinationId)
  const objectiveLabel = objectiveDestination ? getWorldDestinationPresentation(objectiveDestination).label : null

  return (
    <div className={styles.overlayBackdrop} onPointerDown={event => { if (event.target === event.currentTarget) onClose('backdrop') }} data-testid="world-map-overlay-backdrop">
      <section ref={dialogRef} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="world-map-overlay-title" data-testid="world-map-overlay">
        <header className={styles.overlayHeader}>
          <div>
            <p>Sound Village</p>
            <h2 id="world-map-overlay-title">전체 지도</h2>
          </div>
          <button ref={closeRef} type="button" className={styles.closeButton} onClick={() => onClose('close_button')} aria-label="전체 지도 닫기">✕</button>
        </header>
        <div className={styles.overlayMap}>
          <WorldMapDiagram playerFoot={playerFoot} lockedZones={lockedZones} objective={objective} nearDestinationId={nearDestinationId} homeState={homeState} interactiveMarkers showLabels/>
        </div>
        <footer className={styles.legend}>
          <span><i className={styles.legendPlayer}/>현재 위치</span>
          <span><i className={styles.legendTarget}/>현재 목표</span>
          <span>🔒 잠긴 마을</span>
          <span>🏠 우리 집 · 꾸미기/초대</span>
          <strong>{objectiveLabel ? `${objective.arrived ? '도착' : '목표'} · ${objectiveLabel}` : '모든 마을 탐험 완료'}</strong>
        </footer>
      </section>
    </div>
  )
}
