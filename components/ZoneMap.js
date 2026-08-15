'use client'
import { useEffect, useRef, useState, useMemo, memo } from 'react'
import { useKeys, TILE, SPEED, ZONE_META, overlaps } from '@/components/GameEngine'
import { TILES, OBJECTS, CHARACTERS, ITEMS, ASSET_READY, ZONE_GROUND_TILE, WORLD_CHARACTER, WORLD_TILESET, WORLD_ANIMALS, WORLD_FARM_BUILDINGS, WORLD_PRODUCE, WORLD_PROPS, ANIMAL_ZONE_TILESET, WORLD_NATURE, NATURE_VILLAGE_TILESET, URBAN_KENNEY_GROUND, URBAN_KENNEY_BUILDING, URBAN_KENNEY_VEHICLES, URBAN_KENNEY_TREES, URBAN_KENNEY_PROPS, URBAN_KENNEY_PEDESTRIANS, URBAN_SOUND_ICONS, HUMAN_WINTER, HUMAN_WINTER_GROUND, HUMAN_FROST_PATH } from '@/components/AssetRegistry'
import { SHEET_CODES, LAB_DUNGEON_SHEET_META, LAB_STATIC, LAB_TORCHES, LAB_TRAPS, LAB_PROPS, LAB_ANIM, LAB_FLOOR_CELLS } from '@/components/labDungeonData'

/* ─────────────────────────────────────────────
   맵 크기
───────────────────────────────────────────── */
const MAP_W   = 48          // 타일 수 (2× 확장)
const MAP_H   = 36
const PX_W    = MAP_W * TILE  // 1536
const PX_H    = MAP_H * TILE  // 1152
const VIEW_W  = 24 * TILE     // 768 — 화면에 보이는 뷰포트
const VIEW_H  = 18 * TILE     // 576
// CHAR_W/H는 이동·아이템 충돌 판정에 쓰는 히트박스 크기 — 기존 튜닝 그대로 유지.
// SPRITE_W/H는 WorldMap과 동일한 캐릭터 스프라이트를 그릴 화면 표시 크기(히트박스보다
// 큼)로, 히트박스 발치에 스프라이트 발이 오도록 오프셋을 줘서 그린다.
const CHAR_W  = 22
const CHAR_H  = 28
const SPRITE_W = 72
const SPRITE_H = 88
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
    // "사람 마을" Winter 리스킨 — Cozy Town+Winter Things 서리(frost) 톤으로 교체
    // (기존 흙색 팔레트는 여름 버전 스텁이었음). ground는 HUMAN_WINTER_GROUND와
    // 동일 계열(terrain-town.png 서리 블롭 실측 색상 #9CBDC1)로 맞춰 바닥 패턴과
    // SVG 배경 rect가 이어붙는 경계에서 색 차이가 안 보이게 한다.
    ground: '#9CBDC1', groundDark: '#87A8AC', path: '#E4EEF0',
    border: '#5A7A80', water: null,
    sky: 'linear-gradient(180deg, #C8E0E8 0%, #EAF4F6 100%)',
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

// Nature Zone 바닥 전용 — Animal Zone과 같은 초록 잔디를 재사용하고 있어서 두 존 배경이
// 똑같다는 지적으로 분리(사용자 확정). fishing_full/Tiles/tiles_all.png 맨 앞 헤지(덤불)
// 블롭 정중앙 안쪽(x=9,y=12,w=28,h=24, 전체 균일 RGB(94,137,65) 확인됨, 4×4 반복 무결점)의
// 올리브그린 색값을 solid fill로 씀 — 첫 시도 때 옆의 모래색 조각을 잘못 골랐던 걸 정정.
const NATURE_KHAKI_GROUND = '#5E8941'

/* ─────────────────────────────────────────────
   Zone별 소리 아이템 심볼 + 색상
───────────────────────────────────────────── */
const SOUND_ITEMS = {
  // Animal만 itemBorder를 흰색으로 바꿈(사용자 확정) — 후광/파티클 색으로만 쓰이고
  // (사각 배지를 없애서 itemBg는 더 이상 안 씀), 펜 위 farmIcon 장식(흰 원형 말풍선,
  // 파랑 없음)과는 은은한 흰 글로우 vs 정적 불투명 배지로 여전히 구별된다.
  Animal: { symbols: ['🐦','🐾','🦋','🐸','🐝'], itemBg: '#0E2A3A', itemBorder: '#FFFFFF' },
  Human:  { symbols: ['👣','👏','💨','😄','🤲'], itemBg: '#3A2A1A', itemBorder: '#E8A04A' },
  // itemBorder를 흰색으로(사용자 확정, Animal과 동일) — 장미 아이템의 drop-shadow
  // glow/파티클 색으로만 쓰임(SoundItem의 hasProduce 분기), itemBg는 안 씀.
  Nature: { symbols: ['💧','🌊','⛈','💨','🔥'], itemBg: '#0E2A4A', itemBorder: '#FFFFFF' },
  Urban:  { symbols: ['🚗','🔔','🚨','⚙','🏗'], itemBg: '#2A2820', itemBorder: '#C4B99A' },
  Music:  { symbols: ['🎵','♩','♪','♫','🎶'],   itemBg: '#1A1238', itemBorder: '#9B6DD4' },
  Lab:    { symbols: ['✦','❓','◈','⚡','🌀'],   itemBg: '#1A0A38', itemBorder: '#D4883A' },
}

// Animal/Nature Zone 소리 아이템 전용 — 반짝이는 보석상자/이모지 대신 Cozy Farm 팩의 실제
// 아이템 아이콘을 씀(WORLD_PRODUCE, farm_items.png). Animal은 우유병+흰 계란(갈색 계란은
// 사용자 확정으로 제외), Nature는 장미 6종(빨강/주황/노랑/분홍/보라/파랑, items.png row 8).
// item.pulse(스폰 시 이미 배정된 랜덤값, 0~2π)로 풀 안에서 섞어 고르므로 spawnSoundItems
// 자체는 손대지 않는다.
const ZONE_PRODUCE_SPRITES = {
  Animal: [WORLD_PRODUCE.cowMilk, WORLD_PRODUCE.whiteEgg],
  Nature: [WORLD_PRODUCE.roseRed, WORLD_PRODUCE.roseOrange, WORLD_PRODUCE.roseYellow,
           WORLD_PRODUCE.rosePink, WORLD_PRODUCE.rosePurple, WORLD_PRODUCE.roseBlue],
  // Urban 소리 아이템 — SVG 보석상자 도형 폴백 대신 winter 팩 진저브레드맨/하트 쿠키
  // 아이콘을 쓴다(사용자 요청, "도형으로 되어있는 걸 아이콘으로 교체").
  Urban: URBAN_SOUND_ICONS,
}
function zoneProduceSprite(zone, item) {
  const pool = ZONE_PRODUCE_SPRITES[zone]
  const idx = Math.floor((item.pulse / (Math.PI * 2)) * pool.length) % pool.length
  return pool[idx]
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
   Animal Zone 전용 — 마당/목초지의 사각형 영역(동물·소품 배치용 bounds +
   interiorTiles)만 계산한다. 울타리는 여기서 만들지 않는다 — 4변을 전부
   두르면 레퍼런스(Cozy Farm 프로모 아트)의 "건물 정면을 가로지르는 하나의
   연속된 선" 느낌이 아니라 상자처럼 보이기 때문에, 울타리는 아래
   buildYardFence()로 별도 생성한다.
───────────────────────────────────────────── */
function createYard(originX, originY, width, height) {
  const x0 = originX, y0 = originY, x1 = originX + width - 1, y1 = originY + height - 1
  const interiorTiles = []
  for (let ty = y0 + 1; ty < y1; ty++)
    for (let tx = x0 + 1; tx < x1; tx++)
      interiorTiles.push({ tx, ty })
  return { bounds: { x: x0, y: y0, w: width, h: height }, interiorTiles }
}

// 두 사각형이 buffer칸 이내로 붙어있으면 true (buffer=0이면 순수 겹침 검사)
function boundsTooClose(a, b, buffer) {
  const ax0 = a.x - buffer, ax1 = a.x + a.w - 1 + buffer
  const ay0 = a.y - buffer, ay1 = a.y + a.h - 1 + buffer
  const bx0 = b.x, bx1 = b.x + b.w - 1, by0 = b.y, by1 = b.y + b.h - 1
  return !(ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0)
}
function boundsOverlap(a, b) { return boundsTooClose(a, b, 0) }
function tileInBounds(t, b) { return t.tx >= b.x && t.tx <= b.x + b.w - 1 && t.ty >= b.y && t.ty <= b.y + b.h - 1 }

/* ─────────────────────────────────────────────
   울타리는 반드시 이 함수로만 만든다. /fence-test 격리 테스트에서 확정한
   3원칙을 그대로 적용:
     1) 직선 구간 — 가로는 rail(가로 레일) 반복, 세로는 post(기둥) 반복.
        세로를 rail 회전으로 만들지 않는다(회전시키면 레일이 타일 중심
        기준 비대칭이라 어긋난다는 게 테스트로 증명됨).
     2) 코너(꺾이는 지점) — 전용 코너 스프라이트 없이 기둥(post) 하나로 처리.
     3) 게이트 — 스프라이트 없이 완전히 빈 칸(어떤 소품도 놓지 않음).
   "정면 변(gateSide)을 따라가다가 양 끝에서 코너를 꺾어 인접 변으로
   wingLen칸 이어 붙인, 하나로 연결된 경계선"을 만든다 — 실제로 감싸는
   대상(마당)의 진짜 둘레를 따라가는 좌표만 쓴다는 원칙은 그대로 유지.
   endAnchors(양 끝이 맞닿을 나무/바위 좌표)는 null 금지.
───────────────────────────────────────────── */
function buildYardFence(bounds, gateSide, gateAt, gateLen, wingLen, endAnchors) {
  if (!endAnchors || endAnchors[0] == null || endAnchors[1] == null) {
    throw new Error('buildYardFence: endAnchors는 null일 수 없음 (허공에서 끝나는 울타리 금지)')
  }
  const { x, y, w, h } = bounds
  const x0 = x, x1 = x + w - 1, y0 = y, y1 = y + h - 1
  const horizontal = gateSide === 'n' || gateSide === 's'
  const mainY = gateSide === 'n' ? y0 : gateSide === 's' ? y1 : null
  const mainX = gateSide === 'w' ? x0 : gateSide === 'e' ? x1 : null
  const inward = gateSide === 's' ? -1 : gateSide === 'n' ? 1 : gateSide === 'w' ? 1 : -1

  const path = [] // 순서대로 이어진 하나의 경계선: 날개1(먼 쪽→코너) + 정면 + 날개2(코너→먼 쪽)
  if (horizontal) {
    for (let i = wingLen; i >= 1; i--) path.push({ tx: x0, ty: mainY + inward * i, role: 'post' })
    for (let tx = x0; tx <= x1; tx++) {
      const gate = tx >= gateAt && tx < gateAt + gateLen
      const pivot = tx === x0 || tx === x1
      path.push({ tx, ty: mainY, role: pivot ? 'post' : 'rail', gate })
    }
    for (let i = 1; i <= wingLen; i++) path.push({ tx: x1, ty: mainY + inward * i, role: 'post' })
  } else {
    for (let i = wingLen; i >= 1; i--) path.push({ tx: mainX + inward * i, ty: y0, role: 'rail' })
    for (let ty = y0; ty <= y1; ty++) {
      const gate = ty >= gateAt && ty < gateAt + gateLen
      path.push({ tx: mainX, ty, role: 'post', gate }) // 세로 라인은 코너까지 전부 post
    }
    for (let i = 1; i <= wingLen; i++) path.push({ tx: mainX + inward * i, ty: y1, role: 'rail' })
  }

  return {
    fenceTiles: path.filter(t => !t.gate),
    gates: path.filter(t => t.gate),
    startAnchor: endAnchors[0],
    endAnchor: endAnchors[1],
  }
}

// fenceTiles는 buildYardFence 내부의 원래 이어진 경로(path)에서 게이트 칸만 제거한
// 배열이라 순서가 그대로 보존된다 — 연속된 두 원소가 체비셰프 거리 1 이내가 아니면
// 그 사이가 게이트로 끊긴 자리다. 셀프체크 1번("하나의 선")이 이 개수로 검증된다.
function countFenceSegments(fenceTiles) {
  if (fenceTiles.length === 0) return 0
  let segs = 1
  for (let i = 1; i < fenceTiles.length; i++) {
    const a = fenceTiles[i - 1], b = fenceTiles[i]
    if (Math.abs(a.tx - b.tx) > 1 || Math.abs(a.ty - b.ty) > 1) segs++
  }
  return segs
}

// 펜 하나를 실제 오브젝트로 채운다. 동물/기능/감성 오브젝트 좌표는 전부
// 이 마당의 interiorTiles 목록에 실제로 존재하는지 확인(assert)한 뒤에만 그린다.
// 생산물 아이콘은 penId가 있을 때만, 펜당 1개만, bounds 중앙 상단 고정 위치에 그린다.
function fillPen(objs, yard, fence, penId, { animals, propTile, propProduce, decorTile, decorType = 'flower', decorVariant = 0, iconName }, report) {
  const interiorSet = new Set(yard.interiorTiles.map(t => `${t.tx},${t.ty}`))
  const assertInterior = (t, label) => {
    if (!interiorSet.has(`${t.tx},${t.ty}`)) {
      report.errors.push(`INTERIOR-FAIL[${penId}] ${label} (${t.tx},${t.ty}) not in interiorTiles`)
    }
  }

  // 울타리 단조로움 개선: 정면 직선 구간 중 게이트/코너에서 먼 한 칸만 수풀로
  // 살짝 대체(코너 post와 게이트 주변은 또렷하게 유지).
  const railTiles = fence.fenceTiles.filter(t => t.role === 'rail')
  const bushTarget = railTiles.length >= 4 ? railTiles[Math.floor(railTiles.length / 2)] : null
  fence.fenceTiles.forEach(t => {
    if (bushTarget && t.tx === bushTarget.tx && t.ty === bushTarget.ty) {
      objs.push({ type: 'bush', tx: t.tx, ty: t.ty, penId, variant: (t.tx + t.ty) % 2 })
    } else {
      objs.push({ type: 'farmFence', tx: t.tx, ty: t.ty, role: t.role, penId })
    }
  })

  animals.forEach(a => {
    assertInterior(a, `animal:${a.species}`)
    objs.push({ type: 'farmAnimal', tx: a.tx, ty: a.ty, species: a.species, penId })
  })
  assertInterior(propTile, `prop:${propProduce}`)
  objs.push({ type: 'farmProp', tx: propTile.tx, ty: propTile.ty, produce: propProduce, penId })
  assertInterior(decorTile, `decor:${decorType}`)
  objs.push({ type: decorType, tx: decorTile.tx, ty: decorTile.ty, variant: decorVariant, penId })

  if (iconName) {
    report.iconCount++
    const cx = yard.bounds.x + Math.floor((yard.bounds.w - 1) / 2)
    objs.push({ type: 'farmIcon', tx: cx, ty: yard.bounds.y, produce: iconName, penId })
  }
}

/* ─────────────────────────────────────────────
   Animal Zone 전체 배치 — 마당 5개(createYard) + 울타리(buildYardFence,
   정면 한 변만) 산출물만 사용, 배치 후 셀프체크(펜 규칙 4개 + 울타리 스타일
   4개 + 구역도형 제거 + 경계선 gap)을 코드로 검증해
   console에 결과를 남긴다.
───────────────────────────────────────────── */
function buildAnimalZone(objs) {
  const report = { errors: [], iconCount: 0 }

  const yardDefs = [
    { id: 'coopBirds', yard: createYard(11, 6,  8, 7), gateSide:'s', gateAt:14 },  // x11-18, y6-12
    { id: 'bunny',     yard: createYard(21, 6,  6, 6), gateSide:'s', gateAt:23 },  // x21-26, y6-11
    { id: 'cow',       yard: createYard(29, 11, 10, 9), gateSide:'n', gateAt:32 }, // x29-38, y11-19
    { id: 'sheepGoat', yard: createYard(29, 22, 10, 9), gateSide:'n', gateAt:32 }, // x29-38, y22-30
    { id: 'pig',       yard: createYard(41, 11, 6, 6),  gateSide:'w', gateAt:13 }, // x41-46, y11-16
  ]

  // 각 마당의 "정면 한 변"(gateSide)만 buildYardFence로 울타리를 만든다 —
  // 그 변의 실제 둘레 좌표 + 양 끝 코너에서 꺾인 wingLen칸짜리 날개만 사용.
  // 양 끝은 반드시 나무/바위 무리(anchor)에 닿게 하고, 그 anchor 오브젝트를
  // 실제로 그 좌표에 심는다(허공에서 끝나는 울타리 금지).
  const fenceDefs = {
    coopBirds: { gateLen:2, anchors: [{ tx:10, ty:12, kind:'tree' }, { tx:19, ty:12, kind:'tree' }] },
    bunny:     { gateLen:2, anchors: [{ tx:20, ty:11, kind:'rock' }, { tx:27, ty:11, kind:'tree' }] },
    cow:       { gateLen:2, anchors: [{ tx:28, ty:11, kind:'tree' }, { tx:39, ty:11, kind:'rock' }] },
    sheepGoat: { gateLen:2, anchors: [{ tx:28, ty:22, kind:'rock' }, { tx:39, ty:22, kind:'tree' }] },
    pig:       { gateLen:2, anchors: [{ tx:41, ty:10, kind:'tree' }, { tx:41, ty:17, kind:'rock' }] },
  }

  const WING_LEN = 2
  const yards = {}, fences = {}
  for (const { id, yard, gateSide, gateAt } of yardDefs) {
    yards[id] = yard
    const { gateLen, anchors } = fenceDefs[id]
    fences[id] = buildYardFence(yard.bounds, gateSide, gateAt, gateLen, WING_LEN, anchors)
  }

  // 셀프체크(펜 규칙) — 서로 다른 두 마당의 bounds가 겹치는가 (최소 2칸 간격도 확인)
  for (let i = 0; i < yardDefs.length; i++) {
    for (let j = i + 1; j < yardDefs.length; j++) {
      const [a, b] = [yardDefs[i], yardDefs[j]]
      if (boundsOverlap(a.yard.bounds, b.yard.bounds)) {
        report.errors.push(`OVERLAP: ${a.id} × ${b.id}`)
      } else if (boundsTooClose(a.yard.bounds, b.yard.bounds, 2)) {
        report.errors.push(`TOO-CLOSE(<2): ${a.id} × ${b.id}`)
      }
    }
  }

  // anchor 오브젝트를 실제로 심는다 — 나무는 전부 걷어내는 중이라(세팅 재설계 예정)
  // kind와 무관하게 바위+수풀 무리로 통일해서 "허공에서 끝나는 울타리" 없음만 유지한다.
  const plantAnchor = (a) => {
    objs.push({ type:'rock', tx:a.tx, ty:a.ty, variant:0 })
    objs.push({ type:'bush', tx:a.tx, ty:a.ty + (a.ty < 20 ? -1 : 1), variant:1 })
  }
  Object.values(fenceDefs).forEach(d => d.anchors.forEach(plantAnchor))

  // ── Coop 구역 — 건물이 penCoopBirds와 2칸 이내로 인접 ──
  objs.push({ type:'coopBuilding', tx:13, ty:2 })
  objs.push({ type:'farmSign', tx:12, ty:5, label:'🐔 Coop' })
  fillPen(objs, yards.coopBirds, fences.coopBirds, 'coopBirds', {
    animals: [
      { tx:13, ty:8,  species:'chicken' },
      { tx:16, ty:9,  species:'chicken_brown' },
      { tx:14, ty:10, species:'turkey' },
    ],
    propTile: { tx:12, ty:7 }, propProduce: 'wheat',
    decorTile: { tx:17, ty:10 }, decorType:'flower', decorVariant:0,
    iconName: 'whiteEgg',
  }, report)
  fillPen(objs, yards.bunny, fences.bunny, 'bunny', {
    animals: [
      { tx:22, ty:8, species:'bunny' },
      { tx:24, ty:9, species:'bunny_grey' },
    ],
    propTile: { tx:23, ty:7 }, propProduce: 'wheat',
    decorTile: { tx:25, ty:10 }, decorType:'rock', decorVariant:1,
    iconName: 'whiteWool',
  }, report)

  // ── Barn 구역 — 건물이 penCow와 변을 사실상 공유(1칸 간격), Silo/Mill은 반경 10칸 이내 ──
  objs.push({ type:'barnBuilding', tx:31, ty:7 })
  objs.push({ type:'farmSign', tx:30, ty:10 - 1, label:'🐄 Barn' })
  objs.push({ type:'silo', tx:36, ty:8 })
  objs.push({ type:'windmill', tx:39, ty:5 })
  objs.push({ type:'chest', tx:39, ty:18 })
  fillPen(objs, yards.cow, fences.cow, 'cow', {
    animals: [
      { tx:31, ty:13, species:'cow' },
      { tx:34, ty:15, species:'cow_black' },
      { tx:33, ty:17, species:'cow_brown' },
    ],
    propTile: { tx:30, ty:18 }, propProduce: 'hay',
    decorTile: { tx:36, ty:17 }, decorType:'flower', decorVariant:2,
    iconName: 'cowMilk',
  }, report)
  fillPen(objs, yards.sheepGoat, fences.sheepGoat, 'sheepGoat', {
    animals: [
      { tx:31, ty:23, species:'sheep' },
      { tx:34, ty:25, species:'goat' },
      { tx:33, ty:27, species:'goat_stripe' },
    ],
    propTile: { tx:30, ty:28 }, propProduce: 'hay',
    decorTile: { tx:36, ty:27 }, decorType:'rock', decorVariant:0,
    iconName: 'goatMilk',
  }, report)
  fillPen(objs, yards.pig, fences.pig, 'pig', {
    animals: [
      { tx:42, ty:13, species:'pig' },
      { tx:44, ty:14, species:'pig_stripe' },
    ],
    propTile: { tx:43, ty:12 }, propProduce: 'hay',
    decorTile: { tx:45, ty:15 }, decorType:'flower', decorVariant:3,
    iconName: 'bacon',
  }, report)

  // 셀프체크(펜 규칙) — 생산물 아이콘 개수 ≤ 펜 개수
  if (report.iconCount > yardDefs.length) {
    report.errors.push(`ICON-COUNT: ${report.iconCount} icons > ${yardDefs.length} pens`)
  }
  // 셀프체크(펜 규칙) — 모든 동물이 정확히 하나의 마당 bounds 안에 있는가
  const animalObjs = objs.filter(o => o.type === 'farmAnimal')
  animalObjs.forEach(a => {
    const owners = yardDefs.filter(({ yard }) => tileInBounds(a, yard.bounds))
    if (owners.length !== 1) {
      report.errors.push(`ANIMAL-OWNER-FAIL (${a.tx},${a.ty}) matched ${owners.length} pens`)
    }
  })

  // ── 이번 지시서(울타리 스타일)의 셀프체크 4항목 ──
  for (const { id, yard } of yardDefs) {
    const fence = fences[id]

    // 1. 하나의 연속된 선으로 읽히는가 (gate 하나당 세그먼트 2개가 정상, 그 이상이면 실패) —
    // buildYardFence가 만든 fenceTiles는 게이트 자리만 비운 하나의 이어진 경로이므로,
    // 배열 순서상 인접(체비셰프 거리 1)하지 않은 지점이 곧 게이트로 끊긴 자리다.
    const segs = countFenceSegments(fence.fenceTiles)
    if (segs !== 2) {
      report.errors.push(`FENCE-NOT-ONE-LINE[${id}] segments=${segs} (expected 2 — gate 1곳당 앞/뒤 2조각)`)
    }
    // 2. 양 끝이 anchor(마당 bounds 바깥의 실제 오브젝트)에 맞닿아 있는가
    ;[fence.startAnchor, fence.endAnchor].forEach((a, k) => {
      if (a == null) report.errors.push(`FENCE-NO-ANCHOR[${id}] end${k}`)
      else if (tileInBounds(a, yard.bounds)) report.errors.push(`FENCE-ANCHOR-INSIDE-YARD[${id}] end${k}`)
    })
    // 3. 게이트가 실제 출입 동선(ANIMAL_PATH_WAYPOINTS) 근처인가
    const gateTile = fence.gates[0]
    const nearPath = ANIMAL_PATH_WAYPOINTS.some(w => Math.hypot(w.tx - gateTile.tx, w.ty - gateTile.ty) <= 4)
    if (!nearPath) report.errors.push(`GATE-NOT-ON-PATH[${id}] (${gateTile.tx},${gateTile.ty})`)
    // 4. 이 경계선이 실제로 감싸는 대상(마당)이 존재하는가 — interiorTiles가 있고 그 안에 동물이 있는가
    const hasAnimalsInside = animalObjs.some(a => tileInBounds(a, yard.bounds))
    if (yard.interiorTiles.length === 0 || !hasAnimalsInside) {
      report.errors.push(`FENCE-ENCLOSES-NOTHING[${id}]`)
    }
  }

  // ── Coop 구역 ↔ Barn 구역 경계선 — 예전엔 나무 패치 줄로 표현했는데, 나무를
  // 전부 걷어내는 중이라(세팅 재설계 예정) 지금은 아무 경계 표시도 없다.
  // 재설계할 때 여기에 다시 채워 넣을 것.

  // 셀프체크(펜 규칙) — 구역 경계용 색상/도형 블록이 코드에 남아있는가
  const BANNED_ZONE_SHAPE_TYPES = ['zoneBlock', 'regionRect', 'areaFill', 'zoneDivider']
  const bannedFound = objs.filter(o => BANNED_ZONE_SHAPE_TYPES.includes(o.type))
  if (bannedFound.length > 0) {
    report.errors.push(`ZONE-SHAPE-LEFTOVER: ${bannedFound.length}개 (${BANNED_ZONE_SHAPE_TYPES.join(',')} 금지)`)
  }

  const ok = report.errors.length === 0
  console.log(
    `[AnimalZone 셀프체크] 마당 ${yardDefs.length}개, 동물 ${animalObjs.length}마리, 아이콘 ${report.iconCount}개 → ` +
    (ok
      ? 'PASS (겹침 없음 / 울타리 하나의 선 / 양끝 anchor / 게이트가 동선과 일치 / 마당 실존 / 아이콘≤펜수 / 구역도형 없음)'
      : `FAIL:\n  ${report.errors.join('\n  ')}`)
  )

  // ── 밭 경계의 허수아비 — 어느 펜에도 속하지 않는 남쪽 공터에만 배치 ──
  objs.push({ type:'scarecrow', tx:8, ty:31 })
  ;[{tx:6,ty:32},{tx:10,ty:32},{tx:8,ty:33}].forEach(p =>
    objs.push({ type:'farmProp', tx:p.tx, ty:p.ty, produce:'wheat', small:true }))

  // ── Greenhouse — Coop/Barn과 떨어뜨려 별도 존으로 ──
  objs.push({ type:'greenhouse', tx:3, ty:3 })

  // 길 옆 나무 배치(plantPathTrees)는 세팅 재설계 예정이라 뺐다 — 다시 넣을 때 참고.
  const allBounds = yardDefs.map(d => d.yard.bounds)

  // ── 잔디 detail(새싹 7종) 무작위 산개 — 펜 내부/건물 위나 길 근처에는 놓지
  //    않는다(길가에 흩뿌리면 다른 존의 깔끔한 길과 달리 노이즈처럼 보인다는
  //    피드백을 받아 제외).
  const insideAnyPen = (tx, ty) => allBounds.some(b => tx >= b.x && tx <= b.x + b.w - 1 && ty >= b.y && ty <= b.y + b.h - 1)
  let seed = 1337
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  let placed = 0, attempts = 0
  while (placed < 70 && attempts < 400) {
    attempts++
    const tx = 2 + Math.floor(rand() * (MAP_W - 4))
    const ty = 2 + Math.floor(rand() * (MAP_H - 4))
    if (insideAnyPen(tx, ty) || isNearAnimalPath(tx, ty)) continue
    objs.push({ type:'grassDetail', tx, ty, variant: placed % 7 })
    placed++
  }
}

/* ─────────────────────────────────────────────
   Nature Zone("자연 마을") — 집 5채짜리 마을. buildAnimalZone()과 같은 손좌표
   패턴이되, 소리 수집 로직(spawnSoundItems/SOUND_ITEMS 등)은 전혀 건드리지 않고
   시각 요소(objs 배열 + NaturePath/NatureWater)만 담당한다.
   좌표는 이 프로젝트와 별개로 먼저 검증했던 Tiled 프로토타입(48×36, 이 zone map과
   정확히 같은 그리드)에서 그대로 옮겨왔다 — 마당끼리 전부 5타일 이상 떨어지도록
   무작위 탐색으로 확정한 값(재배치 전엔 오두막↔빅토리안이 거의 붙어있었음).
───────────────────────────────────────────── */
const NATURE_YARD = 3
const NATURE_HOUSES = [
  { key:'cream',     tx:6,  ty:6,  tileW:4, tileH:5, gate:'E', open:'W' },
  { key:'dark',      tx:20, ty:7,  tileW:5, tileH:6, gate:'S', open:'N' },
  { key:'green',     tx:35, ty:6,  tileW:7, tileH:6, gate:'N', open:'S' },
  { key:'victorian', tx:19, ty:23, tileW:6, tileH:5, gate:'S', open:'N' },
  { key:'cabin',     tx:36, ty:24, tileW:6, tileH:6, gate:'N', open:'S' },
]

function natureYardRect(h) {
  return {
    x0: h.tx - NATURE_YARD, y0: h.ty - NATURE_YARD,
    x1: h.tx + h.tileW + NATURE_YARD - 1, y1: h.ty + h.tileH + NATURE_YARD - 1,
  }
}
function insideAnyNatureYard(tx, ty) {
  return NATURE_HOUSES.some(h => {
    const r = natureYardRect(h)
    return tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1
  })
}

// 마당 한 면(gate)엔 게이트, 그 반대편(open)은 아예 안 막고, 나머지 두 면만 나무
// 펜스로 막는다 — "완전히 막지 않고 1~2면은 열어둔다"는 요청 그대로.
function buildNatureFence(objs, h) {
  const r = natureYardRect(h)
  const sides = ['N', 'S', 'E', 'W'].filter(s => s !== h.open)
  for (const side of sides) {
    const mode = side === h.gate ? 'gate' : 'solid'
    if (side === 'N' || side === 'S') {
      const y = side === 'N' ? r.y0 : r.y1
      const xs = []
      for (let x = r.x0; x <= r.x1; x += 2) xs.push(x)
      const mid = xs[Math.floor(xs.length / 2)]
      for (const x of xs) {
        if (x === r.x0 || x === r.x1) objs.push({ type:'natureFenceCorner', tx:x, ty:y })
        else if (mode === 'gate' && x === mid) objs.push({ type:'natureFenceGate', tx:x, ty:y, axis:'h' })
        else objs.push({ type:'natureFenceRail', tx:x, ty:y })
      }
    } else {
      const x = side === 'W' ? r.x0 : r.x1
      const ys = []
      for (let y = r.y0; y <= r.y1; y += 2) ys.push(y)
      const mid = ys[Math.floor(ys.length / 2)]
      for (const y of ys) {
        if (y === r.y0 || y === r.y1) objs.push({ type:'natureFenceCorner', tx:x, ty:y })
        else if (mode === 'gate' && y === mid) objs.push({ type:'natureFenceGate', tx:x, ty:y, axis:'v' })
        else objs.push({ type:'natureFencePost', tx:x, ty:y })
      }
    }
  }
}

function buildNatureZone(objs) {
  const report = { errors: [] }

  // 집 + 마당 펜스
  for (const h of NATURE_HOUSES) {
    objs.push({ type:'natureHouse', tx:h.tx, ty:h.ty, key:h.key, tileW:h.tileW, tileH:h.tileH })
    buildNatureFence(objs, h)
  }

  // 셀프체크 — 마당끼리 최소 5타일 간격(재배치 이유가 된 그 버그가 다시 생기면 콘솔에 뜬다)
  for (let i = 0; i < NATURE_HOUSES.length; i++) {
    for (let j = i + 1; j < NATURE_HOUSES.length; j++) {
      const a = natureYardRect(NATURE_HOUSES[i]), b = natureYardRect(NATURE_HOUSES[j])
      const xGap = Math.max(b.x0 - a.x1, a.x0 - b.x1, 0)
      const yGap = Math.max(b.y0 - a.y1, a.y0 - b.y1, 0)
      const gap = (xGap === 0 || yGap === 0) ? Math.max(xGap, yGap) : Math.hypot(xGap, yGap)
      if (gap < 5) report.errors.push(`YARD-TOO-CLOSE[${NATURE_HOUSES[i].key}<->${NATURE_HOUSES[j].key}] gap=${gap.toFixed(1)}`)
    }
  }

  // 다리 — 연못을 가로지르는 서쪽 진입로 끝(35,17)에서 동쪽 출구(38,20)까지 난간 3칸
  objs.push({ type:'natureBridge', tx:35, ty:17 })

  // 벤치 2개 — 길가 쉼터, 낮은 밀도
  objs.push({ type:'natureBench', tx:24, ty:20 })
  objs.push({ type:'natureBench', tx:24, ty:30 })

  // 나무 재배치(조경 디자인 원칙 적용, 사용자 확정) — 기존엔 테두리 70%/마당 근처 40%/
  // 그 외 22% 균일 확률로 타일마다 독립적으로 흩뿌려서(243그루) 시각적으로 혼란스럽고
  // 개수도 부담스럽다는 피드백. "나무를 줄이면서 오히려 더 의도된 느낌"을 목표로 4원칙
  // 적용:
  //   1) 군집 배치 — 후보 지점을 먼저 "클러스터 중심"으로 골라 그 주변 반경 2.4칸 안에
  //      3~7그루를 흩뿌림(균일 타일 스캔 폐기) → 클러스터 사이는 자연히 빈 잔디로 남음
  //   2) 테두리-내부 밀도 차등 — 클러스터 중심 시드 확률을 테두리(맵 경계 4칸 이내)
  //      70% > 중간(9칸 이내) 32% > 내부 14% 순으로 둬서, 숲 경계는 여전히 빽빽하고
  //      안쪽은 트인 느낌
  //   3) 시야 회랑 — insideAnyNatureYard/isNearNaturePath(둘 다 spawnSoundItems와 공유하는
  //      함수라 무수정)를 그대로 재사용하되, 나무 전용으로 isNearNaturePath에 더 넓은
  //      반경(2.6, 아이템용 기본 1.6보다 넓음)을 넘겨서 길에서 집이 확실히 보이게 함 —
  //      마당 자체는 이미 insideAnyNatureYard가 전체를 막아주므로 정문 앞은 자동으로 빈다
  //   4) 클러스터 내부 크기 변주 — 22%는 크게(scale×1.25), 18%는 작게(scale×0.78), 나머지는
  //      기본 크기(1.5배, 지난 요청으로 이미 적용됨) — ZoneObject의 natureTree 렌더러에서
  //      obj.big/obj.small로 처리
  // "저주받은나무·고사목"(WORLD_NATURE.trees 인덱스 8,9)은 여전히 제외.
  let seed = 4242
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const TREE_CLUSTER_CELL = 3
  const TREE_PATH_RADIUS  = 2.6
  const borderness = (tx, ty) => Math.min(tx, ty, MAP_W - 1 - tx, MAP_H - 1 - ty)
  const treeBlocked = (tx, ty) =>
    !inBounds(tx, ty) || insideAnyNatureYard(tx, ty) || isNearNaturePath(tx, ty, TREE_PATH_RADIUS)

  const treeClusters = []
  for (let gy = 2; gy < MAP_H - 2; gy += TREE_CLUSTER_CELL) {
    for (let gx = 2; gx < MAP_W - 2; gx += TREE_CLUSTER_CELL) {
      const jx = gx + Math.floor((rand() - 0.5) * TREE_CLUSTER_CELL * 0.8)
      const jy = gy + Math.floor((rand() - 0.5) * TREE_CLUSTER_CELL * 0.8)
      const b = borderness(jx, jy)
      const seedP = b <= 4 ? 0.70 : b <= 9 ? 0.32 : 0.14
      if (rand() < seedP && !treeBlocked(jx, jy)) treeClusters.push({ cx: jx, cy: jy })
    }
  }

  const treeTiles = new Set()
  let treeCount = 0
  for (const c of treeClusters) {
    const n = 3 + Math.floor(rand() * 5) // 3~7그루
    let got = 0, tries = 0
    while (got < n && tries < n * 6) {
      tries++
      const ang = rand() * Math.PI * 2
      const rad = 0.5 + rand() * 2.4
      const tx = Math.round(c.cx + Math.cos(ang) * rad)
      const ty = Math.round(c.cy + Math.sin(ang) * rad)
      if (treeBlocked(tx, ty)) continue
      const k = `${tx},${ty}`
      if (treeTiles.has(k)) continue
      treeTiles.add(k)
      const variant = Math.floor(rand() * 8) // 0-7만 사용(8,9 제외)
      const sizeRoll = rand()
      const big = sizeRoll < 0.22
      const small = !big && sizeRoll > 0.82
      objs.push({ type:'natureTree', tx, ty, variant, big, small })
      treeCount++
      got++
    }
  }
  // 시야 회랑 셀프체크 — treeBlocked()로 걸러가며 심었으니 원칙상 0건이어야 하지만,
  // YARD-TOO-CLOSE와 같은 방식으로 실제로 재검증해서 콘솔에 남긴다.
  const sightlineViolations = objs.filter(o => o.type === 'natureTree' && treeBlocked(o.tx, o.ty)).length

  // 덤불/꽃/버섯 — 길가·나무 밑 군집(균일 격자 금지)
  const clusterCenters = []
  for (const o of objs) {
    if (o.type === 'natureTree' && rand() < 0.16) clusterCenters.push({ tx:o.tx, ty:o.ty })
  }
  for (const seg of NATURE_PATH_SEGMENTS) {
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i], b = seg[i + 1]
      const steps = Math.max(1, Math.round(Math.hypot(b.tx - a.tx, b.ty - a.ty) / 3))
      for (let s = 0; s <= steps; s++) {
        if (rand() < 0.35) {
          clusterCenters.push({ tx: Math.round(a.tx + (b.tx - a.tx) * s / steps), ty: Math.round(a.ty + (b.ty - a.ty) * s / steps) })
        }
      }
    }
  }
  const decorTypes = ['natureBush', 'natureFlower', 'natureMushroom']
  for (const c of clusterCenters) {
    const decorType = decorTypes[Math.floor(rand() * 3)]
    const n = 2 + Math.floor(rand() * 4)
    for (let k = 0; k < n; k++) {
      const tx = c.tx + Math.floor(rand() * 5) - 2, ty = c.ty + Math.floor(rand() * 5) - 2
      if (!inBounds(tx, ty) || insideAnyNatureYard(tx, ty) || isNearNaturePath(tx, ty)) continue
      objs.push({ type: decorType, tx, ty, variant: Math.floor(rand() * 10) })
    }
  }

  // 바위 — 연못 가장자리 / 길 모서리 / 다리 접합부
  const ringPts = 18
  for (let i = 0; i < ringPts; i++) {
    const a = (i / ringPts) * Math.PI * 2
    const tx = Math.round(NATURE_POND_C.tx + Math.cos(a) * (NATURE_POND_R.rx + 1))
    const ty = Math.round(NATURE_POND_C.ty + Math.sin(a) * (NATURE_POND_R.ry + 1))
    if (rand() < 0.55 && inBounds(tx, ty) && !insideAnyNatureYard(tx, ty)) {
      objs.push({ type:'natureRock', tx, ty, variant: Math.floor(rand() * 10) })
    }
  }
  const cornerPts = NATURE_PATH_SEGMENTS.flatMap(seg => seg.slice(1, -1))
  for (const p of cornerPts) {
    for (const [dx, dy] of [[2,0],[-2,2],[0,-2],[-2,-2]]) {
      const tx = p.tx + dx, ty = p.ty + dy
      if (inBounds(tx, ty) && !insideAnyNatureYard(tx, ty) && rand() < 0.5) {
        objs.push({ type:'natureRock', tx, ty, variant: Math.floor(rand() * 10) })
      }
    }
  }

  // 곤충/나비 — 매우 낮은 밀도(맵 전체 8개 남짓)
  let insectSpots = 0, attempts = 0
  while (insectSpots < 8 && attempts < 300) {
    attempts++
    const tx = 3 + Math.floor(rand() * (MAP_W - 6)), ty = 3 + Math.floor(rand() * (MAP_H - 6))
    if (insideAnyNatureYard(tx, ty) || isNearNaturePath(tx, ty)) continue
    objs.push({ type: rand() < 0.5 ? 'natureInsect' : 'natureButterfly', tx, ty, variant: Math.floor(rand() * 10) })
    insectSpots++
  }

  console.log(
    `[NatureZone 셀프체크] 집 ${NATURE_HOUSES.length}채, 나무 ${treeCount}그루 → ` +
    (report.errors.length === 0 ? 'PASS (마당 간격 전부 5타일 이상)' : `FAIL:\n  ${report.errors.join('\n  ')}`)
  )
  console.log(
    `[NatureZone 나무 재배치] 기존 243그루 → 신규 ${treeCount}그루, 클러스터 ${treeClusters.length}개, ` +
    `시야 회랑 확보 ${sightlineViolations === 0 ? '확인' : `FAIL(${sightlineViolations}건 위반)`}`
  )
}

function inBounds(tx, ty) {
  return tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H
}

/* ─────────────────────────────────────────────
   Lab Zone("미지의 소리 마을") — Craftpix 던전 팩 공식 샘플 맵(Dungeon1.tmx)의
   벽/바닥/물 배치를 그대로 이식한 던전풍 마을(labDungeonData.js). 코너 씬
   가구 배치는 폐기 — spawnSoundItems가 아이템을 벽/물 위에 스폰하지 않도록,
   LAB_FLOOR_CELLS(순수 바닥 칸만)를 화이트리스트로 쓴다.
───────────────────────────────────────────── */
const LAB_FLOOR_SET = new Set(LAB_FLOOR_CELLS.map(([x, y]) => `${x},${y}`))
function isLabFloorTile(tx, ty) {
  return LAB_FLOOR_SET.has(`${tx},${ty}`)
}

/* ─────────────────────────────────────────────
   Urban Zone("도시 마을") — Kenney RPG Urban Pack(CC0)으로 재구현. 도로망을
   computeBlockGrid(sounds)가 소리 아이템 6개 block을 위해 실제로 나누는 격자
   (cols=3,rows=2 → colBounds=[2,17,31,46], rowBounds=[2,18,34], 6번 zone 작업
   때 베이지 이음매 버그로 이미 확인된 좌표)와 같은 자리에 맞춰 세로 도로 2개+
   가로 도로 1개로 다시 짰다 — buildZoneObjects(zone)엔 sounds가 안 들어와서
   computeBlockGrid를 직접 호출은 못 하니, 오늘 기준 계산값을 스냅샷으로 하드
   코딩했다(주석 아래 유지보수 메모 참고). 그 결과 도로가 정확히 6개 구역을
   만들고, 각 구역에 성격(관공서/상점/주차장/공원/광장)을 하나씩 부여한다.
   ⚠️ 유지보수: sound_metadata.json의 Urban block 개수가 6에서 바뀌면
   computeBlockGrid의 결과도 바뀌므로, 이 좌표들은 더 이상 그 경계와 안
   맞을 수 있다(치명적이진 않음 — 그래도 도로망 자체는 정상 동작, 다만
   "경계와 도로가 겹쳐 여백 낭비 없음"이라는 장점만 사라짐).
───────────────────────────────────────────── */
// Kenney 시트 원본 타일 = 16px, 게임 TILE = 32px → 전부 이 배율로 그린다.
const URBAN_SCALE = 2
// 건물 지붕 높이(타일) — wallRed/wallOrange는 정면 벽면뿐이라 그 위에 평지붕을
// 얹는다. 벽 발자국(URBAN_BUILDINGS.y0~y1) 바로 위 URBAN_ROOF_H칸을 지붕으로 쓴다.
const URBAN_ROOF_H = 3 // 9-slice 테두리(상/중/하 각 1행)가 다 드러나 보이려면 최소 3행 필요
const URBAN_ROAD = {
  vA: { x0: 16, y0: 2,  x1: 18, y1: 33 }, // 세로 도로 1(colBounds[1]=17 중심)
  vB: { x0: 30, y0: 2,  x1: 32, y1: 33 }, // 세로 도로 2(colBounds[2]=31 중심)
  h:  { x0: 2,  y0: 17, x1: 45, y1: 19 }, // 가로 도로(rowBounds[1]=18 중심)
}
// 6구역 — 도로 코어 바로 바깥쪽부터 맵 여백까지 통째로 인도 텍스처로 채운다.
// kind는 아래 buildUrbanZone()이 구역 성격(건물/주차장/공원/광장)을 정하는 데 쓴다.
const URBAN_BLOCKS = {
  nw:   { x0: 2,  y0: 2,  x1: 15, y1: 16, kind: 'civic'   }, // 관공서
  nmid: { x0: 19, y0: 2,  x1: 29, y1: 16, kind: 'shop'    }, // 상점가
  ne:   { x0: 33, y0: 2,  x1: 45, y1: 16, kind: 'annex'   }, // 상업지구 별관
  sw:   { x0: 2,  y0: 20, x1: 15, y1: 33, kind: 'park'    }, // 소규모 공원
  smid: { x0: 19, y0: 20, x1: 29, y1: 33, kind: 'parking' }, // 주차장
  se:   { x0: 33, y0: 20, x1: 45, y1: 33, kind: 'plaza'   }, // 보행 광장(노점)
}
const URBAN_BUILDINGS = {
  // wallRed/wallOrange 원본이 7×4타일이라 발자국도 그대로 7×4. 3동 전부 다른
  // 벽/문/어닝 조합으로 구성해 "같은 건물 재탕"처럼 안 보이게 한다.
  gov:   { x0: 6,  y0: 8, x1: 12, y1: 11, wall: 'wallRed',    doorSprite: 'doorGlass',  awning: false, block: 'nw'   },
  shop:  { x0: 21, y0: 8, x1: 27, y1: 11, wall: 'wallOrange', doorSprite: 'doorOrange', awning: true,  block: 'nmid' },
  annex: { x0: 36, y0: 8, x1: 42, y1: 11, wall: 'wallRed',    doorSprite: 'doorOrange', awning: false, block: 'ne'   },
}
// 건물 발자국 남쪽(입구 쪽)에서 가로 도로까지 내려가는 짧은 골목(3타일 폭 도로
// 텍스처) — "도로 하나만 그어놓은 개활지" 느낌을 줄이려고 구역 내부를 가로지르는
// 보조 통로를 추가한 것.
const URBAN_ALLEYS = {
  nw:   { x0: 8,  y0: 12, x1: 10, y1: 16 },
  nmid: { x0: 23, y0: 12, x1: 25, y1: 16 },
  ne:   { x0: 38, y0: 12, x1: 40, y1: 16 },
}
// smid 구역(주차장) 발자국. 원래 y1:31로 smid 블록 바닥(y33)에서 딱 2칸 위까지
// 포장돼 있었는데, 캐릭터 스폰 지점(맵 남쪽 입구, ty≈32)이 바로 그 옆이라
// "입구에 들어서자마자 도로/주차장 위에 서 있다"는 지적을 받아 위로 당겼다
// (y1:31→27, 입구 쪽 여유를 2칸→5칸으로 넓힘). 스폰 로직 자체(ty=32)는 안 건드림.
const URBAN_PARKING_CORE = { x0: 20, y0: 21, x1: 28, y1: 27 } // smid 구역 — 주차장
const URBAN_PARK_CORE    = { x0: 4,  y0: 22, x1: 13, y1: 31 } // sw 구역 — 소규모 공원
function insideAnyUrbanRoad(tx, ty) {
  return Object.values(URBAN_ROAD).some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1)
}
// 지붕(벽 발자국 바로 위 URBAN_ROOF_H칸)까지 포함해서 "건물"로 취급한다 —
// 소리 아이템이 지붕 밑에 스폰되지 않게 막는 목적. 벽 자체 범위(x0~x1,y0~y1)는
// URBAN_BUILDINGS 원래 값 그대로라 문/창문/어닝 좌표 계산엔 영향이 없다.
function insideAnyUrbanBuilding(tx, ty) {
  return Object.values(URBAN_BUILDINGS).some(
    r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 - URBAN_ROOF_H && ty <= r.y1
  )
}
function insideAnyUrbanAlley(tx, ty) {
  return Object.values(URBAN_ALLEYS).some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1)
}
// spawnSoundItems 전용 제외 영역 — road/골목/building/parking·park 핵심부만 막고
// sidewalk나 구역의 나머지 빈 바닥은 그대로 열어둔다(옛 Urban 구현에서
// "구역 전체를 막으면 block 셀이 자투리로 쪼개진다"고 확인된 전례를 그대로 반영).
function insideUrbanSpawnExclude(tx, ty) {
  return insideAnyUrbanRoad(tx, ty) || insideAnyUrbanAlley(tx, ty) || insideAnyUrbanBuilding(tx, ty) ||
    (tx >= URBAN_PARKING_CORE.x0 && tx <= URBAN_PARKING_CORE.x1 && ty >= URBAN_PARKING_CORE.y0 && ty <= URBAN_PARKING_CORE.y1) ||
    (tx >= URBAN_PARK_CORE.x0 && tx <= URBAN_PARK_CORE.x1 && ty >= URBAN_PARK_CORE.y0 && ty <= URBAN_PARK_CORE.y1)
}

/* ─────────────────────────────────────────────
   Urban Zone 전체 배치 — 건물 3동(발자국 URBAN_BUILDINGS) + 교차로 2곳 신호등 8개 +
   도로 위 차량(주행 6대+주차 3대) + 주차장(URBAN_PARKING_CORE)/소규모 공원
   (URBAN_PARK_CORE)/보행 광장(se 구역) + 인도변 소품(가로등/표지판/쓰레기통/벤치/
   화단/노점/펜스/보행자). 도로/인도/골목/횡단보도/차선 마킹 같은 "타일 전체를
   채우는" 레이어는 여기서 objs로 만들지 않고 UrbanRoadNetwork()가 URBAN_ROAD/
   URBAN_BLOCKS/URBAN_ALLEYS를 직접 읽어 그린다(Nature의 NatureWater/NaturePath와
   같은 분리 — 넓은 바닥은 컴포넌트, 개별 소품만 objs/ZoneObject).
───────────────────────────────────────────── */
function buildUrbanZone(objs) {
  const report = { errors: [] }
  // 구역별 오브젝트 개수 집계(자기검증용) — push할 때마다 세지 않고, 구역 kind별
  // 좌표 범위로 사후 집계한다(건물/차량/보행자/소품 전부 동일 기준으로 셀 수 있게).
  const blockOf = (tx, ty) => Object.entries(URBAN_BLOCKS).find(
    ([, r]) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1
  )?.[0] ?? null
  const propCount = {}
  const countProp = (tx, ty) => {
    const b = blockOf(tx, ty)
    if (b) propCount[b] = (propCount[b] || 0) + 1
  }

  // ── 건물 3동 — 지붕(벽 발자국 바로 위, 평지붕) + 벽 블롭(발자국 그대로 7×4)
  // + 문(인도 쪽 하단 중앙) + 창문(상단) + (해당하면) 어닝. 문/창문 좌표가
  // 실제로 그 건물 발자국 안에 있는지는 아래 셀프체크가 확인한다. ──
  Object.entries(URBAN_BUILDINGS).forEach(([id, b]) => {
    objs.push({ type: 'urbanRoof', tx: b.x0, ty: b.y0 - URBAN_ROOF_H, w: b.x1 - b.x0 + 1, h: URBAN_ROOF_H, id })
    objs.push({ type: 'urbanBuildingWall', tx: b.x0, ty: b.y0, wall: b.wall, id })
    const doorTx = b.x0 + Math.floor((b.x1 - b.x0) / 2)
    // wallRed(관공서 2동)는 sample.png 참고 요청으로 파사드를 다시 짰다 — 맨 위
    // 줄에 크림틀 정사각창 3개(1/3/5번째 칸), 맨 아래 줄에 문 3개(양옆은 줄무늬
    // 없는 순정 유리문, 가운데만 2인용 겹문). 가운데 두 줄은 벽돌만 남겨 창-문
    // 사이 여백을 준다. wallOrange(상점)는 기존 단일 창+어닝+문 구성 그대로 둔다.
    let doorTxs
    if (b.wall === 'wallRed') {
      const cols = [b.x0 + 1, b.x0 + 3, b.x0 + 5]
      cols.forEach(tx => objs.push({ type: 'urbanWindowSmall', tx, ty: b.y0, id }))
      const doorSprites = ['doorPlain', 'doorDouble', 'doorPlain']
      cols.forEach((tx, i) => objs.push({ type: 'urbanDoor', tx, ty: b.y1, sprite: doorSprites[i], id }))
      doorTxs = cols
    } else {
      objs.push({ type: 'urbanWindowWide', tx: b.x0 + 1, ty: b.y0 + 1, id })
      // 어닝을 문보다 먼저 push해서 문이 그 위(z-순서상 나중)에 그려지게 한다 —
      // 캐노피가 문 위쪽에 걸리고 문은 그 아래로 드러나야 하는데, 순서가 반대면
      // 어닝이 문을 통째로 가려버린다(먼저 겪은 실수, 셀프체크로는 못 잡는
      // 순수 z-order 버그라 스크린샷으로 확인 후 고침).
      if (b.awning) {
        for (let ax = b.x0 + 1; ax <= b.x1 - 1; ax++) objs.push({ type: 'urbanAwning', tx: ax, ty: b.y1, id })
      }
      objs.push({ type: 'urbanDoor', tx: doorTx, ty: b.y1, sprite: b.doorSprite, id })
      doorTxs = [doorTx]
    }
    // 건물 앞 화단 2개 + 표지판 1개 — 파사드 밑동이 휑해 보이지 않게.
    objs.push({ type: 'urbanPlanter', tx: b.x0,     ty: b.y1 })
    objs.push({ type: 'urbanPlanter', tx: b.x1,     ty: b.y1 })
    objs.push({ type: 'urbanSign', tx: b.x0 - 2, ty: b.y1, variant: id === 'shop' ? 'green' : 'blue' })
    if (b.x0 < 2 || b.x1 > MAP_W - 3 || (b.y0 - URBAN_ROOF_H) < 2 || b.y1 > MAP_H - 3) {
      report.errors.push(`BUILDING-OOB[${id}] (${b.x0},${b.y0})-(${b.x1},${b.y1}) 지붕 포함 맵 경계 밖`)
    }
    doorTxs.forEach(dtx => {
      if (insideAnyUrbanRoad(dtx, b.y1)) {
        report.errors.push(`BUILDING-ON-ROAD[${id}] 문(${dtx},${b.y1})이 도로 위`)
      }
    })
  })
  // 건물 3동이 서로 겹치거나 너무 붙어있지 않은지(최소 2타일 간격)
  const bList = Object.entries(URBAN_BUILDINGS)
  for (let i = 0; i < bList.length; i++) {
    for (let j = i + 1; j < bList.length; j++) {
      const [idA, a] = bList[i], [idB, b] = bList[j]
      const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1)
      if (gap < 2) report.errors.push(`BUILDING-TOO-CLOSE[${idA}-${idB}] gap=${gap}`)
    }
  }

  // ── 교차로 2곳(세로 도로 2개 × 가로 도로 1개) 귀퉁이마다 신호등 4개씩 = 8개 ──
  const iy0 = URBAN_ROAD.h.y0, iy1 = URBAN_ROAD.h.y1
  ;[URBAN_ROAD.vA, URBAN_ROAD.vB].forEach(v => {
    ;[[v.x0 - 1, iy0 - 1], [v.x1 + 1, iy0 - 1], [v.x0 - 1, iy1 + 1], [v.x1 + 1, iy1 + 1]]
      .forEach(([tx, ty]) => { objs.push({ type: 'urbanTrafficLight', tx, ty }); countProp(tx, ty) })
  })

  // ── 차량 — 세로 도로 2개 × 가로 도로 위에 색상을 다양화해서 여러 대 배치 ──
  const vehiclePos = [
    { tx: 17, ty: 6,  variant: 0 }, { tx: 17, ty: 29, variant: 2 },
    { tx: 31, ty: 8,  variant: 1 }, { tx: 31, ty: 26, variant: 3 },
    { tx: 10, ty: 18, variant: 2 }, { tx: 42, ty: 18, variant: 0 },
  ]
  vehiclePos.forEach(v => { objs.push({ type: 'urbanVehicle', ...v }); countProp(v.tx, v.ty) })

  // ── 주차장(smid 구역) — 주차된 차량 3대 + 표지판/미터기/바리케이드.
  // 주차 마킹(둥근 사각형 스텐실) 4개는 사용자 요청으로 제거 — 도로 텍스처와
  // 함께 "도로처럼 보인다"는 지적을 받아 배경(인도)만 남긴다.
  // 전부 좁아진 URBAN_PARKING_CORE(y21~27) 안에 들어오도록 배치. ──
  objs.push({ type: 'urbanVehicle', tx: 21, ty: 22, variant: 1 }); countProp(21, 22)
  objs.push({ type: 'urbanVehicle', tx: 29, ty: 22, variant: 3 }); countProp(29, 22)
  objs.push({ type: 'urbanVehicle', tx: 25, ty: 26, variant: 0 }); countProp(25, 26)
  objs.push({ type: 'urbanParkingSign', tx: 20, ty: 27 }); countProp(20, 27)
  objs.push({ type: 'urbanParkingMeter', tx: 19, ty: 22 }); countProp(19, 22)
  objs.push({ type: 'urbanParkingMeter', tx: 19, ty: 26 }); countProp(19, 26)
  objs.push({ type: 'urbanBarrier', tx: 29, ty: 21, variant: 0 }); countProp(29, 21)
  objs.push({ type: 'urbanBarrier', tx: 20, ty: 21, variant: 1 }); countProp(20, 21)

  // ── 소규모 공원(sw 구역) — 잔디 패치 + 나무 4그루 + 벤치 2개 + 화단 2개 + 펜스 테두리 ──
  objs.push({ type: 'urbanGrassPatch', tx: 6, ty: 24 }); countProp(6, 24)
  objs.push({ type: 'urbanTree', tx: 10, ty: 22, variant: 'tealCluster' }); countProp(10, 22)
  objs.push({ type: 'urbanTree', tx: 5,  ty: 27, variant: 'orangeSingle' }); countProp(5, 27)
  objs.push({ type: 'urbanTree', tx: 13, ty: 27, variant: 'orangeCluster' }); countProp(13, 27)
  objs.push({ type: 'urbanTree', tx: 4,  ty: 31, variant: 'tealSingle' }); countProp(4, 31)
  objs.push({ type: 'urbanBench', tx: 7,  ty: 28 }); countProp(7, 28)
  objs.push({ type: 'urbanBench', tx: 11, ty: 31 }); countProp(11, 31)
  objs.push({ type: 'urbanPlanter', tx: 4, ty: 22 }); countProp(4, 22)
  objs.push({ type: 'urbanPlanter', tx: 14, ty: 22 }); countProp(14, 22)
  objs.push({ type: 'urbanBikeMark', tx: 9, ty: 32 }); countProp(9, 32)
  for (let fx = 3; fx <= 14; fx += 4) { objs.push({ type: 'urbanFence', tx: fx, ty: 21 }); countProp(fx, 21) }

  // ── 보행 광장(se 구역) — 노점 2개 + 벤치 2개 + 화단 3개 + 쓰레기통 + 펜스 테두리 ──
  objs.push({ type: 'urbanStall', tx: 36, ty: 24 }); countProp(36, 24)
  objs.push({ type: 'urbanStall', tx: 40, ty: 28 }); countProp(40, 28)
  objs.push({ type: 'urbanBench', tx: 35, ty: 29 }); countProp(35, 29)
  objs.push({ type: 'urbanBench', tx: 42, ty: 24 }); countProp(42, 24)
  objs.push({ type: 'urbanPlanter', tx: 38, ty: 22 }); countProp(38, 22)
  objs.push({ type: 'urbanPlanter', tx: 34, ty: 32 }); countProp(34, 32)
  objs.push({ type: 'urbanPlanter', tx: 44, ty: 32 }); countProp(44, 32)
  objs.push({ type: 'urbanTrashcanFree', tx: 37, ty: 31 }); countProp(37, 31)
  for (let fx = 34; fx <= 44; fx += 4) { objs.push({ type: 'urbanFence', tx: fx, ty: 33 }); countProp(fx, 33) }

  // ── 인도변 소품 — 가로등을 세로 도로 2개 + 가로 도로를 따라 일정 간격으로,
  // 교차로·건물 발자국 근처는 건너뛴다. 짝수 번째 가로등 옆엔 쓰레기통을 곁들인다.
  // LabSprite는 (tx,ty)를 좌상단 기준으로 오른쪽·아래로 그린다. lamp 스프라이트는
  // w28×h46(원본) × URBAN_SCALE(2) = 56×92px = 가로 1.75타일 × 세로 2.875타일로,
  // 가로세로 비율이 크게 다르다(세로가 훨씬 김) — 그래서 세로 도로(가로 오프셋)와
  // 가로 도로(세로 오프셋)에 같은 "±1칸" 오프셋을 그대로 쓰면 안 된다:
  //   · 세로 도로: 가로 오프셋 1칸 → 스프라이트 폭(1.75칸)의 절반 정도만 도로 쪽으로
  //     걸쳐 보여서(가로등 팔이 도로 위로 살짝 뻗은 정도) 자연스럽다.
  //   · 가로 도로 북쪽: 세로 오프셋을 그대로 1칸만 주면 스프라이트가 위에서
  //     아래로 그려지므로 높이(2.875칸)의 대부분(1.875칸)이 도로 안쪽까지
  //     파고들어 "가로등이 도로 한복판에 서 있는" 것처럼 보인다 — 실제 버그.
  // 따라서 북쪽 가로등만 스프라이트 높이를 감안해 밑동이 도로 경계 바로 위에
  // 오도록 세로 오프셋을 LAMP_H_TILES만큼 띄운다. 남쪽 가로등은 스프라이트가
  // 이미 도로 반대 방향(아래)으로 자라나므로 기존 1칸 오프셋 그대로 정확하다.
  const LAMP_H_TILES = Math.ceil((URBAN_KENNEY_PROPS.lamp.h * URBAN_SCALE) / TILE) // 46*2/32 = 2.875 → 3
  let lampIdx = 0
  const placeLamp = (tx, ty) => {
    if (insideAnyUrbanBuilding(tx, ty)) return false
    objs.push({ type: 'urbanLamp', tx, ty }); countProp(tx, ty)
    if (lampIdx % 2 === 0) { objs.push({ type: 'urbanTrashcan', tx: tx + 1, ty }); countProp(tx + 1, ty) }
    lampIdx++
    return true
  }
  ;[URBAN_ROAD.vA, URBAN_ROAD.vB].forEach(v => {
    for (let ty = 3; ty <= 33; ty += 6) {
      if (ty >= iy0 - 2 && ty <= iy1 + 2) continue
      placeLamp(v.x0 - 1, ty)
      placeLamp(v.x1 + 1, ty)
    }
  })
  let hLampCount = 0, hLampGapSum = 0
  for (let tx = 3; tx <= 44; tx += 6) {
    if ([URBAN_ROAD.vA, URBAN_ROAD.vB].some(v => tx >= v.x0 - 2 && tx <= v.x1 + 2)) continue
    const northTy = URBAN_ROAD.h.y0 - LAMP_H_TILES, southTy = URBAN_ROAD.h.y1 + 1
    if (insideAnyUrbanBuilding(tx, northTy) || insideAnyUrbanBuilding(tx, southTy)) continue
    if (placeLamp(tx, northTy)) { hLampCount++; hLampGapSum += URBAN_ROAD.h.y0 * TILE - (northTy * TILE + URBAN_KENNEY_PROPS.lamp.h * URBAN_SCALE) }
    if (placeLamp(tx, southTy)) { hLampCount++; hLampGapSum += southTy * TILE - (URBAN_ROAD.h.y1 + 1) * TILE }
  }

  // ── 가로 도로 가로등 정렬 셀프체크 — 스프라이트 밑동/꼭대기와 도로 경계 사이
  // 간격(px)을 실제로 재서(자리 개수만큼 평균) 0에 가까운지(딱 붙었는지) 확인한다.
  console.log(
    `[UrbanZone 셀프체크] 가로 도로 옆 가로등 → ${hLampCount}개 배치, ` +
    `도로 경계와의 평균 간격 ${hLampCount ? (hLampGapSum / hLampCount).toFixed(1) : '0.0'}px ` +
    `(0에 가까울수록 도로에 딱 붙음 — 세로 도로 쪽과 동일 기준)`
  )

  // ── 보행자 — 각 구역 인도 위에 1~2명씩, 도로/건물/주차장 코어와 안 겹치는
  // 자리로 손으로 골랐다(무작위 스캐터 대신 확정 좌표 — 겹침 셀프체크 대상 아님). ──
  const pedestrianPos = [
    { tx: 3,  ty: 6,  variant: 0 }, { tx: 12, ty: 14, variant: 2 },  // nw
    { tx: 20, ty: 5,  variant: 1 }, { tx: 28, ty: 15, variant: 3 },  // nmid
    { tx: 34, ty: 6,  variant: 2 }, { tx: 44, ty: 14, variant: 0 },  // ne
    { tx: 3,  ty: 33, variant: 3 },                                  // sw
    { tx: 30, ty: 33, variant: 1 },                                  // smid
    { tx: 44, ty: 21, variant: 2 },                                  // se
  ]
  pedestrianPos.forEach(p => { objs.push({ type: 'urbanPedestrian', ...p }); countProp(p.tx, p.ty) })

  // ── 셀프체크 ──
  console.log(
    `[UrbanZone 셀프체크] 건물 간격/도로-건물 겹침 → ` +
    (report.errors.length === 0 ? 'PASS (건물 3동 경계 안, 2타일 이상 간격, 도로 비침범)' : `FAIL:\n  ${report.errors.join('\n  ')}`)
  )
  const wallScale = 32 / 16 // 게임 TILE(32px) / Kenney 원본 타일(16px)
  console.log(
    `[UrbanZone 그리드 측정] Kenney 타일 단위 16px(alpha 스캔 확인) → 게임 TILE 32px 배치이므로 ` +
    `렌더 scale=${wallScale} 고정 적용. wallRed 112×64px(7×4타일) × scale${wallScale} = ` +
    `${112 * wallScale}×${64 * wallScale}px = 정확히 7×4 게임타일(224/32=7, 128/32=4) 확인`
  )

  // ── 문/창문 스프라이트 크기 셀프체크 — "벽 구석에 작게 박힌 사각형" 리포트의
  // 근본 원인을 숫자로 증명한다. python alpha 스캔으로 확인한 실측치:
  //   · 이전 windowSmall(176,192,16,16) 칸: 실제 불투명 내용물은 8×11px뿐
  //     (16×16 칸 왼쪽 위로 치우친 투명 여백 포함 크롭 — 그래서 작아 보였다)
  //   · 신규 windowSmall(208,224,16,16): 알파 꽉 찬 진짜 16×16 전체
  //   · doorPlain(192,144,16,16): 실제 12×16(가로 75%) — 문은 원래 창문보다
  //     좁은 게 정상이라 그대로 둠. doorDouble(240,192,16,16): 16×16 꽉 참.
  //   · sample.png 관공서 파사드를 픽셀 단위로 직접 재보면(가로 도로 옆 y=100
  //     행 스캔) 창문 폭 ≈20px(2배 스케일 기준, 원본 10px) — 벽(같은 스케일
  //     158px) 대비 ≈12.5%, "타일 1칸의 100~125%" 수준으로 거의 꽉 채운다.
  const wallW = 112 // wallRed 원본 폭(px), 7타일
  const oldWinContentW = 8, newWinContentW = URBAN_KENNEY_BUILDING.windowSmall.w
  const doorContentW = 12 // doorPlain 알파 스캔 실측 폭(박스는 16이지만 내용물은 12)
  const doorW = doorContentW
  console.log(
    `[UrbanZone 문/창문 비율] 벽 폭 ${wallW}px 기준 → ` +
    `window 이전 ${oldWinContentW}/${wallW}=${(oldWinContentW / wallW * 100).toFixed(1)}%(칸의 ${(oldWinContentW / 16 * 100).toFixed(0)}%만 채움) → ` +
    `이후 ${newWinContentW}/${wallW}=${(newWinContentW / wallW * 100).toFixed(1)}%(칸의 100% 꽉 참), ` +
    `door ${doorW}/${wallW}=${(doorW / wallW * 100).toFixed(1)}%(칸의 75%, 창문보다 좁은 게 정상). ` +
    `sample.png 실측 window/wall ≈ 12.5%(칸 기준 100~125%) — 이제 같은 자릿수로 근접`
  )

  // ── 구역별 밀도 셀프체크 — 건물 수/소품 수(가로등·쓰레기통·차량·벤치·화단 등
  // objs로 배치한 모든 것)를 6구역별로 집계해서 "빈 주차장에 소품 몇 개"였던
  // 이전 지적이 실제로 해소됐는지 숫자로 보여준다.
  const buildingCountByBlock = {}
  Object.values(URBAN_BUILDINGS).forEach(b => {
    buildingCountByBlock[b.block] = (buildingCountByBlock[b.block] || 0) + 1
  })
  Object.entries(URBAN_BLOCKS).forEach(([id, r]) => {
    const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
    console.log(
      `[UrbanZone 셀프체크] 구역 [${id}](${r.kind}) ${r.x0},${r.y0}-${r.x1},${r.y1}(${area}칸) → ` +
      `건물 ${buildingCountByBlock[id] || 0}동, 소품/차량/보행자 ${propCount[id] || 0}개`
    )
  })
  const roadTiles = Object.values(URBAN_ROAD).reduce((sum, r) => sum + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0)
  const alleyTiles = Object.values(URBAN_ALLEYS).reduce((sum, r) => sum + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0)
  console.log(
    `[UrbanZone 셀프체크] 도로망 규모 → 간선 도로 ${Object.keys(URBAN_ROAD).length}개(${roadTiles}칸), ` +
    `골목(보조 도로) ${Object.keys(URBAN_ALLEYS).length}개(${alleyTiles}칸)`
  )

  // ── 절대 커버리지 셀프체크 — 좌/우 비교가 아니라 "건물 내부를 뺀 맵 전체 중
  // Urban 전용 에셋(인도 블록/도로/골목/주차장/공원)이 실제로 깔린 칸이 몇 %인지"를
  // 직접 잰다. 바닥 채우기 로직(URBAN_BLOCKS 전체 인도 포장) 자체는 이번에 안
  // 건드렸으니 100%가 그대로 유지돼야 정상이다.
  let covered = 0, denom = 0
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (insideAnyUrbanBuilding(tx, ty)) continue // 건물 내부는 분모에서 제외
      denom++
      const isBlock = Object.values(URBAN_BLOCKS).some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1)
      const isPark = tx >= URBAN_PARK_CORE.x0 && tx <= URBAN_PARK_CORE.x1 && ty >= URBAN_PARK_CORE.y0 && ty <= URBAN_PARK_CORE.y1
      if (insideAnyUrbanRoad(tx, ty) || insideAnyUrbanAlley(tx, ty) || isBlock || isPark) covered++
    }
  }
  const pct = (n, d) => (d ? (100 * n / d).toFixed(1) : '0.0')
  console.log(
    `[UrbanZone 셀프체크] 절대 커버리지(건물 내부 제외, road+골목+sidewalk블록+공원 기준) → ` +
    `${covered}/${denom}칸 (${pct(covered, denom)}%)`
  )
  console.log(
    `[UrbanZone 셀프체크] 건물 ${Object.keys(URBAN_BUILDINGS).length}동 좌표 → ` +
    Object.entries(URBAN_BUILDINGS).map(([id, b]) => `${id}(${b.block}):(${b.x0},${b.y0})-(${b.x1},${b.y1})`).join(', ')
  )

  // ── 미적용 칸(어떤 레이어에도 안 속한 칸) 목록 — 좌표 대조가 아니라 전수조사로
  // 직접 확인한다(이전에 "좌표는 맞다"고 눈으로만 판단했다가 실제 원인(pathTiles가
  // UrbanRoadNetwork 위에 그려지는 render-order 문제)을 놓쳤던 전례 재발 방지).
  const uncovered = []
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (insideAnyUrbanBuilding(tx, ty)) continue
      const isBlock = Object.values(URBAN_BLOCKS).some(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1)
      const isPark = tx >= URBAN_PARK_CORE.x0 && tx <= URBAN_PARK_CORE.x1 && ty >= URBAN_PARK_CORE.y0 && ty <= URBAN_PARK_CORE.y1
      if (!(insideAnyUrbanRoad(tx, ty) || insideAnyUrbanAlley(tx, ty) || isBlock || isPark)) uncovered.push({ tx, ty })
    }
  }
  const vLines = [16, 18, 19, 21, 30, 32, 33, 29], hLines = [16, 17, 19, 20]
  const classify = (tx, ty) => {
    const nearV = vLines.includes(tx), nearH = hLines.includes(ty)
    if (nearV && nearH) return '교차점'
    if (nearV) return '세로경계'
    if (nearH) return '가로경계'
    return '기타'
  }
  console.log(
    `[UrbanZone 셀프체크] 미적용(어떤 레이어에도 안 속한) 칸 → ${uncovered.length}개` +
    (uncovered.length
      ? ':\n  ' + uncovered.map(p => `(${p.tx},${p.ty})[${classify(p.tx, p.ty)}]`).join(', ')
      : ' (전부 road/골목/sidewalk블록/공원 중 하나로 커버됨)')
  )
}

/* ─────────────────────────────────────────────
   Human Zone("사람 마을") — Kevin Lynch "The Image of the City" 5요소
   (랜드마크/경로/결절점/구역/경계)를 명시적으로 구분해 재설계. Urban Zone과
   같은 6구역 격자(HUMAN_BLOCKS, colBounds=[2,17,31,46]/rowBounds=[2,18,34],
   computeBlockGrid가 6개 block에서 만드는 격자와 동일)를 캔버스로 쓰되, 이번엔
   block마다 정확히 하나의 역할만 갖는다("예쁘게 흩뿌리기" 금지):

     ne(LANDMARK 1) — SUPAM 슈퍼마켓. HUMAN_WINTER.buildings 중 가장 큰
       단일 건물(167×127) → 단일 기준점.
     sw(LANDMARK 2) — Public Library. 두 번째로 큰 건물(149×101), ne와
       대각선 코너 → 어느 코너에 있어도 반대쪽 랜드마크를 향해 걸어야
       다음 기준점이 나오게(두 랜드마크를 동시에 보는 시점이 없도록).
     nmid(NODE 1, 주) — 마켓 광장. 진저브레드 하우스(랜드마크 악센트)+
       눈사람+마켓 부스 3종이 모인 결절점 — 길이 모이고 사람이 몰리는 지점.
     smid(NODE 2, 보조) — 빙판 광장. bakery가 광장을 감싸고 iceRink가
       중심에 있는 결절점. nmid와 남북 축으로 바로 이어져 입구(24,35)에서
       가장 먼저 닿는다.
     nw(DISTRICT) — 주거 구역. Hippie Home↔Pub이 마주보는 조용한 골목,
       성격이 균일한 텍스처 지역(단일 기준점이 아님).
     se(EDGE/여백) — 건물 없이 나무·벤치만 있는 조용한 모서리. 랜드마크·
       결절점·구역 사이에 "숨 쉴 틈"을 주는 경계 지역.

   경로(HUMAN_STREET)는 block 경계선 위에 그대로 얹는다(colBounds/rowBounds와
   동일 좌표) — 이러면 buildPaths()/computeBlockGrid()가 이미 만드는
   PATH_BUFFER 여백과 겹쳐서 별도 처리 없이 "길이 곧 block 사이 여백"이 된다.
   동서 축 하나(y17~19)는 동시에 경계이기도 하다 — 북쪽 줄(주거+마켓+
   슈퍼마켓, 붐비는 성격)과 남쪽 줄(도서관+빙판광장+여백, 조용한 성격)을
   가르는 선. Lynch가 말한 "경로와 경계가 같은 선일 수 있다"는 사례를 그대로
   적용했다.
───────────────────────────────────────────── */
const HUMAN_BLOCKS = {
  nw:   { x0: 2,  y0: 2,  x1: 15, y1: 16, kind: 'district',  role: '주거 구역(Hippie Home+Pub)' },
  nmid: { x0: 19, y0: 2,  x1: 29, y1: 16, kind: 'node',      role: '결절점 1(마켓 광장)' },
  ne:   { x0: 33, y0: 2,  x1: 45, y1: 16, kind: 'landmark',  role: '랜드마크 1(SUPAM 슈퍼마켓)' },
  sw:   { x0: 2,  y0: 20, x1: 15, y1: 33, kind: 'landmark',  role: '랜드마크 2(Public Library)' },
  smid: { x0: 19, y0: 20, x1: 29, y1: 33, kind: 'node',      role: '결절점 2(빙판 광장)' },
  se:   { x0: 33, y0: 20, x1: 45, y1: 33, kind: 'edge',      role: '경계/여백(조용한 모서리)' },
}

// 十자형 간선(경로) — block 경계선(colBounds/rowBounds)과 동일 좌표라
// PATH_BUFFER가 이미 아이템 스폰을 막아준다. 셋과 동일 폭(3타일)으로
// 남북 두 축 + 동서 한 축.
const HUMAN_STREET = {
  vA: { x0: 16, x1: 18, y0: 2, y1: 33 }, // nw·sw ↔ nmid·smid
  vB: { x0: 30, x1: 32, y0: 2, y1: 33 }, // nmid·smid ↔ ne·se
  h:  { x0: 2,  x1: 45, y0: 17, y1: 19 }, // 북쪽 줄 ↔ 남쪽 줄(=경계)
}

function humanRect(x0, y0, x1, y1) {
  const tiles = []
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) tiles.push({ tx, ty })
  return tiles
}

// ── spawnSoundItems 전용 제외 영역(HUMAN_SPAWN_EXCLUDE) — 시각적 범위(마당/
// 광장 전체)보다 훨씬 좁게, 실제 스프라이트 발자국("core")만 잡는다. Urban에서
// "칸은 넉넉한데 core가 block 폭 대부분을 가로질러 남는 공간이 길쭉한 조각으로
// 쪼개진다"는 문제를 두 번 겪은 전례를 그대로 반영해, 이번엔 처음부터 각
// core를 block 폭의 일부(60~75%)로만 잡고 나머지가 한 덩어리로 남게 했다.
// 十자 간선(HUMAN_STREET)은 여기 포함하지 않는다 — block 경계선과 좌표가
// 같아서 PATH_BUFFER가 이미 스폰을 막아준다(Urban의 "avenue는 스폰 제외에서
// 아예 빼는 게 제일 간단" 교훈 그대로).
const HUMAN_LANDMARK1_CORE = { x0: 35, y0: 3,  x1: 44, y1: 10 } // ne — supam 건물 발자국
const HUMAN_LANDMARK2_CORE = { x0: 4,  y0: 21, x1: 12, y1: 27 } // sw — library 건물 발자국
const HUMAN_DISTRICT_BUILDINGS = {
  hippie: { x0: 4, y0: 2,  x1: 9,  y1: 8  },
  pub:    { x0: 8, y0: 11, x1: 13, y1: 16 },
}
// nmid/smid는 한 덩어리 core로 잡으면(block 폭 11칸 중 8~9칸을 차지) 남는 공간이
// block 전체를 감싸는 얇은 L자 테두리가 돼서 산점도 검증에서 실제로 "선"처럼
// 보였다(1차 구현 후 window.__ITEMS_DEBUG__로 확인) — 세로로 얕은 두 개의 띠로
// 쪼개 위/아래에 각각 8~10칸짜리 덩어리 여백이 남게 재조정했다.
const HUMAN_NODE1_CORE_A = { x0: 19, y0: 2,  x1: 25, y1: 9  } // nmid 상단 — 진저브레드+눈사람
const HUMAN_NODE1_CORE_B = { x0: 19, y0: 10, x1: 28, y1: 13 } // nmid 부스 행(세로로 얕음)
const HUMAN_NODE2_CORE_A = { x0: 19, y0: 21, x1: 25, y1: 25 } // smid 상단 — bakery
const HUMAN_NODE2_CORE_B = { x0: 19, y0: 26, x1: 25, y1: 29 } // smid — iceRink
function insideHumanSpawnExclude(tx, ty) {
  const inRect = (r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1
  return inRect(HUMAN_LANDMARK1_CORE) || inRect(HUMAN_LANDMARK2_CORE) ||
    Object.values(HUMAN_DISTRICT_BUILDINGS).some(inRect) ||
    inRect(HUMAN_NODE1_CORE_A) || inRect(HUMAN_NODE1_CORE_B) ||
    inRect(HUMAN_NODE2_CORE_A) || inRect(HUMAN_NODE2_CORE_B)
}

/* ─────────────────────────────────────────────
   Human Zone 전체 배치 — HUMAN_BLOCKS 6개에 Lynch 5요소를 하나씩 배정한
   결과물. 순서: 경로(바닥 레이어) → 결절점 2곳 → 랜드마크 2곳 → 구역(nw) →
   경계/여백(se). 매 구역이 blockOf()로 자기 소속 block 안에 있는지 셀프체크.
───────────────────────────────────────────── */
function buildHumanZone(objs) {
  const blockOf = (tx, ty) => Object.entries(HUMAN_BLOCKS).find(
    ([, r]) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1
  )?.[0] ?? null
  const propCount = {}
  const oobErrors = []
  const countProp = (tx, ty, expectBlock) => {
    const b = blockOf(tx, ty)
    if (b) propCount[b] = (propCount[b] || 0) + 1
    if (expectBlock && b !== expectBlock) oobErrors.push(`(${tx},${ty})가 ${expectBlock} 밖(${b ?? '구역 없음'})`)
  }

  // ── 경로(십자 간선, HUMAN_STREET) — block 경계선과 동일 좌표라 별도
  // spawn-exclude 없이 PATH_BUFFER만으로 이미 아이템을 밀어낸다. ──
  const pathSeen = new Set()
  const addPath = (tx, ty) => {
    const k = `${tx},${ty}`
    if (pathSeen.has(k)) return
    pathSeen.add(k)
    objs.push({ type: 'humanPath', tx, ty })
  }
  ;[HUMAN_STREET.vA, HUMAN_STREET.vB, HUMAN_STREET.h].forEach(band => {
    humanRect(band.x0, band.y0, band.x1, band.y1).forEach(p => addPath(p.tx, p.ty))
  })
  // 간선 가로등 4개 — 교차점 근처는 피하고, 아직 다른 구역이 안 쓴 여백에만.
  ;[[10, 16], [38, 16], [10, 20], [38, 20]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanLamp', key: 'lampWreath', tx, ty, tileH: 3.5 })
  })

  // ── 결절점 1(nmid, 주) — 마켓 광장. 진저브레드 하우스(랜드마크 악센트,
  // 광장 안에서 튀는 캔디컬러라 작아도 시선이 모임)+눈사람이 북쪽, 부스
  // 3종이 남쪽에 늘어서 "장이 선" 느낌을 낸다. HUMAN_NODE1_CORE_A/B(세로로
  // 얕은 두 띠)가 spawn 제외 core — 오른쪽 열(x26-29)과 아래쪽 3줄(y14-16)이
  // 각각 덩어리로 남아 아이템이 그 안에 자연스럽게 퍼진다. ──
  objs.push({ type: 'humanGingerbread', key: 'gingerbreadHouse', tx: 21, ty: 3, tileH: 4.5 })
  countProp(21, 3, 'nmid')
  objs.push({ type: 'humanSnowman', key: 'snowmanSmall', tx: 24, ty: 5, tileH: 2.2 })
  countProp(24, 5, 'nmid')
  objs.push({ type: 'humanDecor', key: 'giftBox', tx: 21, ty: 8, tileH: 0.6 })
  countProp(21, 8, 'nmid')
  const node1Stands = [
    { key: 'standAlmonds', tx: 19, ty: 11 },
    { key: 'standJewelry', tx: 22, ty: 11 },
    { key: 'standPretzel', tx: 25, ty: 11 },
  ]
  node1Stands.forEach(s => {
    objs.push({ type: 'humanStand', key: s.key, tx: s.tx, ty: s.ty, tileH: 3.5 })
    countProp(s.tx, s.ty, 'nmid')
  })
  ;[[19, 2], [27, 2]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'nmid')
  })

  // ── 결절점 2(smid, 보조) — 빙판 광장. bakery가 북쪽에서 광장을 감싸고
  // iceRink가 중심 바닥에 깔린다(Urban plaza2 "장식으로 감싸기" 패턴).
  // HUMAN_NODE2_CORE_A/B — 오른쪽 열(x26-29)과 아래쪽 3줄(y30-33)이 덩어리로 남는다. ──
  objs.push({ type: 'humanBuilding', key: 'bakery', tx: 20, ty: 21, tileH: 5 })
  countProp(20, 21, 'smid')
  objs.push({ type: 'humanRink', tx: 19, ty: 26, tileW: 6 })
  countProp(19, 26, 'smid')
  objs.push({ type: 'humanBench', tx: 19, ty: 31 })
  countProp(19, 31, 'smid')
  objs.push({ type: 'humanBench', tx: 27, ty: 27 })
  countProp(27, 27, 'smid')
  objs.push({ type: 'humanDecor', key: 'giftBox', tx: 27, ty: 31, tileH: 0.6 })
  countProp(27, 31, 'smid')
  ;[[19, 21], [28, 21]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'smid')
  })

  // ── 랜드마크 1(ne) — SUPAM 슈퍼마켓. 등록된 건물 중 가장 큰 단일
  // 실루엣이라 그 자체로 기준점 역할. 문에서 간선(h밴드)까지 짧은 골목은
  // 순수 시각 요소(spawn-exclude에는 안 넣음 — Urban의 "avenue가 칸을
  // 반으로 가르지 않게" 교훈). ──
  objs.push({ type: 'humanBuilding', key: 'supam', tx: 35, ty: 3, tileH: 7 })
  countProp(35, 3, 'ne')
  humanRect(38, 11, 40, 16).forEach(p => addPath(p.tx, p.ty)) // 문→간선 골목
  ;[[33, 3], [44, 13]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'ne')
  })
  objs.push({ type: 'humanLamp', key: 'lampWreath', tx: 33, ty: 9, tileH: 3.5 })
  countProp(33, 9, 'ne')

  // ── 랜드마크 2(sw) — Public Library. ne와 대각선 코너. 스프라이트가
  // 항상 "문이 이미지 아래쪽"에 고정돼 있어 간선(북쪽)을 등지므로, 억지로
  // 돌리는 대신 문 앞에 조용한 앞뜰(벤치+짧은 울타리)을 둬서 "간선과 별개로
  // 존재하는 도서관 마당" 컨셉으로 처리했다. ──
  objs.push({ type: 'humanBuilding', key: 'library', tx: 4, ty: 21, tileH: 6 })
  countProp(4, 21, 'sw')
  objs.push({ type: 'humanBench', tx: 6, ty: 30 })
  countProp(6, 30, 'sw')
  objs.push({ type: 'humanDecor', key: 'giftBox', tx: 10, ty: 30, tileH: 0.6 })
  countProp(10, 30, 'sw')
  for (let fx = 7; fx <= 10; fx++) {
    objs.push({ type: 'humanFrostFence', tx: fx, ty: 29, role: 'rail' })
    countProp(fx, 29, 'sw')
  }
  ;[[2, 21], [14, 32]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'sw')
  })

  // ── 구역(nw) — 주거 골목. Hippie Home↔Pub이 짧은 안길을 사이에 두고
  // 마주본다(랜드마크·결절점과 달리 "단일 기준점"이 아니라 균일한 텍스처). ──
  objs.push({ type: 'humanBuilding', key: 'hippie', tx: 4, ty: 2, tileH: 6 })
  countProp(4, 2, 'nw')
  objs.push({ type: 'humanBuilding', key: 'pub', tx: 8, ty: 11, tileH: 5 })
  countProp(8, 11, 'nw')
  ;[[11, 2], [13, 6], [2, 12], [13, 13]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'nw')
  })
  for (let fx = 9; fx <= 12; fx++) {
    objs.push({ type: 'humanFrostFence', tx: fx, ty: 8, role: 'rail' })
    countProp(fx, 8, 'nw')
  }
  objs.push({ type: 'humanDecor', key: 'giftBox', tx: 5, ty: 8, tileH: 0.6 })
  countProp(5, 8, 'nw')

  // ── 경계/여백(se) — 건물 없이 나무·벤치만 있는 조용한 모서리. 얇은
  // 소품이라 spawn-exclude에는 안 넣는다(굵은 건물/광장 core만 제외 대상). ──
  ;[[35, 22], [38, 26], [43, 30], [34, 31]].forEach(([tx, ty]) => {
    objs.push({ type: 'humanTree', key: 'pineTree', tx, ty, tileH: 3 })
    countProp(tx, ty, 'se')
  })
  objs.push({ type: 'humanBench', tx: 37, ty: 24 })
  countProp(37, 24, 'se')
  objs.push({ type: 'humanBench', tx: 41, ty: 29 })
  countProp(41, 29, 'se')
  for (let fx = 34; fx <= 37; fx++) {
    objs.push({ type: 'humanFrostFence', tx: fx, ty: 21, role: 'rail' })
    countProp(fx, 21, 'se')
  }
  objs.push({ type: 'humanDecor', key: 'giftBox', tx: 40, ty: 22, tileH: 0.6 })
  countProp(40, 22, 'se')

  // ── 셀프체크 1: 오브젝트-구역 소속(십자 간선은 의도적으로 경계를 가로지르므로 제외) ──
  console.log(
    `[HumanZone 셀프체크] 오브젝트-구역 소속(간선 제외) → ` +
    (oobErrors.length === 0 ? 'PASS (전부 배정된 구역 안)' : `FAIL:\n  ${oobErrors.join('\n  ')}`)
  )

  // ── 셀프체크 2: 마켓 부스 크롭이 winter.png 시트 안에서 실제로 겹치지 않는지 ──
  const standKeys = ['standAlmonds', 'standJewelry', 'standPretzel']
  const standGapLines = []
  for (let i = 0; i < standKeys.length; i++) {
    for (let j = i + 1; j < standKeys.length; j++) {
      const a = HUMAN_WINTER[standKeys[i]], b = HUMAN_WINTER[standKeys[j]]
      const overlapX = a.x < b.x + b.w && b.x < a.x + a.w
      const overlapY = a.y < b.y + b.h && b.y < a.y + a.h
      const overlap = overlapX && overlapY
      const gapX = a.x + a.w <= b.x ? b.x - (a.x + a.w) : (b.x + b.w <= a.x ? a.x - (b.x + b.w) : 0)
      standGapLines.push(
        `${standKeys[i]}↔${standKeys[j]}: ${overlap ? 'FAIL 겹침' : 'OK 안 겹침'}` +
        (overlapY ? ` (같은 행, 시트상 x간격 ${gapX}px)` : ` (다른 행이라 y축으로 이미 분리됨)`)
      )
    }
  }
  console.log(`[HumanZone 셀프체크] 마켓 부스 시트 크롭 간격 →\n  ${standGapLines.join('\n  ')}`)

  // ── 셀프체크 3: 랜드마크/결절점 건물이 자기 block 경계 안에 있는가(지붕 없이
  // 통짜 스프라이트라 Urban의 URBAN_ROOF_H 같은 여유는 필요 없음) ──
  const buildingErrors = []
  ;[
    ['supam', HUMAN_WINTER.buildings.supam, 35, 3, 7, 'ne'],
    ['library', HUMAN_WINTER.buildings.library, 4, 21, 6, 'sw'],
    ['bakery', HUMAN_WINTER.buildings.bakery, 20, 21, 5, 'smid'],
    ['hippie', HUMAN_WINTER.buildings.hippie, 4, 2, 6, 'nw'],
    ['pub', HUMAN_WINTER.buildings.pub, 8, 11, 5, 'nw'],
  ].forEach(([id, sprite, tx, ty, tileH, block]) => {
    const scale = (tileH * TILE) / sprite.h
    const renderW = Math.ceil((sprite.w * scale) / TILE)
    const b = HUMAN_BLOCKS[block]
    if (tx < b.x0 || tx + renderW - 1 > b.x1 || ty < b.y0 || ty + tileH > b.y1) {
      buildingErrors.push(`${id}(${block}) 발자국(${tx},${ty})~(${tx + renderW - 1},${Math.ceil(ty + tileH)})가 block(${b.x0},${b.y0})-(${b.x1},${b.y1}) 밖`)
    }
  })
  console.log(
    `[HumanZone 셀프체크] 랜드마크/결절점/구역 건물 5동 block 경계 → ` +
    (buildingErrors.length === 0 ? 'PASS (전부 자기 block 안)' : `FAIL:\n  ${buildingErrors.join('\n  ')}`)
  )

  // ── 셀프체크 4: 오브젝트 개수 + 구역별 밀도 ──
  const byType = {}
  objs.forEach(o => { if (o.type.startsWith('human')) byType[o.type] = (byType[o.type] || 0) + 1 })
  console.log(
    `[HumanZone 셀프체크] 배치 개수 → 건물 5동(랜드마크2+결절점 bakery1+구역2), ` +
    `결절점 소품(부스3+진저브레드+눈사람+빙판+벤치2) ${(byType.humanStand||0)+(byType.humanGingerbread||0)+(byType.humanSnowman||0)+(byType.humanRink||0)+(byType.humanBench||0)}개, ` +
    `나무 ${byType.humanTree||0}그루, 간선(HUMAN_STREET) 타일 ${byType.humanPath||0}칸`
  )
  console.log(
    `[HumanZone 셀프체크] block별 오브젝트 밀도 → ` +
    Object.entries(HUMAN_BLOCKS).map(([id, b]) => `${id}(${b.kind}):${propCount[id] || 0}개`).join(', ')
  )

  // ── 셀프체크 5: 맵 유효범위 밖 배치 여부 ──
  const rangeErrors = objs.filter(o => o.type.startsWith('human') &&
    (o.tx < 2 || o.tx > 45 || o.ty < 2 || o.ty > 33))
  console.log(`[HumanZone 셀프체크] 맵 유효범위(2~45,2~33) 밖 배치 → ${rangeErrors.length}개`)
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
    // 마을 외곽 테두리 나무(4변 forest strip)는 "너무 난잡하다"는 피드백으로
    // 전부 걷어냈다 — 세팅을 처음부터 다시 잡을 예정이라 지금은 나무 없이
    // 빈 잔디만 남겨둔다. 재설계할 때 여기부터 다시 채워 넣을 것.
    buildAnimalZone(objs)
  }

  if (zone === 'Human') {
    buildHumanZone(objs)
  }

  if (zone === 'Nature') {
    buildNatureZone(objs)
  }

  if (zone === 'Urban') {
    buildUrbanZone(objs)
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

  // Lab("미지의 소리 마을")은 더 이상 objs 기반 가구를 쓰지 않는다 — 던전풍 배경
  // 전체가 labDungeonData.js + <LabDungeonMap/>(타일 렌더러)로 그려진다.

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
   Lab 던전 타일 렌더러 — labDungeonData.js(Dungeon1.tmx 원본 좌표)를 실제 스프라이트로
   그린다. 정적 타일(~2400개)은 애니메이션이 없으므로 마운트 후 한 번만 렌더링하고
   게임 루프의 60fps tick에 반응하지 않게 memo(항상 true)로 고정 — 물결/횃불처럼
   실제로 움직이는 타일만 자체 150ms 인터벌로 별도 렌더링해 리렌더 비용을 최소화한다.
───────────────────────────────────────────── */
const LAB_SHEET_ARR = SHEET_CODES.map(k => LAB_DUNGEON_SHEET_META[k])
function labTileSprite(sheetCode, col, row) {
  const meta = LAB_SHEET_ARR[sheetCode]
  return { ...meta, x: col * 16, y: row * 16, w: 16, h: 16 }
}
// row = [tx, ty, sheetCode, col, tileRow, animLocalId(-1=없음)] — animLocalId가 있으면
// LAB_ANIM[sheetCode][animLocalId]에서 현재 frame(150ms 주기 순환)의 col/row를 대신 쓴다.
function LabAnimatedTile({ row, frame }) {
  const [tx, ty, sheetCode, col, tileRow, animId] = row
  let sc = col, sr = tileRow
  const frames = animId !== -1 ? LAB_ANIM[sheetCode]?.[animId] : null
  if (frames && frames.length) {
    const f = frames[frame % frames.length]
    sc = f[0]; sr = f[1]
  }
  return <LabSprite x={tx * TILE} y={ty * TILE} sprite={labTileSprite(sheetCode, sc, sr)} scale={2}/>
}

const LabDungeonFixed = memo(function LabDungeonFixed() {
  const fixed = useMemo(() => LAB_STATIC.filter(row => row[5] === -1), [])
  return (
    <>
      {fixed.map((row, i) => {
        const [tx, ty, sheetCode, col, tileRow] = row
        return <LabSprite key={i} x={tx * TILE} y={ty * TILE} sprite={labTileSprite(sheetCode, col, tileRow)} scale={2}/>
      })}
    </>
  )
}, () => true)

function useAnimFrame(intervalMs) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return frame
}

// 물결/물가 반짝임 — 정적 레이어에서 애니메이션 있는 타일만 뽑아 150ms마다 자체 갱신
function LabDungeonWaterAnim() {
  const frame = useAnimFrame(150)
  const animated = useMemo(() => LAB_STATIC.filter(row => row[5] !== -1), [])
  return (
    <>
      {animated.map((row, i) => <LabAnimatedTile key={i} row={row} frame={frame}/>)}
    </>
  )
}

// 횃불/화로 — 마을 조명 포인트, 150ms마다 프레임 순환
function LabDungeonTorches() {
  const frame = useAnimFrame(150)
  return (
    <>
      {LAB_TORCHES.map((row, i) => <LabAnimatedTile key={i} row={row} frame={frame}/>)}
    </>
  )
}

// 신비 장치(원본 트랩)·문/상자/항아리/술통 등 소품 — idle 프레임 고정, 정적이라 한 번만 렌더링
const LabDungeonProps = memo(function LabDungeonProps() {
  return (
    <>
      {LAB_TRAPS.map((row, i) => {
        const [tx, ty, sheetCode, col, tileRow] = row
        return <LabSprite key={`trap-${i}`} x={tx * TILE} y={ty * TILE} sprite={labTileSprite(sheetCode, col, tileRow)} scale={2}/>
      })}
      {LAB_PROPS.map((row, i) => {
        const [tx, ty, sheetCode, col, tileRow] = row
        return <LabSprite key={`prop-${i}`} x={tx * TILE} y={ty * TILE} sprite={labTileSprite(sheetCode, col, tileRow)} scale={2}/>
      })}
    </>
  )
}, () => true)

function LabDungeonMap() {
  return (
    <>
      <LabDungeonFixed/>
      <LabDungeonWaterAnim/>
      <LabDungeonTorches/>
      <LabDungeonProps/>
    </>
  )
}

/* ─────────────────────────────────────────────
   Animal Zone 전용 — 사용자가 그려준 손그림 지도 기반 재설계. 굽이치는 단일
   오솔길 대신, coop/bunny 남쪽의 빈 공터에 사각 루프(순환로)를 두고 거기서
   각 마당 게이트·지도 가장자리·입구로 가지가 뻗어나가는 구조로 바꿨다.
   - LOOP: 닫힌 사각형 하나 (좌상 (15,14) 기준 x15-26, y14-26).
   - BRANCH들은 전부 LOOP 위의 한 점에서 시작해 각 목적지로 뻗는다:
     coop/bunny/cow/sheepGoat/pig 5개 게이트 전부 각 가지 끝점과 정확히
     맞닿아 있어야 한다(셀프체크 3번, GATE-NOT-ON-PATH).
   - cow·pig 쪽 가지는 Coop↔Barn 경계 숲(x≈27, gap y 12.45~15.3)을 지날 때
     반드시 y=14 한 줄로만 가로지른 뒤에 위/옆으로 꺾는다 — 숲 중심선(x=27)을
     따라 세로로 오래 붙어가면 나무 군집과 겹칠 위험이 커서 피한다.
   사각형 타일이 아니라 SVG path + 블러 이중 스트로크로 그려서 가장자리가
   잔디와 부드럽게 섞이게 하는 방식은 그대로 유지하되, 손그림처럼 각지고
   또렷한 느낌을 살리려고 구간 내 sine 흔들림(wave)은 넣지 않는다.
───────────────────────────────────────────── */
const ANIMAL_PATH_LOOP = [
  { tx:15, ty:14 }, { tx:15, ty:26 }, { tx:26, ty:26 }, { tx:26, ty:14 }, { tx:15, ty:14 },
]
const ANIMAL_PATH_BRANCHES = [
  [{ tx:15, ty:14 }, { tx:15, ty:12 }, { tx:15, ty:7 }, { tx:15, ty:3 }],      // 북쪽 — coopBirds 게이트 지나 Coop 건물 앞까지 쭉
  [{ tx:23, ty:14 }, { tx:23, ty:11 }, { tx:23, ty:7 }, { tx:23, ty:4 }],      // 북쪽 — bunny 게이트 지나 마당 훨씬 위쪽까지 쭉
  [{ tx:26, ty:14 }, { tx:27, ty:14 }, { tx:33, ty:14 }, { tx:33, ty:11 }],     // 경계 숲 틈 통과 — cow 게이트
  [{ tx:33, ty:14 }, { tx:33, ty:9 }, { tx:37, ty:9 }, { tx:41, ty:9 }, { tx:41, ty:13 }], // Silo/Mill 옆 지나 pig 게이트
  [{ tx:37, ty:9 }, { tx:37, ty:18 }, { tx:44, ty:18 }],                       // Silo/Mill 갈림점에서 Chest 옆을 지나 pig 남쪽 울타리까지 — 예전엔 여기가 뚝 끊긴 채였음
  [{ tx:26, ty:22 }, { tx:33, ty:22 }],                                        // 동쪽 — sheepGoat 게이트(경계 숲 남쪽이라 틈 불필요)
  // 게이트로 안 이어지는 가지들은 중간에서 동그랗게 뚝 끊기지 않도록 실제 지도
  // 가장자리(tx=0 / ty=35)까지 전부 연결한다 — 테두리 숲의 틈(gap) 좌표와 맞춰서
  // 나무에 안 막히고 빠져나간다.
  [{ tx:15, ty:17 }, { tx:0,  ty:17 }],                                        // 서쪽 — 지도 왼쪽 끝(테두리 숲 틈)
  [{ tx:15, ty:26 }, { tx:13, ty:26 }, { tx:13, ty:35 }],                      // 남서쪽 — 지도 아래쪽 끝(테두리 숲 보조 틈). 대각선 구간은
                                                                                // 폭 고정 이후에도 T자 접합부에서 틈이 남아 격자(직각)로 바꿈
  [{ tx:22, ty:26 }, { tx:24, ty:26 }, { tx:24, ty:35 }],                      // 남쪽 — 입구. 위와 같은 이유로 대각선 대신 직각으로 꺾음
]
const ANIMAL_PATH_SEGMENTS = [ANIMAL_PATH_LOOP, ...ANIMAL_PATH_BRANCHES]
// 셀프체크(게이트가 동선 근처인가)는 이 flat 목록으로 거리 계산만 하면 되므로
// 렌더링용 세그먼트 구조와 별개로 모든 점을 한 번 펼쳐서 남겨둔다.
const ANIMAL_PATH_WAYPOINTS = ANIMAL_PATH_SEGMENTS.flat()

// tx,ty(타일 단위) 점 하나가 선분 ab(역시 타일 단위)로부터 얼마나 떨어져 있는지.
function pointSegDistTiles(tx, ty, a, b) {
  const dx = b.tx - a.tx, dy = b.ty - a.ty
  const lenSq = dx * dx + dy * dy
  const t = lenSq ? Math.max(0, Math.min(1, ((tx - a.tx) * dx + (ty - a.ty) * dy) / lenSq)) : 0
  const cx = a.tx + t * dx, cy = a.ty + t * dy
  return Math.hypot(tx - cx, ty - cy)
}

// AnimalPath가 실제로 그려지는 폭(대략 centerline 기준 ±1타일 + 가장자리 술 장식)
// 바깥으로 여유를 둔 반경 — 이 안쪽 타일은 sound item 배치 대상에서 제외해서
// 초록 아이템 파우치가 흙길 위에 노이즈처럼 올라앉지 않게 한다.
const ANIMAL_PATH_EXCLUDE_RADIUS = 1.6
function isNearAnimalPath(tx, ty, radius = ANIMAL_PATH_EXCLUDE_RADIUS) {
  return ANIMAL_PATH_SEGMENTS.some(seg => {
    for (let i = 0; i < seg.length - 1; i++) {
      if (pointSegDistTiles(tx, ty, seg[i], seg[i + 1]) <= radius) return true
    }
    return false
  })
}

// 폭을 sin 파형으로 넓혔다 좁혔다 하는 "유기적" 버전을 써봤지만, 가지(branch)가
// LOOP 변의 중간 지점(꼭짓점이 아닌 곳, 예: bunny/coopBirds 게이트)에 붙는
// T자 접합부에서는 그 변의 폭이 하필 파형 때문에 좁아지는 지점과 겹치기 쉬워서,
// 가지가 붙는 자리 바로 옆에 잔디가 삼각형/사각형으로 파고든 것처럼 보이는 틈이
// 반복적으로 생겼다(사용자 피드백: "길과 잔디의 구분을 명확하게"). 폭을 고정값으로
// 바꿔서 이 틈을 원천적으로 없앤다 — 길은 항상 baseHalf*2 폭을 유지한다.
function organicSegment(a, b, { baseHalf = TILE * 0.8 } = {}) {
  const ax = a.tx * TILE, ay = a.ty * TILE, bx = b.tx * TILE, by = b.ty * TILE
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux
  const left = [
    `${ax + nx * baseHalf} ${ay + ny * baseHalf}`,
    `${bx + nx * baseHalf} ${by + ny * baseHalf}`,
  ]
  const right = [
    `${ax - nx * baseHalf} ${ay - ny * baseHalf}`,
    `${bx - nx * baseHalf} ${by - ny * baseHalf}`,
  ]
  return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`
}

// 구간이 꺾이는 모든 지점(코너·분기점·게이트 끝)에 정사각형을 하나씩 얹어서, 서로
// 다른 방향의 폭-변주 폴리곤 두 개가 만나는 자리에 생기는 틈을 메운다.
// 꼭짓점 순서(반시계 방향)를 organicSegment의 사각형과 같은 방향으로 맞춰야 한다 —
// 방향이 반대면 겹치는 자리에서 nonzero fill-rule의 winding이 서로 상쇄되어(+1-1=0)
// 오히려 구멍이 뚫려서 길이 뚝뚝 끊긴 것처럼 보인다(실제로 발생했던 버그).
function jointSquare(p, half = TILE * 0.8) {
  const cx = p.tx * TILE, cy = p.ty * TILE
  return `M ${cx - half} ${cy - half} L ${cx - half} ${cy + half} L ${cx + half} ${cy + half} L ${cx + half} ${cy - half} Z`
}

function AnimalPath() {
  // 루프+가지를 별개의 <path> 여러 개로 나눠 그리면, 교차점마다 서로 다른 폴리곤의
  // 안티앨리어싱된 가장자리가 겹쳐 칠해진다 — 카메라가 캐릭터를 따라 매 프레임
  // 서브픽셀 단위로 움직이면 그 겹친 가장자리의 블렌딩 결과가 프레임마다 미세하게
  // 달라져서 "지지직"거리는 것처럼 보인다. 모든 조각을 하나의 <path> d 안에 여러
  // 서브패스(M...Z)로 합쳐서 채우기를 한 번만 칠하면 겹침 자체가 없어진다.
  const segParts = ANIMAL_PATH_SEGMENTS.flatMap(seg => {
    const parts = []
    for (let i = 0; i < seg.length - 1; i++) parts.push(organicSegment(seg[i], seg[i + 1]))
    return parts
  })
  const jointParts = ANIMAL_PATH_SEGMENTS.flatMap(seg => seg.map(p => jointSquare(p)))
  const d = [...segParts, ...jointParts].join(' ')
  return <path d={d} fill="url(#animalPathTexture)"/>
}

/* ─────────────────────────────────────────────
   Nature Zone 전용 길/연못. 다리가 지나가는 자리(연못 서쪽 진입로 끝~동쪽 출구)는
   길을 그리지 않고 <natureBridge> 오브젝트가 대신 그 구간을 담당한다 — 안 그러면
   흙길 폴리곤이 연못 위를 그대로 덮어버려서 물이 하나도 안 보이게 된다.
───────────────────────────────────────────── */
const NATURE_PATH_SEGMENTS = [
  [{ tx:24, ty:35 }, { tx:24, ty:4 }],                        // 트렁크 — 어두운목재·빅토리안 마당을 그대로 관통 (x=24는 공용 입구 마커와도 일치)
  [{ tx:24, ty:4 },  { tx:38, ty:4 }, { tx:38, ty:6 }],        // 초록지붕 방향
  [{ tx:24, ty:14 }, { tx:9,  ty:14 }, { tx:9, ty:10 }],       // 기본형(크림) 방향
  [{ tx:24, ty:17 }, { tx:35, ty:17 }],                        // 다리 서쪽 진입로
  [{ tx:38, ty:20 }, { tx:38, ty:24 }],                        // 다리 동쪽 출구 → 오두막
]
const NATURE_POND_C = { tx:38, ty:17.5 }
const NATURE_POND_R = { rx:2.8, ry:1.8 }
const NATURE_PATH_EXCLUDE_RADIUS = 1.6

function isNearNaturePath(tx, ty, radius = NATURE_PATH_EXCLUDE_RADIUS) {
  const nx = (tx - NATURE_POND_C.tx) / (NATURE_POND_R.rx + 1.5)
  const ny = (ty - NATURE_POND_C.ty) / (NATURE_POND_R.ry + 1.5)
  if (nx * nx + ny * ny <= 1) return true // 연못 + 여유분
  return NATURE_PATH_SEGMENTS.some(seg => {
    for (let i = 0; i < seg.length - 1; i++) {
      if (pointSegDistTiles(tx, ty, seg[i], seg[i + 1]) <= radius) return true
    }
    return false
  })
}

function NaturePath() {
  const segParts = NATURE_PATH_SEGMENTS.flatMap(seg => {
    const parts = []
    for (let i = 0; i < seg.length - 1; i++) parts.push(organicSegment(seg[i], seg[i + 1]))
    return parts
  })
  const jointParts = NATURE_PATH_SEGMENTS.flatMap(seg => seg.map(p => jointSquare(p)))
  const d = [...segParts, ...jointParts].join(' ')
  return <path d={d} fill="url(#animalPathTexture)"/>
}

function NatureWater() {
  const cx = NATURE_POND_C.tx * TILE, cy = NATURE_POND_C.ty * TILE
  const rx = NATURE_POND_R.rx * TILE, ry = NATURE_POND_R.ry * TILE
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#natureWaterTexture)"/>
}

// Urban Zone 바닥 레이어 — 도로/인도/횡단보도/차선은 넓은 면적이라 objs가 아니라
// NatureWater/NaturePath와 같은 방식(패턴 채우기 rect)으로 직접 그린다. 패턴
// 자체는 아래 메인 렌더 트리의 <defs>에서 URBAN_KENNEY_GROUND 좌표로 정의한다.
function UrbanRoadNetwork() {
  const { vA, vB, h } = URBAN_ROAD
  const iy0 = h.y0, iy1 = h.y1
  const bandRect = (r, fill, key) => (
    <rect key={key} x={r.x0 * TILE} y={r.y0 * TILE}
      width={(r.x1 - r.x0 + 1) * TILE} height={(r.y1 - r.y0 + 1) * TILE} fill={fill}/>
  )
  const laneDashSprite = URBAN_KENNEY_GROUND.laneDash
  const dashOffset = (TILE - laneDashSprite.w * URBAN_SCALE) / 2
  const hDashTy = Math.round((h.y0 + h.y1) / 2)
  const nearAnyV = (tx) => [vA, vB].some(v => tx >= v.x0 - 2 && tx <= v.x1 + 2)
  const vDashes = []
  ;[vA, vB].forEach(v => {
    const tx = Math.round((v.x0 + v.x1) / 2)
    for (let ty = 3; ty <= 32; ty += 3) { if (ty >= iy0 - 2 && ty <= iy1 + 2) continue; vDashes.push({ tx, ty }) }
  })
  const hDashes = []
  for (let tx = 3; tx <= 44; tx += 3) { if (nearAnyV(tx)) continue; hDashes.push(tx) }

  // ── 인도/도로 경계 커브(Sample.png 참고) — 체커무늬+경계선 스트립(16×5, 인도
  // 쪽이 위/도로 쪽이 아래인 "남향" 원본)을 블록의 어느 변이 도로와 맞닿는지에
  // 따라 rotate로 4방향을 만든다: 도로가 블록 아래(북쪽 블록들) → 180도로
  // 뒤집어 경계선이 아래로, 도로가 블록 위(남쪽 블록들) → 원본 그대로, 도로가
  // 블록 오른쪽(서쪽 블록들) → 90도로 경계선이 오른쪽, 도로가 블록 왼쪽(동쪽
  // 블록들) → -90도로 경계선이 왼쪽. 골목(URBAN_ALLEYS)이 뚫린 x열은 이미
  // 도로 포장이라 커브를 건너뛴다.
  const CURB = URBAN_KENNEY_GROUND.curbEdge
  const curbW = CURB.w * URBAN_SCALE
  const curbT = CURB.h * URBAN_SCALE
  const inAnyAlleyX = (tx) => Object.values(URBAN_ALLEYS).some(a => tx >= a.x0 && tx <= a.x1)
  const curbs = []
  Object.entries(URBAN_BLOCKS).forEach(([id, b]) => {
    if (b.y1 + 1 === h.y0) {
      const cy = (b.y1 + 1) * TILE - curbT / 2
      for (let tx = b.x0; tx <= b.x1; tx++) {
        if (inAnyAlleyX(tx)) continue
        const cx = tx * TILE + curbW / 2
        curbs.push(
          <g key={`curb-s-${id}-${tx}`} transform={`rotate(180 ${cx} ${cy})`}>
            <LabSprite x={cx - curbW / 2} y={cy - curbT / 2} sprite={CURB} scale={URBAN_SCALE}/>
          </g>
        )
      }
    }
    if (b.y0 - 1 === h.y1) {
      const y = b.y0 * TILE
      for (let tx = b.x0; tx <= b.x1; tx++) {
        curbs.push(<LabSprite key={`curb-n-${id}-${tx}`} x={tx * TILE} y={y} sprite={CURB} scale={URBAN_SCALE}/>)
      }
    }
    ;[vA, vB].forEach((v, vi) => {
      if (b.x1 + 1 === v.x0) {
        const cx = v.x0 * TILE - curbT / 2
        for (let ty = b.y0; ty <= b.y1; ty++) {
          const cy = ty * TILE + curbW / 2
          curbs.push(
            <g key={`curb-e-${id}-${vi}-${ty}`} transform={`rotate(90 ${cx} ${cy})`}>
              <LabSprite x={cx - curbW / 2} y={cy - curbT / 2} sprite={CURB} scale={URBAN_SCALE}/>
            </g>
          )
        }
      }
      if (b.x0 - 1 === v.x1) {
        const cx = b.x0 * TILE + curbT / 2
        for (let ty = b.y0; ty <= b.y1; ty++) {
          const cy = ty * TILE + curbW / 2
          curbs.push(
            <g key={`curb-w-${id}-${vi}-${ty}`} transform={`rotate(-90 ${cx} ${cy})`}>
              <LabSprite x={cx - curbW / 2} y={cy - curbT / 2} sprite={CURB} scale={URBAN_SCALE}/>
            </g>
          )
        }
      }
    })
  })

  // 교차로 2곳(vA×h, vB×h) 각각에 횡단보도 4방향 — N/S는 가로줄무늬(urbanCrosswalkH),
  // E/W는 세로줄무늬(urbanCrosswalkV, 같은 크롭을 rotate(90)로 미리 돌려둔 패턴).
  const crosswalks = []
  ;[vA, vB].forEach((v, i) => {
    crosswalks.push(<rect key={`cw-n-${i}`} x={v.x0 * TILE} y={(iy0 - 1) * TILE} width={(v.x1 - v.x0 + 1) * TILE} height={TILE} fill="url(#urbanCrosswalkH)"/>)
    crosswalks.push(<rect key={`cw-s-${i}`} x={v.x0 * TILE} y={(iy1 + 1) * TILE} width={(v.x1 - v.x0 + 1) * TILE} height={TILE} fill="url(#urbanCrosswalkH)"/>)
    crosswalks.push(<rect key={`cw-w-${i}`} x={(v.x0 - 1) * TILE} y={iy0 * TILE} width={TILE} height={(iy1 - iy0 + 1) * TILE} fill="url(#urbanCrosswalkV)"/>)
    crosswalks.push(<rect key={`cw-e-${i}`} x={(v.x1 + 1) * TILE} y={iy0 * TILE} width={TILE} height={(iy1 - iy0 + 1) * TILE} fill="url(#urbanCrosswalkV)"/>)
  })

  return (
    <>
      {/* 6구역을 통째로 인도로 먼저 채우고, 그 위에 도로/골목/주차장(도로 텍스처)을
          덧칠한다 — 그리는 순서가 곧 우선순위라 road가 항상 sidewalk 위에 보인다. */}
      {Object.entries(URBAN_BLOCKS).map(([id, r]) => bandRect(r, 'url(#urbanSidewalkTexture)', `blk-${id}`))}
      {bandRect(vA, 'url(#urbanRoadTexture)', 'road-va')}
      {bandRect(vB, 'url(#urbanRoadTexture)', 'road-vb')}
      {bandRect(h, 'url(#urbanRoadTexture)', 'road-h')}
      {Object.entries(URBAN_ALLEYS).map(([id, r]) => bandRect(r, 'url(#urbanRoadTexture)', `alley-${id}`))}
      {/* 주차장(smid)은 도로가 아니라 인도 위 주차 공간이라, 위에서 이미 깔린
          urbanSidewalkTexture를 그대로 두고 도로 텍스처는 덧칠하지 않는다 —
          이전엔 다른 도로 구간과 똑같은 urbanRoadTexture를 써서 시각적으로
          "도로"처럼 보였다(사용자 리포트로 확인). */}

      {crosswalks}
      {curbs}

      {/* 차선 중앙 점선 — 사거리 근처(±2타일)는 건너뛴다 */}
      {vDashes.map(({ tx, ty }) => (
        <LabSprite key={`vd-${tx}-${ty}`} x={tx * TILE + dashOffset} y={ty * TILE} sprite={laneDashSprite} scale={URBAN_SCALE}/>
      ))}
      {hDashes.map(tx => (
        <g key={`hd-${tx}`} transform={`rotate(90 ${tx * TILE + TILE / 2} ${hDashTy * TILE + TILE / 2})`}>
          <LabSprite x={tx * TILE + dashOffset} y={hDashTy * TILE} sprite={laneDashSprite} scale={URBAN_SCALE}/>
        </g>
      ))}
    </>
  )
}

// 나무 스프라이트 소스 — "100 Nature Things"(WORLD_NATURE.trees, 10종·32×32)만
// 쓰지 않고, Cozy Farm 팩 자체 나무(tree1/tree2/pine, 32×64)도 섞어서 변주를
// 늘린다. WORLD_TILESET.decor.*는 시트 정보가 없어서(fence/bush와 동일한 이유)
// 직접 합쳐준다.
// nature.png의 10종 중 8·9번(검은 뒤틀린 나무·앙상한 고사목)은 스산한
// 분위기라 Lab존에는 어울려도 활기찬 목장 배경엔 안 맞아서 제외 — 나머지
// 8종(참나무류/자작/소나무/단풍/벚꽃)만 Farm 팩 나무 3종과 섞는다.
const ANIMAL_TREE_SOURCES = [
  ...WORLD_NATURE.trees.slice(0, 8),
  ...['tree1', 'tree2', 'pine'].map(k => ({
    src: WORLD_TILESET.src, sheetW: WORLD_TILESET.sheetW, sheetH: WORLD_TILESET.sheetH,
    ...WORLD_TILESET.decor[k],
  })),
]

/* ─────────────────────────────────────────────
   오브젝트 렌더러 (Zone별 픽셀 아트 요소)
───────────────────────────────────────────── */
function ZoneObject({ obj, zone, tick }) {
  const x = obj.tx * TILE
  const y = obj.ty * TILE
  const T = TILE
  const meta = ZONE_META[zone]

  if (obj.type === 'tree') {
    // 프로시저럴(rect/ellipse로 손그린) 나무는 전면 삭제 — 나무/자연 두 팩의
    // 실사 스프라이트만 섞어 쓴다. WorldMap의 PixelTree와 같은 방식으로
    // 발치를 타일 하단에 맞춰 정렬한다(팩마다 스프라이트 크기가 달라도 동일 기준).
    // obj.scale(포아송 배치가 준 0.85~1.15배 변주) × big(중심목 확대)를 곱해서
    // 크기를, obj.flip으로 좌우 반전을 줘서 같은 스프라이트가 반복되는 느낌을 줄인다.
    const sprite = ANIMAL_TREE_SOURCES[obj.variant % ANIMAL_TREE_SOURCES.length]
    const scale = 1.4 * (obj.scale ?? 1) * (obj.big ? 1.4 : 1)
    const sx = x - (sprite.w * scale - T) / 2
    const sy = y - sprite.h * scale + T
    const cx = sx + (sprite.w * scale) / 2
    return (
      <g>
        <ellipse cx={x + T/2} cy={y + T - 3} rx={T*(obj.big?0.42:0.32)} ry={obj.big?7:5} fill="#00000022"/>
        <g transform={obj.flip ? `translate(${cx * 2},0) scale(-1,1)` : undefined}>
          <LabSprite x={sx} y={sy} sprite={sprite} scale={scale}/>
        </g>
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

  if (obj.type === 'natureHouse') {
    const sprite = NATURE_VILLAGE_TILESET.houses[obj.key]
    if (!sprite) return null
    const scale = (obj.tileH * T) / sprite.h
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 3} rx={sprite.w*scale*0.4} ry={5} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'natureFenceRail') {
    return <LabSprite x={x} y={y} sprite={ANIMAL_ZONE_TILESET.fenceRail} scale={1}/>
  }
  if (obj.type === 'natureFencePost') {
    const post = ANIMAL_ZONE_TILESET.fencePost
    return <LabSprite x={x + (T - post.w) / 2} y={y} sprite={post} scale={1}/>
  }
  if (obj.type === 'natureFenceCorner') {
    return <LabSprite x={x} y={y} sprite={NATURE_VILLAGE_TILESET.fenceCorner} scale={1}/>
  }
  if (obj.type === 'natureFenceGate') {
    return <LabSprite x={x} y={y} sprite={NATURE_VILLAGE_TILESET.fenceGate} scale={1}/>
  }

  /* ── Human Zone("사람 마을") Winter 리스킨 — natureHouse와 동일한 "tileH만큼
     세로로 맞춰 스케일 계산 + 발치 그림자" 패턴을 그대로 재사용한다(건물 하나가
     통짜 스프라이트라 조립이 필요 없음, 1단계에서 확인 완료). humanBuilding은
     nested(HUMAN_WINTER.buildings) 조회 + 그림자, humanStand/humanGingerbread/
     humanSnowman/humanLamp/humanTree는 flat(HUMAN_WINTER) 조회 + 타일 하단-중앙
     앵커(그림자 없음, 소품이 작아 생략)로 구분한다. ── */
  if (obj.type === 'humanBuilding') {
    const sprite = HUMAN_WINTER.buildings[obj.key]
    if (!sprite) return null
    const scale = (obj.tileH * T) / sprite.h
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 3} rx={sprite.w*scale*0.4} ry={5} fill="#00000030"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (['humanStand', 'humanGingerbread', 'humanSnowman', 'humanLamp', 'humanTree', 'humanDecor'].includes(obj.type)) {
    const sprite = HUMAN_WINTER[obj.key]
    if (!sprite) return null
    const scale = (obj.tileH * T) / sprite.h
    const sx = x - (sprite.w * scale - T) / 2 // 타일 폭 중앙 정렬
    const sy = y + T - sprite.h * scale        // 타일 바닥 기준 앵커
    return <LabSprite x={sx} y={sy} sprite={sprite} scale={scale}/>
  }
  if (obj.type === 'humanFrostFence') {
    if (obj.role === 'post') {
      const s = HUMAN_WINTER.frostFencePost
      return <LabSprite x={x + (T - s.w) / 2} y={y + T - s.h} sprite={s} scale={1}/>
    }
    // rail은 8px 폭 낱장 — LIBRARY_YARD와 동일하게 타일 폭(32px)을 4번 반복해 채운다.
    const s = HUMAN_WINTER.frostFenceRail
    const reps = Math.round(T / s.w)
    return (
      <>
        {Array.from({ length: reps }, (_, i) => (
          <LabSprite key={i} x={x + i * s.w} y={y + T - s.h} sprite={s} scale={1}/>
        ))}
      </>
    )
  }
  if (obj.type === 'humanPath') {
    // HUMAN_FROST_PATH는 32×32 = TILE 순정 크기라 스케일 계산 없이 그대로 한 칸에 하나.
    return <LabSprite x={x} y={y} sprite={HUMAN_FROST_PATH} scale={1}/>
  }
  if (obj.type === 'humanRink') {
    // 빙판(iceRink) — 건물처럼 발치 그림자를 넣지 않고, 바닥에 평평하게 깔린
    // 장식(natureBridge의 물타일과 같은 취급)이라 top-left 앵커로 그대로 놓는다.
    const sprite = HUMAN_WINTER.iceRink
    const scale = (obj.tileW * T) / sprite.w
    return <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
  }
  if (obj.type === 'humanBench') {
    // NATURE_VILLAGE_TILESET.bench(terrain-town.png, 이미 알파 스캔 검증된 좌표) 재사용.
    const sprite = NATURE_VILLAGE_TILESET.bench
    return (
      <g>
        <ellipse cx={x + sprite.w/2} cy={y + sprite.h + 2} rx={sprite.w*0.6} ry={3} fill="#00000030"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={1}/>
      </g>
    )
  }

  if (obj.type === 'natureBridge') {
    // 연못을 가로지르는 나무 난간 3칸 — 밑에 town 연못 타일을 깔고 그 위에 난간을 얹어서,
    // 난간 스프라이트의 투명한 위/아래 틈으로도 물이 비쳐 보이게 한다.
    return (
      <g>
        {[0, 1, 2].map(i => (
          <LabSprite key={i} x={x + i*T} y={y} sprite={NATURE_VILLAGE_TILESET.waterPond} scale={2}/>
        ))}
        {[0, 1, 2].map(i => (
          <LabSprite key={i} x={x + i*T} y={y} sprite={NATURE_VILLAGE_TILESET.bridgeRailing} scale={1}/>
        ))}
      </g>
    )
  }
  if (obj.type === 'natureBench') {
    const sprite = NATURE_VILLAGE_TILESET.bench
    return (
      <g>
        <ellipse cx={x + sprite.w} cy={y + sprite.h + 2} rx={sprite.w*0.7} ry={3} fill="#00000033"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={1}/>
      </g>
    )
  }
  if (obj.type === 'natureTree') {
    // 꽃 장식(natureFlower)과 크기가 같아서 구분이 안 된다는 피드백 — 1.5배로 키운다.
    // 타일 상단 기준(x,y) 그대로 키우면 나무가 오른쪽/아래로 밀려나므로, 밑동을 타일
    // 하단-중앙에 고정한 채(bottom+center anchor) 위로 커지게 한다 — 'tree' 타입(Animal
    // Zone 나무)과 동일한 앵커 공식.
    // obj.big/obj.small(조경 재배치 때 클러스터 내부 변주로 추가됨) — 기본 1.5배에서
    // 큰 나무는 1.875배, 작은 나무는 1.17배로 갈라져 한 덩어리 안에서도 단조롭지 않게.
    const sprite = WORLD_NATURE.trees[obj.variant % 8] // 8,9(저주받은나무/고사목)는 제외
    const scale = 1.5 * (obj.big ? 1.25 : obj.small ? 0.78 : 1)
    const sx = x - (sprite.w * scale - T) / 2
    const sy = y - (sprite.h * scale - T)
    return <LabSprite x={sx} y={sy} sprite={sprite} scale={scale}/>
  }
  if (obj.type === 'natureBush') {
    const sprite = WORLD_NATURE.bushes[obj.variant % WORLD_NATURE.bushes.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.6}/>
  }
  if (obj.type === 'natureFlower') {
    const sprite = WORLD_NATURE.flowers[obj.variant % WORLD_NATURE.flowers.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.6}/>
  }
  if (obj.type === 'natureMushroom') {
    const sprite = WORLD_NATURE.mushrooms[obj.variant % WORLD_NATURE.mushrooms.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.6}/>
  }
  if (obj.type === 'natureRock') {
    const sprite = WORLD_NATURE.rocks[obj.variant % WORLD_NATURE.rocks.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.6}/>
  }
  if (obj.type === 'natureInsect') {
    const sprite = WORLD_NATURE.insects[obj.variant % WORLD_NATURE.insects.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.4}/>
  }
  if (obj.type === 'natureButterfly') {
    const sprite = WORLD_NATURE.butterflies[obj.variant % WORLD_NATURE.butterflies.length]
    return <LabSprite x={x} y={y} sprite={sprite} scale={1.4}/>
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

  // ── Urban Zone — Kenney RPG Urban Pack. 원본이 16px 그리드라 게임 TILE(32px)에
  // 맞추려면 항상 scale=2(URBAN_SCALE)를 쓴다 — buildUrbanZone() 셀프체크 로그의
  // "그리드 측정" 항목과 정확히 같은 계산.
  if (obj.type === 'urbanBuildingWall') {
    const sprite = URBAN_KENNEY_BUILDING[obj.wall]
    return <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanRoof') {
    // 벽 블롭(urbanBuildingWall)은 정면 파사드뿐이라 지붕이 없다 — 밀도 리뷰에서
    // 지적받아 추가했는데, 처음엔 내부 칸만 반복 타일링 + 얇은 CSS stroke로
    // "테두리 흉내"만 냈다가 sample.png의 뚜렷한 스캘럽 테두리가 안 보인다는
    // 재지적을 받았다. 실제 테두리 그래픽(코너 4장+변 4장+내부 1장, 9-slice)을
    // 그대로 이어붙이는 방식으로 다시 만들었다 — LabSprite를 격자로 반복 배치.
    const B = URBAN_KENNEY_BUILDING
    const w = obj.w, h = obj.h // 타일 단위
    const cell = T // 16px 원본 × URBAN_SCALE(2) = 32px = 정확히 1 게임타일
    const tile = (sprite, cx, cy) => (
      <LabSprite key={`${cx},${cy}`} x={x + cx * cell} y={y + cy * cell} sprite={sprite} scale={URBAN_SCALE}/>
    )
    const pieces = []
    for (let cx = 0; cx < w; cx++) {
      for (let cy = 0; cy < h; cy++) {
        const edgeX = cx === 0 ? 'L' : cx === w - 1 ? 'R' : 'M'
        const edgeY = cy === 0 ? 'T' : cy === h - 1 ? 'B' : 'M'
        const sprite =
          edgeX === 'L' && edgeY === 'T' ? B.roofTL :
          edgeX === 'R' && edgeY === 'T' ? B.roofTR :
          edgeX === 'L' && edgeY === 'B' ? B.roofBL :
          edgeX === 'R' && edgeY === 'B' ? B.roofBR :
          edgeY === 'T' ? B.roofTop :
          edgeY === 'B' ? B.roofBot :
          edgeX === 'L' ? B.roofL :
          edgeX === 'R' ? B.roofR : B.roofTile
        pieces.push(tile(sprite, cx, cy))
      }
    }
    return <g>{pieces}</g>
  }
  if (obj.type === 'urbanDoor') {
    const sprite = URBAN_KENNEY_BUILDING[obj.sprite]
    return <LabSprite x={x + (T - sprite.w*URBAN_SCALE)/2} y={y + T*0.5} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanWindowWide') {
    const sprite = URBAN_KENNEY_BUILDING.windowWide
    return <LabSprite x={x} y={y + T*0.2} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanWindowSmall') {
    const sprite = URBAN_KENNEY_BUILDING.windowSmall
    return <LabSprite x={x + (T - sprite.w*URBAN_SCALE)/2} y={y + T*0.2} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanAwning') {
    // 캐노피가 문 위쪽 벽에 걸쳐 있는 것처럼 문 행(row) 상단에 붙인다
    // (문 자체는 아래로 T*0.5만큼 내려 그려서 캐노피 밑으로 드러나 보이게).
    const sprite = URBAN_KENNEY_BUILDING.awningGreen
    return <LabSprite x={x} y={y - T*0.1} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanTrafficLight') {
    const sprite = URBAN_KENNEY_PROPS.trafficLight
    return (
      <g>
        <ellipse cx={x + sprite.w*URBAN_SCALE*0.4} cy={y + sprite.h*URBAN_SCALE - 2} rx={6} ry={3} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
      </g>
    )
  }
  if (obj.type === 'urbanVehicle') {
    const sprite = URBAN_KENNEY_VEHICLES[obj.variant % URBAN_KENNEY_VEHICLES.length]
    return (
      <g>
        <ellipse cx={x + sprite.w*URBAN_SCALE/2} cy={y + sprite.h*URBAN_SCALE - 3} rx={sprite.w*URBAN_SCALE*0.42} ry={5} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
      </g>
    )
  }
  if (obj.type === 'urbanParkingBay') {
    return <LabSprite x={x} y={y} sprite={URBAN_KENNEY_GROUND.parkingBay} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanParkingSign') {
    return <LabSprite x={x} y={y} sprite={URBAN_KENNEY_GROUND.parkingSign} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanBikeMark') {
    return <LabSprite x={x} y={y} sprite={URBAN_KENNEY_GROUND.bikeMark} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanBarrier') {
    const barrierSprites = [URBAN_KENNEY_PROPS.barrierA, URBAN_KENNEY_PROPS.barrierB, URBAN_KENNEY_PROPS.barrierRed]
    const sprite = barrierSprites[obj.variant % barrierSprites.length]
    return <LabSprite x={x} y={y + T*0.3} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanGrassPatch') {
    return <LabSprite x={x} y={y} sprite={URBAN_KENNEY_PROPS.grassPatch} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanTree') {
    const sprite = URBAN_KENNEY_TREES[obj.variant]
    return (
      <g>
        <ellipse cx={x + sprite.w*URBAN_SCALE/2} cy={y + sprite.h*URBAN_SCALE - 2} rx={sprite.w*URBAN_SCALE*0.4} ry={5} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
      </g>
    )
  }
  if (obj.type === 'urbanBench') {
    return <LabSprite x={x} y={y + T*0.4} sprite={URBAN_KENNEY_PROPS.bench} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanLamp') {
    const sprite = URBAN_KENNEY_PROPS.lamp
    return (
      <g>
        <ellipse cx={x + sprite.w*URBAN_SCALE*0.4} cy={y + sprite.h*URBAN_SCALE - 4} rx={6} ry={3} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
      </g>
    )
  }
  if (obj.type === 'urbanTrashcan') {
    const sprite = obj.tx % 2 === 0 ? URBAN_KENNEY_PROPS.trashcan : URBAN_KENNEY_PROPS.trashcanRound
    return <LabSprite x={x} y={y + T*0.35} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanSign') {
    const signSprites = { red: URBAN_KENNEY_PROPS.signRed, green: URBAN_KENNEY_PROPS.signGreen, blue: URBAN_KENNEY_PROPS.signBlue }
    const sprite = signSprites[obj.variant] || URBAN_KENNEY_PROPS.signRed
    return <LabSprite x={x} y={y + T*0.15} sprite={sprite} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanPlanter') {
    return <LabSprite x={x} y={y + T*0.35} sprite={URBAN_KENNEY_PROPS.planter} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanFence') {
    return <LabSprite x={x} y={y + T*0.3} sprite={URBAN_KENNEY_PROPS.fence} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanStall') {
    return (
      <g>
        <ellipse cx={x + URBAN_KENNEY_PROPS.stallFruit.w*URBAN_SCALE/2} cy={y + URBAN_KENNEY_PROPS.stallFruit.h*URBAN_SCALE - 2} rx={10} ry={4} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={URBAN_KENNEY_PROPS.stallFruit} scale={URBAN_SCALE}/>
      </g>
    )
  }
  if (obj.type === 'urbanTrashcanFree') {
    return <LabSprite x={x} y={y + T*0.35} sprite={URBAN_KENNEY_PROPS.trashcanRound} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanParkingMeter') {
    return <LabSprite x={x} y={y + T*0.3} sprite={URBAN_KENNEY_PROPS.parkingMeter} scale={URBAN_SCALE}/>
  }
  if (obj.type === 'urbanPedestrian') {
    const sprite = URBAN_KENNEY_PEDESTRIANS[obj.variant % URBAN_KENNEY_PEDESTRIANS.length]
    return (
      <g>
        <ellipse cx={x + sprite.w*URBAN_SCALE/2} cy={y + sprite.h*URBAN_SCALE - 2} rx={sprite.w*URBAN_SCALE*0.35} ry={4} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={URBAN_SCALE}/>
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

  // ── Animal Zone 전용 (Cozy Farm 팩 실사 스프라이트) ──────────────────────
  if (obj.type === 'farmFence') {
    // /fence-test에서 확정: 가로 구간(role='rail')은 가로 레일 그대로, 세로
    // 구간·코너(role='post')는 회전 없이 기둥(16px, 가운데 정렬)을 반복한다.
    if (obj.role === 'post') {
      const post = ANIMAL_ZONE_TILESET.fencePost
      return <LabSprite x={x + (T - post.w) / 2} y={y} sprite={post} scale={1}/>
    }
    return <LabSprite x={x} y={y} sprite={ANIMAL_ZONE_TILESET.fenceRail} scale={1}/>
  }
  if (obj.type === 'bush') {
    // 펜 울타리 단조로움 개선용 소품이면 고정 1칸, 나무 패치가 만든 수풀
    // 군집이면 obj.scale/flip/big으로 변주(포아송 배치 쪽과 동일한 이유).
    const key = obj.variant % 2 === 0 ? 'bush1' : 'bush2'
    const bush = { src: WORLD_TILESET.src, sheetW: WORLD_TILESET.sheetW, sheetH: WORLD_TILESET.sheetH, ...WORLD_TILESET.decor[key] }
    const scale = 1 * (obj.scale ?? 1) * (obj.big ? 1.4 : 1)
    const bx = x - (bush.w * scale - T) / 2
    const cx = bx + (bush.w * scale) / 2
    return (
      <g transform={obj.flip ? `translate(${cx * 2},0) scale(-1,1)` : undefined}>
        <LabSprite x={bx} y={y} sprite={bush} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'greenhouse' || obj.type === 'coopBuilding' || obj.type === 'barnBuilding') {
    const key = obj.type === 'greenhouse' ? 'greenhouse' : obj.type === 'coopBuilding' ? 'coop' : 'barn'
    const sprite = WORLD_FARM_BUILDINGS[key]
    const scale = key === 'greenhouse' ? 1.43 : key === 'coop' ? 2.34 : 1.69
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 4} rx={sprite.w*scale*0.42} ry={6} fill="#00000044"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'silo' || obj.type === 'windmill') {
    const sprite = WORLD_PROPS[obj.type]
    const scale = obj.type === 'silo' ? 1.3 : 1.495
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 2} rx={sprite.w*scale*0.4} ry={5} fill="#00000044"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'farmAnimal') {
    const sprite = WORLD_ANIMALS[obj.species]
    if (!sprite) return null
    const scale = 1.8
    const bob = Math.sin(tick * 0.025 + obj.tx * 1.7 + obj.ty) * 1.2
    return (
      <g transform={`translate(0, ${bob})`}>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 2} rx={sprite.w*scale*0.36} ry={4} fill="#00000040"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'farmProp') {
    const sprite = WORLD_PRODUCE[obj.produce]
    if (!sprite) return null
    const scale = obj.small ? 1.4 : 2
    return (
      <g>
        <ellipse cx={x + (sprite.w*scale)/2} cy={y + sprite.h*scale - 1} rx={sprite.w*scale*0.4} ry={3} fill="#00000033"/>
        <LabSprite x={x} y={y} sprite={sprite} scale={scale}/>
      </g>
    )
  }
  if (obj.type === 'farmIcon') {
    // 펜당 최대 1개, pen.bounds 중앙 상단 고정 위치 — 살짝 위아래로만 숨쉬듯 움직인다.
    const sprite = WORLD_PRODUCE[obj.produce]
    if (!sprite) return null
    const bob = Math.sin(tick * 0.03 + obj.tx) * 2
    return (
      <g transform={`translate(${x + T/2}, ${y - 16 + bob})`}>
        <rect x="-14" y="-15" width="28" height="20" rx="7" fill="#F5EDD8ee" stroke="#C8A96E" strokeWidth="1.5"/>
        <polygon points="-4,4 4,4 0,10" fill="#F5EDD8ee" stroke="#C8A96E" strokeWidth="1.5"/>
        <LabSprite x={-11} y={-13} sprite={sprite} scale={1.4}/>
      </g>
    )
  }
  if (obj.type === 'grassDetail') {
    const sprite = ANIMAL_ZONE_TILESET.detail[obj.variant % ANIMAL_ZONE_TILESET.detail.length]
    return <LabSprite x={x + T*0.3} y={y + T*0.3} sprite={sprite} scale={1.6}/>
  }
  if (obj.type === 'farmSign') {
    return (
      <g transform={`translate(${x + T/2}, ${y + T*0.3})`}>
        <rect x="-3" y="10" width="6" height="16" rx="1" fill="#6A4A2A"/>
        <rect x="-18" y="-4" width="36" height="18" rx="3" fill="#C89A5C" stroke="#6A4A2A" strokeWidth="2"/>
        <text textAnchor="middle" y="9" fontSize="11" fontFamily="Nunito, sans-serif">{obj.label}</text>
      </g>
    )
  }
  if (obj.type === 'scarecrow') {
    return <LabSprite x={x} y={y} sprite={WORLD_PROPS.scarecrow} scale={1.7}/>
  }
  if (obj.type === 'chest') {
    return (
      <g>
        <ellipse cx={x + WORLD_PROPS.chest.w} cy={y + WORLD_PROPS.chest.h*1.6 - 2} rx={WORLD_PROPS.chest.w*0.7} ry={4} fill="#00000044"/>
        <LabSprite x={x} y={y} sprite={WORLD_PROPS.chest} scale={1.6}/>
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
  const hasProduce = zone === 'Animal' || zone === 'Nature' || zone === 'Urban'

  // 잠긴(아직 구역 해제 안 된) 아이템 — 실제 아이콘을 옅게 보여줘 어디에
  // 분포되어 있는지는 알 수 있게 하되, 흐림 효과 자체는 구역 전체를 덮는
  // BlockCloud가 담당하고 여기서는 살짝 톤다운만 한다. 상호작용은 불가.
  if (state === 'locked') {
    const drift = Math.sin(tick * 0.02 + item.pulse) * 2
    return (
      <g transform={`translate(${px}, ${py + drift})`} opacity="0.55">
        {hasProduce ? (
          <g style={{ filter: 'grayscale(0.6)' }}>
            <LabSprite x={-11} y={-11} sprite={zoneProduceSprite(zone, item)} scale={22/16}/>
          </g>
        ) : ASSET_READY.items && imgSrc ? (
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
      {/* 후광 + 파티클 — Animal/Nature는 원형 배경 대신 아이템 자체에 glow 필터만 입힌다
          (둥근 배경 도형 없이 "아이템에 효과만" 달라는 요청, Animal에서 확정된 스타일을
          Nature에도 동일 적용) */}
      {!hasProduce && (
        <>
          <circle r="20" fill={border} opacity="0.12"/>
          {!done && [0,1,2].map(i => (
            <circle key={i}
              cx={Math.cos(tick * 0.05 + i * 2.09) * 18}
              cy={Math.sin(tick * 0.05 + i * 2.09) * 18}
              r="2" fill={si.itemBorder}
              opacity={0.35 + Math.sin(tick * 0.1 + i) * 0.25}
            />
          ))}
        </>
      )}

      {/* PNG 아이콘 (에셋 있을 때) */}
      {hasProduce ? (
        <g style={{ filter: done
          ? 'grayscale(0.7)'
          : `drop-shadow(0 0 3px ${border}) drop-shadow(0 0 6px ${border}88)` }}>
          <LabSprite x={-11} y={-11} sprite={zoneProduceSprite(zone, item)} scale={22/16}/>
        </g>
      ) : ASSET_READY.items && imgSrc ? (
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
   픽셀 캐릭터 — WorldMap과 완전히 동일한 렌더링(실제 스프라이트 → 폴백 시트 →
   손그림 SVG 순). 마을 안팎을 오가도 같은 캐릭터로 보이도록 로직을 그대로 공유한다.
───────────────────────────────────────────── */
const CHAR_CFG = CHARACTERS.player_frames

function PixelChar({ dir, moving }) {
  const tick  = Math.floor(Date.now() / 160) % 2
  const frame = moving ? tick : 0

  if (ASSET_READY.world) {
    const { frame: fs, rows, cols, layers } = WORLD_CHARACTER
    const row = rows[dir] ?? rows.down
    const walkTick = Math.floor(Date.now() / 100) % cols.length
    const srcX = cols[moving ? walkTick : 0] * fs, srcY = row * fs
    return (
      <svg width={SPRITE_W} height={SPRITE_H} viewBox={`0 0 ${fs} ${fs}`}
        style={{ overflow:'hidden', imageRendering:'pixelated' }}>
        <defs>
          <clipPath id="zonePlayerClip"><rect width={fs} height={fs}/></clipPath>
        </defs>
        {layers.map((L,i) => (
          <image key={i} href={L.src} x={-srcX} y={-srcY} width={L.sheetW} height={L.sheetH}
            clipPath="url(#zonePlayerClip)" style={{ imageRendering:'pixelated' }}/>
        ))}
      </svg>
    )
  }

  if (ASSET_READY.characters && CHARACTERS.player_sheet) {
    const frameOffsets = CHAR_CFG[dir] || CHAR_CFG.down
    const frameX = frameOffsets[frame] ?? frameOffsets[0]
    const { frameW, frameH, sheetW, sheetH } = CHAR_CFG
    return (
      <svg width={SPRITE_W} height={SPRITE_H} viewBox={`0 0 ${frameW} ${frameH}`}
        style={{ overflow:'hidden', imageRendering:'pixelated' }}>
        <defs>
          <clipPath id="zoneCharClip"><rect width={frameW} height={frameH}/></clipPath>
        </defs>
        <image href={CHARACTERS.player_sheet} x={-frameX} y={0}
          width={sheetW} height={sheetH} clipPath="url(#zoneCharClip)"
          style={{ imageRendering:'pixelated' }}/>
      </svg>
    )
  }

  const legLY = frame === 0 ? 18 : 21
  const legRY = frame === 0 ? 21 : 18
  const flip  = dir === 'left' ? 'scale(-1,1) translate(-22,0)' : ''
  return (
    <svg width={SPRITE_W} height={SPRITE_H} viewBox="0 0 22 28"
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
      // Animal Zone은 격자 대신 손그림 오솔길(AnimalPath)을 쓰므로, 그 길 위에
      // 아이템이 겹쳐 노이즈처럼 보이지 않게 실제 길 근처 타일은 배치에서 뺀다.
      if (zone === 'Animal' && isNearAnimalPath(tx, ty)) continue
      // Nature Zone도 마찬가지로 길/연못 근처는 빼고, 집 마당 안(건물 위)에는
      // 아이템이 스폰되면 안 되므로 마당 전체를 추가로 제외한다.
      if (zone === 'Nature' && (isNearNaturePath(tx, ty) || insideAnyNatureYard(tx, ty))) continue
      // Lab Zone — 던전 타일맵의 벽/물 위에는 아이템이 스폰되면 안 되므로
      // 순수 바닥 칸(LAB_FLOOR_CELLS) 화이트리스트만 허용한다. 제외된 만큼은
      // 자동으로 다른 바닥 칸으로 재분배된다 — 총 개수/배정 알고리즘은 그대로.
      if (zone === 'Lab' && !isLabFloorTile(tx, ty)) continue
      // Urban Zone — URBAN_SPAWN_EXCLUDE(스폰 전용, URBAN_DISTRICTS보다 좁음) 참고.
      if (zone === 'Urban' && insideUrbanSpawnExclude(tx, ty)) continue
      // Human Zone — 랜드마크/결절점/구역 건물의 core 발자국만 제외(십자
      // 간선은 block 경계선과 좌표가 같아 PATH_BUFFER가 이미 처리).
      if (zone === 'Human' && insideHumanSpawnExclude(tx, ty)) continue
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
  // 셀프체크 — spawnSoundItems() 자체는 절대 건드리지 않고, 그 결과값만 읽어서
  // 던전 바닥 칸(LAB_FLOOR_CELLS) 밖에 스폰된 아이템이 없는지 검증한다.
  if (zone === 'Lab') {
    const labItems = itemsRef.current.items
    const labIntrusions = labItems.filter(it => !isLabFloorTile(it.tx, it.ty))
    console.log(
      `[LabZone 셀프체크] 던전 바닥 화이트리스트 → 소리 아이템 ${labItems.length}개 중 바닥 밖 배치 ${labIntrusions.length}개` +
      (labIntrusions.length ? ` FAIL: ${JSON.stringify(labIntrusions.map(i => ({ tx:i.tx, ty:i.ty })))}` : ' PASS')
    )
  }
  // 나무가 소리 아이템 칸과 겹쳐서 혼란스럽다는 피드백 — spawnSoundItems(위치/개수/block
  // 잠금 연동)는 그대로 두고, 순수 렌더링 단계에서 그 칸에 해당하는 natureTree만 걸러낸다
  // (buildZoneObjects()는 sounds/아이템 위치를 모르는 채로 한 번만 생성되는 정적 목록이라
  // 이렇게 그리는 시점에 교차 필터링하는 게 가장 안전한 지점).
  const itemTileKeys = new Set(itemsRef.current.items.map(it => `${it.tx},${it.ty}`))
  const visibleZoneObjects = zoneObjects.current.filter(
    obj => !(obj.type === 'natureTree' && itemTileKeys.has(`${obj.tx},${obj.ty}`))
  )

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
        background: theme.border, overflow:'hidden',
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
            ) : zone === 'Animal' ? (
              // 실제 Cozy Farm 잔디 텍스처(블롭 오토타일 정중앙의 곡선 없는 안쪽 조각이라
              // 이음매 없이 타일링됨) — 예전엔 단색 rect였는데 진짜 텍스처로 교체.
              // grassDetail(새싹 7종)은 그 위에 여전히 흩뿌려서 변주를 더한다.
              <pattern id={`ground_${zone}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                <svg width={TILE} height={TILE} viewBox={`${ANIMAL_ZONE_TILESET.grassTexture.x} ${ANIMAL_ZONE_TILESET.grassTexture.y} ${ANIMAL_ZONE_TILESET.grassTexture.w} ${ANIMAL_ZONE_TILESET.grassTexture.h}`}>
                  <image href={ANIMAL_ZONE_TILESET.grassTexture.src} width={ANIMAL_ZONE_TILESET.grassTexture.sheetW} height={ANIMAL_ZONE_TILESET.grassTexture.sheetH} style={{ imageRendering:'pixelated' }}/>
                </svg>
              </pattern>
            ) : zone === 'Nature' ? (
              // Animal과 배경색이 똑같다는 지적으로 분리 — fishing_full/Tiles/tiles_all.png에서
              // 사용자가 준 참고 이미지 부근을 알파/색상 스캔으로 뒤져 찾은 카키색 단색 영역
              // (x=14,y=254,20x18, 전체 균일 #BAA159 확인됨)을 그대로 단색 채움으로 씀 —
              // WorldMap의 GRASS_BASE와 같은 방식(이미지 텍스처 대신 solid color).
              <pattern id={`ground_${zone}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                <rect width={TILE} height={TILE} fill={NATURE_KHAKI_GROUND}/>
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
            {(zone === 'Animal' || zone === 'Nature') && (() => {
              // Nature Zone도 같은 흙길 텍스처를 재사용 — id는 그대로 두고 조건만 넓힌다.
              const { src, sheetW, sheetH, x: srcX, y: srcY, w, h } = ANIMAL_ZONE_TILESET.pathTexture
              return (
                <pattern id="animalPathTexture" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                  <svg width={TILE} height={TILE} viewBox={`${srcX} ${srcY} ${w} ${h}`}>
                    <image href={src} width={sheetW} height={sheetH} style={{ imageRendering:'pixelated' }}/>
                  </svg>
                </pattern>
              )
            })()}
            {zone === 'Nature' && (() => {
              const { src, sheetW, sheetH, x: srcX, y: srcY, w, h } = NATURE_VILLAGE_TILESET.waterFull
              return (
                <pattern id="natureWaterTexture" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                  <svg width={TILE} height={TILE} viewBox={`${srcX} ${srcY} ${w} ${h}`}>
                    <image href={src} width={sheetW} height={sheetH} style={{ imageRendering:'pixelated' }}/>
                  </svg>
                </pattern>
              )
            })()}
            {zone === 'Urban' && (() => {
              // road/sidewalk는 URBAN_KENNEY_GROUND(16px 원본)를 TILE(32px) 패턴
              // 박스에 채워서 자동으로 URBAN_SCALE(2배) 업스케일되게 한다.
              // crosswalkV는 같은 크롭을 <g rotate(90)>으로 돌려서 별도 패턴을
              // 하나 더 만든 것 — 세로 도로용(가로 줄무늬)과 가로 도로용(세로
              // 줄무늬, 원본 그대로)을 구분해야 해서다.
              const mk = (id, sprite, rotate) => {
                const { src, sheetW, sheetH, x: srcX, y: srcY, w, h } = sprite
                const img = <image href={src} width={sheetW} height={sheetH} style={{ imageRendering: 'pixelated' }}/>
                return (
                  <pattern key={id} id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
                    <svg width={TILE} height={TILE} viewBox={`${srcX} ${srcY} ${w} ${h}`}>
                      {rotate ? <g transform={`rotate(90 ${srcX + w / 2} ${srcY + h / 2})`}>{img}</g> : img}
                    </svg>
                  </pattern>
                )
              }
              return (
                <>
                  {mk('urbanRoadTexture', URBAN_KENNEY_GROUND.road)}
                  {mk('urbanSidewalkTexture', URBAN_KENNEY_GROUND.sidewalk)}
                  {mk('urbanCrosswalkH', URBAN_KENNEY_GROUND.crosswalk)}
                  {mk('urbanCrosswalkV', URBAN_KENNEY_GROUND.crosswalk, true)}
                </>
              )
            })()}
          </defs>

          {/* 바닥 */}
          <rect width={PX_W} height={PX_H} fill={`url(#ground_${zone})`}/>

          {/* Urban 도로망 — 도로/인도/횡단보도/차선(넓은 면적)은 NatureWater와 같은
              방식으로 UrbanRoadNetwork가 직접 그린다. */}
          {zone === 'Urban' && <UrbanRoadNetwork/>}

          {/* 경계 울타리 — Lab은 던전 타일 자체가 벽/문으로 경계를 그리므로 별도 테두리가
              필요 없다(테두리를 겹쳐 그리면 실제 벽 스프라이트 위에 반투명 띠가 덧씌워짐). */}
          {zone !== 'Lab' && (
            <>
              <rect x="0" y="0" width={PX_W} height={PX_H}
                fill="none" stroke={theme.border} strokeWidth="6"/>
              <rect x="3" y="3" width={PX_W-6} height={PX_H-6}
                fill="none" stroke={`${meta.color}44`} strokeWidth="2" strokeDasharray="8 4"/>
            </>
          )}

          {/* Lab("미지의 소리 마을") 던전 타일맵 — Dungeon1.tmx 원본 배치를 그대로 이식 */}
          {zone === 'Lab' && <LabDungeonMap/>}

          {/* 경로 타일 — Animal/Nature Zone은 block-quest 아이템 배치용 격자일 뿐, 구역을
              가르는 "넓은 흙길 사각형"으로 보이면 안 되므로 그리지 않는다(잔디가
              맵 전체에 걸쳐 하나로 이어짐). 대신 AnimalPath/NaturePath가 좁고 굽은
              오솔길을 그린다. Urban도 같은 이유로 제외 — theme.path(#D4C8B0, 베이지)가
              UrbanRoadNetwork(road/sidewalk)보다 나중에(위에) 그려지는 바람에, block
              그리드(6개 block → computeBlockGrid가 3열×2행으로 나눈 경계선, spawnSoundItems
              전용 좌표계라 URBAN_BLOCKS와는 완전히 다른 시스템) 경계마다 인도/도로 위에
              베이지 띠가 그대로 덮여 보이는 버그가 있었다("가로 1개+세로 2개 경계선"으로
              보고된 게 바로 이 6-block 그리드 선). Human도 동일 사유로 제외 — 처음엔
              theme.path(연한 서리색)를 그대로 뒀더니 구역 경계 전체가 폭넓은 흰 띠로
              덮여 "마을 사이 여백"이 아니라 "안 그려진 구간"처럼 보인다는 지적을 받았다
              (Urban 때와 똑같은 원인: 넓은 사각형 그리드선이 배경 위에 그대로 얹힘).
              Human은 이제 HumanPathNetwork()가 건물 현관~마켓 광장을 잇는 좁은 눈길만
              실제 좌표로 그리므로, 이 넓은 사각 그리드는 더 이상 필요 없다. Lab도 동일 사유로
              제외 — 던전 타일맵(LabDungeonMap)이 이미 실제 벽/바닥/물로 맵 전체를 그리는데
              그 위에 6-block 경계선(theme.path 갈색 띠)이 겹쳐 그려져서 "구역이 6개로
              쪼개진 것처럼" 보이는 버그로 보고됨. spawnSoundItems의 실제 스폰 제외 계산
              (nearGridLine)은 pathTiles를 그리든 안 그리든 좌표 자체로 독립 동작하므로 이 줄을
              빼도 스폰 로직엔 전혀 영향 없다 — 순수 시각 레이어만 끈다. ──*/}
          {zone !== 'Animal' && zone !== 'Nature' && zone !== 'Urban' && zone !== 'Human' && zone !== 'Lab' && pathTiles.current.map((p, i) => (
            <rect key={i}
              x={p.tx * TILE} y={p.ty * TILE} width={TILE} height={TILE}
              fill={theme.path} stroke={`${theme.path}88`} strokeWidth="0.5"
            />
          ))}
          {zone === 'Animal' && <AnimalPath/>}
          {zone === 'Nature' && <NatureWater/>}
          {zone === 'Nature' && <NaturePath/>}

          {/* Zone 오브젝트 — 소리 아이템 칸과 겹치는 natureTree는 제외 */}
          {visibleZoneObjects.map((obj, i) => (
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

          {/* 캐릭터 — 스프라이트는 히트박스(CHAR_W/H)보다 크므로, 히트박스 발치에
              스프라이트 발이 오도록 중앙 정렬 + 위쪽으로 오프셋해서 그린다 */}
          <foreignObject
            x={pos.x + CHAR_W/2 - SPRITE_W/2}
            y={pos.y + CHAR_H - SPRITE_H}
            width={SPRITE_W} height={SPRITE_H} style={{ overflow:'visible' }}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width:SPRITE_W, height:SPRITE_H }}>
              <PixelChar dir={dir} moving={moving}/>
            </div>
          </foreignObject>

          {/* 발견 이펙트 — 커진 스프라이트 머리 위로 뜨도록 오프셋 조정 */}
          {collecting && (
            <g transform={`translate(${pos.x + CHAR_W/2}, ${pos.y + CHAR_H - SPRITE_H - 15})`}>
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