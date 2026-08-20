'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { getCurrencyBalance } from '@/lib/currency'
import { GENERATED_HOUSE_ITEM_COUNT, HOUSE_ITEMS, HOUSE_ITEM_CATEGORIES } from '@/lib/houseCatalog'
import {
  getOwnedHouseItems,
  getHouseLayout,
  purchaseHouseItem,
  placeHouseItem,
  applyHouseWallpaper,
  removeHouseItem,
} from '@/lib/houseDecor'

const GRID_COLS = 6
const GRID_ROWS = 5
const INVITE_READY_COUNT = 4
const SHOP_PAGE_SIZE = 48
const HOUSE_ITEM_BY_ID = new Map(HOUSE_ITEMS.map(item => [item.id, item]))
const PREVIEW_PLACEMENT = {
  '커튼': { left: 27, top: 26, size: 'h-[clamp(70px,12vw,120px)] w-[clamp(70px,12vw,120px)]' },
  '문': { left: 72, top: 31, size: 'h-[clamp(76px,13vw,132px)] w-[clamp(76px,13vw,132px)]' },
  '벽선반': { left: 64, top: 35, size: 'h-[clamp(58px,10vw,100px)] w-[clamp(58px,10vw,100px)]' },
  'TV': { left: 64, top: 39, size: 'h-[clamp(62px,11vw,108px)] w-[clamp(62px,11vw,108px)]' },
  '벽난로': { left: 66, top: 46, size: 'h-[clamp(72px,12vw,124px)] w-[clamp(72px,12vw,124px)]' },
  '러그': { left: 50, top: 74, size: 'h-[clamp(100px,18vw,178px)] w-[clamp(100px,18vw,178px)]' },
  '계단': { left: 67, top: 58, size: 'h-[clamp(82px,14vw,140px)] w-[clamp(82px,14vw,140px)]' },
}

const REASON_MESSAGES = {
  insufficient_funds: '코인이 조금 부족해요. 도서관에서 평가하고 다시 만나요!',
  not_owned: '배치할 수 있는 아이템이 없어요.',
  tile_occupied: '이미 다른 가구가 놓인 자리예요.',
  unknown_item: '알 수 없는 아이템이에요.',
  charge_error: '결제 처리 중 문제가 생겼어요. 보유 아이템을 확인해 주세요.',
  error: '잠시 문제가 생겼어요. 다시 시도해 주세요.',
}

const ITEM_META = {
  house_chair_wood: { category: '가구', description: '책을 읽거나 친구와 쉬기 좋은 크림색 의자', card: 'from-[#F6D6A7] to-[#E9BC83]' },
  house_table_small: { category: '가구', description: '따뜻한 차와 이야기를 올려두는 낮은 테이블', card: 'from-[#FFD7C8] to-[#F2A98F]' },
  house_rug_round: { category: '러그', description: '방 한가운데 포근한 휴식 구역을 만들어요', card: 'from-[#D6C3F1] to-[#B79EDC]' },
  house_plant_potted: { category: '소품', description: '나란히 놓인 두 화분이 방에 싱그러운 기분을 더해요', card: 'from-[#C9E8D6] to-[#91CDB2]' },
  house_lamp_floor: { category: '조명', description: '저녁에도 집을 포근하게 밝혀주는 크림 조명', card: 'from-[#FFE9A9] to-[#F8C866]' },
  house_bookshelf: { category: '수납', description: '도서관에서 만난 이야기와 소품을 모아두는 수납장', card: 'from-[#BCDCEF] to-[#86B7D2]' },
  house_sofa_cream: { category: '가구', description: '친구와 나란히 앉아 수다 떨기 좋은 넓은 소파', card: 'from-[#F0D7B8] to-[#CDA77E]' },
  house_tv_sun: { category: '가전', description: '맑은 날씨가 움직이는 아기자기한 픽셀 TV', card: 'from-[#B9D9E7] to-[#7FB4CB]' },
  house_fireplace_beige: { category: '가구', description: '살랑이는 불빛으로 거실의 온도를 높여주는 벽난로', card: 'from-[#E8C7A7] to-[#BF8565]' },
  house_aquarium_betta: { category: '펫', description: '작은 베타가 천천히 헤엄치는 테이블 어항', card: 'from-[#BDE4E1] to-[#77BDB7]' },
  house_cat_sleep: { category: '펫', description: '햇살 좋은 자리를 찾아 잠드는 마을 고양이', card: 'from-[#E9D3C3] to-[#C59679]' },
  house_candelabra_gold: { category: '조명', description: '저녁 모임을 은은하게 밝혀주는 골드 촛대', card: 'from-[#F9E4A5] to-[#DDB661]' },
}

const CATEGORY_CARD = {
  '벽지': 'from-[#E9D8C2] to-[#C9AD91]', '커튼': 'from-[#E8CBC8] to-[#C89FA1]', '문': 'from-[#D8B18A] to-[#A97958]',
  '벽난로': 'from-[#E5B595] to-[#B8785D]', '러그': 'from-[#D7C5E6] to-[#A991C1]', '계단': 'from-[#D5B48B] to-[#A27B52]',
  '욕실': 'from-[#CBE0E3] to-[#8EB8C1]', '침실': 'from-[#E4C9D7] to-[#BC94AA]', '수납': 'from-[#D8C1A6] to-[#AA8564]',
  '의자': 'from-[#F0D2A4] to-[#C79A67]', '소파': 'from-[#E4C7B9] to-[#B58E7B]', '테이블': 'from-[#E7C5A0] to-[#BB8C61]',
  '소품': 'from-[#CDE4D5] to-[#91BFA1]', '키즈': 'from-[#F4D0C0] to-[#DEA88F]', '주방': 'from-[#C8D7D5] to-[#8FAAA7]',
  '벽선반': 'from-[#D8C2A9] to-[#A98668]', '펫': 'from-[#D7E3C7] to-[#9DB780]', 'TV': 'from-[#BFD7E5] to-[#83ABC2]', '조명': 'from-[#F7E1A4] to-[#D6B158]',
}

function getItemMeta(item) {
  return ITEM_META[item.id] ?? {
    category: item.category ?? '소품',
    description: item.description ?? 'Cozy Interior 원본에서 추출한 픽셀 인테리어 아이템이에요.',
    card: CATEGORY_CARD[item.category] ?? 'from-[#E8D9C7] to-[#BFA78C]',
  }
}

const PANEL_COPY = {
  shop: { eyebrow: 'VILLAGE SHOP', title: '오늘은 뭘 들여놓을까요?', description: '모은 코인으로 우리 집에 어울리는 물건을 골라보세요.' },
  inventory: { eyebrow: 'MY ITEMS', title: '내 아이템', description: '아이템을 고른 다음 방 안의 빈 자리를 눌러주세요.' },
  friends: { eyebrow: 'NEIGHBORS', title: '친구 초대', description: '집을 공유하면 친구가 읽기 전용으로 구경할 수 있어요.' },
}

async function loadHouseData(participantId) {
  const [balance, owned, layout] = await Promise.all([
    getCurrencyBalance(participantId),
    getOwnedHouseItems(participantId),
    getHouseLayout(participantId),
  ])
  return { balance, owned, layout }
}

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    coin: <><circle cx="12" cy="12" r="8"/><path d="M9.5 10.2c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.7-1 1.4-2.5 1.8-2.5.8-2.5 1.9 1 1.8 2.5 1.8 2.5-.8 2.5-1.8M12 7v10"/></>,
    shop: <><path d="M4 10v9h16v-9"/><path d="M3 10l2-5h14l2 5M8 19v-5h4v5"/><path d="M3 10c0 1.2 1 2 2.2 2s2.1-.8 2.1-2c0 1.2 1 2 2.3 2s2.2-.8 2.2-2c0 1.2 1 2 2.3 2s2.2-.8 2.2-2c0 1.2 1 2 2.3 2s2.2-.8 2.2-2"/></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    invite: <><path d="M15 8a3 3 0 1 0-3-3"/><path d="M2 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v9l-9 5-9-5V8Z"/><path d="M12 13v9"/></>,
    arrow: <><path d="m15 18-6-6 6-6"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}

function CoinPill({ balance, visitorMode = false }) {
  return (
    <div className="relative flex h-11 items-center gap-2 border-2 border-[#6F4B32] bg-[#F8D885] px-4 text-[var(--house-cocoa)] shadow-[0_5px_0_#A86F3C,0_10px_22px_rgba(58,42,30,.14)] [clip-path:polygon(8px_0,calc(100%_-_8px)_0,100%_8px,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,8px_100%,0_calc(100%_-_8px),0_8px)]">
      <span className="grid h-6 w-6 place-items-center rounded-full border border-[#9B6B29] bg-[#FFEAA9] text-[#76551E]"><Icon name={visitorMode ? 'users' : 'coin'} className="h-3.5 w-3.5" /></span>
      <span className="text-sm font-black tabular-nums">{visitorMode ? '방문 중' : balance}</span>
    </div>
  )
}

function FurnitureArt({ id, className = 'h-full w-full' }) {
  const item = HOUSE_ITEM_BY_ID.get(id)
  if (item?.category === '벽지' && item.wallpaperTrimAsset) {
    return (
      <span className={`relative block overflow-hidden ${className}`} style={{ backgroundImage: `url("${item.asset}?v=20260820-5")`, backgroundRepeat: 'repeat', backgroundSize: '16px 16px', imageRendering: 'pixelated' }}>
        <span className="absolute inset-x-0 bottom-0 h-1/3" style={{ backgroundImage: `url("${item.wallpaperTrimAsset}?v=20260820-5")`, backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom', backgroundSize: '16px 16px', imageRendering: 'pixelated' }} />
      </span>
    )
  }
  if (item?.asset) {
    return <Image src={`${item.asset}?v=20260820-2`} alt="" width={item.width} height={item.height} unoptimized className={`${className} object-contain [image-rendering:pixelated]`} />
  }
  const common = { fill: 'none', stroke: '#553928', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const artwork = {
    house_chair_wood: <><path {...common} fill="#C98A57" d="M28 23h30v25H28z"/><path {...common} fill="#E7B67C" d="M24 48h39v13H24z"/><path {...common} d="M29 61v22M58 61v22M30 35h27"/></>,
    house_table_small: <><ellipse {...common} fill="#D89B68" cx="44" cy="42" rx="31" ry="14"/><path {...common} fill="#BB7649" d="M20 42v10c0 8 48 8 48 0V42"/><path {...common} d="M28 57v26M60 57v26"/><path {...common} fill="#F6E3B8" d="M36 31h16l-2 9H38z"/></>,
    house_rug_round: <><ellipse {...common} fill="#BDA6D3" cx="44" cy="53" rx="34" ry="23"/><ellipse {...common} stroke="#F3D7CA" strokeWidth="5" cx="44" cy="53" rx="25" ry="15"/><path {...common} stroke="#806B9D" d="M16 47c13 8 43 8 56 0"/></>,
    house_plant_potted: <><path {...common} fill="#C77B55" d="M30 58h29l-4 25H35z"/><path {...common} d="M44 59V26"/><path {...common} fill="#79A96E" d="M44 39c-19-2-20-20-18-24 14-1 22 9 18 24Z"/><path {...common} fill="#98C681" d="M45 49c18-3 21-18 18-24-14 0-21 10-18 24Z"/><path {...common} fill="#5F9362" d="M43 30c2-14 11-20 18-18 2 10-4 19-18 18Z"/></>,
    house_lamp_floor: <><path {...common} fill="#F7D979" d="M24 34 32 13h25l8 21z"/><path {...common} fill="#FFF2B8" d="M31 34h27l-3 8H34z"/><path {...common} d="M44 42v35M32 82h24"/><circle fill="#FFD56B" opacity=".45" cx="44" cy="34" r="28"/></>,
    house_bookshelf: <><rect {...common} fill="#A96843" x="17" y="12" width="54" height="72" rx="2"/><path {...common} d="M17 36h54M17 60h54"/><path {...common} fill="#E9C76E" d="M24 19h7v15h-7z"/><path {...common} fill="#7EAC9B" d="M32 17h9v17h-9z"/><path {...common} fill="#D77D69" d="M45 21h8v13h-8z"/><path {...common} fill="#86A7C0" d="M25 42h10v16H25z"/><path {...common} fill="#E7B47B" d="M39 40h8v18h-8z"/><path {...common} fill="#8B6E9F" d="M51 44h12v14H51z"/><path {...common} fill="#E2C56F" d="M25 66h13v16H25z"/><path {...common} fill="#719A73" d="M42 65h8v17h-8z"/><path {...common} fill="#D9896A" d="M53 68h10v14H53z"/></>,
  }
  return <svg viewBox="0 0 88 96" className={className} aria-hidden="true">{artwork[id]}</svg>
}

function MascotArt({ className = 'h-full w-full' }) {
  return (
    <svg viewBox="0 0 100 110" className={className} aria-hidden="true">
      <ellipse cx="50" cy="99" rx="32" ry="8" fill="#543725" opacity=".14" />
      <path d="M25 72c0-26 11-45 25-45s25 19 25 45c0 20-12 31-25 31S25 92 25 72Z" fill="#FFF2C8" stroke="#553928" strokeWidth="4" />
      <path d="M31 42c-6-15 2-29 16-28-1 8 2 13 8 16" fill="#F7C95F" stroke="#553928" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 69c-9 2-13 9-12 17 9 1 15-3 17-10M74 69c9 2 13 9 12 17-9 1-15-3-17-10" fill="#F7C95F" stroke="#553928" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="40" cy="62" r="3" fill="#553928" /><circle cx="60" cy="62" r="3" fill="#553928" />
      <path d="m45 69 5-4 5 4-5 4Z" fill="#EA8B50" stroke="#553928" strokeWidth="2" />
      <circle cx="33" cy="69" r="5" fill="#F2A99A" opacity=".55" /><circle cx="67" cy="69" r="5" fill="#F2A99A" opacity=".55" />
    </svg>
  )
}

function HouseMark({ className = 'h-full w-full' }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      <ellipse cx="60" cy="99" rx="44" ry="7" fill="#553928" opacity=".14" />
      <path d="m16 53 44-38 44 38v41H16Z" fill="#FFF4D7" stroke="#553928" strokeWidth="5" strokeLinejoin="round" />
      <path d="m11 55 49-43 49 43" fill="none" stroke="#CD7659" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 94V61h21v33" fill="#C98A57" stroke="#553928" strokeWidth="4" />
      <path d="M27 57h27v23H27z" fill="#BDE0DC" stroke="#553928" strokeWidth="4" />
      <path d="M40.5 57v23M27 68.5h27" stroke="#FFF9ED" strokeWidth="3" />
      <circle cx="78" cy="77" r="2.5" fill="#F8D885" />
      <path d="M91 26v-9h11v19" fill="#A96843" stroke="#553928" strokeWidth="4" strokeLinejoin="round" />
      <path d="M23 91c-9-2-12-11-8-18 8 0 13 6 12 14M104 91c8-2 11-9 8-16-7 0-12 5-12 13" fill="#79A96E" stroke="#553928" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

function NeighborArt({ kind = 'frog', className = 'h-full w-full' }) {
  const frog = kind === 'frog'
  return (
    <svg viewBox="0 0 70 70" className={className} aria-hidden="true">
      {frog ? <><circle cx="22" cy="20" r="10" fill="#8DB995" stroke="#553928" strokeWidth="3" /><circle cx="48" cy="20" r="10" fill="#8DB995" stroke="#553928" strokeWidth="3" /><circle cx="35" cy="38" r="24" fill="#A9D1AF" stroke="#553928" strokeWidth="3" /><circle cx="22" cy="19" r="3" fill="#553928" /><circle cx="48" cy="19" r="3" fill="#553928" /><path d="M27 43c5 5 11 5 16 0" fill="none" stroke="#553928" strokeWidth="3" strokeLinecap="round" /></> : <><path d="M20 30 18 6c10 0 16 9 17 20M50 30 52 6c-10 0-16 9-17 20" fill="#C8B6D8" stroke="#553928" strokeWidth="3" strokeLinejoin="round" /><circle cx="35" cy="39" r="24" fill="#D9CAE5" stroke="#553928" strokeWidth="3" /><circle cx="27" cy="37" r="3" fill="#553928" /><circle cx="43" cy="37" r="3" fill="#553928" /><path d="m31 45 4 3 4-3" fill="none" stroke="#553928" strokeWidth="3" strokeLinecap="round" /></>}
    </svg>
  )
}

function ItemArtwork({ item, size = 'large' }) {
  const meta = getItemMeta(item)
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-[#553928]/10 bg-gradient-to-br ${meta.card} ${size === 'large' ? 'h-28 w-full rounded-[12px_18px_10px_16px]' : 'h-14 w-14 rounded-[10px_14px_9px_13px]'}`}>
      <FurnitureArt id={item.id} className={`relative z-10 drop-shadow-[0_7px_4px_rgba(58,42,30,.17)] ${size === 'large' ? 'h-24 w-24' : 'h-12 w-12'}`} />
      <span className="absolute -bottom-4 h-8 w-20 rounded-[50%] bg-white/22 blur-sm" />
      <span className="absolute right-2 top-1.5 text-[10px] text-white/80">✦</span>
    </div>
  )
}

function ShopCard({ item, ownedQuantity, pending, selected, onSelect }) {
  const meta = getItemMeta(item)
  return (
    <button type="button" onClick={() => onSelect(item)} disabled={pending} aria-pressed={selected} className={`group min-w-0 border bg-[#FFFCF5] p-2.5 text-left transition duration-200 [clip-path:polygon(0_0,calc(100%_-_10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%_-_10px))] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-mint)] disabled:opacity-60 ${selected ? 'border-[#5D9A7C] shadow-[0_5px_0_#82B59C,0_0_0_3px_rgba(145,205,178,.28)]' : 'border-[#76533A]/14 shadow-[0_4px_0_#E2CDB5,0_10px_22px_rgba(58,42,30,.07)] hover:shadow-[0_6px_0_#D6B99B,0_15px_28px_rgba(58,42,30,.11)]'}`}>
      <ItemArtwork item={item} />
      <div className="px-1 pb-1 pt-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-extrabold text-[var(--house-cocoa)]">{item.name}</span>
          {ownedQuantity > 0 && <span className="shrink-0 rounded-full bg-[#E5F4EC] px-2 py-0.5 text-[10px] font-extrabold text-[#4E806A]">보유 {ownedQuantity}</span>}
        </div>
        <p className="mb-3 line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-[#7D6B5D]">{meta.description}</p>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[var(--house-cream)] px-2 py-1 text-[10px] font-bold text-[#8A735E]">{meta.category}</span>
          <span className={`flex items-center gap-1 font-extrabold ${selected ? 'text-[11px] text-[#4F856B]' : 'text-sm text-[var(--house-cocoa)]'}`}>{selected ? '집에서 보는 중' : <><Icon name="coin" className="h-4 w-4 text-[#D79C25]" />{item.price}</>}</span>
        </div>
      </div>
    </button>
  )
}

function FamilyCard({ family, onSelect }) {
  const representative = family.items[0]
  const meta = getItemMeta(representative)
  return (
    <button type="button" onClick={() => onSelect(family.id)} className="group min-w-0 border border-[#76533A]/14 bg-[#FFFCF5] p-2.5 text-left shadow-[0_4px_0_#E2CDB5,0_10px_22px_rgba(58,42,30,.07)] transition hover:-translate-y-1 [clip-path:polygon(0_0,calc(100%_-_10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%_-_10px))]">
      <ItemArtwork item={representative} />
      <div className="px-1 pb-1 pt-3">
        <p className="truncate text-[15px] font-extrabold text-[var(--house-cocoa)]">{family.name}</p>
        <p className="mt-1 text-[11px] font-semibold text-[#7D6B5D]">{meta.category} · {family.items.length.toLocaleString('ko-KR')}가지 변형</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex -space-x-1.5">
            {family.items.slice(0, 4).map(item => <span key={item.id} className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 border-[#FFFCF5] bg-[#F2E6D4] p-1"><FurnitureArt id={item.id} /></span>)}
          </div>
          <span className="text-[10px] font-black text-[#98684A]">골라보기 →</span>
        </div>
      </div>
    </button>
  )
}

function InventoryCard({ item, available, selected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(item.id)} className={`flex w-full items-center gap-3 rounded-[18px] border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-mint)] ${selected ? 'border-[var(--house-mint)] bg-[#EAF6F0] shadow-[0_8px_18px_rgba(86,143,116,0.14)]' : 'border-[#3A2A1E]/8 bg-[var(--house-surface)] hover:border-[#3A2A1E]/15'}`}>
      <ItemArtwork item={item} size="small" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[var(--house-cocoa)]">{item.name}</span><span className="mt-0.5 block text-[11px] font-bold text-[#8A735E]">배치 가능 {available}개</span></span>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? 'bg-[var(--house-mint)] text-white' : 'bg-[var(--house-cream)] text-[#9C8875]'}`}>{selected ? <Icon name="check" className="h-4 w-4" /> : <span className="text-xs font-extrabold">{available}</span>}</span>
    </button>
  )
}

function HouseRoom({ layout, selectedItemId, selectedPlacedId, previewItem, visitorMode, onCellClick }) {
  const itemById = useCallback(id => HOUSE_ITEM_BY_ID.get(id), [])
  const furnitureLayout = useMemo(() => layout.filter(row => row.gridX >= 0 && row.gridY >= 0), [layout])
  const wallpaper = useMemo(() => {
    const row = layout.find(item => item.gridX === -1 && item.gridY === -1)
    return row ? itemById(row.itemId) : null
  }, [itemById, layout])
  const effectiveWallpaper = previewItem?.category === '벽지' ? previewItem : wallpaper
  const furniturePreview = previewItem?.category !== '벽지' ? previewItem : null
  const previewPlacement = furniturePreview ? (PREVIEW_PLACEMENT[furniturePreview.category] ?? { left: 57, top: 61, size: 'h-[clamp(72px,12vw,124px)] w-[clamp(72px,12vw,124px)]' }) : null
  const placedAt = useCallback((x, y) => furnitureLayout.find(row => row.gridX === x && row.gridY === y) ?? null, [furnitureLayout])
  const editing = Boolean(selectedItemId) && !visitorMode

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-[760px] overflow-hidden border-[7px] border-[#FFF9ED] bg-[#F7D8C7] shadow-[0_10px_0_#B77B55,0_26px_55px_rgba(83,57,38,.22)] [clip-path:polygon(18px_0,calc(100%_-_28px)_0,100%_22px,100%_calc(100%_-_16px),calc(100%_-_18px)_100%,22px_100%,0_calc(100%_-_24px),0_18px)]">
      <div className="absolute inset-x-0 top-0 h-[53%] bg-[linear-gradient(90deg,rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(#F8DDCB,#EFC3AA)] bg-[size:42px_42px] transition-[background-image] duration-200" style={effectiveWallpaper ? { backgroundImage: `url("${effectiveWallpaper.asset}?v=20260820-4"), linear-gradient(#F8DDCB,#EFC3AA)`, backgroundRepeat: 'repeat, no-repeat', backgroundSize: '32px 32px, cover', imageRendering: 'pixelated' } : undefined} />
      {effectiveWallpaper?.wallpaperTrimAsset && <div className="absolute inset-x-0 top-[calc(53%_-_32px)] h-8" style={{ backgroundImage: `url("${effectiveWallpaper.wallpaperTrimAsset}?v=20260820-5")`, backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom', backgroundSize: '32px 32px', imageRendering: 'pixelated' }} data-wallpaper-bottom-trim={effectiveWallpaper.id} />}
      <div className="absolute inset-x-[11%] top-[48%] z-[2] h-[3%] bg-[#A96747] shadow-[0_3px_0_#79452F]" />
      <div className="absolute left-0 top-0 h-[57%] w-[15%] bg-[#E7BCA7] [clip-path:polygon(0_0,100%_11%,100%_100%,0_84%)]" />
      <div className="absolute right-0 top-0 h-[57%] w-[15%] bg-[#F8E4D7] [clip-path:polygon(0_11%,100%_0,100%_84%,0_100%)]" />
      <div className="absolute left-[18%] top-[8%] h-[30%] w-[18%] rounded-t-[48%] border-[6px] border-[#E7A98E] bg-[#BFE0E6] shadow-[inset_0_0_0_5px_rgba(255,255,255,.5)]">
        <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-white/60" /><div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-white/60" />
      </div>
      <div className="absolute right-[18%] top-[13%] flex h-[19%] w-[15%] items-center justify-center border-[5px] border-[#A96D4E] bg-[#FFF8E9] shadow-[4px_5px_0_rgba(102,67,48,.14)] [clip-path:polygon(5px_0,100%_0,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,0_100%,0_5px)]">
        <svg viewBox="0 0 60 60" className="h-[70%] w-[70%]" aria-hidden="true"><path d="M30 49V17M30 33C15 31 13 20 14 15c11-1 18 5 16 18ZM31 40c13-2 17-11 15-18-10 0-17 7-15 18Z" fill="#8EB17B" stroke="#553928" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[57%] bg-[linear-gradient(135deg,#D7A56D_25%,#C98F58_25%,#C98F58_50%,#D7A56D_50%,#D7A56D_75%,#C98F58_75%)] bg-[size:34px_34px] [clip-path:polygon(14%_0,86%_0,100%_100%,0_100%)]" />
      <div className="absolute bottom-[7%] left-1/2 h-[28%] w-[42%] -translate-x-1/2 rounded-[50%] border-2 border-[#FFF4D5]/35 bg-[#E9D8B6]/45 shadow-[inset_0_0_0_3px_rgba(104,71,45,.08)]" />

      {Array.from({ length: GRID_ROWS }).flatMap((_, y) =>
        Array.from({ length: GRID_COLS }).map((__, x) => {
          const cell = placedAt(x, y)
          const item = cell ? itemById(cell.itemId) : null
          const left = 43 + (x - y) * 6.55
          const top = 41 + (x + y) * 5.2
          const isSelectedPlaced = cell?.layoutId === selectedPlacedId
          return (
            <button type="button" key={`${x}-${y}`} onClick={() => onCellClick(x, y)} disabled={visitorMode || (!editing && !item)} aria-label={item ? `${item.name}, ${x + 1}열 ${y + 1}행` : `${x + 1}열 ${y + 1}행 빈 자리`} className={`absolute h-[10.5%] w-[13.8%] -translate-x-1/2 -translate-y-1/2 [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] transition duration-150 focus-visible:z-30 focus-visible:outline-2 ${editing ? item ? 'bg-[#FF9F86]/28 hover:bg-[#FF9F86]/45' : 'bg-[#DDF2E8]/55 hover:bg-[#91CDB2]/80' : isSelectedPlaced ? 'bg-[#91CDB2]/50' : 'bg-transparent'} ${visitorMode ? 'cursor-default' : ''}`} style={{ left: `${left}%`, top: `${top}%`, zIndex: 10 + x + y }}>
              {editing && !item && <span className="text-[clamp(9px,1.6vw,16px)] font-black text-[#4F8A70]">+</span>}
            </button>
          )
        })
      )}

      {furnitureLayout.map(row => {
        const item = itemById(row.itemId)
        if (!item) return null
        const left = 43 + (row.gridX - row.gridY) * 6.55
        const top = 38 + (row.gridX + row.gridY) * 5.2
        const selected = row.layoutId === selectedPlacedId
        return (
          <div key={row.layoutId} className={`pointer-events-none absolute h-[clamp(42px,8vw,84px)] w-[clamp(42px,8vw,84px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_9px_4px_rgba(68,43,29,.22)] transition ${selected ? 'scale-110 drop-shadow-[0_0_10px_rgba(145,205,178,.9)]' : ''}`} style={{ left: `${left}%`, top: `${top}%`, zIndex: 30 + row.gridX + row.gridY, transform: `translate(-50%, -50%) rotate(${row.rotation ?? 0}deg)` }}><FurnitureArt id={item.id} /></div>
        )
      })}

      {furniturePreview && previewPlacement && (
        <div className={`pointer-events-none absolute z-[38] -translate-x-1/2 -translate-y-1/2 ${previewPlacement.size}`} style={{ left: `${previewPlacement.left}%`, top: `${previewPlacement.top}%` }} data-preview-item={furniturePreview.id}>
          <span className="absolute inset-[-12%] animate-pulse rounded-[40%] border-2 border-dashed border-[#FFF4C8] bg-[#91CDB2]/20 shadow-[0_0_28px_rgba(255,244,200,.72)]" />
          <FurnitureArt id={furniturePreview.id} className="relative z-10 h-full w-full drop-shadow-[0_10px_5px_rgba(68,43,29,.28)]" />
          <span className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#47755F]/20 bg-[#E5F4EC] px-2.5 py-1 text-[9px] font-black text-[#47755F] shadow-sm">구매 전 미리보기</span>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-[53%] z-20 h-[clamp(56px,10vw,104px)] w-[clamp(50px,9vw,94px)] -translate-x-1/2 -translate-y-1/2"><div className="h-full w-full animate-[floatSmall_2.8s_ease-in-out_infinite]"><MascotArt /></div></div>
      <div className="absolute left-4 top-4 z-40 flex items-center gap-2 border border-[#74523A]/15 bg-[#FFF9E8]/92 px-3 py-2 text-[11px] font-extrabold text-[#6D5746] shadow-[3px_3px_0_rgba(102,67,48,.12)] [clip-path:polygon(0_0,calc(100%_-_8px)_0,100%_8px,100%_100%,8px_100%,0_calc(100%_-_8px))]"><span className={`h-2 w-2 rounded-full ${previewItem || editing ? 'animate-pulse bg-[var(--house-mint)]' : 'bg-[#F4B85C]'}`} />{visitorMode ? '친구의 집을 구경하는 중' : previewItem ? `${previewItem.name} · 구매 전 미리보기` : editing ? (itemById(selectedItemId)?.category === '벽지' ? '방 안을 눌러 새 벽지를 적용하세요' : '빈 자리를 눌러 배치하세요') : furnitureLayout.length === 0 ? '아직 빈 집이에요 · 상점에서 첫 가구를 골라보세요' : '햇살이 딱 좋은 오후야!'}</div>
    </div>
  )
}

export default function HouseDecorTestPage() {
  const [participantIdInput, setParticipantIdInput] = useState('AUDIOTEST')
  const [participantId, setParticipantId] = useState('')
  const [balance, setBalance] = useState(0)
  const [owned, setOwned] = useState([])
  const [layout, setLayout] = useState([])
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [selectedPlaced, setSelectedPlaced] = useState(null)
  const [activePanel, setActivePanel] = useState('shop')
  const [purchaseTarget, setPurchaseTarget] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [roomBusy, setRoomBusy] = useState(false)
  const [pendingPurchaseIds, setPendingPurchaseIds] = useState(new Set())
  const [shopCategory, setShopCategory] = useState('전체')
  const [shopSubcategory, setShopSubcategory] = useState('전체')
  const [shopSearch, setShopSearch] = useState('')
  const [shopLimit, setShopLimit] = useState(SHOP_PAGE_SIZE)
  const [shopFamilyId, setShopFamilyId] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [visitorMode, setVisitorMode] = useState(false)

  const refreshAll = useCallback(async pid => {
    const data = await loadHouseData(pid)
    setBalance(data.balance)
    setOwned(data.owned)
    setLayout(data.layout)
  }, [])

  useEffect(() => {
    const invitedHouse = new URLSearchParams(window.location.search).get('house')?.trim()
    if (!invitedHouse) return
    let cancelled = false
    async function openInvitedHouse() {
      const data = await loadHouseData(invitedHouse)
      if (cancelled) return
      setBalance(data.balance)
      setOwned(data.owned)
      setLayout(data.layout)
      setVisitorMode(true)
      setParticipantId(invitedHouse)
    }
    openInvitedHouse()
    return () => { cancelled = true }
  }, [])

  const placedCountByItem = useMemo(() => layout.reduce((acc, row) => {
    acc[row.itemId] = (acc[row.itemId] ?? 0) + 1
    return acc
  }, {}), [layout])
  const inventory = useMemo(() => owned.map(row => ({ itemId: row.itemId, available: row.quantity - (placedCountByItem[row.itemId] ?? 0) })).filter(row => row.available > 0), [owned, placedCountByItem])
  const ownedQuantity = useCallback(id => owned.find(row => row.itemId === id)?.quantity ?? 0, [owned])
  const itemById = useCallback(id => HOUSE_ITEM_BY_ID.get(id), [])
  const shopSubcategories = useMemo(() => {
    if (shopCategory === '전체') return []
    return [...new Set(HOUSE_ITEMS.filter(item => item.category === shopCategory && item.subcategory).map(item => item.subcategory))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
  }, [shopCategory])
  const filteredShopItems = useMemo(() => {
    const query = shopSearch.trim().toLocaleLowerCase('ko')
    return HOUSE_ITEMS.filter(item => {
      if (shopCategory !== '전체' && item.category !== shopCategory) return false
      if (shopSubcategory !== '전체' && item.subcategory !== shopSubcategory) return false
      if (!query) return true
      return `${item.name} ${item.category ?? ''} ${item.description ?? ''}`.toLocaleLowerCase('ko').includes(query)
    })
  }, [shopCategory, shopSearch, shopSubcategory])
  const shopFamilies = useMemo(() => {
    const groups = new Map()
    for (const item of filteredShopItems) {
      const familyId = item.familyId ?? `featured_${item.id}`
      if (!groups.has(familyId)) groups.set(familyId, { id: familyId, name: item.familyName ?? item.name, items: [] })
      groups.get(familyId).items.push(item)
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))
  }, [filteredShopItems])
  const selectedShopFamily = useMemo(() => shopFamilies.find(family => family.id === shopFamilyId) ?? null, [shopFamilies, shopFamilyId])
  const visibleShopFamilies = useMemo(() => shopFamilies.slice(0, shopLimit), [shopFamilies, shopLimit])
  const visibleShopVariants = useMemo(() => selectedShopFamily?.items.slice(0, shopLimit) ?? [], [selectedShopFamily, shopLimit])
  const placedFurnitureCount = useMemo(() => layout.filter(row => row.gridX >= 0 && row.gridY >= 0).length, [layout])
  const progress = Math.min(100, Math.round((placedFurnitureCount / INVITE_READY_COUNT) * 100))
  const inviteReady = placedFurnitureCount >= INVITE_READY_COUNT
  const panelCopy = PANEL_COPY[activePanel]

  const handleEnter = async event => {
    event?.preventDefault()
    const pid = participantIdInput.trim()
    if (!pid) return
    setLoading(true)
    setMessage('')
    try {
      await refreshAll(pid)
      setParticipantId(pid)
    } catch (error) {
      console.error('[houseDecor] 입장 오류:', error)
      setMessage('집 문이 잠시 열리지 않아요. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleBuy = async item => {
    if (pendingPurchaseIds.has(item.id)) return
    setMessage('')
    setPendingPurchaseIds(prev => new Set(prev).add(item.id))
    try {
      const result = await purchaseHouseItem({ participantId, itemId: item.id })
      if (!result.ok) {
        setMessage(REASON_MESSAGES[result.reason] ?? result.reason)
        return
      }
      await refreshAll(participantId)
      setPurchaseTarget(null)
      setSelectedItemId(item.id)
      setActivePanel('inventory')
      setMessage(`${item.name}이(가) 내 아이템에 들어왔어요! 빈 자리를 눌러 바로 배치해 보세요.`)
    } finally {
      setPendingPurchaseIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleCellClick = async (x, y) => {
    if (visitorMode || roomBusy) return
    setMessage('')
    const existing = layout.find(row => row.gridX === x && row.gridY === y)
    if (existing) {
      if (selectedItemId) {
        setMessage('그 자리에는 이미 가구가 있어요. 다른 빈 자리를 골라주세요.')
        return
      }
      setSelectedPlaced(existing)
      return
    }
    if (!selectedItemId) return
    setRoomBusy(true)
    try {
      const selectedItem = itemById(selectedItemId)
      if (selectedItem?.category === '벽지') {
        const result = await applyHouseWallpaper({ participantId, itemId: selectedItemId })
        if (!result.ok) {
          setMessage(REASON_MESSAGES[result.reason] ?? result.reason)
          return
        }
        await refreshAll(participantId)
        setSelectedItemId(null)
        setMessage(`${selectedItem.name}을(를) 벽 전체에 적용했어요!`)
        return
      }
      const result = await placeHouseItem({ participantId, itemId: selectedItemId, gridX: x, gridY: y })
      if (!result.ok) {
        setMessage(REASON_MESSAGES[result.reason] ?? result.reason)
        return
      }
      const placedItem = itemById(selectedItemId)
      await refreshAll(participantId)
      setMessage(`${placedItem?.name ?? '아이템'}을(를) 놓았어요. 마음에 쏙 들어요!`)
      const current = inventory.find(row => row.itemId === selectedItemId)?.available ?? 0
      if (current <= 1) setSelectedItemId(null)
    } finally {
      setRoomBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!selectedPlaced || roomBusy) return
    const item = itemById(selectedPlaced.itemId)
    setRoomBusy(true)
    try {
      const ok = await removeHouseItem({ participantId, layoutId: selectedPlaced.layoutId })
      if (!ok) {
        setMessage('아이템을 보관하지 못했어요. 다시 시도해 주세요.')
        return
      }
      await refreshAll(participantId)
      setSelectedPlaced(null)
      setActivePanel('inventory')
      setMessage(`${item?.name ?? '아이템'}을(를) 내 아이템으로 돌려보냈어요.`)
    } finally {
      setRoomBusy(false)
    }
  }

  const selectInventoryItem = itemId => {
    setSelectedPlaced(null)
    setSelectedItemId(current => current === itemId ? null : itemId)
    setMessage('')
  }
  const openPanel = panel => {
    setActivePanel(panel)
    setSelectedPlaced(null)
    if (panel !== 'inventory') setSelectedItemId(null)
  }
  const selectShopCategory = category => {
    setShopCategory(category)
    setShopSubcategory('전체')
    setShopLimit(SHOP_PAGE_SIZE)
    setShopFamilyId(null)
  }
  const openShopFamily = familyId => {
    setShopFamilyId(familyId)
    setShopLimit(SHOP_PAGE_SIZE)
  }
  const inviteUrl = typeof window === 'undefined' || !participantId ? '' : `${window.location.origin}${window.location.pathname}?house=${encodeURIComponent(participantId)}`
  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setMessage('링크를 복사하지 못했어요. 주소창에서 직접 복사해 주세요.')
    }
  }

  if (!participantId) {
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-y-auto bg-[var(--house-cream)] px-5 py-10 text-[var(--house-cocoa)]">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#F8CDBD]/65 blur-3xl" />
          <span className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#BFE2D2]/70 blur-3xl" />
          <span className="absolute left-[12%] top-[18%] text-3xl text-[#D8B45A]/70">✦</span>
          <span className="absolute bottom-[20%] right-[14%] text-2xl text-[#D8B45A]/60">✦</span>
        </div>
        <section className="relative w-full max-w-[430px] rounded-[30px] border border-white/80 bg-[var(--house-surface)] p-5 shadow-[0_30px_80px_rgba(91,67,48,0.18)] sm:p-8">
          <div className="mx-auto mb-5 h-28 w-28 drop-shadow-[0_14px_12px_rgba(181,111,81,.2)]"><HouseMark /></div>
          <p className="text-center text-[11px] font-extrabold tracking-[0.22em] text-[#B2735B]">SOUND VILLAGE HOME</p>
          <h1 className="mt-2 text-center text-[30px] font-extrabold leading-tight">우리 집에 어서 와요!</h1>
          <p className="mx-auto mt-3 max-w-[320px] text-center text-sm font-semibold leading-6 text-[#7D6B5D]">도서관에서 모은 코인으로 집을 꾸미고, 친구를 초대할 준비를 해볼까요?</p>
          <form onSubmit={handleEnter} className="mt-7">
            <label htmlFor="participant-id" className="mb-2 block text-xs font-extrabold text-[#6E5A49]">참여자 ID</label>
            <input id="participant-id" value={participantIdInput} onChange={event => setParticipantIdInput(event.target.value)} placeholder="ID를 입력해주세요" autoComplete="off" className="h-13 w-full rounded-2xl border border-[#3A2A1E]/10 bg-[var(--house-cream)] px-4 text-[15px] font-bold outline-none transition placeholder:text-[#A99989] focus:border-[var(--house-mint)] focus:ring-4 focus:ring-[#91CDB2]/20" />
            <button type="submit" disabled={loading || !participantIdInput.trim()} className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--house-peach)] text-[15px] font-extrabold text-[var(--house-cocoa)] shadow-[0_10px_22px_rgba(205,117,87,.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55">
              {loading ? '집 문을 여는 중...' : '내 집으로 들어가기'}{!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>
          {message && <p className="mt-4 text-center text-xs font-bold text-[#C45F55]">{message}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="relative h-dvh overflow-y-auto bg-[linear-gradient(180deg,#CFE5D5_0%,#E7E6C8_25%,#F2E5CF_58%,#EAD4B7_100%)] text-[var(--house-cocoa)]">
      <div className="pointer-events-none fixed inset-0 opacity-45" aria-hidden="true">
        <span className="absolute -left-10 top-[12%] h-44 w-44 rounded-[50%] bg-[#A8CDAF]/70 blur-2xl" />
        <span className="absolute -right-10 top-[40%] h-56 w-56 rounded-[50%] bg-[#F0B99F]/55 blur-3xl" />
        <span className="absolute left-[8%] top-[8%] rotate-[-18deg] text-2xl text-[#729B78]/45">◆</span>
        <span className="absolute right-[10%] top-[18%] rotate-[22deg] text-xl text-[#D6A75D]/60">✦</span>
      </div>
      <div className="relative mx-auto min-h-full w-full max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
        <header className="mb-5 flex items-center justify-between gap-3 border-b border-[#6E513D]/12 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => visitorMode ? window.location.assign(window.location.pathname) : setParticipantId('')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/75 bg-[var(--house-surface)] text-[#735F4D] shadow-[0_8px_20px_rgba(58,42,30,.08)] transition hover:-translate-x-0.5" aria-label="나가기"><Icon name="arrow" /></button>
            <div className="min-w-0"><p className="text-[10px] font-black tracking-[0.2em] text-[#6D8B65]">{visitorMode ? '이웃집 방문' : 'SOUND VILLAGE · HOME'}</p><h1 className="truncate text-lg font-black sm:text-xl">{participantId}의 포근한 집</h1></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CoinPill balance={balance} visitorMode={visitorMode} />
            {!visitorMode && <button type="button" onClick={() => setInviteOpen(true)} className="hidden h-11 items-center gap-2 rounded-full bg-[var(--house-cocoa)] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(58,42,30,.18)] transition hover:-translate-y-0.5 sm:flex"><Icon name="invite" className="h-4 w-4" /> 친구 초대</button>}
          </div>
        </header>

        {loading ? (
          <div className="grid min-h-[70vh] place-items-center"><div className="text-center"><div className="mx-auto mb-3 h-20 w-20 animate-[floatSmall_1.8s_ease-in-out_infinite]"><HouseMark /></div><p className="text-sm font-extrabold text-[#7D6B5D]">집을 예쁘게 정리하는 중...</p></div></div>
        ) : (
          <div className={`grid gap-5 ${visitorMode ? 'mx-auto max-w-[900px]' : 'lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]'}`}>
            <section className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-4 px-1">
                <div><p className="text-[10px] font-extrabold tracking-[0.18em] text-[#B2735B]">{visitorMode ? 'WELCOME HOME' : purchaseTarget ? 'ROOM PREVIEW' : selectedItemId ? 'DECORATING MODE' : 'LIVING ROOM'}</p><h2 className="mt-1 text-xl font-extrabold">{visitorMode ? '친구의 집을 구경해요' : purchaseTarget ? `${purchaseTarget.name} 미리보기` : selectedItemId ? `${itemById(selectedItemId)?.name}을 놓아볼까요?` : '햇살 드는 거실'}</h2></div>
                {!visitorMode && <span className="hidden text-xs font-bold text-[#8D7866] sm:block">놓인 아이템 {placedFurnitureCount}개</span>}
              </div>
              <HouseRoom layout={layout} selectedItemId={selectedItemId} selectedPlacedId={selectedPlaced?.layoutId} previewItem={purchaseTarget} visitorMode={visitorMode} onCellClick={handleCellClick} />
              {!visitorMode && (
                <div className="mt-5 border-2 border-[#9B6C49]/20 bg-[#FFF5D9]/88 p-3.5 shadow-[4px_5px_0_rgba(128,87,55,.12)] [clip-path:polygon(9px_0,100%_0,100%_calc(100%_-_9px),calc(100%_-_9px)_100%,0_100%,0_9px)]">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${inviteReady ? 'bg-[#DFF1E8]' : 'bg-[#FFE5D9]'}`}>{inviteReady ? '🎉' : '🛠️'}</div>
                    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 text-xs font-extrabold"><span>{inviteReady ? '친구를 초대할 준비가 됐어요!' : '친구를 맞을 준비 중이에요'}</span><span className="tabular-nums text-[#8A735E]">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden bg-[#D8C49B]"><div className="h-full bg-[linear-gradient(90deg,#E58D6F,#8DB995)] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div></div>
                  </div>
                  <p className="mt-2.5 pl-[52px] text-[11px] font-semibold text-[#8A735E]">현재 화면에서는 가구 {INVITE_READY_COUNT}개를 집 공개 미리보기 기준으로 사용해요.</p>
                </div>
              )}
              {message && <button type="button" onClick={() => setMessage('')} className="mt-3 flex w-full items-center justify-between border border-[#805B3F]/15 bg-[#FFF7E7] px-4 py-2.5 text-left text-xs font-extrabold text-[#7D6040] shadow-[3px_4px_0_rgba(102,67,48,.1)] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)]"><span className="flex items-center gap-2"><span className="h-9 w-9 shrink-0"><MascotArt /></span>{message}</span><Icon name="close" className="h-4 w-4 opacity-50" /></button>}
            </section>

            {!visitorMode && (
              <aside className="min-w-0 overflow-hidden border-2 border-[#936242]/45 bg-[#F6E8CF]/95 p-3 shadow-[6px_8px_0_rgba(116,75,47,.16),0_20px_42px_rgba(58,42,30,.12)] [clip-path:polygon(16px_0,calc(100%_-_10px)_0,100%_10px,100%_calc(100%_-_16px),calc(100%_-_16px)_100%,10px_100%,0_calc(100%_-_10px),0_16px)] sm:p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-32px)]">
                <div className="-mx-4 -mt-4 mb-4 h-4 border-b-2 border-[#875739]/35 bg-[repeating-linear-gradient(90deg,#E48E74_0_24px,#FFF3D5_24px_48px,#8DB89A_48px_72px,#FFF3D5_72px_96px)]" aria-hidden="true" />
                <div className="mb-4 flex items-start justify-between gap-3 px-1 pt-1">
                  <div><p className="text-[10px] font-extrabold tracking-[0.18em] text-[#B2735B]">{panelCopy.eyebrow}</p><h2 className="mt-1 text-xl font-extrabold">{panelCopy.title}</h2><p className="mt-1 text-xs font-semibold leading-5 text-[#816D5B]">{panelCopy.description}</p></div>
                  {selectedItemId && <button type="button" onClick={() => setSelectedItemId(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--house-cream)] text-[#846F5D]" aria-label="배치 취소"><Icon name="close" className="h-4 w-4" /></button>}
                </div>
                <div className="max-h-[calc(100dvh-210px)] overflow-y-auto px-1 pb-2">
                  {activePanel === 'shop' && <>
                    <div className="mb-3 flex items-center justify-between border-b border-[#7D573C]/15 pb-2 text-[10px] font-black tracking-[.12em] text-[#87664F]"><span>COZY INTERIOR ARCHIVE</span><span>{GENERATED_HOUSE_ITEM_COUNT.toLocaleString('ko-KR')} EXTRACTED</span></div>
                    <label className="mb-3 flex h-10 items-center gap-2 border border-[#7D573C]/15 bg-[#FFF9EB] px-3 [clip-path:polygon(6px_0,100%_0,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,0_100%,0_6px)]">
                      <span className="text-sm text-[#9A806B]" aria-hidden="true">⌕</span>
                      <input value={shopSearch} onChange={event => { setShopSearch(event.target.value); setShopLimit(SHOP_PAGE_SIZE); setShopFamilyId(null) }} placeholder="가구·소품 이름 검색" className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-[#AA9887]" />
                    </label>
                    <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-2">
                      {HOUSE_ITEM_CATEGORIES.map(category => <button key={category} type="button" onClick={() => selectShopCategory(category)} className={`shrink-0 border px-3 py-1.5 text-[10px] font-extrabold transition ${shopCategory === category ? 'border-[#6D4B35] bg-[#6D4B35] text-white' : 'border-[#7D573C]/15 bg-[#FFF9EB] text-[#7D6856]'}`}>{category}</button>)}
                    </div>
                    {shopSubcategories.length > 1 && <div className="mb-3 border-l-2 border-[#C8956D] pl-2"><p className="mb-1.5 text-[9px] font-black tracking-[.12em] text-[#A0785B]">{shopCategory} 안에서 용도 선택</p><div className="flex flex-wrap gap-1.5">{['전체', ...shopSubcategories].map(subcategory => <button key={subcategory} type="button" onClick={() => { setShopSubcategory(subcategory); setShopFamilyId(null); setShopLimit(SHOP_PAGE_SIZE) }} className={`border px-2.5 py-1 text-[10px] font-extrabold ${shopSubcategory === subcategory ? 'border-[#C06F57] bg-[#F4C8B8] text-[#694737]' : 'border-[#7D573C]/15 bg-[#FFF9EB] text-[#806B59]'}`}>{subcategory}</button>)}</div></div>}
                    {selectedShopFamily ? <>
                      <button type="button" onClick={() => { setShopFamilyId(null); setShopLimit(SHOP_PAGE_SIZE) }} className="mb-3 flex w-full items-center justify-between border border-[#7D573C]/15 bg-[#FFF9EB] px-3 py-2 text-left"><span><span className="block text-[10px] font-bold text-[#9A806B]">← 상품군 목록</span><span className="mt-0.5 block text-sm font-black text-[#654A37]">{selectedShopFamily.name}</span></span><span className="text-[10px] font-extrabold text-[#98684A]">{selectedShopFamily.items.length.toLocaleString('ko-KR')}가지</span></button>
                      <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[#8A735E]"><span>색상·테마를 골라주세요</span><span>{Math.min(visibleShopVariants.length, selectedShopFamily.items.length).toLocaleString('ko-KR')}개 표시</span></div>
                      <div className="grid grid-cols-2 gap-3">{visibleShopVariants.map(item => <ShopCard key={item.id} item={item} ownedQuantity={ownedQuantity(item.id)} pending={pendingPurchaseIds.has(item.id)} selected={purchaseTarget?.id === item.id} onSelect={setPurchaseTarget} />)}</div>
                      {visibleShopVariants.length < selectedShopFamily.items.length && <button type="button" onClick={() => setShopLimit(limit => limit + SHOP_PAGE_SIZE)} className="mt-4 h-11 w-full border-2 border-[#76533A] bg-[#F5D598] text-xs font-black text-[#60442F] shadow-[0_4px_0_#B78354]">변형 {Math.min(SHOP_PAGE_SIZE, selectedShopFamily.items.length - visibleShopVariants.length)}개 더 보기</button>}
                    </> : <>
                      <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[#8A735E]"><span>{shopFamilies.length.toLocaleString('ko-KR')}개 상품군 · {filteredShopItems.length.toLocaleString('ko-KR')}개 변형</span><span>{Math.min(visibleShopFamilies.length, shopFamilies.length).toLocaleString('ko-KR')}개 표시</span></div>
                      {visibleShopFamilies.length > 0 ? <div className="grid grid-cols-2 gap-3">{visibleShopFamilies.map(family => <FamilyCard key={family.id} family={family} onSelect={openShopFamily} />)}</div> : <div className="border border-dashed border-[#7D573C]/20 bg-[#FFF9EB] px-5 py-10 text-center text-xs font-bold text-[#8A735E]">검색 결과가 없어요.</div>}
                      {visibleShopFamilies.length < shopFamilies.length && <button type="button" onClick={() => setShopLimit(limit => limit + SHOP_PAGE_SIZE)} className="mt-4 h-11 w-full border-2 border-[#76533A] bg-[#F5D598] text-xs font-black text-[#60442F] shadow-[0_4px_0_#B78354]">상품군 {Math.min(SHOP_PAGE_SIZE, shopFamilies.length - visibleShopFamilies.length)}개 더 보기</button>}
                    </>}
                  </>}
                  {activePanel === 'inventory' && (
                    <div className="space-y-2.5">
                      {inventory.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-[#3A2A1E]/15 bg-[var(--house-surface)] px-6 py-10 text-center"><div className="mb-3 text-5xl">📦</div><p className="text-sm font-extrabold">배치할 아이템이 없어요</p><p className="mt-1 text-xs font-semibold text-[#8A735E]">상점에서 마음에 드는 물건을 골라보세요.</p><button type="button" onClick={() => openPanel('shop')} className="mt-5 rounded-full bg-[var(--house-peach)] px-5 py-2.5 text-xs font-extrabold">상점 둘러보기</button></div>
                      ) : inventory.map(row => {
                        const item = itemById(row.itemId)
                        return item ? <InventoryCard key={row.itemId} item={item} available={row.available} selected={selectedItemId === row.itemId} onSelect={selectInventoryItem} /> : null
                      })}
                    </div>
                  )}
                  {activePanel === 'friends' && (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#FFD9C9] to-[#BFE2D2] p-5 text-center shadow-sm">
                        <div className="mx-auto mb-3 flex w-fit -space-x-2"><span className="h-14 w-14 overflow-hidden rounded-full border-4 border-white bg-[#F8D6B5] p-1"><MascotArt /></span><span className="h-14 w-14 overflow-hidden rounded-full border-4 border-white bg-[#D7ECD9] p-1"><NeighborArt /></span><span className="h-14 w-14 overflow-hidden rounded-full border-4 border-white bg-[#E3D8EC] p-1"><NeighborArt kind="rabbit" /></span></div>
                        <h3 className="text-lg font-extrabold">우리 집에 놀러 올래?</h3><p className="mt-1 text-xs font-semibold leading-5 text-[#715B4A]">방문 링크를 받은 친구는 지금 꾸며진 방을 읽기 전용으로 볼 수 있어요.</p>
                        <button type="button" onClick={() => setInviteOpen(true)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--house-cocoa)] text-sm font-extrabold text-white"><Icon name="invite" className="h-4 w-4" />초대 링크 만들기</button>
                      </div>
                      <div className="rounded-[18px] bg-[var(--house-surface)] p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F0E8F7] text-xl">🎮</span><div><p className="text-sm font-extrabold">같이 마을 걷기</p><p className="text-[11px] font-bold text-[#9A8775]">실시간 멀티플레이는 다음 단계에서 연결해요.</p></div></div></div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {!visitorMode && (
        <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[520px] items-center justify-around border-2 border-[#65462F] bg-[#E8C28E] px-2 py-2 shadow-[0_6px_0_#9A6640,0_18px_45px_rgba(58,42,30,.22)] [clip-path:polygon(10px_0,calc(100%_-_10px)_0,100%_10px,100%_calc(100%_-_10px),calc(100%_-_10px)_100%,10px_100%,0_calc(100%_-_10px),0_10px)] lg:hidden" aria-label="집꾸미기 메뉴">
          {[
            ['shop', 'shop', '상점'],
            ['inventory', 'bag', '내 아이템'],
            ['friends', 'users', '친구'],
          ].map(([panel, icon, label]) => <button key={panel} type="button" onClick={() => openPanel(panel)} className={`flex min-w-[88px] flex-col items-center gap-1 px-4 py-2 text-[10px] font-black transition [clip-path:polygon(6px_0,100%_0,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,0_100%,0_6px)] ${activePanel === panel ? 'bg-[#FFF3D9] text-[#9A513F] shadow-[0_3px_0_#B77C56]' : 'text-[#604733]'}`}><Icon name={icon} className="h-5 w-5" />{label}</button>)}
        </nav>
      )}

      {!visitorMode && (
        <div className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full border border-white/80 bg-[var(--house-surface)] p-1.5 shadow-[0_12px_30px_rgba(58,42,30,.15)] lg:flex">
          {[
            ['shop', 'shop', '상점'],
            ['inventory', 'bag', '내 아이템'],
            ['friends', 'users', '친구'],
          ].map(([panel, icon, label]) => <button key={panel} type="button" onClick={() => openPanel(panel)} title={label} className={`grid h-11 w-11 place-items-center rounded-full transition ${activePanel === panel ? 'bg-[var(--house-peach)] text-[var(--house-cocoa)]' : 'text-[#806D5D] hover:bg-[var(--house-cream)]'}`}><Icon name={icon} /></button>)}
        </div>
      )}

      {selectedPlaced && !visitorMode && (
        <div className="fixed inset-x-4 bottom-24 z-[55] mx-auto flex max-w-sm items-center gap-3 rounded-[22px] border border-white/80 bg-[var(--house-surface)] p-3 shadow-[0_20px_50px_rgba(58,42,30,.22)] lg:bottom-5">
          <ItemArtwork item={itemById(selectedPlaced.itemId)} size="small" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{itemById(selectedPlaced.itemId)?.name}</p><p className="text-[11px] font-bold text-[#8A735E]">이 아이템을 보관할까요?</p></div>
          <button type="button" onClick={() => setSelectedPlaced(null)} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--house-cream)]" aria-label="취소"><Icon name="close" className="h-4 w-4" /></button>
          <button type="button" onClick={handleRemove} disabled={roomBusy} className="flex h-10 items-center gap-1.5 rounded-full bg-[var(--house-cocoa)] px-4 text-xs font-extrabold text-white disabled:opacity-50"><Icon name="box" className="h-4 w-4" />보관</button>
        </div>
      )}

      {purchaseTarget && (
        <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[70] flex justify-center lg:bottom-5 lg:left-5 lg:right-auto" role="presentation">
          <section role="dialog" aria-modal="false" aria-labelledby="purchase-title" className="pointer-events-auto w-full max-w-[430px] border-2 border-[#5D8E75]/45 bg-[var(--house-surface)] p-4 shadow-[0_8px_0_#7DA78F,0_24px_60px_rgba(45,31,23,.3)] [clip-path:polygon(12px_0,calc(100%_-_8px)_0,100%_8px,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,8px_100%,0_calc(100%_-_8px),0_12px)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3"><ItemArtwork item={purchaseTarget} size="small" /><div><p className="text-[10px] font-extrabold tracking-[.16em] text-[#4F856B]">LIVE ROOM PREVIEW</p><h2 id="purchase-title" className="text-lg font-extrabold">{purchaseTarget.name}</h2><p className="mt-0.5 text-[10px] font-bold text-[#7B8D80]">구매하지 않아도 집에서 확인할 수 있어요.</p></div></div>
              <button type="button" onClick={() => setPurchaseTarget(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--house-cream)]" aria-label="미리보기 종료"><Icon name="close" className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 line-clamp-2 rounded-xl bg-[var(--house-cream)] px-3 py-2 text-[11px] font-semibold leading-4 text-[#715F50]">{getItemMeta(purchaseTarget).description}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl bg-[#F4EFE7] px-3 py-2"><span className="text-[10px] font-bold text-[#9A8775]">내 코인</span><span className="flex items-center gap-1 text-sm font-extrabold tabular-nums"><Icon name="coin" className="h-4 w-4 text-[#D79C25]" />{balance}</span></div>
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl bg-[#E5F4EC] px-3 py-2"><span className="text-[10px] font-bold text-[#6C8F7E]">가격</span><span className="text-sm font-extrabold tabular-nums">{purchaseTarget.price}</span></div>
            </div>
            {balance < purchaseTarget.price && <p className="mt-2 text-center text-[11px] font-extrabold text-[#B85C52]">코인은 부족하지만 미리보기는 계속할 수 있어요 · {purchaseTarget.price - balance}개 부족</p>}
            <div className="mt-3 grid grid-cols-[.8fr_1.2fr] gap-2">
              <button type="button" onClick={() => setPurchaseTarget(null)} className="h-11 rounded-xl bg-[var(--house-cream)] text-xs font-extrabold text-[#786451]">미리보기 종료</button>
              <button type="button" onClick={() => handleBuy(purchaseTarget)} disabled={balance < purchaseTarget.price || pendingPurchaseIds.has(purchaseTarget.id)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--house-peach)] text-xs font-extrabold shadow-[0_7px_16px_rgba(205,117,87,.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Icon name="coin" className="h-4 w-4" />{pendingPurchaseIds.has(purchaseTarget.id) ? '구매하는 중...' : '구매하고 배치하기'}</button>
            </div>
          </section>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#30231A]/35 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setInviteOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="invite-title" className="w-full max-w-[460px] rounded-[28px] border border-white/80 bg-[var(--house-surface)] p-5 text-center shadow-[0_28px_80px_rgba(45,31,23,.28)]">
            <button type="button" onClick={() => setInviteOpen(false)} className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-[var(--house-cream)]" aria-label="닫기"><Icon name="close" className="h-4 w-4" /></button>
            <div className="mx-auto -mt-2 mb-3 h-20 w-20"><HouseMark /></div>
            <p className="text-[10px] font-extrabold tracking-[.18em] text-[#B2735B]">HOUSE INVITATION</p><h2 id="invite-title" className="mt-1 text-2xl font-extrabold">우리 집에 놀러 올래?</h2>
            <p className="mx-auto mt-2 max-w-[340px] text-xs font-semibold leading-5 text-[#7D6B5D]">이 링크를 받은 친구는 현재 집을 읽기 전용으로 구경할 수 있어요. 가구를 옮기거나 구매할 수는 없어요.</p>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[var(--house-cream)] p-2 pl-4"><span className="min-w-0 flex-1 truncate text-left text-[11px] font-bold text-[#806D5D]">{inviteUrl}</span><button type="button" onClick={copyInvite} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold ${copied ? 'bg-[var(--house-mint)] text-white' : 'bg-[var(--house-cocoa)] text-white'}`}>{copied ? <Icon name="check" className="h-4 w-4" /> : <Icon name="copy" className="h-4 w-4" />}{copied ? '복사됨' : '복사'}</button></div>
            <p className="mt-3 text-[10px] font-bold text-[#A18D7B]">실시간으로 같이 걷고 채팅하는 기능은 멀티플레이 연결 단계에서 추가됩니다.</p>
          </section>
        </div>
      )}
    </main>
  )
}
