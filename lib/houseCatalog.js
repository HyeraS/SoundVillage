import generatedHouseAssets from './generatedHouseAssets.json';

/* ─────────────────────────────────────────────
   집꾸미기 아이템 카탈로그 — 단일 출처(가격 등).
   id는 반드시 'house_' 접두사 고정 — outfit 등 다른 상점 카탈로그와
   id가 겹치면 currency_transactions의
   UNIQUE(participant_id, related_id, type) 제약이 서로 다른 상품인데도
   "이미 구매함"으로 착각하게 만들 수 있음(scripts/house_decor_schema.sql 참고).
   asset은 public/house-assets 아래에 준비한 Cozy Interior 픽셀 에셋 경로다.
   width/height는 원본 프레임 비율을 유지하기 위한 값이며 실제 표시 크기는 UI가 결정한다.
───────────────────────────────────────────── */
const FEATURED_HOUSE_ITEMS = [
  { id: 'house_chair_wood', name: '크림 우드 의자', price: 15, asset: '/house-assets/chair-cream.png', width: 13, height: 19 },
  { id: 'house_table_small', name: '크림 티 테이블', price: 20, asset: '/house-assets/table-cream.png', width: 30, height: 15 },
  { id: 'house_rug_round', name: '로즈 원형 러그', price: 12, asset: '/house-assets/rug-rose.png', width: 30, height: 30 },
  { id: 'house_plant_potted', name: '쌍둥이 초록 화분', price: 10, asset: '/house-assets/plant-green.png', width: 32, height: 26 },
  { id: 'house_lamp_floor', name: '크림 플로어 램프', price: 18, asset: '/house-assets/lamp-cream.png', width: 12, height: 29 },
  { id: 'house_bookshelf', name: '크림 수납장', price: 25, asset: '/house-assets/bookshelf-cream.png', width: 15, height: 30 },
  { id: 'house_sofa_cream', name: '포근한 크림 소파', price: 32, asset: '/house-assets/sofa-cream.png', width: 31, height: 18 },
  { id: 'house_tv_sun', name: '햇살 날씨 TV', price: 35, asset: '/house-assets/tv-sun.gif', width: 32, height: 32, animated: true },
  { id: 'house_fireplace_beige', name: '베이지 벽난로', price: 42, asset: '/house-assets/fireplace-beige.gif', width: 32, height: 32, animated: true },
  { id: 'house_aquarium_betta', name: '베타 어항', price: 28, asset: '/house-assets/aquarium-betta.gif', width: 16, height: 16, animated: true },
  { id: 'house_cat_sleep', name: '잠꾸러기 고양이', price: 45, asset: '/house-assets/cat-sleep.gif', width: 18, height: 18, animated: true },
  { id: 'house_candelabra_gold', name: '골드 촛대', price: 22, asset: '/house-assets/candelabra-gold.gif', width: 16, height: 16, animated: true },
];

const GENERATED_HOUSE_ITEMS = [...generatedHouseAssets.items].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));

export const HOUSE_ITEMS = [...FEATURED_HOUSE_ITEMS, ...GENERATED_HOUSE_ITEMS];
export const HOUSE_ITEM_CATEGORIES = ['전체', '벽지', '커튼', '문', '러그', '소파', '의자', '테이블', '수납', '소품', '조명', 'TV', '벽난로', '주방', '침실', '욕실', '벽선반', '계단', '키즈', '펫'];
export const GENERATED_HOUSE_ITEM_COUNT = generatedHouseAssets.count;
