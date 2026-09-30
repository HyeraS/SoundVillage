'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import VillageCostVector, { villageShortages } from './VillageCostVector'
import VillageWalletBar from './VillageWalletBar'
import { villageKoreanName } from './VillageCurrencyIcon'
import { useEconomyRuntime } from './EconomyRuntimeProvider'
import { trackEvent } from '@/lib/userEvents'
import styles from './characterShop.module.css'

const BASIC_ITEM = Object.freeze({
  id: 'basic', name: '기본 의상', productGroup: 'outfit', type: 'outfit',
  runtimeAsset: '/assets/world/player_clothes.png', cost: {},
})
const TABS = Object.freeze(['outfit', 'accessory'])
const FOCUSABLE_SELECTOR = 'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'

function itemEventMetadata(item, extra = {}) {
  return {
    item_id: item?.id,
    product_group: item?.productGroup,
    price_tier: item?.priceTier,
    currency_combination: item?.currencyCombination,
    ...extra,
  }
}

function purchaseErrorMessage(result) {
  if (result.code === 'idempotency_key_reused') return '이전 구매 요청 키가 이미 사용되었습니다. 서버 상태를 다시 확인했습니다. 새 요청으로 다시 시도해 주세요.'
  if (result.code === 'storage_retryable' || result.retryable) return '네트워크 또는 저장소 응답을 확인하지 못했습니다. 같은 요청으로 안전하게 다시 시도할 수 있습니다.'
  if (result.code === 'already_owned') return '이미 보유한 상품입니다. 보유 목록을 새로 확인했습니다.'
  if (result.code === 'official_store_unapproved') return '현재 판매가 중단된 상품입니다. 상품 목록을 새로 확인했습니다.'
  if (result.code === 'insufficient_funds') {
    const shortageText = Object.entries(result.shortages || {})
      .map(([village, value]) => `${villageKoreanName(village)} ${value.shortage} 부족`)
      .join(', ')
    return shortageText || '서버 지갑을 다시 확인했습니다. 구매에 필요한 마을 화폐가 부족합니다.'
  }
  return '구매하지 못했습니다. 상태를 확인한 뒤 다시 시도해 주세요.'
}

export default function CharacterShopPanel({ compact = false }) {
  const economy = useEconomyRuntime()
  const clearPreview = economy.clearPreview
  const [tab, setTab] = useState('outfit')
  const [selected, setSelected] = useState(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [retrySameRequest, setRetrySameRequest] = useState(false)
  const dialogRef = useRef(null)
  const dialogPrimaryRef = useRef(null)
  const purchaseTriggerRef = useRef(null)
  const tabRefs = useRef(new Map())
  const owned = useMemo(() => new Set(['basic', ...economy.ownedItemIds]), [economy.ownedItemIds])
  const items = tab === 'outfit'
    ? [BASIC_ITEM, ...economy.items.filter((item) => item.productGroup === 'outfit')]
    : economy.items.filter((item) => item.productGroup === 'accessory')

  useEffect(() => () => clearPreview(), [clearPreview])

  useEffect(() => {
    if (!selected) return undefined
    const frame = window.requestAnimationFrame(() => dialogPrimaryRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [selected])

  const restorePurchaseFocus = () => {
    const trigger = purchaseTriggerRef.current
    window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus())
  }

  const closeDialog = () => {
    if (pending) return
    setSelected(null)
    setDialogError('')
    setRetrySameRequest(false)
    clearPreview()
    restorePurchaseFocus()
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDialog()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  const chooseTab = (nextTab, focus = false) => {
    setTab(nextTab)
    if (focus) window.requestAnimationFrame(() => tabRefs.current.get(nextTab)?.focus())
  }

  const handleTabKeyDown = (event) => {
    const currentIndex = TABS.indexOf(tab)
    let nextIndex = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    chooseTab(TABS[nextIndex], true)
  }

  const preview = (item, slot = item?.productGroup, itemId = item?.id ?? null) => {
    const key = slot === 'outfit' ? 'outfitId' : 'accessoryId'
    if (economy.loadout[key] === itemId) return
    if (!economy.previewItem(slot, itemId)) return
    trackEvent('shop_item_viewed', { target_type: 'catalog_item', target_id: item?.id || 'none', metadata: itemEventMetadata(item) })
    trackEvent('character_item_previewed', { target_type: 'catalog_item', target_id: item?.id || 'none', metadata: itemEventMetadata(item) })
  }

  const equip = async (item, slot = item?.productGroup) => {
    setPending(true)
    const result = await economy.equip(slot, item?.id ?? null)
    setPending(false)
    if (!result.ok) {
      setNotice(result.code === 'item_not_owned' ? '보유한 상품만 장착할 수 있어요.' : '장착하지 못했습니다. 다시 시도해 주세요.')
      trackEvent('character_item_equip_failed', { target_type: 'catalog_item', target_id: item?.id || 'none', error_code: result.code, operation_type: 'economy_v1_equip', operation_idempotency_key: result.idempotencyKey }, { critical: true })
      return
    }
    setNotice(item ? `${item.name} 장착 완료` : '액세서리를 해제했어요.')
    trackEvent(item ? 'character_item_equipped' : 'character_item_unequipped', {
      target_type: 'catalog_item', target_id: item?.id || 'none', operation_type: 'economy_v1_equip',
      operation_idempotency_key: result.idempotencyKey, metadata: itemEventMetadata(item, { result_code: 'success' }),
    }, { critical: true })
  }

  const buy = async () => {
    const item = selected
    if (!item || pending) return
    setPending(true)
    setDialogError('')
    trackEvent('purchase_attempted', { target_type: 'catalog_item', target_id: item.id, operation_type: 'economy_v1_purchase', metadata: itemEventMetadata(item) }, { critical: true })
    const result = await economy.purchaseAndEquip(item)
    setPending(false)
    if (!result.ok) {
      const message = purchaseErrorMessage(result)
      setDialogError(message)
      setRetrySameRequest(Boolean(result.retrySameRequest))
      setNotice(message)
      trackEvent('purchase_failed', { target_type: 'catalog_item', target_id: item.id, error_code: result.code, operation_type: 'economy_v1_purchase', operation_idempotency_key: result.purchaseKey, metadata: itemEventMetadata(item, { result_code: result.code }) }, { critical: true })
      return
    }
    setSelected(null)
    setDialogError('')
    setRetrySameRequest(false)
    clearPreview()
    setNotice(result.equip?.ok === false ? '구매는 완료됐지만 장착을 확인하지 못했어요. 보유 목록에서 다시 장착해 주세요.' : `${item.name} 구매 및 장착 완료`)
    restorePurchaseFocus()
    trackEvent('purchase_succeeded', { target_type: 'catalog_item', target_id: item.id, operation_type: 'economy_v1_purchase', operation_idempotency_key: result.purchaseKey, result_entity_type: 'catalog_item', result_entity_id: item.id, metadata: itemEventMetadata(item, { result_code: 'success' }) }, { critical: true })
  }

  return <section className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-label="Character 상점">
    <header className={styles.header}>
      <div><small>CHARACTER SHOP</small><h2>스타일 상점</h2></div>
      <div className={styles.tabs} role="tablist" aria-label="상품 종류" onKeyDown={handleTabKeyDown}>
        {TABS.map((value) => <button
          key={value}
          ref={(node) => { if (node) tabRefs.current.set(value, node) }}
          id={`character-shop-tab-${value}`}
          type="button"
          role="tab"
          aria-controls={`character-shop-panel-${value}`}
          aria-selected={tab === value}
          tabIndex={tab === value ? 0 : -1}
          onClick={() => chooseTab(value)}
        >{value === 'outfit' ? '의상 18' : '액세서리 8'}</button>)}
      </div>
    </header>
    <VillageWalletBar balances={economy.balances}/>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {tab === 'accessory' && <div>
      <button
        className={styles.none}
        type="button"
        aria-pressed={economy.loadout.accessoryId == null}
        disabled={pending}
        onClick={() => preview(null, 'accessory', null)}
      >액세서리 미착용 미리보기</button>
      <button
        className={styles.none}
        type="button"
        disabled={pending || economy.savedLoadout.accessoryId == null}
        onClick={() => void equip(null, 'accessory')}
      >미착용으로 저장</button>
    </div>}
    <div
      id={`character-shop-panel-${tab}`}
      className={styles.grid}
      role="tabpanel"
      aria-labelledby={`character-shop-tab-${tab}`}
    >
      {items.map((item) => {
        const isOwned = owned.has(item.id)
        const savedEquipped = economy.savedLoadout[item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId'] === item.id
        const previewed = economy.loadout[item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId'] === item.id
        const shortages = villageShortages(item.cost, economy.balances)
        const shortageText = shortages.map(({ village, shortage }) => `${villageKoreanName(village)} ${shortage} 부족`).join(', ')
        return <article className={styles.card} data-testid={`shop-item-${item.id}`} key={item.id}>
          <button type="button" className={styles.preview} onClick={() => preview(item)} aria-label={`${item.name} 미리보기`} aria-pressed={previewed}>
            {item.previewAsset ? <Image src={item.previewAsset} width={84} height={84} unoptimized alt=""/> : <span className={styles.basic}>기본</span>}
          </button>
          <div className={styles.cardBody}><strong>{item.name}</strong>{item.id !== 'basic' && <VillageCostVector cost={item.cost} balances={economy.balances}/>}<button type="button" disabled={pending || (!isOwned && shortages.length > 0)} aria-disabled={savedEquipped || undefined} aria-label={!isOwned && shortageText ? `구매 불가: ${shortageText}` : undefined} title={shortageText || undefined} onClick={(event) => {
            preview(item)
            if (savedEquipped) return
            if (isOwned) void equip(item)
            else {
              purchaseTriggerRef.current = event.currentTarget
              setDialogError('')
              setRetrySameRequest(false)
              setSelected(item)
            }
          }}>{savedEquipped ? '장착됨' : isOwned ? '장착하기' : shortages.length ? '잔액 부족' : '구매하기'}</button></div>
        </article>
      })}
    </div>
    {selected && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="character-purchase-title" aria-describedby={`character-purchase-description${dialogError ? ' character-purchase-error' : ''}`} onKeyDown={handleDialogKeyDown}>
        <h2 id="character-purchase-title">{selected.name} 구매 확인</h2>
        <p id="character-purchase-description">아래 마을 화폐가 차감되며 구매 직후 바로 장착됩니다.</p>
        <VillageCostVector cost={selected.cost} balances={economy.balances} showExpected/>
        {dialogError && <p id="character-purchase-error" className={styles.dialogError} role="alert">{dialogError}</p>}
        <div><button type="button" disabled={pending} onClick={closeDialog}>취소</button><button ref={dialogPrimaryRef} type="button" disabled={pending} onClick={buy}>{pending ? '처리 중…' : retrySameRequest ? '같은 요청 재시도' : '구매하고 장착'}</button></div>
      </section>
    </div>}
  </section>
}
