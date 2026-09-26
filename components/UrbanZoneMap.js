'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectiblePromptLogging, useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX,
  buildUrbanVillage, spawnUrbanItems, moveWithCollision, overlapsExitTrigger,
  drawUrbanMarker, drawUrbanLockFog,
  drawUrbanExitCue, markerStateFor,
} from '@/lib/urbanVillage'
import {
  loadUrbanAssetSet, drawUrbanAssetStatic, drawUrbanAssetYSort,
} from '@/lib/urbanAssetArt'

const FOV_H = 18 * TILE

const soundSetKey = (sounds) => (sounds || [])
  .map((sound) => `${sound.sound_id}:${sound.block || 1}`)
  .sort()
  .join('|')

export default function UrbanZoneMap({
  sounds,
  onCollectSound,
  onExit,
  collectedIds = new Set(),
  isAnnotating = false,
  blockNum = 1,
  blockTotal = 1,
  debugStart = null,
}) {
  const village = useMemo(() => buildUrbanVillage(), [])
  const key = soundSetKey(sounds)
  // 입력 순서와 무관한 키를 사용해 같은 zone/group/sound set의 재입장 배치를 고정한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => spawnUrbanItems(sounds), [key])

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const foregroundCanvasRef = useRef(null)
  const markerCanvasRef = useRef(null)
  const staticCanvasRef = useRef(null)
  const urbanAssetsRef = useRef(null)
  const playerWrapRef = useRef(null)
  const metricsRef = useRef({ cssW: 0, cssH: 0, pixelW: 0, pixelH: 0, dpr: 1 })
  const itemsRef = useRef(items)

  const posRef = useRef(debugStart ? {
    x: debugStart.tx * T + T / 2,
    y: debugStart.ty * T + T / 2 + PLAYER_BOX.h / 2,
  } : { x: village.spawn.x, y: village.spawn.y })
  const dirRef = useRef('up')
  const movingRef = useRef(false)
  const [dir, setDir] = useState('up')
  const [moving, setMoving] = useState(false)
  const [, setAnimTick] = useState(0)
  const [collecting, setCollecting] = useState(null)
  useCollectiblePromptLogging(collecting, 'Urban')
  const collectingRef = useRef(false)
  const collectingItemRef = useRef(null)
  const interactingItemIdRef = useRef(null)
  const dismissedItemIdRef = useRef(null)
  const isAnnotatingRef = useRef(isAnnotating)
  const blockNumRef = useRef(blockNum)
  const collectedIdsRef = useRef(collectedIds)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({ disabled: isAnnotating || exitConfirm, screen: 'zone', zone: 'Urban' })
  const exitConfirmRef = useRef(false)
  const inExitZoneRef = useRef(false)

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { exitConfirmRef.current = exitConfirm }, [exitConfirm])
  useEffect(() => {
    if (!isAnnotating) {
      if (interactingItemIdRef.current) dismissedItemIdRef.current = interactingItemIdRef.current
      collectingRef.current = false
      collectingItemRef.current = null
      interactingItemIdRef.current = null
    }
  }, [isAnnotating])

  useEffect(() => {
    let cancelled = false
    loadUrbanAssetSet().then((assets) => {
      if (cancelled) return
      urbanAssetsRef.current = assets
      const offscreen = document.createElement('canvas')
      offscreen.width = MAP_W * T
      offscreen.height = MAP_H * T
      drawUrbanAssetStatic(offscreen.getContext('2d'), assets)
      staticCanvasRef.current = offscreen
    }).catch((error) => {
      console.error(error)
      if (stageRef.current) stageRef.current.dataset.urbanAssetError = error.message
    })
    return () => { cancelled = true }
  }, [village])

  useEffect(() => {
    const stage = stageRef.current
    const canvases = [canvasRef.current, foregroundCanvasRef.current, markerCanvasRef.current]
    if (!stage || canvases.some((canvas) => !canvas)) return
    const resize = () => {
      const cssW = Math.max(1, Math.round(stage.clientWidth))
      const cssH = Math.max(1, Math.round(stage.clientHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelW = Math.round(cssW * dpr)
      const pixelH = Math.round(cssH * dpr)
      for (const canvas of canvases) {
        if (canvas.width !== pixelW) canvas.width = pixelW
        if (canvas.height !== pixelH) canvas.height = pixelH
      }
      metricsRef.current = { cssW, cssH, pixelW, pixelH, dpr }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (movingRef.current) setAnimTick((tick) => tick + 1)
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  const beginCollect = (item) => {
    collectingRef.current = false
    collectingItemRef.current = null
    interactingItemIdRef.current = item.id
    setCollecting(null)
    onCollectSound(item.sound)
  }

  const nudge = useCallback((direction) => {
    if (isAnnotatingRef.current || exitConfirmRef.current) return
    const delta = {
      up: [0, -SPEED], down: [0, SPEED], left: [-SPEED, 0], right: [SPEED, 0],
    }[direction]
    if (!delta) return
    posRef.current = moveWithCollision(village, posRef.current, delta[0], delta[1], blockNumRef.current)
  }, [village])

  const pressDirection = useCallback((direction, interactionMethod) => {
    nudge(direction)
    press(direction, interactionMethod)
  }, [nudge, press])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !event.repeat) {
        if (!isAnnotatingRef.current) onExit()
        return
      }
      if (!event.repeat) {
        const direction = {
          ArrowUp: 'up', w: 'up', W: 'up',
          ArrowDown: 'down', s: 'down', S: 'down',
          ArrowLeft: 'left', a: 'left', A: 'left',
          ArrowRight: 'right', d: 'right', D: 'right',
        }[event.key]
        if (direction) nudge(direction)
      }
      if (event.key === 'Enter' && !event.repeat && collectingItemRef.current && !isAnnotatingRef.current) {
        beginCollect(collectingItemRef.current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, onCollectSound, nudge])

  const confirmCollect = () => {
    if (collectingItemRef.current) beginCollect(collectingItemRef.current)
  }

  useEffect(() => {
    let animationFrame
    let lastTime = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const paused = isAnnotatingRef.current || exitConfirmRef.current
      const pressed = keys.current
      let dx = 0
      let dy = 0
      let nextDir = null
      const speed = SPEED * dt
      if (!paused) {
        if (pressed.up) { dy -= speed; nextDir = 'up' }
        if (pressed.down) { dy += speed; nextDir = 'down' }
        if (pressed.left) { dx -= speed; nextDir = 'left' }
        if (pressed.right) { dx += speed; nextDir = 'right' }
      }
      const moved = dx !== 0 || dy !== 0
      if (moved) {
        posRef.current = moveWithCollision(village, posRef.current, dx, dy, blockNumRef.current)
        if (nextDir && nextDir !== dirRef.current) {
          dirRef.current = nextDir
          setDir(nextDir)
        }
      }
      if (moved !== movingRef.current) {
        movingRef.current = moved
        setMoving(moved)
      }

      const { x: playerX, y: playerY } = posRef.current
      const currentItems = itemsRef.current
      if (dismissedItemIdRef.current) {
        const dismissed = currentItems.find((item) => item.id === dismissedItemIdRef.current)
        if (!dismissed || !overlaps(
          playerX - PLAYER_BOX.w / 2, playerY - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h,
          dismissed.tx * T + T / 2 - INTERACTION_BOX.w / 2,
          dismissed.ty * T + T / 2 - INTERACTION_BOX.h / 2,
          INTERACTION_BOX.w, INTERACTION_BOX.h,
        )) dismissedItemIdRef.current = null
      }
      if (!collectingRef.current && !paused) {
        for (const item of currentItems) {
          if (collectedIdsRef.current.has(item.id) || item.block > blockNumRef.current || item.id === dismissedItemIdRef.current) continue
          const markerX = item.tx * T + T / 2 - INTERACTION_BOX.w / 2
          const markerY = item.ty * T + T / 2 - INTERACTION_BOX.h / 2
          if (overlaps(
            playerX - PLAYER_BOX.w / 2, playerY - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h,
            markerX, markerY, INTERACTION_BOX.w, INTERACTION_BOX.h,
          )) {
            collectingRef.current = true
            collectingItemRef.current = item
            setCollecting(item)
            break
          }
        }
      } else if (collectingRef.current && collectingItemRef.current && !paused) {
        const item = collectingItemRef.current
        const markerX = item.tx * T + T / 2 - INTERACTION_BOX.w / 2
        const markerY = item.ty * T + T / 2 - INTERACTION_BOX.h / 2
        if (!overlaps(
          playerX - PLAYER_BOX.w / 2, playerY - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h,
          markerX, markerY, INTERACTION_BOX.w, INTERACTION_BOX.h,
        )) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      const inExitZone = overlapsExitTrigger(posRef.current)
      if (!paused && inExitZone && !inExitZoneRef.current) setExitConfirm(true)
      inExitZoneRef.current = inExitZone

      const canvas = canvasRef.current
      const foregroundCanvas = foregroundCanvasRef.current
      const markerCanvas = markerCanvasRef.current
      const staticCanvas = staticCanvasRef.current
      const urbanAssets = urbanAssetsRef.current
      const metrics = metricsRef.current
      if (canvas && foregroundCanvas && markerCanvas && staticCanvas && urbanAssets && metrics.pixelW > 0 && metrics.pixelH > 0) {
        const viewWorldH = FOV_H
        const viewWorldW = Math.min(MAP_W * T, viewWorldH * metrics.pixelW / metrics.pixelH)
        const zoom = metrics.pixelH / viewWorldH
        const cssZoom = metrics.cssH / viewWorldH
        const renderedW = viewWorldW * zoom
        const cssRenderedW = viewWorldW * cssZoom
        const offsetX = Math.round((metrics.pixelW - renderedW) / 2)
        const cssOffsetX = (metrics.cssW - cssRenderedW) / 2
        const camX = Math.round(Math.max(0, Math.min(playerX - viewWorldW / 2, MAP_W * T - viewWorldW)))
        const camY = Math.round(Math.max(0, Math.min(playerY - viewWorldH / 2, MAP_H * T - viewWorldH)))

        const setupWorld = (context) => {
          context.imageSmoothingEnabled = false
          context.save()
          context.translate(offsetX, 0)
          context.scale(zoom, zoom)
          context.translate(-camX, -camY)
        }

        const background = canvas.getContext('2d')
        background.imageSmoothingEnabled = false
        background.fillStyle = '#070d22'
        background.fillRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(background)
        background.drawImage(staticCanvas, 0, 0)
        drawUrbanAssetYSort(background, urbanAssets, playerY, 'below')
        drawUrbanExitCue(background)
        background.restore()

        const foreground = foregroundCanvas.getContext('2d')
        foreground.clearRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(foreground)
        drawUrbanAssetYSort(foreground, urbanAssets, playerY, 'above')
        foreground.restore()

        const markerContext = markerCanvas.getContext('2d')
        markerContext.imageSmoothingEnabled = false
        markerContext.clearRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(markerContext)
        drawUrbanLockFog(markerContext, blockNumRef.current, now)
        for (const item of currentItems) {
          const state = markerStateFor(item, {
            blockNum: blockNumRef.current,
            collectedIds: collectedIdsRef.current,
            nearbyId: collectingItemRef.current?.id,
            interactingId: isAnnotatingRef.current ? interactingItemIdRef.current : null,
          })
          drawUrbanMarker(markerContext, item, state, now)
        }
        markerContext.restore()

        if (playerWrapRef.current) {
          playerWrapRef.current.style.left = `${cssOffsetX + (playerX - SPRITE_W / 2 - camX) * cssZoom}px`
          playerWrapRef.current.style.top = `${(playerY - SPRITE_H - camY) * cssZoom}px`
          playerWrapRef.current.style.transform = `scale(${cssZoom})`
        }
        if (stageRef.current) {
          stageRef.current.dataset.playerTile = `${Math.floor(playerX / T)},${Math.floor(playerY / T)}`
          stageRef.current.dataset.playerPosition = `${playerX.toFixed(1)},${playerY.toFixed(1)}`
          stageRef.current.dataset.urbanReady = 'true'
          stageRef.current.dataset.urbanAssetRenderer = 'imagegen-v2'
          stageRef.current.dataset.urbanBlock = String(blockNumRef.current)
          stageRef.current.dataset.urbanItems = String(currentItems.length)
        }
      }
      animationFrame = requestAnimationFrame(loop)
    }
    animationFrame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationFrame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = items.length
  const collected = items.filter((item) => collectedIds.has(item.id)).length
  const remaining = total - collected

  return (
    <div data-urban-zone="midnight-metro-media-core" style={{
      width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none', background: '#070d22',
    }}>
      <style>{`
        @media (max-width: 600px) {
          [data-zone-hud="Urban"] {
            padding: 0 7px !important;
            gap: 7px !important;
          }
          [data-zone-hud="Urban"] [data-zone-hud-back] {
            padding: 6px 8px !important;
            font-size: 10px !important;
            flex: 0 0 auto;
          }
          [data-zone-hud="Urban"] [data-zone-hud-separator],
          [data-zone-hud="Urban"] [data-zone-hud-controls] {
            display: none !important;
          }
          [data-zone-hud="Urban"] [data-zone-hud-info] {
            gap: 5px !important;
            flex: 0 0 auto;
          }
          [data-zone-hud="Urban"] [data-zone-hud-info] > span {
            font-size: 17px !important;
          }
          [data-zone-hud="Urban"] [data-zone-hud-progress] {
            min-width: 0 !important;
          }
        }
      `}</style>
      <ZoneHUD zone="Urban" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />
      <div ref={stageRef} style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        background: '#070d22', overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} aria-label="Urban Midnight Metro production map" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
          background: 'radial-gradient(115% 92% at 50% 45%, transparent 55%, rgba(3,7,22,.36) 100%)',
        }} />
        <div ref={playerWrapRef} style={{
          position: 'absolute', left: 0, top: 0, width: SPRITE_W, height: SPRITE_H,
          transformOrigin: '0 0', pointerEvents: 'none', zIndex: 2,
        }}>
          <PixelChar dir={dir} moving={moving} />
        </div>
        <canvas ref={foregroundCanvasRef} aria-label="Urban foreground layer" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 3,
        }} />
        <canvas ref={markerCanvasRef} aria-label="Urban sound markers and lock fog" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 4,
        }} />
        {collecting && !isAnnotating && (
          <div style={{
            position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 5,
            background: '#0b1734ee', border: '2px solid #69e8ff', borderRadius: 6,
            boxShadow: '0 4px 20px rgba(48,211,242,.24)', padding: '7px 15px',
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif',
            color: '#eafcff', fontSize: 13, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#69e8ff', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
            이 소리 전사하기
          </div>
        )}
      </div>

      <DPad press={pressDirection} release={release} onExit={onExit} onConfirm={collecting ? confirmCollect : null} />
      {remaining === 0 && total > 0 && <CompleteModal zone="Urban" onExit={onExit} />}
      {exitConfirm && <ExitConfirmModal zone="Urban" onConfirm={onExit} onCancel={() => setExitConfirm(false)} />}
    </div>
  )
}
