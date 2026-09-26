'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollectiblePromptLogging, useKeys, SPEED } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H, PLAYER_BOX, MUSIC_PLAYER_SOURCE, MUSIC_PLAYER_W, MUSIC_PLAYER_H,
  SILHOUETTE_ENTER_RATIO, SILHOUETTE_EXIT_RATIO,
  buildVillage, spawnMusicItems, moveWithCollisionDetailed, overlapsExitTrigger,
  distanceToMusicItem, isMusicItemNearby, terrainSpeedAt, getNavigationTypeAtWorld, getNavigationCellAtWorld,
  preloadMusicAssets, drawStatic, drawDepthLayer, drawEnvironment, drawNavigationDebug, drawExitCue, markerStateFor,
  splitOcclusionObjects, getOcclusionState,
  getMusicCamera, worldToMusicScreen, getMusicPlayerPlacement,
} from '@/lib/musicVillage'

const soundSetKey = (sounds) => (sounds || [])
  .map((sound) => `${sound.sound_id}:${sound.block || 1}`)
  .sort()
  .join('|')

export default function MusicZoneMap({
  sounds,
  onCollectSound,
  onExit,
  collectedIds = new Set(),
  isAnnotating = false,
  blockNum = 1,
  blockTotal = 1,
  debug = false,
}) {
  const village = useMemo(() => buildVillage(), [])
  const key = soundSetKey(sounds)
  // `key`는 입력 배열 순서와 무관하므로 같은 sound set은 항상 같은 memo/배치를 쓴다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => spawnMusicItems(sounds), [key])
  const itemsRef = useRef(items)

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const behindCanvasRef = useRef(null)
  const frontCanvasRef = useRef(null)
  const staticCanvasRef = useRef(null)
  const assetsRef = useRef(null)
  const playerWrapRef = useRef(null)
  const silhouetteWrapRef = useRef(null)
  const debugPanelRef = useRef(null)
  const nearbyMarkerButtonRef = useRef(null)
  const metricsRef = useRef({ cssW: 0, cssH: 0, pixelW: 0, pixelH: 0, dpr: 1 })
  const cameraRef = useRef(null)
  const reducedMotionRef = useRef(false)
  const movementDebugRef = useRef({ blockedAxes: [], collisions: [] })
  const occlusionStateRef = useRef({ active: false, ratio: 0, objects: [], threshold: SILHOUETTE_ENTER_RATIO })

  const posRef = useRef({ x: village.spawn.x, y: village.spawn.y })
  const dirRef = useRef('down')
  const movingRef = useRef(false)
  const [dir, setDir] = useState('down')
  const [moving, setMoving] = useState(false)
  const [animTick, setAnimTick] = useState(0)
  const [collecting, setCollecting] = useState(null)
  useCollectiblePromptLogging(collecting, 'Music')
  const collectingRef = useRef(false)
  const collectingItemRef = useRef(null)
  const interactingItemIdRef = useRef(null)
  const isAnnotatingRef = useRef(isAnnotating)
  const blockNumRef = useRef(blockNum)
  const collectedIdsRef = useRef(collectedIds)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({ disabled: isAnnotating || exitConfirm, screen: 'zone', zone: 'Music' })
  const inExitZoneRef = useRef(false)
  const [assetStatus, setAssetStatus] = useState('loading')

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { reducedMotionRef.current = query.matches }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!isAnnotating) {
      collectingRef.current = false
      collectingItemRef.current = null
      interactingItemIdRef.current = null
    }
  }, [isAnnotating])

  useEffect(() => {
    let cancelled = false
    const offscreen = document.createElement('canvas')
    offscreen.width = MAP_W * T
    offscreen.height = MAP_H * T
    const ctx = offscreen.getContext('2d')
    drawStatic(ctx, village, null)
    staticCanvasRef.current = offscreen
    preloadMusicAssets().then((assets) => {
      if (cancelled) return
      drawStatic(ctx, village, assets)
      staticCanvasRef.current = offscreen
      assetsRef.current = assets
      setAssetStatus(assets.failed.length ? 'partial' : 'ready')
    })
    return () => { cancelled = true }
  }, [village])

  useEffect(() => {
    const stage = stageRef.current
    const canvases = [canvasRef.current, behindCanvasRef.current, frontCanvasRef.current]
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
    const timer = setInterval(() => {
      if (movingRef.current) setAnimTick((tick) => tick + 1)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const beginCollect = (item) => {
    if (!item || isAnnotatingRef.current) return
    // Lock synchronously so a second key/pointer event cannot open the same
    // item again before the parent has rendered the AnnotationPanel.
    isAnnotatingRef.current = true
    collectingRef.current = false
    collectingItemRef.current = null
    interactingItemIdRef.current = item.id
    setCollecting(null)
    onCollectSound(item.sound)
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !event.repeat) {
        if (!isAnnotatingRef.current) onExit()
        return
      }
      if (event.key === 'Enter' && !event.repeat && collectingItemRef.current && !isAnnotatingRef.current) {
        beginCollect(collectingItemRef.current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, onCollectSound])

  const confirmCollect = () => {
    if (collectingItemRef.current) beginCollect(collectingItemRef.current)
  }

  useEffect(() => {
    let animationFrame
    let lastTime = performance.now()
    const loop = (now) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, .05)
      const dt = deltaSeconds * 60
      lastTime = now
      const pressed = keys.current
      let dx = 0
      let dy = 0
      let nextDir = null
      const speed = SPEED * dt * terrainSpeedAt(posRef.current)
      if (pressed.up) { dy -= speed; nextDir = 'up' }
      if (pressed.down) { dy += speed; nextDir = 'down' }
      if (pressed.left) { dx -= speed; nextDir = 'left' }
      if (pressed.right) { dx += speed; nextDir = 'right' }
      if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2 }
      const moved = dx !== 0 || dy !== 0
      if (moved) {
        const movement = moveWithCollisionDetailed(village, posRef.current, dx, dy)
        posRef.current = movement.position
        movementDebugRef.current = movement
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
      if (!collectingRef.current && !isAnnotatingRef.current) {
        const nearby = currentItems
          .filter((item) => !collectedIdsRef.current.has(item.id) && item.block <= blockNumRef.current && isMusicItemNearby(posRef.current, item))
          .sort((a, b) => distanceToMusicItem(posRef.current, a) - distanceToMusicItem(posRef.current, b))[0]
        if (nearby) {
          collectingRef.current = true
          collectingItemRef.current = nearby
          setCollecting(nearby)
        }
      } else if (collectingRef.current && collectingItemRef.current && !isAnnotatingRef.current) {
        if (!isMusicItemNearby(posRef.current, collectingItemRef.current)) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      const inExitZone = overlapsExitTrigger(posRef.current)
      if (!isAnnotatingRef.current && inExitZone && !inExitZoneRef.current) setExitConfirm(true)
      inExitZoneRef.current = inExitZone

      const canvas = canvasRef.current
      const behindCanvas = behindCanvasRef.current
      const frontCanvas = frontCanvasRef.current
      const staticCanvas = staticCanvasRef.current
      const metrics = metricsRef.current
      if (canvas && behindCanvas && frontCanvas && staticCanvas && metrics.pixelW > 0 && metrics.pixelH > 0) {
        const camera = getMusicCamera({
          cssWidth: metrics.cssW,
          cssHeight: metrics.cssH,
          playerX,
          playerY,
          movementX: dx,
          movementY: dy,
          previousCamera: cameraRef.current,
          deltaSeconds,
        })
        cameraRef.current = camera
        const pixelScale = camera.scale * metrics.dpr
        const pixelOffsetX = camera.offsetX * metrics.dpr
        const pixelOffsetY = camera.offsetY * metrics.dpr
        const navigationCell = getNavigationCellAtWorld(playerX, playerY - 4)
        const occlusionState = getOcclusionState(assetsRef.current, playerX, playerY, occlusionStateRef.current.active)
        occlusionStateRef.current = occlusionState
        const movementDebug = movementDebugRef.current
        const collision = movementDebug.collisions[0] || null

        if (stageRef.current) {
          stageRef.current.dataset.cameraX = camera.x.toFixed(2)
          stageRef.current.dataset.cameraY = camera.y.toFixed(2)
          stageRef.current.dataset.viewWidth = camera.viewWidth.toFixed(2)
          stageRef.current.dataset.viewHeight = camera.viewHeight.toFixed(2)
          stageRef.current.dataset.playerX = playerX.toFixed(2)
          stageRef.current.dataset.playerY = playerY.toFixed(2)
          stageRef.current.dataset.navigation = String(navigationCell.type)
          stageRef.current.dataset.navigationCell = `${navigationCell.col},${navigationCell.row}`
          stageRef.current.dataset.collisionId = collision?.id || collision?.tag || 'none'
          stageRef.current.dataset.collisionType = collision?.type || 'none'
          stageRef.current.dataset.blockedAxes = movementDebug.blockedAxes.join(',') || 'none'
          stageRef.current.dataset.occlusionIds = occlusionState.objects.map((entry) => entry.id).join(',') || 'none'
          stageRef.current.dataset.occlusionRatio = occlusionState.ratio.toFixed(4)
          stageRef.current.dataset.silhouette = occlusionState.active ? 'true' : 'false'
          stageRef.current.dataset.silhouetteThreshold = occlusionState.threshold.toFixed(2)
          stageRef.current.dataset.debug = debug ? 'true' : 'false'
        }

        const applyWorldTransform = (context) => {
          context.translate(pixelOffsetX, pixelOffsetY)
          context.scale(pixelScale, pixelScale)
          context.translate(-camera.x, -camera.y)
        }
        const background = canvas.getContext('2d')
        background.imageSmoothingEnabled = false
        background.fillStyle = '#07152f'
        background.fillRect(0, 0, metrics.pixelW, metrics.pixelH)
        background.save()
        applyWorldTransform(background)
        background.drawImage(staticCanvas, 0, 0)
        drawEnvironment(background, now, {
          reducedMotion: reducedMotionRef.current,
          player: posRef.current,
          terrain: getNavigationTypeAtWorld(playerX, playerY - 7),
          moving: moved,
        })
        drawExitCue(background)
        if (debug) drawNavigationDebug(background, {
          player: posRef.current,
          collision: movementDebug,
          occlusion: occlusionState,
        })
        background.restore()

        const markerEntries = currentItems.map((item) => ({
          item,
          state: markerStateFor(item, {
            blockNum: blockNumRef.current,
            collectedIds: collectedIdsRef.current,
            nearbyId: collectingItemRef.current?.id,
            interactingId: isAnnotatingRef.current ? interactingItemIdRef.current : null,
            distance: distanceToMusicItem(posRef.current, item),
          }),
        }))
        const depth = splitOcclusionObjects(playerY)
        const behindMarkers = markerEntries.filter(({ item }) => (item.ty + .5) * T <= playerY)
        const frontMarkers = markerEntries.filter(({ item }) => (item.ty + .5) * T > playerY)
        for (const [depthCanvas, objects, markers] of [
          [behindCanvas, depth.behind, behindMarkers],
          [frontCanvas, depth.front, frontMarkers],
        ]) {
          const context = depthCanvas.getContext('2d')
          context.imageSmoothingEnabled = false
          context.clearRect(0, 0, metrics.pixelW, metrics.pixelH)
          context.save()
          applyWorldTransform(context)
          drawDepthLayer(context, assetsRef.current, objects, markers, now)
          context.restore()
        }

        const placement = getMusicPlayerPlacement(camera, playerX, playerY)
        for (const wrapper of [playerWrapRef.current, silhouetteWrapRef.current].filter(Boolean)) {
          wrapper.style.left = `${placement.left}px`
          wrapper.style.top = `${placement.top}px`
          wrapper.style.transform = `scale(${camera.scale})`
        }
        if (playerWrapRef.current) {
          playerWrapRef.current.dataset.worldX = playerX.toFixed(2)
          playerWrapRef.current.dataset.worldY = playerY.toFixed(2)
          playerWrapRef.current.dataset.footScreenX = placement.footX.toFixed(2)
          playerWrapRef.current.dataset.footScreenY = placement.footY.toFixed(2)
        }
        if (silhouetteWrapRef.current) {
          silhouetteWrapRef.current.style.display = occlusionState.active ? 'block' : 'none'
          silhouetteWrapRef.current.dataset.occluded = occlusionState.active ? 'true' : 'false'
          silhouetteWrapRef.current.dataset.ratio = occlusionState.ratio.toFixed(4)
          silhouetteWrapRef.current.dataset.threshold = occlusionState.threshold.toFixed(2)
        }
        if (debugPanelRef.current) {
          const nearby = occlusionState.objects.slice(0, 3).map((entry) => `${entry.id} ${(entry.ratio * 100).toFixed(1)}%`).join('\n') || 'none'
          debugPanelRef.current.textContent = [
            `foot ${playerX.toFixed(1)},${playerY.toFixed(1)} · ${PLAYER_BOX.w}x${PLAYER_BOX.h}`,
            `nav [${navigationCell.col},${navigationCell.row}] type=${navigationCell.type}`,
            `hit ${collision?.id || collision?.tag || 'none'} (${collision?.type || 'none'})`,
            `blocked axis ${movementDebug.blockedAxes.join(',') || 'none'}`,
            `occlusion ${nearby}`,
            `alpha overlap ${(occlusionState.ratio * 100).toFixed(1)}%`,
            `silhouette ${occlusionState.active ? 'ON' : 'off'} · enter ${(SILHOUETTE_ENTER_RATIO * 100).toFixed(0)}% / exit ${(SILHOUETTE_EXIT_RATIO * 100).toFixed(0)}%`,
          ].join('\n')
        }

        if (nearbyMarkerButtonRef.current && collectingItemRef.current) {
          const item = collectingItemRef.current
          const marker = worldToMusicScreen(camera, item.tx * T + T / 2, item.ty * T + T / 2)
          nearbyMarkerButtonRef.current.style.left = `${marker.x - 22}px`
          nearbyMarkerButtonRef.current.style.top = `${marker.y - 22}px`
        }
      }
      animationFrame = requestAnimationFrame(loop)
    }
    animationFrame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationFrame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug])

  const total = items.length
  const collected = items.filter((item) => collectedIds.has(item.id)).length
  const remaining = total - collected

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
      <ZoneHUD zone="Music" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />
      <div ref={stageRef} data-music-assets={assetStatus} data-testid="music-stage" style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        background: '#07152f', overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} aria-label="Music Village production map" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%',
          imageRendering: 'pixelated', zIndex: 0,
        }} />
        <canvas ref={behindCanvasRef} aria-label="Music Village objects behind player" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%',
          imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 1,
        }} />
        <div ref={playerWrapRef} data-testid="music-player" style={{
          position: 'absolute', left: 0, top: 0, width: MUSIC_PLAYER_W, height: MUSIC_PLAYER_H,
          transformOrigin: '0 0', pointerEvents: 'none', zIndex: 2,
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', left: 4, bottom: -3, width: 28, height: 9,
            borderRadius: '50%', background: 'rgba(3,8,24,.38)', filter: 'blur(1px)',
          }} />
          <div style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 3px rgba(135,125,255,.48))' }}>
            <PixelChar
              dir={dir}
              moving={moving}
              animationTick={animTick}
              displayWidth={MUSIC_PLAYER_W}
              displayHeight={MUSIC_PLAYER_H}
              sourceViewBox={MUSIC_PLAYER_SOURCE}
            />
          </div>
        </div>
        <canvas ref={frontCanvasRef} aria-label="Music Village objects in front of player" style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%',
          imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 3,
        }} />
        <div ref={silhouetteWrapRef} data-testid="music-player-silhouette" data-occluded="false" aria-hidden="true" style={{
          position: 'absolute', display: 'none', left: 0, top: 0, width: MUSIC_PLAYER_W, height: MUSIC_PLAYER_H,
          transformOrigin: '0 0', pointerEvents: 'none', zIndex: 4, opacity: .22,
          filter: 'brightness(0) drop-shadow(1px 0 0 rgba(216,211,255,.75)) drop-shadow(-1px 0 0 rgba(216,211,255,.75))',
          mixBlendMode: 'multiply',
        }}>
          <PixelChar
            dir={dir}
            moving={moving}
            animationTick={animTick}
            displayWidth={MUSIC_PLAYER_W}
            displayHeight={MUSIC_PLAYER_H}
            sourceViewBox={MUSIC_PLAYER_SOURCE}
          />
        </div>
        {debug && (
          <pre ref={debugPanelRef} data-testid="music-debug-panel" style={{
            position: 'absolute', left: 8, top: 8, zIndex: 8, margin: 0,
            maxWidth: 'min(430px, calc(100% - 16px))', padding: '8px 10px',
            border: '1px solid #67e8f9', borderRadius: 5,
            background: 'rgba(2, 6, 23, .88)', color: '#ecfeff',
            font: '700 10px/1.45 ui-monospace, monospace', whiteSpace: 'pre-wrap',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
          background: 'radial-gradient(120% 95% at 50% 45%, transparent 56%, rgba(2,8,23,.34) 100%)',
        }} />
        {collecting && !isAnnotating && (
          <button
            ref={nearbyMarkerButtonRef}
            type="button"
            data-testid="music-active-marker"
            aria-label={`${collecting.sound.sound_id} 소리 전사하기`}
            onClick={confirmCollect}
            style={{
              position: 'absolute', left: 0, top: 0, width: 44, height: 44,
              border: 0, padding: 0, borderRadius: '50%', background: 'transparent',
              cursor: 'pointer', touchAction: 'manipulation', zIndex: 7,
            }}
          />
        )}
        {collecting && !isAnnotating && (
          <div style={{
            position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 7,
            background: '#3f4358ee', border: '2px solid #c69a45', borderRadius: 6,
            boxShadow: '0 4px 18px rgba(63,67,88,.3)', padding: '7px 15px',
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif',
            color: '#f7f1e7', fontSize: 13, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#ffe18a', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
            이 소리 전사하기
          </div>
        )}
      </div>

      <DPad press={press} release={release} onExit={onExit} onConfirm={collecting ? confirmCollect : null} />
      {remaining === 0 && total > 0 && <CompleteModal zone="Music" onExit={onExit} />}
      {exitConfirm && <ExitConfirmModal zone="Music" onConfirm={onExit} onCancel={() => setExitConfirm(false)} />}
    </div>
  )
}
