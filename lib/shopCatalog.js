import { OUTFIT_SHEETS } from '@/components/AssetRegistry'

/* ─────────────────────────────────────────────
   상점 상품 — 가격은 여기 한 곳에서만 관리(SHOP_PRODUCTS가 유일한
   출처). UI는 여기서 price를 읽기만 하고, 실제 차감은
   lib/currency.js의 purchaseOutfit이 이 값을 그대로 서버 왕복 없이
   신뢰해서 쓴다(현재 화폐 시스템 전체가 anon 키 신뢰 모델이라는
   점은 PROJECT_SUMMARY.md 10장에 이미 문서화됨 — 상점도 동일 선상).
───────────────────────────────────────────── */
export const SHOP_PRODUCTS = [
  { id: 'overalls', label: '멜빵바지',   emoji: '👖', price: 15, sheet: OUTFIT_SHEETS.overalls },
  { id: 'sailor',   label: '세일러 룩',  emoji: '⚓', price: 20, sheet: OUTFIT_SHEETS.sailor },
  { id: 'sporty',   label: '스포티 세트', emoji: '🏃', price: 18, sheet: OUTFIT_SHEETS.sporty },
  { id: 'suit',     label: '정장',       emoji: '🤵', price: 30, sheet: OUTFIT_SHEETS.suit },
  { id: 'witch',    label: '마녀 로브',  emoji: '🧙', price: 40, sheet: OUTFIT_SHEETS.witch },
]

const DEFAULT_OUTFIT_ID = 'basic' // 구매 안 한 기본 상태(원래 player_clothes.png 그대로)

/* ─────────────────────────────────────────────
   오늘의 특가 — 서버 날짜(YYYY-MM-DD, UTC) 문자열을 시드로 결정론적
   해시해서 그날 하루 동일한 상품 하나를 고른다. 참여자마다 다르게
   보이면 안 되므로(모두가 같은 "오늘의 특가"를 봐야 자연스러움)
   participantId는 시드에 넣지 않는다.
───────────────────────────────────────────── */
function hashString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return Math.abs(h)
}

const DAILY_DEAL_DISCOUNT = 0.4 // 40% 할인

export function getDailyDeal(date = new Date()) {
  const dateKey = date.toISOString().slice(0, 10) // YYYY-MM-DD
  const idx = hashString(dateKey) % SHOP_PRODUCTS.length
  const product = SHOP_PRODUCTS[idx]
  const discountedPrice = Math.max(1, Math.round(product.price * (1 - DAILY_DEAL_DISCOUNT)))
  return { productId: product.id, discountedPrice, dateKey }
}

export function getEffectivePrice(product, dailyDeal) {
  return dailyDeal && dailyDeal.productId === product.id ? dailyDeal.discountedPrice : product.price
}

/* ─────────────────────────────────────────────
   상점 성장 연출 — 누적 earn 총액(getTotalEarned) 기준 3단계.
   구매 가능 여부와는 무관한 순수 시각 효과.
───────────────────────────────────────────── */
export const SHOP_GROWTH_TIERS = [
  { min: 0,   key: 'seed',    label: '작은 좌판',   bg: '#2A2016', accent: '#8B6432' },
  { min: 50,  key: 'sprout',  label: '아담한 매대', bg: '#241A2E', accent: '#9B6DD4' },
  { min: 150, key: 'bloom',   label: '번화한 상점', bg: '#1A2438', accent: '#4A8FD4' },
]

export function getShopGrowthTier(totalEarned) {
  let tier = SHOP_GROWTH_TIERS[0]
  for (const t of SHOP_GROWTH_TIERS) if (totalEarned >= t.min) tier = t
  return tier
}

export { DEFAULT_OUTFIT_ID }
