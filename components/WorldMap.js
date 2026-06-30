'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ASSET_READY } from '@/components/AssetRegistry'

/* ─────────────────────────────────────────────
   맵 크기
───────────────────────────────────────────── */
const MAP_W  = 40
const MAP_H  = 30
const PX_W   = MAP_W * TILE   // 1280
const PX_H   = MAP_H * TILE   // 960
const CHAR_W = 22
const CHAR_H = 28
const HUD_H  = 56

/* ─────────────────────────────────────────────
   Sound Museum — 맵 중앙
───────────────────────────────────────────── */
const MUSEUM = { tx: 15, ty: 11, w: 10, h: 8 }

/* ─────────────────────────────────────────────
   Zone 포털 — Museum 중심 정육각형 배치
   flat-top hexagon, radius ≈ 10 tiles
───────────────────────────────────────────── */
const PORTALS = [
  { zone: 'Animal', tx: 22, ty:  3, w: 6, h: 6 },  // top-right  (60°)
  { zone: 'Lab',    tx: 12, ty:  3, w: 6, h: 6 },  // top-left  (120°)
  { zone: 'Urban',  tx: 28, ty: 12, w: 5, h: 6 },  // right       (0°)
  { zone: 'Nature', tx:  6, ty: 12, w: 5, h: 6 },  // left       (180°)
  { zone: 'Music',  tx: 22, ty: 21, w: 6, h: 6 },  // bottom-right (300°)
  { zone: 'Human',  tx: 12, ty: 21, w: 6, h: 6 },  // bottom-left (240°)
]

/* ─────────────────────────────────────────────
   경로 타일 — 박물관에서 6 방향 방사형 스포크
───────────────────────────────────────────── */
const PATH_TILES = [
  // Museum 중앙 광장
  ...[16,17,18,19,20,21,22,23,24].flatMap(tx =>
    [12,13,14,15,16,17,18].map(ty => ({ tx, ty, plaza: true }))
  ),
  // 위쪽 스포크 (ty 8→11)
  ...[18,19,20,21,22].flatMap(tx => [8,9,10,11].map(ty => ({ tx, ty }))),
  // 위-오른쪽 → Animal
  ...[22,23,24,25,26,27].map(tx => ({ tx, ty: 8 })),
  // 위-왼쪽 → Lab
  ...[12,13,14,15,16,17,18].map(tx => ({ tx, ty: 8 })),
  // 오른쪽 스포크 → Urban
  ...[24,25,26,27,28].map(tx => ({ tx, ty: 15 })),
  ...[13,14,15,16,17].map(ty => ({ tx: 28, ty })),
  // 왼쪽 스포크 → Nature
  ...[11,12,13,14,15,16].map(tx => ({ tx, ty: 15 })),
  ...[13,14,15,16,17].map(ty => ({ tx: 11, ty })),
  // 아래쪽 스포크 (ty 19→21)
  ...[18,19,20,21,22].flatMap(tx => [19,20,21].map(ty => ({ tx, ty }))),
  // 아래-오른쪽 → Music
  ...[22,23,24,25,26,27].map(tx => ({ tx, ty: 21 })),
  ...[22,23].map(ty => ({ tx: 27, ty })),
  // 아래-왼쪽 → Human
  ...[12,13,14,15,16,17,18].map(tx => ({ tx, ty: 21 })),
  ...[22,23].map(ty => ({ tx: 12, ty })),
]

const PATH_SET = new Set(PATH_TILES.map(p => `${p.tx},${p.ty}`))

/* ─────────────────────────────────────────────
   나무 배치
───────────────────────────────────────────── */
const RAW_TREES = [
  // 테두리
  ...Array.from({length:18}, (_,i) => ({ tx: 1+i*2, ty: 1,  variant: i%3 })),
  ...Array.from({length:18}, (_,i) => ({ tx: 1+i*2, ty: 28, variant: (i+1)%3 })),
  ...Array.from({length:10}, (_,i) => ({ tx: 1,  ty: 3+i*2, variant: i%2 })),
  ...Array.from({length:10}, (_,i) => ({ tx: 38, ty: 3+i*2, variant: (i+1)%2 })),
  // 스포크 사이 빈 공간 채우기
  {tx:26,ty:9},{tx:27,ty:9},{tx:27,ty:10},{tx:28,ty:10},{tx:29,ty:9},
  {tx:26,ty:17},{tx:27,ty:17},{tx:27,ty:18},{tx:28,ty:18},{tx:29,ty:17},
  {tx:18,ty:23},{tx:20,ty:23},{tx:22,ty:23},{tx:20,ty:25},{tx:20,ty:26},
  {tx:11,ty:17},{tx:11,ty:18},{tx:10,ty:18},{tx:10,ty:17},{tx:9,ty:17},
  {tx:11,ty:9},{tx:11,ty:10},{tx:10,ty:10},{tx:10,ty:9},{tx:9,ty:9},
  {tx:18,ty:5},{tx:20,ty:5},{tx:22,ty:5},{tx:20,ty:6},{tx:20,ty:7},
]

// Portal 영역 타일 셋
const PORTAL_SET = new Set(
  PORTALS.flatMap(p =>
    Array.from({length: p.w}, (_,dx) =>
      Array.from({length: p.h}, (_,dy) => `${p.tx+dx},${p.ty+dy}`)
    ).flat()
  )
)
const MUSEUM_SET = new Set(
  Array.from({length: MUSEUM.w}, (_,dx) =>
    Array.from({length: MUSEUM.h}, (_,dy) => `${MUSEUM.tx+dx},${MUSEUM.ty+dy}`)
  ).flat()
)

const TREES = RAW_TREES.filter(t => {
  const k = `${t.tx},${t.ty}`
  return !PATH_SET.has(k) && !PORTAL_SET.has(k) && !MUSEUM_SET.has(k)
})

/* ─────────────────────────────────────────────
   꽃 배치
───────────────────────────────────────────── */
const FLOWERS = Array.from({length:30}, (_,i) => ({
  tx: 3 + (i*73)%34,
  ty: 3 + (i*47)%24,
  type: i % 4,
})).filter(f => {
  const k = `${f.tx},${f.ty}`
  return !PATH_SET.has(k) && !PORTAL_SET.has(k) && !MUSEUM_SET.has(k)
})

/* ─────────────────────────────────────────────
   헬퍼
───────────────────────────────────────────── */
const TREE_SRCS = [OBJECTS.tree_01, OBJECTS.tree_02, OBJECTS.tree_03]
const TREE_COLORS = [
  { trunk: '#7A5230', canopy: '#2D7A2D', shadow: '#1F5C1F' },
  { trunk: '#8B5E3C', canopy: '#3A8C2F', shadow: '#2A6B22' },
  { trunk: '#6B4423', canopy: '#4A9E38', shadow: '#336E27' },
]

function PixelTree({ x, y, variant = 0 }) {
  if (ASSET_READY.objects) {
    return (
      <image href={TREE_SRCS[variant % 3]} x={x} y={y} width={TILE} height={TILE*1.5}
        style={{ imageRendering: 'pixelated' }}/>
    )
  }
  const c = TREE_COLORS[variant % 3]
  const s = TILE - 4
  return (
    <g transform={`translate(${x+2},${y})`}>
      <ellipse cx={s/2} cy={s-3} rx={s*0.32} ry={5} fill="#00000022"/>
      <rect x={s*0.38} y={s*0.55} width={s*0.24} height={s*0.44} rx="2" fill={c.trunk}/>
      <rect x={s*0.08} y={s*0.34} width={s*0.84} height={s*0.28} rx="5" fill={c.shadow}/>
      <rect x={s*0.16} y={s*0.08} width={s*0.68} height={s*0.32} rx="6" fill={c.canopy}/>
      <rect x={s*0.26} y={s*0.1}  width={s*0.2}  height={s*0.1}  rx="3" fill="white" opacity="0.22"/>
    </g>
  )
}

const FLOWER_COLORS = [
  ['#F4D03F','#F39C12'], ['#E8A0C0','#D4608A'],
  ['#A8D8EA','#6DB5D4'], ['#F0F0AA','#D4D444'],
]
function PixelFlower({ x, y, type }) {
  const [p, c] = FLOWER_COLORS[type % 4]
  return (
    <g transform={`translate(${x+6},${y+10})`}>
      <rect x="6" y="5" width="2" height="8" rx="1" fill="#4A8C3A"/>
      <circle cx="7" cy="4" r="4" fill={p}/>
      <circle cx="7" cy="4" r="2" fill={c}/>
    </g>
  )
}

/* ─────────────────────────────────────────────
   Zone 빌딩 SVG 폴백 (각 zone 테마 맞춤)
───────────────────────────────────────────── */
function ZoneBuilding({ zone, px, py, pw, ph }) {
  const cx = px + pw / 2

  if (zone === 'Animal') return (
    <g>
      <PixelTree x={px+4}      y={py+4} variant={0}/>
      <PixelTree x={px+pw-36}  y={py+4} variant={1}/>
      <PixelTree x={cx-16}     y={py+8} variant={2}/>
      <text x={cx-14} y={py+ph*0.68} fontSize="18" style={{userSelect:'none'}}>🐦</text>
      <text x={cx+6}  y={py+ph*0.78} fontSize="14" style={{userSelect:'none'}}>🐾</text>
      <text x={cx-22} y={py+ph*0.82} fontSize="13" style={{userSelect:'none'}}>🌿</text>
    </g>
  )

  if (zone === 'Human') return (
    <g>
      <rect x={cx-18} y={py+ph*0.42} width={36} height={22} rx="2" fill="#D4A87A"/>
      <polygon points={`${cx-22},${py+ph*0.46} ${cx},${py+ph*0.24} ${cx+22},${py+ph*0.46}`} fill="#A05030"/>
      <rect x={cx-6} y={py+ph*0.66} width={12} height={12} rx="1" fill="#5A3A1A"/>
      <rect x={cx-16} y={py+ph*0.5} width={10} height={7} rx="1" fill="#87CEEB" opacity="0.8"/>
      <rect x={cx+6}  y={py+ph*0.5} width={10} height={7} rx="1" fill="#87CEEB" opacity="0.8"/>
      <text x={cx} y={py+ph-6} textAnchor="middle" fontSize="13" style={{userSelect:'none'}}>👣</text>
    </g>
  )

  if (zone === 'Nature') return (
    <g>
      <ellipse cx={cx} cy={py+ph*0.7} rx={pw*0.35} ry={ph*0.22} fill="#4A8FD4" opacity="0.85"/>
      <polygon points={`${cx-pw*0.35},${py+ph*0.6} ${cx-pw*0.1},${py+ph*0.2} ${cx+pw*0.1},${py+ph*0.6}`}
        fill="#5A8A5A"/>
      <polygon points={`${cx},${py+ph*0.6} ${cx+pw*0.22},${py+ph*0.16} ${cx+pw*0.38},${py+ph*0.6}`}
        fill="#4A7A4A"/>
      <text x={cx} y={py+10} textAnchor="middle" fontSize="14" style={{userSelect:'none'}}>🌿</text>
    </g>
  )

  if (zone === 'Urban') return (
    <g>
      <rect x={cx-14} y={py+4} width={28} height={ph-8} rx="2" fill="#B0A090"/>
      <polygon points={`${cx-18},${py+12} ${cx},${py+2} ${cx+18},${py+12}`} fill="#C0392B"/>
      <rect x={cx-5} y={py-4} width={10} height={12} rx="1" fill="#9A8A7A"/>
      <circle cx={cx} cy={py+2} r="5" fill="#D4C8A8" stroke="#8B7A6A" strokeWidth="1"/>
      {[0,1,2].flatMap(row=>[0,1].map(col=>(
        <rect key={`${row}${col}`} x={cx-10+col*14} y={py+18+row*10} width={8} height={7} rx="1"
          fill="#87CEEB" opacity="0.8"/>
      )))}
      <text x={cx+pw*0.25} y={py+ph*0.85} fontSize="12" style={{userSelect:'none'}}>🚗</text>
    </g>
  )

  if (zone === 'Music') return (
    <g>
      <rect x={px+6} y={py+ph*0.55} width={pw-12} height={ph*0.38} rx="4" fill="#5A4A3A"/>
      <rect x={px+4} y={py+4} width={10} height={ph*0.55} rx="2" fill="#8B2252"/>
      <rect x={px+pw-14} y={py+4} width={10} height={ph*0.55} rx="2" fill="#8B2252"/>
      <text x={cx-14} y={py+ph*0.48} fontSize="18" fill="#9B6DD4" style={{userSelect:'none'}}>♪</text>
      <text x={cx+4}  y={py+ph*0.4}  fontSize="14" fill="#7B4DC4" style={{userSelect:'none'}}>♫</text>
      <text x={cx} y={py+ph*0.8} textAnchor="middle" fontSize="13" style={{userSelect:'none'}}>🎵</text>
    </g>
  )

  // Lab
  return (
    <g>
      <ellipse cx={cx} cy={py+ph*0.75} rx={pw*0.38} ry={ph*0.28} fill="#2A1840" opacity="0.9"/>
      {[{dx:-20,dy:4,h:28,c:'#9B6DD4'},{dx:0,dy:-4,h:36,c:'#D4883A'},{dx:20,dy:4,h:24,c:'#4A8FD4'}].map((cr,i)=>(
        <g key={i} transform={`translate(${cx+cr.dx},${py+ph*0.5+cr.dy})`}>
          <polygon points={`0,${-cr.h} ${-cr.h*0.22},0 ${cr.h*0.22},0`} fill={cr.c} opacity="0.85"/>
          <circle cx={0} cy={-cr.h+3} r="2" fill="white" opacity="0.7"/>
        </g>
      ))}
    </g>
  )
}

/* ─────────────────────────────────────────────
   Zone 포털 섬
───────────────────────────────────────────── */
function PortalIsland({ portal, hovered, progress }) {
  const meta = ZONE_META[portal.zone]
  const px = portal.tx * TILE, py = portal.ty * TILE
  const pw = portal.w  * TILE, ph = portal.h  * TILE
  const prog = Math.min(Math.max(progress || 0, 0), 1)

  return (
    <g>
      <ellipse cx={px+pw/2+4} cy={py+ph+8} rx={pw*0.52} ry={10} fill="#00000033"/>
      <rect x={px-4} y={py} width={pw+8} height={ph} rx="10"
        fill="#3A6B2A"
        stroke={hovered ? meta.color : '#2A5A1A'}
        strokeWidth={hovered ? 2.5 : 1}
        style={{ filter: hovered ? `drop-shadow(0 0 10px ${meta.color}66)` : 'none', transition:'all 0.25s' }}
      />
      <rect x={px-4} y={py} width={pw+8} height={12} rx="10" fill="#4A8B3A" opacity="0.7"/>
      <rect x={px+pw/2-8} y={py+ph-4} width={16} height={12} rx="2" fill="#C8B89A"/>

      <ZoneBuilding zone={portal.zone} px={px} py={py} pw={pw} ph={ph}/>

      <rect x={px-4} y={py+ph+2} width={pw+8} height={4} rx="2" fill="#ffffff18"/>
      <rect x={px-4} y={py+ph+2} width={(pw+8)*prog} height={4} rx="2" fill={meta.color}/>

      <rect x={px+pw/2-38} y={py-26} width={76} height={22} rx="7"
        fill={hovered ? meta.color : '#000000bb'}
        stroke={meta.color} strokeWidth="1.5"
        style={{ transition:'all 0.2s' }}
      />
      <text x={px+pw/2} y={py-12} textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="Nunito, sans-serif"
        fill={hovered ? '#fff' : meta.color}
        style={{ userSelect:'none', transition:'fill 0.2s' }}>
        {meta.emoji} {meta.label}
      </text>

      {hovered && (
        <g>
          <rect x={px+pw/2-32} y={py+ph+10} width={64} height={17} rx="5" fill="#000000cc"/>
          <text x={px+pw/2} y={py+ph+21} textAnchor="middle" fontSize="9"
            fontFamily="Nunito, sans-serif" fill="#F0EDE8" style={{userSelect:'none'}}>
            ENTER 진입
          </text>
        </g>
      )}
    </g>
  )
}

/* ─────────────────────────────────────────────
   Sound Museum 섬 (중앙)
───────────────────────────────────────────── */
function MuseumIsland({ hovered }) {
  const px = MUSEUM.tx * TILE, py = MUSEUM.ty * TILE
  const pw = MUSEUM.w  * TILE, ph = MUSEUM.h  * TILE
  const cx = px + pw / 2

  return (
    <g>
      <ellipse cx={cx+4} cy={py+ph+8} rx={pw*0.5} ry={10} fill="#00000033"/>
      <rect x={px-4} y={py} width={pw+8} height={ph} rx="10"
        fill="#C8B870"
        stroke={hovered ? '#C8A96E' : '#A89050'}
        strokeWidth={hovered ? 3 : 1.5}
        style={{ filter: hovered ? 'drop-shadow(0 0 14px #C8A96E99)' : 'none', transition:'all 0.25s' }}
      />
      <rect x={px-4} y={py} width={pw+8} height={12} rx="10" fill="#D8C880" opacity="0.6"/>
      <rect x={cx-pw*0.2} y={py+ph-4} width={pw*0.4} height={12} rx="2" fill="#C8B880"/>
      {[-1.2,-0.4,0.4,1.2].map((dx,i) => (
        <g key={i} transform={`translate(${cx+dx*pw*0.18},${py+ph*0.18})`}>
          <rect x="-4" y="0" width="8" height={ph*0.52} rx="2" fill="#E8D8B0"/>
          <rect x="-6" y="-4" width="12" height="6" rx="1" fill="#D4C4A0"/>
          <rect x="-6" y={ph*0.52-1} width="12" height="6" rx="1" fill="#D4C4A0"/>
        </g>
      ))}
      <polygon
        points={`${px+6},${py+ph*0.22} ${cx},${py+4} ${px+pw-6},${py+ph*0.22}`}
        fill="#D4B870" stroke="#B89A50" strokeWidth="1.5"
      />
      <text x={cx} y={py+ph*0.7} textAnchor="middle" fontSize="22" style={{userSelect:'none'}}>🏛</text>
      <rect x={px-4} y={py+ph+2} width={pw+8} height={4} rx="2" fill="#D4C870" opacity="0.5"/>
      <rect x={cx-46} y={py-26} width={92} height={22} rx="7"
        fill={hovered ? '#C8A96E' : '#000000bb'}
        stroke="#C8A96E" strokeWidth="1.5"
        style={{ transition:'all 0.2s' }}
      />
      <text x={cx} y={py-12} textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="Nunito, sans-serif"
        fill={hovered ? '#fff' : '#C8A96E'}
        style={{ userSelect:'none', transition:'fill 0.2s' }}>
        🏛 Sound Museum
      </text>
      {hovered && (
        <g>
          <rect x={cx-32} y={py+ph+10} width={64} height={17} rx="5" fill="#000000cc"/>
          <text x={cx} y={py+ph+21} textAnchor="middle" fontSize="9"
            fontFamily="Nunito, sans-serif" fill="#F0EDE8" style={{userSelect:'none'}}>
            ENTER 진입
          </text>
        </g>
      )}
    </g>
  )
}

/* ─────────────────────────────────────────────
   캐릭터
───────────────────────────────────────────── */
const CHAR_CFG = CHARACTERS.player_frames

function PixelChar({ dir, moving }) {
  const tick  = Math.floor(Date.now() / 160) % 2
  const frame = moving ? tick : 0

  if (ASSET_READY.characters && CHARACTERS.player_sheet) {
    const frameOffsets = CHAR_CFG[dir] || CHAR_CFG.down
    const frameX = frameOffsets[frame] ?? frameOffsets[0]
    const { frameW, frameH, sheetW, sheetH } = CHAR_CFG
    return (
      <svg width={CHAR_W} height={CHAR_H} viewBox={`0 0 ${frameW} ${frameH}`}
        style={{ overflow:'hidden', imageRendering:'pixelated' }}>
        <defs>
          <clipPath id="charClip"><rect width={frameW} height={frameH}/></clipPath>
        </defs>
        <image href={CHARACTERS.player_sheet} x={-frameX} y={0}
          width={sheetW} height={sheetH} clipPath="url(#charClip)"
          style={{ imageRendering:'pixelated' }}/>
      </svg>
    )
  }

  const legLY = frame === 0 ? 18 : 21
  const legRY = frame === 0 ? 21 : 18
  const flip  = dir === 'left' ? 'scale(-1,1) translate(-22,0)' : ''
  return (
    <svg width={CHAR_W} height={CHAR_H} viewBox="0 0 22 28"
      style={{ imageRendering:'pixelated', overflow:'visible' }}>
      <g transform={flip}>
        <ellipse cx="11" cy="27" rx="7" ry="2" fill="#00000033"/>
        <rect x="4" y="2" width="14" height="3" rx="2" fill="#2A2A3A"/>
        <rect x="2" y="4" width="4"  height="5" rx="2" fill="#4A4A6A"/>
        <rect x="16" y="4" width="4" height="5" rx="2" fill="#4A4A6A"/>
        <rect x="3" y="5" width="2"  height="3" rx="1" fill="#7B6DD4" opacity="0.8"/>
        <rect x="17" y="5" width="2" height="3" rx="1" fill="#7B6DD4" opacity="0.8"/>
        <rect x="5" y="4" width="12" height="10" rx="3" fill="#F4C87A"/>
        {dir === 'up' ? (
          <>
            <rect x="7"  y="9" width="2" height="1.5" rx="0.5" fill="#333"/>
            <rect x="13" y="9" width="2" height="1.5" rx="0.5" fill="#333"/>
          </>
        ) : (
          <>
            <rect x="7"  y="8" width="2.5" height="2.5" rx="0.8" fill="#333"/>
            <rect x="12" y="8" width="2.5" height="2.5" rx="0.8" fill="#333"/>
            <rect x="7.5"  y="8.3" width="1" height="1" rx="0.3" fill="white" opacity="0.8"/>
            <rect x="12.5" y="8.3" width="1" height="1" rx="0.3" fill="white" opacity="0.8"/>
          </>
        )}
        <circle cx="6.5"  cy="11" r="1.5" fill="#F09090" opacity="0.5"/>
        <circle cx="15.5" cy="11" r="1.5" fill="#F09090" opacity="0.5"/>
        {dir !== 'up' && <rect x="8" y="12" width="6" height="1.5" rx="0.8" fill="#D4886A"/>}
        <rect x="5"  y="15" width="12" height="8" rx="2" fill="#4A7CC4"/>
        <rect x="8"  y="16" width="6"  height="2" rx="1" fill="#6A9CE4" opacity="0.6"/>
        <rect x="2"  y="15" width="4"  height="6" rx="2" fill="#3A6AB4"/>
        <rect x="16" y="15" width="4"  height="6" rx="2" fill="#3A6AB4"/>
        <rect x="5"  y={legLY} width="5" height="5" rx="2" fill="#2A5090"/>
        <rect x="12" y={legRY} width="5" height="5" rx="2" fill="#2A5090"/>
        <rect x="4"  y="23" width="6"  height="3" rx="1.5" fill="#1A1A2A"/>
        <rect x="12" y="23" width="6"  height="3" rx="1.5" fill="#1A1A2A"/>
      </g>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   바닥 패턴
───────────────────────────────────────────── */
function GroundPatterns() {
  if (ASSET_READY.tiles) {
    return (
      <defs>
        <pattern id="grass" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <image href={TILES.grass} width={TILE} height={TILE} style={{imageRendering:'pixelated'}}/>
        </pattern>
        <pattern id="path_tile" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <image href={TILES.path} width={TILE} height={TILE} style={{imageRendering:'pixelated'}}/>
        </pattern>
        <pattern id="plaza_tile" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <image href={TILES.path_center} width={TILE} height={TILE} style={{imageRendering:'pixelated'}}/>
        </pattern>
      </defs>
    )
  }
  return (
    <defs>
      <pattern id="grass" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
        <rect width={TILE} height={TILE} fill="#5A9A3A"/>
        <rect width={TILE} height={TILE} fill="none" stroke="#4A8A2A" strokeWidth="0.3" opacity="0.4"/>
        <rect x="4"  y="6"  width="1.5" height="6" rx="0.5" fill="#4A8A2A" opacity="0.4"/>
        <rect x="10" y="8"  width="1.5" height="5" rx="0.5" fill="#4A8A2A" opacity="0.3"/>
        <rect x="18" y="5"  width="1.5" height="7" rx="0.5" fill="#3A7A1A" opacity="0.3"/>
        <rect x="26" y="10" width="1.5" height="4" rx="0.5" fill="#4A8A2A" opacity="0.4"/>
      </pattern>
    </defs>
  )
}

/* ─────────────────────────────────────────────
   HUD
───────────────────────────────────────────── */
function HUD({ totalCount, zoneProgress }) {
  const zones = Object.keys(ZONE_META)
  const totalProgress = Object.values(zoneProgress).reduce((s,v)=>s+v,0) / zones.length
  const pct = Math.round(totalProgress * 100)
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:`${HUD_H}px`,
      background:'#F5EDD8', borderBottom:'3px solid #C8A96E',
      display:'flex', alignItems:'center', padding:'0 16px', gap:'12px',
      fontFamily:'Nunito, sans-serif', zIndex:20,
      boxShadow:'0 2px 8px #00000033',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginRight:'4px' }}>
        <span style={{ fontSize:'22px' }}>🎧</span>
        <div>
          <div style={{ fontSize:'14px', fontWeight:800, color:'#3A2A14', lineHeight:1.1 }}>Sound Village</div>
          <div style={{ fontSize:'10px', color:'#8B6A3A' }}>소리를 수집하세요</div>
        </div>
      </div>
      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
          <span style={{ fontSize:'11px', fontWeight:700, color:'#3A2A14' }}>Overall Progress</span>
          <span style={{ fontSize:'11px', color:'#8B6A3A' }}>{pct}%</span>
        </div>
        <div style={{ height:'8px', background:'#D4C4A0', borderRadius:'4px', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:'4px', background:'linear-gradient(90deg,#5B9E3A,#7BC850)', width:`${pct}%`, transition:'width 0.5s ease' }}/>
        </div>
      </div>
      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>
      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        <span style={{ fontSize:'20px' }}>⭐</span>
        <div>
          <div style={{ fontSize:'16px', fontWeight:800, color:'#B8860B', lineHeight:1 }}>{totalCount}</div>
          <div style={{ fontSize:'9px', color:'#8B6A3A' }}>수집한 소리</div>
        </div>
      </div>
      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>
      <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
        {zones.map(zone => (
          <div key={zone} title={`${ZONE_META[zone].label}: ${Math.round((zoneProgress[zone]||0)*100)}%`}
            style={{
              width:'24px', height:'24px', borderRadius:'6px',
              background: (zoneProgress[zone]||0) >= 1 ? ZONE_META[zone].color : '#D4C4A0',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'12px', border:'2px solid',
              borderColor: (zoneProgress[zone]||0) >= 1 ? ZONE_META[zone].color : '#C8A96E',
              opacity: (zoneProgress[zone]||0) > 0 ? 1 : 0.5, transition:'all 0.3s',
            }}>
            {ZONE_META[zone].emoji}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   목표 패널
───────────────────────────────────────────── */
function ObjectivePanel({ nearZone, nearMuseum }) {
  const isNearMuseum = !nearZone && nearMuseum
  return (
    <div style={{
      position:'absolute', bottom:'16px', right:'16px', width:'200px',
      background:'#F5EDD8', border:'2px solid #C8A96E',
      borderRadius:'12px', padding:'12px',
      fontFamily:'Nunito, sans-serif',
      boxShadow:'0 4px 16px #00000044', zIndex:10,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
        <span style={{ fontSize:'14px' }}>{isNearMuseum ? '🏛' : '🚩'}</span>
        <span style={{ fontSize:'11px', fontWeight:800, color:'#3A2A14' }}>현재 목표</span>
      </div>
      <div style={{ fontSize:'12px', fontWeight:700, color:'#3A2A14', marginBottom:'4px' }}>
        {nearZone ? `${ZONE_META[nearZone].emoji} ${ZONE_META[nearZone].label} 진입`
          : isNearMuseum ? '🏛 Sound Museum 진입'
          : '마을 탐험하기'}
      </div>
      <div style={{ fontSize:'11px', color:'#8B6A3A', lineHeight:1.5, marginBottom:'6px' }}>
        {nearZone || isNearMuseum ? 'ENTER를 눌러 진입하세요' : '방향키로 이동해 Zone을 찾아보세요'}
      </div>
      <div style={{ height:'1px', background:'#D4C4A0', margin:'4px 0' }}/>
      <div style={{ fontSize:'10px', color:'#8B6A3A' }}>💡 WASD / 방향키 이동</div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   WorldMap 메인
───────────────────────────────────────────── */
export default function WorldMap({ onEnterZone, onEnterMuseum, totalCount, zoneProgress = {}, participantId = '' }) {
  const { keys, press, release } = useKeys()

  const [pos,        setPos]        = useState({ x: PX_W/2 - CHAR_W/2, y: PX_H/2 - CHAR_H/2 })
  const [dir,        setDir]        = useState('down')
  const [moving,     setMoving]     = useState(false)
  const [nearZone,   setNearZone]   = useState(null)
  const [nearMuseum, setNearMuseum] = useState(false)
  const [cam,        setCam]        = useState({ x: 0, y: 0 })
  const [vp,         setVp]         = useState({
    w: typeof window !== 'undefined' ? window.innerWidth  : 800,
    h: typeof window !== 'undefined' ? window.innerHeight - HUD_H : 544,
  })
  const posRef = useRef(pos)
  const viewW  = useRef(typeof window !== 'undefined' ? window.innerWidth  : 800)
  const viewH  = useRef(typeof window !== 'undefined' ? window.innerHeight - HUD_H : 544)
  const rafRef = useRef(null)

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth, h = window.innerHeight - HUD_H
      viewW.current = w; viewH.current = h; setVp({ w, h })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    let lastTime = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3); lastTime = now
      const k = keys.current
      let { x, y } = posRef.current
      let moved = false, newDir = dir
      const spd = SPEED * dt
      if (k.up)    { y -= spd; newDir = 'up';    moved = true }
      if (k.down)  { y += spd; newDir = 'down';  moved = true }
      if (k.left)  { x -= spd; newDir = 'left';  moved = true }
      if (k.right) { x += spd; newDir = 'right'; moved = true }
      x = Math.max(0, Math.min(PX_W - CHAR_W, x))
      y = Math.max(0, Math.min(PX_H - CHAR_H, y))
      if (moved) {
        posRef.current = { x, y }; setPos({ x, y })
        if (newDir !== dir) setDir(newDir)
        setMoving(true)
        const camX = Math.max(0, Math.min(PX_W - viewW.current, x + CHAR_W/2 - viewW.current/2))
        const camY = Math.max(0, Math.min(PX_H - viewH.current, y + CHAR_H/2 - viewH.current/2))
        setCam({ x: camX, y: camY })
      } else { setMoving(false) }
      const near = PORTALS.find(p => overlaps(x, y, CHAR_W, CHAR_H, p.tx*TILE-20, p.ty*TILE-10, p.w*TILE+40, p.h*TILE+30))
      setNearZone(near?.zone ?? null)
      setNearMuseum(overlaps(x, y, CHAR_W, CHAR_H, MUSEUM.tx*TILE-20, MUSEUM.ty*TILE-10, MUSEUM.w*TILE+40, MUSEUM.h*TILE+30))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir])

  useEffect(() => {
    const h = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (nearZone) onEnterZone(nearZone)
        else if (nearMuseum && onEnterMuseum) onEnterMuseum()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nearZone, nearMuseum, onEnterZone, onEnterMuseum])

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', userSelect:'none' }}>
      <HUD totalCount={totalCount} zoneProgress={zoneProgress}/>

      <div style={{
        position:'absolute', top:`${HUD_H}px`, left:0, right:0, bottom:0,
        background:'#5A9A3A', overflow:'hidden', cursor:'none',
      }}>
        <svg width="100%" height="100%"
          viewBox={`${cam.x} ${cam.y} ${vp.w} ${vp.h}`}
          style={{ display:'block', position:'absolute', inset:0 }}
        >
          <GroundPatterns/>
          <rect width={PX_W} height={PX_H} fill="url(#grass)"/>

          {PATH_TILES.map((p,i) => (
            <rect key={i}
              x={p.tx*TILE} y={p.ty*TILE} width={TILE} height={TILE}
              fill={p.plaza ? "url(#plaza_tile)" : "url(#path_tile)"}
              stroke={ASSET_READY.tiles ? 'none' : '#B8A88A'} strokeWidth="0.3"
            />
          ))}

          {!ASSET_READY.tiles && PATH_TILES.filter(p=>p.plaza).map((p,i) => (
            <rect key={i}
              x={p.tx*TILE+2} y={p.ty*TILE+2} width={TILE-4} height={TILE-4}
              rx="3" fill="#D8C8AA" stroke="#B8A88A" strokeWidth="0.5"
            />
          ))}

          {FLOWERS.map((f,i) => <PixelFlower key={i} x={f.tx*TILE} y={f.ty*TILE} type={f.type}/>)}
          {TREES.map((t,i) => <PixelTree key={i} x={t.tx*TILE} y={t.ty*TILE} variant={t.variant ?? i%3}/>)}

          {PORTALS.map(p => (
            <PortalIsland key={p.zone} portal={p}
              hovered={nearZone === p.zone}
              progress={zoneProgress[p.zone] || 0}
            />
          ))}

          <MuseumIsland hovered={nearMuseum}/>

          <foreignObject x={pos.x} y={pos.y} width={CHAR_W} height={CHAR_H} style={{ overflow:'visible' }}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width:CHAR_W, height:CHAR_H }}>
              <PixelChar dir={dir} moving={moving}/>
            </div>
          </foreignObject>
        </svg>
      </div>

      <ObjectivePanel nearZone={nearZone} nearMuseum={nearMuseum}/>

      {nearZone && (
        <div style={{
          position:'absolute', bottom:'100px', left:'50%', transform:'translateX(-50%)',
          background:'#F5EDD8cc', border:`2px solid ${ZONE_META[nearZone].color}`,
          borderRadius:'20px', padding:'8px 20px',
          fontSize:'13px', fontFamily:'Nunito, sans-serif',
          color:'#3A2A14', fontWeight:700, backdropFilter:'blur(6px)',
          animation:'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents:'none', whiteSpace:'nowrap',
          boxShadow:`0 4px 16px ${ZONE_META[nearZone].color}44`, zIndex:15,
        }}>
          {ZONE_META[nearZone].emoji} {ZONE_META[nearZone].label} 근처 — ENTER로 진입
        </div>
      )}

      {!nearZone && nearMuseum && (
        <div style={{
          position:'absolute', bottom:'100px', left:'50%', transform:'translateX(-50%)',
          background:'#F5EDD8cc', border:'2px solid #C8A96E',
          borderRadius:'20px', padding:'8px 20px',
          fontSize:'13px', fontFamily:'Nunito, sans-serif',
          color:'#3A2A14', fontWeight:700, backdropFilter:'blur(6px)',
          animation:'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents:'none', whiteSpace:'nowrap',
          boxShadow:'0 4px 16px #C8A96E44', zIndex:15,
        }}>
          🏛 Sound Museum 근처 — ENTER로 진입
        </div>
      )}

      <DPad press={press} release={release}/>
    </div>
  )
}

function DPad({ press, release }) {
  const BTN = [
    {dir:'up',label:'▲',gridArea:'1/2'},{dir:'left',label:'◀',gridArea:'2/1'},
    {dir:'down',label:'▼',gridArea:'2/2'},{dir:'right',label:'▶',gridArea:'2/3'},
  ]
  const s = {
    width:'44px', height:'44px', borderRadius:'10px',
    background:'#F5EDD8cc', border:'2px solid #C8A96E',
    color:'#3A2A14', fontSize:'16px',
    display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', userSelect:'none', touchAction:'none',
  }
  return (
    <div style={{
      position:'absolute', bottom:'20px', left:'20px',
      display:'grid', gridTemplateColumns:'repeat(3,44px)',
      gridTemplateRows:'repeat(2,44px)', gap:'4px', zIndex:15,
    }}>
      {BTN.map(b => (
        <div key={b.dir} style={{...s, gridArea:b.gridArea}}
          onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);press(b.dir)}}
          onPointerUp={()=>release(b.dir)} onPointerCancel={()=>release(b.dir)}>
          {b.label}
        </div>
      ))}
    </div>
  )
}
