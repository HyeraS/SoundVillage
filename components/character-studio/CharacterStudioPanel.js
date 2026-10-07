'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveWorldCharacterLayers, WORLD_CHARACTER } from '@/components/AssetRegistry'
import VillageCostVector, { villageShortages } from '@/components/economy-v1/VillageCostVector'
import VillageWalletBar from '@/components/economy-v1/VillageWalletBar'
import { villageKoreanName } from '@/components/economy-v1/VillageCurrencyIcon'
import { BASIC_CHARACTER_ITEM } from '@/lib/characterStudioCatalog'
import {
  characterLoadoutsEqual,
  characterStudioAction,
  effectiveCharacterLoadout,
  normalizeCharacterLoadout,
  previewCharacterItem,
} from '@/lib/characterStudioState.mjs'
import { trackEvent } from '@/lib/userEvents'
import styles from './characterStudio.module.css'
import CharacterStudioOnboarding from './CharacterStudioOnboarding'

/* eslint-disable @next/next/no-img-element -- exact sprite-sheet clipping must match the world renderer */

const COMMERCE_TABS = Object.freeze(['outfit', 'accessory'])
const IDENTITY_TABS = Object.freeze(['identity', 'outfit', 'accessory'])
const DIRECTIONS = Object.freeze([
  ['down', '앞'], ['left', '왼쪽'], ['up', '뒤'], ['right', '오른쪽'],
])
const FOCUSABLE_SELECTOR = 'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'

function CharacterStage({ loadout, outfit, accessory, direction, frame }) {
  const layers = resolveWorldCharacterLayers({
    ...loadout,
    outfitSrc: outfit?.runtimeAsset || BASIC_CHARACTER_ITEM.runtimeAsset,
    accessorySrc: accessory?.runtimeAsset,
  })
  const row = WORLD_CHARACTER.rows[direction] ?? WORLD_CHARACTER.rows.down
  const column = WORLD_CHARACTER.cols[frame % WORLD_CHARACTER.cols.length]
  const scale = 5.5
  return <div
    className={styles.characterStage}
    data-testid="character-studio-preview"
    aria-label={`${direction === 'down' ? '앞' : direction === 'up' ? '뒤' : direction === 'left' ? '왼쪽' : '오른쪽'}을 보는 ${outfit?.name || '기본 의상'}, ${accessory?.name || '액세서리 미착용'} 캐릭터 미리보기`}
  >
    <div className={styles.sprite}>
      {layers.map((layer, index) => <img
        key={`${layer.src}-${index}`}
        src={layer.src}
        alt=""
        draggable={false}
        data-character-layer={index}
        data-layer-kind={layer.kind || ['skin', 'outfit', 'hair', 'accessory'][index]}
        data-layer-src={layer.src}
        style={{
          position:'absolute',
          left:-column * WORLD_CHARACTER.frame * scale,
          top:-row * WORLD_CHARACTER.frame * scale,
          width:layer.sheetW * scale,
          height:layer.sheetH * scale,
          maxWidth:'none',
          imageRendering:'pixelated',
          pointerEvents:'none',
        }}
      />)}
    </div>
    <span className={styles.stageShadow}/>
  </div>
}

function IdentitySelectionGroup({ legend, slot, selectedId, savedId, items, onPreview, testId }) {
  return <fieldset className={styles.identityGroup} data-testid={testId}>
    <legend>{legend}</legend>
    <div className={styles.identityOptions}>
      {items.map((item) => <button
        key={item.id}
        type="button"
        disabled={!item.available}
        aria-pressed={selectedId === item.id}
        aria-label={`${item.name}${savedId === item.id ? ', 저장값' : ''}`}
        title={!item.available ? item.unavailableReason : undefined}
        data-testid={`identity-option-${item.id}`}
        onClick={() => onPreview(slot, item.id, item)}
      >
        {item.previewAsset && <Image src={item.previewAsset} width={48} height={48} unoptimized alt=""/>}
        <span>{item.name}</span>
        <small>{savedId === item.id ? '저장값' : selectedId === item.id ? '임시 선택' : '무료'}</small>
      </button>)}
    </div>
  </fieldset>
}

function BasicPreview() {
  const layers = resolveWorldCharacterLayers()
  return <span className={styles.basicPreview} aria-hidden="true">
    {layers.map((layer, index) => <span key={layer.src} style={{ backgroundImage:`url(${layer.src})`, zIndex:index }}/>) }
  </span>
}

function legacyShortage(item, legacyBalance) {
  const price = Number(item.legacyPrice || 0)
  return Math.max(0, price - Number(legacyBalance || 0))
}

function itemErrorMessage(result, kind) {
  if (result?.code === 'item_not_owned') return '보유한 상품만 장착할 수 있어요.'
  if (result?.code === 'insufficient_funds') return '화폐가 부족해요. 잔액을 확인해 주세요.'
  if (result?.code === 'official_store_unapproved') return '현재 판매가 중단된 상품이에요.'
  if (result?.code === 'idempotency_key_reused') return '요청 상태를 다시 확인했어요. 새 요청으로 다시 시도해 주세요.'
  if (result?.retryable) return `저장 응답을 확인하지 못했어요. ${kind === 'purchase' ? '같은 구매 요청으로 ' : ''}안전하게 다시 시도할 수 있어요.`
  return kind === 'purchase' ? '구매하지 못했어요. 상태를 확인한 뒤 다시 시도해 주세요.' : '장착을 저장하지 못했어요. 다시 시도하거나 원래대로 돌아갈 수 있어요.'
}

export default function CharacterStudioPanel({
  environment = 'cutover',
  items = [],
  balances = {},
  legacyBalance = 0,
  savedLoadout,
  ownedItemIds = [],
  status = 'ready',
  loadError = '',
  onRetry,
  onPurchaseAndEquip,
  onEquip,
  identityPreviewEnabled = false,
  identityCatalog = null,
  onSaveIdentity,
  showOnboarding = false,
}) {
  const identityEnabled = ['qa', 'cutover'].includes(environment) && identityPreviewEnabled && Boolean(identityCatalog)
  const identityIsLocalOnly = environment === 'qa'
  const tabs = identityEnabled ? IDENTITY_TABS : COMMERCE_TABS
  const normalizedSaved = normalizeCharacterLoadout(savedLoadout)
  const [previewLoadout, setPreviewLoadout] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [tab, setTab] = useState('outfit')
  const [direction, setDirection] = useState('down')
  const [frame, setFrame] = useState(0)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState(null)
  const [purchaseItem, setPurchaseItem] = useState(null)
  const [dialogError, setDialogError] = useState('')
  const [retrySameRequest, setRetrySameRequest] = useState(false)
  const [identityRetrySameRequest, setIdentityRetrySameRequest] = useState(false)
  const mountedRef = useRef(true)
  const actionInFlightRef = useRef(false)
  const dialogRef = useRef(null)
  const primaryRef = useRef(null)
  const purchaseTriggerRef = useRef(null)
  const tabRefs = useRef(new Map())

  const allItems = useMemo(() => [BASIC_CHARACTER_ITEM, ...items], [items])
  const itemMap = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])
  const owned = useMemo(() => new Set(['basic', ...ownedItemIds]), [ownedItemIds])
  const effectiveLoadout = effectiveCharacterLoadout(normalizedSaved, previewLoadout)
  const previewing = previewLoadout !== null && !characterLoadoutsEqual(normalizedSaved, previewLoadout)
  const identityPreviewing = previewLoadout !== null && ['skinId', 'eyesId', 'hairStyleId', 'hairColorId']
    .some((key) => normalizedSaved[key] !== effectiveLoadout[key])
  const outfit = itemMap.get(effectiveLoadout.outfitId) || BASIC_CHARACTER_ITEM
  const accessory = effectiveLoadout.accessoryId ? itemMap.get(effectiveLoadout.accessoryId) : null
  const selectedItem = selectedItemId ? itemMap.get(selectedItemId) : null
  const selectedIdentity = identityCatalog && selectedItemId
    ? [...identityCatalog.skins, ...identityCatalog.hairStyles, ...identityCatalog.hairColors, ...identityCatalog.eyes].find((item) => item.id === selectedItemId)
    : null
  const selectedName = selectedItemId === 'none' ? '액세서리 미착용' : selectedItem?.name || selectedIdentity?.name
  const visibleItems = tab === 'outfit'
    ? [BASIC_CHARACTER_ITEM, ...items.filter((item) => item.productGroup === 'outfit')]
    : items.filter((item) => item.productGroup === 'accessory')
  const outfitCount = items.filter((item) => item.productGroup === 'outfit').length
  const accessoryCount = items.filter((item) => item.productGroup === 'accessory').length
  const identityNameMaps = useMemo(() => identityCatalog ? ({
    skin:new Map(identityCatalog.skins.map((item) => [item.id, item.name])),
    eyes:new Map(identityCatalog.eyes.map((item) => [item.id, item.name])),
    hairStyle:new Map(identityCatalog.hairStyles.map((item) => [item.id, item.name])),
    hairColor:new Map(identityCatalog.hairColors.map((item) => [item.id, item.name])),
  }) : null, [identityCatalog])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    const interval = window.setInterval(() => setFrame((value) => (value + 1) % WORLD_CHARACTER.cols.length), 120)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (!purchaseItem) return undefined
    const animation = window.requestAnimationFrame(() => primaryRef.current?.focus())
    return () => window.cancelAnimationFrame(animation)
  }, [purchaseItem])

  const preview = (slot, itemId, item = null) => {
    setPreviewLoadout((current) => previewCharacterItem(normalizedSaved, current, slot, itemId))
    setSelectedItemId(item?.id || (itemId === null ? 'none' : itemId))
    setNotice(null)
    if (['skin', 'eyes', 'hairStyle', 'hairColor'].includes(slot)) setIdentityRetrySameRequest(false)
    trackEvent('character_item_previewed', {
      target_type:'catalog_item', target_id:itemId || 'none',
      metadata:{ product_group:slot, studio_environment:environment },
    })
    trackEvent('shop_item_viewed', {
      target_type:'catalog_item', target_id:itemId || 'none',
      metadata:{ product_group:slot, studio_environment:environment },
    })
  }

  const resetPreview = () => {
    setPreviewLoadout(null)
    setSelectedItemId(null)
    setIdentityRetrySameRequest(false)
    setNotice({ kind:'status', text:'저장된 착용 상태로 돌아갔어요.' })
  }

  const closeDialog = () => {
    if (actionInFlightRef.current) return
    const trigger = purchaseTriggerRef.current
    setPurchaseItem(null)
    setDialogError('')
    setRetrySameRequest(false)
    window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus())
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
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  const runEquip = async (item, slot = item?.productGroup, itemId = item?.id ?? null) => {
    if (actionInFlightRef.current || status !== 'ready') return
    actionInFlightRef.current = true
    setPending(true)
    setNotice(null)
    let result
    try {
      result = await onEquip?.(slot, itemId, item)
    } catch {
      result = { ok:false, code:'storage_retryable', retryable:true }
    } finally {
      actionInFlightRef.current = false
      if (mountedRef.current) setPending(false)
    }
    if (!mountedRef.current) return
    if (!result?.ok) {
      setNotice({ kind:'error', text:itemErrorMessage(result, 'equip') })
      return
    }
    setPreviewLoadout(null)
    setSelectedItemId(item?.id || null)
    setNotice({ kind:'status', text:item ? `${item.name} 장착을 저장했어요.` : '액세서리 미착용 상태를 저장했어요.' })
  }

  const runPurchase = async () => {
    const item = purchaseItem
    if (!item || actionInFlightRef.current || status !== 'ready') return
    actionInFlightRef.current = true
    setPending(true)
    setDialogError('')
    let result
    try {
      result = await onPurchaseAndEquip?.(item)
    } catch {
      result = { ok:false, code:'storage_retryable', retryable:true }
    } finally {
      actionInFlightRef.current = false
      if (mountedRef.current) setPending(false)
    }
    if (!mountedRef.current) return
    if (!result?.ok) {
      const message = itemErrorMessage(result, 'purchase')
      setDialogError(message)
      setRetrySameRequest(Boolean(result?.retrySameRequest || result?.retryable))
      setNotice({ kind:'error', text:message })
      return
    }
    setPurchaseItem(null)
    setDialogError('')
    setRetrySameRequest(false)
    if (result.equip?.ok === false) {
      setNotice({ kind:'error', text:'구매는 완료됐지만 장착 저장을 확인하지 못했어요. 미리보기를 유지했으니 다시 장착해 주세요.' })
    } else {
      setPreviewLoadout(null)
      setNotice({ kind:'status', text:`${item.name} 구매 및 장착을 완료했어요.` })
    }
    const trigger = purchaseTriggerRef.current
    let focusAttempts = 0
    const restorePurchaseFocus = () => {
      if (trigger?.isConnected && !trigger.disabled) {
        trigger.focus()
        return
      }
      const fallback = document.querySelector(`[data-testid="studio-item-${item.id}"] button:not(:disabled)`)
      if (fallback) {
        fallback.focus()
        return
      }
      focusAttempts += 1
      if (focusAttempts < 4) window.requestAnimationFrame(restorePurchaseFocus)
    }
    window.requestAnimationFrame(restorePurchaseFocus)
  }

  const saveIdentityPreview = async () => {
    if (!identityEnabled || !identityPreviewing || actionInFlightRef.current) return
    actionInFlightRef.current = true
    setPending(true)
    setNotice(null)
    let result
    try {
      result = await onSaveIdentity?.(effectiveLoadout)
    } catch {
      result = { ok:false, code:'storage_retryable', retryable:true }
    } finally {
      actionInFlightRef.current = false
      if (mountedRef.current) setPending(false)
    }
    if (!mountedRef.current) return
    if (!result?.ok) {
      setIdentityRetrySameRequest(Boolean(result?.retrySameRequest || result?.retryable))
      setNotice({
        kind:'error',
        text:result?.code === 'idempotency_key_reused'
          ? '저장 상태를 다시 확인했어요. 외형을 확인한 뒤 새 요청으로 저장해 주세요.'
          : result?.retryable
            ? '저장 응답을 확인하지 못했어요. 같은 요청으로 안전하게 다시 시도할 수 있어요.'
            : identityIsLocalOnly ? 'QA 로컬 외형 상태를 저장하지 못했어요.' : '외형을 저장하지 못했어요. 선택한 미리보기는 유지됩니다.',
      })
      return
    }
    setPreviewLoadout(null)
    setSelectedItemId(null)
    setIdentityRetrySameRequest(false)
    setNotice({
      kind:'status',
      text:identityIsLocalOnly
        ? 'QA 로컬 외형 상태로 저장했어요. 실제 DB에는 저장되지 않았어요.'
        : '외형을 저장했어요. 현재 캐릭터에 바로 적용됐어요.',
    })
  }

  const chooseTab = (nextTab, focus = false) => {
    setTab(nextTab)
    if (focus) window.requestAnimationFrame(() => tabRefs.current.get(nextTab)?.focus())
  }

  const handleTabKeyDown = (event) => {
    const index = tabs.indexOf(tab)
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === null) return
    event.preventDefault()
    chooseTab(tabs[next], true)
  }

  return <section
    className={styles.panel}
    aria-label="캐릭터 스타일 스튜디오"
    data-testid="character-studio"
    data-studio-environment={environment}
    data-studio-state={status}
    data-preview-active={previewing ? 'true' : 'false'}
  >
    <CharacterStudioOnboarding enabled={showOnboarding}/>
    <header className={styles.header}>
      <div><small>CHARACTER STYLE STUDIO</small><h2>내 캐릭터 스타일링</h2></div>
      {environment === 'qa' && <span className={styles.qaBadge} data-testid="studio-qa-notice">QA dry-run · 실제 저장 없음</span>}
      {environment === 'legacy' && <span className={styles.environmentBadge}>기존 경제</span>}
    </header>

    {status === 'loading' && <div className={styles.statePanel} role="status">상품과 착용 정보를 불러오는 중이에요…</div>}
    {status === 'error' && <div className={styles.statePanel} role="alert" data-testid="studio-load-error">
      <strong>스타일 스튜디오를 불러오지 못했어요.</strong>
      <p>{loadError || '연결을 확인한 뒤 다시 시도해 주세요.'}</p>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div>}

    {status === 'ready' && <div className={styles.layout}>
      <aside className={styles.previewPane} aria-label="착용 미리보기">
        <div className={styles.previewHeading}>
          <div><span>{previewing ? '임시 미리보기' : '현재 저장된 상태'}</span><strong>{selectedName || outfit.name}</strong></div>
          <i className={previewing ? styles.previewBadge : styles.savedBadge}>{previewing ? '저장 안 됨' : '저장됨'}</i>
        </div>
        <CharacterStage loadout={effectiveLoadout} outfit={outfit} accessory={accessory} direction={direction} frame={frame}/>
        <div className={styles.directionButtons} role="group" aria-label="캐릭터 방향 선택">
          {DIRECTIONS.map(([value, label]) => <button key={value} type="button" aria-pressed={direction === value} aria-label={`${label} 보기`} onClick={() => setDirection(value)}>{label}</button>)}
        </div>
        <dl className={styles.loadoutSummary}>
          {identityEnabled && <div><dt>피부</dt><dd>{identityNameMaps.skin.get(effectiveLoadout.skinId)}</dd></div>}
          {identityEnabled && <div><dt>헤어</dt><dd>{identityNameMaps.hairStyle.get(effectiveLoadout.hairStyleId)} · {identityNameMaps.hairColor.get(effectiveLoadout.hairColorId)}</dd></div>}
          {identityEnabled && <div><dt>눈</dt><dd>{identityNameMaps.eyes.get(effectiveLoadout.eyesId)}</dd></div>}
          <div><dt>의상</dt><dd>{outfit.name}</dd></div>
          <div><dt>액세서리</dt><dd>{accessory?.name || '미착용'}</dd></div>
        </dl>
        <p className={styles.layerNote}>피부/몸 → 눈 → 의상 → 헤어 → 액세서리</p>
        <button className={styles.resetButton} type="button" disabled={!previewing || pending} onClick={resetPreview}>저장된 상태로 원래대로</button>
      </aside>

      <section className={styles.catalogPane} aria-label="스타일 상품">
          {tab === 'identity'
          ? <div className={styles.freeIdentityNotice}>{identityIsLocalOnly ? '무료 외형 QA 미리보기 · 네트워크 요청 및 실제 저장 없음' : '무료 기본 외형 · 저장해도 화폐가 차감되지 않아요'}</div>
          : environment === 'legacy'
          ? <div className={styles.legacyWallet} aria-label={`보유 화폐 ${legacyBalance}개`}><span>보유 화폐</span><strong>🪙 {Number(legacyBalance).toLocaleString('ko-KR')}</strong></div>
          : <VillageWalletBar balances={balances}/>
        }
        {notice && <p className={notice.kind === 'error' ? styles.errorNotice : styles.notice} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{notice.text}</p>}
        <div className={styles.tabs} role="tablist" aria-label="상품 종류" onKeyDown={handleTabKeyDown}>
          {tabs.map((value) => <button
            key={value}
            ref={(node) => { if (node) tabRefs.current.set(value, node) }}
            id={`character-studio-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`character-studio-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => chooseTab(value)}
          >{value === 'identity' ? '기본 외형' : value === 'outfit' ? `의상 ${outfitCount + 1}` : `액세서리 ${accessoryCount}`}</button>)}
        </div>

        <div id={`character-studio-panel-${tab}`} className={styles.productScroll} role="tabpanel" aria-labelledby={`character-studio-tab-${tab}`} tabIndex={0}>
          {tab === 'identity' && identityEnabled && <div className={styles.identityPanel} data-testid="identity-customization-panel">
            <p className={styles.identityStatus} aria-live="polite">{identityIsLocalOnly
              ? '각 선택은 임시 미리보기입니다. “QA 상태로 저장”을 눌러도 이 브라우저 세션에만 남습니다.'
              : '각 선택은 왼쪽 미리보기에만 반영됩니다. “외형 저장”을 눌러야 게임 캐릭터에 적용됩니다.'}</p>
            <IdentitySelectionGroup legend="피부색" slot="skin" selectedId={effectiveLoadout.skinId} savedId={normalizedSaved.skinId} items={identityCatalog.skins} onPreview={preview} testId="identity-skins"/>
            <IdentitySelectionGroup legend="헤어 스타일" slot="hairStyle" selectedId={effectiveLoadout.hairStyleId} savedId={normalizedSaved.hairStyleId} items={identityCatalog.hairStyles} onPreview={preview} testId="identity-hair-styles"/>
            <IdentitySelectionGroup legend="헤어 색상" slot="hairColor" selectedId={effectiveLoadout.hairColorId} savedId={normalizedSaved.hairColorId} items={identityCatalog.hairColors} onPreview={preview} testId="identity-hair-colors"/>
            <IdentitySelectionGroup legend="눈 색상" slot="eyes" selectedId={effectiveLoadout.eyesId} savedId={normalizedSaved.eyesId} items={identityCatalog.eyes} onPreview={preview} testId="identity-eyes"/>
            <button className={styles.identitySave} data-testid="identity-save" type="button" disabled={!identityPreviewing || pending} onClick={() => void saveIdentityPreview()}>{pending ? '저장 중…' : identityIsLocalOnly ? 'QA 상태로 저장 · 실제 저장 없음' : identityRetrySameRequest ? '같은 요청 재시도' : '외형 저장'}</button>
          </div>}
          {tab !== 'identity' && <>
          {tab === 'accessory' && <article className={`${styles.card} ${effectiveLoadout.accessoryId === null ? styles.previewedCard : ''}`} data-testid="studio-item-none">
            <button className={styles.cardPreview} type="button" aria-label="액세서리 미착용 미리보기" aria-pressed={effectiveLoadout.accessoryId === null} onClick={() => preview('accessory', null)}>
              <span className={styles.noneVisual} aria-hidden="true">∅</span>
            </button>
            <div className={styles.cardBody}><div><strong>액세서리 미착용</strong><span>{normalizedSaved.accessoryId === null ? '저장된 상태' : '미리보기 가능'}</span></div>
              <button type="button" disabled={pending || normalizedSaved.accessoryId === null} onClick={() => { preview('accessory', null); void runEquip(null, 'accessory', null) }}>{normalizedSaved.accessoryId === null ? '미착용 중' : '미착용으로 저장'}</button>
            </div>
          </article>}
          {visibleItems.length === 0 && <p className={styles.emptyState}>{environment === 'legacy' ? '기존 경제에서는 액세서리 저장을 아직 지원하지 않아요.' : '표시할 상품이 없어요.'}</p>}
          <div className={styles.grid}>
            {visibleItems.map((item) => {
              const key = item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId'
              const isOwned = owned.has(item.id)
              const equipped = normalizedSaved[key] === item.id
              const previewed = effectiveLoadout[key] === item.id
              const action = characterStudioAction({ owned:isOwned, equipped })
              const shortages = environment === 'legacy' ? [] : villageShortages(item.cost || {}, balances)
              const legacyMissing = environment === 'legacy' ? legacyShortage(item, legacyBalance) : 0
              const cannotBuy = !isOwned && (shortages.length > 0 || legacyMissing > 0)
              const shortageText = environment === 'legacy'
                ? legacyMissing > 0 ? `화폐 ${legacyMissing}개 부족` : ''
                : shortages.map(({ village, shortage }) => `${villageKoreanName(village)} ${shortage} 부족`).join(', ')
              return <article className={`${styles.card} ${equipped ? styles.equippedCard : ''} ${previewed ? styles.previewedCard : ''}`} data-testid={`studio-item-${item.id}`} key={item.id}>
                <button className={styles.cardPreview} type="button" onClick={() => preview(item.productGroup, item.id, item)} aria-label={`${item.name} 착용 미리보기`} aria-pressed={previewed}>
                  {item.previewAsset ? <Image src={item.previewAsset} width={96} height={96} unoptimized alt=""/> : <BasicPreview/>}
                  <span className={styles.stateBadge}>{equipped ? '장착됨' : previewed && previewing ? '미리보기' : isOwned ? '보유' : '미보유'}</span>
                </button>
                <div className={styles.cardBody}>
                  <div><strong>{item.name}</strong><span>{isOwned ? '보유 중' : '구매 전 미리보기 가능'}</span></div>
                  {item.id !== 'basic' && (environment === 'legacy'
                    ? <p className={styles.legacyPrice}>🪙 {item.legacyPrice}{legacyMissing > 0 && <small>{legacyMissing}개 부족</small>}</p>
                    : <VillageCostVector cost={item.cost} balances={balances}/>)}
                  <button
                    type="button"
                    data-testid={`studio-action-${item.id}`}
                    disabled={pending || equipped || cannotBuy}
                    aria-label={cannotBuy ? `${item.name} 구매 불가: ${shortageText}` : undefined}
                    title={shortageText || undefined}
                    onClick={(event) => {
                      preview(item.productGroup, item.id, item)
                      if (action === 'equipped') return
                      if (action === 'equip') void runEquip(item)
                      else {
                        purchaseTriggerRef.current = event.currentTarget
                        setPurchaseItem(item)
                        setDialogError('')
                        setRetrySameRequest(false)
                      }
                    }}
                  >{equipped ? '장착됨' : isOwned ? '장착 저장' : cannotBuy ? '화폐 부족' : '구매'}</button>
                </div>
              </article>
            })}
          </div>
          </>}
        </div>
      </section>
    </div>}

    {purchaseItem && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="studio-purchase-title" aria-describedby={`studio-purchase-description${dialogError ? ' studio-purchase-error' : ''}`} onKeyDown={handleDialogKeyDown}>
        <span className={styles.dialogEyebrow}>구매 확인</span>
        <h2 id="studio-purchase-title">{purchaseItem.name}</h2>
        <p id="studio-purchase-description">지금 왼쪽 캐릭터가 이 상품을 미리 착용하고 있어요. 아래 화폐를 차감하며, 구매 후 바로 장착됩니다.</p>
        {environment === 'legacy'
          ? <div className={styles.dialogLegacyPrice}>차감될 화폐 <strong>🪙 {purchaseItem.legacyPrice}</strong></div>
          : <VillageCostVector cost={purchaseItem.cost} balances={balances} showExpected/>}
        {dialogError && <p id="studio-purchase-error" className={styles.dialogError} role="alert">{dialogError}</p>}
        <div className={styles.dialogActions}>
          <button type="button" disabled={pending} onClick={closeDialog}>취소</button>
          <button ref={primaryRef} type="button" disabled={pending} onClick={() => void runPurchase()}>{pending ? '처리 중…' : retrySameRequest ? '같은 요청으로 재시도' : '구매하고 장착'}</button>
        </div>
      </section>
    </div>}
  </section>
}
