/**
 * AssetRegistry.js
 *
 * 에셋 경로 중앙 관리 파일.
 * 여기서 경로만 바꾸면 WorldMap / ZoneMap 전체에 반영됩니다.
 *
 * 📦 권장 다운로드:
 *   kenney.nl/assets/tiny-town       → tiles/, objects/
 *   kenney.nl/assets/roguelike-pack  → items/
 *   kenney.nl/assets/pixel-platformer → characters/ (또는 직접 제작)
 *
 * 📁 파일 배치 위치: public/assets/ 하위
 */

/* ─────────────────────────────────────────────
   바닥 타일 (TILE × TILE px 크기 PNG)
   · Kenney Tiny Town: "TX Tileset Ground.png" 에서 개별 추출
   · 없으면 null → SVG 단색 폴백 자동 사용
───────────────────────────────────────────── */
export const TILES = {
  grass:       '/assets/tiles/grass.png',       // 잔디 바닥
  path:        '/assets/tiles/path.png',         // 돌길
  path_center: '/assets/tiles/path_center.png', // 중앙 플라자 돌
  water:       '/assets/tiles/water.png',        // 물 바닥
  dirt:        '/assets/tiles/dirt.png',         // 흙바닥 (City)
  purple_floor:'/assets/tiles/purple_floor.png', // 보라 바닥 (Music)
  dark_floor:  '/assets/tiles/dark_floor.png',   // 어두운 바닥 (Mystery)
}

/* ─────────────────────────────────────────────
   월드맵 오브젝트 PNG
   · Kenney Tiny Town: "TX Tileset Tree.png" 등
───────────────────────────────────────────── */
export const OBJECTS = {
  // 나무 (3가지 변형)
  tree_01:    '/assets/objects/tree_01.png',
  tree_02:    '/assets/objects/tree_02.png',
  tree_03:    '/assets/objects/tree_03.png',

  // 꽃 (4가지)
  flower_yellow: '/assets/objects/flower_yellow.png',
  flower_pink:   '/assets/objects/flower_pink.png',
  flower_blue:   '/assets/objects/flower_blue.png',
  flower_white:  '/assets/objects/flower_white.png',

  // Zone 건물 / 특징 오브젝트
  cabin:      '/assets/objects/cabin.png',        // Forest 오두막
  well:       '/assets/objects/well.png',         // Forest 우물
  waterfall:  '/assets/objects/waterfall.png',    // Water 폭포
  dock:       '/assets/objects/dock.png',         // Water 부두
  clock_tower:'/assets/objects/clock_tower.png',  // City 시계탑
  fountain:   '/assets/objects/fountain.png',     // City 분수
  lamp_post:  '/assets/objects/lamp_post.png',    // City 가로등
  stage:      '/assets/objects/stage.png',        // Music 무대
  piano:      '/assets/objects/piano.png',        // Music 피아노
  guitar:     '/assets/objects/guitar.png',       // Music 기타
  speaker:    '/assets/objects/speaker.png',      // Music 스피커
  crystal:    '/assets/objects/crystal.png',      // Mystery 크리스탈
  altar:      '/assets/objects/altar.png',        // Mystery 제단

  // 공통
  bench:      '/assets/objects/bench.png',
  rock:       '/assets/objects/rock.png',
  fence:      '/assets/objects/fence.png',
}

/* ─────────────────────────────────────────────
   캐릭터 스프라이트 시트
   · 32×48px 프레임 기준 (조정 가능)
   · 없으면 SVG 픽셀 아트 폴백 자동 사용
───────────────────────────────────────────── */
export const CHARACTERS = {
  // 플레이어 스프라이트 시트 경로
  player_sheet: '/assets/characters/player_sheet.png',

  // 프레임 레이아웃 (스프라이트 시트 구조 정의)
  player_frames: {
    frameW:  32,    // 프레임 1개 너비 (px)
    frameH:  48,    // 프레임 1개 높이 (px)
    sheetW:  192,   // 시트 전체 너비 (frameW × 6)
    sheetH:  48,    // 시트 전체 높이
    // 방향별 프레임 x 오프셋 [idle, walk1, walk2]
    down:  [0,   32,  64],
    up:    [96,  128, 160],
    left:  [192, 224, 256],
    right: [288, 320, 352],
  },
}

/* ─────────────────────────────────────────────
   소리 아이템 아이콘
   · Kenney Roguelike Pack 추천 (200+ 아이콘)
───────────────────────────────────────────── */
export const ITEMS = {
  Animal: [
    '/assets/items/animal_sound_01.png',
    '/assets/items/animal_sound_02.png',
    '/assets/items/animal_sound_03.png',
    '/assets/items/animal_sound_04.png',
    '/assets/items/animal_sound_05.png',
  ],
  Human: [
    '/assets/items/human_sound_01.png',
    '/assets/items/human_sound_02.png',
    '/assets/items/human_sound_03.png',
    '/assets/items/human_sound_04.png',
    '/assets/items/human_sound_05.png',
  ],
  Nature: [
    '/assets/items/nature_sound_01.png',
    '/assets/items/nature_sound_02.png',
    '/assets/items/nature_sound_03.png',
    '/assets/items/nature_sound_04.png',
    '/assets/items/nature_sound_05.png',
  ],
  Urban: [
    '/assets/items/urban_sound_01.png',
    '/assets/items/urban_sound_02.png',
    '/assets/items/urban_sound_03.png',
    '/assets/items/urban_sound_04.png',
    '/assets/items/urban_sound_05.png',
  ],
  Music: [
    '/assets/items/music_sound_01.png',
    '/assets/items/music_sound_02.png',
    '/assets/items/music_sound_03.png',
    '/assets/items/music_sound_04.png',
    '/assets/items/music_sound_05.png',
  ],
  Lab: [
    '/assets/items/lab_sound_01.png',
    '/assets/items/lab_sound_02.png',
    '/assets/items/lab_sound_03.png',
    '/assets/items/lab_sound_04.png',
    '/assets/items/lab_sound_05.png',
  ],
}

/* ─────────────────────────────────────────────
   에셋 존재 여부 확인 (개발 중 폴백 지원)
   · 에셋이 없으면 자동으로 SVG 폴백 사용
   · 실제 배포 전에 모든 경로 채워넣기
───────────────────────────────────────────── */
export const ASSET_READY = {
  tiles:      false,   // true로 바꾸면 PNG 타일 사용
  objects:    false,   // true로 바꾸면 PNG 오브젝트 사용
  characters: false,   // true로 바꾸면 PNG 캐릭터 사용
  items:      false,   // true로 바꾸면 PNG 아이템 사용
  world:      true,   // true로 바꾸면 WorldMap 오토타일 지면 + 실제 장식 스프라이트 사용
}

/* ─────────────────────────────────────────────
   WorldMap 전용 — 구매한 "Cozy Farm" 타일시트 (shubibubi)
   원본: full version/tiles/tiles.png → public/assets/world/terrain.png
   타일 크기 32px = 이 프로젝트 TILE 상수와 동일(리사이즈 불필요), 좌표 단위 px.
   edge는 픽셀 색상 샘플링(python 스크립트로 4분면 색을 찍어서 확인)으로 찾은
   "N/E/W는 안쪽, S만 다른 지형(크림색 경계)" 모양 — lib/autotile.js가 회전시켜 재사용.
───────────────────────────────────────────── */
export const WORLD_TILESET = {
  src: '/assets/world/terrain.png',
  sheetW: 864,
  sheetH: 800,
  tile: 32,
  grass: { x: 0, y: 0 },
  dirt: {
    full: { x: 96, y: 352 },
    edge: { x: 96, y: 96  },
  },
  water: {
    full: { x: 96, y: 224 },
    edge: { x: 96, y: 192 },
  },
  decor: {
    tree1:  { x: 0,   y: 384, w: 32, h: 64 },
    tree2:  { x: 32,  y: 384, w: 32, h: 64 },
    pine:   { x: 64,  y: 384, w: 32, h: 64 },
    bush1:  { x: 96,  y: 416, w: 32, h: 32 },
    bush2:  { x: 128, y: 416, w: 32, h: 32 },
    bench1: { x: 192, y: 416, w: 32, h: 32 },
    bench2: { x: 224, y: 416, w: 32, h: 32 },
    fence:  { x: 0,   y: 480, w: 32, h: 32 },
    rock:   { x: 192, y: 480, w: 32, h: 32 },
    flower1: { x: 96,  y: 448, w: 32, h: 32 },
    flower2: { x: 128, y: 448, w: 32, h: 32 },
    flower3: { x: 160, y: 448, w: 32, h: 32 },
  },
}

/* ─────────────────────────────────────────────
   WorldMap 포털 건물 — 6개 구매 팩(Farm/Town/Fishing/Nature/Interior/Winter) 전부 열어보고
   존 테마에 가장 잘 맞는 걸로 하나씩 고름. 좌표는 스캔라인으로 여백을 찾아 픽셀 단위로
   직접 잰 값(격자 아님, 건물마다 크기 다름). 항목마다 자기 시트(src/sheetW/sheetH)를 따로 가짐.
     Human/Animal: full version(Cozy Farm) — 코티지/헛간, 그대로도 잘 어울림
     Urban: town full의 "Pub" (사용자가 레퍼런스로 보내준 것)
     Music: town full의 "Arcade!" — 네온 간판이 Farm의 별장식 오두막보다 훨씬 음악/엔터 느낌
     Lab: town full의 "Public Library" — 학구적·미스터리한 분위기가 온실보다 더 잘 맞음
     Nature: fishing_full의 파란 지붕 "Fish Shop" — 연못 옆에 물가 건물이라 자연스러움
     Museum: town full의 원형 로톤다 — 창문 안에 액자 그림이 걸려있어 "전시관" 느낌이 나서
       Sound Museum(수집한 소리를 전시)에 가장 잘 어울림. 예전엔 SVG로 손그린 사각 건물이었음.
───────────────────────────────────────────── */
const FARM_BUILDINGS_SHEET    = { src: '/assets/world/buildings.png',         sheetW: 1503, sheetH: 1072 }
const TOWN_BUILDINGS_SHEET    = { src: '/assets/world/town_buildings.png',    sheetW: 1152, sheetH: 1216 }
const FISHING_BUILDINGS_SHEET = { src: '/assets/world/fishing_buildings.png', sheetW: 368,  sheetH: 256 }

export const WORLD_BUILDINGS = {
  Human:  { ...FARM_BUILDINGS_SHEET,    x: 0, y: 36,  w: 66,  h: 78  },
  Animal: { ...FARM_BUILDINGS_SHEET,    x: 5, y: 115, w: 70,  h: 76  },
  Urban:  { ...TOWN_BUILDINGS_SHEET,    x: 7, y: 0,   w: 85,  h: 80  },
  Music:  { ...TOWN_BUILDINGS_SHEET,    x: 3, y: 92,  w: 92,  h: 85  },
  Lab:    { ...TOWN_BUILDINGS_SHEET,    x: 8, y: 650, w: 145, h: 100 },
  Nature: { ...FISHING_BUILDINGS_SHEET, x: 2, y: 3,   w: 76,  h: 62  },
  Museum: { ...TOWN_BUILDINGS_SHEET,    x: 2, y: 849, w: 93,  h: 90  },
}

/* ─────────────────────────────────────────────
   Lab("미지의 소리 마을") 존 전용 장식 — interior full 팩의 액자 포스터/러그 시트에서
   가져옴. ALIEN·BAT·해골·유령·악마 포스터는 decorations.png의 벽걸이 액자 줄에서,
   호박(잭오랜턴)·박쥐 실루엣은 rugs.png 맨 아래 계절 아이콘 줄에서 좌표를 픽셀 단위로
   직접 재서 잘랐다 (마을 자체 컨셉 "미지의 소리"에 맞춘 으스스한/미스터리 분위기).
───────────────────────────────────────────── */
const LAB_DECOR_SHEET  = { src: '/assets/lab/decorations.png', sheetW: 960, sheetH: 624 }
const LAB_RUGS_SHEET   = { src: '/assets/lab/rugs.png',        sheetW: 512, sheetH: 288 }
const LAB_STORAGE_SHEET = { src: '/assets/lab/storage.png',    sheetW: 448, sheetH: 576 }
const LAB_TABLES_SHEET  = { src: '/assets/lab/tables.png',     sheetW: 448, sheetH: 352 }
const LAB_CHAIRS_SHEET  = { src: '/assets/lab/chairs.png',     sheetW: 768, sheetH: 208 }

export const LAB_DECOR = {
  posterAlien:    { ...LAB_DECOR_SHEET, x: 209, y: 272, w: 15, h: 20 },
  posterBat:      { ...LAB_DECOR_SHEET, x: 113, y: 272, w: 15, h: 20 },
  posterGhost:    { ...LAB_DECOR_SHEET, x: 16,  y: 272, w: 15, h: 20 },
  posterSkeleton: { ...LAB_DECOR_SHEET, x: 81,  y: 272, w: 15, h: 20 },
  posterDemon:    { ...LAB_DECOR_SHEET, x: 97,  y: 272, w: 15, h: 20 },
  pumpkin:        { ...LAB_RUGS_SHEET,  x: 64,  y: 260, w: 33, h: 28 },
  bat:            { ...LAB_RUGS_SHEET,  x: 97,  y: 264, w: 33, h: 20 },
  // 실제 방 배치용 가구 — 참고 사진처럼 벽에 등을 붙인 가구+러그 조합을 만드는 데 쓴다.
  tv:        { ...LAB_DECOR_SHEET,    x: 548, y: 178, w: 25, h: 14 },
  rug:       { ...LAB_RUGS_SHEET,     x: 289, y: 32,  w: 30, h: 32 },
  wardrobe:  { ...LAB_STORAGE_SHEET,  x: 384, y: 1,   w: 31, h: 30 },
  table:     { ...LAB_TABLES_SHEET,   x: 1,   y: 1,   w: 30, h: 32 },
  chair:     { ...LAB_CHAIRS_SHEET,   x: 1,   y: 10,  w: 13, h: 35 },
}

/* ─────────────────────────────────────────────
   플레이어 캐릭터 — "Character v.2" 팩(shubibubi). 파츠(몸/옷/머리)를 같은 32×32
   격자에 겹쳐 그리는 레이어 시스템 — 각 시트가 "walk" 블록만 잘라낸 256×128(8열×4행).
   info.txt 확인 결과 행 = 방향(0:Down, 1:Up, 2:Left, 3:Right), 열 = 걷기 프레임(0~7).
   자연스러운 2프레임 걸음만 쓰면 되니 열 0(중립)·4(중간 스트라이드)만 사용.
   옷/머리 원본 파일은 색상 10~14종이 가로로 이어붙어 있는데, 첫 번째(x:0~256)만 사용.
───────────────────────────────────────────── */
export const WORLD_CHARACTER = {
  frame: 32,
  rows: { down: 0, up: 1, left: 3, right: 2 },
  // 시트 info.txt: "WALK FR: 100, Cell Size: 256x128" — 8열 전체가 한 걸음 주기
  // (0~3: 오른발 스텝, 4~7: 왼발 스텝)라 전부 순서대로 재생해야 걷는 모션이 된다.
  cols: [0, 1, 2, 3, 4, 5, 6, 7],
  layers: [
    { src: '/assets/world/player_body.png',    sheetW: 256, sheetH: 128 },
    { src: '/assets/world/player_clothes.png', sheetW: 256, sheetH: 128 },
    { src: '/assets/world/player_hair.png',    sheetW: 256, sheetH: 128 },
  ],
}

/* ─────────────────────────────────────────────
   Zone별 타일 매핑
───────────────────────────────────────────── */
export const ZONE_GROUND_TILE = {
  Animal: TILES.grass,
  Human:  TILES.dirt,
  Nature: TILES.water,
  Urban:  TILES.dirt,
  Music:  TILES.purple_floor,
  Lab:    TILES.dark_floor,
}