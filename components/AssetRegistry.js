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
  Forest: [
    '/assets/items/forest_sound_01.png',
    '/assets/items/forest_sound_02.png',
    '/assets/items/forest_sound_03.png',
    '/assets/items/forest_sound_04.png',
    '/assets/items/forest_sound_05.png',
  ],
  Creek: [
    '/assets/items/creek_sound_01.png',
    '/assets/items/creek_sound_02.png',
    '/assets/items/creek_sound_03.png',
    '/assets/items/creek_sound_04.png',
    '/assets/items/creek_sound_05.png',
  ],
  City: [
    '/assets/items/city_sound_01.png',
    '/assets/items/city_sound_02.png',
    '/assets/items/city_sound_03.png',
    '/assets/items/city_sound_04.png',
    '/assets/items/city_sound_05.png',
  ],
  Stage: [
    '/assets/items/stage_sound_01.png',
    '/assets/items/stage_sound_02.png',
    '/assets/items/stage_sound_03.png',
    '/assets/items/stage_sound_04.png',
    '/assets/items/stage_sound_05.png',
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
}

/* ─────────────────────────────────────────────
   Zone별 타일 매핑
───────────────────────────────────────────── */
export const ZONE_GROUND_TILE = {
  Forest: TILES.grass,
  Creek:  TILES.water,
  City:   TILES.dirt,
  Stage:  TILES.purple_floor,
  Lab:    TILES.dark_floor,
}