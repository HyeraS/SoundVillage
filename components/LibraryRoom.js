'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ASSET_READY, WORLD_CHARACTER, resolveWorldCharacterLayers } from '@/components/AssetRegistry'
import { useKeys, overlaps } from '@/components/GameEngine'
import { WorldDPad } from '@/components/world-map/WorldMapUI'
import SoundMuseumScene from '@/components/sound-museum/SoundMuseumScene'
import { getCharacterRenderMetrics } from '@/lib/characterRenderMetrics.mjs'
import { WORLD_CAMERA_HUD_HEIGHT } from '@/lib/worldMapCamera.mjs'
import {
  CARD_LAYOUTS,
  MUSEUM_BOUNDS,
  MUSEUM_COLLISIONS,
  MUSEUM_EXIT_TRIGGER,
  MUSEUM_INTERACTIONS,
  MUSEUM_SPAWN,
  MUSEUM_WORLD_HEIGHT,
  MUSEUM_WORLD_WIDTH,
  PLAYER_BODY,
  PLAYER_SPEED,
  PLAYER_SPRITE,
  overlapsMuseumExitTrigger,
} from '@/lib/soundMuseumFinalBLayout.mjs'
import { inferInteractionMethod, trackEvent } from '@/lib/userEvents'

function MuseumCharacter({ dir, moving, animationTick, outfitSrc, accessorySrc, characterLoadout }) {
  if (!ASSET_READY.world) return null
  const { frame, rows, cols } = WORLD_CHARACTER
  const layers = resolveWorldCharacterLayers({ outfitSrc, accessorySrc, ...(characterLoadout || {}) })
  const row = rows[dir] ?? rows.down
  const sourceColumn = cols[moving ? animationTick % cols.length : 0]
  const sourceX = sourceColumn * frame
  const sourceY = row * frame
  return <svg width={PLAYER_SPRITE.width} height={PLAYER_SPRITE.height} viewBox={`0 0 ${frame} ${frame}`}
    data-pixel-character data-character-moving={moving ? 'true' : 'false'} data-source-column={sourceColumn}
    style={{ overflow:'hidden', imageRendering:'pixelated' }}>
    <defs><clipPath id="museumPlayerClip"><rect width={frame} height={frame}/></clipPath></defs>
    {layers.map((sprite, index) => (
      <image key={`${sprite.src}-${index}`} href={sprite.src} x={-sourceX} y={-sourceY}
        width={sprite.sheetW} height={sprite.sheetH} data-character-layer={sprite.kind || index}
        clipPath="url(#museumPlayerClip)" style={{ imageRendering:'pixelated' }}/>
    ))}
  </svg>
}

function collisionAt(x, y) {
  return MUSEUM_COLLISIONS.find(rect => overlaps(x, y, PLAYER_BODY.width, PLAYER_BODY.height, rect.x, rect.y, rect.width, rect.height)) || null
}

function interactionAt(x, y) {
  return MUSEUM_INTERACTIONS.find(zone => overlaps(x, y, PLAYER_BODY.width, PLAYER_BODY.height, zone.x, zone.y, zone.width, zone.height)) || null
}

export function stepMuseumFrame({ x, y, dir, keysDown, dt = 1 }) {
  let nextDir = dir
  let dx = 0
  let dy = 0
  if (keysDown.left) { dx -= PLAYER_SPEED * dt; nextDir = 'left' }
  if (keysDown.right) { dx += PLAYER_SPEED * dt; nextDir = 'right' }
  if (keysDown.up) { dy -= PLAYER_SPEED * dt; nextDir = 'up' }
  if (keysDown.down) { dy += PLAYER_SPEED * dt; nextDir = 'down' }
  const moved = dx !== 0 || dy !== 0
  const minX = MUSEUM_BOUNDS.minX
  const maxX = MUSEUM_BOUNDS.maxX - PLAYER_BODY.width
  const minY = MUSEUM_BOUNDS.minY
  const maxY = MUSEUM_BOUNDS.maxY - PLAYER_BODY.height
  let hit = null
  const nx = Math.max(minX, Math.min(maxX, x + dx))
  const xCollision = collisionAt(nx, y)
  if (!xCollision) x = nx
  else hit = xCollision.id
  const ny = Math.max(minY, Math.min(maxY, y + dy))
  const yCollision = collisionAt(x, ny)
  if (!yCollision) y = ny
  else hit ||= yCollision.id
  return { x, y, dir:nextDir, moved, hit }
}

const CARD_META = {
  vote: { title:'🗳 오늘의 소리 투표', sub:'VOTE' },
  exhibits: { title:'🏺 전시 현황', sub:'EXHIBITS' },
  shop: { title:'🛍 옷가게', sub:'SHOP' },
}

function PlaceholderCard({ kind }) {
  const meta = CARD_META[kind]
  const voteCandidates = ['사각사각', '포르르', '보글보글', '두근두근', '차르르']
  const exhibitRows = [['Animal', 3], ['Human', 4], ['Nature', 5], ['Urban', 2], ['Music', 6], ['Lab', 1]]
  const shopRows = [['멜빵바지', 15], ['세일러 룩', 20], ['스포티 세트', 18], ['정장', 30], ['마녀 로브', 40]]
  return <div style={{ width:'100%', height:'100%', overflow:'auto', borderRadius:20, background:'#FAF6EE', color:'#3A2A14', padding:24, boxShadow:'0 16px 60px #0008', border:'2px solid #C8A96E' }}>
    <div style={{ color:'#8B6432', fontSize:10, fontWeight:900, letterSpacing:2 }}>{meta.sub}</div>
    <h2 style={{ margin:'6px 0 18px', fontSize:22 }}>{meta.title}</h2>
    {kind === 'vote' && <div style={{ display:'grid', gap:10 }}>
      <button type="button" style={{ padding:12, border:0, borderRadius:12, background:'#387F74', color:'#fff', fontWeight:900 }}>▶ PLAY CLIP</button>
      <div style={{ height:36, borderRadius:10, background:'repeating-linear-gradient(90deg, #73B7AA 0 5px, transparent 5px 10px)', opacity:.7 }}/>
      {voteCandidates.map((candidate, index) => <div key={candidate} style={{ display:'flex', alignItems:'center', gap:12, padding:12, border:'1.5px solid #387F7433', borderRadius:12, background:index === 1 ? '#387F7418' : '#F0EBE0' }}><strong style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:index === 1 ? '#387F74' : '#387F7422', color:index === 1 ? '#fff' : '#387F74' }}>{'ABCDE'[index]}</strong><span style={{ fontWeight:800, fontSize:17 }}>“{candidate}”</span></div>)}
      <label style={{ display:'grid', gap:6, fontSize:11, fontWeight:800 }}>이 표현에 얼마나 동의하나요?<input aria-label="테스트 동의 정도" type="range" min="1" max="5" defaultValue="3"/></label>
      <button type="button" style={{ padding:13, border:0, borderRadius:12, background:'#B9AA92', color:'#fff', fontWeight:900 }}>음원을 먼저 재생해주세요</button>
    </div>}
    {kind === 'exhibits' && <div style={{ display:'grid', gap:10 }}>{exhibitRows.map(([zone, collected]) => <div key={zone} style={{ padding:12, border:'1.5px solid #C8A96E66', borderRadius:12, background:'#F0EBE0' }}><div style={{ display:'flex', justifyContent:'space-between', fontWeight:900 }}><span>{zone}</span><span>{collected}/8</span></div><div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:3, marginTop:8 }}>{Array.from({ length:8 }, (_, index) => <i key={index} style={{ aspectRatio:'1', borderRadius:3, background:index < collected ? '#4E9F8E' : '#D9D0BF' }}/>)}</div></div>)}</div>}
    {kind === 'shop' && <div style={{ display:'grid', gap:10 }}>{shopRows.map(([label, price], index) => <div key={label} style={{ display:'flex', alignItems:'center', gap:12, padding:12, border:'1.5px solid #C8A96E55', borderRadius:12, background:'#2F241D', color:'#FAF6EE' }}><span style={{ fontSize:25 }}>{['👖','⚓','🏃','🤵','🧙'][index]}</span><strong style={{ flex:1 }}>{label}</strong><span style={{ color:'#F3C764' }}>🪙 {price}</span><button type="button" disabled style={{ padding:'7px 10px', border:0, borderRadius:8 }}>테스트</button></div>)}</div>}
  </div>
}

function snapWorld(value, scale, dpr) {
  if (!scale) return value
  return Math.round(value * scale * dpr) / (scale * dpr)
}

export default function LibraryRoom({
  autoWalk = null,
  cards = null,
  onExit = null,
  initialOpen = null,
  qaMode = 'clean',
  zoneCounts = {},
  activeStations = 0,
  outfitSrc,
  accessorySrc,
  characterLoadout,
  npcDialogue = null,
}) {
  const viewportRef = useRef(null)
  const [viewport, setViewport] = useState({ width:0, height:0, dpr:1 })
  const [pos, setPos] = useState(MUSEUM_SPAWN)
  const [dir, setDir] = useState('down')
  const [moving, setMoving] = useState(false)
  const [animationTick, setAnimationTick] = useState(0)
  const [nearZone, setNearZone] = useState(null)
  const [openCard, setOpenCard] = useState(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({ disabled: Boolean(openCard) || exitConfirm, screen:'museum' })
  const posRef = useRef(MUSEUM_SPAWN)
  const onExitRef = useRef(onExit)
  const nearZoneRef = useRef(null)
  const openCardRef = useRef(null)
  const exitConfirmRef = useRef(false)
  const inExitZoneRef = useRef(false)
  const cardLifecycleRef = useRef(null)
  const interactionButtonRef = useRef(null)
  const cardTriggerRef = useRef(null)
  const cardCloseButtonRef = useRef(null)
  const exitCancelButtonRef = useRef(null)

  const stageScale = Math.min(viewport.width / MUSEUM_WORLD_WIDTH || 1, viewport.height / MUSEUM_WORLD_HEIGHT || 1)
  const stageOffset = useMemo(() => ({
    x: Math.round((viewport.width - MUSEUM_WORLD_WIDTH * stageScale) / 2),
    y: Math.round((viewport.height - MUSEUM_WORLD_HEIGHT * stageScale) / 2),
  }), [stageScale, viewport.height, viewport.width])
  const playerRenderMetrics = useMemo(() => getCharacterRenderMetrics({
    stageWidth:viewport.width,
    stageHeight:Math.max(1, viewport.height - WORLD_CAMERA_HUD_HEIGHT),
    sceneCameraScale:stageScale,
  }), [stageScale, viewport.height, viewport.width])

  useEffect(() => { nearZoneRef.current = nearZone }, [nearZone])
  useEffect(() => { onExitRef.current = onExit }, [onExit])
  useEffect(() => { openCardRef.current = openCard }, [openCard])
  useEffect(() => { exitConfirmRef.current = exitConfirm }, [exitConfirm])
  useEffect(() => {
    if (!openCard) return undefined
    const frame = window.requestAnimationFrame(() => cardCloseButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [openCard])
  useEffect(() => {
    if (!exitConfirm) return undefined
    const frame = window.requestAnimationFrame(() => exitCancelButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [exitConfirm])
  useEffect(() => {
    const interval = window.setInterval(() => setAnimationTick(value => value + 1), moving ? 100 : 650)
    return () => window.clearInterval(interval)
  }, [moving])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      setViewport({ width:rect.width, height:rect.height, dpr:window.devicePixelRatio || 1 })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const openLibraryCard = useCallback((kind, interactionMethod = 'programmatic') => {
    if (!kind || openCardRef.current || exitConfirmRef.current) return
    const instanceId = crypto.randomUUID()
    openCardRef.current = kind
    cardLifecycleRef.current = { kind, instanceId, closed:false }
    setOpenCard(kind)
    trackEvent('library_card_opened', { screen:'museum', target_type:'library_card', target_id:`library-card-${kind}`, interaction_method:interactionMethod, metadata:{ modal_instance_id:instanceId } })
    if (kind === 'shop') trackEvent('shop_opened', { screen:'museum', target_type:'panel', target_id:'museum-outfit-shop', interaction_method:interactionMethod })
  }, [])

  const closeLibraryCard = useCallback((reason = 'unknown', interactionMethod = 'programmatic') => {
    const lifecycle = cardLifecycleRef.current
    if (!lifecycle || lifecycle.closed) return
    lifecycle.closed = true
    trackEvent('library_card_closed', { screen:'museum', target_type:'library_card', target_id:`library-card-${lifecycle.kind}`, interaction_method:interactionMethod, close_reason:reason, metadata:{ modal_instance_id:lifecycle.instanceId } })
    if (lifecycle.kind === 'shop') trackEvent('shop_closed', { screen:'museum', target_type:'panel', target_id:'museum-outfit-shop', interaction_method:interactionMethod, close_reason:reason })
    openCardRef.current = null
    cardLifecycleRef.current = null
    setOpenCard(null)
    const trigger = cardTriggerRef.current
    cardTriggerRef.current = null
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus()
      else interactionButtonRef.current?.focus()
    })
  }, [])

  useEffect(() => () => {
    const lifecycle = cardLifecycleRef.current
    if (!lifecycle || lifecycle.closed) return
    trackEvent('library_card_closed', { screen:'museum', target_type:'library_card', target_id:`library-card-${lifecycle.kind}`, close_reason:'component_unmounted', metadata:{ modal_instance_id:lifecycle.instanceId } })
    if (lifecycle.kind === 'shop') trackEvent('shop_closed', { screen:'museum', target_type:'panel', target_id:'museum-outfit-shop', close_reason:'component_unmounted' })
  }, [])

  useEffect(() => {
    if (initialOpen && CARD_LAYOUTS[initialOpen] && !openCardRef.current) openLibraryCard(initialOpen, 'programmatic')
  }, [initialOpen, openLibraryCard])

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Enter' && !event.repeat && !openCardRef.current && !exitConfirmRef.current && nearZoneRef.current) {
        cardTriggerRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : interactionButtonRef.current
        openLibraryCard(nearZoneRef.current.card, 'keyboard')
      }
      if (event.key !== 'Escape' || event.repeat) return
      if (openCardRef.current) closeLibraryCard('escape', 'keyboard')
      else if (exitConfirmRef.current) {
        exitConfirmRef.current = false
        setExitConfirm(false)
      }
      else onExit?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeLibraryCard, onExit, openLibraryCard])

  const requestMuseumExit = useCallback(() => {
    if (!onExitRef.current || openCardRef.current || exitConfirmRef.current) return
    exitConfirmRef.current = true
    setExitConfirm(true)
  }, [])

  const cancelMuseumExit = useCallback(() => {
    exitConfirmRef.current = false
    setExitConfirm(false)
  }, [])

  const confirmMuseumExit = useCallback(() => {
    exitConfirmRef.current = false
    setExitConfirm(false)
    onExitRef.current?.()
  }, [])

  const simulatedRef = useRef(false)
  useEffect(() => {
    if (!autoWalk?.length || simulatedRef.current) return
    simulatedRef.current = true
    let current = { ...posRef.current, dir }
    let simulatedNear = interactionAt(current.x, current.y)
    for (const step of autoWalk) {
      if (step.action === 'enter') {
        if (simulatedNear) openLibraryCard(simulatedNear.card, 'programmatic')
        continue
      }
      if (step.action === 'esc') { closeLibraryCard('escape', 'programmatic'); continue }
      const frames = Math.max(1, Math.round(step.ms / 16.67))
      for (let frame = 0; frame < frames; frame += 1) {
        current = stepMuseumFrame({ ...current, keysDown:{ [step.dir]:true } })
        simulatedNear = interactionAt(current.x, current.y)
      }
    }
    posRef.current = { x:current.x, y:current.y }
    setPos(posRef.current)
    setDir(current.dir)
    nearZoneRef.current = simulatedNear
    setNearZone(simulatedNear)
  }, [autoWalk, closeLibraryCard, dir, openLibraryCard])

  useEffect(() => {
    if (autoWalk) return
    let frameId
    let last = performance.now()
    const loop = now => {
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      const inputBlocked = Boolean(openCardRef.current || exitConfirmRef.current)
      const result = stepMuseumFrame({ ...posRef.current, dir, keysDown: inputBlocked ? {} : keys.current, dt })
      if (result.moved && !inputBlocked) {
        posRef.current = { x:result.x, y:result.y }
        setPos(posRef.current)
        setDir(result.dir)
        setMoving(true)
      } else setMoving(false)
      const zone = interactionAt(result.x, result.y)
      if (zone?.id !== nearZoneRef.current?.id) {
        nearZoneRef.current = zone
        setNearZone(zone)
      }
      const inExitZone = overlapsMuseumExitTrigger(result)
      if (onExitRef.current && !inputBlocked && inExitZone && !inExitZoneRef.current) requestMuseumExit()
      inExitZoneRef.current = inExitZone
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [autoWalk, dir, keys, requestMuseumExit])

  const snapped = { x:snapWorld(pos.x, stageScale, viewport.dpr), y:snapWorld(pos.y, stageScale, viewport.dpr) }
  const playerNode = <div key="player" data-testid="museum-player" data-player-x={Math.round(pos.x)} data-player-y={Math.round(pos.y)}
    data-character-render-scale={playerRenderMetrics.worldScale.toFixed(6)}
    data-character-screen-width={playerRenderMetrics.screenWidth.toFixed(2)} data-character-screen-height={playerRenderMetrics.screenHeight.toFixed(2)}
    style={{ position:'absolute', left:snapped.x + PLAYER_BODY.width / 2 - PLAYER_SPRITE.width / 2, top:snapped.y + PLAYER_BODY.height - PLAYER_SPRITE.height, width:PLAYER_SPRITE.width, height:PLAYER_SPRITE.height, zIndex:1, transform:`scale(${playerRenderMetrics.worldScale})`, transformOrigin:'50% 100%' }}><MuseumCharacter dir={dir} moving={moving} animationTick={animationTick} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout}/></div>
  const cardLayout = openCard ? CARD_LAYOUTS[openCard] : null
  const promptLeft = stageOffset.x + (pos.x + PLAYER_BODY.width / 2) * stageScale
  const promptTop = stageOffset.y + (pos.y - 14) * stageScale
  const owlScreen = { left:stageOffset.x + 836 * stageScale, top:stageOffset.y + 166 * stageScale }

  return <div ref={viewportRef} data-museum-qa={qaMode} style={{ position:'fixed', inset:0, overflow:'hidden', background:'radial-gradient(circle at 50% 30%, #6C4A2F, #25160F 76%)', fontFamily:'Nunito, sans-serif', touchAction:'none' }}>
    <div onClickCapture={event => { if (event.target.closest?.('[data-library-navigation]')) closeLibraryCard('navigation', inferInteractionMethod(event.nativeEvent)) }} style={{ position:'absolute', left:stageOffset.x, top:stageOffset.y, width:MUSEUM_WORLD_WIDTH, height:MUSEUM_WORLD_HEIGHT, transform:`scale(${stageScale})`, transformOrigin:'top left', overflow:'hidden', background:'#D09B5A' }}>
      <SoundMuseumScene playerNode={playerNode} playerFootY={pos.y + PLAYER_BODY.height} animationTick={animationTick} activeStations={activeStations} zoneCounts={zoneCounts} qaMode={qaMode}/>
      {onExit && <button type="button" data-testid="museum-floor-exit" aria-label="Sound Museum 출구, 월드맵으로 돌아가기" onClick={requestMuseumExit} style={{ position:'absolute', left:MUSEUM_EXIT_TRIGGER.x, top:MUSEUM_EXIT_TRIGGER.y - 28, zIndex:0, width:MUSEUM_EXIT_TRIGGER.width, height:48, border:'2px solid #E7C985', borderRadius:'14px 14px 5px 5px', background:'linear-gradient(180deg, #315E59ee, #214540ee)', color:'#FFF8E9', font:'900 16px/1 Nunito, sans-serif', letterSpacing:1, boxShadow:'0 5px 0 #18332f, 0 8px 18px #0007', cursor:'pointer' }}>🚪 출구</button>}
    </div>

    {onExit && !openCard && !exitConfirm && <button type="button" data-testid="museum-exit-button" onClick={requestMuseumExit} style={{ position:'fixed', left:16, top:16, zIndex:108, border:'2px solid #C8963E', borderRadius:12, background:'#FFF8E9f2', color:'#352314', padding:'9px 13px', font:'900 12px/1.2 Nunito, sans-serif', boxShadow:'0 5px 18px #0005', cursor:'pointer' }}>← 월드맵</button>}

    {nearZone && !openCard && <button ref={interactionButtonRef} type="button" onClick={event => { cardTriggerRef.current = event.currentTarget; openLibraryCard(nearZone.card, inferInteractionMethod(event.nativeEvent)) }} style={{ position:'absolute', left:promptLeft, top:promptTop, transform:'translate(-50%, -100%)', zIndex:105, border:'2px solid #C8963E', borderRadius:18, background:'#FFF8E9f2', color:'#352314', padding:'8px 13px', font:'800 12px/1.2 Nunito, sans-serif', whiteSpace:'nowrap', boxShadow:'0 5px 18px #0005', cursor:'pointer' }}>{nearZone.prompt} <span style={{ opacity:.55 }}>· Enter ↵</span></button>}

    {npcDialogue && (nearZone?.interactionId === 'exhibits' || openCard === 'vote') && <div style={{ position:'absolute', left:owlScreen.left, top:owlScreen.top, transform:'translate(-50%, -100%)', zIndex:106, maxWidth:230, border:'2px solid #C8963E', borderRadius:'16px 16px 16px 4px', background:'#FFF8E9f5', color:'#3A2A14', padding:'10px 13px', fontSize:11, lineHeight:1.55, boxShadow:'0 5px 18px #0005', pointerEvents:'none' }}><strong style={{ display:'block', marginBottom:2, color:'#8B6432' }}>{npcDialogue.name}</strong>{npcDialogue.line}</div>}

    <WorldDPad press={press} release={release} onConfirm={nearZone && !openCard ? () => openLibraryCard(nearZone.card, 'touch') : null}/>

    {openCard && <div role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) closeLibraryCard('backdrop', inferInteractionMethod(event.nativeEvent)) }} style={{ position:'fixed', inset:0, zIndex:110, background:'#1E120950', backdropFilter:'blur(1px)' }}/>} 
    {openCard && cardLayout && <section aria-label={CARD_META[openCard].title} style={{ position:'fixed', left:'50%', top:'50%', transform:'translate(-50%, -50%)', zIndex:111, width:`min(${cardLayout.width}px, calc(100vw - 24px))`, height:`min(${cardLayout.height}px, calc(100dvh - 24px))`, maxHeight:'calc(100dvh - 24px)' }}>
      {cards?.[openCard]?.render?.() ?? <PlaceholderCard kind={openCard}/>} 
      <button ref={cardCloseButtonRef} type="button" aria-label={`${CARD_META[openCard].title} 닫기`} onClick={event => closeLibraryCard('close_button', inferInteractionMethod(event.nativeEvent))} style={{ position:'absolute', top:8, right:8, zIndex:120, width:32, height:32, borderRadius:'50%', border:'2px solid #C8A96E', background:'#2A1F0E', color:'#FAF6EE', fontSize:14, fontWeight:900, cursor:'pointer', boxShadow:'0 3px 10px #0006' }}>✕</button>
    </section>}
    {exitConfirm && <div role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) cancelMuseumExit() }} style={{ position:'fixed', inset:0, zIndex:130, background:'#1E120970', backdropFilter:'blur(3px)', display:'grid', placeItems:'center', padding:16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="museum-exit-title" style={{ width:'min(360px, calc(100vw - 32px))', border:'3px solid #C8963E', borderRadius:20, background:'#FFF8E9', color:'#352314', padding:'26px 24px 22px', textAlign:'center', boxShadow:'0 14px 48px #0008' }}>
        <div aria-hidden="true" style={{ fontSize:36, marginBottom:8 }}>🚪</div>
        <h2 id="museum-exit-title" style={{ margin:'0 0 18px', fontSize:18 }}>Sound Museum에서 나갈까요?</h2>
        <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
          <button ref={exitCancelButtonRef} type="button" onClick={cancelMuseumExit} style={{ padding:'10px 16px', border:'2px solid #C8A96E', borderRadius:11, background:'#FAF6EE', color:'#6D512E', font:'800 13px/1.2 Nunito, sans-serif', cursor:'pointer' }}>더 둘러볼래요</button>
          <button type="button" onClick={confirmMuseumExit} style={{ padding:'10px 16px', border:'2px solid #315E59', borderRadius:11, background:'#315E59', color:'#fff', font:'800 13px/1.2 Nunito, sans-serif', cursor:'pointer' }}>월드맵으로</button>
        </div>
      </section>
    </div>}
  </div>
}
