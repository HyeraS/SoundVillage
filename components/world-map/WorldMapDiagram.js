'use client'

import { memo } from 'react'
import { ZONE_META } from '@/components/GameEngine'
import { WORLD_MAP_V4_PATHS } from '@/lib/worldMapV4Manifest.mjs'
import {
  WORLD_MINIMAP_DESTINATIONS,
  WORLD_MINIMAP_SIZE,
  getWorldMinimapMarkerState,
  worldToMinimap,
} from '@/lib/worldMapMinimap.mjs'
import styles from './WorldMapMinimap.module.css'

const LANDMARK_META = Object.freeze({
  'Sound Library': Object.freeze({ label: 'Sound Museum', icon: '🏛', color: '#C8A96E' }),
  Home: Object.freeze({ label: '우리 집 · 꾸미기', icon: '🏠', color: '#E98265' }),
})

export function getWorldDestinationPresentation(destination) {
  if (destination.zone) {
    const meta = ZONE_META[destination.zone]
    return {
      label: destination.zone === 'Lab' ? '연구소 마을' : meta.label,
      icon: meta.emoji,
      color: meta.color,
    }
  }
  return LANDMARK_META[destination.id]
}

function markerLabel(destination, locked, current, near) {
  const { label } = getWorldDestinationPresentation(destination)
  return `${label}${locked ? ', 잠김' : ', 이동 가능'}${current ? ', 현재 목표' : ''}${near ? ', 현재 위치 근처' : ''}`
}

const WorldMapRoads = memo(function WorldMapRoads() {
  return <>
    <rect width="100%" height="100%" className={styles.ground}/>
    {WORLD_MAP_V4_PATHS.map(path => (
      <polyline key={path.id} points={path.points.map(point => `${point.x},${point.y}`).join(' ')} className={styles.roadEdge}/>
    ))}
    {WORLD_MAP_V4_PATHS.map(path => (
      <polyline key={`${path.id}-inner`} points={path.points.map(point => `${point.x},${point.y}`).join(' ')} className={styles.road}/>
    ))}
  </>
})

const WorldMapDestinationMarkers = memo(function WorldMapDestinationMarkers({ lockedZones, objectiveId, nearDestinationId, homeState, interactiveMarkers, showLabels }) {
  return WORLD_MINIMAP_DESTINATIONS.map(destination => {
    const presentation = getWorldDestinationPresentation(destination)
    const point = worldToMinimap(destination.worldPoint, WORLD_MINIMAP_SIZE, { width:100, height:100 })
    const { locked, current, near } = getWorldMinimapMarkerState(destination, {
      lockedZones,
      objectiveId,
      nearDestinationId,
    })
    const label = markerLabel(destination, locked, current, near)
    const isHome = destination.id === 'Home'
    const markerClass = [styles.marker, isHome && styles.homeMarker, isHome && homeState === 'invite-ready' && styles.homeReady, isHome && homeState === 'visitor' && styles.homeVisitor, locked && styles.locked, current && styles.current, near && styles.near].filter(Boolean).join(' ')
    const markerStyle = { left:`${point.x}%`, top:`${point.y}%`, '--marker-color':presentation.color }
    const content = <><span className={styles.markerIcon} aria-hidden="true">{locked ? '🔒' : presentation.icon}</span>{isHome && homeState === 'invite-ready' && <span className={styles.homeStateDot} aria-hidden="true"/>}{showLabels && <span className={styles.markerName}>{presentation.label}{isHome && homeState === 'invite-ready' ? ' · 초대 가능' : ''}</span>}</>

    if (interactiveMarkers) {
      return <button key={destination.id} type="button" className={markerClass} style={markerStyle} aria-label={label} title={label} data-testid={`world-map-marker-${destination.id.toLowerCase().replaceAll(' ', '-')}`} data-destination-id={destination.id} data-world-x={destination.worldPoint.x} data-world-y={destination.worldPoint.y} data-locked={locked ? 'true' : 'false'} data-current={current ? 'true' : 'false'} data-near={near ? 'true' : 'false'}>{content}</button>
    }
    return <span key={destination.id} className={markerClass} style={markerStyle} role="img" aria-label={label} title={label} data-testid={`world-map-marker-${destination.id.toLowerCase().replaceAll(' ', '-')}`} data-destination-id={destination.id} data-world-x={destination.worldPoint.x} data-world-y={destination.worldPoint.y} data-locked={locked ? 'true' : 'false'} data-current={current ? 'true' : 'false'} data-near={near ? 'true' : 'false'}>{content}</span>
  })
})

export default function WorldMapDiagram({
  playerFoot,
  lockedZones = [],
  objective,
  nearDestinationId = null,
  homeState = 'default',
  interactiveMarkers = false,
  showLabels = false,
}) {
  const player = worldToMinimap(playerFoot, WORLD_MINIMAP_SIZE, WORLD_MINIMAP_SIZE)
  const target = objective?.destinationId
    ? WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === objective.destinationId)
    : null

  return (
    <div className={styles.diagram} data-testid="world-map-diagram">
      <svg className={styles.roads} viewBox={`0 0 ${WORLD_MINIMAP_SIZE.width} ${WORLD_MINIMAP_SIZE.height}`} preserveAspectRatio="none" aria-hidden="true">
        <WorldMapRoads/>
        {target && (
          <line
            data-testid="world-minimap-objective-line"
            x1={player.x}
            y1={player.y}
            x2={target.worldPoint.x}
            y2={target.worldPoint.y}
            className={objective.arrived ? styles.arrivedLine : styles.objectiveLine}
          />
        )}
      </svg>

      <WorldMapDestinationMarkers lockedZones={lockedZones} objectiveId={objective?.destinationId} nearDestinationId={nearDestinationId} homeState={homeState} interactiveMarkers={interactiveMarkers} showLabels={showLabels}/>

      <span
        className={styles.player}
        style={{ left:`${player.x / WORLD_MINIMAP_SIZE.width * 100}%`, top:`${player.y / WORLD_MINIMAP_SIZE.height * 100}%` }}
        role="img"
        aria-label="현재 내 위치"
        data-testid="world-minimap-player"
        data-world-x={player.x.toFixed(1)}
        data-world-y={player.y.toFixed(1)}
      >
        <span aria-hidden="true"/>
      </span>
      <span className={styles.north} aria-hidden="true">N</span>
    </div>
  )
}
