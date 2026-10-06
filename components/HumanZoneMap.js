'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectiblePromptLogging, useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX, HUMAN_LAYER_Z,
  loadHumanVillage, spawnHumanItems, moveWithCollision, overlapsExitTrigger,
  drawHumanObjects, drawHumanMarker, drawHumanLockFog, drawHumanExitCue,
  drawHumanDebug, markerStateFor,
} from '@/lib/humanVillage'
import { getCharacterRenderMetrics, placeCharacterAtScreenFoot } from '@/lib/characterRenderMetrics.mjs'
import { useWalkFrame } from '@/components/useWalkFrame'
import { getVillageRuntimeManifest } from '@/lib/villageRuntimeManifest.mjs'

const DESKTOP_FOV_W = 24 * TILE
const FOV_H = 18 * TILE

const soundSetKey = (sounds) => (sounds || [])
  .map((sound) => `${sound.sound_id}:${sound.block || 1}`)
  .sort()
  .join('|')

export default function HumanZoneMap({
  sounds,
  onCollectSound,
  onExit,
  collectedIds = new Set(),
  isAnnotating = false,
  blockNum = 1,
  blockTotal = 1,
  debugOverview = false,
  debugCollision = false,
  debugSpawns = false,
  debugStart = null,
  staticArt = false,
  outfitSrc,
  accessorySrc,
  characterLoadout,
  debugFirstItem = false,
  currentWorldWidth = getVillageRuntimeManifest('human').baseWorldWidth,
  currentWorldHeight = getVillageRuntimeManifest('human').baseWorldHeight,
}) {
  const worldSize = useMemo(() => ({ currentWorldWidth, currentWorldHeight }), [currentWorldWidth, currentWorldHeight])
  const key = soundSetKey(sounds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => spawnHumanItems(sounds), [key])
  const [village, setVillage] = useState(null)
  const [loadError, setLoadError] = useState('')

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const foregroundCanvasRef = useRef(null)
  const markerCanvasRef = useRef(null)
  const playerWrapRef = useRef(null)
  const metricsRef = useRef({ cssW: 0, cssH: 0, pixelW: 0, pixelH: 0 })
  const itemsRef = useRef(items)
  const villageRef = useRef(null)

  const posRef = useRef({ x: 24 * T + T / 2, y: 32 * T + 23 })
  const dirRef = useRef('up')
  const movingRef = useRef(false)
  const [dir, setDir] = useState('up')
  const [moving, setMoving] = useState(false)
  const frameIndex = useWalkFrame(moving)
  const [collecting, setCollecting] = useState(null)
  useCollectiblePromptLogging(collecting, 'Human')
  const collectingRef = useRef(false)
  const collectingItemRef = useRef(null)
  const interactingItemIdRef = useRef(null)
  const dismissedItemIdRef = useRef(null)
  const isAnnotatingRef = useRef(isAnnotating)
  const blockNumRef = useRef(blockNum)
  const collectedIdsRef = useRef(collectedIds)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({ disabled: isAnnotating || exitConfirm, screen: 'zone', zone: 'Human' })
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
    loadHumanVillage(worldSize).then((loaded) => {
      if (cancelled) return
      villageRef.current = loaded
      setVillage(loaded)
      posRef.current = debugStart && Number.isFinite(debugStart.x) && Number.isFinite(debugStart.y)
        ? { x: debugStart.x * loaded.transform.scaleX, y: debugStart.y * loaded.transform.scaleY }
        : debugFirstItem && items[0]
        ? {
          x: (items[0].tx * T + T / 2) * loaded.transform.scaleX,
          y: (items[0].ty * T + T / 2) * loaded.transform.scaleY,
        }
        : debugStart
        ? {
          x: (debugStart.tx * T + T / 2) * loaded.transform.scaleX,
          y: (debugStart.ty * T + T / 2 + PLAYER_BOX.h / 2) * loaded.transform.scaleY,
        }
        : { ...loaded.spawn }
    }).catch((error) => {
      console.error('[HumanZone] map load failed:', error)
      if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
    })
    return () => { cancelled = true }
  }, [debugFirstItem, debugStart, items, worldSize])

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
      metricsRef.current = { cssW, cssH, pixelW, pixelH }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const beginCollect = useCallback((item) => {
    collectingRef.current = false
    collectingItemRef.current = null
    interactingItemIdRef.current = item.id
    setCollecting(null)
    onCollectSound(item.sound)
  }, [onCollectSound])

  const nudge = useCallback((direction) => {
    const currentVillage = villageRef.current
    if (!currentVillage || isAnnotatingRef.current || exitConfirmRef.current) return
    const delta = { up: [0, -SPEED], down: [0, SPEED], left: [-SPEED, 0], right: [SPEED, 0] }[direction]
    if (!delta) return
    posRef.current = moveWithCollision(currentVillage, posRef.current,
      delta[0] * currentVillage.transform.scaleX, delta[1] * currentVillage.transform.scaleY, blockNumRef.current)
  }, [])

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
          ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
          ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
        }[event.key]
        if (direction) nudge(direction)
      }
      if (event.key === 'Enter' && !event.repeat && collectingItemRef.current && !isAnnotatingRef.current) beginCollect(collectingItemRef.current)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [beginCollect, nudge, onExit])

  const confirmCollect = () => {
    if (collectingItemRef.current) beginCollect(collectingItemRef.current)
  }

  useEffect(() => {
    if (!village) return
    let animationFrame
    let lastTime = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const paused = isAnnotatingRef.current || exitConfirmRef.current || debugOverview || staticArt
      const pressed = keys.current
      let dx = 0
      let dy = 0
      let nextDir = null
      const scaleX = village.transform.scaleX
      const scaleY = village.transform.scaleY
      const speed = SPEED * dt
      if (!paused) {
        if (pressed.up) { dy -= speed * scaleY; nextDir = 'up' }
        if (pressed.down) { dy += speed * scaleY; nextDir = 'down' }
        if (pressed.left) { dx -= speed * scaleX; nextDir = 'left' }
        if (pressed.right) { dx += speed * scaleX; nextDir = 'right' }
      }
      const hasMovementInput = dx !== 0 || dy !== 0
      let moved = false
      if (hasMovementInput) {
        const previousPosition = posRef.current
        const nextPosition = moveWithCollision(village, previousPosition, dx, dy, blockNumRef.current)
        moved = Math.abs(nextPosition.x - previousPosition.x) > 0.01 || Math.abs(nextPosition.y - previousPosition.y) > 0.01
        posRef.current = nextPosition
        if (nextDir && nextDir !== dirRef.current) { dirRef.current = nextDir; setDir(nextDir) }
      }
      if (moved !== movingRef.current) { movingRef.current = moved; setMoving(moved) }

      const { x: playerX, y: playerY } = posRef.current
      if (playerWrapRef.current) {
        playerWrapRef.current.dataset.worldX = playerX.toFixed(2)
        playerWrapRef.current.dataset.worldY = playerY.toFixed(2)
        playerWrapRef.current.dataset.movementBlocked = hasMovementInput && !moved ? 'true' : 'false'
      }
      const currentItems = itemsRef.current
      if (dismissedItemIdRef.current) {
        const dismissed = currentItems.find((item) => item.id === dismissedItemIdRef.current)
        if (!dismissed || !overlaps(
          playerX - PLAYER_BOX.w * scaleX / 2, playerY - PLAYER_BOX.h * scaleY,
          PLAYER_BOX.w * scaleX, PLAYER_BOX.h * scaleY,
          (dismissed.tx * T + T / 2 - INTERACTION_BOX.w / 2) * scaleX,
          (dismissed.ty * T + T / 2 - INTERACTION_BOX.h / 2) * scaleY,
          INTERACTION_BOX.w * scaleX, INTERACTION_BOX.h * scaleY,
        )) dismissedItemIdRef.current = null
      }
      if (!collectingRef.current && !paused) {
        for (const item of currentItems) {
          if (collectedIdsRef.current.has(item.id) || item.block > blockNumRef.current || item.id === dismissedItemIdRef.current) continue
          const markerX = (item.tx * T + T / 2 - INTERACTION_BOX.w / 2) * scaleX
          const markerY = (item.ty * T + T / 2 - INTERACTION_BOX.h / 2) * scaleY
          if (overlaps(
            playerX - PLAYER_BOX.w * scaleX / 2, playerY - PLAYER_BOX.h * scaleY,
            PLAYER_BOX.w * scaleX, PLAYER_BOX.h * scaleY,
            markerX, markerY, INTERACTION_BOX.w * scaleX, INTERACTION_BOX.h * scaleY,
          )) {
            collectingRef.current = true
            collectingItemRef.current = item
            setCollecting(item)
            break
          }
        }
      } else if (collectingRef.current && collectingItemRef.current && !paused) {
        const item = collectingItemRef.current
        const markerX = (item.tx * T + T / 2 - INTERACTION_BOX.w / 2) * scaleX
        const markerY = (item.ty * T + T / 2 - INTERACTION_BOX.h / 2) * scaleY
        if (!overlaps(
          playerX - PLAYER_BOX.w * scaleX / 2, playerY - PLAYER_BOX.h * scaleY,
          PLAYER_BOX.w * scaleX, PLAYER_BOX.h * scaleY,
          markerX, markerY, INTERACTION_BOX.w * scaleX, INTERACTION_BOX.h * scaleY,
        )) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      const inExitZone = overlapsExitTrigger(posRef.current, worldSize)
      if (!paused && inExitZone && !inExitZoneRef.current) setExitConfirm(true)
      inExitZoneRef.current = inExitZone

      const canvas = canvasRef.current
      const foregroundCanvas = foregroundCanvasRef.current
      const markerCanvas = markerCanvasRef.current
      const metrics = metricsRef.current
      if (canvas && foregroundCanvas && markerCanvas && metrics.pixelW > 0 && metrics.pixelH > 0) {
        const fullMap = debugOverview || staticArt
        const worldWidth = village.currentWorldWidth
        const worldHeight = village.currentWorldHeight
        const viewWorldH = fullMap ? worldHeight : FOV_H * scaleY
        const responsiveW = viewWorldH * metrics.pixelW / metrics.pixelH
        const viewWorldW = fullMap ? worldWidth : Math.min(DESKTOP_FOV_W * scaleX, responsiveW)
        const zoom = Math.min(metrics.pixelW / viewWorldW, metrics.pixelH / viewWorldH)
        const cssZoom = Math.min(metrics.cssW / viewWorldW, metrics.cssH / viewWorldH)
        const renderedW = viewWorldW * zoom
        const renderedH = viewWorldH * zoom
        const cssRenderedW = viewWorldW * cssZoom
        const cssRenderedH = viewWorldH * cssZoom
        const offsetX = Math.round((metrics.pixelW - renderedW) / 2)
        const offsetY = Math.round((metrics.pixelH - renderedH) / 2)
        const cssOffsetX = (metrics.cssW - cssRenderedW) / 2
        const cssOffsetY = (metrics.cssH - cssRenderedH) / 2
        const camX = fullMap ? 0 : Math.round(Math.max(0, Math.min(playerX - viewWorldW / 2, worldWidth - viewWorldW)))
        const camY = fullMap ? 0 : Math.round(Math.max(0, Math.min(playerY - viewWorldH / 2, worldHeight - viewWorldH)))
        const setupWorld = (context) => {
          context.imageSmoothingEnabled = false
          context.save()
          context.translate(offsetX, offsetY)
          context.scale(zoom, zoom)
          context.translate(-camX, -camY)
          context.scale(scaleX, scaleY)
        }

        const background = canvas.getContext('2d')
        background.imageSmoothingEnabled = false
        background.fillStyle = '#758750'
        background.fillRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(background)
        background.drawImage(village.staticCanvas, 0, 0)
        if (!staticArt) {
          drawHumanLockFog(background, blockNumRef.current, now)
          drawHumanObjects(background, village.assets, playerY / scaleY, 'below')
          drawHumanExitCue(background, now)
        }
        background.restore()

        const foreground = foregroundCanvas.getContext('2d')
        foreground.clearRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(foreground)
        if (!staticArt) drawHumanObjects(foreground, village.assets, playerY / scaleY, 'above')
        foreground.restore()

        const markers = markerCanvas.getContext('2d')
        markers.imageSmoothingEnabled = false
        markers.clearRect(0, 0, metrics.pixelW, metrics.pixelH)
        setupWorld(markers)
        if (!staticArt) {
          if (debugCollision && village.assets.walkableMask) {
            markers.save()
            markers.globalAlpha = 0.28
            markers.drawImage(village.assets.walkableMask, 0, 0, village.baseWorldWidth, village.baseWorldHeight)
            markers.restore()
          }
          for (const item of currentItems) {
            const state = markerStateFor(item, {
              blockNum: blockNumRef.current, collectedIds: collectedIdsRef.current,
              nearbyId: collectingItemRef.current?.id,
              interactingId: isAnnotatingRef.current ? interactingItemIdRef.current : null,
            })
            drawHumanMarker(markers, item, state, now)
          }
          drawHumanDebug(markers, { showCollision: debugCollision, showSpawns: debugSpawns, unlockedBlock: blockNumRef.current })
        }
        markers.restore()

        if (playerWrapRef.current) {
          const renderMetrics = getCharacterRenderMetrics({ stageWidth: metrics.cssW, stageHeight: metrics.cssH, sceneCameraScale: cssZoom * scaleY })
          const footX = cssOffsetX + (playerX - camX) * cssZoom
          const footY = cssOffsetY + (playerY - camY) * cssZoom
          const placement = placeCharacterAtScreenFoot(footX, footY, renderMetrics)
          playerWrapRef.current.style.left = `${placement.left}px`
          playerWrapRef.current.style.top = `${placement.top}px`
          playerWrapRef.current.style.transform = `scale(${renderMetrics.screenScale})`
          playerWrapRef.current.style.visibility = fullMap ? 'hidden' : 'visible'
          playerWrapRef.current.dataset.footScreenX = placement.footX.toFixed(2)
          playerWrapRef.current.dataset.footScreenY = placement.footY.toFixed(2)
        }
        if (stageRef.current) {
          stageRef.current.dataset.humanReady = 'true'
          stageRef.current.dataset.humanAsset = atlasManifestLabel(village.assets.manifest)
          stageRef.current.dataset.playerTile = `${Math.floor(playerX / scaleX / T)},${Math.floor(playerY / scaleY / T)}`
          stageRef.current.dataset.humanBlock = String(blockNumRef.current)
          stageRef.current.dataset.humanItems = String(currentItems.length)
          stageRef.current.dataset.humanStatic = staticArt ? 'true' : 'false'
          stageRef.current.dataset.worldWidth = String(worldWidth)
          stageRef.current.dataset.worldHeight = String(worldHeight)
          stageRef.current.dataset.worldScale = String(scaleX)
          stageRef.current.dataset.maskSource = village.manifest.mask.src
          stageRef.current.dataset.generatedMask = 'true'
        }
      }
      animationFrame = requestAnimationFrame(loop)
    }
    animationFrame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationFrame)
  }, [debugCollision, debugOverview, debugSpawns, keys, staticArt, village, worldSize])

  const total = items.length
  const collected = items.filter((item) => collectedIds.has(item.id)).length
  const remaining = total - collected

  return (
    <div data-human-zone="community-hall-plaza" style={{
      width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none', background: '#758750',
    }}>
      <style>{`
        @media (max-width: 600px) {
          [data-zone-hud="Human"] { padding: 0 7px !important; gap: 7px !important; }
          [data-zone-hud="Human"] [data-zone-hud-back] { padding: 6px 8px !important; font-size: 10px !important; flex: 0 0 auto; }
          [data-zone-hud="Human"] [data-zone-hud-separator],
          [data-zone-hud="Human"] [data-zone-hud-controls] { display: none !important; }
          [data-zone-hud="Human"] [data-zone-hud-info] { gap: 5px !important; flex: 0 0 auto; }
          [data-zone-hud="Human"] [data-zone-hud-info] > span { font-size: 17px !important; }
          [data-zone-hud="Human"] [data-zone-hud-progress] { min-width: 0 !important; }
        }
      `}</style>
      {!staticArt && <ZoneHUD zone="Human" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />}
      <div ref={stageRef} data-testid="human-stage" style={{ position: 'absolute', top: staticArt ? 0 : 56, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: '#758750' }}>
        <canvas ref={canvasRef} aria-label="Human Community Hall Plaza map" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', zIndex: HUMAN_LAYER_Z.background }} />
        {!staticArt && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: HUMAN_LAYER_Z.ambience, background: 'radial-gradient(120% 100% at 50% 45%, transparent 64%, rgba(72,76,47,.2) 100%)' }} />}
        <canvas ref={markerCanvasRef} aria-label="Human sound markers and debug overlay" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: HUMAN_LAYER_Z.markers }} />
        <div ref={playerWrapRef} data-human-player data-character-moving={moving ? 'true' : 'false'} data-frame-index={frameIndex} style={{ position: 'absolute', left: 0, top: 0, width: SPRITE_W, height: SPRITE_H, transformOrigin: '0 0', pointerEvents: 'none', zIndex: HUMAN_LAYER_Z.player }}>
          <PixelChar dir={dir} moving={moving} frameIndex={frameIndex} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout} />
        </div>
        <canvas ref={foregroundCanvasRef} aria-label="Human Village foreground" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: HUMAN_LAYER_Z.foreground }} />
        {!village && !loadError && <div style={statusStyle}>사람 마을을 준비하고 있어요…</div>}
        {loadError && <div style={statusStyle}>사람 마을 에셋을 불러오지 못했어요.<br />{loadError}</div>}
        {!staticArt && collecting && !isAnnotating && (
          <div style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: HUMAN_LAYER_Z.prompt, background: '#604f3dee', border: '2px solid #e8a04a', borderRadius: 7, boxShadow: '0 4px 18px rgba(67,47,31,.3)', padding: '7px 15px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif', color: '#fff8e8', fontSize: 13, whiteSpace: 'nowrap' }}>
            <span style={{ color: '#ffd777', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
            이 소리 전사하기
          </div>
        )}
      </div>
      {!staticArt && <DPad press={pressDirection} release={release} onExit={onExit} onConfirm={collecting ? confirmCollect : null} />}
      {!staticArt && remaining === 0 && total > 0 && <CompleteModal zone="Human" onExit={onExit} />}
      {!staticArt && exitConfirm && <ExitConfirmModal zone="Human" onConfirm={onExit} onCancel={() => setExitConfirm(false)} />}
    </div>
  )
}

const statusStyle = {
  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center',
  fontFamily: 'Nunito, sans-serif', fontWeight: 800, color: '#f6e4c8', background: '#758750', zIndex: 8,
}

function atlasManifestLabel(manifest) {
  return `${manifest.runtimeMaster.file}@v${manifest.version}`
}
