'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getTodayQuestSummary } from '@/lib/dailyQuests'
import { getAttendanceStatus } from '@/lib/attendance'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ASSET_READY, WORLD_TILESET, WORLD_BUILDINGS, WORLD_CHARACTER, WORLD_SLIMES, WORLD_NATURE, WORLD_PROPS, LIBRARY_YARD } from '@/components/AssetRegistry'
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
// 결정론적 의사난수 — 동물의 숲류 코지 게임의 "완벽 대칭이 아닌" 손으로 배치한 듯한
// 느낌을 내는 데 여러 군데(포털 위치 지터, 연못 모양, 잔디 얼룩)에서 재사용한다.
function seedRand(i) {
  const a = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return a - Math.floor(a)
}

const OLD_CENTER = { x: 30, y: 22.5 }
const NEW_CENTER = { x: 60, y: 45 }
const DIST_SCALE  = 2
const SIZE_SCALE  = 1.3
// 완벽한 정육각형 배치는 "게임판" 같아 보여서, 포털마다 손으로 살짝 어긋나게(지터) 잡아
// 동물의 숲처럼 자연스럽게 자리 잡은 마을 느낌을 낸다.
function placePortal(zone, oldTx, oldTy, oldW, oldH, jx = 0, jy = 0) {
  const oldCx = oldTx + oldW/2, oldCy = oldTy + oldH/2
  const cx = NEW_CENTER.x + (oldCx - OLD_CENTER.x) * DIST_SCALE + jx
  const cy = NEW_CENTER.y + (oldCy - OLD_CENTER.y) * DIST_SCALE + jy
  const w = Math.round(oldW * SIZE_SCALE), h = Math.round(oldH * SIZE_SCALE)
  return { zone, tx: Math.round(cx - w/2), ty: Math.round(cy - h/2), w, h }
}
const PORTALS = [
  placePortal('Animal', 33, 5,  9, 9,  -4,  3),  // top-right  (60°)
  placePortal('Lab',    18, 5,  9, 9,   3, -2),  // top-left  (120°)
  placePortal('Urban',  42, 18, 8, 9,   2,  5),  // right       (0°)
  placePortal('Nature', 9,  18, 8, 9,  -3, -4),  // left       (180°)
  placePortal('Music',  33, 32, 9, 9,   5, -3),  // bottom-right (300°)
  placePortal('Human',  18, 32, 9, 9,  -2,  4),  // bottom-left (240°)
]
const portalByZone = Object.fromEntries(PORTALS.map(p => [p.zone, p]))

/* ─────────────────────────────────────────────
   경로 타일 — Museum 중심에서 각 포털까지 잇는다.
   폭은 고정 SPOKE_W 타일이라 맵이 넓어져도 광장/길이 화면을 뒤덮지 않고, 길이만 늘어난다.
   직각 L자 하나 대신 수평-수직-수평 3구간으로 살짝 꺾어서, 사진 속 코지 게임처럼
   길이 자로 잰 듯 곧게 뻗지 않고 완만하게 휘어지는 느낌을 낸다.
───────────────────────────────────────────── */
function band(tx0, tx1, ty0, ty1, plaza = false) {
  const out = []
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++)
      out.push({ tx, ty, plaza })
  return out
}
// 예전엔 폭이 좁아 "길"이라기보단 실선처럼 보인다는 피드백으로 4 → 6타일로 확장.
// (아래 STREETLIGHTS의 offset이 SPOKE_W를 그대로 참조하므로 가로등도 자동으로 같이 벌어진다.)
const SPOKE_W = 6
function spoke(x0, y0, x1, y1, width = SPOKE_W, bend = 0.5) {
  const w2 = Math.floor(width / 2)
  const midX = Math.round(x0 + (x1 - x0) * bend)
  const out = []
  out.push(...band(Math.min(x0,midX), Math.max(x0,midX), y0 - w2, y0 + w2))
  out.push(...band(midX - w2, midX + w2, Math.min(y0,y1), Math.max(y0,y1)))
  out.push(...band(Math.min(midX,x1), Math.max(midX,x1), y1 - w2, y1 + w2))
  return out
}
const SPOKE_BENDS = { Animal: 0.4, Lab: 0.6, Urban: 0.45, Nature: 0.55, Music: 0.6, Human: 0.4 }

// 마을(zone) 간 직접 연결 통로 — 기존엔 모든 길이 박물관 허브를 거쳐야만 하는 방사형
// (허브+바퀴살) 구조뿐이었다. 인접한 포털끼리도 서로 바로 잇는 "링" 통로를 추가해서
// 박물관을 거치지 않고 옆 마을로 바로 넘어갈 수 있게 한다. 연결 순서는 placePortal
// 주석에 적힌 실제 배치 각도(0°→300°) 순서를 그대로 따른다.
const RING_ORDER = ['Urban', 'Animal', 'Lab', 'Nature', 'Human', 'Music']
const RING_BEND = 0.5
const RING_TILES = RING_ORDER.flatMap((zone, i) => {
  const a = portalByZone[zone]
  const b = portalByZone[RING_ORDER[(i + 1) % RING_ORDER.length]]
  return spoke(
    Math.round(a.tx + a.w/2), Math.round(a.ty + a.h/2),
    Math.round(b.tx + b.w/2), Math.round(b.ty + b.h/2),
    SPOKE_W, RING_BEND,
  )
})

const RAW_PATH_TILES = [
  // Museum 앞마당 (건물 발치를 감싸는 자갈 광장) — 길이 넓어진 만큼 여백도 살짝 키움
  ...band(MUSEUM.tx - 3, MUSEUM.tx + MUSEUM.w + 2, MUSEUM.ty - 3, MUSEUM.ty + MUSEUM.h + 2, true),
  ...PORTALS.flatMap(p => spoke(
    Math.round(MUSEUM_CENTER.x), Math.round(MUSEUM_CENTER.y),
    Math.round(p.tx + p.w/2),    Math.round(p.ty + p.h/2),
    SPOKE_W, SPOKE_BENDS[p.zone],
  )),
  ...RING_TILES,
]
// 광장/바퀴살/링 통로가 포털 근처에서 서로 겹치는 타일이 나올 수 있어 좌표 기준으로
// 한 번만 남긴다 — 안 그러면 오토타일·글로우 효과가 같은 자리에 중복으로 그려진다.
const pathTileMap = new Map()
for (const t of RAW_PATH_TILES) {
  const k = `${t.tx},${t.ty}`
  if (!pathTileMap.has(k)) pathTileMap.set(k, t)
}
const PATH_TILES = [...pathTileMap.values()]

const PATH_SET = new Set(PATH_TILES.map(p => `${p.tx},${p.ty}`))

// Nature 포털 옆 작은 연못 — 완전한 직사각형 대신 타원+노이즈로 가장자리를 울퉁불퉁하게
// 깎아서 사진 속 자연스러운 연못처럼 보이게 한다 (오토타일이 그 울퉁불퉁한 경계를 따라 그려짐).
function organicBlob(cx, cy, rx, ry, seedOffset = 0, threshold = 0.82) {
  const out = []
  for (let tx = Math.floor(cx - rx); tx <= Math.ceil(cx + rx); tx++) {
    for (let ty = Math.floor(cy - ry); ty <= Math.ceil(cy + ry); ty++) {
      const nx = (tx - cx) / rx, ny = (ty - cy) / ry
      const d = nx*nx + ny*ny
      const noise = (seedRand(tx * 13 + ty * 7 + seedOffset) - 0.5) * 0.4
      if (d + noise < threshold) out.push({ tx, ty })
    }
  }
  return out
}
const NATURE_P = portalByZone.Nature
const WATER_TILES = organicBlob(NATURE_P.tx - 7, NATURE_P.ty + 5, 5, 4, 91)
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

// 캐릭터 이동 가능 타일 — 길 + 포털/박물관 부지(건물 진입 지점까지는 자연스럽게 걸어
// 들어갈 수 있어야 함). 잔디(나무·꽃 등 장식이 있는 isFree 타일)와 물은 제외해서,
// 방향키로 아무 데나(잔디 위) 못 가고 길로만 다니게 한다.
const WALKABLE_SET = new Set([...PATH_SET, ...PORTAL_SET, ...MUSEUM_SET])

// 발밑 충돌 판정 — 캐릭터 스프라이트 전체(머리·몸통 포함)가 아니라 발끝 부분의 작은
// 박스만 검사한다. 그래야 스프라이트가 시각적으로 길 가장자리에 살짝 걸쳐 보여도
// 실제 판정은 발이 딛는 자리 기준으로 자연스럽게 맞는다.
const FOOT_W = 28, FOOT_H = 16
function isWalkable(px, py) {
  const fx0 = px + (CHAR_W - FOOT_W) / 2
  const fy0 = py + CHAR_H - FOOT_H
  const tx0 = Math.floor(fx0 / TILE), tx1 = Math.floor((fx0 + FOOT_W - 1) / TILE)
  const ty0 = Math.floor(fy0 / TILE), ty1 = Math.floor((fy0 + FOOT_H - 1) / TILE)
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++)
      if (!WALKABLE_SET.has(`${tx},${ty}`)) return false
  return true
}

// 지형 조회 — GroundLayer(오토타일 렌더링)와 스폰 로직이 공유
function terrainAt(tx, ty) {
  const k = `${tx},${ty}`
  if (WATER_SET.has(k)) return 'water'
  if (PATH_SET.has(k))  return 'dirt'
  return 'grass'
}

/* ─────────────────────────────────────────────
   마을 "마당" — 모든 오브젝트 배치가 "왜 여기 있는가"에 답할 수 있어야 한다는 원칙으로
   재설계. 종류(나무/울타리/상자) 기준 무작위 스캐터를 걷어내고, 포털마다 실제 구획
   (마당)을 하나씩 두고 그 구획 기준으로 울타리/배경 나무/발치 장식/내부 소품을 배치한다.
───────────────────────────────────────────── */
const YARD_MARGIN = 3
function yardBounds(p) {
  return { x0: p.tx - YARD_MARGIN, y0: p.ty - YARD_MARGIN, x1: p.tx + p.w - 1 + YARD_MARGIN, y1: p.ty + p.h - 1 + YARD_MARGIN }
}
// 박물관 쪽을 향한 변을 "입구"로 정한다 — 스포크 길이 실제로 그 방향에서 들어오므로
// 게이트 위치와 길이 자연스럽게 이어진다.
function gateSide(p) {
  const dx = (p.tx + p.w / 2) - MUSEUM_CENTER.x
  const dy = (p.ty + p.h / 2) - MUSEUM_CENTER.y
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'west' : 'east') : (dy > 0 ? 'north' : 'south')
}
// 마당을 4면 울타리로 완전히 둘러싼다. 게이트는 따로 계산하지 않고 isFree()에게 맡긴다 —
// 길(PATH_SET)이 지나가는 자리는 자동으로 빠지므로, 문이 항상 실제 길과 정확히 겹치는
// 자리에 생긴다(별도로 "입구 변 중앙 40%"처럼 근사하면 실제 길 위치와 어긋나 울타리가
// 두 군데서 끊어져 보이는 문제가 있었음).
function yardFencePerimeter(p) {
  const { x0, y0, x1, y1 } = yardBounds(p)
  const out = []
  for (let tx = x0; tx <= x1; tx++) { out.push({ tx, ty: y0 }); out.push({ tx, ty: y1 }) }
  for (let ty = y0; ty <= y1; ty++) { out.push({ tx: x0, ty }); out.push({ tx: x1, ty }) }
  return out.filter(t => isFree(t.tx, t.ty))
}
// 마당 담장 바로 바깥, 입구 반대쪽에 나무를 몰아서 "건물을 감싸는 배경 숲" 역할을 준다.
function backdropCluster(p, count, sprites, seed) {
  const { x0, y0, x1, y1 } = yardBounds(p)
  const side = gateSide(p)
  const out = []
  for (let i = 0; i < count; i++) {
    const t = seedRand(seed + i * 3)
    const depth = 1 + Math.floor(seedRand(seed + i * 3 + 1) * 3)
    let tx, ty
    if (side === 'south')      { tx = Math.round(x0 + t * (x1 - x0)); ty = y0 - depth }
    else if (side === 'north') { tx = Math.round(x0 + t * (x1 - x0)); ty = y1 + depth }
    else if (side === 'east')  { ty = Math.round(y0 + t * (y1 - y0)); tx = x0 - depth }
    else                       { ty = Math.round(y0 + t * (y1 - y0)); tx = x1 + depth }
    if (isFree(tx, ty)) out.push({ tx, ty, sprite: sprites[i % sprites.length] })
  }
  return out
}
// 건물 발치(마당 안, 담장 바로 앞) 스커팅 — 잔디에서 건물로 바로 이어지지 않고
// 덤불/꽃/돌 한 줄이 전환부 역할을 한다.
function footprintSkirt(p, sprites, seed, everyOther = true) {
  const ring = []
  for (let tx = p.tx - 1; tx <= p.tx + p.w; tx++) ring.push({ tx, ty: p.ty + p.h })
  for (let ty = p.ty; ty < p.ty + p.h; ty++) { ring.push({ tx: p.tx - 1, ty }); ring.push({ tx: p.tx + p.w, ty }) }
  return ring
    .filter((t, i) => !everyOther || i % 2 === seed % 2)
    .filter(t => isFree(t.tx, t.ty))
    .map((t, i) => ({ ...t, sprite: sprites[(i + seed) % sprites.length] }))
}
// 마당 내부(담장 안쪽)에 그 마을 컨셉에 맞는 소품을 채운다 — "이 소품이 왜 여기 있는가"에
// 항상 "이 마을 마당 안이라서"로 답할 수 있도록 좌표 범위를 마당 경계로 못박는다.
function scatterInYard(p, count, seed, margin = 2) {
  const { x0, y0, x1, y1 } = yardBounds(p)
  const out = []
  for (let i = 0; i < count; i++) {
    const tx = Math.round(x0 + margin + seedRand(seed + i * 2) * (x1 - x0 - margin * 2))
    const ty = Math.round(y0 + margin + seedRand(seed + i * 2 + 1) * (y1 - y0 - margin * 2))
    if (isFree(tx, ty)) out.push({ tx, ty })
  }
  return out
}

// 테두리 나무 — 맵 가장자리를 두르는 액자 역할(존 무관). 맵 크기에 비례해서 개수 자동 계산.
const borderTreeCount = Math.floor((MAP_W - 4) / 2)
const sideTreeCount    = Math.floor((MAP_H - 6) / 2)
const BORDER_TREES = [
  ...Array.from({length: borderTreeCount}, (_,i) => ({ tx: 1+i*2, ty: 1,        variant: i%3 })),
  ...Array.from({length: borderTreeCount}, (_,i) => ({ tx: 1+i*2, ty: MAP_H-2,  variant: (i+1)%3 })),
  ...Array.from({length: sideTreeCount},   (_,i) => ({ tx: 1,       ty: 3+i*2,  variant: i%2 })),
  ...Array.from({length: sideTreeCount},   (_,i) => ({ tx: MAP_W-2, ty: 3+i*2,  variant: (i+1)%2 })),
].filter(t => isFree(t.tx, t.ty))

// 나무 배리에이션 — 기존엔 tree1/tree2/pine 3종뿐이었는데, "100 Nature Things" 팩의
// 10종(사과/오렌지/자작/소나무/단풍/등근수관/벚꽃/분홍벚꽃/저주받은나무/고사목)을 섞어서
// 같은 "배경 숲" 클러스터 안에서도 단조롭지 않게 한다.
const NATURE_TREES = WORLD_NATURE.trees
const ORCHARD_TREES = [NATURE_TREES[0], NATURE_TREES[1], NATURE_TREES[4]] // 사과/오렌지/단풍 — Animal 농장 배경
const FOREST_TREES   = [NATURE_TREES[2], NATURE_TREES[3], NATURE_TREES[9]] // 자작/소나무/고사목 — Nature 숲 배경
const BLOSSOM_TREES  = [NATURE_TREES[6], NATURE_TREES[7], NATURE_TREES[5]] // 벚꽃/분홍벚꽃/등근수관 — Human 정원 배경
const MYSTIC_TREES    = [NATURE_TREES[8], NATURE_TREES[3]]                 // 저주받은나무/소나무 — Lab 배경

// 마을마다: 마당을 두르는 울타리(3면+게이트) + 담장 바깥 배경 나무 클러스터 + 발치 스커팅.
// "어떤 오브젝트든 소속 마을 마당과 연결되지 않으면 배치하지 않는다"는 원칙을 그대로 코드로 옮긴 것.
const FENCES = PORTALS.flatMap(p => yardFencePerimeter(p))

const TREES = [
  ...BORDER_TREES,
  ...backdropCluster(portalByZone.Animal, 8, ORCHARD_TREES, 101),
  ...backdropCluster(portalByZone.Nature, 8, FOREST_TREES,  103),
  ...backdropCluster(portalByZone.Human,  6, BLOSSOM_TREES, 107),
  ...backdropCluster(portalByZone.Lab,    5, MYSTIC_TREES,  109),
  ...backdropCluster(portalByZone.Music,  5, BLOSSOM_TREES, 113),
  ...backdropCluster(portalByZone.Urban,  4, FOREST_TREES,  127),
].map((t,i) => t.sprite ? t : ({ ...t, variant: t.variant ?? i % 3 }))

// 발치 스커팅 — 마을 성격에 맞는 소재로: Animal은 덤불, Nature는 버섯(숲 바닥), Human/Music은
// 꽃, Urban은 돌(포장 느낌), Lab은 크리스탈(신비로운 정원).
const SKIRTS = [
  ...footprintSkirt(portalByZone.Animal, [WORLD_TILESET.decor.bush1, WORLD_TILESET.decor.bush2], 1),
  ...footprintSkirt(portalByZone.Nature, WORLD_NATURE.mushrooms, 2),
  ...footprintSkirt(portalByZone.Human,  WORLD_NATURE.flowers,   3),
  ...footprintSkirt(portalByZone.Music,  WORLD_NATURE.flowers,   4),
  ...footprintSkirt(portalByZone.Urban,  WORLD_NATURE.rocks,     5),
  ...footprintSkirt(portalByZone.Lab,    WORLD_NATURE.crystals,  6),
]

// 마당 내부 소품 — 마을 컨셉별로 하나씩:
//   Animal = 농장(사일로 + 덤불) / Nature = 숲 바닥(버섯+바위, 풍차는 연못 옆 랜드마크로 별도)
//   Human = 정원(꽃+벤치) / Urban = 작은 광장(벤치+가로등) / Music = 화단 / Lab = 크리스탈 정원
// 사일로는 1개뿐이라 무작위 시도 1회로 뽑으면 isFree() 검사에 걸려 통째로 사라질 위험이
// 있어서(실제로 그랬음), 건물 바로 옆 마당 안 고정 위치에 결정론적으로 둔다.
const SILOS = (() => {
  const p = portalByZone.Animal
  const spot = { tx: p.tx + p.w + 1, ty: p.ty + p.h - 2 }
  return isFree(spot.tx, spot.ty) ? [{ ...spot, sprite: WORLD_PROPS.silo }] : []
})()
const BUSHES = [
  ...scatterInYard(portalByZone.Animal, 6, 137).map((t,i) => ({ ...t, sprite: (i%2? WORLD_TILESET.decor.bush1 : WORLD_TILESET.decor.bush2) })),
]
const MUSHROOMS = scatterInYard(portalByZone.Nature, 8, 139).map((t,i) => ({ ...t, sprite: WORLD_NATURE.mushrooms[i % 10] }))
const YARD_ROCKS = scatterInYard(portalByZone.Nature, 5, 149).map((t,i) => ({ ...t, sprite: WORLD_NATURE.rocks[i % 10] }))
const FLOWERS = [
  ...scatterInYard(portalByZone.Human, 10, 151).map((t,i) => ({ ...t, sprite: WORLD_NATURE.flowers[i % 10] })),
  ...scatterInYard(portalByZone.Music, 10, 157).map((t,i) => ({ ...t, sprite: WORLD_NATURE.flowers[(i+5) % 10] })),
]
const CRYSTALS = scatterInYard(portalByZone.Lab, 7, 163).map((t,i) => ({ ...t, sprite: WORLD_NATURE.crystals[i % 10] }))
const BENCHES = [
  ...scatterInYard(portalByZone.Urban, 3, 167, 3),
  ...scatterInYard(portalByZone.Human, 2, 173, 3),
]
// 풍차 — Nature 연못 바로 옆 랜드마크(물레방아 느낌), 마당 담장 밖 별도 배치
const WINDMILL = (() => {
  const t = { tx: NATURE_P.tx - 4, ty: NATURE_P.ty + 1 }
  return isFree(t.tx, t.ty) ? [{ ...t, sprite: WORLD_PROPS.windmill }] : []
})()

// 가로등 — 스포크 길 중심선을 따라 일정 간격으로 좌우에 세워서 "그냥 넓은 흙바닥"이 아니라
// 실제 가로수길처럼 정체성을 준다.
function spokeCenterline(x0, y0, x1, y1, bend) {
  const midX = Math.round(x0 + (x1 - x0) * bend)
  const pts = []
  const s1 = x0 <= midX ? 1 : -1
  for (let tx = x0; tx !== midX + s1; tx += s1) pts.push({ tx, ty: y0, dir: 'h' })
  const s2 = y0 <= y1 ? 1 : -1
  for (let ty = y0; ty !== y1 + s2; ty += s2) pts.push({ tx: midX, ty, dir: 'v' })
  const s3 = midX <= x1 ? 1 : -1
  for (let tx = midX; tx !== x1 + s3; tx += s3) pts.push({ tx, ty: y1, dir: 'h' })
  return pts
}
const STREETLIGHTS = PORTALS.flatMap(p => {
  const pts = spokeCenterline(
    Math.round(MUSEUM_CENTER.x), Math.round(MUSEUM_CENTER.y),
    Math.round(p.tx + p.w/2),    Math.round(p.ty + p.h/2),
    SPOKE_BENDS[p.zone],
  )
  const offset = SPOKE_W/2 + 2
  const out = []
  for (let i = 5; i < pts.length - 3; i += 9) {
    const pt = pts[i]
    const a = pt.dir === 'h' ? { tx: pt.tx, ty: pt.ty - offset } : { tx: pt.tx - offset, ty: pt.ty }
    const b = pt.dir === 'h' ? { tx: pt.tx, ty: pt.ty + offset } : { tx: pt.tx + offset, ty: pt.ty }
    if (isFree(a.tx, a.ty)) out.push(a)
    if (isFree(b.tx, b.ty)) out.push(b)
  }
  return out
})

// 미지의 소리 마을(Lab) 마당 안을 어슬렁거리는 슬라임들 — 사용자가 레퍼런스로 준
// Farm 팩 슬라임 색상(rainbow 포함 9종)을 그대로 순서대로 배정해서 다양하게 보이게 한다.
const SLIMES = scatterInYard(portalByZone.Lab, 6, 181, 3).map((s, i) => ({ ...s, slime: WORLD_SLIMES[i % WORLD_SLIMES.length] }))

// Sound Museum(월드맵 중앙 허브, UI 라벨 "도서관") 마당 — Public Library 건물을 여기로
// 옮기면서(사용자가 원한 대상이 Lab이 아니라 이쪽이었음, 확인 완료) 묘비/흰 펜스도 같이
// 옮겨왔다. Museum은 6개 마을로 뻗는 스포크 길이 전부 모이는 교차로라 다른 존과 같은
// margin(3)까지는 100% 포장 광장이라 울타리 놓을 잔디가 전혀 없다(실측: margin 0~3 자유
// 타일 0개) — margin 4까지 나가야 첫 잔디 링이 나온다(실측: 55칸). 그래서 Museum만 margin
// 4를 쓰고, 6방향 스포크가 지나는 자리는 그대로 isFree()가 걸러내 여러 출입구가 자연스럽게
// 생기게 둔다 — 허브는 게이트 1개로 막을 수 없으므로 오히려 이 편이 맞다.
const MUSEUM_YARD_MARGIN = 4
const MUSEUM_YARD = {
  x0: MUSEUM.tx - MUSEUM_YARD_MARGIN, y0: MUSEUM.ty - MUSEUM_YARD_MARGIN,
  x1: MUSEUM.tx + MUSEUM.w - 1 + MUSEUM_YARD_MARGIN, y1: MUSEUM.ty + MUSEUM.h - 1 + MUSEUM_YARD_MARGIN,
}
// 가로등(STREETLIGHTS)은 스포크 중심선에서 5칸 떨어진 자리에, 펜스는 건물에서 margin 4
// 떨어진 자리에 각각 독립적으로 계산되는데 우연히 같은 거리대라 3곳(46,41)(46,51)(67,56)에서
// 겹쳤다(실측 확인) — 가로등 좌표를 셋으로 만들어 그 칸만 펜스 배치에서 제외한다. 겹치는
// 칸만 스킵하고 나머지 펜스 배치 로직은 그대로 둔다(사용자 확정: (a)안).
const STREETLIGHT_SET = new Set(STREETLIGHTS.map(s => `${s.tx},${s.ty}`))
function museumYardFence() {
  const { x0, y0, x1, y1 } = MUSEUM_YARD
  const out = []
  for (let tx = x0; tx <= x1; tx++) {
    const role = (tx === x0 || tx === x1) ? 'corner' : 'rail'
    out.push({ tx, ty: y0, role })
    out.push({ tx, ty: y1, role })
  }
  for (let ty = y0 + 1; ty < y1; ty++) {
    out.push({ tx: x0, ty, role: 'post' })
    out.push({ tx: x1, ty, role: 'post' })
  }
  return out.filter(t => isFree(t.tx, t.ty) && !STREETLIGHT_SET.has(`${t.tx},${t.ty}`))
}
const MUSEUM_FENCE = museumYardFence()
function inMuseumYard(tx, ty) {
  return tx >= MUSEUM_YARD.x0 && tx <= MUSEUM_YARD.x1 && ty >= MUSEUM_YARD.y0 && ty <= MUSEUM_YARD.y1
}
// 돌바닥 경계 — 처음엔 organicBlob()으로 타원+노이즈 들쭉날쭉한 경계를 시도했었지만,
// 최종 확정은 "지금 돌이 깔린 범위의 바운딩 박스" 그대로 꽉 채운 사각형으로 결정됨(사용자
// 확정: 작은 사각형 타일들로 큰 사각형을 만드는 형태). organicBlob 결과물의 최소/최대
// tx,ty로 사각형 경계를 잡고 그 안의 길 타일을 전부 돌로 채운다. 건물 발자국(MUSEUM_SET)도
// 포함해서 채운다 — 건물 스프라이트가 자기 타일 칸(20×15)보다 작게(비율 유지 축소) 그려져서
// 그 여백에 흙바닥이 삐져나와 보이는 문제가 있었음(사용자 스크린샷으로 확인). 건물 스프라이트가
// 그 위에 그려지므로 실제로 덮이는 자리는 안 보이고, 여백만 돌로 채워져 자연스럽게 이어진다.
const STONE_BLOB = organicBlob(
  MUSEUM.tx + MUSEUM.w / 2, MUSEUM.ty + MUSEUM.h / 2,
  MUSEUM.w / 2 + MUSEUM_YARD_MARGIN, MUSEUM.h / 2 + MUSEUM_YARD_MARGIN,
  211,
)
const STONE_RECT = STONE_BLOB.reduce((acc, t) => ({
  x0: Math.min(acc.x0, t.tx), x1: Math.max(acc.x1, t.tx),
  y0: Math.min(acc.y0, t.ty), y1: Math.max(acc.y1, t.ty),
}), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
const STONE_SET = new Set(
  PATH_TILES
    .filter(t => t.tx >= STONE_RECT.x0 && t.tx <= STONE_RECT.x1 &&
                 t.ty >= STONE_RECT.y0 && t.ty <= STONE_RECT.y1)
    .map(t => `${t.tx},${t.ty}`)
)
function inMuseumStonePlaza(tx, ty) {
  return STONE_SET.has(`${tx},${ty}`)
}
// 돌↔잔디 경계 스캐터 — 돌 칸(구멍 채움 포함) 중 "바로 옆이 잔디인" 칸을 찾아, 그 잔디
// 쪽에 덤불/꽃/버섯을 과하지 않게(4칸당 1번 정도만 시도) 심어서 전환부를 자연스럽게 한다.
const STONE_TILES = [...STONE_SET].map(k => {
  const [tx, ty] = k.split(',').map(Number)
  return { tx, ty }
})
const STONE_EDGE_SPOTS = (() => {
  const seen = new Set()
  const out = []
  for (const t of STONE_TILES) {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = t.tx + dx, ny = t.ty + dy
      const k = `${nx},${ny}`
      if (seen.has(k) || STONE_SET.has(k)) continue
      if (!isFree(nx, ny)) continue
      seen.add(k)
      out.push({ tx: nx, ty: ny })
    }
  }
  return out
})()
const STONE_EDGE_DECOR = STONE_EDGE_SPOTS
  .filter((t, i) => seedRand(t.tx * 31 + t.ty * 17 + 233) < 0.25)
  .map((t, i) => {
    const roll = seedRand(t.tx * 19 + t.ty * 23 + 241)
    const sprite = roll < 0.4 ? WORLD_NATURE.bushes[i % 10]
      : roll < 0.7 ? WORLD_NATURE.flowers[i % 10]
      : WORLD_NATURE.mushrooms[i % 10]
    return { ...t, sprite }
  })
// 묘비 6개(좌우 3개씩) — 첫 잔디 링(margin 4)에서 스포크에 안 걸리는 걸 실측 확인한
// 서쪽/동쪽 변(46/73열, y 34~42 구간)에 결정론적으로 배치(SILOS와 같은 이유 — 무작위
// 1회 시도로는 이렇게 좁은 자유 구간을 못 맞힐 위험이 큼).
const GRAVESTONE_SPOTS = [
  { tx: MUSEUM_YARD.x0, ty: MUSEUM_YARD.y0 + 2 },
  { tx: MUSEUM_YARD.x0, ty: MUSEUM_YARD.y0 + 4 },
  { tx: MUSEUM_YARD.x0, ty: MUSEUM_YARD.y0 + 6 },
  { tx: MUSEUM_YARD.x1, ty: MUSEUM_YARD.y0 + 2 },
  { tx: MUSEUM_YARD.x1, ty: MUSEUM_YARD.y0 + 4 },
  { tx: MUSEUM_YARD.x1, ty: MUSEUM_YARD.y0 + 6 },
]
const GRAVESTONES = GRAVESTONE_SPOTS
  .filter(t => isFree(t.tx, t.ty))
  .map((t, i) => ({ ...t, sprite: LIBRARY_YARD.gravestones[i % LIBRARY_YARD.gravestones.length] }))
const LIBRARY_FLOWER_SPOTS = [
  { tx: MUSEUM_YARD.x0 + 1,  ty: MUSEUM_YARD.y0 },
  { tx: MUSEUM_YARD.x0 + 13, ty: MUSEUM_YARD.y0 },
  { tx: MUSEUM_YARD.x0 + 24, ty: MUSEUM_YARD.y0 },
  { tx: MUSEUM_YARD.x0,      ty: MUSEUM_YARD.y0 + 18 },
  { tx: MUSEUM_YARD.x0 + 3,  ty: MUSEUM_YARD.y1 },
]
const LIBRARY_FLOWERS = LIBRARY_FLOWER_SPOTS
  .filter(t => isFree(t.tx, t.ty))
  .map((t, i) => ({ ...t, sprite: WORLD_NATURE.flowers[(i+2) % 10] }))

/* ─────────────────────────────────────────────
   잔디 색상 얼룩 — 구매한 시트의 "잔디" 조각은 전부 독립된 섬(hedge autotile) 형태라
   그대로 반복 타일링하면 각 타일 모서리의 둥근 여백이 그대로 격자무늬로 드러난다
   (사용자가 "흙 같다"고 지적한 원인). 그 대신 단색 바탕 위에 부드럽게 번지는 색 얼룩을
   낮은 투명도로 낮은 빈도로 깔아서, 사진 속 초원처럼 밝고 어두운 풀색이 자연스럽게
   이어지는 느낌만 낸다 — 픽셀아트 톤을 해치지 않도록 블러 강도는 약하게 유지.
───────────────────────────────────────────── */
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
function BuildingSprite({ zone, px, py, pw, ph, scaleMul = 1 }) {
  const b = WORLD_BUILDINGS[zone]
  if (!b) return null
  const scale = Math.min(pw / b.w, ph / b.h) * 0.92 * scaleMul
  const w = b.w * scale, h = b.h * scale
  const x = px + (pw - w) / 2, y = py + (ph - h) / 2 + ph * 0.03
  return <SheetSprite x={x} y={y} srcX={b.x} srcY={b.y} w={b.w} h={b.h}
    renderW={w} renderH={h} sheet={b}/>
}

// 범용 소품 렌더러 — WORLD_NATURE/WORLD_PROPS의 스프라이트를 발밑 그림자와 함께 그린다.
// 마당 스커팅/내부 소품(버섯·크리스탈·사일로·풍차·가로등)이 전부 이걸 공유한다.
function PropSprite({ x, y, sprite, scale = 2 }) {
  const w = sprite.w * scale, h = sprite.h * scale
  return (
    <g>
      <ellipse cx={x + w/2} cy={y + h - 3} rx={w*0.36} ry={4} fill="#00000030"/>
      <SheetSprite x={x} y={y} srcX={sprite.x} srcY={sprite.y} w={sprite.w} h={sprite.h}
        renderW={w} renderH={h} sheet={sprite}/>
    </g>
  )
}

const TREE_SRCS = [OBJECTS.tree_01, OBJECTS.tree_02, OBJECTS.tree_03]
const WORLD_TREE_SRCS = [WORLD_TILESET.decor.tree1, WORLD_TILESET.decor.tree2, WORLD_TILESET.decor.pine]
const TREE_COLORS = [
  { trunk: '#7A5230', canopy: '#2D7A2D', shadow: '#1F5C1F' },
  { trunk: '#8B5E3C', canopy: '#3A8C2F', shadow: '#2A6B22' },
  { trunk: '#6B4423', canopy: '#4A9E38', shadow: '#336E27' },
]

function PixelTree({ x, y, variant = 0, sprite }) {
  // "100 Nature Things" 팩 나무(32×32)는 기존 tree1/2/pine(32×64)보다 낮고 넓어서,
  // 같은 발치 기준으로 정렬되도록 별도 스케일/오프셋을 준다.
  if (sprite) {
    const scale = 1.4
    return <PropSprite x={x - (sprite.w*scale - TILE)/2} y={y - sprite.h*scale + TILE} sprite={sprite} scale={scale}/>
  }
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
  // 프로시저럴(rect/ellipse 손그림) 나무 폴백은 삭제 — 실제 스프라이트가 없으면
  // 도형을 그려 흉내내는 대신 아무것도 그리지 않는다(현재 설정상 여기까지 오지 않음).
  return null
}

const FLOWER_SRCS = [OBJECTS.flower_yellow, OBJECTS.flower_pink, OBJECTS.flower_blue, OBJECTS.flower_white]
const FLOWER_COLORS = [
  ['#F4D03F','#F39C12'], ['#E8A0C0','#D4608A'],
  ['#A8D8EA','#6DB5D4'], ['#F0F0AA','#D4D444'],
]
const WORLD_FLOWER_SRCS = [WORLD_TILESET.decor.flower1, WORLD_TILESET.decor.flower2, WORLD_TILESET.decor.flower3]
function PixelFlower({ x, y, type, sprite }) {
  if (sprite) return <PropSprite x={x} y={y} sprite={sprite} scale={2}/>
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

function PixelBush({ x, y, variant = 0, sprite }) {
  const s = sprite ?? (variant % 2 === 0 ? WORLD_TILESET.decor.bush1 : WORLD_TILESET.decor.bush2)
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

// 미지의 소리 마을 포털 근처를 어슬렁거리는 슬라임 장식
function SlimeDeco({ x, y, slime }) {
  const scale = 1.6
  return (
    <g>
      <ellipse cx={x + slime.w*scale/2} cy={y + slime.h*scale - 2} rx={slime.w*scale*0.38} ry={3} fill="#00000030"/>
      <SheetSprite x={x} y={y} srcX={slime.x} srcY={slime.y} w={slime.w} h={slime.h}
        renderW={slime.w*scale} renderH={slime.h*scale} sheet={slime}/>
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

// Sound Museum 도서관 마당 전용 크림색 피켓펜스 — role(rail/post/corner)에 따라 다른 조각을 그린다.
// rail 조각은 8px 폭이라 한 타일(32px)을 채우려면 4번 반복(이음매 없음, 5장 반복 테스트로 확인).
// post는 세로가 TILE보다 길어(47px) 바닥 기준으로 앉히고 위로 살짝 튀어나오게 둔다(나무/건물처럼
// 이 프로젝트에서 이미 쓰는 방식과 동일 — 타일보다 큰 소품은 발밑을 앵커로 삼는다).
function LibraryFenceSprite({ x, y, role }) {
  if (!ASSET_READY.world) return <PixelFence x={x} y={y}/>
  if (role === 'corner') {
    const s = LIBRARY_YARD.fenceCorner
    return <SheetSprite x={x} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h} renderW={TILE} renderH={TILE} sheet={s}/>
  }
  if (role === 'post') {
    const s = LIBRARY_YARD.fencePost
    return <SheetSprite x={x + (TILE - s.w) / 2} y={y + TILE - s.h} srcX={s.x} srcY={s.y} w={s.w} h={s.h} sheet={s}/>
  }
  const s = LIBRARY_YARD.fenceRail
  const reps = Math.round(TILE / s.w)
  return (
    <>
      {Array.from({ length: reps }, (_, i) => (
        <SheetSprite key={i} x={x + i * s.w} y={y} srcX={s.x} srcY={s.y} w={s.w} h={s.h} sheet={s}/>
      ))}
    </>
  )
}

// Museum 마당 묘비 — 소스가 14~18px 높이라 캐릭터 발치 소품(꽃/버섯 등)과 같은 PropSprite
// 배율(2배)을 쓰면 다른 소품들과 크기 균형이 맞는다.
function GravestoneSprite({ x, y, sprite }) {
  const scale = 2
  const w = sprite.w * scale, h = sprite.h * scale
  const px = x + (TILE - w) / 2, py = y + TILE - h
  return (
    <g>
      <ellipse cx={px + w/2} cy={py + h - 2} rx={w*0.38} ry={4} fill="#00000030"/>
      <SheetSprite x={px} y={py} srcX={sprite.x} srcY={sprite.y} w={sprite.w} h={sprite.h} renderW={w} renderH={h} sheet={sprite}/>
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
  const useRealBuilding = ASSET_READY.world && WORLD_BUILDINGS.Museum

  return (
    <g>
      {useRealBuilding ? (
        <>
          <rect x={px-4} y={py-4} width={pw+8} height={ph+8} rx="14"
            fill="none"
            stroke={hovered ? '#C8A96E' : 'transparent'}
            strokeWidth={hovered ? 2.5 : 0}
            style={{ filter: hovered ? 'drop-shadow(0 0 14px #C8A96E99)' : 'none', transition:'all 0.25s' }}
          />
          <BuildingSprite zone="Museum" px={px} py={py} pw={pw} ph={ph} scaleMul={0.8}/>
        </>
      ) : (
        <>
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
        </>
      )}
      <rect x={cx-46} y={py-26} width={92} height={22} rx="7"
        fill={hovered ? '#C8A96E' : '#000000bb'}
        stroke="#C8A96E" strokeWidth="1.5"
        style={{ transition:'all 0.2s' }}
      />
      <text x={cx} y={py-12} textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="Nunito, sans-serif"
        fill={hovered ? '#fff' : '#C8A96E'}
        style={{ userSelect:'none', transition:'fill 0.2s' }}>
        🏛 도서관
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

function PixelChar({ dir, moving, outfitSrc }) {
  const tick  = Math.floor(Date.now() / 160) % 2
  const frame = moving ? tick : 0

  if (ASSET_READY.world) {
    const { frame: fs, rows, cols, layers } = WORLD_CHARACTER
    const row = rows[dir] ?? rows.down
    // 시트 info.txt에 "WALK FR: 100, Cell Size 256x128(8열)"라고 적혀있는, 8프레임짜리
    // 완전한 걷기 사이클(오른발 스텝 0~3 + 왼발 스텝 4~7)이라 100ms마다 한 칸씩 순서대로
    // 돌려야 자연스럽다 — 예전엔 0번/4번 프레임만 번갈아 써서 제자리 씰룩임처럼 보였다.
    const walkTick = Math.floor(Date.now() / 100) % cols.length
    const srcX = cols[moving ? walkTick : 0] * fs, srcY = row * fs
    // 중첩된 svg의 viewBox 암시적 클리핑이 foreignObject 안에서는 이전 프레임 일부가
    // 새어나오는 경우가 있어서(특히 CHAR_W/H가 32x32 프레임과 비율이 다를 때), 기존
    // player_sheet 폴백과 같은 방식으로 명시적 clipPath를 써서 확실하게 자른다.
    return (
      <svg width={CHAR_W} height={CHAR_H} viewBox={`0 0 ${fs} ${fs}`}
        style={{ overflow:'hidden', imageRendering:'pixelated' }}>
        <defs>
          <clipPath id="playerClip"><rect width={fs} height={fs}/></clipPath>
        </defs>
        {layers.map((L,i) => {
          // 옷(clothes) 레이어(인덱스 1)만 상점에서 장착한 outfit으로 교체 — body/hair 고정.
          const href = (i === 1 && outfitSrc) ? outfitSrc : L.src
          return (
            <image key={i} href={href} x={-srcX} y={-srcY} width={L.sheetW} height={L.sheetH}
              clipPath="url(#playerClip)" style={{ imageRendering:'pixelated' }}/>
          )
        })}
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
function HUD({ totalCount, zoneProgress, balance = 0, onOpenQuests, onOpenAttendance }) {
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
      <div style={{ display:'flex', alignItems:'center', gap:'4px' }} title="상점에서 쓸 수 있는 화폐">
        <span style={{ fontSize:'20px' }}>🪙</span>
        <div>
          <div style={{ fontSize:'16px', fontWeight:800, color:'#B8860B', lineHeight:1 }}>{balance}</div>
          <div style={{ fontSize:'9px', color:'#8B6A3A' }}>보유 화폐</div>
        </div>
      </div>
      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>
      <button onClick={onOpenQuests} title="오늘의 퀘스트" style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:'1px',
        background:'transparent', border:'none', cursor:'pointer', padding:'2px 6px',
        borderRadius:'8px', fontFamily:'Nunito, sans-serif',
      }}>
        <span style={{ fontSize:'19px', lineHeight:1 }}>📋</span>
        <span style={{ fontSize:'9px', color:'#8B6A3A', fontWeight:700 }}>퀘스트</span>
      </button>
      <div style={{ width:'1px', height:'36px', background:'#C8A96E' }}/>
      <button onClick={onOpenAttendance} title="출석 보상" style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:'1px',
        background:'transparent', border:'none', cursor:'pointer', padding:'2px 6px',
        borderRadius:'8px', fontFamily:'Nunito, sans-serif',
      }}>
        <span style={{ fontSize:'19px', lineHeight:1 }}>📅</span>
        <span style={{ fontSize:'9px', color:'#8B6A3A', fontWeight:700 }}>출석</span>
      </button>
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
          : isNearMuseum ? '🏛 도서관 진입'
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
   일일 퀘스트 패널 — HUD 체크리스트 아이콘 클릭 시 펼쳐짐.
   완전히 격리된 부가 기능: lib/dailyQuests.js에서만 데이터를 읽고
   annotations/votes/블록잠금/기존 화폐 로직은 전혀 건드리지 않는다.
   조회 실패해도 "불러오지 못했어요" 안내만 뜰 뿐 게임 진행에 영향 없음.
───────────────────────────────────────────── */
function QuestRow({ label, sub, current, target, completed, reward }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'10px',
      padding:'9px 11px', borderRadius:'10px',
      background: completed ? '#5B9E3A18' : '#00000006',
      border: completed ? '1.5px solid #5B9E3A55' : '1.5px solid #C8A96E33',
    }}>
      <div style={{
        width:'21px', height:'21px', borderRadius:'50%', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        background: completed ? '#5B9E3A' : '#F5EDD8',
        border: completed ? 'none' : '2px solid #C8A96E',
        color:'#fff', fontSize:'12px', fontWeight:900,
      }}>
        {completed ? '✓' : ''}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#3A2A14' }}>{label}</div>
        {sub && <div style={{ fontSize:'10px', color:'#8B6A3A', marginTop:'1px' }}>{sub}</div>}
        {target != null && (
          <div style={{ fontSize:'10px', color:'#8B6A3A', marginTop:'2px', fontVariantNumeric:'tabular-nums' }}>
            {current}/{target}
          </div>
        )}
      </div>
      <div style={{ fontSize:'11px', fontWeight:800, color:'#B8860B', whiteSpace:'nowrap', flexShrink:0 }}>+{reward}🪙</div>
    </div>
  )
}

function QuestSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize:'10px', fontWeight:800, color:'#8B6A3A', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>
        {title}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {children}
      </div>
    </div>
  )
}

function QuestPanel({ participantId, onClose }) {
  const [quests, setQuests] = useState(null) // null = 로딩 중

  useEffect(() => {
    let alive = true
    getTodayQuestSummary(participantId).then(data => { if (alive) setQuests(data) })
    return () => { alive = false }
  }, [participantId])

  const milestones = (quests || [])
    .filter(q => q.template?.type === 'collect_milestone')
    .sort((a, b) => a.template.tier_index - b.template.tier_index)
  const nextTier = milestones.find(m => !m.completed)
  const lastTier = milestones[milestones.length - 1]
  const milestoneCurrent = nextTier ? nextTier.progress_count : (lastTier?.progress_count ?? 0)
  const milestoneTarget  = nextTier ? nextTier.template.target_count : (lastTier?.template.target_count ?? 0)
  const milestonePct = milestoneTarget ? Math.min(milestoneCurrent / milestoneTarget, 1) * 100 : 0
  const allMilestonesDone = milestones.length > 0 && milestones.every(m => m.completed)

  const visitZone = (quests || []).find(q => q.template?.type === 'visit_zone')
  const category  = (quests || []).find(q => q.template?.type === 'category_participate')
  const vote      = (quests || []).find(q => q.template?.type === 'vote_n_times')

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'transparent' }}/>
      <div style={{
        position:'absolute', top:`${HUD_H + 10}px`, right:'16px', width:'300px',
        maxHeight:'70vh', overflowY:'auto',
        background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:'16px',
        boxShadow:'0 10px 40px #00000055', zIndex:121,
        fontFamily:'Nunito, sans-serif', padding:'14px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div style={{ fontSize:'13px', fontWeight:800, color:'#3A2A14' }}>📋 오늘의 퀘스트</div>
          <button onClick={onClose} style={{
            background:'#00000010', border:'none', borderRadius:'50%',
            width:'22px', height:'22px', cursor:'pointer', color:'#8B6A3A', fontSize:'12px',
          }}>✕</button>
        </div>

        {quests === null ? (
          <div style={{ fontSize:'11px', color:'#8B6A3A', textAlign:'center', padding:'16px' }}>불러오는 중...</div>
        ) : quests.length === 0 ? (
          <div style={{ fontSize:'11px', color:'#8B6A3A', textAlign:'center', padding:'16px' }}>퀘스트를 불러오지 못했어요.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

            <QuestSection title="🌾 채집 마일스톤">
              <div style={{ fontSize:'11px', color:'#3A2A14', fontWeight:700, marginBottom:'2px' }}>
                {allMilestonesDone
                  ? '오늘 마일스톤 모두 달성! 🎉'
                  : `채집 ${milestoneCurrent}/${milestoneTarget} · 다음 보상까지 ${Math.max(milestoneTarget - milestoneCurrent, 0)}개`}
              </div>
              <div style={{ height:'8px', background:'#D4C4A0', borderRadius:'4px', overflow:'hidden', marginBottom:'2px' }}>
                <div style={{ height:'100%', borderRadius:'4px', background:'linear-gradient(90deg,#5B9E3A,#7BC850)', width:`${milestonePct}%`, transition:'width 0.5s ease' }}/>
              </div>
              {milestones.map(m => (
                <QuestRow key={m.id}
                  label={m.template.description}
                  current={m.progress_count} target={m.template.target_count}
                  completed={m.completed} reward={m.template.reward_currency}
                />
              ))}
            </QuestSection>

            <QuestSection title="🧭 다양성 과제">
              {visitZone && (
                <QuestRow label={visitZone.template.description}
                  completed={visitZone.completed} reward={visitZone.template.reward_currency}/>
              )}
              {category && (
                <QuestRow label={category.template.description}
                  sub={category.target_sub_category ? `대상 카테고리: ${category.target_sub_category}` : undefined}
                  completed={category.completed} reward={category.template.reward_currency}/>
              )}
            </QuestSection>

            <QuestSection title="🗳 투표">
              {vote && (
                <QuestRow label={vote.template.description}
                  current={vote.progress_count} target={vote.template.target_count}
                  completed={vote.completed} reward={vote.template.reward_currency}/>
              )}
            </QuestSection>
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   출석 보상 패널 — HUD 📅 아이콘 클릭 시 펼쳐짐.
   완전히 격리된 부가 기능: lib/attendance.js에서만 데이터를 읽고
   annotations/votes/블록잠금/기존 화폐·퀘스트 로직은 전혀 건드리지
   않는다. 실제 체크인(+보상 지급)은 앱 진입 시 app/page.js가 이미
   해뒀다는 전제 — 이 패널은 그 결과를 보여주기만 한다.
───────────────────────────────────────────── */
function AttendancePanel({ participantId, onClose }) {
  const [status, setStatus] = useState(null) // null = 로딩 중

  useEffect(() => {
    let alive = true
    getAttendanceStatus(participantId).then(data => { if (alive) setStatus(data) })
    return () => { alive = false }
  }, [participantId])

  const streakDay = status?.today?.streak_day ?? 0

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'transparent' }}/>
      <div style={{
        position:'absolute', top:`${HUD_H + 10}px`, right:'16px', width:'300px',
        background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:'16px',
        boxShadow:'0 10px 40px #00000055', zIndex:121,
        fontFamily:'Nunito, sans-serif', padding:'14px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div style={{ fontSize:'13px', fontWeight:800, color:'#3A2A14' }}>📅 출석 보상</div>
          <button onClick={onClose} style={{
            background:'#00000010', border:'none', borderRadius:'50%',
            width:'22px', height:'22px', cursor:'pointer', color:'#8B6A3A', fontSize:'12px',
          }}>✕</button>
        </div>

        {status === null ? (
          <div style={{ fontSize:'11px', color:'#8B6A3A', textAlign:'center', padding:'16px' }}>불러오는 중...</div>
        ) : status.templates.length === 0 ? (
          <div style={{ fontSize:'11px', color:'#8B6A3A', textAlign:'center', padding:'16px' }}>출석 정보를 불러오지 못했어요.</div>
        ) : (
          <>
            <div style={{ fontSize:'11px', color:'#3A2A14', fontWeight:700, marginBottom:'10px' }}>
              {streakDay > 0
                ? `오늘 출석 완료! 연속 ${streakDay}일차 🔥`
                : '오늘은 아직 출석 전이에요'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {status.templates.map(t => {
                const done = t.day_index <= streakDay
                const isToday = t.day_index === streakDay
                return (
                  <div key={t.day_index} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'9px 11px', borderRadius:'10px',
                    background: isToday ? '#5B9E3A18' : done ? '#00000006' : '#00000003',
                    border: isToday ? '1.5px solid #5B9E3A55' : '1.5px solid #C8A96E33',
                    opacity: done || isToday ? 1 : 0.6,
                  }}>
                    <div style={{
                      width:'21px', height:'21px', borderRadius:'50%', flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background: done ? '#5B9E3A' : '#F5EDD8',
                      border: done ? 'none' : '2px solid #C8A96E',
                      color:'#fff', fontSize:'12px', fontWeight:900,
                    }}>
                      {done ? '✓' : ''}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#3A2A14' }}>{t.description}</div>
                    </div>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#B8860B', whiteSpace:'nowrap', flexShrink:0 }}>+{t.reward_currency}🪙</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize:'10px', color:'#8B6A3A', marginTop:'10px', lineHeight:1.5 }}>
              💡 하루라도 건너뛰면 1일차부터 다시 시작해요. 7일차를 채우면 다음 날 다시 1일차부터!
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   WorldMap 메인
───────────────────────────────────────────── */
export default function WorldMap({ onEnterZone, onEnterMuseum, totalCount, zoneProgress = {}, balance = 0, outfitSrc, participantId = '', lockedZones = [] }) {
  const { keys, press, release } = useKeys()
  const lockedSet = useMemo(() => new Set(lockedZones), [lockedZones])

  const [pos,        setPos]        = useState({ x: PX_W/2 - CHAR_W/2, y: PX_H/2 - CHAR_H/2 })
  const [dir,        setDir]        = useState('down')
  const [moving,     setMoving]     = useState(false)
  const [nearZone,   setNearZone]   = useState(null)
  const [nearMuseum, setNearMuseum] = useState(false)
  const [questOpen,  setQuestOpen]  = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
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
      let dx = 0, dy = 0
      if (k.up)    { dy -= spd; newDir = 'up';    moved = true }
      if (k.down)  { dy += spd; newDir = 'down';  moved = true }
      if (k.left)  { dx -= spd; newDir = 'left';  moved = true }
      if (k.right) { dx += spd; newDir = 'right'; moved = true }
      const nx = Math.max(0, Math.min(PX_W - CHAR_W, x + dx))
      const ny = Math.max(0, Math.min(PX_H - CHAR_H, y + dy))
      // 축을 따로 검사 — 대각선 이동 중 한쪽 축만 길 밖으로 막혀도 다른 축은
      // 계속 진행되어(길을 따라 미끄러지듯) 자연스럽다.
      if (dx !== 0 && isWalkable(nx, y)) x = nx
      if (dy !== 0 && isWalkable(x, ny)) y = ny
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
      <HUD totalCount={totalCount} zoneProgress={zoneProgress} balance={balance}
        onOpenQuests={() => setQuestOpen(o => !o)}
        onOpenAttendance={() => setAttendanceOpen(o => !o)}/>
      {questOpen && <QuestPanel participantId={participantId} onClose={() => setQuestOpen(false)}/>}
      {attendanceOpen && <AttendancePanel participantId={participantId} onClose={() => setAttendanceOpen(false)}/>}

      <div style={{
        position:'absolute', top:`${HUD_H}px`, left:0, right:0, bottom:0,
        background: ASSET_READY.world ? GRASS_BASE : '#5A9A3A', overflow:'hidden',
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
                // Museum 마당(Public Library 건물 주변) 안쪽 길 중 돌 블롭(STONE_SET, 타원+
                // 노이즈로 들쭉날쭉하게 깎은 범위) 안에 든 것만 회색 판석으로 — 블롭 밖으로
                // 밀려난 길 타일과 그 바깥 스포크 길/다른 존 플라자는 기존 흙길 그대로.
                if (inMuseumStonePlaza(p.tx, p.ty)) {
                  // 32×32 순정 크롭(스케일=1)으로 바꿔도 초록 줄이 남아있었음 — 원인은 이
                  // 타일만의 문제가 아니라 게임 전체가 공유하는 뷰포트(VIEW_W/H → 실제 창
                  // 크기) 비정수 배율 확대 때문에 타일별 개별 <svg> 클립 경계마다 생기는
                  // 서브픽셀 틈(기존 흙길에도 옅게 있음, 실측 확인). 카메라 스케일링 자체를
                  // 고치는 건 6개 존이 공유하는 코드라 범위 밖 — 대신 돌 타일마다 1px씩
                  // 서로 살짝 겹치게 그려서(33×33로 늘리고 중심은 유지) 그 틈을 가린다.
                  const s = LIBRARY_YARD.stonePath
                  return <SheetSprite key={i} x={p.tx*TILE - 0.5} y={p.ty*TILE - 0.5} srcX={s.x} srcY={s.y} w={s.w} h={s.h} renderW={TILE+1} renderH={TILE+1} sheet={s}/>
                }
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
                  레퍼런스 이미지처럼 잔디↔길·잔디↔물 경계가 눈에 뚜렷하게 들어오게 보강.
                  Museum 마당 안 판석 구간은 흙길 오토타일이 아니라서 glow 대상에서 제외. */}
              {PATH_TILES.map((p,i) => {
                if (inMuseumStonePlaza(p.tx, p.ty)) return null
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

          {SKIRTS.map((s,i) => <PropSprite key={i} x={s.tx*TILE} y={s.ty*TILE} sprite={s.sprite} scale={1.8}/>)}
          {BUSHES.map((b,i) => <PixelBush key={i} x={b.tx*TILE} y={b.ty*TILE} sprite={b.sprite}/>)}
          {FLOWERS.map((f,i) => <PixelFlower key={i} x={f.tx*TILE} y={f.ty*TILE} sprite={f.sprite}/>)}
          {MUSHROOMS.map((m,i) => <PropSprite key={i} x={m.tx*TILE} y={m.ty*TILE} sprite={m.sprite} scale={1.8}/>)}
          {YARD_ROCKS.map((r,i) => <PropSprite key={i} x={r.tx*TILE} y={r.ty*TILE} sprite={r.sprite} scale={1.8}/>)}
          {CRYSTALS.map((c,i) => <PropSprite key={i} x={c.tx*TILE} y={c.ty*TILE} sprite={c.sprite} scale={1.8}/>)}
          {ASSET_READY.world && GRAVESTONES.map((g,i) => <GravestoneSprite key={i} x={g.tx*TILE} y={g.ty*TILE} sprite={g.sprite}/>)}
          {ASSET_READY.world && LIBRARY_FLOWERS.map((f,i) => <PixelFlower key={i} x={f.tx*TILE} y={f.ty*TILE} sprite={f.sprite}/>)}
          {ASSET_READY.world && STONE_EDGE_DECOR.map((d,i) => <PropSprite key={i} x={d.tx*TILE} y={d.ty*TILE} sprite={d.sprite} scale={1.8}/>)}
          {SILOS.map((s,i) => <PropSprite key={i} x={s.tx*TILE} y={s.ty*TILE} sprite={s.sprite} scale={1.3}/>)}
          {WINDMILL.map((w,i) => <PropSprite key={i} x={w.tx*TILE} y={w.ty*TILE} sprite={w.sprite} scale={1.15}/>)}
          {STREETLIGHTS.map((s,i) => <PropSprite key={i} x={s.tx*TILE} y={s.ty*TILE} sprite={WORLD_PROPS.streetlight} scale={1.4}/>)}
          {BENCHES.map((b,i) => <PixelBench key={i} x={b.tx*TILE} y={b.ty*TILE}/>)}
          {FENCES.map((f,i) => <PixelFence key={i} x={f.tx*TILE} y={f.ty*TILE}/>)}
          {MUSEUM_FENCE.map((f,i) => <LibraryFenceSprite key={i} x={f.tx*TILE} y={f.ty*TILE} role={f.role}/>)}
          {TREES.map((t,i) => t.sprite
            ? <PixelTree key={i} x={t.tx*TILE} y={t.ty*TILE} sprite={t.sprite}/>
            : <PixelTree key={i} x={t.tx*TILE} y={t.ty*TILE} variant={t.variant ?? i%3}/>)}
          {ASSET_READY.world && SLIMES.map((s,i) => <SlimeDeco key={i} x={s.tx*TILE} y={s.ty*TILE} slime={s.slime}/>)}

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
              <PixelChar dir={dir} moving={moving} outfitSrc={outfitSrc}/>
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
        <EnterPrompt emoji="🏛" label="도서관" color="#C8A96E"/>
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
