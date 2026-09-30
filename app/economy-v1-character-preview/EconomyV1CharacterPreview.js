'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import VillageCurrencyIcon, { villageKoreanName } from '@/components/economy-v1/VillageCurrencyIcon'
import VillageCostVector, { villageShortages } from '@/components/economy-v1/VillageCostVector'
import VillageWalletBar from '@/components/economy-v1/VillageWalletBar'
import {
  claimEconomyAttendance,
  equipCharacterItem,
  getCharacterProfile,
  getCharacterShop,
  getEconomyAttendance,
  getVillageWallets,
  newEconomyOperationKey,
  purchaseCharacterItem,
} from '@/lib/economyV1.client'
import { restoreParticipantSession } from '@/lib/participantAuth'
import { setUserEventContext, startStudySession, trackEvent } from '@/lib/userEvents'
import styles from './preview.module.css'

const BASIC_ITEM = Object.freeze({
  id: 'basic', name: '기본 의상', type: 'outfit', productGroup: 'outfit',
  runtimeAsset: '/assets/world/player_clothes.png', rarity: 'free', cost: {},
  requiredVillageCount: 0, estimatedAnnotationCount: 0, minimumFreshAnnotationCount: 0,
})
const DAY_AMOUNTS = [2, 2, 2, 3, 3, 4, 5]
const CONFIRMED_PURCHASE_RESULTS = new Set([
  'insufficient_funds', 'already_owned', 'bundle_partially_owned', 'official_store_unapproved',
  'unknown_item', 'participant_inactive',
])
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function eventMetadata(item, extra = {}) {
  return {
    item_id: item?.id,
    product_group: item?.productGroup,
    price_tier: item?.priceTier,
    currency_combination: item?.currencyCombination,
    ...extra,
  }
}

function CharacterSprite({ outfit, accessory }) {
  const layers = [
    '/assets/world/player_body.png',
    outfit?.runtimeAsset || BASIC_ITEM.runtimeAsset,
    '/assets/world/player_hair.png',
    accessory?.runtimeAsset,
  ].filter(Boolean)
  return (
    <div className={styles.characterStage} aria-label={`${outfit?.name || '기본 의상'}${accessory ? `, ${accessory.name}` : ', 액세서리 미착용'} 캐릭터 미리보기`}>
      <div className={styles.sprite}>
        {layers.map((src, index) => <span className={styles.spriteLayer} style={{ backgroundImage: `url(${src})` }} key={`${src}-${index}`} />)}
      </div>
      <div className={styles.stageShadow} />
    </div>
  )
}

function ItemCard({ item, balances, owned, equipped, pending, failed, onPreview, onBuy, onEquip }) {
  const shortages = villageShortages(item.cost, balances)
  const canBuy = !owned && shortages.length === 0
  const shortageReason = shortages
    .map(({ village, shortage }) => `${villageKoreanName(village)} ${shortage} \uBD80\uC871`)
    .join(', ')
  const shortageId = `shop-item-${item.id}-shortage`
  let state = canBuy ? '구매 가능' : '잔액 부족'
  if (failed) state = '오류 후 재시도'
  if (pending) state = '구매 처리 중'
  if (owned) state = '보유'
  if (equipped) state = '장착됨'
  return (
    <article className={`${styles.card} ${equipped ? styles.equippedCard : ''}`} data-testid={`shop-item-${item.id}`}>
      <button className={styles.cardPreviewButton} type="button" onClick={() => onPreview(item)} aria-label={`${item.name} \uBBF8\uB9AC\uBCF4\uAE30`}>
        <div className={styles.cardVisual}>
        {item.previewAsset ? <Image src={item.previewAsset} width={96} height={96} unoptimized alt={`${item.name} 미리보기`} /> : <CharacterSprite outfit={item} />}
        <span className={styles.stateBadge}>{state}</span>
        </div>
      </button>
      <div className={styles.cardBody}>
        <div className={styles.itemTitleRow}>
          <h3>{item.name}</h3>
          {item.currencyCombination === 'ALL' && <span className={styles.allBadge}>모든 마을 참여 상품</span>}
        </div>
        {item.id !== 'basic' && <VillageCostVector cost={item.cost} balances={balances} />}
        {item.priceTier === 'small' && <p className={styles.participation}>서로 다른 4개 마을에서 각각 한 번 이상 참여</p>}
        {item.id !== 'basic' && (
          <p className={styles.annotationInfo}>예상 참여 {item.estimatedAnnotationCount}회 · 최소 신규 참여 {item.minimumFreshAnnotationCount}회</p>
        )}
        {shortages.length > 0 && !owned && (
          <p className={styles.shortageText} id={shortageId}>{shortageReason}</p>
        )}
        <button
          className={styles.cardAction}
          disabled={pending || equipped || (!owned && !canBuy)}
          aria-describedby={!owned && !canBuy ? shortageId : undefined}
          aria-label={!owned && !canBuy ? `\uAD6C\uB9E4 \uBD88\uAC00: ${shortageReason}` : undefined}
          title={!owned && !canBuy ? shortageReason : undefined}
          onClick={(event) => {
            event.stopPropagation()
            if (owned) onEquip(item)
            else onBuy(item, event.currentTarget)
          }}
        >
          {pending ? '처리 중…' : equipped ? '장착됨' : owned ? '장착하기' : canBuy ? '구매하기' : '잔액 부족'}
        </button>
      </div>
    </article>
  )
}

function AttendancePanel({ attendance, pending, onClaim }) {
  if (!attendance?.ok) return <section className={styles.attendance}><h2>주간 출석</h2><p>출석 정보를 불러오지 못했습니다.</p></section>
  const claimed = new Map((attendance.claims || []).map((claim) => [claim.day, claim]))
  const today = attendance.attendanceDay
  const todayClaim = claimed.get(today)
  const todayVillage = todayClaim?.village || (today <= 6 ? attendance.villagePermutation?.[today - 1] : attendance.day7Village)
  return (
    <section className={styles.attendance} aria-labelledby="attendance-title">
      <div className={styles.sectionHeading}>
        <div><span className={styles.eyebrow}>WEEKLY CHECK-IN</span><h2 id="attendance-title">주간 출석</h2></div>
        <strong>총 21</strong>
      </div>
      <p className={styles.attendanceIntro}>매일 참여하고 여섯 마을 화폐를 차근차근 모아보세요.</p>
      <div className={styles.days}>
        {DAY_AMOUNTS.map((amount, index) => {
          const day = index + 1
          const claim = claimed.get(day)
          const isToday = day === today
          const visibleVillage = claim?.village || (isToday ? todayVillage : null)
          return (
            <div className={`${styles.day} ${claim ? styles.claimedDay : ''} ${isToday ? styles.today : ''}`} key={day}>
              <span>{day}일</span>
              {visibleVillage ? <VillageCurrencyIcon village={visibleVillage} /> : <b aria-label={day === 7 ? '청구 후 마을 결정' : '아직 받지 않음'}>?</b>}
              <strong>+{claim?.amount || amount}</strong>
              <small>{claim ? '받음' : isToday ? '오늘' : '대기'}</small>
            </div>
          )
        })}
      </div>
      {today === 7 && !todayClaim && <p className={styles.day7Note}>7일차 마을은 청구 시 가장 잔액이 적은 지갑을 기준으로 서버가 결정합니다.</p>}
      {todayClaim ? (
        <div className={styles.claimedMessage}><VillageCurrencyIcon village={todayClaim.village} /> 오늘 {villageKoreanName(todayClaim.village)} 화폐 {todayClaim.amount}개를 받았어요.</div>
      ) : (
        <button className={styles.primaryButton} disabled={pending} onClick={onClaim}>{pending ? '출석 확인 중…' : '오늘 출석 보상 받기'}</button>
      )}
    </section>
  )
}

export default function EconomyV1CharacterPreview({ localDatabase }) {
  const [status, setStatus] = useState('loading')
  const [shop, setShop] = useState([])
  const [profile, setProfile] = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [tab, setTab] = useState('outfit')
  const [previewOutfitId, setPreviewOutfitId] = useState('basic')
  const [previewAccessoryId, setPreviewAccessoryId] = useState(null)
  const [pendingPurchases, setPendingPurchases] = useState({})
  const [pendingEquip, setPendingEquip] = useState(false)
  const [pendingAttendance, setPendingAttendance] = useState(false)
  const [failedItems, setFailedItems] = useState({})
  const [notice, setNotice] = useState(null)
  const [purchaseModal, setPurchaseModal] = useState(null)
  const purchaseKeys = useRef(new Map())
  const equipKeys = useRef(new Map())
  const attendanceKey = useRef(null)
  const purchaseModalRef = useRef(null)
  const purchasePrimaryActionRef = useRef(null)
  const purchaseTriggerRef = useRef(null)
  const tabListRef = useRef(null)

  const itemMap = useMemo(() => new Map([[BASIC_ITEM.id, BASIC_ITEM], ...shop.map((item) => [item.id, item])]), [shop])
  const owned = useMemo(() => new Set(['basic', ...(profile?.ownedItemIds || [])]), [profile])
  const previewOutfit = itemMap.get(previewOutfitId) || BASIC_ITEM
  const previewAccessory = previewAccessoryId ? itemMap.get(previewAccessoryId) : null
  const balances = profile?.balances || {}
  const outfits = shop.filter((item) => item.productGroup === 'outfit')
  const accessories = shop.filter((item) => item.productGroup === 'accessory')

  const load = useCallback(async () => {
    setStatus('loading')
    const participant = await restoreParticipantSession().catch(() => null)
    if (!participant) { setStatus('auth_required'); return }
    await startStudySession('economy-v1-character-preview').catch(() => null)
    setUserEventContext({ screen: 'economy-v1-character-preview' })
    trackEvent('economy_v1_preview_opened', { metadata: { source: 'internal_preview' } }, { critical: true })
    trackEvent('attendance_panel_opened', { metadata: { source: 'economy_v1_preview' } })
    const [shopResult, profileResult, attendanceResult] = await Promise.all([
      getCharacterShop(), getCharacterProfile(), getEconomyAttendance(),
    ])
    if (!shopResult.ok || !profileResult.ok) {
      setStatus(profileResult.code === 'auth_required' ? 'auth_required' : 'error')
      return
    }
    setShop(shopResult.items || [])
    setProfile(profileResult)
    setPreviewOutfitId(profileResult.loadout?.outfitId || profileResult.defaultOutfitId || 'basic')
    setPreviewAccessoryId(profileResult.loadout?.accessoryId || null)
    setAttendance(attendanceResult)
    trackEvent('village_wallets_viewed', { metadata: { source: 'character_profile' } })
    setStatus('ready')
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const closePurchaseModal = useCallback(() => {
    const trigger = purchaseTriggerRef.current
    // Restore focus during the same keyboard event. Deferring this until after
    // unmount can race the browser's own focus fallback to <body>.
    trigger?.focus()
    setPurchaseModal(null)
  }, [])

  useEffect(() => {
    if (!purchaseModal) return undefined
    const frame = window.requestAnimationFrame(() => {
      const target = purchasePrimaryActionRef.current
        || purchaseModalRef.current?.querySelector(FOCUSABLE_SELECTOR)
      target?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [purchaseModal])

  const handleModalKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (!pendingPurchases[purchaseModal.item.id]) {
        event.preventDefault()
        closePurchaseModal()
      }
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...purchaseModalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleTabKeyDown = (event) => {
    const tabs = ['outfit', 'accessory']
    const currentIndex = tabs.indexOf(tab)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    setTab(tabs[nextIndex])
    tabListRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
  }

  const previewItem = (item) => {
    if (item.productGroup === 'outfit') setPreviewOutfitId(item.id)
    else setPreviewAccessoryId(item.id)
    const metadata = eventMetadata(item)
    trackEvent('shop_item_viewed', { target_type: 'catalog_item', target_id: item.id, metadata })
    trackEvent('character_item_previewed', { target_type: 'catalog_item', target_id: item.id, metadata })
  }

  const openPurchase = (item, trigger) => {
    purchaseTriggerRef.current = trigger
    previewItem(item)
    setPurchaseModal({ item, state: 'confirm' })
  }

  const runPurchase = async () => {
    const item = purchaseModal?.item
    if (!item || pendingPurchases[item.id]) return
    const key = purchaseKeys.current.get(item.id) || newEconomyOperationKey()
    purchaseKeys.current.set(item.id, key)
    setPendingPurchases((current) => ({ ...current, [item.id]: true }))
    setFailedItems((current) => ({ ...current, [item.id]: false }))
    trackEvent('purchase_attempted', { target_type: 'catalog_item', target_id: item.id, operation_type: 'economy_v1_purchase', operation_idempotency_key: key, metadata: eventMetadata(item) }, { critical: true })
    const result = await purchaseCharacterItem(item.id, key)
    if (result.ok) {
      setPendingPurchases((current) => ({ ...current, [item.id]: false }))
      purchaseKeys.current.delete(item.id)
      setProfile((current) => ({ ...current, balances: result.balances, ownedItemIds: [...new Set([...(current.ownedItemIds || []), item.id])] }))
      setPurchaseModal({ item, state: 'success' })
      trackEvent('purchase_succeeded', { target_type: 'catalog_item', target_id: item.id, operation_type: 'economy_v1_purchase', operation_idempotency_key: key, result_entity_type: 'catalog_item', result_entity_id: item.id, metadata: eventMetadata(item, { result_code: 'success' }) }, { critical: true })
      return
    }
    if (result.code === 'idempotency_key_reused') {
      purchaseKeys.current.delete(item.id)
      const [syncedProfile, syncedWallets] = await Promise.all([
        getCharacterProfile(),
        getVillageWallets(),
      ])
      if (syncedProfile.ok) {
        setProfile({
          ...syncedProfile,
          balances: syncedWallets.ok ? syncedWallets.balances : syncedProfile.balances,
        })
      } else if (syncedWallets.ok) {
        setProfile((current) => ({ ...current, balances: syncedWallets.balances }))
      }
      setPendingPurchases((current) => ({ ...current, [item.id]: false }))
      setPurchaseModal({ item, state: 'failure', result })
      setFailedItems((current) => ({ ...current, [item.id]: true }))
      setNotice({
        kind: 'error',
        text: '\uC694\uCCAD \uC0C1\uD0DC\uB97C \uB2E4\uC2DC \uD655\uC778\uD588\uC73C\uBA70 \uC0C8 \uC694\uCCAD\uC73C\uB85C \uC7AC\uC2DC\uB3C4\uD560 \uC218 \uC788\uC5B4\uC694.',
      })
      trackEvent('purchase_failed', { target_type: 'catalog_item', target_id: item.id, error_code: result.code, operation_type: 'economy_v1_purchase', operation_idempotency_key: key, metadata: eventMetadata(item, { insufficient_village_count: 0, result_code: result.code }) }, { critical: true })
      return
    }
    setPendingPurchases((current) => ({ ...current, [item.id]: false }))
    if (!result.retryable && CONFIRMED_PURCHASE_RESULTS.has(result.code)) purchaseKeys.current.delete(item.id)
    if (result.balances) setProfile((current) => ({ ...current, balances: result.balances }))
    if (result.code === 'already_owned') {
      const synced = await getCharacterProfile()
      if (synced.ok) setProfile(synced)
      closePurchaseModal()
    } else if (result.code === 'official_store_unapproved') {
      setShop((current) => current.filter((candidate) => candidate.id !== item.id))
      closePurchaseModal()
    } else {
      setPurchaseModal({ item, state: 'failure', result })
      setFailedItems((current) => ({ ...current, [item.id]: true }))
    }
    const shortages = result.shortages ? Object.keys(result.shortages).length : villageShortages(item.cost, balances).length
    trackEvent('purchase_failed', { target_type: 'catalog_item', target_id: item.id, error_code: result.code, operation_type: 'economy_v1_purchase', operation_idempotency_key: key, metadata: eventMetadata(item, { insufficient_village_count: shortages, result_code: result.code }) }, { critical: true })
  }

  const runEquip = async (item, forcedSlot) => {
    if (pendingEquip) return
    const slot = forcedSlot || item?.productGroup
    const itemId = item?.id ?? null
    const actionKey = `${slot}:${itemId ?? 'none'}`
    const key = equipKeys.current.get(actionKey) || newEconomyOperationKey()
    equipKeys.current.set(actionKey, key)
    setPendingEquip(true)
    const result = await equipCharacterItem(slot, itemId, key)
    setPendingEquip(false)
    if (!result.ok) {
      if (!result.retryable) equipKeys.current.delete(actionKey)
      setNotice({ kind: 'error', text: result.code === 'item_not_owned' ? '보유한 상품만 장착할 수 있어요.' : '장착을 완료하지 못했습니다. 다시 시도해 주세요.' })
      return
    }
    equipKeys.current.delete(actionKey)
    setProfile((current) => ({ ...current, loadout: result.loadout }))
    if (slot === 'outfit') setPreviewOutfitId(itemId)
    else setPreviewAccessoryId(itemId)
    setNotice({ kind: 'success', text: itemId ? `${item.name} 장착 완료` : '액세서리를 해제했어요.' })
    if (purchaseModal) closePurchaseModal()
    trackEvent(itemId ? 'character_item_equipped' : 'character_item_unequipped', {
      target_type: 'catalog_item', target_id: itemId || 'none', operation_type: 'economy_v1_equip',
      operation_idempotency_key: key, metadata: eventMetadata(item, { result_code: 'success' }),
    }, { critical: true })
  }

  const claimAttendance = async () => {
    if (pendingAttendance) return
    const key = attendanceKey.current || newEconomyOperationKey()
    attendanceKey.current = key
    setPendingAttendance(true)
    trackEvent('attendance_check_attempted', { operation_type: 'economy_v1_attendance', operation_idempotency_key: key })
    const result = await claimEconomyAttendance(key)
    setPendingAttendance(false)
    if (!result.ok) {
      if (!result.retryable) attendanceKey.current = null
      setNotice({ kind: 'error', text: '출석 보상을 확인하지 못했습니다. 같은 요청으로 다시 시도할 수 있어요.' })
      trackEvent('attendance_check_failed', { error_code: result.code, operation_type: 'economy_v1_attendance', operation_idempotency_key: key, metadata: { result_code: result.code } }, { critical: true })
      return
    }
    attendanceKey.current = null
    const refreshed = await getEconomyAttendance()
    setAttendance(refreshed.ok ? refreshed : { ...attendance, claims: [...(attendance.claims || []), { day: result.attendanceDay, village: result.village, amount: result.amount }], day7Village: result.attendanceDay === 7 ? result.village : attendance.day7Village })
    setProfile((current) => ({ ...current, balances: result.balances }))
    setNotice({ kind: 'success', text: `${villageKoreanName(result.village)} 화폐 ${result.amount}개를 받았어요.` })
    trackEvent('attendance_check_succeeded', { operation_type: 'economy_v1_attendance', operation_idempotency_key: key, metadata: { result_code: 'success', reward_amount: result.amount } }, { critical: true })
  }

  if (status === 'loading') return <main className={styles.centerState}><div className={styles.loader} /><h1>Character 상점을 준비하고 있어요</h1></main>
  if (status === 'auth_required') return (
    <main className={styles.centerState} data-testid="auth-required">
      <div className={styles.authIcon}>🔐</div><h1>참가자 인증이 필요합니다</h1>
      <p>메인 게임에서 등록된 참가자 ID로 인증한 뒤 이 내부 프리뷰로 돌아와 주세요.</p>
      <Link className={styles.primaryLink} href="/">메인 게임으로 돌아가기</Link>
    </main>
  )
  if (status === 'error') return <main className={styles.centerState}><h1>프리뷰를 불러오지 못했습니다</h1><button className={styles.primaryButton} onClick={load}>다시 시도</button></main>

  const visibleItems = tab === 'outfit' ? [BASIC_ITEM, ...outfits] : accessories
  const modalFailureMessage = purchaseModal?.state === 'failure'
    ? purchaseModal.result?.code === 'insufficient_funds'
      ? Object.entries(purchaseModal.result.shortages || {})
        .map(([village, value]) => `${villageKoreanName(village)} ${value.shortage} \uBD80\uC871`)
        .join(', ')
      : purchaseModal.result?.code === 'idempotency_key_reused'
        ? '\uC694\uCCAD \uC0C1\uD0DC\uB97C \uB2E4\uC2DC \uD655\uC778\uD588\uC73C\uBA70 \uC0C8 \uC694\uCCAD\uC73C\uB85C \uC7AC\uC2DC\uB3C4\uD560 \uC218 \uC788\uC5B4\uC694.'
        : '\uC800\uC7A5 \uC751\uB2F5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7AC\uC2DC\uB3C4\uD560 \uC218 \uC788\uC5B4\uC694.'
    : null
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div><span className={styles.previewBadge}>INTERNAL PREVIEW · 3B</span><h1>다중 마을 경제 Character 상점 프리뷰</h1><p>운영 기능이 아닙니다. 실제 로컬 DB와 서버 경제 API를 검증하는 내부 화면입니다.</p></div>
          <div className={styles.headerActions}><span className={`${styles.environment} ${localDatabase ? styles.localOk : styles.localWarn}`}>{localDatabase ? '● 일회용 로컬 DB 확인됨' : '△ 로컬 DB 설정 확인 필요'}</span><Link href="/">메인 게임으로 돌아가기</Link></div>
        </div>
        <VillageWalletBar balances={balances} />
      </header>

      {notice && <div className={`${styles.notice} ${notice.kind === 'error' ? styles.noticeError : ''}`} role="status"><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="알림 닫기">×</button></div>}

      <div className={styles.layout}>
        <aside className={styles.previewPanel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LIVE LAYERS</span><h2>캐릭터 미리보기</h2></div><span className={styles.previewOnly}>미리보기</span></div>
          <CharacterSprite outfit={previewOutfit} accessory={previewAccessory} />
          <div className={styles.previewSelections}>
            <div><span>의상</span><strong>{previewOutfit.name}</strong>{profile.loadout?.outfitId === previewOutfit.id && <em>현재 장착</em>}</div>
            <div><span>액세서리</span><strong>{previewAccessory?.name || '미착용'}</strong>{profile.loadout?.accessoryId === previewAccessory?.id && previewAccessory && <em>현재 장착</em>}</div>
          </div>
          <p className={styles.layerNote}>body → clothes → hair → accessories 순서로 합성됩니다.</p>
          <button className={styles.noneButton} disabled={pendingEquip || profile.loadout?.accessoryId == null} onClick={() => runEquip(null, 'accessory')}>액세서리 미착용</button>
        </aside>

        <section className={styles.shop} aria-labelledby="shop-title">
          <div className={styles.shopHeading}>
            <div><span className={styles.eyebrow}>CHARACTER SHOP</span><h2 id="shop-title">스타일 상점</h2></div>
            <div className={styles.tabs} role="tablist" aria-label="상품 종류" ref={tabListRef} onKeyDown={handleTabKeyDown}>
              <button id="outfit-tab" role="tab" aria-selected={tab === 'outfit'} aria-controls="outfit-panel" tabIndex={tab === 'outfit' ? 0 : -1} onClick={() => setTab('outfit')}>의상 <b>18</b></button>
              <button id="accessory-tab" role="tab" aria-selected={tab === 'accessory'} aria-controls="accessory-panel" tabIndex={tab === 'accessory' ? 0 : -1} onClick={() => setTab('accessory')}>액세서리 <b>8</b></button>
            </div>
          </div>
          <div
            id={`${tab}-panel`}
            role="tabpanel"
            aria-labelledby={`${tab}-tab`}
            tabIndex={0}
          >
          {tab === 'accessory' && (
            <button className={`${styles.noneCard} ${profile.loadout?.accessoryId == null ? styles.noneEquipped : ''}`} onClick={() => { setPreviewAccessoryId(null); trackEvent('character_item_previewed', { target_id: 'none', metadata: { product_group: 'accessory' } }) }}>
              <span>미착용</span><small>{profile.loadout?.accessoryId == null ? '현재 상태' : '클릭해 미리보기'}</small>
            </button>
          )}
          <div className={styles.grid}>
            {visibleItems.map((item) => <ItemCard
              item={item} balances={balances} owned={owned.has(item.id)}
              equipped={profile.loadout?.[item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId'] === item.id}
              pending={Boolean(pendingPurchases[item.id])} failed={Boolean(failedItems[item.id])}
              onPreview={previewItem} onBuy={openPurchase} onEquip={runEquip} key={item.id}
            />)}
          </div>
          </div>
        </section>

        <AttendancePanel attendance={attendance} pending={pendingAttendance} onClaim={claimAttendance} />
      </div>

      {purchaseModal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !pendingPurchases[purchaseModal.item.id]) closePurchaseModal() }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="purchase-title" aria-describedby="purchase-description" ref={purchaseModalRef} onKeyDown={handleModalKeyDown}>
            <button className={styles.modalClose} onClick={closePurchaseModal} disabled={pendingPurchases[purchaseModal.item.id]} aria-label="구매 창 닫기">×</button>
            <Image src={purchaseModal.item.previewAsset} width={112} height={112} unoptimized alt={`${purchaseModal.item.name} 구매 미리보기`} />
            {purchaseModal.state === 'success' ? (
              <>
                <span className={styles.modalEyebrow}>영구 해금 완료</span>
                <h2 id="purchase-title">{purchaseModal.item.name}을(를) 보유했어요!</h2>
                <p id="purchase-description">구매가 저장되고 여섯 지갑 잔액이 서버 값으로 갱신되었습니다.</p>
                <div className={styles.modalActions}>
                  <button className={styles.secondaryButton} onClick={closePurchaseModal}>나중에</button>
                  <button ref={purchasePrimaryActionRef} className={styles.primaryButton} disabled={pendingEquip} onClick={() => runEquip(purchaseModal.item)}>{pendingEquip ? '장착 중…' : '바로 장착'}</button>
                </div>
              </>
            ) : (
              <>
                <span className={styles.modalEyebrow}>{purchaseModal.state === 'failure' ? '구매 재시도' : '구매 확인'}</span>
                <h2 id="purchase-title">{purchaseModal.item.name}</h2>
                <p id="purchase-description">아래 마을 화폐가 차감되며 이 스타일은 영구 해금됩니다.</p>
                <VillageCostVector cost={purchaseModal.item.cost} balances={balances} showExpected />
                {modalFailureMessage && <p className={styles.modalError}>{modalFailureMessage}</p>}
                <div className={styles.modalActions}>
                  <button className={styles.secondaryButton} onClick={closePurchaseModal} disabled={pendingPurchases[purchaseModal.item.id]}>취소</button>
                  <button ref={purchasePrimaryActionRef} className={styles.primaryButton} onClick={runPurchase} disabled={pendingPurchases[purchaseModal.item.id]}>
                    {pendingPurchases[purchaseModal.item.id] ? '구매 처리 중…' : purchaseModal.state === 'failure' ? (purchaseModal.result?.retryable ? '같은 요청 재시도' : '새 요청으로 재시도') : '영구 해금하기'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
