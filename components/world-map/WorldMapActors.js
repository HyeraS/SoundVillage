'use client'

import { ASSET_READY, CHARACTERS, WORLD_CHARACTER, resolveWorldCharacterLayers } from '@/components/AssetRegistry'
import { TILE, ZONE_META } from '@/components/GameEngine'
import { WORLD_HOME, WORLD_MUSEUM, WORLD_PLAYER, worldDestinationInteractionPoint } from '@/lib/worldMapGeometry.mjs'

const { width: CHAR_W, height: CHAR_H } = WORLD_PLAYER
const FALLBACK_FRAMES = CHARACTERS.player_frames

export function WorldPortalHotspot({ portal, hovered, progress, locked, labelScale = 1 }) {
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
      <g data-role="world-label" data-label-scale={labelScale.toFixed(4)}
        transform={labelScale === 1 ? undefined : `translate(${x} ${y + 17}) scale(${labelScale}) translate(${-x} ${-(y + 17)})`}>
        <rect x={x - width / 2} y={y + 5} width={width} height="24" rx="9"
          fill="#172014dd" stroke={locked ? '#aaa' : meta.color} strokeWidth={hovered ? 2.5 : 1.5}/>
        <text x={x} y={y + 21} textAnchor="middle" fontSize="11" fontWeight="800"
          fontFamily="Nunito, sans-serif" fill="#fff" style={{ userSelect:'none' }}>
          {locked ? `🔒 ${meta.label}` : `${label} ${Math.round(progress * 100)}%`}
        </text>
      </g>
    </g>
  )
}

export function WorldLandmarkHotspot({ kind, hovered, state = 'default', labelScale = 1 }) {
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
      {isHome && homeStatus && <g data-testid="world-home-status" pointerEvents="none"
        transform={labelScale === 1 ? undefined : `translate(${x + 60} ${y - 37}) scale(${labelScale}) translate(${-(x + 60)} ${-(y - 37)})`}>
        <circle cx={x + 60} cy={y - 54} r={state === 'invite-ready' ? 12 : 10} fill={homeStatus.color} opacity="0.25"/>
        <circle cx={x + 60} cy={y - 54} r="5" fill={homeStatus.color} stroke="#FFF4D6" strokeWidth="2"/>
        <rect x={x + 14} y={y - 47} width="92" height="20" rx="8" fill="#172014e8" stroke={homeStatus.color}/>
        <text x={x + 60} y={y - 33} textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">{homeStatus.icon} {homeStatus.label}</text>
      </g>}
      <g data-role="world-label" data-label-scale={labelScale.toFixed(4)}
        transform={labelScale === 1 ? undefined : `translate(${x} ${y + 17}) scale(${labelScale}) translate(${-x} ${-(y + 17)})`}>
        <rect x={x - width / 2} y={y + 5} width={width} height="24" rx="9"
          fill="#172014dd" stroke={color} strokeWidth={hovered ? 2.5 : 1.5}/>
        <text x={x} y={y + 21} textAnchor="middle" fontSize="11" fontWeight="800"
          fontFamily="Nunito, sans-serif" fill="#fff" style={{ userSelect:'none' }}>{label}</text>
      </g>
    </g>
  )
}

export function WorldCharacter({ dir, moving, outfitSrc, accessorySrc, characterLoadout, animationTick = 0, renderScale = 1 }) {
  // Size the sprite viewport directly instead of enlarging it with a CSS
  // transform. Safari can drop a transformed SVG nested in an SVG
  // foreignObject, which made the local player disappear even though every
  // sprite layer had loaded. Keeping the bottom-center anchor in layout also
  // makes the rendered 32px frame reach the requested on-screen height.
  const renderedSize = CHAR_H * renderScale
  const spriteStyle = {
    display:'block',
    overflow:'hidden',
    imageRendering:'pixelated',
    position:'absolute',
    left:(CHAR_W - renderedSize) / 2,
    top:CHAR_H - renderedSize,
  }
  if (ASSET_READY.world) {
    const { frame: frameSize, rows, cols } = WORLD_CHARACTER
    const layers = resolveWorldCharacterLayers({ outfitSrc, accessorySrc, ...(characterLoadout || {}) })
    const row = rows[dir] ?? rows.down
    const frame = cols[moving ? animationTick % cols.length : 0]
    const sourceX = frame * frameSize
    const sourceY = row * frameSize
    return (
      <svg width={renderedSize} height={renderedSize} viewBox={`0 0 ${frameSize} ${frameSize}`}
        data-character-render-scale={renderScale.toFixed(6)}
        data-character-render-mode="layout-sized"
        style={spriteStyle}>
        {layers.map((layer, index) => (
          <image key={`${layer.src}-${index}`} href={layer.src}
            x={-sourceX} y={-sourceY} width={layer.sheetW} height={layer.sheetH}
            style={{ imageRendering:'pixelated' }}/>
        ))}
      </svg>
    )
  }

  const offsets = FALLBACK_FRAMES[dir] || FALLBACK_FRAMES.down
  const frame = offsets[moving ? animationTick % 2 : 0] ?? offsets[0]
  return (
    <svg width={renderedSize} height={renderedSize} viewBox={`0 0 ${FALLBACK_FRAMES.frameW} ${FALLBACK_FRAMES.frameH}`}
      data-character-render-scale={renderScale.toFixed(6)}
      data-character-render-mode="layout-sized"
      style={spriteStyle}>
      <image href={CHARACTERS.player_sheet} x={-frame} y="0" width={FALLBACK_FRAMES.sheetW} height={FALLBACK_FRAMES.sheetH}
        style={{ imageRendering:'pixelated' }}/>
    </svg>
  )
}
