import { LEGACY_INTERIOR_PRICES, LEGACY_INTERIOR_SETS } from '@/lib/interiorLegacyCatalog'

/* ─────────────────────────────────────────────
   집꾸미기(인테리어) 렌더 메타데이터.
   design_handoff_cozy_room/Cozy Room.dc.html의 CATALOG/SETS 배열을 그대로
   옮긴 것(README "구현 순서 제안" 1단계). id/cat/kind/layer/src/
   fw·fh(칸 점유)/nw·nh(원본 스프라이트 픽셀 크기)/limited 필드 구조를 유지한다 —
   스테이지 렌더(2단계)의 그리드 배치 수식이 이 필드들을 그대로 참조하므로
   이름을 바꾸지 않는다. 가격, 판매 승인, 세트 구성과 구매 계약은
   data/economy/catalog-v1.json의 서버 projection만을 단일 출처로 사용한다.
   asset은 public/assets/interior/ 아래 원본 픽셀 그대로(리사이즈 없음).
   lib/shopCatalog.js의 SHOP_PRODUCTS와 동일한 원칙 — 가격은 여기 한 곳에서만
   관리하고, UI는 읽기만 한다.
───────────────────────────────────────────── */

export const INTERIOR_CATEGORIES = ['벽지', '바닥재', '러그', '큰가구', '소파·의자', '소품', '벽장식', '펫'];

export const INTERIOR_CATALOG = [
  { id: 'starter_wall_neutral', name: '기본 중성 벽지', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/starter_wall_neutral.png', starter: true },
  { id: 'starter_floor_beige', name: '기본 베이지 바닥', cat: '바닥재', kind: 'floor', src: '/assets/interior/starter_floor_beige.png', starter: true },
  { id: 'wp_hearts', name: '하트 벽지', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/wp_hearts.png' },
  { id: 'wp_clover', name: '클로버 벽지', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/wp_clover.png' },
  { id: 'wp_bunny', name: '달토끼 벽지', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/wp_bunny.png' },
  { id: 'wp_stripe', name: '산뜻한 줄무늬', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/wp_stripe.png' },
  { id: 'wp_night', name: '별밤 벽지', cat: '벽지', kind: 'wallpaper', src: '/assets/interior/wp_night.png' },
  { id: 'fl_green', name: '초록 타일', cat: '바닥재', kind: 'floor', src: '/assets/interior/fl_green.png' },
  { id: 'fl_rose', name: '로즈 타일', cat: '바닥재', kind: 'floor', src: '/assets/interior/fl_rose.png' },
  { id: 'fl_brown', name: '따뜻한 갈색 타일', cat: '바닥재', kind: 'floor', src: '/assets/interior/fl_brown.png' },
  { id: 'fl_stone', name: '돌 바닥', cat: '바닥재', kind: 'floor', src: '/assets/interior/fl_stone.png' },
  { id: 'rug_persian_red', name: '붉은 자수 러그', cat: '러그', layer: 'rug', src: '/assets/interior/rug_persian_red.png', fw: 2, fh: 2 },
  { id: 'rug_persian_green', name: '모래빛 자수 러그', cat: '러그', layer: 'rug', src: '/assets/interior/rug_persian_green.png', fw: 2, fh: 2 },
  { id: 'rug_circle_teal', name: '둥근 청록 러그', cat: '러그', layer: 'rug', src: '/assets/interior/rug_circle_teal.png', fw: 2, fh: 2 },
  { id: 'bed_cream', name: '크림 침대', cat: '큰가구', layer: 'floor', src: '/assets/interior/bed_cream.png', nw: 33, nh: 33, fw: 2, fh: 2 },
  { id: 'bed_teal', name: '청록 침대', cat: '큰가구', layer: 'floor', src: '/assets/interior/bed_teal.png', nw: 33, nh: 33, fw: 2, fh: 2 },
  { id: 'dresser', name: '토끼 서랍장', cat: '큰가구', layer: 'floor', src: '/assets/interior/dresser.png', nw: 29, nh: 30, fw: 2, fh: 1 },
  { id: 'wardrobe_teal', name: '청록 옷장', cat: '큰가구', layer: 'floor', src: '/assets/interior/wardrobe_teal.png', nw: 23, nh: 29, fw: 1, fh: 1 },
  { id: 'wardrobe_purple', name: '라벤더 옷장', cat: '큰가구', layer: 'floor', src: '/assets/interior/wardrobe_purple.png', nw: 17, nh: 29, fw: 1, fh: 1 },
  { id: 'fireplace', name: '장작 난로', cat: '큰가구', layer: 'floor', src: '/assets/interior/fireplace.png', nw: 27, nh: 24, fw: 2, fh: 1 },
  { id: 'sofa_cream', name: '크림 소파', cat: '소파·의자', layer: 'floor', src: '/assets/interior/sofa_cream.png', nw: 31, nh: 20, fw: 2, fh: 1 },
  { id: 'sofa_red', name: '붉은 소파', cat: '소파·의자', layer: 'floor', src: '/assets/interior/sofa_red.png', nw: 31, nh: 20, fw: 2, fh: 1 },
  { id: 'armchair_cream', name: '폭신 1인 의자', cat: '소파·의자', layer: 'floor', src: '/assets/interior/armchair_cream.png', nw: 16, nh: 20, fw: 1, fh: 1 },
  { id: 'chair_cream', name: '긴 벤치', cat: '소파·의자', layer: 'floor', src: '/assets/interior/chair_cream.png', nw: 30, nh: 21, fw: 2, fh: 1 },
  { id: 'table_round', name: '둥근 협탁', cat: '소파·의자', layer: 'floor', src: '/assets/interior/table_round.png', nw: 23, nh: 21, fw: 1, fh: 1 },
  { id: 'stool_wood', name: '나무 요람', cat: '소파·의자', layer: 'floor', src: '/assets/interior/stool_wood.png', nw: 23, nh: 28, fw: 1, fh: 1 },
  { id: 'plant_tall', name: '키 큰 화분', cat: '소품', layer: 'floor', src: '/assets/interior/plant_tall.png', nw: 13, nh: 16, fw: 1, fh: 1 },
  { id: 'plant_bush', name: '통통 화분', cat: '소품', layer: 'floor', src: '/assets/interior/plant_bush.png', nw: 13, nh: 16, fw: 1, fh: 1 },
  { id: 'pot_cactus', name: '분홍 꽃 화분', cat: '소품', layer: 'floor', src: '/assets/interior/pot_cactus.png', nw: 15, nh: 25, fw: 1, fh: 1 },
  { id: 'books', name: '책 무더기', cat: '소품', layer: 'floor', src: '/assets/interior/books.png', nw: 23, nh: 11, fw: 1, fh: 1 },
  { id: 'fruitbowl', name: '과일 바구니', cat: '소품', layer: 'floor', src: '/assets/interior/fruitbowl.png', nw: 18, nh: 13, fw: 1, fh: 1 },
  { id: 'lamp_floor', name: '무드 스탠드', cat: '소품', layer: 'floor', src: '/assets/interior/lamp_floor.png', nw: 13, nh: 22, fw: 1, fh: 1 },
  { id: 'candle', name: '촛대', cat: '소품', layer: 'floor', src: '/assets/interior/candle.png', nw: 13, nh: 20, fw: 1, fh: 1 },
  { id: 'xmas_tree', name: '선물 나무', cat: '소품', layer: 'floor', src: '/assets/interior/xmas_tree.png', nw: 31, nh: 48, fw: 1, fh: 1, limited: true },
  { id: 'curtain_red', name: '붉은 커튼', cat: '벽장식', layer: 'wall', src: '/assets/interior/curtain_red.png', nw: 26, nh: 30, fw: 2, fh: 1 },
  { id: 'curtain_green', name: '청록 커튼', cat: '벽장식', layer: 'wall', src: '/assets/interior/curtain_green.png', nw: 26, nh: 30, fw: 2, fh: 1 },
  { id: 'curtain_blue', name: '자수정 커튼', cat: '벽장식', layer: 'wall', src: '/assets/interior/curtain_blue.png', nw: 26, nh: 30, fw: 2, fh: 1 },
  { id: 'frame_butterfly2', name: '나비 표본 액자', cat: '벽장식', layer: 'wall', src: '/assets/interior/frame_butterfly2.png', nw: 17, nh: 22, fw: 1, fh: 1 },
  { id: 'cat', name: '낮잠 고양이', cat: '펫', layer: 'floor', src: '/assets/interior/cat.png', nw: 11, nh: 11, fw: 1, fh: 1 },
  { id: 'hamster', name: '통통 햄찌', cat: '펫', layer: 'floor', src: '/assets/interior/hamster.png', nw: 14, nh: 12, fw: 1, fh: 1 },
  { id: 'deer', name: '아기 사슴', cat: '펫', layer: 'floor', src: '/assets/interior/deer.png', nw: 18, nh: 16, fw: 1, fh: 1 },
  { id: 'cactus', name: '초록 친구', cat: '펫', layer: 'floor', src: '/assets/interior/cactus.png', nw: 11, nh: 14, fw: 1, fh: 1 },
];

export const INTERIOR_ITEM_BY_ID = new Map(INTERIOR_CATALOG.map(item => [item.id, item]));
export function getInteriorItem(id) {
  return INTERIOR_ITEM_BY_ID.get(id);
}

/* 벽지/바닥재도 유료 상품이라, 진짜 참여자 데이터 연동(실제 저장/구매) 이전에
   저장된 방이 하나도 없는 신규 참여자는 room.wallpaper/floor가 null이 되어
   렌더링할 수 없다. 첫 방은 이 둘을 공짜로 쥐여준다(구매 기록 없이 owned에
   합류) — DEFAULT_ROOM 픽스처가 원래 쓰던 값과 동일해서 지금까지 봐 온
   모습 그대로 시작한다. */
export const STARTER_WALLPAPER_ID = 'starter_wall_neutral';
export const STARTER_FLOOR_ID = 'starter_floor_beige';
export const INTERIOR_STARTER_IDS = Object.freeze([STARTER_WALLPAPER_ID, STARTER_FLOOR_ID]);

/* Legacy scalar-currency compatibility. Economy V1 never imports these exports;
   its prices and grants come only from the approved server projection. Keeping
   this adapter here lets the protected Stage 3B route retain its exact bytes. */
export const INTERIOR_SETS = Object.freeze(LEGACY_INTERIOR_SETS.map((set) => Object.freeze({
  id: set.id,
  name: set.name,
  desc: set.description,
  price: set.price,
  items: Object.freeze([...set.bundleItemIds]),
  tag: set.tag,
})))

const LEGACY_INTERIOR_ITEMS = Object.freeze(
  INTERIOR_CATALOG.filter((item) => Number.isInteger(LEGACY_INTERIOR_PRICES[item.id])),
)

function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function getInteriorDailyDeal(date = new Date()) {
  const dateKey = date.toISOString().slice(0, 10)
  const product = LEGACY_INTERIOR_ITEMS[hashString(dateKey) % LEGACY_INTERIOR_ITEMS.length]
  const discountedPrice = Math.max(1, Math.round(LEGACY_INTERIOR_PRICES[product.id] * 0.6))
  return { productId: product.id, discountedPrice, dateKey }
}

export function getInteriorPrice(id, dailyDeal) {
  if (dailyDeal?.productId === id) return dailyDeal.discountedPrice
  return LEGACY_INTERIOR_PRICES[id]
}
