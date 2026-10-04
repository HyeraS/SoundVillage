'use client'

import { useEffect, useMemo, useState } from 'react'
import { ASSET_READY, CHARACTERS, WORLD_CHARACTER, resolveWorldCharacterLayers } from '@/components/AssetRegistry'
import { TILE, ZONE_META } from '@/components/GameEngine'
import { getCharacterRenderMetrics } from '@/lib/characterRenderMetrics.mjs'
import { calculateWorldCameraView, WORLD_CAMERA_HUD_HEIGHT } from '@/lib/worldMapCamera.mjs'
import { WORLD_HOME, WORLD_MUSEUM, WORLD_PLAYER, worldDestinationInteractionPoint } from '@/lib/worldMapGeometry.mjs'

const { width: CHAR_W, height: CHAR_H } = WORLD_PLAYER
const FALLBACK_FRAMES = CHARACTERS.player_frames

function useWorldCharacterRenderScale() {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return useMemo(() => {
    if (!viewport.width || !viewport.height) return 1
    const camera = calculateWorldCameraView({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      hudHeight: WORLD_CAMERA_HUD_HEIGHT,
    })
    const cameraScale = camera.sceneWidth / camera.viewW
    return getCharacterRenderMetrics({
      stageWidth: camera.sceneWidth,
      stageHeight: camera.sceneHeight,
      sceneCameraScale: cameraScale,
    }).worldScale
  }, [viewport])
}

export function WorldPortalHotspot({ portal, hovered, progress, locked }) {
  const meta = ZONE_META[portal.zone]
  const { x, y } = worldDestinationInteractionPoint(portal, TILE)
  const label = `${meta.emoji} ${meta.label}`
  const width = Math.max(104, 42 + label.length * 9)
  return (
    <g aria-label={`${meta.label} 입구`} data-testid={`world-portal-${portal.zone.toLowerCase()}`} data-zone={portal.zone}>
      <ellipse cx={x} cy={y - 5} rx={hovered ? 42 : 28} ry={hovered ? 14 : 9}
        fill={locked ? '#555' : meta.color} opacity={hovered ? 0.34 : 0.16}/>
      {hovered && !locked && <ellipse cx={x} cy={y - 5} rx="48" ry="17"
        fill="none" stroke={meta.color} strokeWidth="3" opacity="0.8"/>}
      <rect x={x - width / 2} y={y + 5} width={width} height="24" rx="9"
        fill="#172014dd" stroke={locked ? '#aaa' : meta.color} strokeWidth={hovered ? 2.5 : 1.5}/>
      <text x={x} y={y + 21} textAnchor="middle" fontSize="11" fontWeight="800"
        fontFamily="Nunito, sans-serif" fill="#fff" style={{ userSelect:'none' }}>
        {locked ? `🔒 ${meta.label}` : `${label} ${Math.round(progress * 100)}%`}
      </text>
    </g>
  )
}

export function WorldLandmarkHotspot({ kind, hovered, state = 'default' }) {
  const isHome = kind === 'home'
  const target = isHome ? WORLD_HOME : WORLD_MUSEUM
  const { x, y } = worldDestinationInteractionPoint(target, TILE)
  const color = isHome ? '#91CDB2' : '#C8A96E'
  const label = isHome ? '🏠 우리 집 · 생활 허브' : '🏛 도서관'
  const width = isHome ? 148 : 96
  const homeStatus = state === 'visitor'
    ? { label:'친구와 함께', color:'#8E77D7', icon:'●' }
    : state === 'invite-ready'
      ? { label:'초대 가능', color:'#E98265', icon:'●' }
      : state === 'decorating'
        ? { label:'꾸미는 중', color:'#D2A643', icon:'◆' }
        : null
  return (
    <g aria-label={`${label} 입구`} data-testid={isHome ? 'world-home' : 'world-museum'} data-home-state={isHome ? state : undefined}>
      <ellipse cx={x} cy={y - 4} rx={hovered ? 40 : 26} ry={hovered ? 13 : 8}
        fill={color} opacity={hovered ? 0.34 : 0.16}/>
      {isHome && homeStatus && <g data-testid="world-home-status" pointerEvents="none">
        <circle cx={x + 60} cy={y - 54} r={state === 'invite-ready' ? 12 : 10} fill={homeStatus.color} opacity="0.25"/>
        <circle cx={x + 60} cy={y - 54} r="5" fill={homeStatus.color} stroke="#FFF4D6" strokeWidth="2"/>
        <rect x={x + 14} y={y - 47} width="92" height="20" rx="8" fill="#172014e8" stroke={homeStatus.color}/>
        <text x={x + 60} y={y - 33} textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">{homeStatus.icon} {homeStatus.label}</text>
      </g>}
      <rect x={x - width / 2} y={y + 5} width={width} height="24" rx="9"
        fill="#172014dd" stroke={color} strokeWidth={hovered ? 2.5 : 1.5}/>
      <text x={x} y={y + 21} textAnchor="middle" fontSize="11" fontWeight="800"
        fontFamily="Nunito, sans-serif" fill="#fff" style={{ userSelect:'none' }}>{label}</text>
    </g>
  )
}

export function WorldCharacter({ dir, moving, outfitSrc, accessorySrc, characterLoadout, animationTick = 0 }) {
  const renderScale = useWorldCharacterRenderScale()
  if (ASSET_READY.world) {
    const { frame: frameSize, rows, cols } = WORLD_CHARACTER
    const layers = resolveWorldCharacterLayers({ outfitSrc, accessorySrc, ...(characterLoadout || {}) })
    const row = rows[dir] ?? rows.down
    const frame = cols[moving ? animationTick % cols.length : 0]
    const sourceX = frame * frameSize
    const sourceY = row * frameSize
    return (
      <svg width={CHAR_W} height={CHAR_H} viewBox={`0 0 ${frameSize} ${frameSize}`}
        data-character-render-scale={renderScale.toFixed(6)}
        style={{ overflow:'hidden', imageRendering:'pixelated', transform:`scale(${renderScale})`, transformOrigin:'50% 100%' }}>
        <defs><clipPath id="worldPlayerClip"><rect width={frameSize} height={frameSize}/></clipPath></defs>
        {layers.map((layer, index) => (
          <image key={`${layer.src}-${index}`} href={layer.src}
            x={-sourceX} y={-sourceY} width={layer.sheetW} height={layer.sheetH}
            clipPath="url(#worldPlayerClip)" style={{ imageRendering:'pixelated' }}/>
        ))}
      </svg>
    )
  }

  const offsets = FALLBACK_FRAMES[dir] || FALLBACK_FRAMES.down
  const frame = offsets[moving ? animationTick % 2 : 0] ?? offsets[0]
  return (
    <svg width={CHAR_W} height={CHAR_H} viewBox={`0 0 ${FALLBACK_FRAMES.frameW} ${FALLBACK_FRAMES.frameH}`}
      data-character-render-scale={renderScale.toFixed(6)}
      style={{ overflow:'hidden', imageRendering:'pixelated', transform:`scale(${renderScale})`, transformOrigin:'50% 100%' }}>
      <defs><clipPath id="worldFallbackPlayerClip"><rect width={FALLBACK_FRAMES.frameW} height={FALLBACK_FRAMES.frameH}/></clipPath></defs>
      <image href={CHARACTERS.player_sheet} x={-frame} y="0" width={FALLBACK_FRAMES.sheetW} height={FALLBACK_FRAMES.sheetH}
        clipPath="url(#worldFallbackPlayerClip)" style={{ imageRendering:'pixelated' }}/>
    </svg>
  )
}
