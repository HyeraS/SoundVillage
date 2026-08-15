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
     Nature: fishing_full의 파란 지붕 "Fish Shop" — 연못 옆에 물가 건물이라 자연스러움
     Museum: town full의 "Public Library" — 사용자가 도서관 마당(묘비+흰 펜스)으로 꾸미고 싶어한
       건 월드맵 중앙 허브(Sound Museum, UI 라벨 "도서관")였음. 처음엔 이름이 같다는 이유로
       Lab에 붙여놨었는데, 실제 의도한 "도서관"은 Museum이라 여기로 옮김.
     Lab: town full의 원형 로톤다 — 원래 Museum이 쓰던 것과 맞바꿈(사용자 확인 완료). 로톤다도
       "미지의" 느낌엔 나쁘지 않음.
───────────────────────────────────────────── */
const FARM_BUILDINGS_SHEET    = { src: '/assets/world/buildings.png',         sheetW: 1503, sheetH: 1072 }
const TOWN_BUILDINGS_SHEET    = { src: '/assets/world/town_buildings.png',    sheetW: 1152, sheetH: 1216 }
const FISHING_BUILDINGS_SHEET = { src: '/assets/world/fishing_buildings.png', sheetW: 368,  sheetH: 256 }

export const WORLD_BUILDINGS = {
  Human:  { ...FARM_BUILDINGS_SHEET,    x: 0, y: 36,  w: 66,  h: 78  },
  Animal: { ...FARM_BUILDINGS_SHEET,    x: 5, y: 115, w: 70,  h: 76  },
  Urban:  { ...TOWN_BUILDINGS_SHEET,    x: 7, y: 0,   w: 85,  h: 80  },
  Music:  { ...TOWN_BUILDINGS_SHEET,    x: 3, y: 92,  w: 92,  h: 85  },
  Lab:    { ...TOWN_BUILDINGS_SHEET,    x: 2, y: 849, w: 93,  h: 90  },
  Nature: { ...FISHING_BUILDINGS_SHEET, x: 2, y: 3,   w: 76,  h: 62  },
  Museum: { ...TOWN_BUILDINGS_SHEET,    x: 8, y: 650, w: 145, h: 100 },
}

/* ─────────────────────────────────────────────
   "100 Nature Things" 팩 — WorldMap 장식이 나무 3종/덤불 2종/꽃 3종뿐이라 배리에이션이
   부족했던 문제를 해결하려고 도입. 10종류 카테고리가 균일 그리드로 들어있음:
   나무만 5열×2행(32×32), 나머지(덤불/꽃/버섯/바위/크리스탈)는 10열×1행(16×16) —
   알파 채널 스캔으로 그리드 경계를 확인함(균일 16px라고 어림짐작했다가 실제로는
   카테고리별로 32px/16px가 섞여있어서 여러 번 잘못 잘랐던 시행착오 끝에 확정한 값).
───────────────────────────────────────────── */
const NATURE_SHEET = { src: '/assets/world/nature.png', sheetW: 160, sheetH: 208 }
function natureRow(y, count, w = 16, h = 16) {
  return Array.from({ length: count }, (_, i) => ({ ...NATURE_SHEET, x: i * w, y, w, h }))
}
export const WORLD_NATURE = {
  // 사과/오렌지/자작/소나무/단풍(1행), 등근수관/벚꽃(분홍)/저주받은나무(검정)/고사목(2행)
  trees:     [...natureRow(0, 5, 32, 32), ...natureRow(32, 5, 32, 32)],
  bushes:    natureRow(96, 10),
  flowers:   natureRow(112, 10),
  mushrooms: natureRow(128, 10),
  rocks:     natureRow(144, 10),
  crystals:  natureRow(160, 10),
  // 자연 마을(Nature) 전용으로 추가 — 무당벌레/벌/거미/고치/애벌레/사마귀/잠자리/딱정벌레/굼벵이
  insects:     natureRow(176, 10),
  // 나비 10종(주황/파랑/체크무늬 등)
  butterflies: natureRow(192, 10),
}

/* ─────────────────────────────────────────────
   랜드마크 소품 — 특정 존에만 어울리는 큼직한 단일 오브젝트.
   실루엣/사일로/풍차는 Farm 팩 Buildings 시트(이미 포털 건물용으로 복사해 둔
   buildings.png) 안에서 추가로 찾은 것 — 새 파일 복사 없이 좌표만 추가.
   가로등(streelight_flicker.gif 첫 프레임)은 원래 애니메이션 gif라 정적 PNG로
   추출해서 별도 복사.
───────────────────────────────────────────── */
export const WORLD_PROPS = {
  silo:       { ...FARM_BUILDINGS_SHEET, x: 982, y: 124, w: 42,  h: 68  },
  windmill:   { ...FARM_BUILDINGS_SHEET, x: 931, y: 280, w: 90,  h: 104 },
  streetlight: { src: '/assets/world/streetlight.png', sheetW: 16, sheetH: 48, x: 0, y: 0, w: 16, h: 48 },
  // terrain.png(WORLD_TILESET과 같은 시트) 맨 아래줄에서 알파 스캔으로 찾음
  scarecrow:  { src: '/assets/world/terrain.png', sheetW: 864, sheetH: 800, x: 0,   y: 747, w: 18, h: 37 },
  chest:      { src: '/assets/world/terrain.png', sheetW: 864, sheetH: 800, x: 185, y: 780, w: 19, h: 20 },
}

/* ─────────────────────────────────────────────
   Animal Zone 전용 — Cozy Farm 팩의 개별 동물 스프라이트(동물마다 시트가 따로 있고,
   info.txt에 적힌 셀 크기가 전부 다름). 걷기/자기 애니메이션 첫 프레임(정면 대기 포즈,
   0,0칸)만 정적 장식으로 사용 — 이 프로젝트엔 동물 AI/이동이 없으므로 움직이는 캐릭터가
   아니라 WorldMap의 나무/덤불처럼 펜 안에 배치하는 정적 소품으로 취급한다.
───────────────────────────────────────────── */
function animalSheet(file, cell) {
  return { src: `/assets/world/animals/${file}`, sheetW: cell * 4, sheetH: cell * 5, x: 0, y: 0, w: cell, h: cell }
}
export const WORLD_ANIMALS = {
  chicken:       animalSheet('chicken.png', 16),
  chicken_brown: animalSheet('chicken_brown.png', 16),
  cow:           animalSheet('cow.png', 24),
  cow_black:     animalSheet('cow_black.png', 24),
  cow_brown:     animalSheet('cow_brown.png', 24),
  pig:           animalSheet('pig.png', 20),
  pig_stripe:    animalSheet('pig_stripe.png', 20),
  sheep:         animalSheet('sheep.png', 17),
  goat:          animalSheet('goat.png', 19),
  goat_stripe:   animalSheet('goat_stripe.png', 19),
  bunny:         animalSheet('bunny.png', 17),
  bunny_grey:    animalSheet('bunny_grey.png', 17),
  turkey:        animalSheet('turkey.png', 17),
}

/* ─────────────────────────────────────────────
   Animal Zone 전용 — Coop/Barn/Greenhouse 건물(움짤 gif의 첫 프레임을 정적 PNG로
   추출해서 사용, public/assets/world/*.png). 실제 크기 그대로(원본 픽셀 크기).
───────────────────────────────────────────── */
export const WORLD_FARM_BUILDINGS = {
  barn:       { src: '/assets/world/barn.png',       sheetW: 80,  sheetH: 80, x: 0, y: 0, w: 80,  h: 80 },
  coop:       { src: '/assets/world/coop.png',        sheetW: 64,  sheetH: 64, x: 0, y: 0, w: 64,  h: 64 },
  greenhouse: { src: '/assets/world/greenhouse.png',  sheetW: 112, sheetH: 80, x: 0, y: 0, w: 112, h: 80 },
}

/* ─────────────────────────────────────────────
   Animal Zone 전용 — 생산물 아이콘 (ui/items.png → farm_items.png, 16px 그리드).
   item list.txt 순서와 알파 스캔으로 맞춘 행/열 좌표. 펜 위에 뜨는 말풍선 아이콘과
   펜 안의 사료/건초 소품으로 재사용한다.
───────────────────────────────────────────── */
const FARM_ITEMS_SHEET = { src: '/assets/world/farm_items.png', sheetW: 160, sheetH: 192 }
function farmItem(col, row) {
  return { ...FARM_ITEMS_SHEET, x: col * 16, y: row * 16, w: 16, h: 16 }
}
export const WORLD_PRODUCE = {
  wheat:        farmItem(9, 0),
  cowMilk:      farmItem(0, 3),
  goatMilk:     farmItem(1, 3),
  cheese:       farmItem(3, 3),
  mozzarella:   farmItem(4, 3),
  goatCheese:   farmItem(5, 3),
  bacon:        farmItem(6, 3),
  whiteFeather: farmItem(7, 3),
  brownFeather: farmItem(8, 3),
  turkeyFeather:farmItem(9, 3),
  whiteEgg:     farmItem(0, 4),
  brownEgg:     farmItem(2, 4),
  greenEgg:     farmItem(4, 4),
  blueEgg:      farmItem(6, 4),
  mayo:         farmItem(8, 4),
  whiteWool:    farmItem(0, 5),
  greyWool:     farmItem(1, 5),
  hay:          farmItem(6, 5),
  // 장미 6종(빨강/주황/노랑/분홍/보라/파랑) — row 8(y=128), col 0~5. 알파 스캔으로
  // 확인(각 셀 16×16, 타이트 바운딩박스 15×15로 셀에 꽉 참). black(col6)은 요청 색상
  // 6종에 없어 제외.
  roseRed:      farmItem(0, 8),
  roseOrange:   farmItem(1, 8),
  roseYellow:   farmItem(2, 8),
  rosePink:     farmItem(3, 8),
  rosePurple:   farmItem(4, 8),
  roseBlue:     farmItem(5, 8),
}

/* ─────────────────────────────────────────────
   Animal Zone 전용 바닥 — WORLD_TILESET과는 별개의 독립 객체(참조 공유 안 함).
   tiles.png의 잔디 오토타일은 전부 "흙바닥 위 잔디 패치"(가장자리가 깎여 섬처럼
   생김) 스타일이라 그대로 이어붙이면 체크무늬처럼 끊겨 보인다(4×4 반복 테스트로
   확인 완료). WorldMap도 같은 이유로 잔디 배경 자체는 단색을 쓰고 그 위에 소품만
   얹는 방식이라, 여기서도 grassBase는 그 잔디 타일 내부 픽셀에서 직접 샘플링한
   실제 색(#83924C)을 쓰고, 그 위에 진짜로 존재하는 풀 새싹(sprout) 스프라이트
   7종(알파 스캔으로 좌표 확인, 새로 그리지 않음)을 흩뿌려 질감을 낸다.
───────────────────────────────────────────── */
const ANIMAL_TILES_SHEET = { src: '/assets/world/terrain.png', sheetW: 864, sheetH: 800 }
// "town full" 팩 원본(town full/tiles/tiles.png → public/assets/world/terrain-town.png).
// 길(연한 갈색 흙길) 텍스처는 Cozy Farm 시트가 아니라 이 시트에서 가져온다 — 사용자가
// 직접 지정한 레퍼런스. (80,40,32,32)는 블롭 오토타일 가장자리를 전혀 안 물고 있는
// 순수 안쪽 타일이라(픽셀 스캔으로 확인) 이음매 없이 반복 타일링된다.
const TOWN_TILES_SHEET = { src: '/assets/world/terrain-town.png', sheetW: 720, sheetH: 1072 }
export const ANIMAL_ZONE_TILESET = {
  grassBase: '#83924C',
  pathTexture: { ...TOWN_TILES_SHEET, x: 80, y: 40, w: 32, h: 32 },
  // 잔디 블롭 오토타일은 가장자리가 섬처럼 깎여있어서 그대로 이어 붙이면 체크무늬로
  // 끊겨 보인다(4×4 반복 테스트로 이미 확인된 문제 — WorldMap도 같은 이유로 잔디는
  // 단색을 씀). (8,8,32,32)는 큰 블롭 정중앙 안쪽이라 곡선을 하나도 안 물고 있어서
  // 이음매 없이 반복 타일링된다(픽셀 스캔 + 4×4 반복 테스트로 확인).
  grassTexture: { ...ANIMAL_TILES_SHEET, x: 8, y: 8, w: 32, h: 32 },
  detail: [
    { ...ANIMAL_TILES_SHEET, x: 84,  y: 6,  w: 9,  h: 5  },
    { ...ANIMAL_TILES_SHEET, x: 97,  y: 6,  w: 15, h: 14 },
    { ...ANIMAL_TILES_SHEET, x: 115, y: 7,  w: 9,  h: 13 },
    { ...ANIMAL_TILES_SHEET, x: 129, y: 7,  w: 11, h: 13 },
    { ...ANIMAL_TILES_SHEET, x: 145, y: 6,  w: 15, h: 14 },
    { ...ANIMAL_TILES_SHEET, x: 163, y: 7,  w: 9,  h: 13 },
    { ...ANIMAL_TILES_SHEET, x: 175, y: 5,  w: 14, h: 15 },
  ],
  // /fence-test 격리 테스트에서 확정한 두 조각. 세로 구간은 절대 rail을
  // 회전시키지 않고 post를 촘촘히 반복한다 — 회전시키면 레일이 타일 중심
  // 기준 비대칭이라 어긋난다는 게 테스트로 증명됨.
  // post는 원본이 32px 칸 안에 반쪽짜리 기둥 2개가 붙어있어서 왼쪽 절반(16px)만 씀.
  fenceRail: { ...ANIMAL_TILES_SHEET, x: 0,  y: 480, w: 32, h: 32 },
  fencePost: { ...ANIMAL_TILES_SHEET, x: 32, y: 480, w: 16, h: 32 },
}

/* ─────────────────────────────────────────────
   Nature Zone("자연 마을") 전용 — 집 5채짜리 마을 씬으로 교체하면서 새로 추가.
   잔디/흙길/나무펜스 rail·post는 ANIMAL_ZONE_TILESET과 완전히 같은 소스라 그대로
   재사용(중복 등록 안 함) — ZoneMap.js에서 ANIMAL_ZONE_TILESET.grassTexture /
   pathTexture / fenceRail / fencePost를 그대로 참조한다. 여기는 Animal 존엔 없는
   것만: 게이트·코너 펜스, 연못 물, 다리 난간, 벤치, 그리고 buildings.png(집 시트,
   terrain.png와 다른 파일!)에서 정밀하게 잘라낸 집 5채.
   ⚠ 집 좌표는 buildings.png 기준이라 ANIMAL_TILES_SHEET(terrain.png)와 헷갈리면 안 됨
   — 처음에 이 실수로 집 대신 잔디/펜스 조각이 잘려 나온 적 있음(재확인 완료).
───────────────────────────────────────────── */
const FARM_HOUSE_SHEET = { src: '/assets/world/buildings.png', sheetW: 1503, sheetH: 1072 }
export const NATURE_VILLAGE_TILESET = {
  fenceCorner: { ...ANIMAL_TILES_SHEET, x: 64, y: 480, w: 32, h: 32 },
  fenceGate:   { ...ANIMAL_TILES_SHEET, x: 0,  y: 464, w: 32, h: 32 },
  waterFull:   { ...ANIMAL_TILES_SHEET, x: 96, y: 224, w: 32, h: 32 },
  // 다리 밑은 town 연못 타일(회청색) — farm 물과 살짝 톤이 달라 다리 부분임을 구분해줌
  waterPond:   { ...TOWN_TILES_SHEET, x: 112, y: 192, w: 16, h: 16 },
  // 나무 난간(기둥+가로대, 위아래는 투명) — 다리 자리엔 waterPond를 먼저 깔고 그 위에 얹는다
  bridgeRailing: { ...ANIMAL_TILES_SHEET, x: 96, y: 704, w: 32, h: 32 },
  bench: { ...TOWN_TILES_SHEET, x: 264, y: 938, w: 32, h: 20 },
  houses: {
    cream:     { ...FARM_HOUSE_SHEET, x: 3,   y: 39,  w: 58,  h: 72  },
    dark:      { ...FARM_HOUSE_SHEET, x: 3,   y: 450, w: 74,  h: 83  },
    green:     { ...FARM_HOUSE_SHEET, x: 891, y: 450, w: 101, h: 83  },
    victorian: { ...FARM_HOUSE_SHEET, x: 696, y: 534, w: 82,  h: 73  },
    // 오두막만 Cozy Town 건물 시트(town_buildings.png, buildings.png와도 다른 파일)
    cabin:     { ...TOWN_BUILDINGS_SHEET, x: 3, y: 759, w: 88, h: 89 },
  },
}

/* ─────────────────────────────────────────────
   WorldMap Sound Museum(중앙 허브, UI 라벨 "도서관", 건물 스프라이트는 town 팩
   "Public Library") 전용 마당 장식 — terrain-town.png(TOWN_TILES_SHEET, 위
   NATURE_VILLAGE_TILESET과 같은 시트)에서 알파 채널 스캔으로 새로 찾음. 6개 Zone 포털은
   기존 갈색 ANIMAL_ZONE_TILESET 펜스를 그대로 씀 — Museum만 레퍼런스(도서관 마당)에 맞춰
   크림색 피켓펜스로 교체.
   - fenceRail: 8×32 낱장 피켓 1개 — 가로로 반복 타일링하면 이음매 없이 이어짐(5장 반복 테스트로 확인).
   - fencePost: 8×47(코너/게이트 기둥, 세로가 TILE(32)보다 길어 위로 살짝 튀어나오게 바닥 기준 배치).
   - fenceCorner: 32×31 L자 코너 — 4방향 전부 같은 스프라이트를 그대로 씀(회전 없음, ANIMAL_ZONE_TILESET
     계열 프로젝트 관례를 그대로 따름 — ZoneMap.js의 natureFenceCorner도 회전 없이 재사용).
   - gravestones: 11종, 묘지 마당용(이전엔 코드 어디에도 없던 신규 스캔, grep 결과 0건 확인 후 추가).
   - stonePath: 32×32 회색 판석 타일(TILE 순정 크기, 4×4 반복 타일링 확인). 원래
     (566,5,37,38)를 썼었는데 37×38→32×32로 강제 스케일링하면서 SVG viewBox 크롭 경계에
     비정수 배율 안티에일리어싱이 생겨, 그 반투명 가장자리로 뒤 잔디 배경이 타일 세로
     경계마다 초록 줄로 새어 보이는 렌더링 버그가 있었음(소스 PNG 자체는 깨끗함, 라이브
     렌더링 확대 스크린샷으로 재현·확인). 같은 벽돌 패턴 안에서 스케일링이 필요 없는
     32×32 순정 좌표(568,7)로 교체해 해결 — renderW/renderH 강제 지정 자체가 필요 없어짐.
───────────────────────────────────────────── */
export const LIBRARY_YARD = {
  fenceRail:   { ...TOWN_TILES_SHEET, x: 8,   y: 289, w: 8,  h: 32 },
  fencePost:   { ...TOWN_TILES_SHEET, x: 0,   y: 289, w: 8,  h: 47 },
  fenceCorner: { ...TOWN_TILES_SHEET, x: 96,  y: 305, w: 32, h: 31 },
  stonePath:   { ...TOWN_TILES_SHEET, x: 568, y: 7,   w: 32, h: 32 },
  gravestones: [
    { ...TOWN_TILES_SHEET, x: 1,   y: 514, w: 14, h: 14 },
    { ...TOWN_TILES_SHEET, x: 17,  y: 514, w: 13, h: 14 },
    { ...TOWN_TILES_SHEET, x: 32,  y: 514, w: 16, h: 14 },
    { ...TOWN_TILES_SHEET, x: 50,  y: 513, w: 12, h: 17 },
    { ...TOWN_TILES_SHEET, x: 66,  y: 514, w: 12, h: 14 },
    { ...TOWN_TILES_SHEET, x: 80,  y: 512, w: 16, h: 18 },
    { ...TOWN_TILES_SHEET, x: 97,  y: 512, w: 14, h: 18 },
    { ...TOWN_TILES_SHEET, x: 113, y: 513, w: 14, h: 17 },
    { ...TOWN_TILES_SHEET, x: 130, y: 514, w: 12, h: 14 },
    { ...TOWN_TILES_SHEET, x: 144, y: 516, w: 16, h: 12 },
    { ...TOWN_TILES_SHEET, x: 162, y: 516, w: 8,  h: 12 },
  ],
}

/* ─────────────────────────────────────────────
   Urban Zone 결절점(버스정류장) 소품 — terrain-town.png(TOWN_TILES_SHEET)에서 알파
   채널 스캔으로 새로 찾음. 이 구간은 원본 시트에 소품 사이 여백(패딩)이 전혀 없어서
   (쉘터↔BUS폴↔쉘터↔버스↔버스↔버스↔티켓부스가 전부 픽셀 단위로 맞닿아 있음) 개별
   부품으로 완전히 분리하는 게 불가능했다 — busStop은 지붕+시간표게시판+벤치2개+BUS
   표지판폴을 통째로 한 스프라이트로 잘랐다. 버스/티켓부스는 서로 다른 색(광고 포스터)
   변형이 나란히 있어서 그중 앞쪽 것만 각각 잘라 씀. 좌표는 Kevin Lynch "The Image of
   the City"의 5요소(랜드마크/경로/결절점/구역/경계) 리스킨 중 결절점(node) 전용.
───────────────────────────────────────────── */
export const URBAN_TRANSIT = {
  busStop:     { ...TOWN_TILES_SHEET, x: 0,   y: 798, w: 64, h: 66 },
  // 최초엔 x간격을 96으로 잘못 재서 버스 2대의 반쪽씩이 이어붙은 것처럼 잘려
  // 보이는 버그가 있었다(격리 렌더링으로 확인) — 언더캐리지(바퀴+어두운 바닥
  // 띠) 열의 알파 스캔으로 실제 반복 간격이 80px임을 재확인해 고쳤다.
  bus: [
    { ...TOWN_TILES_SHEET, x: 128, y: 808, w: 80, h: 52 },
    { ...TOWN_TILES_SHEET, x: 208, y: 808, w: 80, h: 52 },
    { ...TOWN_TILES_SHEET, x: 288, y: 808, w: 80, h: 52 },
  ],
  ticketBooth: { ...TOWN_TILES_SHEET, x: 368, y: 823, w: 37, h: 45 },
}

/* ─────────────────────────────────────────────
   Urban Zone 랜드마크 2곳 — Kevin Lynch 리스킨의 나머지 요소. Town Station은
   terrain-town.png(TOWN_TILES_SHEET) 안의 "Town Station" 간판이 박힌
   캐노피+계단 플랫폼(건물이 아니라 개방형 구조물, buildings_all.png의 12개
   건물 목록엔 station이 없음을 확인 후 대안으로 채택). 정차된 기차는 별도
   파일(town full/train/train.png, public/assets/world/train.png로 복사)의
   증기기관차 — 4칸 열차 한 세트 중 뒤쪽 예비 엔진 1칸만 잘라 씀(알파 스캔으로
   실제 간격이 92px+4px 갭임을 확인, 좌우 여백까지 넉넉히 확인해 잘림 없음).
   SUPAM 슈퍼마켓은 buildings_all.png(TOWN_BUILDINGS_SHEET, WORLD_BUILDINGS와
   같은 시트) 안에서 알파 스캔으로 새로 찾음.
───────────────────────────────────────────── */
const TRAIN_SHEET = { src: '/assets/world/train.png', sheetW: 1344, sheetH: 640 }
export const URBAN_LANDMARKS = {
  stationCanopy: { ...TOWN_TILES_SHEET, x: 0,   y: 868, w: 128, h: 92 },
  trainEngine:   { ...TRAIN_SHEET,      x: 416, y: 313, w: 92,  h: 55 },
  supam:         { ...TOWN_BUILDINGS_SHEET, x: 4, y: 945, w: 167, h: 127 },
}

/* ─────────────────────────────────────────────
   Urban Zone 구역 경계(edge) 펜스 — LIBRARY_YARD의 베이지 펜스와 톤을 다르게
   하려고 같은 terrain-town.png에서 짙은 남색 계열 행을 새로 스캔. 코너는
   buildYardFence() 관례 그대로 전용 스프라이트 없이 fencePost로 처리한다.
   rail은 처음에 h:43으로 크롭했다가 실사용 화면에서 가로줄이 두 겹으로
   보이는 버그가 있었음 — 격리 렌더링+세로 알파 프로파일로 재검사해보니
   이 시트는 같은 자리에 피켓 하나(불투명)+그 아래 여백(투명, TILE 높이를
   채우기 위한 패딩)이 한 세트이고, 그 밑에 다른 변형이 하나 더 이어붙어
   있어서 h:43이 그 다음 변형 일부까지 같이 잘라온 것이었다(베이지
   LIBRARY_YARD.fenceRail도 똑같이 "불투명 13px + 투명 패딩"으로 h:32인 것과
   동일 패턴 — 베이지 쪽은 처음부터 올바르게 h:32였을 뿐). h:32로 고쳐서
   해결. 렌더링도 LIBRARY_YARD와 같은 방식(네이티브 배율, rail은 타일 폭을
   채우도록 반복, post는 바닥 기준 앵커)을 그대로 따라야 한다 — LabSprite에
   scale:2를 그대로 써서 타일당 한 번만 찍었던 게 실제 원인이었다(48px 높이
   포스트가 96px로 늘어나 옆 칸까지 겹쳐 보임).
───────────────────────────────────────────── */
export const URBAN_EDGE = {
  fenceRail: { ...TOWN_TILES_SHEET, x: 10, y: 352, w: 7, h: 32 },
  fencePost: { ...TOWN_TILES_SHEET, x: 2,  y: 352, w: 7, h: 48 },
}
// URBAN_TRANSIT/URBAN_LANDMARKS/URBAN_EDGE(위 3개)는 SVG 스캐터 버전(Kevin Lynch
// 리스킨) 전용이라 이제 ZoneMap.js에서 안 쓴다 — app/urban-sprite-test가 여전히
// 참조하고 있어서 삭제하지 않고 남겨둠(지우면 그 테스트 페이지가 빌드 에러).

/* ─────────────────────────────────────────────
   Urban Zone 재구현 — Kenney RPG Urban Pack(kenney_rpg-urban-pack/, CC0)으로 완전히
   교체. 그리드 단위는 육안 어림짐작이나 이전 Nature 존에서 쓴 32px를 재사용하지 않고
   Tilemap/tilemap.png를 alpha 채널로 스캔해 독립 재측정했다 — 투명 거터 행/열이 17px
   주기(16px 타일 + 1px 여백)로 반복되는 걸 실측 확인했고, Tiles/*.png(Kenney가 이미
   낱개로 잘라둔 원본) 486장이 전부 예외 없이 16×16인 것으로 재확인(교차검증 2건 일치).
   렌더링엔 여백 없는 Tilemap/tilemap_packed.png(432×288, 27열×18행, public/assets/
   world/urban/kenney_tilemap.png로 복사)를 쓴다 — 크롭 좌표가 열*16, 행*16으로 단순해짐.
   모든 좌표는 alpha_bbox 스캔(각 후보 좌표를 16px 그리드 셀 단위로 먼저 추정한 뒤,
   그 셀 내부에서 실제 불투명 픽셀의 타이트한 bounding box만 잘라냄)으로 재계산했고,
   크롭 하나하나를 contact sheet로 렌더링해 육안으로 확인한 뒤에만 등록했다(Lab 존
   작업 때 실수로 다른 시트에서 잘못 크롭했던 사례 재발 방지).
───────────────────────────────────────────── */
const URBAN_KENNEY_SHEET = { src: '/assets/world/urban/kenney_tilemap.png', sheetW: 432, sheetH: 288 }

// 바닥/도로 표시 — 전부 16×16 순정 타일. road/sidewalk는 <pattern>으로 큰 영역을
// 채우고, crosswalk/laneDash/parkingBay/parkingSign/bikeMark는 특정 칸에만 개별
// 배치하는 마킹이라 discrete 오브젝트로 쓴다.
export const URBAN_KENNEY_GROUND = {
  road:        { ...URBAN_KENNEY_SHEET, x: 144, y: 256, w: 16, h: 16 }, // 순수 아스팔트(줄무늬 없음) — 이전 x16,y272 타일엔 바닥에 가로 커브선이 박혀있어 패턴 반복 시 세로 도로에도 가로줄이 찍히는 버그가 있었다
  sidewalk:    { ...URBAN_KENNEY_SHEET, x: 144, y: 16,  w: 16, h: 16 },
  crosswalk:   { ...URBAN_KENNEY_SHEET, x: 48,  y: 256, w: 16, h: 16 },
  laneDash:    { ...URBAN_KENNEY_SHEET, x: 48,  y: 272, w: 16, h: 16 },
  parkingBay:  { ...URBAN_KENNEY_SHEET, x: 80,  y: 256, w: 32, h: 32 },
  parkingSign: { ...URBAN_KENNEY_SHEET, x: 160, y: 256, w: 16, h: 16 },
  bikeMark:    { ...URBAN_KENNEY_SHEET, x: 160, y: 272, w: 16, h: 16 },
  // 인도/도로 경계 커브 — 광장 타일(x128,y0) 좌상단 모서리의 "테두리선+체커무늬"
  // 부분만 좌우 모서리를 피해 중앙(x136)에서 잘라낸 것. 위에서부터 진한 경계선
  // (row0) → 체커 무늬(row1~4) → 그 아래는 순정 인도색(row5~)이라, 이 5px만
  // 떼어내면 "인도 쪽이 위, 도로 쪽이 아래"인 경계 스트립이 된다. 배치할 도로
  // 방향에 따라 flip/rotate로 4방향(남/북/동/서)을 다 만든다.
  curbEdge:    { ...URBAN_KENNEY_SHEET, x: 136, y: 0,   w: 16, h: 5  },
}

// 건물 — 벽돌 블롭(7열×4행, 이미 테두리+채움이 합쳐진 완성 패널이라 그대로 한 장으로
// 씀)에 문/창문/어닝을 겹쳐 올려서 파사드를 만든다. sample.png의 관공서(빨강 벽돌)와
// 상점(주황 벽돌+초록 어닝) 두 건물 타입에 대응.
export const URBAN_KENNEY_BUILDING = {
  wallRed:     { ...URBAN_KENNEY_SHEET, x: 256, y: 0,   w: 112, h: 64 },
  wallOrange:  { ...URBAN_KENNEY_SHEET, x: 256, y: 64,  w: 112, h: 64 },
  windowWide:  { ...URBAN_KENNEY_SHEET, x: 129, y: 208, w: 46,  h: 16 },
  windowTall:  { ...URBAN_KENNEY_SHEET, x: 226, y: 194, w: 12,  h: 30 },
  awningGreen: { ...URBAN_KENNEY_SHEET, x: 64,  y: 192, w: 16,  h: 9  },
  doorGlass:   { ...URBAN_KENNEY_SHEET, x: 226, y: 144, w: 12,  h: 16 },
  doorOrange:  { ...URBAN_KENNEY_SHEET, x: 224, y: 160, w: 16,  h: 16 },
  // 빨간 벽돌 건물(wallRed) 전용 파사드 세트 — sample.png 참고 요청으로 추가.
  // windowSmall은 처음에 (176,192,16,16)을 썼는데, alpha 스캔으로 확인해보니 그
  // 16×16 칸 안의 실제 불투명 내용물이 8×11px뿐이고 나머지는 투명 여백이었다
  // (칸 왼쪽 위로 치우쳐 있어 "벽 구석에 작게 박힌 사각형"으로 보인 원인).
  // (208,224,16,16)에 alpha 꽉 찬(=진짜 16×16 전체) 진짜 큰 창을 찾아 교체 —
  // 두꺼운 크림색 테두리+연한 하늘색 유리로 sample.png 창문과 스타일도 일치.
  // doorPlain/doorDouble은 이미 각각 12×16(75%)·16×16(100%) 알파로 큰 결손이
  // 없어 그대로 둔다(도어는 원래 실제 건축에서도 창문보다 폭이 좁은 게 정상).
  windowSmall: { ...URBAN_KENNEY_SHEET, x: 208, y: 224, w: 16,  h: 16 },
  doorPlain:   { ...URBAN_KENNEY_SHEET, x: 192, y: 144, w: 16,  h: 16 },
  doorDouble:  { ...URBAN_KENNEY_SHEET, x: 240, y: 192, w: 16,  h: 16 },
  // 지붕 — wallRed/wallOrange는 정면(파사드) 벽면일 뿐 지붕이 없어서(위쪽 끝이
  // 얇은 몰딩 띠로 끊김) 밀도 보강 리뷰에서 지적받음. sample.png의 건물 위에
  // 있는 평지붕(탑다운 시점, 옅은 탠/베이지+연보라 스캘럽 테두리)과 픽셀 단위로
  // 색이 정확히 일치하는 3×3 블롭을 시트에서 찾아(alpha 스캔+색상 대조:
  // sample.png 지붕 RGB(198,188,159) === 이 블롭 내부 RGB, 완전 일치) 9-slice로
  // 통째로 등록했다 — 처음엔 테두리 없이 내부 칸만 반복 타일링해서 sample.png의
  // 뚜렷한 테두리가 사라져 보인다는 지적을 받았고, 코너/변/내부 9칸을 전부 원본
  // 그대로 이어붙이는 방식으로 다시 만들었다.
  roofTL:  { ...URBAN_KENNEY_SHEET, x: 0,  y: 48, w: 16, h: 16 },
  roofTop: { ...URBAN_KENNEY_SHEET, x: 16, y: 48, w: 16, h: 16 },
  roofTR:  { ...URBAN_KENNEY_SHEET, x: 32, y: 48, w: 16, h: 16 },
  roofL:   { ...URBAN_KENNEY_SHEET, x: 0,  y: 64, w: 16, h: 16 },
  roofTile:{ ...URBAN_KENNEY_SHEET, x: 16, y: 64, w: 16, h: 16 }, // 내부 채움(패턴용, 기존 유지)
  roofR:   { ...URBAN_KENNEY_SHEET, x: 32, y: 64, w: 16, h: 16 },
  roofBL:  { ...URBAN_KENNEY_SHEET, x: 0,  y: 80, w: 16, h: 16 },
  roofBot: { ...URBAN_KENNEY_SHEET, x: 16, y: 80, w: 16, h: 16 },
  roofBR:  { ...URBAN_KENNEY_SHEET, x: 32, y: 80, w: 16, h: 16 },
}

// 차량 — 전부 정면(3/4) 시점 스프라이트, 도로 위에 정적 장식으로만 배치(색상 4종).
export const URBAN_KENNEY_VEHICLES = [
  { ...URBAN_KENNEY_SHEET, x: 245, y: 266, w: 22, h: 22 }, // 세단(빨강)
  { ...URBAN_KENNEY_SHEET, x: 244, y: 234, w: 24, h: 22 }, // 택시(주황+체커)
  { ...URBAN_KENNEY_SHEET, x: 336, y: 236, w: 16, h: 20 }, // 세단(초록)
  { ...URBAN_KENNEY_SHEET, x: 352, y: 236, w: 16, h: 20 }, // 밴(진초록, 짐칸)
]

// 가로수 — 인도 모서리·소규모 녹지용. teal(상록수)/orange(단풍) 2계열 × 단일/클러스터.
export const URBAN_KENNEY_TREES = {
  tealSingle:    { ...URBAN_KENNEY_SHEET, x: 257, y: 144, w: 14, h: 31 },
  tealCluster:   { ...URBAN_KENNEY_SHEET, x: 298, y: 144, w: 28, h: 31 },
  orangeSingle:  { ...URBAN_KENNEY_SHEET, x: 257, y: 177, w: 14, h: 46 },
  orangeCluster: { ...URBAN_KENNEY_SHEET, x: 298, y: 177, w: 28, h: 46 },
}

// 소품 — 신호등/가로등/표지판/쓰레기통/바리케이드/벤치/잔디밭. bikeMark(자전거
// 주차 표시)는 위 URBAN_KENNEY_GROUND에 이미 있어 도로 마킹으로 재사용한다.
// signBlue/barrierRed/plantar/fence/stall/meter는 밀도 보강 요청으로 추가 스캔한
// 것들 — 이 팩엔 라바콘·소화전·공중전화 부스·서 있는 자전거 스프라이트가 없어서
// (props 줄 전체를 다시 훑어 확인) 대신 있는 걸로 다양성을 채웠다.
export const URBAN_KENNEY_PROPS = {
  trafficLight: { ...URBAN_KENNEY_SHEET, x: 49,  y: 241, w: 13, h: 15 },
  lamp:         { ...URBAN_KENNEY_SHEET, x: 4,   y: 98,  w: 28, h: 46 },
  signRed:      { ...URBAN_KENNEY_SHEET, x: 67,  y: 96,  w: 11, h: 30 },
  signGreen:    { ...URBAN_KENNEY_SHEET, x: 81,  y: 96,  w: 15, h: 30 },
  signBlue:     { ...URBAN_KENNEY_SHEET, x: 101, y: 96,  w: 7,  h: 32 },
  barrierA:     { ...URBAN_KENNEY_SHEET, x: 80,  y: 148, w: 16, h: 12 }, // 주황/검정 줄무늬
  barrierB:     { ...URBAN_KENNEY_SHEET, x: 96,  y: 149, w: 16, h: 11 },
  barrierRed:   { ...URBAN_KENNEY_SHEET, x: 80,  y: 132, w: 16, h: 12 }, // 빨강/흰색 줄무늬(다른 줄)
  bench:        { ...URBAN_KENNEY_SHEET, x: 0,   y: 164, w: 32, h: 11 },
  trashcan:     { ...URBAN_KENNEY_SHEET, x: 36,  y: 160, w: 8,  h: 16 },
  trashcanRound:{ ...URBAN_KENNEY_SHEET, x: 163, y: 193, w: 10, h: 13 },
  grassPatch:   { ...URBAN_KENNEY_SHEET, x: 0,   y: 0,   w: 48, h: 48 }, // 소규모 녹지 3×3
  planter:      { ...URBAN_KENNEY_SHEET, x: 98,  y: 177, w: 12, h: 15 }, // 화단(건물 앞용)
  fence:        { ...URBAN_KENNEY_SHEET, x: 64,  y: 224, w: 64, h: 16 }, // 광장 경계용 4타일 반복 펜스
  stallFruit:   { ...URBAN_KENNEY_SHEET, x: 114, y: 161, w: 12, h: 15 }, // 노점 가판대(시장 골목용)
  parkingMeter: { ...URBAN_KENNEY_SHEET, x: 144, y: 194, w: 13, h: 13 },
}
// 보행자 — 정적 장식용(상호작용 없음, WORLD_CHARACTER의 실제 플레이어 캐릭터와는
// 별개). 인도 위에 소량 흩뿌려 sample.png처럼 사람이 걷는 거리 느낌을 낸다.
export const URBAN_KENNEY_PEDESTRIANS = [
  { ...URBAN_KENNEY_SHEET, x: 371, y: 2,   w: 9,  h: 14 },
  { ...URBAN_KENNEY_SHEET, x: 386, y: 65,  w: 12, h: 15 },
  { ...URBAN_KENNEY_SHEET, x: 371, y: 99,  w: 10, h: 13 },
  { ...URBAN_KENNEY_SHEET, x: 402, y: 195, w: 12, h: 13 },
]

// Urban 존 소리 아이템 아이콘 — 처음엔 "winter full" 진저브레드 쿠키를 썼다가
// "도시 느낌이랑 안 어울린다"는 피드백으로 "town full" 팩(items_inventory.png)의
// 핑크 도넛 + 그 위 커피로 교체(사용자가 첨부한 참고 이미지와 픽셀 단위로 대조해
// 확정). ZONE_PRODUCE_SPRITES와 동일한 방식(item.pulse로 풀 안에서 섞기)으로
// Urban에도 적용하므로 spawnSoundItems 자체는 손대지 않는다.
const TOWN_ITEMS_SHEET = { src: '/assets/items/town_items_inventory.png', sheetW: 816, sheetH: 128 }
export const URBAN_SOUND_ICONS = [
  { ...TOWN_ITEMS_SHEET, x: 32,  y: 32, w: 16, h: 16 }, // 커피
  { ...TOWN_ITEMS_SHEET, x: 112, y: 32, w: 16, h: 16 }, // 핑크 도넛
]

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
  // 창고 코너(옷장+체스트) 전용 — 보석 일러스트라 "보관/수납" 테마와 맞고, 다른 코너
  // 포스터 5종과 겹치지 않아 6개 코너 액자 배정에서 재사용 없이 전부 다르게 쓸 수 있다.
  posterGem:      { ...LAB_DECOR_SHEET, x: 193, y: 272, w: 15, h: 20 },
  pumpkin:        { ...LAB_RUGS_SHEET,  x: 64,  y: 260, w: 33, h: 28 },
  bat:            { ...LAB_RUGS_SHEET,  x: 97,  y: 264, w: 33, h: 20 },
  // 실제 방 배치용 가구 — 참고 사진처럼 벽에 등을 붙인 가구+러그 조합을 만드는 데 쓴다.
  tv:        { ...LAB_DECOR_SHEET,    x: 548, y: 178, w: 25, h: 14 },
  // 기존엔 무늬 없는 단색 원형 매트(x:289,y:32)라 어두운 바닥과 대비가 거의 없어
  // "이 구역을 담는 그릇" 느낌이 안 났다. 테두리 무늬가 있는 직사각형 러그(올리브
  // 그린 톤, 시트의 무늬 러그 줄에서 알파 스캔으로 좌표 확인)로 교체.
  rug:       { ...LAB_RUGS_SHEET,     x: 95,  y: 64,  w: 45, h: 33 },
  wardrobe:  { ...LAB_STORAGE_SHEET,  x: 384, y: 1,   w: 31, h: 30 },
  table:     { ...LAB_TABLES_SHEET,   x: 1,   y: 1,   w: 30, h: 32 },
  chair:     { ...LAB_CHAIRS_SHEET,   x: 1,   y: 10,  w: 13, h: 35 },
}

/* ─────────────────────────────────────────────
   슬라임 — Farm 팩 enemies/slime * 폴더의 색상별 개별 시트. 각 파일이 걷기/공격/사망
   애니메이션을 담고 있는 80×256 시트인데, 여기선 장식용으로 첫 대기 프레임(16×16 셀,
   좌상단)만 쓴다. WorldMap에서 미지의 소리 마을(Lab) 포털 주변을 어슬렁거리는
   작은 생물 장식으로 배치.
───────────────────────────────────────────── */
const SLIME_FRAME = { x: 0, y: 0, w: 16, h: 16 }
export const WORLD_SLIMES = [
  { color: 'red',     ...SLIME_FRAME, src: '/assets/world/slimes/slime_red.png',     sheetW: 80, sheetH: 256 },
  { color: 'orange',  ...SLIME_FRAME, src: '/assets/world/slimes/slime_orange.png',  sheetW: 80, sheetH: 256 },
  { color: 'yellow',  ...SLIME_FRAME, src: '/assets/world/slimes/slime_yellow.png',  sheetW: 80, sheetH: 256 },
  { color: 'green',   ...SLIME_FRAME, src: '/assets/world/slimes/slime_green.png',   sheetW: 80, sheetH: 256 },
  { color: 'blue',    ...SLIME_FRAME, src: '/assets/world/slimes/slime_blue.png',    sheetW: 80, sheetH: 256 },
  { color: 'purple',  ...SLIME_FRAME, src: '/assets/world/slimes/slime_purple.png',  sheetW: 80, sheetH: 256 },
  { color: 'pink',    ...SLIME_FRAME, src: '/assets/world/slimes/slime_pink.png',    sheetW: 80, sheetH: 256 },
  { color: 'black',   ...SLIME_FRAME, src: '/assets/world/slimes/slime_black.png',   sheetW: 80, sheetH: 256 },
  { color: 'rainbow', ...SLIME_FRAME, src: '/assets/world/slimes/slime_rainbow.png', sheetW: 80, sheetH: 256 },
]

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
   Library(구 Sound Museum) 룸 — "interior full" 팩에서 골라 잘라낸 소품.
   fireplace/candelabra는 원본이 이미 16×16 애니메이션 GIF라 시트 크롭 없이
   파일째로 복사(브라우저가 <image>에서도 GIF 애니메이션을 그대로 재생함).
   painting/armchair/rug는 알파 스캔으로 좌표를 재서 단일 PNG로 잘라 저장.
───────────────────────────────────────────── */
export const LIBRARY_DECOR = {
  fireplace:  { src: '/assets/library/fireplace.gif',  w: 16, h: 16 },
  candelabra: { src: '/assets/library/candelabra.gif', w: 16, h: 16 },
  painting:   { src: '/assets/library/painting.png',   w: 31, h: 23 },
  armchair:   { src: '/assets/library/armchair.png',   w: 19, h: 15 },
  rug:        { src: '/assets/library/rug.png',        w: 46, h: 33 },
}

/* ─────────────────────────────────────────────
   상점에서 파는 outfit(옷) 시트 — WORLD_CHARACTER.layers[1](player_clothes.png)과
   동일한 셀 좌표(원본 시트 기준 열0·행0)에서 잘라낸 다른 옷들. body/hair는 고정,
   이 clothes 레이어 한 장만 갈아끼우는 방식이라 sheetW/sheetH·프레임 격자가 완전히 동일.
───────────────────────────────────────────── */
export const OUTFIT_SHEETS = {
  overalls: { src: '/assets/world/outfits/overalls.png', sheetW: 256, sheetH: 128 },
  suit:     { src: '/assets/world/outfits/suit.png',     sheetW: 256, sheetH: 128 },
  sailor:   { src: '/assets/world/outfits/sailor.png',   sheetW: 256, sheetH: 128 },
  sporty:   { src: '/assets/world/outfits/sporty.png',   sheetW: 256, sheetH: 128 },
  witch:    { src: '/assets/world/outfits/witch.png',    sheetW: 256, sheetH: 128 },
}

/* ─────────────────────────────────────────────
   Human Zone("사람 마을") Winter 리스킨 — Cozy Town(town_buildings.png/
   terrain-town.png, 이미 위에서 TOWN_BUILDINGS_SHEET/TOWN_TILES_SHEET로 등록됨)
   + 100 Winter Things(winter.png, 신규) 조합. 1단계 인벤토리에서 확인한 대로
   Cozy Town 건물 12종은 전부 벽/지붕/문/창문이 합쳐진 통짜 스프라이트로 눈 지붕
   버전이 이미 시트 안에 있어 조립이 필요 없다 — 좌표는 전부 알파 채널 스캔(min-gap
   0 컬럼 세그멘테이션 + 개별 렌더링 육안 확인 2단계)으로 검증했다.
   ⚠ 마켓 부스(festival stand)는 시트 안에서 픽셀 단위로 붙어있어(패딩 0) 처음엔
   automatic zero-gap 세그멘테이션이 실패했다 — 격자 눈금을 오버레이해 실측한 결과
   48px 균등 그리드(12칸×48=576=시트 전체 폭)로 나뉘어 있음을 확인하고 나서야
   칸 경계가 겹치지 않는 안전한 크롭이 가능했다(URBAN_TRANSIT.busStop 때 x간격을
   96으로 잘못 재서 버스가 반쪽씩 잘렸던 전례를 이번엔 배치 전에 미리 재확인).
───────────────────────────────────────────── */
const WINTER_SHEET = { src: '/assets/world/winter.png', sheetW: 576, sheetH: 512 }

export const HUMAN_WINTER = {
  // 건물 4종 — 전부 TOWN_BUILDINGS_SHEET(town_buildings.png) 안의 눈 지붕 버전.
  // 표기된 w/h는 알파 tight bbox 실측치(원작 표기 규격과 달리 투명 여백 없음).
  buildings: {
    supam:   { ...TOWN_BUILDINGS_SHEET, x: 706, y: 945,  w: 167, h: 127 }, // SUPAM 슈퍼마켓(176×128 표기) 눈 버전
    bakery:  { ...TOWN_BUILDINGS_SHEET, x: 197, y: 292,  w: 85,  h: 92  }, // Bakery(96×96 표기) 눈 버전
    library: { ...TOWN_BUILDINGS_SHEET, x: 325, y: 651,  w: 149, h: 101 }, // Public Library(160×112 표기) 눈 버전
    hippie:  { ...TOWN_BUILDINGS_SHEET, x: 195, y: 1058, w: 95,  h: 114 }, // Hippie Home(96×80 표기) 눈 버전, 닫힌 문
    pub:     { ...TOWN_BUILDINGS_SHEET, x: 200, y: 3,    w: 82,  h: 92  }, // The Pub(96×80 표기) 눈 버전, 닫힌 문
  },
  // 마당 펜스 — LIBRARY_YARD의 베이지 피켓펜스(TOWN_TILES_SHEET, y:289)와 같은 열의
  // 서리 리컬러(x만 +288 오프셋, 같은 y). rail 8×32 낱장 반복 / post 8×47(바닥 기준).
  frostFenceRail: { ...TOWN_TILES_SHEET, x: 296, y: 289, w: 8, h: 32 },
  frostFencePost: { ...TOWN_TILES_SHEET, x: 288, y: 289, w: 8, h: 47 },
  // 서리 바닥 디테일 소품 3종(8~12px) — ANIMAL_ZONE_TILESET.detail과 같은 패턴으로
  // 단색 바닥(frostGround) 위에 흩뿌려 질감을 준다.
  frostDetail: [
    { ...TOWN_TILES_SHEET, x: 4,  y: 243, w: 8,  h: 9 },
    { ...TOWN_TILES_SHEET, x: 18, y: 243, w: 8,  h: 9 },
    { ...TOWN_TILES_SHEET, x: 34, y: 245, w: 12, h: 7 },
  ],
  // 마켓 부스 3종(winter.png, 48px 그리드 확인 완료) — 전부 정적 첫 프레임만 사용.
  standAlmonds: { ...WINTER_SHEET, x: 192, y: 80,  w: 48, h: 64 }, // Roasted Almonds Stand
  standJewelry: { ...WINTER_SHEET, x: 288, y: 80,  w: 48, h: 64 }, // Jewelry Stand
  standPretzel: { ...WINTER_SHEET, x: 160, y: 193, w: 48, h: 77 }, // Pretzel Stand
  gingerbreadHouse: { ...WINTER_SHEET, x: 305, y: 435, w: 62, h: 77 },
  snowmanSmall:     { ...WINTER_SHEET, x: 1,   y: 14,  w: 30, h: 26 },
  lampWreath:       { ...WINTER_SHEET, x: 20,  y: 40,  w: 24, h: 56 }, // Streetlight Wreath
  pineTree:         { ...WINTER_SHEET, x: 98,  y: 338, w: 38, h: 34 }, // Pine Tree(눈 덮인 침엽수)
  giftBox:          { ...WINTER_SHEET, x: 50,  y: 325, w: 18, h: 11 }, // 마당 소품용 선물상자
  iceRink:          { ...WINTER_SHEET, x: 408, y: 391, w: 152, h: 89 }, // 다음 단계용(이번 2블록엔 미사용)
}
// 서리 오솔길(packed-snow trail) — terrain-town.png 안에서 흙길(80,40,32,32)과 같은
// "블롭이 아니라 평평한 사각 스와치" 계열을 서리 톤에서 찾아 32×32 순정 크기로 확정
// (블롭 텍스처는 이어붙이면 체크무늬로 끊기는 문제가 있어 grassTexture 전례처럼
// 피함 — 이 스와치는 은은한 스캘럽 무늬라 4×4 반복해도 이음매가 안 보임, 확인 완료).
export const HUMAN_FROST_PATH = { ...TOWN_TILES_SHEET, x: 84, y: 200, w: 32, h: 32 }
// 잔디/흙길 자리를 대신할 서리 단색 배경 — ANIMAL_ZONE_TILESET.grassBase와 같은 방식
// (블롭 오토타일은 이어붙이면 체크무늬로 끊기는 문제가 있어 실제 타일 내부 픽셀에서
// 직접 샘플링한 단색을 씀). terrain-town.png 서리 블롭(x16,y205~220) 내부 4곳 샘플이
// 전부 RGB(156,189,193)로 일치 확인.
export const HUMAN_WINTER_GROUND = '#9CBDC1'

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