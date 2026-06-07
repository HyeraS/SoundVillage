'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ITEMS, ASSET_READY, ZONE_GROUND_TILE } from '@/components/AssetRegistry'

/* ─────────────────────────────────────────────
   맵 크기
───────────────────────────────────────────── */
const MAP_W  = 24
const MAP_H  = 18
const PX_W   = MAP_W * TILE   // 768
const PX_H   = MAP_H * TILE   // 576
const CHAR_W = 22
const CHAR_H = 28
const HUD_H  = 56

/* ─────────────────────────────────────────────
   Zone별 배경 팔레트
───────────────────────────────────────────── */
const ZONE_THEME = {
  Forest: {
    ground: '#4A8B2A', groundDark: '#3A7A1A', path: '#C8B48A',
    border: '#2A5A10', water: null,
    sky: 'linear-gradient(180deg, #87CEEB 0%, #C8E8A0 100%)',
  },
  Creek:  {
    ground: '#4A7A8B', groundDark: '#3A6A7A', path: '#C8C0A8',
    border: '#1A3A5A', water: '#4A8FD4',
    sky: 'linear-gradient(180deg, #87CEEB 0%, #B0D8F0 100%)',
  },
  City:   {
    ground: '#8A8070', groundDark: '#7A7060', path: '#D4C8B0',
    border: '#4A4030', water: null,
    sky: 'linear-gradient(180deg, #C8D8E8 0%, #E8DCC8 100%)',
  },
  Stage:  {
    ground: '#5A4A8A', groundDark: '#4A3A7A', path: '#C8B0D8',
    border: '#2A1A5A', water: null,
    sky: 'linear-gradient(180deg, #2A1A5A 0%, #8A4AB0 100%)',
  },
  Lab:    {
    ground: '#3A2A5A', groundDark: '#2A1A4A', path: '#8A7AA0',
    border: '#1A0A3A', water: null,
    sky: 'linear-gradient(180deg, #0A0A2A 0%, #3A1A5A 100%)',
  },
}

/* ─────────────────────────────────────────────
   Zone별 소리 아이템 심볼 + 색상
───────────────────────────────────────────── */
const SOUND_ITEMS = {
  Forest: { symbols: ['♩','♪','♫','🐦','🍃'], itemBg: '#2A4A1A', itemBorder: '#5B9E3A' },
  Creek:  { symbols: ['〜','♒','💧','🌊','♪'], itemBg: '#0E2A4A', itemBorder: '#4A8FD4' },
  City:   { symbols: ['🔔','♪','📯','🚗','♫'], itemBg: '#2A2820', itemBorder: '#C4B99A' },
  Stage:  { symbols: ['🎵','♩','♪','♫','🎶'],  itemBg: '#1A1238', itemBorder: '#9B6DD4' },
  Lab:    { symbols: ['✦','❓','◈','⚡','🌀'], itemBg: '#1A0A38', itemBorder: '#D4883A' },
}

/* ─────────────────────────────────────────────
   경로 타일 생성 (각 Zone 내부 돌길)
───────────────────────────────────────────── */
function buildPaths(zone) {
  const cx = Math.floor(MAP_W / 2)
  const cy = Math.floor(MAP_H / 2)
  const paths = []
  // 가로 중앙로
  for (let tx = 2; tx < MAP_W - 2; tx++) paths.push({ tx, ty: cy })
  // 세로 중앙로
  for (let ty = 2; ty < MAP_H - 2; ty++) paths.push({ tx: cx, ty })
  // 입구 (하단)
  for (let tx = cx - 1; tx <= cx + 1; tx++) paths.push({ tx, ty: MAP_H - 1 })
  return paths
}

/* ─────────────────────────────────────────────
   Zone별 장식 오브젝트 위치
───────────────────────────────────────────── */
function buildZoneObjects(zone) {
  const objs = []
  const cx = MAP_W / 2, cy = MAP_H / 2
  const theme = ZONE_THEME[zone]

  if (zone === 'Forest') {
    // 나무 군집
    const treePositions = [
      {tx:1,ty:1},{tx:2,ty:2},{tx:4,ty:1},{tx:6,ty:2},{tx:8,ty:1},
      {tx:14,ty:1},{tx:16,ty:2},{tx:18,ty:1},{tx:20,ty:2},{tx:22,ty:1},
      {tx:1,ty:5},{tx:1,ty:8},{tx:1,ty:11},{tx:1,ty:14},
      {tx:22,ty:5},{tx:22,ty:8},{tx:22,ty:11},{tx:22,ty:14},
      {tx:1,ty:16},{tx:3,ty:16},{tx:19,ty:16},{tx:22,ty:16},
    ]
    treePositions.forEach((t,i) => objs.push({ type:'tree', ...t, variant: i%3 }))
    // 꽃밭
    for (let i=0;i<12;i++) objs.push({ type:'flower', tx:3+(i*83)%18, ty:3+(i*67)%11, variant:i%4 })
    // 오두막 (Zone 특징 건물)
    objs.push({ type:'cabin', tx:3, ty:3 })
    // 우물
    objs.push({ type:'well', tx:18, ty:3 })
  }

  if (zone === 'Creek') {
    // 연못 (정적 배경으로)
    objs.push({ type:'pond', tx:2, ty:2, w:6, h:5 })
    objs.push({ type:'pond', tx:15, ty:10, w:7, h:5 })
    // 바위
    for (let i=0;i<8;i++) objs.push({ type:'rock', tx:2+(i*71)%20, ty:2+(i*53)%13, variant:i%2 })
    // 부두
    objs.push({ type:'dock', tx:3, ty:6 })
    // 갈대
    for (let i=0;i<6;i++) objs.push({ type:'reed', tx:3+(i*31)%6, ty:2+(i*17)%4 })
  }

  if (zone === 'City') {
    // 건물들
    objs.push({ type:'building', tx:2, ty:1, h:5, variant:0 })
    objs.push({ type:'building', tx:7, ty:2, h:4, variant:1 })
    objs.push({ type:'building', tx:15, ty:1, h:6, variant:2 })
    objs.push({ type:'building', tx:19, ty:2, h:4, variant:0 })
    // 가로등
    for (let i=0;i<6;i++) objs.push({ type:'lamp', tx:4+i*3, ty:cy-1 })
    for (let i=0;i<6;i++) objs.push({ type:'lamp', tx:4+i*3, ty:cy+1 })
    // 분수
    objs.push({ type:'fountain', tx:cx-2, ty:cy-2 })
    // 벤치
    objs.push({ type:'bench', tx:4, ty:12 })
    objs.push({ type:'bench', tx:18, ty:12 })
  }

  if (zone === 'Stage') {
    // 무대
    objs.push({ type:'stage', tx:8, ty:2 })
    // 악기들
    objs.push({ type:'instrument', tx:3, ty:8, variant:0 })   // 피아노
    objs.push({ type:'instrument', tx:18, ty:8, variant:1 })  // 기타
    objs.push({ type:'instrument', tx:3, ty:13, variant:2 })  // 드럼
    objs.push({ type:'instrument', tx:18, ty:13, variant:3 }) // 스피커
    // 음표 파티클 (정적)
    for (let i=0;i<8;i++) objs.push({ type:'note', tx:2+(i*61)%20, ty:2+(i*43)%13 })
  }

  if (zone === 'Lab') {
    // 크리스탈 군집
    const crystalPos = [
      {tx:2,ty:2},{tx:4,ty:3},{tx:19,ty:2},{tx:21,ty:3},
      {tx:2,ty:13},{tx:4,ty:14},{tx:19,ty:13},{tx:21,ty:14},
      {tx:10,ty:2},{tx:13,ty:2},{tx:10,ty:14},{tx:13,ty:14},
    ]
    crystalPos.forEach((c,i) => objs.push({ type:'crystal', ...c, variant:i%5 }))
    // 별 파티클
    for (let i=0;i<16;i++) objs.push({ type:'star', tx:1+(i*73)%22, ty:1+(i*53)%15 })
    // 제단
    objs.push({ type:'altar', tx:cx-2, ty:3 })
  }

  return objs
}

/* ─────────────────────────────────────────────
   오브젝트 렌더러 (Zone별 픽셀 아트 요소)
───────────────────────────────────────────── */
function ZoneObject({ obj, zone, tick }) {
  const x = obj.tx * TILE
  const y = obj.ty * TILE
  const T = TILE
  const meta = ZONE_META[zone]

  if (obj.type === 'tree') {
    const COLORS = [
      { trunk:'#7A5230', canopy:'#2D7A2D', shadow:'#1F5C1F' },
      { trunk:'#8B5E3C', canopy:'#3A8C2F', shadow:'#2A6B22' },
      { trunk:'#6B4423', canopy:'#4A9E38', shadow:'#336E27' },
    ]
    const c = COLORS[obj.variant % 3]
    return (
      <g transform={`translate(${x+2},${y})`}>
        <ellipse cx={T/2} cy={T-3} rx={T*0.32} ry={5} fill="#00000022"/>
        <rect x={T*0.38} y={T*0.55} width={T*0.24} height={T*0.44} rx="2" fill={c.trunk}/>
        <rect x={T*0.08} y={T*0.34} width={T*0.84} height={T*0.28} rx="5" fill={c.shadow}/>
        <rect x={T*0.16} y={T*0.08} width={T*0.68} height={T*0.32} rx="6" fill={c.canopy}/>
        <rect x={T*0.26} y={T*0.1} width={T*0.2} height={T*0.1} rx="3" fill="white" opacity="0.25"/>
      </g>
    )
  }

  if (obj.type === 'flower') {
    const FC = [['#F4D03F','#F39C12'],['#E8A0C0','#D4608A'],['#A8D8EA','#6DB5D4'],['#F0F0AA','#D4D444']]
    const [p,c] = FC[obj.variant % 4]
    return (
      <g transform={`translate(${x+6},${y+10})`}>
        <rect x="6" y="5" width="2" height="8" rx="1" fill="#4A8C3A"/>
        <circle cx="7" cy="4" r="4" fill={p}/>
        <circle cx="7" cy="4" r="2" fill={c}/>
      </g>
    )
  }

  if (obj.type === 'cabin') {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="2" y={T*0.5} width={T*2.2} height={T*1.4} rx="2" fill="#8B6347"/>
        <polygon points={`-2,${T*0.55} ${T*1.1},${T*0.05} ${T*2.22},${T*0.55}`} fill="#C0392B"/>
        <rect x={T*0.8} y={T*1.2} width={T*0.5} height={T*0.7} rx="1" fill="#3A1A08"/>
        <rect x={T*0.15} y={T*0.65} width={T*0.5} height={T*0.38} rx="1" fill="#87CEEB" opacity="0.8"/>
        <rect x={T*1.55} y={T*0.65} width={T*0.5} height={T*0.38} rx="1" fill="#87CEEB" opacity="0.8"/>
        <rect x={T*1.6} y={T*0.32} width={T*0.25} height={T*0.26} rx="1" fill="#8B6347"/>
        <ellipse cx={T*1.7} cy={T*0.28} rx={5} ry={4} fill="#DDDDDD" opacity="0.5"/>
        <ellipse cx={T*1.8} cy={T*0.18} rx={4} ry={3} fill="#DDDDDD" opacity="0.3"/>
      </g>
    )
  }

  if (obj.type === 'well') {
    return (
      <g transform={`translate(${x+2},${y+2})`}>
        <ellipse cx={T/2} cy={T*0.8} rx={T*0.32} ry={T*0.12} fill="#4A8FD4" opacity="0.8"/>
        <rect x={T*0.2} y={T*0.3} width={T*0.6} height={T*0.5} rx="3" fill="#9A8070"/>
        <rect x={T*0.15} y={T*0.15} width={T*0.7} height={T*0.2} rx="2" fill="#7A6050"/>
        <rect x={T*0.4} y={0} width={T*0.08} height={T*0.2} rx="1" fill="#5A4030"/>
        <rect x={T*0.1} y={0} width={T*0.8} height={T*0.06} rx="1" fill="#5A4030"/>
      </g>
    )
  }

  if (obj.type === 'pond') {
    const pw = (obj.w || 4) * T, ph = (obj.h || 3) * T
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={pw/2} cy={ph/2} rx={pw*0.46} ry={ph*0.42} fill="#1E5A8A" opacity="0.9"/>
        <ellipse cx={pw/2} cy={ph/2} rx={pw*0.46} ry={ph*0.42} fill="none" stroke="#4A8FD4" strokeWidth="2" opacity="0.6"/>
        <path d={`M${pw*0.2},${ph*0.42} Q${pw*0.4},${ph*0.32} ${pw*0.6},${ph*0.42} Q${pw*0.8},${ph*0.52} ${pw},${ph*0.42}`}
          fill="none" stroke="#87CEEB" strokeWidth="1.5" opacity="0.5"/>
        <ellipse cx={pw*0.35} cy={ph*0.38} rx="8" ry="4" fill="#87CEEB" opacity="0.2"/>
      </g>
    )
  }

  if (obj.type === 'rock') {
    const ROCKS = [
      { rx:10,ry:8,fill:'#8A8070' },
      { rx:7,ry:6,fill:'#7A7060' },
    ]
    const r = ROCKS[obj.variant % 2]
    return (
      <g transform={`translate(${x+T/2},${y+T*0.7})`}>
        <ellipse cx={3} cy={4} rx={r.rx} ry={r.ry} fill="#00000022"/>
        <ellipse cx={0} cy={0} rx={r.rx} ry={r.ry} fill={r.fill}/>
        <ellipse cx={-3} cy={-3} rx={r.rx*0.5} ry={r.ry*0.4} fill="white" opacity="0.15"/>
      </g>
    )
  }

  if (obj.type === 'dock') {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="4" y={T*0.3} width={T*2.5} height={T*0.3} rx="2" fill="#8B6347"/>
        {[0,1,2,3].map(i => (
          <rect key={i} x={T*0.25+i*T*0.58} y={T*0.3} width="5" height={T*0.7} rx="2" fill="#6B4327"/>
        ))}
      </g>
    )
  }

  if (obj.type === 'reed') {
    return (
      <g transform={`translate(${x+T*0.4},${y})`}>
        <rect x="4" y={T*0.1} width="3" height={T*0.8} rx="1.5" fill="#4A7A3A"/>
        <ellipse cx="5" cy={T*0.12} rx="4" ry="8" fill="#8B6340"/>
        <rect x="10" y={T*0.2} width="3" height={T*0.7} rx="1.5" fill="#4A7A3A"/>
        <ellipse cx="11" cy={T*0.22} rx="3" ry="6" fill="#8B6340"/>
      </g>
    )
  }

  if (obj.type === 'building') {
    const BLD = [
      { wall:'#B0A090', roof:'#C0392B', win:'#87CEEB' },
      { wall:'#A09080', roof:'#8B6347', win:'#F4D03F' },
      { wall:'#C0B0A0', roof:'#5A8A5A', win:'#87CEEB' },
    ]
    const b = BLD[obj.variant % 3]
    const bh = (obj.h || 4) * T
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="4" y={T*1.5} width={T*2} height={bh} rx="2" fill={b.wall}/>
        <polygon points={`0,${T*1.6} ${T},${T*0.8} ${T*2},${T*1.6}`} fill={b.roof}/>
        {[0,1].map(r => [0,1].map(c => (
          <rect key={`${r}${c}`} x={T*0.25+c*T*0.9} y={T*2+r*T*0.9} width={T*0.45} height={T*0.38} rx="2" fill={b.win} opacity="0.85"/>
        )))}
      </g>
    )
  }

  if (obj.type === 'lamp') {
    return (
      <g transform={`translate(${x+T/2},${y})`}>
        <rect x="-2" y={T*0.1} width="4" height={T*0.8} rx="2" fill="#6B6660"/>
        <rect x="-5" y={T*0.08} width="10" height="4" rx="1" fill="#5A5550"/>
        <circle cx="0" cy={T*0.08} r="5" fill="#FFD700" opacity="0.9"/>
        <circle cx="0" cy={T*0.08} r="8" fill="#FFD700" opacity="0.15"/>
      </g>
    )
  }

  if (obj.type === 'fountain') {
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx={T} cy={T*1.6} rx={T*1.1} ry={T*0.45} fill="#4A8FD4" opacity="0.75"/>
        <rect x={T*0.75} y={T*0.4} width={T*0.5} height={T*1.3} rx="4" fill="#9A9585"/>
        <ellipse cx={T} cy={T*0.4} rx={T*0.4} ry={T*0.18} fill="#4A8FD4" opacity="0.8"/>
        {[0,1,2].map(i => (
          <ellipse key={i}
            cx={T + Math.cos(i*2.1 + tick*0.04)*12}
            cy={T*0.3 + Math.sin(i*2.1 + tick*0.04)*4}
            rx="3" ry="5" fill="#4A8FD4" opacity="0.5"
          />
        ))}
      </g>
    )
  }

  if (obj.type === 'bench') {
    return (
      <g transform={`translate(${x+2},${y+T*0.5})`}>
        <rect x="0" y="6" width={T*1.5} height="6" rx="2" fill="#8B6347"/>
        <rect x="4" y="6" width="5" height="10" rx="1" fill="#6B4327"/>
        <rect x={T*1.1} y="6" width="5" height="10" rx="1" fill="#6B4327"/>
        <rect x="0" y="2" width={T*1.5} height="5" rx="2" fill="#A07050"/>
      </g>
    )
  }

  if (obj.type === 'stage') {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="2" y={T*0.8} width={T*6} height={T*1.4} rx="4" fill="#5A4A3A"/>
        <rect x="2" y={T*0.8} width={T*6} height="8" rx="4" fill="#7A6A5A"/>
        <rect x="0" y={T*0.2} width={T*1.2} height={T*2} rx="2" fill="#8B2252"/>
        <rect x={T*4.8} y={T*0.2} width={T*1.2} height={T*2} rx="2" fill="#8B2252"/>
        <text x={T*3} y={T*1.5} textAnchor="middle" fontSize="18" style={{userSelect:'none'}}>🎤</text>
      </g>
    )
  }

  if (obj.type === 'instrument') {
    const INST = ['🎹','🎸','🥁','🔊']
    return (
      <g transform={`translate(${x+2},${y+2})`}>
        <rect x="0" y="0" width={T*1.5} height={T*1.5} rx="6"
          fill="#1A1238" stroke="#9B6DD4" strokeWidth="1.5" opacity="0.9"/>
        <text x={T*0.75} y={T*0.95} textAnchor="middle" fontSize="18" style={{userSelect:'none'}}>
          {INST[obj.variant % 4]}
        </text>
      </g>
    )
  }

  if (obj.type === 'note') {
    const NOTES = ['♩','♪','♫','♬','𝄞']
    const bobY  = Math.sin(tick * 0.05 + obj.tx * 0.8) * 3
    const alpha = 0.3 + Math.sin(tick * 0.04 + obj.ty * 0.7) * 0.3
    return (
      <text x={x + T/2} y={y + T/2 + bobY}
        textAnchor="middle" fontSize="14"
        fill={meta.color} opacity={alpha}
        style={{userSelect:'none', pointerEvents:'none'}}>
        {NOTES[(obj.tx + obj.ty) % NOTES.length]}
      </text>
    )
  }

  if (obj.type === 'crystal') {
    const COLS = ['#9B6DD4','#D4883A','#4A8FD4','#6DD49B','#D46D9B']
    const c    = COLS[obj.variant % COLS.length]
    const h    = 16 + (obj.variant % 3) * 6
    const glow = Math.sin(tick * 0.05 + obj.variant) * 0.25 + 0.55
    return (
      <g transform={`translate(${x + T/2},${y + T*0.8})`} opacity={glow}>
        <polygon points={`0,${-h} ${-h*0.22},0 ${h*0.22},0`} fill={c}/>
        <polygon points={`0,${-h*0.6} ${-h*0.22},0 ${h*0.22},0`} fill={c} opacity="0.35"/>
        <circle cx="0" cy={-h+2} r="2" fill="white" opacity="0.8"/>
      </g>
    )
  }

  if (obj.type === 'star') {
    const alpha = 0.2 + Math.sin(tick * 0.06 + obj.tx * 1.1 + obj.ty * 0.7) * 0.35
    return (
      <text x={x + T*0.5} y={y + T*0.6}
        textAnchor="middle" fontSize="10"
        fill={meta.color} opacity={alpha}
        style={{userSelect:'none', pointerEvents:'none'}}>
        ✦
      </text>
    )
  }

  if (obj.type === 'altar') {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="4" y={T*0.6} width={T*3.5} height={T*1} rx="4" fill="#3A2A5A"/>
        <rect x="8" y={T*0.3} width={T*2.5} height={T*0.35} rx="3" fill="#5A4A7A"/>
        {[0,1,2,3].map(i => {
          const c = ['#D4883A','#9B6DD4','#4A8FD4','#D46D9B'][i]
          const bobY = Math.sin(tick * 0.07 + i) * 4
          return (
            <g key={i} transform={`translate(${i*T*0.85+10},${-bobY})`}>
              <polygon points={`0,${-12} ${-5},0 ${5},0`} fill={c} opacity="0.9"/>
              <circle cx="0" cy="-12" r="2" fill="white" opacity="0.8"/>
            </g>
          )
        })}
      </g>
    )
  }

  return null
}

/* ─────────────────────────────────────────────
   소리 아이템 — PNG 에셋 / SVG 보석상자 폴백
───────────────────────────────────────────── */
function SoundItem({ item, zone, tick }) {
  const si    = SOUND_ITEMS[zone] || SOUND_ITEMS.Forest
  const px    = item.tx * TILE + TILE / 2
  const py    = item.ty * TILE + TILE / 2
  const bobY  = Math.sin(tick * 0.06 + item.pulse) * 4
  const glow  = Math.sin(tick * 0.08 + item.pulse) * 0.2 + 0.7
  const items = ITEMS[zone] || []
  const imgSrc = items[item.index % items.length]

  return (
    <g transform={`translate(${px}, ${py + bobY})`} opacity={glow}>
      {/* 후광 */}
      <circle r="20" fill={si.itemBorder} opacity="0.12"/>
      {/* 파티클 */}
      {[0,1,2].map(i => (
        <circle key={i}
          cx={Math.cos(tick * 0.05 + i * 2.09) * 18}
          cy={Math.sin(tick * 0.05 + i * 2.09) * 18}
          r="2" fill={si.itemBorder}
          opacity={0.35 + Math.sin(tick * 0.1 + i) * 0.25}
        />
      ))}

      {/* PNG 아이콘 (에셋 있을 때) */}
      {ASSET_READY.items && imgSrc ? (
        <>
          <rect x="-14" y="-14" width="28" height="28" rx="6"
            fill={si.itemBg} stroke={si.itemBorder} strokeWidth="1.5"/>
          <image
            href={imgSrc}
            x="-10" y="-10" width="20" height="20"
            style={{ imageRendering: 'pixelated' }}
          />
        </>
      ) : (
        <>
          {/* SVG 보석상자 폴백 */}
          <rect x="-12" y="-11" width="24" height="22" rx="5"
            fill={si.itemBg} stroke={si.itemBorder} strokeWidth="1.5"/>
          <rect x="-12" y="-11" width="24" height="9" rx="4"
            fill={`${si.itemBorder}44`} stroke={si.itemBorder} strokeWidth="1"/>
          <rect x="-4" y="-12" width="8" height="4" rx="2" fill={si.itemBorder}/>
          <circle cx="0" cy="4" r="3.5" fill={si.itemBorder} opacity="0.9"/>
          <circle cx="0" cy="4" r="1.8" fill={si.itemBg}/>
          <text textAnchor="middle" y="2" fontSize="9"
            fill={si.itemBorder}
            style={{ userSelect:'none', fontFamily:'Nunito,sans-serif', fontWeight:'bold' }}>
            {item.symbol}
          </text>
        </>
      )}
      <circle cx="-5" cy="-7" r="2" fill="white" opacity={0.3 + Math.sin(tick*0.12)*0.3}/>
    </g>
  )
}

/* ─────────────────────────────────────────────
   픽셀 캐릭터 (WorldMap과 동일 — 4방향)
───────────────────────────────────────────── */
function PixelChar({ dir, moving }) {
  const tick  = Math.floor(Date.now() / 160) % 2
  const frame = moving ? tick : 0
  const legLY = frame === 0 ? 18 : 21
  const legRY = frame === 0 ? 21 : 18
  const flip  = dir === 'left' ? 'scale(-1,1) translate(-22,0)' : ''
  return (
    <svg width={CHAR_W} height={CHAR_H} viewBox="0 0 22 28"
      style={{ imageRendering:'pixelated', overflow:'visible' }}>
      <g transform={flip}>
        <ellipse cx="11" cy="27" rx="7" ry="2" fill="#00000033"/>
        <rect x="4" y="2" width="14" height="3" rx="2" fill="#2A2A3A"/>
        <rect x="2" y="4" width="4" height="5" rx="2" fill="#4A4A6A"/>
        <rect x="16" y="4" width="4" height="5" rx="2" fill="#4A4A6A"/>
        <rect x="3" y="5" width="2" height="3" rx="1" fill="#7B6DD4" opacity="0.8"/>
        <rect x="17" y="5" width="2" height="3" rx="1" fill="#7B6DD4" opacity="0.8"/>
        <rect x="5" y="4" width="12" height="10" rx="3" fill="#F4C87A"/>
        {dir === 'up' ? (
          <>
            <rect x="7" y="9" width="2" height="1.5" rx="0.5" fill="#333"/>
            <rect x="13" y="9" width="2" height="1.5" rx="0.5" fill="#333"/>
          </>
        ) : (
          <>
            <rect x="7" y="8" width="2.5" height="2.5" rx="0.8" fill="#333"/>
            <rect x="12" y="8" width="2.5" height="2.5" rx="0.8" fill="#333"/>
            <rect x="7.5" y="8.3" width="1" height="1" rx="0.3" fill="white" opacity="0.8"/>
            <rect x="12.5" y="8.3" width="1" height="1" rx="0.3" fill="white" opacity="0.8"/>
          </>
        )}
        <circle cx="6.5" cy="11" r="1.5" fill="#F09090" opacity="0.5"/>
        <circle cx="15.5" cy="11" r="1.5" fill="#F09090" opacity="0.5"/>
        {dir !== 'up' && <rect x="8" y="12" width="6" height="1.5" rx="0.8" fill="#D4886A"/>}
        <rect x="5" y="15" width="12" height="8" rx="2" fill="#4A7CC4"/>
        <rect x="8" y="16" width="6" height="2" rx="1" fill="#6A9CE4" opacity="0.6"/>
        <rect x="2" y="15" width="4" height="6" rx="2" fill="#3A6AB4"/>
        <rect x="16" y="15" width="4" height="6" rx="2" fill="#3A6AB4"/>
        <rect x="5" y={legLY} width="5" height="5" rx="2" fill="#2A5090"/>
        <rect x="12" y={legRY} width="5" height="5" rx="2" fill="#2A5090"/>
        <rect x="4" y="23" width="6" height="3" rx="1.5" fill="#1A1A2A"/>
        <rect x="12" y="23" width="6" height="3" rx="1.5" fill="#1A1A2A"/>
      </g>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Zone 내부 HUD (상단 — WorldMap HUD와 통일)
───────────────────────────────────────────── */
function ZoneHUD({ zone, collected, total, onExit }) {
  const meta = ZONE_META[zone]
  const pct  = total > 0 ? Math.round((collected / total) * 100) : 0
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:`${HUD_H}px`,
      background:'#F5EDD8', borderBottom:'3px solid #C8A96E',
      display:'flex', alignItems:'center', padding:'0 16px', gap:'14px',
      fontFamily:'Nunito, sans-serif', zIndex:20,
      boxShadow:'0 2px 8px #00000033',
    }}>
      {/* 뒤로가기 */}
      <button onClick={onExit} style={{
        padding:'6px 14px', borderRadius:'8px',
        background:'#E8D8B8', border:'2px solid #C8A96E',
        color:'#3A2A14', fontSize:'12px', fontWeight:700,
        fontFamily:'Nunito, sans-serif', cursor:'pointer',
        display:'flex', alignItems:'center', gap:'4px',
      }}>
        ← 월드맵
      </button>

      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>

      {/* Zone 정보 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'22px' }}>{meta.emoji}</span>
        <div>
          <div style={{ fontSize:'13px', fontWeight:800, color:'#3A2A14', lineHeight:1.1 }}>{meta.label}</div>
          <div style={{ fontSize:'10px', color:'#8B6A3A' }}>소리를 찾아 수집하세요</div>
        </div>
      </div>

      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>

      {/* 진행도 */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
          <span style={{ fontSize:'11px', fontWeight:700, color:'#3A2A14' }}>소리 수집</span>
          <span style={{ fontSize:'11px', color:'#8B6A3A' }}>{collected}/{total} ({pct}%)</span>
        </div>
        <div style={{ height:'8px', background:'#D4C4A0', borderRadius:'4px', overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:'4px',
            background:`linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
            width:`${pct}%`, transition:'width 0.4s ease',
          }}/>
        </div>
      </div>

      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>

      {/* 조작 힌트 */}
      <div style={{ fontSize:'10px', color:'#8B6A3A', lineHeight:1.7, textAlign:'right' }}>
        방향키 / WASD 이동<br/>
        ESC 나가기
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   소리 아이템 생성
───────────────────────────────────────────── */
function spawnSoundItems(sounds, zone) {
  const si = SOUND_ITEMS[zone] || SOUND_ITEMS.Forest
  const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2)

  // 경로 타일 셋 (아이템 배치 금지)
  const pathSet = new Set()
  for (let tx = 2; tx < MAP_W - 2; tx++) pathSet.add(`${tx},${cy}`)
  for (let ty = 2; ty < MAP_H - 2; ty++) pathSet.add(`${cx},${ty}`)

  // 배치 가능한 모든 타일을 수집 (맵 테두리 1칸, 경로 제외)
  const candidates = []
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (!pathSet.has(`${tx},${ty}`)) candidates.push({ tx, ty })
    }
  }

  // Fisher-Yates 셔플로 고르게 분산
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  return sounds.map((s, i) => {
    const pos = candidates[i % candidates.length]
    return {
      id:        s.sound_id,
      sound:     s,
      tx:        pos.tx,
      ty:        pos.ty,
      index:     i,
      symbol:    si.symbols[i % si.symbols.length],
      collected: false,
      pulse:     Math.random() * Math.PI * 2,
    }
  })
}

/* ─────────────────────────────────────────────
   수집 완료 모달
───────────────────────────────────────────── */
function CompleteModal({ zone, onExit }) {
  const meta = ZONE_META[zone]
  return (
    <div style={{
      position:'absolute', inset:0,
      background:'#00000088', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:50,
    }}>
      <div style={{
        background:'#F5EDD8', border:`3px solid ${meta.color}`,
        borderRadius:'20px', padding:'32px 40px',
        textAlign:'center', fontFamily:'Nunito, sans-serif',
        animation:'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow:`0 8px 40px ${meta.color}44`,
      }}>
        <div style={{ fontSize:'48px', marginBottom:'12px' }}>🎉</div>
        <div style={{ fontSize:'18px', fontWeight:800, color:'#3A2A14', marginBottom:'6px' }}>
          모든 소리 수집 완료!
        </div>
        <div style={{ fontSize:'13px', color:'#8B6A3A', marginBottom:'20px', lineHeight:1.6 }}>
          {meta.emoji} {meta.label}의 모든 소리를 기록했어요<br/>
          수고 많으셨어요! 🎧
        </div>
        <button onClick={onExit} style={{
          padding:'12px 28px', borderRadius:'12px',
          background:meta.color, border:'none',
          color:'#fff', fontSize:'14px', fontWeight:700,
          fontFamily:'Nunito, sans-serif', cursor:'pointer',
          boxShadow:`0 4px 16px ${meta.color}66`,
        }}>
          월드맵으로 돌아가기
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ZoneMap 메인
───────────────────────────────────────────── */
export default function ZoneMap({ zone, sounds, onCollectSound, onExit, collectedIds = new Set(), isAnnotating = false }) {
  const meta   = ZONE_META[zone]
  const theme  = ZONE_THEME[zone]
  const { keys, press, release } = useKeys()

  // 오브젝트 (한 번만 생성)
  const zoneObjects = useRef(buildZoneObjects(zone))
  const pathTiles   = useRef(buildPaths(zone))

  const [pos,        setPos]       = useState({ x: PX_W/2 - CHAR_W/2, y: PX_H - TILE*3 })
  const [dir,        setDir]       = useState('up')
  const [moving,     setMoving]    = useState(false)
  const [cam,        setCam]       = useState({ x: 0, y: 0 })
  const [tick,       setTick]      = useState(0)
  const [vp,         setVp]        = useState({
    w: typeof window !== 'undefined' ? window.innerWidth  : 800,
    h: typeof window !== 'undefined' ? window.innerHeight - HUD_H : 540,
  })
  // 아이템은 초기화 후 위치가 변하지 않으므로 ref로 관리
  // 가시성은 부모의 collectedIds(제출 완료 후 갱신)로만 결정
  const itemsRef     = useRef(null)
  if (itemsRef.current === null) itemsRef.current = spawnSoundItems(sounds, zone)

  const [collecting, setCollecting]= useState(null)
  // 현재 수집 진행 중(annotation 열려 있는 동안) 새 충돌 차단
  const collectingRef = useRef(false)

  const posRef = useRef(pos)
  const viewW  = useRef(typeof window !== 'undefined' ? window.innerWidth  : 800)
  const viewH  = useRef(typeof window !== 'undefined' ? window.innerHeight - HUD_H : 540)
  const rafRef = useRef(null)

  // 뷰포트
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth, h = window.innerHeight - HUD_H
      viewW.current = w; viewH.current = h
      setVp({ w, h })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ESC
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit])

  // annotation 패널이 닫히면(제출 or 스킵) 충돌 잠금 해제
  useEffect(() => {
    if (!isAnnotating) collectingRef.current = false
  }, [isAnnotating])

  // 게임 루프
  useEffect(() => {
    let lastTime = performance.now(), tickCount = 0
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime  = now
      tickCount++
      setTick(tickCount)

      const k = keys.current
      let { x, y } = posRef.current
      let moved = false, newDir = dir
      const spd = SPEED * dt
      const minX = TILE, maxX = PX_W - TILE - CHAR_W
      const minY = TILE, maxY = PX_H - TILE - CHAR_H

      if (k.up)    { y = Math.max(minY, y - spd); newDir = 'up';    moved = true }
      if (k.down)  { y = Math.min(maxY, y + spd); newDir = 'down';  moved = true }
      if (k.left)  { x = Math.max(minX, x - spd); newDir = 'left';  moved = true }
      if (k.right) { x = Math.min(maxX, x + spd); newDir = 'right'; moved = true }

      if (moved) {
        posRef.current = { x, y }
        setPos({ x, y })
        if (newDir !== dir) setDir(newDir)
        setMoving(true)
        const camX = Math.max(0, Math.min(PX_W - viewW.current, x + CHAR_W/2 - viewW.current/2))
        const camY = Math.max(0, Math.min(PX_H - viewH.current, y + CHAR_H/2 - viewH.current/2))
        setCam({ x: camX, y: camY })

        // 아이템 충돌 — annotation 열려 있으면 완전 차단
        if (!collectingRef.current) {
          for (const item of itemsRef.current) {
            if (collectedIds.has(item.id)) continue
            const ix = item.tx * TILE + TILE / 2 - 12
            const iy = item.ty * TILE + TILE / 2 - 12
            if (overlaps(x, y, CHAR_W, CHAR_H, ix, iy, 24, 24)) {
              collectingRef.current = true
              setCollecting(item)
              setTimeout(() => { setCollecting(null); onCollectSound(item.sound) }, 500)
              break
            }
          }
        }
      } else {
        setMoving(false)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, collectedIds])

  const remaining = itemsRef.current.filter(it => !collectedIds.has(it.id)).length
  const total     = itemsRef.current.length
  const collected = total - remaining

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', userSelect:'none' }}>

      {/* Zone HUD */}
      <ZoneHUD zone={zone} collected={collected} total={total} onExit={onExit}/>

      {/* 게임 캔버스 */}
      <div style={{
        position:'absolute', top:`${HUD_H}px`, left:0, right:0, bottom:0,
        background: theme.sky, overflow:'hidden', cursor:'none',
      }}>
        <svg
          width="100%" height="100%"
          viewBox={`${cam.x} ${cam.y} ${vp.w} ${vp.h}`}
          style={{ display:'block', position:'absolute', inset:0 }}
        >
          <defs>
            {ASSET_READY.tiles ? (
              <pattern id={`ground_${zone}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                <image href={ZONE_GROUND_TILE[zone]} width={TILE} height={TILE} style={{ imageRendering:'pixelated' }}/>
              </pattern>
            ) : (
              <pattern id={`ground_${zone}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                <rect width={TILE} height={TILE} fill={theme.ground}/>
                <rect width={TILE} height={TILE} fill="none" stroke={theme.groundDark} strokeWidth="0.4" opacity="0.5"/>
                <rect x="3"  y="5"  width="2" height="6" rx="1" fill={theme.groundDark} opacity="0.3"/>
                <rect x="18" y="8"  width="2" height="5" rx="1" fill={theme.groundDark} opacity="0.25"/>
                <rect x="26" y="3"  width="2" height="7" rx="1" fill={theme.groundDark} opacity="0.2"/>
              </pattern>
            )}
          </defs>

          {/* 바닥 */}
          <rect width={PX_W} height={PX_H} fill={`url(#ground_${zone})`}/>

          {/* 경계 울타리 */}
          <rect x="0" y="0" width={PX_W} height={PX_H}
            fill="none" stroke={theme.border} strokeWidth="6"/>
          <rect x="3" y="3" width={PX_W-6} height={PX_H-6}
            fill="none" stroke={`${meta.color}44`} strokeWidth="2" strokeDasharray="8 4"/>

          {/* 경로 타일 */}
          {pathTiles.current.map((p, i) => (
            <rect key={i}
              x={p.tx * TILE} y={p.ty * TILE} width={TILE} height={TILE}
              fill={theme.path} stroke={`${theme.path}88`} strokeWidth="0.5"
            />
          ))}

          {/* Zone 오브젝트 */}
          {zoneObjects.current.map((obj, i) => (
            <ZoneObject key={i} obj={obj} zone={zone} tick={tick}/>
          ))}

          {/* 소리 아이템 — 제출 완료된 것만 숨김 */}
          {itemsRef.current
            .filter(it => !collectedIds.has(it.id))
            .map(item => (
              <SoundItem key={item.id} item={item} zone={zone} tick={tick}/>
            ))
          }

          {/* 캐릭터 */}
          <foreignObject x={pos.x} y={pos.y} width={CHAR_W} height={CHAR_H} style={{ overflow:'visible' }}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width:CHAR_W, height:CHAR_H }}>
              <PixelChar dir={dir} moving={moving}/>
            </div>
          </foreignObject>

          {/* 발견 이펙트 */}
          {collecting && (
            <g transform={`translate(${pos.x + CHAR_W/2}, ${pos.y - 16})`}>
              <rect x="-20" y="-14" width="40" height="18" rx="6" fill="#F5EDD8" stroke="#C8A96E" strokeWidth="1"/>
              <text textAnchor="middle" y="-1" fontSize="11"
                fill="#3A2A14" fontFamily="Nunito,sans-serif" fontWeight="700">
                {collecting.symbol} 발견!
              </text>
            </g>
          )}

          {/* 입구 표시 */}
          <g transform={`translate(${PX_W/2 - 40}, ${PX_H - TILE + 2})`}>
            <rect width="80" height={TILE-4} rx="4" fill={theme.path}
              stroke={meta.color} strokeWidth="1"/>
            <text x="40" y="14" textAnchor="middle" fontSize="9"
              fontFamily="Nunito, sans-serif" fill="#3A2A14" fontWeight="700">
              ↓ 입구
            </text>
          </g>
        </svg>
      </div>

      {/* 모바일 D-Pad */}
      <DPad press={press} release={release} onExit={onExit}/>

      {/* 완료 모달 */}
      {remaining === 0 && total > 0 && (
        <CompleteModal zone={zone} onExit={onExit}/>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   D-Pad
───────────────────────────────────────────── */
function DPad({ press, release, onExit }) {
  const BTN = [
    { dir:'up',    label:'▲', gridArea:'1/2' },
    { dir:'left',  label:'◀', gridArea:'2/1' },
    { dir:'down',  label:'▼', gridArea:'2/2' },
    { dir:'right', label:'▶', gridArea:'2/3' },
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
        <div key={b.dir} style={{ ...s, gridArea:b.gridArea }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press(b.dir) }}
          onPointerUp={() => release(b.dir)}
          onPointerCancel={() => release(b.dir)}
        >{b.label}</div>
      ))}
    </div>
  )
}