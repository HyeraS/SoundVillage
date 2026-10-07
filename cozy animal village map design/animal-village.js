/**
 * animal-village.js — SoundMimic Village / 동물 마을(Animal Zone) 맵 엔진
 *
 * 프레임워크 의존성 없는 순수 ES 모듈. 맵 생성 + 충돌 + Canvas 드로잉.
 * 그래픽은 전부 구매한 shubibubi "All Things Cozy" 팩 스프라이트를 잘라 쓴다
 * (좌표는 저장소 components/AssetRegistry.js에 등록된 실측값 그대로).
 *
 * 규격: 48 × 36 타일, 타일 32px → 1536 × 1152 px (Nature/Music 존과 동일)
 */

export const T = 32
export const MAP_W = 48
export const MAP_H = 36

/* 에셋 루트. Next 앱에 이식할 때 setAssetBase('/assets/') 로 바꾼다. */
let BASE = 'public/assets/'
export function setAssetBase(b) { BASE = b }

/* ── 스프라이트 시트 ───────────────────────────────────────── */
const SHEETS = {
  farm:       'world/terrain.png',
  town:       'world/terrain-town.png',
  fbuild:     'world/buildings.png',
  tbuild:     'world/town_buildings.png',
  barn:       'world/barn.png',
  coop:       'world/coop.png',
  greenhouse: 'world/greenhouse.png',
  items:      'world/farm_items.png',
  nature:     'world/nature.png',
  houseCream: 'world/nature_village/house_cream.png',
  body:       'world/player_body.png',
  clothes:    'world/player_clothes.png',
  hair:       'world/player_hair.png',
  cow:        'world/animals/cow.png',
  cowBlack:   'world/animals/cow_black.png',
  cowBrown:   'world/animals/cow_brown.png',
  pig:        'world/animals/pig.png',
  pigStripe:  'world/animals/pig_stripe.png',
  sheep:      'world/animals/sheep.png',
  goat:       'world/animals/goat.png',
  goatStripe: 'world/animals/goat_stripe.png',
  chicken:    'world/animals/chicken.png',
  chickenBrn: 'world/animals/chicken_brown.png',
  turkey:     'world/animals/turkey.png',
  bunny:      'world/animals/bunny.png',
  bunnyGrey:  'world/animals/bunny_grey.png',
}

export const IMG = {}
let loaded = null
export function loadAssets() {
  if (loaded) return loaded
  loaded = Promise.all(Object.entries(SHEETS).map(([k, p]) => new Promise((res) => {
    const im = new Image()
    im.onload = () => { IMG[k] = im; res() }
    im.onerror = () => { res() }
    im.src = BASE + p
  })))
  return loaded
}

const sp = (s, x, y, w, h) => ({ s, x, y, w, h })

/* 지면 */
const GRASS_BASE = '#83924C'
const TILE_GRASS = sp('farm', 8, 8, 32, 32)
const TILE_PATH  = sp('town', 80, 40, 32, 32)
/* 구매 시트의 열린 물 타일 — 알파 사직 설정으로 물 픽셀 100%인 16×16 잡질 없는
   구역을 찾은 것(2색, 6×6 반복 테스트에서 이은매 없음 확인). AssetRegistry의
   waterFull(96,224,32,32)은 연잎·기포 줄이 섮여 있어 반복 타일링에 부적절. */
const TILE_WATER = sp('farm', 736, 0, 16, 16)
const TILE_POND  = sp('town', 112, 192, 16, 16)

/* 울타리 */
const FENCE_RAIL   = sp('farm', 0, 480, 32, 32)
const FENCE_POST   = sp('farm', 32, 480, 16, 32)
const FENCE_CORNER = sp('farm', 64, 480, 32, 32)
const FENCE_GATE   = sp('farm', 0, 464, 32, 32)
const BRIDGE_RAIL  = sp('farm', 96, 704, 32, 32)

/* 잔디 디테일(새싹) */
const SPROUTS = [
  sp('farm', 84, 6, 9, 5), sp('farm', 97, 6, 15, 14), sp('farm', 115, 7, 9, 13),
  sp('farm', 129, 7, 11, 13), sp('farm', 145, 6, 15, 14), sp('farm', 163, 7, 9, 13),
  sp('farm', 175, 5, 14, 15),
]

/* 100 Nature Things */
const natureRow = (y, n, w = 16, h = 16) => Array.from({ length: n }, (_, i) => sp('nature', i * w, y, w, h))
const NAT = {
  trees:     [...natureRow(0, 5, 32, 32), ...natureRow(32, 5, 32, 32)],
  bushes:    natureRow(96, 10),
  flowers:   natureRow(112, 10),
  mushrooms: natureRow(128, 10),
  rocks:     natureRow(144, 10),
  butterflies: natureRow(192, 10),
}

/* Cozy Farm 장식 */
const DECOR = {
  tree1:  sp('farm', 0, 384, 32, 64),
  tree2:  sp('farm', 32, 384, 32, 64),
  pine:   sp('farm', 64, 384, 32, 64),
  bush1:  sp('farm', 96, 416, 32, 32),
  bush2:  sp('farm', 128, 416, 32, 32),
  bench1: sp('farm', 192, 416, 32, 32),
  rock:   sp('farm', 192, 480, 32, 32),
  flower1: sp('farm', 96, 448, 32, 32),
  flower2: sp('farm', 128, 448, 32, 32),
  flower3: sp('farm', 160, 448, 32, 32),
  scarecrow: sp('farm', 0, 747, 18, 37),
  chest:  sp('farm', 185, 780, 19, 20),
  benchTown: sp('town', 264, 938, 32, 20),
}

/* 건물 */
const BUILD = {
  barn:       sp('barn', 0, 0, 80, 80),
  coop:       sp('coop', 0, 0, 64, 64),
  greenhouse: sp('greenhouse', 0, 0, 112, 80),
  silo:       sp('fbuild', 982, 124, 42, 68),
  windmill:   sp('fbuild', 931, 280, 90, 104),
  houseCream: sp('houseCream', 0, 0, 58, 72),
  houseDark:  sp('fbuild', 3, 450, 74, 83),
  houseGreen: sp('fbuild', 891, 450, 101, 83),
  victorian:  sp('fbuild', 696, 534, 82, 73),
  cabin:      sp('tbuild', 3, 759, 88, 89),
}

/* 생산물 아이콘(16px 그리드) */
const fi = (c, r) => sp('items', c * 16, r * 16, 16, 16)
const PRODUCE = { wheat: fi(9, 0), hay: fi(6, 5), milk: fi(0, 3), egg: fi(0, 4), wool: fi(0, 5) }

/* 동물 — 걷기 시트 첫 프레임(정면 대기)만 정적 소품으로 사용 */
const animal = (s, cell) => ({ ...sp(s, 0, 0, cell, cell), scale: 1.5 })
const ANIMALS = {
  cow: animal('cow', 24), cowBlack: animal('cowBlack', 24), cowBrown: animal('cowBrown', 24),
  pig: animal('pig', 20), pigStripe: animal('pigStripe', 20),
  sheep: animal('sheep', 17), goat: animal('goat', 19), goatStripe: animal('goatStripe', 19),
  chicken: animal('chicken', 16), chickenBrn: animal('chickenBrn', 16), turkey: animal('turkey', 17),
  bunny: animal('bunny', 17), bunnyGrey: animal('bunnyGrey', 17),
}

/* 캐릭터 — 32×32 격자, 행=방향, 열=걷기 8프레임 */
const CHAR = { frame: 32, rows: { down: 0, up: 1, left: 3, right: 2 }, layers: ['body', 'clothes', 'hair'] }

/* ── 유틸 ─────────────────────────────────────────────────── */
function rng(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length]

function drawSp(ctx, s, dx, dy, scale = 1) {
  const im = IMG[s.s]
  if (!im) return
  ctx.drawImage(im, s.x, s.y, s.w, s.h, Math.round(dx), Math.round(dy), Math.round(s.w * scale), Math.round(s.h * scale))
}

/* ── 맵 정의 ──────────────────────────────────────────────── */
/* terrain: 0 잔디 · 1 흙길 · 2 광장 · 3 물 · 4 밭 · 5 다리 */

const PALETTE = { c1: '#ffd166', c2: '#7cd06a', c3: '#63c6f2', c4: '#ff9f6b', c5: '#c58bff' }

function blankTerrain() {
  return Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(0))
}
function fillRect(tr, x, y, w, h, code) {
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++)
    if (ty >= 0 && ty < MAP_H && tx >= 0 && tx < MAP_W) tr[ty][tx] = code
}
/* 유기적인 blob — 각도별로 반지름을 흔들어 사각형처럼 안 보이게 */
function fillBlob(tr, cx, cy, rx, ry, code, seed = 5) {
  const r = rng(seed)
  const wob = Array.from({ length: 16 }, () => 0.82 + r() * 0.3)
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const dx = tx + .5 - cx, dy = ty + .5 - cy
    const ang = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)
    const i = ang * 16
    const a = wob[Math.floor(i) % 16], b = wob[(Math.floor(i) + 1) % 16]
    const k = a + (b - a) * (i - Math.floor(i))
    const d = (dx / (rx * k)) ** 2 + (dy / (ry * k)) ** 2
    if (d <= 1) tr[ty][tx] = code
  }
}

/* 연못 — 타일 계단이 그대로 드러나지 않도록 폴리곤으로 그리고,
   레퍼런스처럼 [잔디 프린지] → [흙 둔치] → [얕은 물 띠] → [물] 순으로 겹친다 */
function pondPolygon(cx, cy, rx, ry, seed) {
  const r = rng(seed)
  const K = 12
  const wob = Array.from({ length: K }, () => 0.8 + r() * 0.34)
  const N = 56, pts = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const f = (i / N) * K
    const i0 = Math.floor(f) % K, i1 = (i0 + 1) % K, t = f - Math.floor(f)
    const s = t * t * (3 - 2 * t)
    const k = wob[i0] + (wob[i1] - wob[i0]) * s
    pts.push([(cx + Math.cos(a) * rx * k) * T, (cy + Math.sin(a) * ry * k) * T])
  }
  return pts
}
function inPoly(pts, x, y) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
function addPond(v, tr, cx, cy, rx, ry, seed) {
  const pts = pondPolygon(cx, cy, rx, ry, seed)
  v.ponds.push(pts)
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++)
    if (inPoly(pts, tx * T + 16, ty * T + 16)) tr[ty][tx] = 3
}

/* 과수원 — 격자로 심은 과일나무. 진짜 농장처럼 보이게 하는 핵심 요소 */
function plantOrchard(o, tr, out, r) {
  for (let ty = o.y; ty < o.y + o.h; ty += 2) {
    for (let tx = o.x; tx < o.x + o.w; tx += 2) {
      if (tr[ty][tx] !== 0) continue
      const spec = NAT.trees[o.kind ?? (tx + ty) % 3]
      out.sprites.push({ spec, px: tx * T + 2, py: ty * T - 8, scale: 1.5, sort: ty * T + T })
      out.colliders.push({ x: tx * T + 12, y: ty * T + 14, w: 16, h: 14, tag: 'tree' })
      out.orchardTiles.push(tx + ',' + ty)
    }
  }
}

/* 마당/우리 울타리 한 겹 — gate: 'S'|'N'|'W'|'E' 한 칸 개방 */
function penFence(pen, out, r) {
  const { x, y, w, h, gate } = pen
  const gx = gate === 'S' || gate === 'N' ? x + Math.floor(w / 2) : null
  const gy = gate === 'W' || gate === 'E' ? y + Math.floor(h / 2) : null
  const add = (tx, ty, spec, sc, offX = 0) => {
    out.fences.push({ tx, ty, spec, sc, offX })
    out.colliders.push({ x: tx * T + 2, y: ty * T + 14, w: T - 4, h: T - 16, tag: 'fence' })
  }
  for (let tx = x; tx < x + w; tx++) {
    for (const [ty, side] of [[y, 'N'], [y + h - 1, 'S']]) {
      const isCorner = tx === x || tx === x + w - 1
      if (gate === side && tx === gx) { out.fences.push({ tx, ty, spec: FENCE_GATE, sc: 1 }); continue }
      add(tx, ty, isCorner ? FENCE_CORNER : FENCE_RAIL, 1)
    }
  }
  for (let ty = y + 1; ty < y + h - 1; ty++) {
    for (const [tx, side] of [[x, 'W'], [x + w - 1, 'E']]) {
      if (gate === side && ty === gy) { out.fences.push({ tx, ty, spec: FENCE_GATE, sc: 1 }); continue }
      add(tx, ty, FENCE_POST, 1, 8)
    }
  }
  void r
}

/* 우리 안 동물 + 사료통 */
function fillPen(pen, out, r, kinds) {
  const { x, y, w, h } = pen
  const slots = []
  for (let ty = y + 1; ty < y + h - 1; ty++) for (let tx = x + 1; tx < x + w - 1; tx++) slots.push([tx, ty])
  const n = Math.max(3, Math.min(9, Math.floor(slots.length / 3)))
  const used = []
  for (let i = 0; i < n; i++) {
    let s, tries = 0
    do { s = slots[Math.floor(r() * slots.length)]; tries++ } while (tries < 40 && used.some((u) => Math.abs(u[0] - s[0]) < 2 && Math.abs(u[1] - s[1]) < 1))
    used.push(s)
    const a = ANIMALS[kinds[i % kinds.length]]
    out.sprites.push({ spec: a, px: s[0] * T + (T - a.w * a.scale) / 2, py: s[1] * T + T - a.h * a.scale, scale: a.scale, sort: s[1] * T + T })
  }
  // 건초/사료
  const fx = x + 1, fy = y + h - 2
  out.sprites.push({ spec: PRODUCE.hay, px: fx * T + 6, py: fy * T + 8, scale: 1.5, sort: fy * T + T })
}

/* 작물밭 — 고랑(통로) 사이에 심긴 줄만 충돌 */
function cropField(f, tr, out, r) {
  fillRect(tr, f.x, f.y, f.w, f.h, 4)
  for (let ty = f.y; ty < f.y + f.h; ty++) {
    if ((ty - f.y) % 3 === 2) continue // 통로 고랑
    for (let tx = f.x; tx < f.x + f.w; tx++) {
      const kind = PRODUCE.wheat
      out.crops.push({ tx, ty, spec: kind, jx: Math.floor(r() * 4) - 2 })
      out.colliders.push({ x: tx * T + 4, y: ty * T + 16, w: T - 8, h: T - 18, tag: 'crop' })
    }
  }
}

/* ── 레이아웃 A: 농장 안뜰 ─────────────────────────────────── */
function layoutA(v, tr, r) {
  v.label = '레이아웃 A — 농장 안뜰'
  // 간선: 입구 → 북쪽 헛간까지 세로 대로 + 가로 두 갈래
  fillRect(tr, 22, 5, 3, 31, 1)
  fillRect(tr, 6, 19, 36, 3, 1)
  fillRect(tr, 10, 9, 28, 3, 1)
  fillRect(tr, 19, 15, 10, 8, 2) // 마을 광장

  v.orchards = [{ x: 27, y: 24, w: 6, h: 6, kind: 0 }, { x: 14, y: 12, w: 6, h: 6, kind: 1 }]
  v.buildings = [
    { spec: BUILD.barn, tx: 20.5, ty: 2.2, label: '헛간' },
    { spec: BUILD.silo, tx: 24.6, ty: 2.4 },
    { spec: BUILD.coop, tx: 14, ty: 3.2, label: '닭장' },
    { spec: BUILD.greenhouse, tx: 27.0, ty: 3.0, label: '온실' },
    { spec: BUILD.houseCream, tx: 33.5, ty: 13.6, label: '농가' },
    { spec: BUILD.windmill, tx: 5.2, ty: 2.6 },
    { spec: BUILD.cabin, tx: 2.2, ty: 23.6, label: '창고' },
  ]

  v.pens = [
    { x: 6, y: 12, w: 7, h: 6, gate: 'S', kinds: ['cow', 'cowBrown', 'cowBlack', 'cow', 'cowBrown', 'cowBlack'], block: 4 },
    { x: 6, y: 23, w: 7, h: 5, gate: 'E', kinds: ['pig', 'pigStripe', 'pig', 'pigStripe'], block: 4 },
    { x: 31, y: 5, w: 8, h: 6, gate: 'S', kinds: ['sheep', 'goat', 'goatStripe', 'sheep', 'goat', 'goatStripe'], block: 5 },
    { x: 15, y: 23, w: 6, h: 5, gate: 'N', kinds: ['chicken', 'chickenBrn', 'turkey', 'chicken', 'chickenBrn', 'turkey'], block: 1 },
    { x: 34, y: 22, w: 7, h: 4, gate: 'N', kinds: ['sheep', 'turkey', 'bunny', 'goat', 'chicken'], block: 3 },
    { x: 27, y: 29, w: 7, h: 5, gate: 'W', kinds: ['bunny', 'bunnyGrey', 'bunny', 'bunnyGrey'], block: 5 },
  ]
  v.fields = [{ x: 4, y: 29, w: 14, h: 5 }]

  // 연못 + 다리 — 동쪽 갈림길이 연못을 가로지른다
  fillRect(tr, 30, 26, 16, 2, 1)
  addPond(v, tr, 38.5, 28.5, 5.6, 3.4, 11)
  v.bridges = [{ x: 33, y: 26, w: 11, h: 2, dir: 'h' }]

  v.districts = [
    { block: 1, name: '마을 광장', area: { x: 14, y: 14, w: 18, h: 15 }, neon: PALETTE.c1 },
    { block: 2, name: '북쪽 헛간', area: { x: 12, y: 0, w: 24, h: 14 }, neon: PALETTE.c2 },
    { block: 3, name: '연못가 풀밭', area: { x: 32, y: 12, w: 16, h: 20 }, neon: PALETTE.c3 },
    { block: 4, name: '서쪽 우리', area: { x: 0, y: 10, w: 14, h: 20 }, neon: PALETTE.c4 },
    { block: 5, name: '남쪽 작물밭', area: { x: 2, y: 28, w: 44, h: 8 }, neon: PALETTE.c5 },
  ]
  v.spawn = { x: 24 * T, y: 34 * T }
  v.signs = [
    { tx: 23.2, ty: 33.4, text: '↓ 입구' },
    { tx: 22.6, ty: 13.6, text: '마을 광장' },
  ]
  void r
}

/* ── 레이아웃 B: 연못 고리길 ───────────────────────────────── */
function layoutB(v, tr, r) {
  v.label = '레이아웃 B — 연못 고리길'
  // 중앙 연못을 도는 고리 도로 + 입구 진입로
  fillRect(tr, 13, 8, 22, 3, 1)
  fillRect(tr, 13, 26, 22, 3, 1)
  fillRect(tr, 13, 8, 3, 21, 1)
  fillRect(tr, 32, 8, 3, 21, 1)
  fillRect(tr, 22, 29, 3, 7, 1)
  fillRect(tr, 4, 18, 9, 3, 1)
  fillRect(tr, 35, 18, 9, 3, 1)
  fillRect(tr, 16, 11, 5, 4, 2)

  addPond(v, tr, 24, 18.6, 5.8, 4.1, 23)
  v.bridges = [{ x: 23, y: 13, w: 2, h: 11, dir: 'v' }]
  v.orchards = [{ x: 17, y: 21, w: 6, h: 6, kind: 0 }, { x: 37, y: 20, w: 6, h: 6, kind: 4 }]

  v.buildings = [
    { spec: BUILD.houseGreen, tx: 6.0, ty: 8.0, label: '농가' },
    { spec: BUILD.barn, tx: 36.5, ty: 3.4, label: '헛간' },
    { spec: BUILD.silo, tx: 40.4, ty: 3.6 },
    { spec: BUILD.coop, tx: 36.6, ty: 23.0, label: '닭장' },
    { spec: BUILD.greenhouse, tx: 5.0, ty: 23.4, label: '온실' },
    { spec: BUILD.windmill, tx: 10.6, ty: 1.8 },
    { spec: BUILD.victorian, tx: 17.2, ty: 30.4, label: '마을회관' },
  ]

  v.pens = [
    { x: 16, y: 2, w: 8, h: 5, gate: 'S', kinds: ['sheep', 'turkey', 'bunny', 'goat', 'chicken', 'goatStripe'], block: 5 },
    { x: 26, y: 2, w: 8, h: 5, gate: 'S', kinds: ['cow', 'cowBrown', 'cowBlack', 'cow', 'cowBrown', 'cowBlack'], block: 5 },
    { x: 36, y: 11, w: 8, h: 6, gate: 'W', kinds: ['sheep', 'goat', 'goatStripe', 'sheep', 'goat', 'goatStripe'], block: 4 },
    { x: 36, y: 28, w: 8, h: 5, gate: 'N', kinds: ['chicken', 'chickenBrn', 'turkey', 'chicken', 'chickenBrn', 'turkey'], block: 3 },
    { x: 4, y: 11, w: 8, h: 6, gate: 'E', kinds: ['pig', 'pigStripe', 'pig', 'pigStripe'], block: 2 },
    { x: 26, y: 30, w: 6, h: 5, gate: 'W', kinds: ['bunny', 'bunnyGrey', 'bunny', 'bunnyGrey'], block: 1 },
  ]
  v.fields = [{ x: 4, y: 28, w: 8, h: 6 }, { x: 26, y: 11, w: 6, h: 3 }]

  v.districts = [
    { block: 1, name: '마을 어귀', area: { x: 14, y: 26, w: 20, h: 10 }, neon: PALETTE.c1 },
    { block: 2, name: '서쪽 목장', area: { x: 0, y: 8, w: 14, h: 18 }, neon: PALETTE.c4 },
    { block: 3, name: '연못 안뜰', area: { x: 14, y: 10, w: 20, h: 16 }, neon: PALETTE.c3 },
    { block: 4, name: '동쪽 방목장', area: { x: 34, y: 8, w: 14, h: 22 }, neon: PALETTE.c2 },
    { block: 5, name: '북쪽 언덕', area: { x: 8, y: 0, w: 34, h: 9 }, neon: PALETTE.c5 },
  ]
  v.spawn = { x: 23 * T + 16, y: 34 * T }
  v.signs = [
    { tx: 22.4, ty: 33.6, text: '↓ 입구' },
    { tx: 16.4, ty: 10.2, text: '나루터' },
  ]
  void r
}

/* ── 빌드 ─────────────────────────────────────────────────── */
export function buildVillage(variant = 'A') {
  const r = rng(variant === 'B' ? 20260827 : 19940512)
  const tr = blankTerrain()
  const v = {
    variant, terrain: tr, colliders: [], sprites: [], fences: [], crops: [],
    detail: [], bridges: [], buildings: [], pens: [], fields: [], districts: [], signs: [], items: [],
    orchards: [], orchardTiles: [], aprons: [], ponds: [],
  }
  ;(variant === 'B' ? layoutB : layoutA)(v, tr, r)

  // 건물 앞마당(흙) — 건물이 잔디 위에 그냥 얹힌 것처럼 보이지 않게
  v.buildings.forEach((b) => {
    const x0 = Math.round(b.tx), y0 = Math.round(b.ty + b.spec.h / T) - 1
    const w = Math.max(2, Math.round(b.spec.w / T)), h = 3
    for (let ty = y0; ty < y0 + h; ty++) for (let tx = x0; tx < x0 + w; tx++)
      if (ty >= 0 && ty < MAP_H && tx >= 0 && tx < MAP_W && tr[ty][tx] === 0) { tr[ty][tx] = 1; v.aprons.push(tx + ',' + ty) }
  })

  v.orchards.forEach((o) => plantOrchard(o, tr, v, r))

  // 다리: 물 위 통행 가능 구간
  v.bridges.forEach((b) => {
    for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++)
      if (tr[ty] && tr[ty][tx] === 3) tr[ty][tx] = 5
  })

  // 농장 마당 소품 — 건초더미·구유통을 헛간 앞에 몰아 사람 손길 닿은 티를 낸다
  const yard = v.buildings.find((b) => b.label === '헛간')
  if (yard) {
    const bx = Math.round(yard.tx), by = Math.round(yard.ty + yard.spec.h / T)
    ;[[bx - 1, by, PRODUCE.hay, 1.8], [bx, by, PRODUCE.hay, 1.8], [bx + 3, by, DECOR.chest, 1.4]].forEach(([tx, ty, spec, sc]) => {
      v.sprites.push({ spec, px: tx * T + 4, py: ty * T + 6, scale: sc, sort: ty * T + T })
      v.colliders.push({ x: tx * T + 4, y: ty * T + 14, w: 24, h: 14, tag: 'prop' })
    })
  }

  // 밭
  v.fields.forEach((f) => cropField(f, tr, v, r))

  // 우리: 안쪽 잔디 유지 + 울타리 + 동물
  v.pens.forEach((p) => { penFence(p, v, r); fillPen(p, v, r, p.kinds) })

  // 건물 스프라이트 + 충돌(발밑 2/3만 막아 탑다운 원근 유지)
  v.buildings.forEach((b) => {
    const px = b.tx * T, py = b.ty * T
    v.sprites.push({ spec: b.spec, px, py, scale: 1, sort: py + b.spec.h })
    v.colliders.push({ x: px + 4, y: py + Math.round(b.spec.h * 0.34), w: b.spec.w - 8, h: Math.round(b.spec.h * 0.66) - 2, tag: 'building' })
  })

  // 물 충돌(다리 제외)
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++)
    if (tr[ty][tx] === 3) v.colliders.push({ x: tx * T, y: ty * T, w: T, h: T, tag: 'water' })

  // 맵 경계
  v.colliders.push({ x: -T, y: 0, w: T, h: MAP_H * T, tag: 'edge' })
  v.colliders.push({ x: MAP_W * T, y: 0, w: T, h: MAP_H * T, tag: 'edge' })
  v.colliders.push({ x: 0, y: -T, w: MAP_W * T, h: T, tag: 'edge' })
  v.colliders.push({ x: 0, y: MAP_H * T, w: MAP_W * T, h: T, tag: 'edge' })

  scatterNature(v, tr, r)
  spawnItems(v, tr, r)

  v.walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && tr[ty][tx] !== 3
  return v
}

/* 자연 장식 — 길/밭/우리/건물 위에는 절대 놓지 않는다 */
function scatterNature(v, tr, r) {
  const occupied = (tx, ty) => {
    if (tr[ty][tx] !== 0) return true
    const bx = tx * T + 16, by = ty * T + 24
    return v.colliders.some((c) => bx > c.x - 12 && bx < c.x + c.w + 12 && by > c.y - 20 && by < c.y + c.h + 12)
  }
  const inPen = (tx, ty) => v.pens.some((p) => tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h)
  const nearPath = (tx, ty) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = ty + dy, x = tx + dx
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W && (tr[y][x] === 1 || tr[y][x] === 2)) return true
    }
    return false
  }
  const edgeBias = (tx, ty) => {
    const d = Math.min(tx, ty, MAP_W - 1 - tx, MAP_H - 1 - ty)
    return d < 3 ? 0.78 : d < 6 ? 0.4 : 0.12
  }

  for (let ty = 1; ty < MAP_H - 1; ty++) {
    for (let tx = 1; tx < MAP_W - 1; tx++) {
      // 새싹 텍스처는 잔디 어디든
      if (tr[ty][tx] === 0 && r() < 0.34) {
        v.detail.push({ spec: pick(r, SPROUTS), px: tx * T + r() * 20, py: ty * T + r() * 20 })
      }
      if (occupied(tx, ty) || inPen(tx, ty)) continue

      const p = edgeBias(tx, ty)
      if (!nearPath(tx, ty) && r() < p) {
        // 숲 — 맵 가장자리로 갈수록 빽빽하게
        const tall = r() < 0.45
        const spec = tall ? pick(r, [DECOR.tree1, DECOR.tree2, DECOR.pine]) : pick(r, NAT.trees)
        const sc = tall ? 1 : 1.5
        const px = tx * T + (T - spec.w * sc) / 2 + (r() * 8 - 4)
        const py = ty * T + T - spec.h * sc + 6
        v.sprites.push({ spec, px, py, scale: sc, sort: ty * T + T })
        v.colliders.push({ x: tx * T + 10, y: ty * T + 16, w: 14, h: 12, tag: 'tree' })
        continue
      }
      const q = r()
      if (q < 0.05) {
        const spec = pick(r, [DECOR.bush1, DECOR.bush2])
        v.sprites.push({ spec, px: tx * T, py: ty * T, scale: 1, sort: ty * T + T })
        v.colliders.push({ x: tx * T + 6, y: ty * T + 16, w: 20, h: 12, tag: 'bush' })
      } else if (q < 0.10) {
        v.detail.push({ spec: pick(r, NAT.flowers), px: tx * T + 8, py: ty * T + 10, scale: 1.4 })
      } else if (q < 0.125) {
        v.detail.push({ spec: pick(r, NAT.mushrooms), px: tx * T + 9, py: ty * T + 12, scale: 1.3 })
      } else if (q < 0.145) {
        const spec = pick(r, NAT.rocks)
        v.sprites.push({ spec, px: tx * T + 6, py: ty * T + 8, scale: 1.5, sort: ty * T + T })
        v.colliders.push({ x: tx * T + 8, y: ty * T + 16, w: 18, h: 12, tag: 'rock' })
      } else if (q < 0.155) {
        v.detail.push({ spec: pick(r, NAT.butterflies), px: tx * T + 10, py: ty * T + 4, scale: 1.2 })
      }
    }
  }

  // 광장 소품 — 벤치·화분·허수아비·상자로 '마을 중심'처럼 채운다
  const plaza = []
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (tr[ty][tx] === 2) plaza.push([tx, ty])
  if (plaza.length) {
    const xs = plaza.map((p) => p[0]), ys = plaza.map((p) => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const put = (spec, tx, ty, scale, box) => {
      v.sprites.push({ spec, px: tx * T + (T - spec.w * scale) / 2, py: ty * T + T - spec.h * scale, scale, sort: ty * T + T })
      if (box) v.colliders.push({ x: tx * T + 6, y: ty * T + 16, w: 20, h: 12, tag: 'prop' })
    }
    const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2)
    put(DECOR.scarecrow, cx, cy, 1.5, true)
    put(DECOR.chest, cx + 1, cy + 1, 1.4, true)
    put(PRODUCE.hay, cx - 1, cy + 1, 1.6, false)
    put(DECOR.bench1, x0 + 1, y0 + 1, 1, true)
    put(DECOR.benchTown, x1 - 1, y0 + 1, 1, true)
    put(DECOR.bench1, x0 + 1, y1 - 1, 1, true)
    put(DECOR.benchTown, x1 - 1, y1 - 1, 1, true)
    ;[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([px, py], i) => {
      put([DECOR.flower1, DECOR.flower2, DECOR.flower3][i % 3], px, py, 1, false)
    })
  }
}

/* 소리 아이템 — 블록당 8개(목업). 제품에선 SOUND_ITEMS.Animal 을 매핑한다. */
const CATS = ['Bark', 'Moo', 'Cluck', 'Bleat', 'Oink', 'Bird', 'Purr', 'Neigh']

/* 방목 동물 — 우리 밖을 어슬렁거리는 작은 동물들. 우리가 생산 거점이라면
   이 있들은 “마을에 사는 동물” — 길가·마당에 붙여 배치해야 생활감이 난다. */
function scatterStrays(v, tr, r) {
  const roam = ['chicken', 'chickenBrn', 'turkey', 'bunny', 'bunnyGrey', 'goat', 'goatStripe', 'sheep', 'pig', 'cowBrown']
  const inPen = (tx, ty) => v.pens.some((p) => tx >= p.x - 1 && tx < p.x + p.w + 1 && ty >= p.y - 1 && ty < p.y + p.h + 1)
  const cands = []
  for (let ty = 2; ty < MAP_H - 2; ty++) for (let tx = 2; tx < MAP_W - 2; tx++) {
    const c = tr[ty][tx]
    if (c !== 0 && c !== 1 && c !== 2) continue
    if (inPen(tx, ty)) continue
    const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
      const k = tr[ty + b] && tr[ty + b][tx + a]
      return k === 1 || k === 2
    })
    if (!near) continue
    const cx = tx * T + 16, cy = ty * T + 24
    if (v.colliders.some((cc) => cx > cc.x - 10 && cx < cc.x + cc.w + 10 && cy > cc.y - 10 && cy < cc.y + cc.h + 10)) continue
    cands.push([tx, ty])
  }
  const placed = []
  let guard = 0
  while (placed.length < 22 && guard++ < 900 && cands.length) {
    const c = cands[Math.floor(r() * cands.length)]
    if (placed.some((p) => Math.abs(p[0] - c[0]) < 3 && Math.abs(p[1] - c[1]) < 2)) continue
    placed.push(c)
    const a = ANIMALS[roam[Math.floor(r() * roam.length)]]
    v.sprites.push({
      spec: a, px: c[0] * T + (T - a.w * a.scale) / 2, py: c[1] * T + T - a.h * a.scale,
      scale: a.scale, sort: c[1] * T + T,
    })
  }
}

function spawnItems(v, tr, r) {
  v.districts.forEach((d) => {
    const cells = []
    for (let ty = d.area.y; ty < d.area.y + d.area.h; ty++) {
      for (let tx = d.area.x; tx < d.area.x + d.area.w; tx++) {
        if (ty < 1 || tx < 1 || ty >= MAP_H - 1 || tx >= MAP_W - 1) continue
        const code = tr[ty][tx]
        if (code === 3 || code === 4) continue
        const cx = tx * T + 16, cy = ty * T + 22
        const blocked = v.colliders.some((c) => cx > c.x - 6 && cx < c.x + c.w + 6 && cy > c.y - 6 && cy < c.y + c.h + 6)
        if (!blocked) cells.push([tx, ty])
      }
    }
    const placed = []
    let guard = 0
    while (placed.length < 8 && guard++ < 500 && cells.length) {
      const c = cells[Math.floor(r() * cells.length)]
      if (placed.some((p) => Math.abs(p[0] - c[0]) < 3 && Math.abs(p[1] - c[1]) < 3)) continue
      placed.push(c)
      v.items.push({
        id: 'Animal_' + (100000 + Math.floor(r() * 899999)),
        tx: c[0], ty: c[1], block: d.block, neon: d.neon,
        cat: CATS[Math.floor(r() * CATS.length)],
        phase: r() * 6.28, collected: false,
      })
    }
  })
}

/* ── 충돌 ─────────────────────────────────────────────────── */
export const PLAYER_BOX = { w: 20, h: 14 }
function hits(v, x, y) {
  const bx = x - PLAYER_BOX.w / 2, by = y - PLAYER_BOX.h
  for (const c of v.colliders)
    if (bx < c.x + c.w && bx + PLAYER_BOX.w > c.x && by < c.y + c.h && by + PLAYER_BOX.h > c.y) return true
  return false
}
export function moveWithCollision(v, pos, dx, dy) {
  let x = pos.x, y = pos.y
  if (dx && !hits(v, x + dx, y)) x += dx
  if (dy && !hits(v, x, y + dy)) y += dy
  return { x, y }
}

/* ── 정적 레이어 렌더 ─────────────────────────────────────── */
export function drawStatic(ctx, v) {
  const W = MAP_W * T, H = MAP_H * T
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = GRASS_BASE
  ctx.fillRect(0, 0, W, H)

  const tr = v.terrain
  // 잔디
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) drawSp(ctx, TILE_GRASS, tx * T, ty * T)
  // 길 / 광장 / 밭
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const c = tr[ty][tx]
    if (c === 1 || c === 2 || c === 4 || c === 5) drawSp(ctx, TILE_PATH, tx * T, ty * T)
    if (c === 2) { ctx.fillStyle = 'rgba(255,238,196,.16)'; ctx.fillRect(tx * T, ty * T, T, T) }
    if (c === 4) { ctx.fillStyle = 'rgba(72,44,22,.30)'; ctx.fillRect(tx * T, ty * T, T, T) }
  }
  // 길↔잔디 경계 페더링 — 딱딱한 직선 대신 흙/풀이 서로 물리게
  featherEdges(ctx, tr)
  // 밭 고랑
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (tr[ty][tx] !== 4) continue
    ctx.fillStyle = 'rgba(46,28,14,.22)'
    ctx.fillRect(tx * T, ty * T + 26, T, 4)
  }
  // 물 — 연못은 타일이 아니라 폴리곤으로 그린다(타일 계단 제거)
  v.ponds.forEach((pts, i) => drawPond(ctx, pts, i))
  // 물가 돌
  const r2 = rng(7)
  for (let ty = 1; ty < MAP_H - 1; ty++) for (let tx = 1; tx < MAP_W - 1; tx++) {
    if (tr[ty][tx] !== 0) continue
    const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tr[ty + b][tx + a] === 3)
    if (nearWater && r2() < 0.55) drawSp(ctx, pick(r2, NAT.rocks), tx * T + 6 + r2() * 10, ty * T + 8, 1.4)
  }
  // 다리 — 레퍼런스형 목교: 판자 데크 + 양쪽 난간 기둥
  v.bridges.forEach((b) => drawBridge(ctx, v, b))

  // 잔디 디테일
  v.detail.forEach((d) => drawSp(ctx, d.spec, d.px, d.py, d.scale || 1))
  // 작물
  v.crops.forEach((c) => drawSp(ctx, c.spec, c.tx * T + 8 + c.jx, c.ty * T + 6, 1.4))
  // 울타리
  v.fences.forEach((f) => drawSp(ctx, f.spec, f.tx * T + (f.offX || 0), f.ty * T, f.sc || 1))
  // y정렬 스프라이트(건물·나무·동물·소품)
  v.sprites.slice().sort((a, b) => a.sort - b.sort).forEach((s) => {
    ctx.globalAlpha = .18
    ctx.fillStyle = '#2f3a1c'
    const sw = s.spec.w * (s.scale || 1)
    ctx.beginPath()
    ctx.ellipse(s.px + sw / 2, s.py + s.spec.h * (s.scale || 1) - 3, sw * .34, 4, 0, 0, 6.3)
    ctx.fill()
    ctx.globalAlpha = 1
    drawSp(ctx, s.spec, s.px, s.py, s.scale || 1)
  })
  // 팻말
  v.signs.forEach((s) => drawSign(ctx, s.tx * T, s.ty * T, s.text))
}

/* 목교 — 레퍼런스 사진의 나무 다리: 데크 판자 + 진한 프레이밍,
   진행 방향과 직각으로 누운 판자 이은자리, 양쪽 가장자리에 난간 기둥. */
function drawBridge(ctx, v, b) {
  const tiles = []
  for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++)
    if (v.terrain[ty] && v.terrain[ty][tx] === 5) tiles.push([tx, ty])
  if (!tiles.length) return
  const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1])
  const vert = b.dir === 'v'
  const x0 = Math.min(...xs) * T + (vert ? 4 : -8)
  const x1 = (Math.max(...xs) + 1) * T - (vert ? 4 : -8)
  const y0 = Math.min(...ys) * T + (vert ? -8 : 4)
  const y1 = (Math.max(...ys) + 1) * T - (vert ? -8 : 4)
  const w = x1 - x0, h = y1 - y0

  ctx.fillStyle = 'rgba(24,32,40,.30)'
  ctx.fillRect(x0 + 3, y0 + 4, w, h)
  ctx.fillStyle = '#8a5c2c'
  ctx.fillRect(x0, y0, w, h)
  ctx.fillStyle = '#c19257'
  ctx.fillRect(x0 + 2, y0 + 2, w - 4, h - 4)
  ctx.fillStyle = 'rgba(122,80,38,.7)'
  if (vert) for (let y = y0 + 8; y < y1 - 2; y += 8) ctx.fillRect(x0 + 2, y, w - 4, 2)
  else for (let x = x0 + 8; x < x1 - 2; x += 8) ctx.fillRect(x, y0 + 2, 2, h - 4)
  ctx.fillStyle = 'rgba(255,236,196,.30)'
  if (vert) ctx.fillRect(x0 + 3, y0 + 2, 3, h - 4)
  else ctx.fillRect(x0 + 2, y0 + 3, w - 4, 3)

  const post = (px, py) => {
    ctx.fillStyle = '#6b4520'
    ctx.fillRect(px - 3, py - 13, 6, 15)
    ctx.fillStyle = '#9c6c35'
    ctx.fillRect(px - 2, py - 12, 4, 13)
    ctx.fillStyle = '#c9a06a'
    ctx.fillRect(px - 2, py - 12, 2, 13)
  }
  const rail = (rx, ry, rw, rh) => {
    ctx.fillStyle = '#7a5026'
    ctx.fillRect(rx, ry - 10, rw, rh)
    ctx.fillStyle = '#a9793f'
    ctx.fillRect(rx, ry - 10, rw, Math.max(1, rh - 1))
  }
  if (vert) {
    rail(x0 + 1, y0 + 8, 4, h - 16)
    rail(x1 - 5, y0 + 8, 4, h - 16)
    for (let y = y0 + 12; y < y1 - 4; y += 16) { post(x0 + 3, y); post(x1 - 3, y) }
  } else {
    rail(x0 + 8, y0 + 4, w - 16, 4)
    rail(x0 + 8, y1 - 1, w - 16, 4)
    for (let x = x0 + 12; x < x1 - 4; x += 16) { post(x, y0 + 6); post(x, y1 + 2) }
  }
}

function drawPond(ctx, pts, seedIdx) {
  const path = new Path2D()
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs) - 24, y0 = Math.min(...ys) - 24
  const x1 = Math.max(...xs) + 24, y1 = Math.max(...ys) + 24
  const r = rng(900 + seedIdx * 37)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 1) 흙 둔치 — 물가를 둘러싸는 짙은 흙 띄
  ctx.strokeStyle = '#6f4a2a'
  ctx.lineWidth = 13
  ctx.stroke(path)
  ctx.strokeStyle = '#8a5f38'
  ctx.lineWidth = 7
  ctx.stroke(path)

  // 2) 잔디 프린지 — 둔치 바깥으로 풀이 어긍리게 덮어내리는 스캘럭 테두리
  const grassTone = ['#7d8c4a', '#8b9a55', '#93a25c']
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[(i + 1) % pts.length]
    const dx = nx - x, dy = ny - y
    const len = Math.hypot(dx, dy) || 1
    const ox = -dy / len, oy = dx / len // 바깥방향 법선
    for (let t = 0; t < 1; t += 0.34) {
      const px = x + dx * t + ox * (5 + r() * 3)
      const py = y + dy * t + oy * (5 + r() * 3)
      ctx.fillStyle = pick(r, grassTone)
      ctx.beginPath()
      ctx.arc(px, py, 4 + r() * 3, 0, 6.3)
      ctx.fill()
    }
  }

  // 3) 물 — 구매 시트의 열린 물 타일을 폴리곤 안에만 클립해 반복
  ctx.save()
  ctx.clip(path)
  for (let y = Math.floor(y0 / 16) * 16; y < y1; y += 16)
    for (let x = Math.floor(x0 / 16) * 16; x < x1; x += 16) drawSp(ctx, TILE_WATER, x, y)
  ctx.fillStyle = 'rgba(58,140,162,.18)'
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  // 얕은 물 — 둔치 안쪽으로 밝은 띠
  ctx.strokeStyle = 'rgba(186,232,246,.42)'
  ctx.lineWidth = 10
  ctx.stroke(path)
  ctx.strokeStyle = 'rgba(255,255,255,.22)'
  ctx.lineWidth = 4
  ctx.stroke(path)
  // 수면 반짝임
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = 'rgba(255,255,255,.30)'
    const px = x0 + r() * (x1 - x0), py = y0 + r() * (y1 - y0)
    ctx.fillRect(Math.round(px), Math.round(py), 3 + Math.round(r() * 4), 2)
  }
  ctx.restore()

  // 4) 수초/연잎 — 물가에 붙는 잡초로 경계를 더 물려 보이게
  for (let i = 0; i < pts.length; i += 3) {
    if (r() < 0.45) continue
    const [x, y] = pts[i]
    drawSp(ctx, pick(r, NAT.bushes), Math.round(x) - 8, Math.round(y) - 12, 1.2)
  }
  // 5) 수련잎
  ctx.save()
  ctx.clip(path)
  for (let i = 0; i < 7; i++) {
    const px = x0 + 24 + r() * (x1 - x0 - 48), py = y0 + 24 + r() * (y1 - y0 - 48)
    ctx.fillStyle = i % 2 ? '#4e8f43' : '#5da54e'
    ctx.beginPath(); ctx.ellipse(px, py, 7 + r() * 3, 5 + r() * 2, 0, 0, 6.3); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.beginPath(); ctx.ellipse(px - 2, py - 1.5, 3, 2, 0, 0, 6.3); ctx.fill()
  }
  ctx.restore()
  ctx.restore()
}

function featherEdges(ctx, tr) {
  const r = rng(31337)
  const dirt = ['#c8a678', '#bb9765', '#d3b489']
  const grass = ['#7d8c4a', '#8b9a55', '#6f7f42']
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const c = tr[ty][tx]
      const isPath = c === 1 || c === 2
      const neighbours = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      for (const [dx, dy] of neighbours) {
        const nx = tx + dx, ny = ty + dy
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue
        const n = tr[ny][nx]
        const nIsPath = n === 1 || n === 2
        if (isPath === nIsPath) continue
        for (let i = 0; i < 7; i++) {
          const t = r()
          const px = tx * T + (dx === 0 ? t * T : dx > 0 ? T - r() * 9 : r() * 9)
          const py = ty * T + (dy === 0 ? t * T : dy > 0 ? T - r() * 9 : r() * 9)
          ctx.fillStyle = isPath ? pick(r, grass) : pick(r, dirt)
          const s = 2 + Math.floor(r() * 3)
          ctx.fillRect(Math.round(px), Math.round(py), s, s)
        }
      }
    }
  }
}

function drawSign(ctx, x, y, text) {
  ctx.font = 'bold 13px "Courier New", monospace'
  const w = ctx.measureText(text).width + 16
  ctx.fillStyle = '#6b4a2f'
  ctx.fillRect(x - 2, y - 2, w + 4, 24)
  ctx.fillStyle = '#a97c4e'
  ctx.fillRect(x, y, w, 20)
  ctx.fillStyle = '#3a2313'
  ctx.fillRect(x + 6, y + 20, 4, 10)
  ctx.fillRect(x + w - 10, y + 20, 4, 10)
  ctx.fillStyle = '#3a2313'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 8, y + 11)
}

/* ── 아이템(동물 발자국) ──────────────────────────────────── */
export function drawItem(ctx, it, t) {
  const bob = Math.sin(t / 380 + it.phase) * 5
  const x = it.tx * T + 16, y = it.ty * T + 18 + bob
  ctx.save()
  ctx.globalAlpha = .2
  ctx.fillStyle = '#20250f'
  ctx.beginPath(); ctx.ellipse(x, it.ty * T + 30, 9, 3.5, 0, 0, 6.3); ctx.fill()
  ctx.globalAlpha = 1
  const g = ctx.createRadialGradient(x, y, 1, x, y, 18)
  g.addColorStop(0, it.neon + 'cc')
  g.addColorStop(1, it.neon + '00')
  ctx.fillStyle = g
  ctx.fillRect(x - 18, y - 18, 36, 36)
  // 발바닥
  ctx.fillStyle = '#fff8e6'
  ctx.beginPath(); ctx.ellipse(x, y + 3, 6, 5, 0, 0, 6.3); ctx.fill()
  const toes = [[-5.5, -4], [-2, -6.5], [2, -6.5], [5.5, -4]]
  toes.forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 2.2, 2.4, 0, 0, 6.3); ctx.fill() })
  ctx.fillStyle = it.neon
  ctx.globalAlpha = .45
  ctx.beginPath(); ctx.ellipse(x, y + 3, 3.2, 2.6, 0, 0, 6.3); ctx.fill()
  ctx.globalAlpha = 1
  if (Math.sin(t / 200 + it.phase) > 0.4) {
    ctx.fillStyle = '#fffbe8'
    ctx.fillRect(x + 10, y - 11, 2, 2); ctx.fillRect(x - 12, y - 6, 2, 2)
  }
  ctx.restore()
}

/* ── 플레이어 ─────────────────────────────────────────────── */
export function drawPlayer(ctx, p, t, moving) {
  const row = CHAR.rows[p.dir] ?? 0
  const col = moving ? Math.floor(t / 100) % 8 : 0
  const dx = Math.round(p.x - 16), dy = Math.round(p.y - 30)
  ctx.globalAlpha = .22
  ctx.fillStyle = '#2f3a1c'
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 9, 4, 0, 0, 6.3); ctx.fill()
  ctx.globalAlpha = 1
  CHAR.layers.forEach((k) => {
    const im = IMG[k]
    if (!im) return
    ctx.drawImage(im, col * CHAR.frame, row * CHAR.frame, CHAR.frame, CHAR.frame, dx, dy, CHAR.frame, CHAR.frame)
  })
}

/* ── 잠금 구름 ────────────────────────────────────────────── */
export function drawLockFog(ctx, v, openTo, t) {
  v.districts.forEach((d) => {
    if (d.block <= openTo) return
    const a = d.area
    ctx.save()
    ctx.fillStyle = 'rgba(226,232,240,.80)'
    ctx.fillRect(a.x * T, a.y * T, a.w * T, a.h * T)
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    const r = rng(d.block * 97)
    const per = 10
    for (let i = 0; i <= a.w * per / 4; i++) {
      const px = a.x * T + (i / (a.w * per / 4)) * a.w * T
      const rad = 12 + r() * 10 + Math.sin(t / 900 + i) * 2
      ctx.beginPath(); ctx.arc(px, a.y * T, rad, 0, 6.3); ctx.fill()
      ctx.beginPath(); ctx.arc(px, (a.y + a.h) * T, rad, 0, 6.3); ctx.fill()
    }
    for (let i = 0; i <= a.h * per / 4; i++) {
      const py = a.y * T + (i / (a.h * per / 4)) * a.h * T
      const rad = 12 + r() * 10 + Math.cos(t / 900 + i) * 2
      ctx.beginPath(); ctx.arc(a.x * T, py, rad, 0, 6.3); ctx.fill()
      ctx.beginPath(); ctx.arc((a.x + a.w) * T, py, rad, 0, 6.3); ctx.fill()
    }
    ctx.fillStyle = 'rgba(80,72,58,.55)'
    ctx.font = 'bold 15px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('🔒 ' + d.name, (a.x + a.w / 2) * T, (a.y + a.h / 2) * T)
    ctx.textAlign = 'left'
    ctx.restore()
  })
}
