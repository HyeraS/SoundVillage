'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ASSET_READY, WORLD_TILESET, WORLD_BUILDINGS, WORLD_CHARACTER } from '@/components/AssetRegistry'
import { autotileShape } from '@/lib/autotile'

/* ─────────────────────────────────────────────
   맵 크기 — 이전 60×45 레이아웃 대비 사용자 요청으로 2배 확장.
   아래 PORTALS/PATH_TILES/WATER_TILES는 전부 그 60×45 좌표에 *2를 곱한 값
   (구조는 동일, 타일 격자 자체가 두 배 넓어짐).
───────────────────────────────────────────── */
const S      = 2
const MAP_W  = 60 * S
const MAP_H  = 45 * S
const PX_W   = MAP_W * TILE
const PX_H   = MAP_H * TILE
const CHAR_W = 72
const CHAR_H = 88
const HUD_H  = 56

// 카메라 뷰포트 — 맵이 2배로 넓어진 만큼, 화면엔 항상 전체 맵을 다 보여주는 대신
// 캐릭터를 따라다니는 창(예전 60×45 맵의 절반 크기)만 보여준다. 그러면 같은 화면에
// 건물·나무가 실제로 2배 크게 보이면서("맵 크기를 2배 키워달라"는 요청), 넓어진 맵을
// 돌아다니며 탐험하는 맛도 살아난다.
const VIEW_TW = 30
const VIEW_TH = 22
const VIEW_W  = VIEW_TW * TILE
const VIEW_H  = VIEW_TH * TILE

/* ─────────────────────────────────────────────
   Sound Museum — 맵 중앙. 카메라 뷰(30×22타일)에 꽉 차지 않도록 건물 자체 크기는
   예전 15×12 대비 소폭만 키운다 — 맵이 넓어진 몫은 "포털까지 거리"로 표현한다.
───────────────────────────────────────────── */
const MUSEUM = { tx: 50, ty: 38, w: 20, h: 15 }
const MUSEUM_CENTER = { x: MUSEUM.tx + MUSEUM.w/2, y: MUSEUM.ty + MUSEUM.h/2 }

/* ─────────────────────────────────────────────
   Zone 포털 — Museum 중심 정육각형 배치.
   맵 확장(2배) 몫은 중심에서의 "거리"에만 곱해서 포털은 예전보다 훨씬 멀리 떨어뜨리고,
   포털 크기는 살짝만(×1.3) 키운다 — 그래야 카메라 창 안에서 건물이 화면을 뒤덮지 않는다.
───────────────────────────────────────────── */
const OLD_CENTER = { x: 30, y: 22.5 }
const NEW_CENTER = { x: 60, y: 45 }
const DIST_SCALE  = 2
const SIZE_SCALE  = 1.3
function placePortal(zone, oldTx, oldTy, oldW, oldH) {
  const oldCx = oldTx + oldW/2, oldCy = oldTy + oldH/2
  const cx = NEW_CENTER.x + (oldCx - OLD_CENTER.x) * DIST_SCALE
  const cy = NEW_CENTER.y + (oldCy - OLD_CENTER.y) * DIST_SCALE
  const w = Math.round(oldW * SIZE_SCALE), h = Math.round(oldH * SIZE_SCALE)
  return { zone, tx: Math.round(cx - w/2), ty: Math.round(cy - h/2), w, h }
}
const PORTALS = [
  placePortal('Animal', 33, 5,  9, 9),  // top-right  (60°)
  placePortal('Lab',    18, 5,  9, 9),  // top-left  (120°)
  placePortal('Urban',  42, 18, 8, 9),  // right       (0°)
  placePortal('Nature', 9,  18, 8, 9),  // left       (180°)
  placePortal('Music',  33, 32, 9, 9),  // bottom-right (300°)
  placePortal('Human',  18, 32, 9, 9),  // bottom-left (240°)
]
const portalByZone = Object.fromEntries(PORTALS.map(p => [p.zone, p]))

/* ─────────────────────────────────────────────
   경로 타일 — Museum 중심에서 각 포털까지 L자(수평+수직)로 잇는다.
   폭은 고정 SPOKE_W 타일이라 맵이 넓어져도 광장/길이 화면을 뒤덮지 않고, 길이만 늘어난다.
───────────────────────────────────────────── */
function band(tx0, tx1, ty0, ty1, plaza = false) {
  const out = []
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++)
      out.push({ tx, ty, plaza })
  return out
}
const SPOKE_W = 6
function spoke(x0, y0, x1, y1, width = SPOKE_W) {
  const w2 = Math.floor(width / 2)
  const out = []
  out.push(...band(Math.min(x0,x1), Math.max(x0,x1), y0 - w2, y0 + w2))
  out.push(...band(x1 - w2, x1 + w2, Math.min(y0,y1), Math.max(y0,y1)))
  return out
}

const PATH_TILES = [
  // Museum 앞마당 (건물 발치를 감싸는 자갈 광장)
  ...band(MUSEUM.tx - 2, MUSEUM.tx + MUSEUM.w + 1, MUSEUM.ty - 2, MUSEUM.ty + MUSEUM.h + 1, true),
  ...PORTALS.flatMap(p => spoke(
    Math.round(MUSEUM_CENTER.x), Math.round(MUSEUM_CENTER.y),
    Math.round(p.tx + p.w/2),    Math.round(p.ty + p.h/2),
  )),
]

const PATH_SET = new Set(PATH_TILES.map(p => `${p.tx},${p.ty}`))

// Nature 포털 옆 작은 연못 — 시트의 물 오토타일을 실제로 써먹기 위한 포인트
const NATURE_P = portalByZone.Nature
const WATER_TILES = band(NATURE_P.tx - 10, NATURE_P.tx - 5, NATURE_P.ty + 3, NATURE_P.ty + 6)
const WATER_SET = new Set(WATER_TILES.map(w => `${w.tx},${w.ty}`))

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

// 길/물/포털/박물관과 안 겹치는 타일인지 — 모든 장식물 배치가 공통으로 쓰는 필터
function isFree(tx, ty) {
  const k = `${tx},${ty}`
  return !PATH_SET.has(k) && !WATER_SET.has(k) && !PORTAL_SET.has(k) && !MUSEUM_SET.has(k)
}

// 지형 조회 — GroundLayer(오토타일 렌더링)와 스폰 로직이 공유
function terrainAt(tx, ty) {
  const k = `${tx},${ty}`
  if (WATER_SET.has(k)) return 'water'
  if (PATH_SET.has(k))  return 'dirt'
  return 'grass'
}

/* ─────────────────────────────────────────────
   존별 테마 장식 — 전체 맵에 고르게 뿌리는 대신, 포털 주변 반경에만
   그 존 분위기에 맞는 소품을 모아서 배치한다.
───────────────────────────────────────────── */
function scatterNear(zone, count, radius, mulA, mulB, seed = 0) {
  const p = portalByZone[zone]
  const cx = p.tx + p.w / 2, cy = p.ty + p.h / 2
  return Array.from({ length: count }, (_, i) => ({
    tx: Math.round(cx + (((i * mulA + seed) % (radius * 2)) - radius)),
    ty: Math.round(cy + (((i * mulB + seed) % (radius * 2)) - radius)),
  })).filter(t => t.tx >= 2 && t.tx < MAP_W - 2 && t.ty >= 2 && t.ty < MAP_H - 2 && isFree(t.tx, t.ty))
}

// 테두리 나무 — 맵 크기에 비례해서 자동으로 개수가 늘어나도록 공식화 (존 무관, 액자 역할)
const borderTreeCount = Math.floor((MAP_W - 4) / 2)
const sideTreeCount    = Math.floor((MAP_H - 6) / 2)
const BORDER_TREES = [
  ...Array.from({length: borderTreeCount}, (_,i) => ({ tx: 1+i*2, ty: 1,        variant: i%3 })),
  ...Array.from({length: borderTreeCount}, (_,i) => ({ tx: 1+i*2, ty: MAP_H-2,  variant: (i+1)%3 })),
  ...Array.from({length: sideTreeCount},   (_,i) => ({ tx: 1,       ty: 3+i*2,  variant: i%2 })),
  ...Array.from({length: sideTreeCount},   (_,i) => ({ tx: MAP_W-2, ty: 3+i*2,  variant: (i+1)%2 })),
].filter(t => isFree(t.tx, t.ty))

// Animal: 나무·수풀 빽빽하게 / Nature: 나무 + 연못가 돌 / Urban: 울타리·벤치 위주, 나무 적게
// Human: 울타리·벤치 + 꽃 / Music·Lab: 이 팩엔 테마 소품이 없어 나무·꽃만 은은하게
// 맵이 2배로 넓어진 만큼 포털 반경(radius)도 2배, 개수도 밀도 유지를 위해 넉넉히 늘렸다.
const TREES = [
  ...BORDER_TREES,
  ...scatterNear('Animal', 30, 14, 5, 7, 3).map((t,i) => ({ ...t, variant: i % 3 })),
  ...scatterNear('Nature', 18, 12, 7, 5, 11).map((t,i) => ({ ...t, variant: i % 3 })),
  ...scatterNear('Music',  10, 12, 9, 4, 17).map((t,i) => ({ ...t, variant: i % 3 })),
  ...scatterNear('Lab',    10, 12, 4, 9, 19).map((t,i) => ({ ...t, variant: i % 3 })),
  ...scatterNear('Human',  8,  11, 15, 6, 71).map((t,i) => ({ ...t, variant: i % 3 })),
  ...scatterNear('Urban',  6,  11, 6, 15, 73).map((t,i) => ({ ...t, variant: i % 3 })),
]
const BUSHES = [
  ...scatterNear('Animal', 18, 10, 3, 8, 23),
  ...scatterNear('Nature', 12, 10, 8, 3, 29),
  ...scatterNear('Human',  6,  9,  5, 12, 79),
]
const FLOWERS = [
  ...scatterNear('Human', 22, 12, 6, 11, 31),
  ...scatterNear('Music', 22, 12, 11, 6, 37),
  ...scatterNear('Animal', 14, 10, 13, 7, 41),
  ...scatterNear('Nature', 10, 10, 9, 13, 83),
].map((f,i) => ({ ...f, type: i % 4 }))
const ROCKS = [
  ...scatterNear('Nature', 18, 12, 17, 9, 43),
  ...scatterNear('Lab',    14, 12, 9, 17, 47),
]
const BENCHES = [
  ...scatterNear('Urban', 8, 10, 5, 9, 53),
  ...scatterNear('Human', 8, 10, 9, 5, 59),
]
const FENCES = [
  ...scatterNear('Urban', 22, 12, 7, 13, 61),
  ...scatterNear('Human', 14, 12, 13, 7, 67),
]

/* ─────────────────────────────────────────────
   잔디 색상 얼룩 — 구매한 시트의 "잔디" 조각은 전부 독립된 섬(hedge autotile) 형태라
   그대로 반복 타일링하면 각 타일 모서리의 둥근 여백이 그대로 격자무늬로 드러난다
   (사용자가 "흙 같다"고 지적한 원인). 그 대신 단색 바탕 위에 부드럽게 번지는 색 얼룩을
   낮은 투명도로 낮은 빈도로 깔아서, 사진 속 초원처럼 밝고 어두운 풀색이 자연스럽게
   이어지는 느낌만 낸다 — 픽셀아트 톤을 해치지 않도록 블러 강도는 약하게 유지.
───────────────────────────────────────────── */
function seedRand(i) {
  const a = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return a - Math.floor(a)
}
const GRASS_BASE = '#7FA24A'
const GRASS_BLOTCH_COLORS = ['#93B85E', '#6C8F3D']
const GRASS_BLOTCHES = Array.from({ length: Math.round((MAP_W * MAP_H) / 70) }, (_, i) => ({
  cx: seedRand(i * 4 + 1) * PX_W,
  cy: seedRand(i * 4 + 2) * PX_H,
  r:  60 + seedRand(i * 4 + 3) * 110,
  color: GRASS_BLOTCH_COLORS[i % 2],
  opacity: 0.22 + seedRand(i * 4 + 4) * 0.14,
}))

function GrassBlotches() {
  return (
    <g style={{ filter: 'url(#grassBlur)' }}>
      {GRASS_BLOTCHES.map((b, i) => (
        <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.r} ry={b.r * 0.72}
          fill={b.color} opacity={b.opacity}/>
      ))}
    </g>
  )
}

/* ─────────────────────────────────────────────
   헬퍼
───────────────────────────────────────────── */
// 시트(WORLD_TILESET)에서 임의의 srcX/srcY,w×h 영역만 잘라 (x,y)에 그리는 범용 크롭 컴포넌트.
// 중첩 <svg>의 viewBox가 그 자체로 클리핑 뷰포트 역할을 해서 별도 clipPath 없이 잘림.
// rotate를 주면 크롭 영역의 중심을 기준으로 소스 이미지를 회전시켜서(오토타일 회전 재사용) 그린다.
// autotileShape의 rotate(0=S,90=W,180=N,270=E 경계)에 맞춰 그 변에 짧고 부드러운
// 하이라이트 선을 그린다 — 시트 자체의 톱니 경계 위에 겹쳐서 전환을 더 또렷하게 보이게 함.
function EdgeGlow({ tx, ty, rotate, color }) {
  const x0 = tx * TILE, y0 = ty * TILE
  const lines = {
    0:   [x0, y0 + TILE, x0 + TILE, y0 + TILE], // S
    90:  [x0, y0, x0, y0 + TILE],                // W
    180: [x0, y0, x0 + TILE, y0],                // N
    270: [x0 + TILE, y0, x0 + TILE, y0 + TILE],  // E
  }
  const [x1, y1, x2, y2] = lines[rotate] || lines[0]
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.8"/>
  )
}

// srcX/srcY/w/h는 시트 안 크롭 영역(소스 좌표계), renderW/renderH를 따로 주면 그 크기로
// 확대·축소해서 그린다(기본은 크롭 크기 그대로). rotate는 크롭 중심을 기준으로 회전.
function SheetSprite({ x, y, srcX, srcY, w = TILE, h = TILE, renderW, renderH, rotate = 0, sheet = WORLD_TILESET }) {
  const { src, sheetW, sheetH } = sheet
  const cx = srcX + w / 2, cy = srcY + h / 2
  return (
    <svg x={x} y={y} width={renderW ?? w} height={renderH ?? h}
      viewBox={`${srcX} ${srcY} ${w} ${h}`} style={{ overflow: 'hidden' }}>
      <g transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}>
        <image href={src} width={sheetW} height={sheetH} style={{ imageRendering: 'pixelated' }}/>
      </g>
    </svg>
  )
}

// 포털 섬 안에 실제 건물 스프라이트를 비율 유지한 채 최대한 크게, 가운데 정렬해서 그림
function BuildingSprite({ zone, px, py, pw, ph }) {
  const b = WORLD_BUILDINGS[zone]
  if (!b) return null
  const scale = Math.min(pw / b.w, ph / b.h) * 0.92
  const w = b.w * scale, h = b.h * scale
  const x = px + (pw - w) / 2, y = py + (ph - h) / 2 + ph * 0.03
  return <SheetSprite x={x} y={y} srcX={b.x} srcY={b.y} w={b.w} h={b.h}
    renderW={w} renderH={h} sheet={b}/>
}

const TREE_SRCS = [OBJECTS.tree_01, OBJECTS.tree_02, OBJECTS.tree_03]
const WORLD_TREE_SRCS = [WORLD_TILESET.decor.tree1, WORLD_TILESET.decor.tree2, WORLD_TILESET.decor.pine]
const TREE_COLORS = [
  { trunk: '#7A5230', canopy: '#2D7A2D', shadow: '#1F5C1F' },
  { trunk: '#8B5E3C', canopy: '#3A8C2F', shadow: '#2A6B22' },
  { trunk: '#6B4423', canopy: '#4A9E38', shadow: '#336E27' },
]

function PixelTree({ x, y, variant = 0 }) {
  if (ASSET_READY.world) {
    const s = WORLD_TREE_SRCS[variant % 3]
    return <SheetSprite x={x} y={y - TILE * 0.5} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
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

const FLOWER_SRCS = [OBJECTS.flower_yellow, OBJECTS.flower_pink, OBJECTS.flower_blue, OBJECTS.flower_white]
const FLOWER_COLORS = [
  ['#F4D03F','#F39C12'], ['#E8A0C0','#D4608A'],
  ['#A8D8EA','#6DB5D4'], ['#F0F0AA','#D4D444'],
]
const WORLD_FLOWER_SRCS = [WORLD_TILESET.decor.flower1, WORLD_TILESET.decor.flower2, WORLD_TILESET.decor.flower3]
function PixelFlower({ x, y, type }) {
  if (ASSET_READY.world) {
    const s = WORLD_FLOWER_SRCS[type % 3]
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
  if (ASSET_READY.objects) {
    return (
      <image href={FLOWER_SRCS[type % 4]} x={x} y={y} width={TILE} height={TILE}
        style={{ imageRendering: 'pixelated' }}/>
    )
  }
  const [p, c] = FLOWER_COLORS[type % 4]
  return (
    <g transform={`translate(${x+6},${y+10})`}>
      <rect x="6" y="5" width="2" height="8" rx="1" fill="#4A8C3A"/>
      <circle cx="7" cy="4" r="4" fill={p}/>
      <circle cx="7" cy="4" r="2" fill={c}/>
    </g>
  )
}

function PixelBush({ x, y, variant = 0 }) {
  const s = variant % 2 === 0 ? WORLD_TILESET.decor.bush1 : WORLD_TILESET.decor.bush2
  if (ASSET_READY.world) {
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
  const c = TREE_COLORS[variant % 3]
  return (
    <g transform={`translate(${x+3},${y+8})`}>
      <ellipse cx="13" cy="20" rx="12" ry="3" fill="#00000022"/>
      <circle cx="13" cy="12" r="11" fill={c.canopy}/>
      <circle cx="7" cy="15" r="7" fill={c.shadow} opacity="0.6"/>
    </g>
  )
}

function PixelRock({ x, y }) {
  if (ASSET_READY.world) {
    const s = WORLD_TILESET.decor.rock
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
  if (ASSET_READY.objects) {
    return (
      <image href={OBJECTS.rock} x={x} y={y} width={TILE} height={TILE}
        style={{ imageRendering: 'pixelated' }}/>
    )
  }
  return (
    <g transform={`translate(${x+4},${y+10})`}>
      <ellipse cx="12" cy="18" rx="11" ry="3" fill="#00000022"/>
      <path d="M2,16 Q1,8 9,6 Q17,3 22,10 Q24,16 18,18 Q10,20 2,16Z" fill="#9A948A"/>
      <path d="M4,15 Q5,9 11,7 Q16,5 20,10" fill="none" stroke="#B4AEA0" strokeWidth="1.5" opacity="0.7"/>
      <path d="M6,17 Q12,19 18,16" fill="none" stroke="#6E6860" strokeWidth="1.5" opacity="0.6"/>
    </g>
  )
}

function PixelBench({ x, y }) {
  if (ASSET_READY.world) {
    const s = WORLD_TILESET.decor.bench1
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
  if (ASSET_READY.objects) {
    return (
      <image href={OBJECTS.bench} x={x} y={y} width={TILE} height={TILE}
        style={{ imageRendering: 'pixelated' }}/>
    )
  }
  return (
    <g transform={`translate(${x+2},${y+10})`}>
      <ellipse cx="14" cy="19" rx="13" ry="3" fill="#00000022"/>
      <rect x="1"  y="6"  width="3" height="13" rx="1" fill="#6B4423"/>
      <rect x="24" y="6"  width="3" height="13" rx="1" fill="#6B4423"/>
      <rect x="0"  y="4"  width="28" height="4" rx="1.5" fill="#8B5E3C"/>
      <rect x="0"  y="13" width="28" height="4" rx="1.5" fill="#8B5E3C"/>
    </g>
  )
}

function PixelFence({ x, y }) {
  if (ASSET_READY.world) {
    const s = WORLD_TILESET.decor.fence
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h}/>
  }
  if (ASSET_READY.objects) {
    return (
      <image href={OBJECTS.fence} x={x} y={y} width={TILE} height={TILE}
        style={{ imageRendering: 'pixelated' }}/>
    )
  }
  return (
    <g transform={`translate(${x+2},${y+8})`}>
      <rect x="0"  y="8" width="4" height="14" rx="1" fill="#B89A6E"/>
      <rect x="10" y="8" width="4" height="14" rx="1" fill="#B89A6E"/>
      <rect x="20" y="8" width="4" height="14" rx="1" fill="#B89A6E"/>
      <rect x="-2" y="10" width="28" height="3" rx="1" fill="#C8AE7E"/>
      <rect x="-2" y="17" width="28" height="3" rx="1" fill="#C8AE7E"/>
    </g>
  )
}

/* ─────────────────────────────────────────────
   Zone 빌딩 SVG 폴백 (각 zone 테마 맞춤)
───────────────────────────────────────────── */
function ZoneBuilding({ zone, px, py, pw, ph }) {
  const cx = px + pw / 2

  if (ASSET_READY.world && WORLD_BUILDINGS[zone]) {
    return <BuildingSprite zone={zone} px={px} py={py} pw={pw} ph={ph}/>
  }

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
function PortalIsland({ portal, hovered, progress, locked }) {
  const meta = ZONE_META[portal.zone]
  const px = portal.tx * TILE, py = portal.ty * TILE
  const pw = portal.w  * TILE, ph = portal.h  * TILE
  const prog = Math.min(Math.max(progress || 0, 0), 1)
  const accent = locked ? '#8A8A8A' : meta.color

  // 실제 건물 스프라이트가 있으면 잔디 위에 그냥 자연스럽게 올려놓고, 예전처럼 건물
  // 뒤에 초록 사각 "언덕 대지"를 깔지 않는다 — hover 표시는 은은한 테두리 선으로만.
  const useRealBuilding = ASSET_READY.world && WORLD_BUILDINGS[portal.zone]

  return (
    <g opacity={locked ? 0.6 : 1} style={{ filter: locked ? 'grayscale(0.8)' : 'none', transition:'all 0.25s' }}>
      <ellipse cx={px+pw/2+4} cy={py+ph+8} rx={pw*0.52} ry={10} fill="#00000033"/>
      {useRealBuilding ? (
        <rect x={px-4} y={py-4} width={pw+8} height={ph+8} rx="14"
          fill="none"
          stroke={hovered ? accent : 'transparent'}
          strokeWidth={hovered ? 2.5 : 0}
          style={{ filter: hovered && !locked ? `drop-shadow(0 0 10px ${accent}66)` : 'none', transition:'all 0.25s' }}
        />
      ) : (
        <>
          <rect x={px-4} y={py} width={pw+8} height={ph} rx="10"
            fill="#3A6B2A"
            stroke={hovered ? accent : '#2A5A1A'}
            strokeWidth={hovered ? 2.5 : 1}
            style={{ filter: hovered && !locked ? `drop-shadow(0 0 10px ${accent}66)` : 'none', transition:'all 0.25s' }}
          />
          <rect x={px-4} y={py} width={pw+8} height={12} rx="10" fill="#4A8B3A" opacity="0.7"/>
          <rect x={px+pw/2-8} y={py+ph-4} width={16} height={12} rx="2" fill="#C8B89A"/>
        </>
      )}

      <ZoneBuilding zone={portal.zone} px={px} py={py} pw={pw} ph={ph}/>

      {locked && (
        <g transform={`translate(${px+pw/2},${py+ph/2})`}>
          <circle r="16" fill="#000000aa"/>
          <text textAnchor="middle" y="7" fontSize="18" style={{userSelect:'none'}}>🔒</text>
        </g>
      )}

      <rect x={px-4} y={py+ph+2} width={pw+8} height={4} rx="2" fill="#ffffff18"/>
      <rect x={px-4} y={py+ph+2} width={(pw+8)*prog} height={4} rx="2" fill={accent}/>

      <rect x={px+pw/2-38} y={py-26} width={76} height={22} rx="7"
        fill={hovered ? accent : '#000000bb'}
        stroke={accent} strokeWidth="1.5"
        style={{ transition:'all 0.2s' }}
      />
      <text x={px+pw/2} y={py-12} textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="Nunito, sans-serif"
        fill={hovered ? '#fff' : accent}
        style={{ userSelect:'none', transition:'fill 0.2s' }}>
        {locked ? '🔒' : meta.emoji} {meta.label}
      </text>

      {hovered && (
        <g>
          <rect x={px+pw/2-42} y={py+ph+10} width={84} height={17} rx="5" fill="#000000cc"/>
          <text x={px+pw/2} y={py+ph+21} textAnchor="middle" fontSize="9"
            fontFamily="Nunito, sans-serif" fill="#F0EDE8" style={{userSelect:'none'}}>
            {locked ? '🔒 잠긴 마을' : 'ENTER 진입'}
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

  if (ASSET_READY.world) {
    const { frame: fs, rows, cols, layers } = WORLD_CHARACTER
    const row = rows[dir] ?? rows.down
    const srcX = cols[frame] * fs, srcY = row * fs
    // 중첩된 svg의 viewBox 암시적 클리핑이 foreignObject 안에서는 이전 프레임 일부가
    // 새어나오는 경우가 있어서(특히 CHAR_W/H가 32x32 프레임과 비율이 다를 때), 기존
    // player_sheet 폴백과 같은 방식으로 명시적 clipPath를 써서 확실하게 자른다.
    return (
      <svg width={CHAR_W} height={CHAR_H} viewBox={`0 0 ${fs} ${fs}`}
        style={{ overflow:'hidden', imageRendering:'pixelated' }}>
        <defs>
          <clipPath id="playerClip"><rect width={fs} height={fs}/></clipPath>
        </defs>
        {layers.map((L,i) => (
          <image key={i} href={L.src} x={-srcX} y={-srcY} width={L.sheetW} height={L.sheetH}
            clipPath="url(#playerClip)" style={{ imageRendering:'pixelated' }}/>
        ))}
      </svg>
    )
  }

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
  if (ASSET_READY.world) {
    return (
      <defs>
        <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2"/>
        </filter>
        <filter id="grassBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14"/>
        </filter>
      </defs>
    )
  }
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
function ObjectivePanel({ nearZone, nearMuseum, nearZoneLocked }) {
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
        <span style={{ fontSize:'14px' }}>{isNearMuseum ? '🏛' : nearZoneLocked ? '🔒' : '🚩'}</span>
        <span style={{ fontSize:'11px', fontWeight:800, color:'#3A2A14' }}>현재 목표</span>
      </div>
      <div style={{ fontSize:'12px', fontWeight:700, color:'#3A2A14', marginBottom:'4px' }}>
        {nearZone ? `${ZONE_META[nearZone].emoji} ${ZONE_META[nearZone].label} ${nearZoneLocked ? '(잠김)' : '진입'}`
          : isNearMuseum ? '🏛 Sound Museum 진입'
          : '마을 탐험하기'}
      </div>
      <div style={{ fontSize:'11px', color:'#8B6A3A', lineHeight:1.5, marginBottom:'6px' }}>
        {nearZoneLocked ? '🎵 음악 마을 구역 1을 먼저 전사하세요'
          : nearZone || isNearMuseum ? 'ENTER를 눌러 진입하세요' : '방향키로 이동해 Zone을 찾아보세요'}
      </div>
      <div style={{ height:'1px', background:'#D4C4A0', margin:'4px 0' }}/>
      <div style={{ fontSize:'10px', color:'#8B6A3A' }}>💡 WASD / 방향키 이동</div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   진입 알림 — zone/museum 근처에 왔을 때 뜨는 배지.
   눈에 잘 띄도록 크게 + 은은한 pulse로 계속 시선을 끈다.
───────────────────────────────────────────── */
function EnterPrompt({ emoji, label, color, locked }) {
  const accent = locked ? '#8A8A8A' : color
  return (
    <div style={{
      position:'absolute', bottom:'110px', left:'50%', transform:'translateX(-50%)',
      background:'#F5EDD8ee', border:`3px solid ${accent}`,
      borderRadius:'26px', padding:'16px 34px',
      fontSize:'20px', fontFamily:'Nunito, sans-serif',
      color:'#3A2A14', fontWeight:800, backdropFilter:'blur(8px)',
      animation: locked
        ? 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)'
        : 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1), pulse 1.6s ease-in-out 0.3s infinite',
      pointerEvents:'none', whiteSpace:'nowrap',
      boxShadow:`0 8px 28px ${accent}66`, zIndex:15,
      display:'flex', alignItems:'center', gap:'12px',
    }}>
      <span style={{ fontSize:'30px' }}>{locked ? '🔒' : emoji}</span>
      {locked ? (
        <span>{label} — 음악 마을 구역 1을 먼저 전사하세요</span>
      ) : (
        <>
          <span>{label} 근처</span>
          <span style={{
            background:accent, color:'#fff', padding:'5px 14px', borderRadius:'10px',
            fontSize:'17px', fontWeight:800, letterSpacing:'0.5px',
            boxShadow:'inset 0 -2px 0 #00000033',
          }}>
            ENTER ↵
          </span>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   WorldMap 메인
───────────────────────────────────────────── */
export default function WorldMap({ onEnterZone, onEnterMuseum, totalCount, zoneProgress = {}, participantId = '', lockedZones = [] }) {
  const { keys, press, release } = useKeys()
  const lockedSet = useMemo(() => new Set(lockedZones), [lockedZones])

  const [pos,        setPos]        = useState({ x: PX_W/2 - CHAR_W/2, y: PX_H/2 - CHAR_H/2 })
  const [dir,        setDir]        = useState('down')
  const [moving,     setMoving]     = useState(false)
  const [nearZone,   setNearZone]   = useState(null)
  const [nearMuseum, setNearMuseum] = useState(false)
  const posRef = useRef(pos)
  const rafRef = useRef(null)

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
        if (nearZone && !lockedSet.has(nearZone)) onEnterZone(nearZone)
        else if (nearMuseum && onEnterMuseum) onEnterMuseum()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nearZone, nearMuseum, onEnterZone, onEnterMuseum, lockedSet])

  const camX = Math.max(0, Math.min(PX_W - VIEW_W, pos.x + CHAR_W/2 - VIEW_W/2))
  const camY = Math.max(0, Math.min(PX_H - VIEW_H, pos.y + CHAR_H/2 - VIEW_H/2))

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', userSelect:'none' }}>
      <HUD totalCount={totalCount} zoneProgress={zoneProgress}/>

      <div style={{
        position:'absolute', top:`${HUD_H}px`, left:0, right:0, bottom:0,
        background: ASSET_READY.world ? GRASS_BASE : '#5A9A3A', overflow:'hidden', cursor:'none',
      }}>
        <svg width="100%" height="100%"
          viewBox={`${camX} ${camY} ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display:'block', position:'absolute', inset:0 }}
        >
          <GroundPatterns/>
          <rect width={PX_W} height={PX_H} fill={ASSET_READY.world ? GRASS_BASE : 'url(#grass)'}/>
          {ASSET_READY.world && <GrassBlotches/>}

          {ASSET_READY.world ? (
            <>
              {PATH_TILES.map((p,i) => {
                const { shape, rotate } = autotileShape(p.tx, p.ty, terrainAt, 'dirt')
                const s = WORLD_TILESET.dirt[shape]
                return <SheetSprite key={i} x={p.tx*TILE} y={p.ty*TILE} srcX={s.x} srcY={s.y} rotate={rotate}/>
              })}
              {WATER_TILES.map((w,i) => {
                const { shape, rotate } = autotileShape(w.tx, w.ty, terrainAt, 'water')
                const s = WORLD_TILESET.water[shape]
                return <SheetSprite key={i} x={w.tx*TILE} y={w.ty*TILE} srcX={s.x} srcY={s.y} rotate={rotate}/>
              })}
              {/* 시트 자체의 톱니 경계가 은은해서, 그 위에 짧은 크림색 glow 선을 겹쳐 그려
                  레퍼런스 이미지처럼 잔디↔길·잔디↔물 경계가 눈에 뚜렷하게 들어오게 보강 */}
              {PATH_TILES.map((p,i) => {
                const { shape, rotate } = autotileShape(p.tx, p.ty, terrainAt, 'dirt')
                if (shape !== 'edge') return null
                return <EdgeGlow key={i} tx={p.tx} ty={p.ty} rotate={rotate} color="#F5E6BE"/>
              })}
              {WATER_TILES.map((w,i) => {
                const { shape, rotate } = autotileShape(w.tx, w.ty, terrainAt, 'water')
                if (shape !== 'edge') return null
                return <EdgeGlow key={i} tx={w.tx} ty={w.ty} rotate={rotate} color="#EAF7F5"/>
              })}
            </>
          ) : (
            <>
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
            </>
          )}

          {BUSHES.map((b,i) => <PixelBush key={i} x={b.tx*TILE} y={b.ty*TILE} variant={i}/>)}
          {FLOWERS.map((f,i) => <PixelFlower key={i} x={f.tx*TILE} y={f.ty*TILE} type={f.type}/>)}
          {ROCKS.map((r,i) => <PixelRock key={i} x={r.tx*TILE} y={r.ty*TILE}/>)}
          {BENCHES.map((b,i) => <PixelBench key={i} x={b.tx*TILE} y={b.ty*TILE}/>)}
          {FENCES.map((f,i) => <PixelFence key={i} x={f.tx*TILE} y={f.ty*TILE}/>)}
          {TREES.map((t,i) => <PixelTree key={i} x={t.tx*TILE} y={t.ty*TILE} variant={t.variant ?? i%3}/>)}

          {PORTALS.map(p => (
            <PortalIsland key={p.zone} portal={p}
              hovered={nearZone === p.zone}
              progress={zoneProgress[p.zone] || 0}
              locked={lockedSet.has(p.zone)}
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

      <ObjectivePanel nearZone={nearZone} nearMuseum={nearMuseum} nearZoneLocked={nearZone && lockedSet.has(nearZone)}/>

      {nearZone && (
        <EnterPrompt
          emoji={ZONE_META[nearZone].emoji}
          label={ZONE_META[nearZone].label}
          color={ZONE_META[nearZone].color}
          locked={lockedSet.has(nearZone)}
        />
      )}

      {!nearZone && nearMuseum && (
        <EnterPrompt emoji="🏛" label="Sound Museum" color="#C8A96E"/>
      )}

      <DPad press={press} release={release}
        onConfirm={
          nearZone && !lockedSet.has(nearZone) ? () => onEnterZone(nearZone)
          : !nearZone && nearMuseum && onEnterMuseum ? () => onEnterMuseum()
          : null
        }
      />
    </div>
  )
}

function DPad({ press, release, onConfirm }) {
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
      {onConfirm && (
        <div style={{ ...s, gridArea:'1/3', background:'#C8A96E', color:'#fff', fontSize:'18px', border:'2px solid #8B6432' }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onConfirm() }}
        >✓</div>
      )}
    </div>
  )
}
