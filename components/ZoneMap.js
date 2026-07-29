'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ITEMS, ASSET_READY, ZONE_GROUND_TILE, LAB_DECOR } from '@/components/AssetRegistry'

/* ─────────────────────────────────────────────
   맵 크기
───────────────────────────────────────────── */
const MAP_W   = 48          // 타일 수 (2× 확장)
const MAP_H   = 36
const PX_W    = MAP_W * TILE  // 1536
const PX_H    = MAP_H * TILE  // 1152
const VIEW_W  = 24 * TILE     // 768 — 화면에 보이는 뷰포트
const VIEW_H  = 18 * TILE     // 576
const CHAR_W  = 22
const CHAR_H  = 28
const HUD_H   = 56

// block(구역) 경계선 좌우/상하로 아이템을 놓지 않는 여백(칸 수) — 열린 구역과
// 잠긴 구역 사이에 "길"만큼의 실제 시각적 거리를 만든다.
const PATH_BUFFER = 1

/* ─────────────────────────────────────────────
   Zone별 배경 팔레트
───────────────────────────────────────────── */
const ZONE_THEME = {
  Animal: {
    ground: '#4A8B2A', groundDark: '#3A7A1A', path: '#C8B48A',
    border: '#2A5A10', water: null,
    sky: 'linear-gradient(180deg, #87CEEB 0%, #C8E8A0 100%)',
  },
  Human:  {
    ground: '#8B7A60', groundDark: '#7A6A50', path: '#D4C8A8',
    border: '#6A5840', water: null,
    sky: 'linear-gradient(180deg, #E8D0B0 0%, #F5EDD8 100%)',
  },
  Nature: {
    ground: '#4A7A8B', groundDark: '#3A6A7A', path: '#C8C0A8',
    border: '#1A3A5A', water: '#4A8FD4',
    sky: 'linear-gradient(180deg, #87CEEB 0%, #B0D8F0 100%)',
  },
  Urban:  {
    ground: '#8A8070', groundDark: '#7A7060', path: '#D4C8B0',
    border: '#4A4030', water: null,
    sky: 'linear-gradient(180deg, #C8D8E8 0%, #E8DCC8 100%)',
  },
  Music:  {
    ground: '#5A4A8A', groundDark: '#4A3A7A', path: '#C8B0D8',
    border: '#2A1A5A', water: null,
    sky: 'linear-gradient(180deg, #2A1A5A 0%, #8A4AB0 100%)',
  },
  Lab:    {
    // "미지의 소리 마을" — 코지 에셋의 할로윈풍 액자(ALIEN/BAT/해골 포스터)·가구·호박·박쥐로
    // 꾸미면서, 배경도 마법사풍 보라색 대신 사진 속 방 느낌(어두운 나무 바닥 + 그을린 벽돌
    // 벽)으로 — 색상은 interior full 팩의 실제 벽돌/원목 wallpaper 스와치에서 샘플링.
    ground: '#5A4030', groundDark: '#432E20', path: '#6A5548',
    border: '#4A2530', water: null,
    sky: 'linear-gradient(180deg, #140E1C 0%, #3A2028 100%)',
  },
}

/* ─────────────────────────────────────────────
   Zone별 소리 아이템 심볼 + 색상
───────────────────────────────────────────── */
const SOUND_ITEMS = {
  Animal: { symbols: ['🐦','🐾','🦋','🐸','🐝'], itemBg: '#1A3A0A', itemBorder: '#5B9E3A' },
  Human:  { symbols: ['👣','👏','💨','😄','🤲'], itemBg: '#3A2A1A', itemBorder: '#E8A04A' },
  Nature: { symbols: ['💧','🌊','⛈','💨','🔥'], itemBg: '#0E2A4A', itemBorder: '#4A8FD4' },
  Urban:  { symbols: ['🚗','🔔','🚨','⚙','🏗'], itemBg: '#2A2820', itemBorder: '#C4B99A' },
  Music:  { symbols: ['🎵','♩','♪','♫','🎶'],   itemBg: '#1A1238', itemBorder: '#9B6DD4' },
  Lab:    { symbols: ['✦','❓','◈','⚡','🌀'],   itemBg: '#1A0A38', itemBorder: '#D4883A' },
}

/* ─────────────────────────────────────────────
   block(구역) 격자 계산 — buildPaths()와 spawnSoundItems()가 공유
───────────────────────────────────────────── */
// zone에 실제로 존재하는 block 개수(n)에 딱 맞는 cols×rows를 골라서, block이
// 적은 zone(예: 7개)은 셀을 크게, block이 많은 zone(예: 11개)은 그만큼만
// 촘촘하게 나눈다 — 셀이 불필요하게 작아지지 않으면서도 항상 모든 block이
// 자기 셀을 하나씩 갖는다.
function computeBlockGrid(sounds) {
  const byBlock = new Map()
  for (const s of sounds) {
    const b = s.block || 1
    if (!byBlock.has(b)) byBlock.set(b, [])
    byBlock.get(b).push(s)
  }
  const blockNums = [...byBlock.keys()].sort((a, b) => a - b)
  const n = Math.max(1, blockNums.length)

  let cols = Math.max(1, Math.round(Math.sqrt(n * (MAP_W / MAP_H))))
  let rows = Math.ceil(n / cols)
  while (cols * rows < n) cols++ // 반올림 오차로 셀이 모자라면 열을 늘려 보정

  const colBounds = []
  for (let i = 0; i <= cols; i++) colBounds.push(Math.round(2 + (MAP_W - 4) * i / cols))
  const rowBounds = []
  for (let i = 0; i <= rows; i++) rowBounds.push(Math.round(2 + (MAP_H - 4) * i / rows))

  return { byBlock, blockNums, cols, rows, colBounds, rowBounds }
}

/* ─────────────────────────────────────────────
   경로 타일 생성 (각 Zone 내부 돌길)
───────────────────────────────────────────── */
function buildPaths(sounds) {
  const cx = Math.floor(MAP_W / 2)
  const paths = []
  const seen = new Set()
  const add = (tx, ty) => {
    const k = `${tx},${ty}`
    if (seen.has(k)) return
    seen.add(k)
    paths.push({ tx, ty })
  }
  // block 경계선을 PATH_BUFFER만큼 넓혀서 그린다 — 이 폭이 곧 spawnSoundItems()가
  // 아이템을 놓지 않는 여백과 정확히 일치해서, "길"이 곧 block 사이의 경계가 된다.
  const { cols, rows, colBounds, rowBounds } = computeBlockGrid(sounds)
  for (let i = 1; i < cols; i++) {
    const txLine = colBounds[i]
    for (let d = -PATH_BUFFER; d <= PATH_BUFFER; d++) {
      for (let ty = 2; ty < MAP_H - 2; ty++) add(txLine + d, ty)
    }
  }
  for (let i = 1; i < rows; i++) {
    const tyLine = rowBounds[i]
    for (let d = -PATH_BUFFER; d <= PATH_BUFFER; d++) {
      for (let tx = 2; tx < MAP_W - 2; tx++) add(tx, tyLine + d)
    }
  }
  // 입구 (하단)
  for (let tx = cx - 1; tx <= cx + 1; tx++) add(tx, MAP_H - 1)
  return paths
}

/* ─────────────────────────────────────────────
   Zone별 장식 오브젝트 위치
───────────────────────────────────────────── */
function buildZoneObjects(zone) {
  const objs = []
  const cx = MAP_W / 2, cy = MAP_H / 2
  // 구버전 24×18 좌표계 → 현재 48×36 좌표계로 변환
  const s = (v) => v * 2

  if (zone === 'Animal') {
    const treePositions = [
      {tx:1,ty:1},{tx:2,ty:2},{tx:4,ty:1},{tx:6,ty:2},{tx:8,ty:1},
      {tx:14,ty:1},{tx:16,ty:2},{tx:18,ty:1},{tx:20,ty:2},{tx:22,ty:1},
      {tx:1,ty:5},{tx:1,ty:8},{tx:1,ty:11},{tx:1,ty:14},
      {tx:22,ty:5},{tx:22,ty:8},{tx:22,ty:11},{tx:22,ty:14},
      {tx:1,ty:16},{tx:3,ty:16},{tx:19,ty:16},{tx:22,ty:16},
      // 확장 영역 추가 장식
      {tx:26,ty:2},{tx:30,ty:1},{tx:34,ty:2},{tx:38,ty:1},{tx:42,ty:2},{tx:46,ty:1},
      {tx:46,ty:5},{tx:46,ty:10},{tx:46,ty:15},{tx:46,ty:20},{tx:46,ty:25},{tx:46,ty:30},
      {tx:1,ty:20},{tx:1,ty:25},{tx:1,ty:30},{tx:3,ty:34},{tx:46,ty:34},
      {tx:26,ty:34},{tx:30,ty:34},{tx:34,ty:34},{tx:38,ty:34},
    ]
    treePositions.forEach((t,i) => objs.push({ type:'tree', tx:t.tx, ty:t.ty, variant: i%3 }))
    for (let i=0;i<30;i++) objs.push({ type:'flower', tx:3+(i*83)%42, ty:3+(i*67)%28, variant:i%4 })
    objs.push({ type:'cabin', tx:s(3), ty:s(3) })
    objs.push({ type:'well',  tx:s(18), ty:s(3) })
    objs.push({ type:'cabin', tx:36, ty:20 })
    objs.push({ type:'well',  tx:40, ty:24 })
  }

  if (zone === 'Human') {
    objs.push({ type:'building', tx:s(2),  ty:s(1), h:4, variant:0 })
    objs.push({ type:'building', tx:s(18), ty:s(1), h:4, variant:1 })
    objs.push({ type:'building', tx:36,    ty:18,   h:4, variant:2 })
    objs.push({ type:'building', tx:4,     ty:20,   h:4, variant:0 })
    objs.push({ type:'bench', tx:s(4),  ty:s(8)  })
    objs.push({ type:'bench', tx:s(18), ty:s(8)  })
    objs.push({ type:'bench', tx:s(4),  ty:s(13) })
    objs.push({ type:'bench', tx:s(18), ty:s(13) })
    objs.push({ type:'bench', tx:36,    ty:22    })
    objs.push({ type:'bench', tx:8,     ty:28    })
    objs.push({ type:'fountain', tx:cx-2, ty:cy-2 })
    objs.push({ type:'fountain', tx:10,   ty:26   })
    for (let i=0;i<10;i++) objs.push({ type:'lamp', tx:4+i*4, ty:cy-1 })
    for (let i=0;i<10;i++) objs.push({ type:'lamp', tx:4+i*4, ty:cy+1 })
    for (let i=0;i<24;i++) objs.push({ type:'flower', tx:3+(i*71)%42, ty:3+(i*53)%28, variant:i%4 })
  }

  if (zone === 'Nature') {
    objs.push({ type:'pond', tx:s(2),  ty:s(2),  w:6, h:5 })
    objs.push({ type:'pond', tx:s(15), ty:s(10), w:7, h:5 })
    objs.push({ type:'pond', tx:28,    ty:4,     w:8, h:6 })
    objs.push({ type:'pond', tx:6,     ty:24,    w:7, h:5 })
    for (let i=0;i<20;i++) objs.push({ type:'rock', tx:2+(i*71)%44, ty:2+(i*53)%30, variant:i%2 })
    objs.push({ type:'dock', tx:s(3), ty:s(6) })
    objs.push({ type:'dock', tx:30,   ty:26   })
    for (let i=0;i<16;i++) objs.push({ type:'reed', tx:3+(i*31)%12, ty:2+(i*17)%8 })
  }

  if (zone === 'Urban') {
    objs.push({ type:'building', tx:s(2),  ty:s(1), h:5, variant:0 })
    objs.push({ type:'building', tx:s(7),  ty:s(2), h:4, variant:1 })
    objs.push({ type:'building', tx:s(15), ty:s(1), h:6, variant:2 })
    objs.push({ type:'building', tx:s(19), ty:s(2), h:4, variant:0 })
    objs.push({ type:'building', tx:30,    ty:18,   h:5, variant:1 })
    objs.push({ type:'building', tx:38,    ty:22,   h:4, variant:2 })
    for (let i=0;i<14;i++) objs.push({ type:'lamp', tx:4+i*3, ty:cy-1 })
    for (let i=0;i<14;i++) objs.push({ type:'lamp', tx:4+i*3, ty:cy+1 })
    objs.push({ type:'fountain', tx:cx-2,  ty:cy-2 })
    objs.push({ type:'fountain', tx:32,    ty:26   })
    objs.push({ type:'bench', tx:s(4),  ty:s(12) })
    objs.push({ type:'bench', tx:s(18), ty:s(12) })
    objs.push({ type:'bench', tx:36,    ty:28    })
  }

  if (zone === 'Music') {
    objs.push({ type:'stage', tx:s(8), ty:s(2) })
    objs.push({ type:'stage', tx:32,   ty:22   })
    objs.push({ type:'instrument', tx:s(3),  ty:s(8),  variant:0 })
    objs.push({ type:'instrument', tx:s(18), ty:s(8),  variant:1 })
    objs.push({ type:'instrument', tx:s(3),  ty:s(13), variant:2 })
    objs.push({ type:'instrument', tx:s(18), ty:s(13), variant:3 })
    objs.push({ type:'instrument', tx:36,    ty:20,    variant:0 })
    objs.push({ type:'instrument', tx:10,    ty:26,    variant:2 })
    for (let i=0;i<20;i++) objs.push({ type:'note', tx:2+(i*61)%44, ty:2+(i*43)%30 })
  }

  if (zone === 'Lab') {
    // "미지의 소리 마을" — 참고 사진(할로윈풍 코지 인테리어)처럼 소품을 흩뿌리는 대신
    // 실제 방처럼 벽에 등을 붙인 가구 세트 4개(미디어 코너/서재 코너/식탁 코너/창고 코너)를
    // 네 모서리에 배치하고, 그 위 벽엔 액자를 건다. 입구(맵 중앙 하단)는 비워둔다.
    const posterKeys = ['posterAlien','posterBat','posterGhost','posterSkeleton','posterDemon']
    let pk = 0
    const poster = (tx, ty) => objs.push({ type:'poster', tx, ty, sprite: LAB_DECOR[posterKeys[pk++ % posterKeys.length]] })

    // 미디어 코너 (TV + 러그) — 북서쪽
    poster(5, 1.3); poster(13, 1.3)
    objs.push({ type:'tv',  tx:8, ty:3 })
    objs.push({ type:'rug', tx:6, ty:7 })

    // 서재/수납 코너 (옷장 2개) — 북동쪽
    poster(34, 1.3); poster(43, 1.3)
    objs.push({ type:'wardrobe', tx:36, ty:3 })
    objs.push({ type:'wardrobe', tx:41, ty:3 })
    objs.push({ type:'rug',      tx:37, ty:8 })

    // 식탁 코너 (테이블 + 의자 2개) — 남서쪽
    poster(4, 33.3)
    objs.push({ type:'table', tx:6, ty:27 })
    objs.push({ type:'chair', tx:5, ty:31 })
    objs.push({ type:'chair', tx:9, ty:31 })
    objs.push({ type:'rug',   tx:6, ty:30 })

    // 창고 코너 (옷장 + 호박 더미) — 남동쪽
    poster(42, 33.3)
    objs.push({ type:'wardrobe', tx:38, ty:27 })
    objs.push({ type:'rug',      tx:39, ty:31 })

    // 입구 앞 마중 나온 호박, 천장 부근을 나는 박쥐 — 방 전체에 흩뿌리지 않고 소량만
    const pumpkinPos = [
      {tx:20,ty:31},{tx:29,ty:31},{tx:18,ty:17},{tx:29,ty:17},{tx:23,ty:22},{tx:26,ty:12},
    ]
    pumpkinPos.forEach(p => objs.push({ type:'pumpkin', ...p }))
    const batPos = [
      {tx:18,ty:4},{tx:30,ty:4},{tx:22,ty:9},{tx:14,ty:20},{tx:34,ty:20},{tx:24,ty:6},
    ]
    batPos.forEach(p => objs.push({ type:'bat_deco', ...p }))

    // 마법 크리스탈/별은 소품 정도로만 남겨서 "미지의" 느낌 유지
    const crystalPos = [{tx:22,ty:16},{tx:27,ty:23}]
    crystalPos.forEach((c,i) => objs.push({ type:'crystal', ...c, variant:i%5 }))
    for (let i=0;i<10;i++) objs.push({ type:'star', tx:5+(i*73)%38, ty:12+(i*53)%18 })
    objs.push({ type:'altar', tx:cx-2, ty:14 })
  }

  return objs
}

// 시트에서 srcX/srcY,w×h 영역만 잘라 그리는 범용 크롭 컴포넌트 (WorldMap의 SheetSprite와 동일 기법).
function LabSprite({ x, y, sprite, scale = 2 }) {
  const { src, sheetW, sheetH, x: srcX, y: srcY, w, h } = sprite
  return (
    <svg x={x} y={y} width={w * scale} height={h * scale}
      viewBox={`${srcX} ${srcY} ${w} ${h}`} style={{ overflow: 'hidden' }}>
      <image href={src} width={sheetW} height={sheetH} style={{ imageRendering: 'pixelated' }}/>
    </svg>
  )
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

  // "미지의 소리 마을"(Lab) 전용 — 코지 에셋의 할로윈풍 액자/장식으로 으스스한 분위기를 낸다.
  if (obj.type === 'poster') {
    const bobY = Math.sin(tick * 0.03 + obj.tx * 0.9) * 1.5
    return (
      <g transform={`translate(0, ${bobY})`}>
        <ellipse cx={x + T*0.5} cy={y + T*0.92} rx={T*0.42} ry={4} fill="#00000055"/>
        <LabSprite x={x} y={y} sprite={obj.sprite} scale={2.1}/>
      </g>
    )
  }
  if (obj.type === 'pumpkin') {
    const glow = 0.6 + Math.sin(tick * 0.06 + obj.tx) * 0.25
    return (
      <g>
        <ellipse cx={x + T*0.5} cy={y + T*0.9} rx={T*0.4} ry={5} fill="#00000044"/>
        <circle cx={x + T*0.5} cy={y + T*0.45} r={T*0.55} fill="#FF8A2A" opacity={glow * 0.35}/>
        <LabSprite x={x} y={y} sprite={LAB_DECOR.pumpkin} scale={1.7}/>
      </g>
    )
  }
  if (obj.type === 'bat_deco') {
    const fx = Math.sin(tick * 0.025 + obj.tx * 1.3) * 10
    const fy = Math.cos(tick * 0.02 + obj.ty * 1.1) * 6
    return (
      <g transform={`translate(${fx},${fy})`} opacity="0.9">
        <LabSprite x={x} y={y} sprite={LAB_DECOR.bat} scale={1.5}/>
      </g>
    )
  }
  // 방 가구 — 러그는 바닥에 깔리므로 그림자 없이, 나머지 가구는 발밑에 옅은 그림자를 깔아
  // "바닥 위에 놓여있다"는 입체감을 준다.
  if (obj.type === 'rug') {
    return <LabSprite x={x} y={y} sprite={LAB_DECOR.rug} scale={2.2}/>
  }
  if (obj.type === 'tv' || obj.type === 'wardrobe' || obj.type === 'table' || obj.type === 'chair') {
    const sprite = LAB_DECOR[obj.type]
    const scale = obj.type === 'chair' ? 1.8 : 2.2
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 2} rx={sprite.w*scale*0.4} ry={4} fill="#00000055"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }

  return null
}

/* ─────────────────────────────────────────────
   소리 아이템 — PNG 에셋 / SVG 보석상자 폴백
───────────────────────────────────────────── */
function SoundItem({ item, zone, tick, state = 'active' }) {
  const px = item.tx * TILE + TILE / 2
  const py = item.ty * TILE + TILE / 2
  const si    = SOUND_ITEMS[zone] || SOUND_ITEMS.Animal
  const items = ITEMS[zone] || []
  const imgSrc = items[item.index % items.length]

  // 잠긴(아직 구역 해제 안 된) 아이템 — 실제 아이콘을 옅게 보여줘 어디에
  // 분포되어 있는지는 알 수 있게 하되, 흐림 효과 자체는 구역 전체를 덮는
  // BlockCloud가 담당하고 여기서는 살짝 톤다운만 한다. 상호작용은 불가.
  if (state === 'locked') {
    const drift = Math.sin(tick * 0.02 + item.pulse) * 2
    return (
      <g transform={`translate(${px}, ${py + drift})`} opacity="0.55">
        {ASSET_READY.items && imgSrc ? (
          <>
            <rect x="-14" y="-14" width="28" height="28" rx="6"
              fill={si.itemBg} stroke={si.itemBorder} strokeWidth="1.5"/>
            <image href={imgSrc} x="-10" y="-10" width="20" height="20"
              style={{ imageRendering: 'pixelated', filter: 'grayscale(0.6)' }}/>
          </>
        ) : (
          <>
            <rect x="-12" y="-11" width="24" height="22" rx="5"
              fill={si.itemBg} stroke={si.itemBorder} strokeWidth="1.5"/>
            <rect x="-12" y="-11" width="24" height="9" rx="4"
              fill={`${si.itemBorder}44`} stroke={si.itemBorder} strokeWidth="1"/>
          </>
        )}
      </g>
    )
  }

  const done  = state === 'done'
  const bobY  = done ? 0 : Math.sin(tick * 0.06 + item.pulse) * 4
  const glow  = done ? 0.5 : Math.sin(tick * 0.08 + item.pulse) * 0.2 + 0.7

  // 제출 완료된 아이템은 게임 전체에서 쓰는 파라미지 금색/세피아 톤으로 표시
  const border = done ? '#C8A96E' : si.itemBorder
  const bg     = done ? '#F0E4C8' : si.itemBg

  return (
    <g transform={`translate(${px}, ${py + bobY})`} opacity={glow}>
      {/* 후광 */}
      <circle r="20" fill={border} opacity="0.12"/>
      {/* 파티클 (완료 전에만) */}
      {!done && [0,1,2].map(i => (
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
            fill={bg} stroke={border} strokeWidth="1.5"/>
          <image
            href={imgSrc}
            x="-10" y="-10" width="20" height="20"
            style={{ imageRendering: 'pixelated', filter: done ? 'grayscale(0.7)' : 'none' }}
          />
        </>
      ) : (
        <>
          {/* SVG 보석상자 폴백 */}
          <rect x="-12" y="-11" width="24" height="22" rx="5"
            fill={bg} stroke={border} strokeWidth="1.5"/>
          <rect x="-12" y="-11" width="24" height="9" rx="4"
            fill={`${border}44`} stroke={border} strokeWidth="1"/>
          <rect x="-4" y="-12" width="8" height="4" rx="2" fill={border}/>
          <circle cx="0" cy="4" r="3.5" fill={border} opacity="0.9"/>
          <circle cx="0" cy="4" r="1.8" fill={bg}/>
          <text textAnchor="middle" y="2" fontSize="9"
            fill={border}
            style={{ userSelect:'none', fontFamily:'Nunito,sans-serif', fontWeight:'bold' }}>
            {item.symbol}
          </text>
        </>
      )}
      {!done && <circle cx="-5" cy="-7" r="2" fill="white" opacity={0.3 + Math.sin(tick*0.12)*0.3}/>}
      {done && (
        <circle cx="9" cy="-9" r="7" fill="#7A9A6A" stroke="#F5EDD8" strokeWidth="1.2"/>
      )}
      {done && (
        <path d="M6 -9 L8.3 -6.7 L12.5 -11.5" stroke="#F5EDD8" strokeWidth="1.6"
          fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </g>
  )
}

/* ─────────────────────────────────────────────
   구역 구름 — 아직 잠긴 block의 아이템들이 모여 있는 영역 전체를
   덮는 뭉게구름. 그 밑의 아이템은 은은하게 비쳐 보이되 상호작용은 불가.
───────────────────────────────────────────── */
function seededRand(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function BlockCloud({ region, tick, seed = 1 }) {
  if (!region) return null
  const rand  = seededRand(seed * 97 + 13)
  // 반지름(r) + 중심 오프셋(ox,oy)의 합이 항상 구역 경계(1.0) 안쪽에 머물도록
  // 클램프해서, 옆 구역(특히 이미 열린 활성 구역)까지 구름이 번지지 않게 한다.
  const puffs = Array.from({ length: 5 }, () => {
    const r = 0.3 + rand() * 0.18
    const maxOffset = Math.max(0.85 - r, 0)
    return {
      ox: (rand() - 0.5) * 2 * maxOffset,
      oy: (rand() - 0.5) * 2 * maxOffset,
      r,
    }
  })
  const cx = region.cx * TILE, cy = region.cy * TILE
  const rx = region.rx * TILE, ry = region.ry * TILE

  return (
    <g style={{ filter: 'url(#cloudBlur)' }} opacity="0.6">
      {puffs.map((p, i) => {
        const dx = Math.sin(tick * 0.008 + seed + i) * TILE * 0.1
        const dy = Math.cos(tick * 0.006 + seed + i * 1.7) * TILE * 0.08
        return (
          <ellipse key={i}
            cx={cx + p.ox * rx + dx}
            cy={cy + p.oy * ry + dy}
            rx={Math.max(rx * p.r, TILE * 0.7)} ry={Math.max(ry * p.r, TILE * 0.7)}
            fill="#E8E4D6"
          />
        )
      })}
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
function ZoneHUD({ zone, collected, total, onExit, blockNum = 1, blockTotal = 1 }) {
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
          <div style={{ fontSize:'10px', color:'#8B6A3A' }}>
            구역 {blockNum}/{blockTotal}
          </div>
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
// zone + 소리 목록(=zone/그룹) 기준 안정적인 해시 — 같은 그룹의 모든 참여자, 그리고
// 같은 참여자가 재입장할 때도 항상 동일한 씨앗값을 받아 동일한 배치가 나오게 한다.
function hashSeed(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

function spawnSoundItems(sounds, zone) {
  const si = SOUND_ITEMS[zone] || SOUND_ITEMS.Animal
  const entranceTx = Math.floor(MAP_W / 2), entranceTy = MAP_H - 1
  const rand = seededRand(hashSeed(zone + '|' + sounds.map(s => s.sound_id).sort().join(',')))

  // block 개수(n)에 딱 맞춰 계산된 격자(buildPaths()가 그리는 길과 동일한 좌표)로
  // 셀을 나눈다. block마다 셀을 하나씩 통째로 배정하면, 서로 다른 block의 영역은
  // 항상 길 하나만큼 떨어져 있고 절대 겹치지 않는다.
  const { byBlock, blockNums, cols, rows, colBounds, rowBounds } = computeBlockGrid(sounds)

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = colBounds[c], x1 = colBounds[c + 1]
      const y0 = rowBounds[r], y1 = rowBounds[r + 1]
      cells.push({ x0, x1, y0, y1, tx: (x0 + x1) / 2, ty: (y0 + y1) / 2, tiles: [] })
    }
  }
  const cellAt = (tx, ty) => {
    let c = 0, r = 0
    for (let i = 1; i < cols; i++) if (tx >= colBounds[i]) c = i
    for (let i = 1; i < rows; i++) if (ty >= rowBounds[i]) r = i
    return cells[r * cols + c]
  }

  // 길(경계선) 좌우/상하 PATH_BUFFER칸은 아이템 배치 금지 — 구역 사이에
  // 실제 여백을 만들어서 열린 구역과 잠긴 구역이 바싹 붙어 보이지 않게 한다.
  const innerColLines = colBounds.slice(1, -1)
  const innerRowLines = rowBounds.slice(1, -1)
  const nearGridLine = (v, lines) => lines.some(l => Math.abs(v - l) <= PATH_BUFFER)
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (nearGridLine(tx, innerColLines) || nearGridLine(ty, innerRowLines)) continue
      cellAt(tx, ty).tiles.push({ tx, ty })
    }
  }

  // 입구에서 가까운 셀부터 낮은 block을 받아 "안개가 입구에서부터 걷힌다"는
  // 느낌을 유지한다. (셀 개수는 항상 block 수 이상으로 계산되므로 공유는 일어나지 않는다.)
  const orderedCells = [...cells].sort((a, b) => {
    const da = (a.tx - entranceTx) ** 2 + (a.ty - entranceTy) ** 2
    const db = (b.tx - entranceTx) ** 2 + (b.ty - entranceTy) ** 2
    return da - db
  })
  const cellByBlock = new Map()
  blockNums.forEach((b, bi) => cellByBlock.set(b, orderedCells[Math.min(bi, orderedCells.length - 1)]))

  const items   = []
  const regions = {}

  blockNums.forEach(b => {
    const blockSounds = byBlock.get(b)
    const cell         = cellByBlock.get(b)

    // 자기 셀 타일 안에서만 무작위로 골라, 다닥다닥 붙지 않고 성기게 퍼지도록 한다
    const pool = [...cell.tiles]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const chosen = pool.slice(0, blockSounds.length)

    blockSounds.forEach((s, i) => {
      const pos = chosen.length ? chosen[i % chosen.length] : { tx: cell.tx, ty: cell.ty }
      items.push({
        id:        s.sound_id,
        sound:     s,
        tx:        pos.tx,
        ty:        pos.ty,
        index:     items.length,
        symbol:    si.symbols[items.length % si.symbols.length],
        collected: false,
        pulse:     rand() * Math.PI * 2,
      })
    })

    // 구름 영역은 셀 자체의 고정된 중심/크기를 그대로 쓴다(아이템 위치의 bounding box가
    // 아님) — 그래야 구름이 절대 자기 셀 경계를 넘어 옆 구역(길 건너)까지 번지지 않는다.
    regions[b] = {
      cx: cell.tx,
      cy: cell.ty,
      rx: Math.max((cell.x1 - cell.x0) / 2 - 1, 2),
      ry: Math.max((cell.y1 - cell.y0) / 2 - 1, 2),
    }
  })

  return { items, regions }
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
   입구 확인 모달 — 캐릭터가 입구에 들어서면 표시
───────────────────────────────────────────── */
function ExitConfirmModal({ zone, onConfirm, onCancel }) {
  const meta = ZONE_META[zone]
  return (
    <div style={{
      position:'absolute', inset:0,
      background:'#00000066', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:60,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#F5EDD8', border:`3px solid ${meta.color}`,
        borderRadius:'20px', padding:'28px 36px',
        textAlign:'center', fontFamily:'Nunito, sans-serif',
        animation:'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow:`0 8px 40px ${meta.color}44`,
      }}>
        <div style={{ fontSize:'36px', marginBottom:'10px' }}>🚪</div>
        <div style={{ fontSize:'16px', fontWeight:800, color:'#3A2A14', marginBottom:'20px' }}>
          월드맵으로 돌아갈까요?
        </div>
        <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
          <button onClick={onCancel} style={{
            padding:'10px 22px', borderRadius:'12px',
            background:'transparent', border:'2px solid #C8A96E',
            color:'#8B6A3A', fontSize:'13px', fontWeight:700,
            fontFamily:'Nunito, sans-serif', cursor:'pointer',
          }}>
            더 둘러볼래요
          </button>
          <button onClick={onConfirm} style={{
            padding:'10px 22px', borderRadius:'12px',
            background:meta.color, border:'none',
            color:'#fff', fontSize:'13px', fontWeight:700,
            fontFamily:'Nunito, sans-serif', cursor:'pointer',
            boxShadow:`0 4px 16px ${meta.color}66`,
          }}>
            네, 나갈게요
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ZoneMap 메인
───────────────────────────────────────────── */
export default function ZoneMap({ zone, sounds, onCollectSound, onExit, collectedIds = new Set(), isAnnotating = false, blockNum = 1, blockTotal = 1 }) {
  const meta   = ZONE_META[zone]
  const theme  = ZONE_THEME[zone]
  const { keys, press, release } = useKeys()

  // 오브젝트 (한 번만 생성)
  const zoneObjects = useRef(buildZoneObjects(zone))
  const pathTiles   = useRef(buildPaths(sounds))

  const [pos,        setPos]       = useState({ x: PX_W/2 - CHAR_W/2, y: PX_H - TILE*4 })
  const [dir,        setDir]       = useState('up')
  const [moving,     setMoving]    = useState(false)
  const [tick,       setTick]      = useState(0)

  // 아이템은 초기화 후 위치가 변하지 않으므로 ref로 관리
  // 가시성은 부모의 collectedIds(제출 완료 후 갱신)로만 결정
  const itemsRef     = useRef(null)
  if (itemsRef.current === null) itemsRef.current = spawnSoundItems(sounds, zone)
  const zoneRegions = itemsRef.current.regions

  const [collecting, setCollecting]= useState(null)
  // 현재 수집 진행 중(annotation 열려 있는 동안) 새 충돌 차단
  const collectingRef     = useRef(false)
  // 발견된 아이템 ref (RAF 루프에서 접근용)
  const collectingItemRef = useRef(null)
  // isAnnotating prop을 RAF 루프에서 읽기 위한 ref
  const isAnnotatingRef   = useRef(isAnnotating)

  // 입구 확인 팝업 — 캐릭터가 입구 타일에 들어서면 표시
  const [exitConfirm, setExitConfirm] = useState(false)
  // 입구 영역에 이미 들어와 있는지(연속 프레임에서 팝업 재발생 방지용)
  const inExitZoneRef = useRef(false)

  const posRef = useRef(pos)
  const rafRef = useRef(null)
  // blockNum을 RAF 루프에서 읽기 위한 ref (잠긴 아이템과의 충돌 무시용)
  const blockNumRef = useRef(blockNum)

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])

  // ESC + Enter
  useEffect(() => {
    const h = e => {
      // 전사 패널이 열려 있는 동안 ESC는 AnnotationPanel이 자체 처리 (마을 밖으로 나가지 않음)
      if (e.key === 'Escape') { if (!isAnnotatingRef.current) onExit(); return }
      if (e.key === 'Enter' && collectingItemRef.current && !isAnnotatingRef.current) {
        const item = collectingItemRef.current
        collectingItemRef.current = null
        setCollecting(null)
        onCollectSound(item.sound)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit, onCollectSound])

  // annotation 패널이 닫히면(제출 or 스킵) 충돌 잠금 해제
  useEffect(() => {
    if (!isAnnotating) {
      collectingRef.current = false
      collectingItemRef.current = null
    }
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

        // 발견 상태인데 annotation 없이 멀어진 경우 → 발견 해제
        if (collectingRef.current && collectingItemRef.current && !isAnnotatingRef.current) {
          const fi = collectingItemRef.current
          const fix = fi.tx * TILE + TILE / 2 - 12
          const fiy = fi.ty * TILE + TILE / 2 - 12
          if (!overlaps(x, y, CHAR_W, CHAR_H, fix, fiy, 24, 24)) {
            collectingRef.current = false
            collectingItemRef.current = null
            setCollecting(null)
          }
        }

        // 새 아이템 충돌 — annotation 열려 있으면 완전 차단
        if (!collectingRef.current) {
          for (const item of itemsRef.current.items) {
            if (collectedIds.has(item.id)) continue
            if ((item.sound.block || 1) > blockNumRef.current) continue
            const ix = item.tx * TILE + TILE / 2 - 12
            const iy = item.ty * TILE + TILE / 2 - 12
            if (overlaps(x, y, CHAR_W, CHAR_H, ix, iy, 24, 24)) {
              collectingRef.current = true
              collectingItemRef.current = item
              setCollecting(item)
              break
            }
          }
        }
      } else {
        setMoving(false)
        // 정지 상태에서도 충돌 감지 (방향 전환 직후 첫 프레임 등)
        if (!collectingRef.current && !isAnnotatingRef.current) {
          const { x: sx, y: sy } = posRef.current
          for (const item of itemsRef.current.items) {
            if (collectedIds.has(item.id)) continue
            if ((item.sound.block || 1) > blockNumRef.current) continue
            const ix = item.tx * TILE + TILE / 2 - 12
            const iy = item.ty * TILE + TILE / 2 - 12
            if (overlaps(sx, sy, CHAR_W, CHAR_H, ix, iy, 24, 24)) {
              collectingRef.current = true
              collectingItemRef.current = item
              setCollecting(item)
              break
            }
          }
        }
      }

      // 입구 충돌 — 캐릭터가 화면 하단 중앙 입구 타일에 들어서면 확인 팝업 표시
      if (!isAnnotatingRef.current) {
        const { x: ex, y: ey } = posRef.current
        const atEntranceRow = ey >= maxY - 2
        const entranceCx    = ex + CHAR_W / 2
        const inEntranceX   = entranceCx >= PX_W / 2 - 40 && entranceCx <= PX_W / 2 + 40
        const inExitZone    = atEntranceRow && inEntranceX

        if (inExitZone && !inExitZoneRef.current) {
          inExitZoneRef.current = true
          setExitConfirm(true)
        } else if (!inExitZone) {
          inExitZoneRef.current = false
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, collectedIds])

  const remaining = itemsRef.current.items.filter(it => !collectedIds.has(it.id)).length
  const total     = itemsRef.current.items.length
  const collected = total - remaining

  // 카메라: 플레이어 중심, 맵 경계에서 클램프
  const camX = Math.max(0, Math.min(pos.x + CHAR_W / 2 - VIEW_W / 2, PX_W - VIEW_W))
  const camY = Math.max(0, Math.min(pos.y + CHAR_H / 2 - VIEW_H / 2, PX_H - VIEW_H))

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', userSelect:'none' }}>

      {/* Zone HUD */}
      <ZoneHUD zone={zone} collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal}/>

      {/* 게임 캔버스 */}
      <div style={{
        position:'absolute', top:`${HUD_H}px`, left:0, right:0, bottom:0,
        background: theme.border, overflow:'hidden', cursor:'none',
      }}>
        <svg
          width="100%" height="100%"
          viewBox={`${camX} ${camY} ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display:'block', position:'absolute', inset:0 }}
        >
          <defs>
            <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={TILE * 0.22}/>
            </filter>
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

          {/* 경계 울타리 — Lab은 "방 안" 느낌을 내려고 얇은 선 대신 두꺼운 벽돌 벽 띠를 두른다 */}
          {zone === 'Lab' ? (
            <>
              <rect x="0" y="0" width={PX_W} height={TILE*2} fill={theme.border}/>
              {/* 남쪽 벽은 입구(맵 중앙 하단) 자리를 문처럼 뚫어둔다 */}
              <rect x="0" y={PX_H-TILE*2} width={PX_W/2-TILE*3} height={TILE*2} fill={theme.border}/>
              <rect x={PX_W/2+TILE*3} y={PX_H-TILE*2} width={PX_W/2-TILE*3} height={TILE*2} fill={theme.border}/>
              <rect x="0" y="0" width={TILE*2} height={PX_H} fill={theme.border}/>
              <rect x={PX_W-TILE*2} y="0" width={TILE*2} height={PX_H} fill={theme.border}/>
              <rect x={TILE*2} y={TILE*2} width={PX_W-TILE*4} height={PX_H-TILE*4}
                fill="none" stroke="#00000055" strokeWidth="3"/>
            </>
          ) : (
            <>
              <rect x="0" y="0" width={PX_W} height={PX_H}
                fill="none" stroke={theme.border} strokeWidth="6"/>
              <rect x="3" y="3" width={PX_W-6} height={PX_H-6}
                fill="none" stroke={`${meta.color}44`} strokeWidth="2" strokeDasharray="8 4"/>
            </>
          )}

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

          {/* 소리 아이템 — zone 전체가 한 화면에 있고, 잠긴 구역은 안개(회색 점)로,
              해제된 구역은 아이콘으로, 완료된 것은 톤다운된 채로 계속 보임 */}
          {itemsRef.current.items.map(item => {
            const state = collectedIds.has(item.id)
              ? 'done'
              : (item.sound.block || 1) <= blockNum ? 'active' : 'locked'
            return <SoundItem key={item.id} item={item} zone={zone} tick={tick} state={state}/>
          })}

          {/* 아직 열리지 않은 구역을 통째로 덮는 구름 — 그 안의 아이템이
              어디에 분포되어 있는지는 은은하게 비쳐 보이되 상호작용은 불가 */}
          {Object.entries(zoneRegions).map(([b, region]) => {
            const bn = Number(b)
            if (bn <= blockNum) return null
            return <BlockCloud key={b} region={region} tick={tick} seed={bn}/>
          })}

          {/* 캐릭터 */}
          <foreignObject x={pos.x} y={pos.y} width={CHAR_W} height={CHAR_H} style={{ overflow:'visible' }}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width:CHAR_W, height:CHAR_H }}>
              <PixelChar dir={dir} moving={moving}/>
            </div>
          </foreignObject>

          {/* 발견 이펙트 */}
          {collecting && (
            <g transform={`translate(${pos.x + CHAR_W/2}, ${pos.y - 20})`}>
              <rect x="-30" y="-22" width="60" height="30" rx="6" fill="#F5EDD8" stroke="#C8A96E" strokeWidth="1.5"/>
              <text textAnchor="middle" y="-7" fontSize="11"
                fill="#3A2A14" fontFamily="Nunito,sans-serif" fontWeight="700">
                {collecting.symbol} 발견!
              </text>
              <text textAnchor="middle" y="5" fontSize="8"
                fill="#8B6432" fontFamily="Nunito,sans-serif">
                Enter ↵ 로 전사하기
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
      <DPad press={press} release={release} onExit={onExit}
        onConfirm={collecting ? () => {
          const item = collectingItemRef.current
          if (!item) return
          collectingItemRef.current = null
          setCollecting(null)
          onCollectSound(item.sound)
        } : null}
      />

      {/* 완료 모달 */}
      {remaining === 0 && total > 0 && (
        <CompleteModal zone={zone} onExit={onExit}/>
      )}

      {/* 입구 확인 모달 */}
      {exitConfirm && (
        <ExitConfirmModal
          zone={zone}
          onConfirm={onExit}
          onCancel={() => setExitConfirm(false)}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   D-Pad
───────────────────────────────────────────── */
function DPad({ press, release, onExit, onConfirm }) {
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
      {onConfirm && (
        <div style={{ ...s, gridArea:'1/3', background:'#C8A96E', color:'#fff', fontSize:'18px', border:'2px solid #8B6432' }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onConfirm() }}
        >✓</div>
      )}
    </div>
  )
}