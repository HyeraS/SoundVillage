'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { playSound, pauseSound, resumeSound, isSoundPaused, getCurrentTime, getListeningTime, resetAudio, resetListeningTime } from '@/lib/audioManager'
import { getCandidateExpressions, saveVote } from '@/lib/supabase'
import { getCurrencyBalance, getTotalEarned, getOwnedOutfits, getEquippedOutfit, setEquippedOutfit, purchaseOutfit } from '@/lib/currency'
import { newOperationKey } from '@/lib/persistenceResult'
import { SHOP_PRODUCTS, getDailyDeal, getEffectivePrice, getShopGrowthTier, DEFAULT_OUTFIT_ID } from '@/lib/shopCatalog'
import { ZONE_META } from '@/components/GameEngine'
import LibraryRoom from '@/components/LibraryRoom'
import { trackEvent } from '@/lib/userEvents'

/* ─────────────────────────────────────────────
   동의 정도 슬라이더 라벨 (1~5)
───────────────────────────────────────────── */
const CONFIDENCE_LABELS = ['매우 약함', '약함', '보통', '강한 동의', '매우동의']
const MINI_WAVE_HEIGHTS = Array.from(
  { length: 30 },
  (_, index) => 15 + ((index * 41 + 17) % 72),
)

/* ─────────────────────────────────────────────
   Zone NPC
───────────────────────────────────────────── */
const ZONE_NPC = {
  Animal: { emoji:'🦉', name:'Ollie',  lines:['동물들이 내는 소리는 저마다 이야기를 품고 있어요.', '어떤 표현이 이 소리와 가장 잘 어울리나요? 🐾'] },
  Human:  { emoji:'👤', name:'Sam',    lines:['사람이 만들어내는 소리는 정말 다양하죠.', '이 소리를 듣고 어떤 느낌이 드나요? 👣'] },
  Nature: { emoji:'🐸', name:'Ripple', lines:['물소리처럼 표현도 자연스럽게 흘러가야 해요.', '자연의 소리를 언어로 담아봐요! 💧'] },
  Urban:  { emoji:'🦜', name:'Metro',  lines:['도시의 소음도 누군가에겐 음악이에요.', '가장 도시다운 표현을 골라봐요 🏙'] },
  Music:  { emoji:'🎵', name:'Aria',   lines:['무대의 소리를 언어로 옮겨봐요!', '어떤 표현이 가장 공명하나요? 🎶'] },
  Lab:    { emoji:'🤖', name:'ECHO',   lines:['데이터 분석 중… 최적 표현을 선택하세요.', '미지의 소리에 이름을 붙여봐요 ⚡'] },
}

/* ─────────────────────────────────────────────
   간단한 오디오 훅 (뮤지엄용 — 세그먼트 없음)
───────────────────────────────────────────── */
function useMuseumPlayer(filePath, eventContext) {
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [error,     setError]     = useState('')
  const durRef    = useRef(null)
  const pausedRef = useRef(false)   // pause 상태 추적 (언로드 없이 재개 가능)
  const pollRef   = useRef(null)

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPoll = useCallback(() => {
    clearPoll()
    pollRef.current = setInterval(() => {
      const pos = getCurrentTime()
      if (pos !== null && durRef.current) setProgress(Math.min(pos / durRef.current, 1))
    }, 100)
  }, [clearPoll])

  // filePath 바뀌면 재생 상태 초기화
  useEffect(() => {
    let cancelled = false
    resetAudio()
    clearPoll()
    pausedRef.current = false
    durRef.current = null
    Promise.resolve().then(() => {
      if (cancelled) return
      setPlaying(false)
      setProgress(0)
      setPlayCount(0)
      setError('')
    })
    return () => { cancelled = true }
  }, [filePath, clearPoll])

  const toggle = useCallback(async () => {
    // 재생 중 → 일시정지 (언로드 없이)
    if (playing) {
      trackEvent('audio_paused', eventContext)
      pauseSound()
      clearPoll()
      pausedRef.current = true
      setPlaying(false)
      return
    }

    // 일시정지 상태 → 재개 (재다운로드 없음)
    if (pausedRef.current && isSoundPaused()) {
      trackEvent('audio_resumed', eventContext)
      resumeSound()
      pausedRef.current = false
      setPlaying(true)
      startPoll()
      return
    }

    // 첫 재생 or 종료 후 재시작
    setError('')
    pausedRef.current = false
    trackEvent('museum_audio_play_attempted', eventContext)
    try {
      const dur = await playSound(filePath, {
        onEnd: () => {
          clearPoll(); pausedRef.current = false; setPlaying(false); setProgress(1)
          trackEvent('audio_completed', { ...eventContext, outcome: 'succeeded' })
        },
      })
      durRef.current = dur
      setPlaying(true)
      setPlayCount(c => c + 1)
      trackEvent('museum_audio_play_started', { ...eventContext, outcome: 'succeeded' })
      startPoll()
    } catch {
      setError('오디오를 불러올 수 없어요.')
      trackEvent('museum_audio_failed', { ...eventContext, outcome: 'failed', error_code: 'audio_load_failed' })
    }
  }, [playing, filePath, clearPoll, startPoll, eventContext])

  useEffect(() => () => { clearPoll(); resetAudio() }, [clearPoll])
  const getDuration = useCallback(() => durRef.current, [])
  return { playing, progress, playCount, error, toggle, getDuration }
}

/* ─────────────────────────────────────────────
   미니 파형 바
───────────────────────────────────────────── */
function MiniWave({ progress, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '32px', margin: '8px 0' }}>
      {MINI_WAVE_HEIGHTS.map((h, i) => {
        const filled = (i + 0.5) / MINI_WAVE_HEIGHTS.length <= progress
        return (
          <div key={i} style={{
            flex: 1, height: `${h}%`, borderRadius: '2px',
            background: filled ? accent : `${accent}28`,
            transition: 'background 0.08s',
          }}/>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────
   전시 현황: Zone별 진열장. count/total 비율만큼 슬롯이
   채워진 동물의 숲 박물관 스타일. 완전 읽기 전용 — zoneCounts는
   부모(app/page.js)가 이미 하던 zoneProgress 계산에서 분자/분모를
   함께 흘려보낸 것뿐, 여기서 새 쿼리를 만들지 않는다.
───────────────────────────────────────────── */
function DisplayCase({ zone, collected, total }) {
  const meta = ZONE_META[zone] || { color: '#9B6DD4', emoji: '?', label: zone }
  const visited = collected > 0
  const complete = total > 0 && collected >= total
  const slots = Math.max(total, 1)
  return (
    <div style={{
      background: '#F0EBE0', borderRadius: '14px', padding: '14px',
      border: `1.5px solid ${meta.color}${complete ? '' : '33'}`,
      boxShadow: complete ? `0 0 0 2px ${meta.color}55, 0 4px 16px ${meta.color}33` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
          background: `${meta.color}22`, border: `1.5px solid ${meta.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
          opacity: visited ? 1 : 0.5,
        }}>{meta.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: visited ? '#2A1F0E' : '#8B6A3A' }}>
            {meta.label}{!visited && <span style={{ fontWeight: 600, color: '#A09080' }}> · 아직 탐험 안 한 곳</span>}
          </div>
          <div style={{ fontSize: '10px', color: '#8B6A3A', fontVariantNumeric: 'tabular-nums' }}>
            {collected}/{total}{complete ? ' · 완전 전시! ✨' : ''}
          </div>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9px, 1fr))',
        gap: '2px', maxWidth: '100%',
      }}>
        {Array.from({ length: slots }, (_, i) => {
          const filled = i < collected
          return (
            <div key={i} title={filled ? '수집 완료' : '빈 슬롯'} style={{
              aspectRatio: '1', borderRadius: '2px',
              background: filled ? meta.color : '#00000012',
              border: filled ? 'none' : `1px solid ${meta.color}22`,
              opacity: filled ? 0.9 : 1,
            }}/>
          )
        })}
      </div>
    </div>
  )
}

function ExhibitDisplay({ zoneCounts, accent }) {
  const zones = Object.keys(ZONE_META)
  return (
    <div style={{
      position: 'relative', zIndex: 10,
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#FAF6EE', borderRadius: '20px',
      boxShadow: `0 10px 60px #00000077, 0 0 0 1px ${accent}44`,
      scrollbarWidth: 'none',
    }}>
      <div style={{
        position: 'sticky', top: 0,
        background: `linear-gradient(135deg, ${accent}1A, ${accent}08)`,
        borderBottom: `1px solid ${accent}28`, padding: '16px 20px 12px',
        borderRadius: '20px 20px 0 0',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 800, color: accent, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          LIBRARY COLLECTION
        </div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#2A1F0E' }}>🏺 전시 현황</div>
      </div>
      <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {zones.map(z => (
          <DisplayCase key={z} zone={z} collected={zoneCounts?.[z]?.collected ?? 0} total={zoneCounts?.[z]?.total ?? 0}/>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   상점: Character v.2 outfit 판매. body/head 고정, clothes
   레이어만 교체. 가격은 lib/shopCatalog.SHOP_PRODUCTS 단일 출처.
───────────────────────────────────────────── */
function ShopGrowthDecor({ tierKey }) {
  // 시각 효과만 — 구매 가능 여부와 완전 무관. 단계가 올라갈수록 장식이 늘어난다.
  const icons = { seed: ['🪵'], sprout: ['🪵','🕯','🪴'], bloom: ['🪵','🕯','🪴','🏮','✨'] }[tierKey] || ['🪵']
  return (
    <div style={{ display: 'flex', gap: '6px', position: 'absolute', top: '10px', right: '16px', fontSize: '14px', opacity: 0.7 }}>
      {icons.map((e, i) => <span key={i}>{e}</span>)}
    </div>
  )
}

function Shop({ participantId, accent, onCurrencyChange }) {
  const [balance,       setBalance]       = useState(0)
  const [ownedOutfits,  setOwnedOutfits]  = useState([])
  const [equipped,      setEquipped]      = useState(null)
  const [totalEarned,   setTotalEarned]   = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [purchasingId,  setPurchasingId]  = useState(null)
  const [equippingId,   setEquippingId]   = useState(null)
  const [notice,        setNotice]        = useState('')
  const purchaseKeys = useRef(new Map())
  const equipKey = useRef(null)
  const purchaseInFlightRef = useRef(false)
  const equipInFlightRef = useRef(false)

  const dailyDeal = getDailyDeal()
  const tier = getShopGrowthTier(totalEarned)

  const refresh = useCallback(async () => {
    const [bal, owned, eq, earned] = await Promise.all([
      getCurrencyBalance(participantId),
      getOwnedOutfits(participantId),
      getEquippedOutfit(participantId),
      getTotalEarned(participantId),
    ])
    setBalance(bal)
    setOwnedOutfits(owned)
    setEquipped(eq)
    setTotalEarned(earned)
    setLoading(false)
  }, [participantId])

  useEffect(() => {
    const timeoutId = setTimeout(refresh, 0)
    return () => clearTimeout(timeoutId)
  }, [refresh])
  const handleBuy = async (product) => {
    if (purchaseInFlightRef.current) return
    purchaseInFlightRef.current = true
    const price = getEffectivePrice(product, dailyDeal)
    setPurchasingId(product.id)
    setNotice('')
    const idempotencyKey = purchaseKeys.current.get(product.id) || newOperationKey()
    purchaseKeys.current.set(product.id, idempotencyKey)
    trackEvent('purchase_attempted', {
      target_type: 'outfit', target_id: product.id, operation_type: 'purchase:outfit', operation_idempotency_key: idempotencyKey,
      metadata: { item_type: 'outfit', price_displayed: price, balance },
    }, { critical: true })
    try {
      const result = await purchaseOutfit({ outfitId: product.id, idempotencyKey })
      if (result.ok) {
        trackEvent('purchase_succeeded', {
          target_type: 'outfit', target_id: product.id, outcome: 'succeeded', operation_type: result.operationType,
          operation_idempotency_key: result.idempotencyKey, result_entity_type: 'outfit', result_entity_id: product.id,
          metadata: { price_displayed: price, price_confirmed: price, balance: result.newBalance, transaction_id: result.transactionId },
        }, { critical: true, flush: true })
        purchaseKeys.current.delete(product.id)
        setNotice(`${product.emoji} ${product.label} 구매 완료! 바로 장착했어요.`)
        await refresh()
        onCurrencyChange?.()
      } else {
        trackEvent('purchase_failed', {
          target_type: 'outfit', target_id: product.id, outcome: 'failed', operation_type: result.operationType,
          operation_idempotency_key: result.idempotencyKey, error_code: result.error?.code || result.reason || 'purchase_failed',
          metadata: { retryable: result.error?.retryable, price_displayed: price, price_confirmed: result.price, balance: result.balance },
        }, { critical: true, flush: true })
        if (result.reason === 'insufficient_funds') setNotice('잔액이 부족해요 🪙')
        else if (result.reason === 'already_owned') { setNotice('이미 보유 중인 아이템이에요'); await refresh() }
        else setNotice('구매 중 오류가 발생했어요. 다시 시도해주세요.')
      }
    } catch (error) {
      console.error('[SoundMuseum] 구매 오류:', error)
      setNotice('구매 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      purchaseInFlightRef.current = false
      setPurchasingId(null)
    }
  }

  const handleEquip = async (outfitId) => {
    if (equipInFlightRef.current) return
    equipInFlightRef.current = true
    setEquippingId(outfitId)
    if (!equipKey.current || equipKey.current.outfitId !== outfitId) equipKey.current = { outfitId, key: newOperationKey() }
    trackEvent('outfit_equip_attempted', {
      target_type: 'outfit', target_id: outfitId, operation_type: 'outfit_equip', operation_idempotency_key: equipKey.current.key,
    }, { critical: true })
    try {
      const result = await setEquippedOutfit(participantId, outfitId, equipKey.current.key)
      if (!result.ok) {
        trackEvent('outfit_equip_failed', {
          target_type: 'outfit', target_id: outfitId, outcome: 'failed', operation_type: result.operationType,
          operation_idempotency_key: result.idempotencyKey, error_code: result.error.code, metadata: { retryable: result.error.retryable },
        }, { critical: true, flush: true })
        setNotice(result.error.message); return
      }
      trackEvent('outfit_equip_succeeded', {
        target_type: 'outfit', target_id: outfitId, outcome: 'succeeded', operation_type: result.operationType,
        operation_idempotency_key: result.idempotencyKey, result_entity_type: 'outfit', result_entity_id: result.data?.outfitId,
      }, { critical: true, flush: true })
      equipKey.current = null
      setEquipped(outfitId)
      onCurrencyChange?.()
    } catch (error) {
      console.error('[SoundMuseum] 장착 오류:', error)
      trackEvent('outfit_equip_failed', {
        target_type: 'outfit', target_id: outfitId, outcome: 'failed', operation_type: 'outfit_equip',
        operation_idempotency_key: equipKey.current?.key, error_code: 'outfit_equip_failed', metadata: { retryable: true },
      }, { critical: true, flush: true })
      setNotice('장착 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      equipInFlightRef.current = false
      setEquippingId(null)
    }
  }

  return (
    <div style={{
      position: 'relative', zIndex: 10,
      width: '100%', height: '100%', overflowY: 'auto',
      background: tier.bg, borderRadius: '20px',
      boxShadow: `0 10px 60px #00000077, 0 0 0 1px ${tier.accent}55`,
      scrollbarWidth: 'none',
      transition: 'background 0.6s ease',
    }}>
      <div style={{
        position: 'sticky', top: 0,
        background: `linear-gradient(135deg, ${tier.accent}2A, ${tier.accent}0A)`,
        borderBottom: `1px solid ${tier.accent}38`, padding: '16px 20px 12px',
        borderRadius: '20px 20px 0 0',
      }}>
        <ShopGrowthDecor tierKey={tier.key}/>
        <div style={{ fontSize: '9px', fontWeight: 800, color: tier.accent, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          {tier.label.toUpperCase()}
        </div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#FAF6EE' }}>🛍 옷가게</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          <span style={{ fontSize: '16px' }}>🪙</span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#FFD866', fontVariantNumeric: 'tabular-nums' }}>{balance}</span>
          <span style={{ fontSize: '10px', color: '#FAF6EEaa' }}>보유 화폐</span>
        </div>
      </div>

      <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#FAF6EEaa', fontSize: '13px', padding: '16px' }}>불러오는 중...</div>
        ) : (
          SHOP_PRODUCTS.map(product => {
            const owned  = ownedOutfits.includes(product.id)
            const isEquipped = equipped === product.id
            const isDeal = dailyDeal.productId === product.id
            const price  = getEffectivePrice(product, dailyDeal)
            const canAfford = balance >= price
            return (
              <div key={product.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: '#FAF6EE0d', border: `1.5px solid ${tier.accent}33`,
                borderRadius: '14px', padding: '10px 12px',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                  background: '#FAF6EE12', border: `1.5px solid ${tier.accent}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                }}>{product.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#FAF6EE' }}>
                    {product.label}
                    {isDeal && (
                      <span style={{
                        marginLeft: '6px', fontSize: '9px', fontWeight: 800, color: '#2A1F0E',
                        background: '#FFD866', borderRadius: '6px', padding: '1px 6px',
                      }}>오늘의 특가</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                    {isDeal && <span style={{ color: '#FAF6EE66', textDecoration: 'line-through', marginRight: '5px' }}>🪙{product.price}</span>}
                    <span style={{ color: isDeal ? '#FFD866' : '#FAF6EEcc', fontWeight: 700 }}>🪙{price}</span>
                  </div>
                </div>
                {owned ? (
                  <button onClick={() => handleEquip(product.id)} disabled={isEquipped || Boolean(equippingId)} style={{
                    padding: '8px 14px', borderRadius: '10px',
                    background: isEquipped ? `${tier.accent}33` : '#FAF6EE',
                    border: `1.5px solid ${tier.accent}`,
                    color: isEquipped ? '#FAF6EE' : '#2A1F0E',
                    fontSize: '11px', fontWeight: 800, fontFamily: 'Nunito, sans-serif',
                    cursor: isEquipped ? 'default' : 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {isEquipped ? '장착 중' : '장착하기'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(product)}
                    disabled={!canAfford || Boolean(purchasingId)}
                    title={!canAfford ? '잔액이 부족해요' : undefined}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: 'none',
                      background: canAfford ? tier.accent : '#FAF6EE22',
                      color: canAfford ? '#fff' : '#FAF6EE55',
                      fontSize: '11px', fontWeight: 800, fontFamily: 'Nunito, sans-serif',
                      cursor: canAfford ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                      opacity: purchasingId === product.id ? 0.6 : 1,
                    }}>
                    {purchasingId === product.id ? '구매 중...' : canAfford ? '구매하기' : '잔액 부족'}
                  </button>
                )}
              </div>
            )
          })
        )}
        {equipped && equipped !== DEFAULT_OUTFIT_ID && (
          <button onClick={() => handleEquip(DEFAULT_OUTFIT_ID)} disabled={Boolean(equippingId)} style={{
            marginTop: '2px', padding: '9px', borderRadius: '10px',
            background: 'transparent', border: `1.5px solid ${tier.accent}44`,
            color: '#FAF6EEaa', fontSize: '11px', fontWeight: 700, fontFamily: 'Nunito, sans-serif',
            cursor: 'pointer',
          }}>
            기본 옷차림으로 되돌리기
          </button>
        )}
        {notice && (
          <div style={{
            textAlign: 'center', fontSize: '11px', fontWeight: 700, color: tier.accent,
            background: '#FAF6EE12', borderRadius: '10px', padding: '8px',
          }}>{notice}</div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SoundMuseum 메인
───────────────────────────────────────────── */
export default function SoundMuseum({ sound = null, zone, myExpression, participantId, sessionId, zoneCounts, outfitSrc, onCurrencyChange, onDone, onExit }) {
  const npc   = ZONE_NPC[zone]  || ZONE_NPC.Lab
  const meta  = ZONE_META[zone] || { color: '#9B6DD4', emoji: '?', label: zone }
  const accent = meta.color

  const [candidates,  setCandidates]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [pick,        setPick]        = useState(null) // 'A'|'B'|'C'|'D'|'E'
  const [confidence,  setConfidence]  = useState(3)   // 1=low 3=medium 5=high
  const [submitting,  setSubmitting]  = useState(false)
  const [candidateError, setCandidateError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [npcIdx,      setNpcIdx]      = useState(0)
  const [visible,     setVisible]     = useState(false)
  const cardRef = useRef(null)
  const voteKeyRef = useRef(newOperationKey())
  const voteInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const museumInstanceRef = useRef(crypto.randomUUID())

  const { playing, progress, playCount, error, toggle, getDuration } = useMuseumPlayer(sound?.file_path, {
    zone, sound_id: sound?.sound_id, target_type: 'audio', target_id: 'museum-audio',
  })

  // 슬라이드인 애니메이션
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    trackEvent('museum_entered', { zone, sound_id: sound?.sound_id, target_type: 'screen', target_id: 'sound-museum' }, {
      dedupeKey: `museum:${museumInstanceRef.current}`,
    })
  }, [sound?.sound_id, zone])

  // 표현을 고르면 동의 정도 슬라이더 + 제출 버튼이 스크롤 없이 바로 보이도록
  // 카드 맨 아래로 스크롤 (작은 화면에서 후보 카드 밑에 가려지는 문제 방지)
  useEffect(() => {
    if (pick !== null && cardRef.current) {
      cardRef.current.scrollTo({ top: cardRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [pick])

  // 후보 표현 로드 — 투표할 소리가 없으면(sound=null) 아예 요청하지 않는다.
  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(async () => {
      if (!sound) { if (!cancelled) { setCandidates([]); setLoading(false) }; return }
      if (!cancelled) { setLoading(true); setCandidateError('') }
      trackEvent('museum_candidate_load_attempted', { zone, sound_id: sound.sound_id, target_type: 'candidate_list', target_id: 'museum-candidates' })
      try {
        const data = await getCandidateExpressions(sound.sound_id, myExpression)
        if (!cancelled) {
          const visibleCandidates = data.slice(0, 5)
          setCandidates(visibleCandidates)
          trackEvent(visibleCandidates.length ? 'museum_candidate_loaded' : 'museum_candidate_empty', {
            zone, sound_id: sound.sound_id, target_type: 'candidate_list', target_id: 'museum-candidates',
            outcome: visibleCandidates.length ? 'succeeded' : 'empty', metadata: { candidate_count: visibleCandidates.length },
          })
          visibleCandidates.forEach((candidate, index) => trackEvent('museum_expression_impression', {
            zone, sound_id: sound.sound_id, target_type: 'annotation', target_id: candidate.id,
            metadata: { candidate_index: index, candidate_count: visibleCandidates.length },
          }, { dedupeKey: `impression:${museumInstanceRef.current}:${reloadNonce}:${candidate.id}` }))
        }
      } catch (err) {
        console.error('[Museum] 후보 로드 오류:', err)
        if (!cancelled) setCandidateError('후보를 불러오지 못했습니다. 다시 시도해주세요.')
        trackEvent('museum_candidate_load_failed', { zone, sound_id: sound.sound_id, target_type: 'candidate_list', target_id: 'museum-candidates', outcome: 'failed', error_code: 'candidate_load_failed' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [sound, myExpression, reloadNonce, zone])

  // NPC 대사 순환
  useEffect(() => {
    const t = setInterval(() => setNpcIdx(i => (i + 1) % npc.lines.length), 5000)
    return () => clearInterval(t)
  }, [npc.lines.length])

  const handleSubmit = async () => {
    if (voteInFlightRef.current || candidateError || playCount < 1) return
    voteInFlightRef.current = true
    setSubmitting(true)
    setSubmitError('')
    const operationKey = voteKeyRef.current
    trackEvent('museum_vote_submit_attempted', {
      zone, sound_id: sound?.sound_id, target_type: 'button', target_id: 'museum-vote-submit',
      operation_type: 'museum_vote', operation_idempotency_key: operationKey,
    }, { critical: true })
    try {
      const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4 }
      if (pick && pick in letterMap) {
        const candidate = candidates[letterMap[pick]]
        if (candidate) {
          const result = await saveVote({
            idempotencyKey:     operationKey,
            participant_id:     participantId,
            session_id:         sessionId,
            sound_id:           sound.sound_id,
            zone,
            voted_ids:          [candidate.id],
            confidence,
            play_count:         playCount,
            listening_time_sec: getListeningTime(),
            stage:              2,
            version:            'v0.4-web',
          })
          if (!result.ok) {
            trackEvent('museum_vote_submit_failed', {
              zone, sound_id: sound.sound_id, target_type: 'button', target_id: 'museum-vote-submit', outcome: 'failed',
              operation_type: result.operationType, operation_idempotency_key: result.idempotencyKey,
              error_code: result.error.code, metadata: { retryable: result.error.retryable },
            }, { critical: true, flush: true })
          }
          if (!result.ok) throw new Error(result.error.message)
          trackEvent('museum_vote_submit_succeeded', {
            zone, sound_id: sound.sound_id, target_type: 'button', target_id: 'museum-vote-submit', outcome: 'succeeded',
            operation_type: result.operationType, operation_idempotency_key: result.idempotencyKey,
            result_entity_type: 'vote', result_entity_id: result.data?.voteId,
            metadata: { transaction_id: result.data?.reward?.transactionId, reward_amount: result.data?.reward?.awarded },
          }, { critical: true, flush: true })
          resetListeningTime()
          voteKeyRef.current = newOperationKey()
        }
      }
      onDone()
    } catch (error) {
      console.error('[SoundMuseum] 투표 저장 오류:', error)
      if (mountedRef.current) setSubmitError('투표를 저장하지 못했습니다. 선택을 유지했으니 다시 시도해주세요.')
    } finally {
      voteInFlightRef.current = false
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const noCandidate = !loading && !candidateError && candidates.length === 0
  const canSubmit   = !candidateError && playCount > 0 && (noCandidate || pick !== null)

  // 투표 카드 — 기존 로직/마크업 그대로, 바깥 래퍼 크기만 LibraryRoom이 주는
  // 카드 슬롯(CARD_LAYOUT.vote, 뷰포트의 작은 영역)에 맞춰 100%/100%로 변경.
  // 투표할 소리가 아직 없으면(sound=null, 데이터 미달) 투표 UI 대신 안내
  // 카드만 보여준다 — 상점/전시 현황 탭은 이 조건과 무관하게 그대로 열린다.
  const voteCardBody = !sound ? (
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', height: '100%',
        background: '#FAF6EE', borderRadius: '20px',
        boxShadow: `0 10px 60px #00000077, 0 0 0 1px ${accent}44`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '32px', gap: '10px',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }}>
        <div style={{ fontSize: '40px' }}>🗳️</div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#2A1F0E' }}>아직 투표할 소리가 없어요</div>
        <div style={{ fontSize: '12px', color: '#8B6A3A', lineHeight: 1.6 }}>
          다른 참여자들이 소리를 더 전사하면<br/>여기서 투표할 수 있어요 ✨
        </div>
        {onExit && (
          <button data-library-navigation="true" onClick={onExit} style={{
            marginTop: '10px', padding: '9px 18px',
            background: '#F0EBE0', border: `1.5px solid ${accent}44`, borderRadius: '10px',
            color: '#8B6A3A', fontSize: '12px', fontWeight: 800,
            fontFamily: 'Nunito, sans-serif', cursor: 'pointer',
          }}>
            🗺 월드맵으로
          </button>
        )}
      </div>
  ) : (
      <div ref={cardRef} style={{
        position: 'relative', zIndex: 10,
        width: '100%', height: '100%', overflowY: 'auto',
        background: '#FAF6EE',
        borderRadius: '20px',
        boxShadow: `0 10px 60px #00000077, 0 0 0 1px ${accent}44`,
        scrollbarWidth: 'none',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }}>

        {/* 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${accent}1A, ${accent}08)`,
          borderBottom: `1px solid ${accent}28`,
          padding: '16px 20px 12px',
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '9px', fontWeight: 800, color: accent,
                letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '4px',
              }}>TODAY&apos;S EXHIBITION</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#2A1F0E', lineHeight: 1.2 }}>
                {meta.emoji} {meta.label} — {sound.sub_category || 'Unknown Sound'}
              </div>
              <div style={{ fontSize: '10px', color: '#8B6A3A', marginTop: '3px' }}>#{sound.sound_id}</div>
            </div>
            {onExit && (
              <button data-library-navigation="true" onClick={onExit} style={{
                flexShrink: 0,
                padding: '6px 10px',
                background: '#F0EBE0',
                border: `1.5px solid ${accent}44`,
                borderRadius: '10px',
                color: '#8B6A3A',
                fontSize: '11px', fontWeight: 800,
                fontFamily: 'Nunito, sans-serif',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}>
                🗺 월드맵
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* 재생 버튼 + 파형 */}
          <div style={{
            background: '#F0EBE0', borderRadius: '14px',
            padding: '14px 16px', border: `1px solid ${accent}24`,
          }}>
            <button onClick={toggle} style={{
              width: '100%', padding: '11px',
              background: playing ? `${accent}1E` : accent,
              border: `2px solid ${accent}`,
              borderRadius: '12px', cursor: 'pointer',
              color: playing ? accent : '#fff',
              fontSize: '14px', fontWeight: 800,
              fontFamily: 'Nunito, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s',
              boxShadow: playing ? 'none' : `0 4px 16px ${accent}44`,
            }}>
              {playing
                ? <><span style={{ fontSize: '16px' }}>⏸</span> PAUSE</>
                : <><span style={{ fontSize: '16px' }}>▶</span> PLAY CLIP</>
              }
            </button>
            <MiniWave progress={progress} accent={accent}/>
            {error
              ? <div style={{ fontSize: '11px', color: '#E24B4A', textAlign: 'center' }}>{error}</div>
              : playCount > 0 && <div style={{ fontSize: '10px', color: '#8B6A3A', textAlign: 'center' }}>{playCount}회 재생</div>
            }
          </div>

          {/* 내 표현 배지 — 표현이 있을 때만 표시 */}
          {myExpression ? (
            <div style={{
              background: `${accent}10`, border: `1.5px solid ${accent}40`,
              borderRadius: '12px', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>💬</span>
              <div>
                <div style={{ fontSize: '9px', color: '#8B6A3A', fontWeight: 800, letterSpacing: '1.5px' }}>
                  MY EXPRESSION
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: accent, letterSpacing: '1px' }}>
                  {myExpression}
                </div>
              </div>
            </div>
          ) : null}

          {/* 다른 참여자 표현 섹션 */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8B6A3A', fontSize: '13px', padding: '16px' }}>
              ✦ 다른 참여자 표현 불러오는 중...
            </div>
          ) : candidateError ? (
            <div style={{ background: '#FCE8E6', borderRadius: '12px', padding: '18px', textAlign: 'center', color: '#A43C32' }}>
              {candidateError}<br/>
              <button onClick={() => setReloadNonce(value => value + 1)} style={{ marginTop: '10px', padding: '8px 14px', borderRadius: '9px', border: 0, cursor: 'pointer' }}>다시 불러오기</button>
            </div>
          ) : noCandidate ? (
            <div style={{
              background: '#F0EBE0', borderRadius: '12px', padding: '18px',
              textAlign: 'center', fontSize: '13px', color: '#8B6A3A', lineHeight: 1.7,
            }}>
              🎉 첫 번째 표현자예요!<br/>
              <span style={{ fontSize: '11px', color: '#A09080' }}>다음 참여자가 이 표현을 평가하게 됩니다</span>
            </div>
          ) : (
            <>
              {/* 섹션 제목 */}
              <div style={{
                fontSize: '9px', fontWeight: 800, color: '#8B6A3A',
                letterSpacing: '2px', textTransform: 'uppercase',
              }}>다른 참여자들의 표현 — 가장 잘 맞는 것을 골라주세요</div>

              {/* 표현 카드 갤러리 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {candidates.map((c, i) => {
                  const letter = ['A', 'B', 'C', 'D', 'E'][i]
                  const isSelected = pick === letter
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        const previous = pick ? candidates[['A','B','C','D','E'].indexOf(pick)] : null
                        const nextPick = isSelected ? null : letter
                        trackEvent(isSelected ? 'museum_expression_deselected' : previous ? 'museum_expression_changed' : 'museum_expression_selected', {
                          zone, sound_id: sound.sound_id, target_type: 'annotation', target_id: c.id,
                          value_before: { candidate_index: previous ? ['A','B','C','D','E'].indexOf(pick) : null },
                          value_after: { candidate_index: nextPick ? i : null },
                        })
                        setPick(nextPick)
                      }}
                      style={{
                        display: 'flex', alignItems: 'stretch', gap: '0',
                        background: isSelected ? `${accent}12` : '#F0EBE0',
                        borderRadius: '12px',
                        border: isSelected ? `2px solid ${accent}` : `1.5px solid ${accent}22`,
                        overflow: 'hidden',
                        transition: 'all 0.15s', cursor: 'pointer',
                        boxShadow: isSelected ? `0 4px 14px ${accent}30` : 'none',
                      }}
                    >
                      {/* 왼쪽 컬러 바 + 레이블 */}
                      <div style={{
                        width: '38px', flexShrink: 0,
                        background: isSelected ? accent : `${accent}22`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '2px',
                        padding: '10px 0',
                        transition: 'background 0.15s',
                      }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 900,
                          color: isSelected ? '#fff' : accent,
                          lineHeight: 1,
                        }}>{letter}</div>
                        {isSelected && (
                          <div style={{ fontSize: '12px', color: '#fff' }}>✓</div>
                        )}
                      </div>

                      {/* 표현 텍스트 + 메타 */}
                      <div style={{ flex: 1, padding: '12px 14px' }}>
                        <div style={{
                          fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px',
                          color: isSelected ? '#2A1F0E' : '#3A2A14',
                          lineHeight: 1.3, marginBottom: '4px',
                        }}>
                          “{c.expression_text}”
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '9px', color: '#A09080' }}>
                            👤 다른 참여자
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            </>
          )}

          {/* 동의 정도 슬라이더 (표현 선택 후 표시) */}
          {pick !== null && (
            <div>
              <div style={{
                fontSize: '9px', fontWeight: 800, color: '#8B6A3A',
                letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px',
              }}>이 표현에 얼마나 동의하나요?</div>
              <div style={{
                textAlign: 'center', fontSize: '15px', fontWeight: 800,
                color: accent, marginBottom: '8px',
              }}>
                {CONFIDENCE_LABELS[confidence - 1]}
              </div>
              <input
                type="range" min={1} max={5} step={1}
                value={confidence}
                onChange={e => {
                  const next = Number(e.target.value)
                  trackEvent('confidence_changed', { zone, sound_id: sound.sound_id, target_type: 'confidence', target_id: `museum-confidence-${next}`, value_before: { confidence }, value_after: { confidence: next } })
                  setConfidence(next)
                }}
                style={{ width: '100%', accentColor: accent, cursor: 'pointer' }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '8px', color: '#A09080', marginTop: '2px', padding: '0 1px',
              }}>
                {CONFIDENCE_LABELS.map((label, i) => (
                  <span key={i} style={{ flex: i === 0 || i === CONFIDENCE_LABELS.length - 1 ? 'none' : 1, textAlign: 'center' }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 제출 버튼 */}
          {playCount < 1 && !error && (
            <div style={{ color:'#8B6A3A', fontSize:'11px', textAlign:'center' }}>음원을 실제로 재생한 뒤 투표할 수 있어요.</div>
          )}
          {submitError && <div role="alert" style={{ color: '#A43C32', fontSize: '12px', textAlign: 'center' }}>{submitError}</div>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{
              padding: '14px', borderRadius: '12px', border: 'none',
              background: canSubmit ? accent : '#C8B8A0',
              color: '#fff', fontSize: '15px', fontWeight: 800,
              fontFamily: 'Nunito, sans-serif', cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? `0 4px 20px ${accent}44` : 'none',
              transition: 'all 0.15s', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '저장 중...' : '✅ 다음 소리로'}
          </button>
        </div>
      </div>
  )

  return (
    <LibraryRoom
      onExit={onExit}
      zoneCounts={zoneCounts}
      activeStations={candidates.length}
      outfitSrc={outfitSrc}
      npcDialogue={{ name: npc.name, line: npc.lines[npcIdx] }}
      cards={{
        vote:     { render: () => voteCardBody },
        exhibits: { render: () => <ExhibitDisplay zoneCounts={zoneCounts} accent={accent}/> },
        shop:     { render: () => <Shop participantId={participantId} accent={accent} onCurrencyChange={onCurrencyChange}/> },
      }}
    />
  )
}
