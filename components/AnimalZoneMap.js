'use client'
import { useEffect, useRef, useState } from 'react'
import { useCollectiblePromptLogging, useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, BASE_MAP_SRC,
  loadAnimalVillage, moveWithCollision, spawnAnimalItems,
  drawItem, drawLockFog, drawAnimalVillageLayer, drawAnimalDebug, PLAYER_BOX,
} from '@/lib/animalVillage'
import { getCharacterRenderMetrics, placeCharacterAtScreenFoot } from '@/lib/characterRenderMetrics.mjs'
import { useWalkFrame } from '@/components/useWalkFrame'
import { getVillageRuntimeManifest } from '@/lib/villageRuntimeManifest.mjs'

const FOV_W = 24 * TILE
const FOV_H = 18 * TILE

const snapDevicePixel = (value, dpr) => Math.round(value * dpr) / dpr

export default function AnimalZoneMap({
  sounds,
  onCollectSound,
  onExit,
  collectedIds = new Set(),
  isAnnotating = false,
  blockNum = 1,
  blockTotal = 1,
  outfitSrc,
  accessorySrc,
  characterLoadout,
  debugOptions = null,
  baseOnly = false,
  debugFirstItem = false,
  debugStart = null,
  currentWorldWidth = getVillageRuntimeManifest('animal').baseWorldWidth,
  currentWorldHeight = getVillageRuntimeManifest('animal').baseWorldHeight,
}) {
  const [village, setVillage] = useState(null)
  const villageRef = useRef(null)
  const itemsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadAnimalVillage({ currentWorldWidth, currentWorldHeight }).then((nextVillage) => {
      if (cancelled) return
      villageRef.current = nextVillage
      itemsRef.current = spawnAnimalItems(sounds, nextVillage)
      if (debugStart && Number.isFinite(debugStart.x) && Number.isFinite(debugStart.y)) {
        nextVillage.spawn = {
          x: debugStart.x * nextVillage.transform.scaleX,
          y: debugStart.y * nextVillage.transform.scaleY,
        }
      } else if (debugFirstItem && itemsRef.current[0]) {
        const first = itemsRef.current[0]
        nextVillage.spawn = {
          x: (first.tx * T + 16) * nextVillage.transform.scaleX,
          y: (first.ty * T + 22) * nextVillage.transform.scaleY,
        }
      }
      setVillage(nextVillage)
    }).catch((error) => console.error(error))
    return () => { cancelled = true }
  // The production sound list is stable for a mounted zone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorldHeight, currentWorldWidth, debugFirstItem, debugStart])

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const foregroundCanvasRef = useRef(null)

  useEffect(() => {
    if (baseOnly) return undefined
    const stage = stageRef.current
    const canvas = canvasRef.current
    const foregroundCanvas = foregroundCanvasRef.current
    if (!stage || !canvas || !foregroundCanvas) return undefined
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const width = Math.round(stage.clientWidth)
      const height = Math.round(stage.clientHeight)
      const backingWidth = Math.round(width * dpr)
      const backingHeight = Math.round(height * dpr)
      if (canvas.width !== backingWidth) canvas.width = backingWidth
      if (canvas.height !== backingHeight) canvas.height = backingHeight
      if (foregroundCanvas.width !== backingWidth) foregroundCanvas.width = backingWidth
      if (foregroundCanvas.height !== backingHeight) foregroundCanvas.height = backingHeight
      canvas.dataset.dpr = String(dpr)
      foregroundCanvas.dataset.dpr = String(dpr)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [village, baseOnly])

  const posRef = useRef({ x: 0, y: 0 })
  const dirRef = useRef('down')
  const movingRef = useRef(false)
  const [dir, setDir] = useState('down')
  const [moving, setMoving] = useState(false)
  const frameIndex = useWalkFrame(moving)
  const [collecting, setCollecting] = useState(null)
  useCollectiblePromptLogging(collecting, 'Animal')
  const collectingRef = useRef(false)
  const collectingItemRef = useRef(null)
  const isAnnotatingRef = useRef(isAnnotating)
  const blockNumRef = useRef(blockNum)
  const collectedIdsRef = useRef(collectedIds)
  const playerWrapRef = useRef(null)
  const lastDebugUpdateRef = useRef(0)
  const [debugInfo, setDebugInfo] = useState(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({
    disabled: baseOnly || isAnnotating || exitConfirm,
    screen: 'zone',
    zone: 'Animal',
  })
  const inExitZoneRef = useRef(false)

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => {
    if (!isAnnotating) {
      collectingRef.current = false
      collectingItemRef.current = null
    }
  }, [isAnnotating])
  useEffect(() => {
    if (village) posRef.current = { ...village.spawn }
  }, [village])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (baseOnly) return
      if (event.key === 'Escape' && !event.repeat) {
        if (!isAnnotatingRef.current) onExit()
        return
      }
      if (event.key === 'Enter' && !event.repeat && collectingItemRef.current && !isAnnotatingRef.current) {
        const item = collectingItemRef.current
        collectingItemRef.current = null
        setCollecting(null)
        onCollectSound(item.sound)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [baseOnly, onExit, onCollectSound])

  const confirmCollect = () => {
    const item = collectingItemRef.current
    if (!item) return
    collectingItemRef.current = null
    setCollecting(null)
    onCollectSound(item.sound)
  }

  useEffect(() => {
    if (!village || baseOnly) return undefined
    let animationFrame
    let lastTime = performance.now()
    const items = itemsRef.current

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const pressed = keys.current
      let { x, y } = posRef.current
      let dx = 0
      let dy = 0
      let nextDirection = null
      const scaleX = village.transform.scaleX
      const scaleY = village.transform.scaleY
      const speed = SPEED * dt
      if (pressed.up) { dy -= speed * scaleY; nextDirection = 'up' }
      if (pressed.down) { dy += speed * scaleY; nextDirection = 'down' }
      if (pressed.left) { dx -= speed * scaleX; nextDirection = 'left' }
      if (pressed.right) { dx += speed * scaleX; nextDirection = 'right' }
      const hasMovementInput = dx !== 0 || dy !== 0
      let moved = false

      if (hasMovementInput) {
        const nextPosition = moveWithCollision(village, { x, y }, dx, dy)
        moved = Math.abs(nextPosition.x - x) > 0.01 || Math.abs(nextPosition.y - y) > 0.01
        posRef.current = nextPosition
        if (nextDirection && nextDirection !== dirRef.current) {
          dirRef.current = nextDirection
          setDir(nextDirection)
        }
      }
      if (moved !== movingRef.current) {
        movingRef.current = moved
        setMoving(moved)
      }

      const { x: playerX, y: playerY } = posRef.current
      if (playerWrapRef.current) {
        playerWrapRef.current.dataset.worldX = playerX.toFixed(2)
        playerWrapRef.current.dataset.worldY = playerY.toFixed(2)
        playerWrapRef.current.dataset.movementBlocked = hasMovementInput && !moved ? 'true' : 'false'
      }
      if (!collectingRef.current && !isAnnotatingRef.current) {
        for (const item of items) {
          if (collectedIdsRef.current.has(item.id) || item.block > blockNumRef.current) continue
          const itemX = (item.tx * T + 4) * scaleX
          const itemY = (item.ty * T + 4) * scaleY
          if (overlaps(playerX - PLAYER_BOX.w * scaleX / 2, playerY - PLAYER_BOX.h * scaleY,
            PLAYER_BOX.w * scaleX, PLAYER_BOX.h * scaleY, itemX, itemY, 24 * scaleX, 24 * scaleY)) {
            collectingRef.current = true
            collectingItemRef.current = item
            setCollecting(item)
            break
          }
        }
      } else if (collectingRef.current && collectingItemRef.current && !isAnnotatingRef.current) {
        const item = collectingItemRef.current
        const itemX = (item.tx * T + 4) * scaleX
        const itemY = (item.ty * T + 4) * scaleY
        if (!overlaps(playerX - PLAYER_BOX.w * scaleX / 2, playerY - PLAYER_BOX.h * scaleY,
          PLAYER_BOX.w * scaleX, PLAYER_BOX.h * scaleY, itemX, itemY, 24 * scaleX, 24 * scaleY)) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      if (!isAnnotatingRef.current) {
        const exitDx = playerX - village.exit.x
        const exitDy = playerY - village.exit.y
        const nearExit = exitDx * exitDx + exitDy * exitDy < village.exit.radius * village.exit.radius
        if (nearExit && !inExitZoneRef.current) {
          inExitZoneRef.current = true
          setExitConfirm(true)
        } else if (!nearExit) {
          inExitZoneRef.current = false
        }
      }

      const canvas = canvasRef.current
      const foregroundCanvas = foregroundCanvasRef.current
      let cameraX = 0
      let cameraY = 0
      let zoom = 1
      let offsetX = 0
      let offsetY = 0

      if (canvas && foregroundCanvas && canvas.width > 0 && canvas.height > 0) {
        const dpr = Number(canvas.dataset.dpr) || 1
        const viewWidth = canvas.width / dpr
        const viewHeight = canvas.height / dpr
        const fovWidth = FOV_W * scaleX
        const fovHeight = FOV_H * scaleY
        zoom = Math.min(viewWidth / fovWidth, viewHeight / fovHeight)
        const contentWidth = fovWidth * zoom
        const contentHeight = fovHeight * zoom
        offsetX = snapDevicePixel((viewWidth - contentWidth) / 2, dpr)
        offsetY = snapDevicePixel((viewHeight - contentHeight) / 2, dpr)
        cameraX = Math.max(0, Math.min(playerX - fovWidth / 2, village.currentWorldWidth - fovWidth))
        cameraY = Math.max(0, Math.min(playerY - fovHeight / 2, village.currentWorldHeight - fovHeight))
        cameraX = Math.round(cameraX * zoom * dpr) / (zoom * dpr)
        cameraY = Math.round(cameraY * zoom * dpr) / (zoom * dpr)

        const context = canvas.getContext('2d')
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.imageSmoothingEnabled = false
        context.clearRect(0, 0, viewWidth, viewHeight)
        context.save()
        context.translate(offsetX, offsetY)
        context.scale(zoom, zoom)
        context.translate(-cameraX, -cameraY)
        context.scale(scaleX, scaleY)
        drawAnimalVillageLayer(context, village, now, playerY / scaleY, 'back')
        for (const item of items) {
          if (item.block > blockNumRef.current) continue
          const collected = collectedIdsRef.current.has(item.id)
          if (collected) context.globalAlpha = 0.35
          drawItem(context, item, now)
          if (collected) context.globalAlpha = 1
        }
        drawLockFog(context, sounds, blockNumRef.current, now)
        context.restore()

        const foreground = foregroundCanvas.getContext('2d')
        foreground.setTransform(dpr, 0, 0, dpr, 0, 0)
        foreground.imageSmoothingEnabled = false
        foreground.clearRect(0, 0, viewWidth, viewHeight)
        foreground.save()
        foreground.translate(offsetX, offsetY)
        foreground.scale(zoom, zoom)
        foreground.translate(-cameraX, -cameraY)
        foreground.scale(scaleX, scaleY)
        drawAnimalVillageLayer(foreground, village, now, playerY / scaleY, 'front')
        if (debugOptions?.mask && village.walkableMask) {
          foreground.save()
          foreground.globalAlpha = 0.28
          foreground.drawImage(village.walkableMask, 0, 0, village.baseWorldWidth, village.baseWorldHeight)
          foreground.restore()
        }
        drawAnimalDebug(foreground, village, items,
          debugOptions ? { ...debugOptions, sounds } : null,
          { x: playerX / scaleX, y: playerY / scaleY })
        foreground.restore()
      }

      if (debugOptions?.coordinates && now - lastDebugUpdateRef.current > 120) {
        lastDebugUpdateRef.current = now
        setDebugInfo({
          x: Math.round(playerX),
          y: Math.round(playerY),
          collision: village.lastCollision?.tag || 'none',
        })
      }

      if (playerWrapRef.current) {
        const dpr = Math.max(1, window.devicePixelRatio || 1)
        const stageWidth = canvas?.width ? canvas.width / dpr : playerWrapRef.current.parentElement.clientWidth
        const stageHeight = canvas?.height ? canvas.height / dpr : playerWrapRef.current.parentElement.clientHeight
        const renderMetrics = getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale: zoom * scaleY })
        const footX = offsetX + (playerX - cameraX) * zoom
        const footY = offsetY + (playerY - cameraY) * zoom
        const placement = placeCharacterAtScreenFoot(footX, footY, renderMetrics)
        playerWrapRef.current.style.left = `${snapDevicePixel(placement.left, dpr)}px`
        playerWrapRef.current.style.top = `${snapDevicePixel(placement.top, dpr)}px`
        playerWrapRef.current.style.transform = `scale(${renderMetrics.screenScale})`
        playerWrapRef.current.dataset.footScreenX = placement.footX.toFixed(2)
        playerWrapRef.current.dataset.footScreenY = placement.footY.toFixed(2)
      }

      if (stageRef.current) {
        stageRef.current.dataset.worldWidth = String(village.currentWorldWidth)
        stageRef.current.dataset.worldHeight = String(village.currentWorldHeight)
        stageRef.current.dataset.worldScale = String(scaleX)
        stageRef.current.dataset.maskSource = village.manifest.mask.src
        stageRef.current.dataset.generatedMask = 'true'
      }

      animationFrame = requestAnimationFrame(loop)
    }
    animationFrame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationFrame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [village, baseOnly, debugOptions, sounds])

  const total = sounds.length
  const collected = sounds.filter((sound) => collectedIds.has(sound.sound_id)).length

  if (baseOnly) {
    return (
      <div data-testid="animal-base-only" style={{ width: currentWorldWidth, height: currentWorldHeight, overflow: 'hidden' }}>
        {/* Natural-size DOM image makes the base-only output byte-for-byte source-faithful. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-testid="animal-base-map"
          src={BASE_MAP_SRC}
          width={currentWorldWidth}
          height={currentWorldHeight}
          draggable={false}
          alt="Sunflower Commons Animal village base map"
          style={{ display: 'block', width: currentWorldWidth, height: currentWorldHeight, imageRendering: 'pixelated' }}
        />
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
      <ZoneHUD zone="Animal" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />

      <div ref={stageRef} data-testid="animal-stage" style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        background: '#152c24', overflow: 'hidden',
      }}>
        {!village ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, fontFamily: 'Nunito, sans-serif', color: '#fffaf0',
          }}>
            <div style={{ fontSize: 28 }}>🐮</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>동물 마을 불러오는 중...</div>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} data-testid="animal-world-canvas" data-smoothing="off" style={{
              position: 'absolute', inset: 0, zIndex: 1, display: 'block',
              width: '100%', height: '100%', imageRendering: 'pixelated',
            }} />

            <div ref={playerWrapRef} data-testid="animal-player" data-frame-index={frameIndex} style={{
              position: 'absolute', left: 0, top: 0, width: SPRITE_W, height: SPRITE_H,
              transformOrigin: '0 0', pointerEvents: 'none', zIndex: 2,
            }}>
              <PixelChar dir={dir} moving={moving} frameIndex={frameIndex} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout} />
            </div>

            <canvas ref={foregroundCanvasRef} data-testid="animal-foreground-canvas" data-smoothing="off" style={{
              position: 'absolute', inset: 0, zIndex: 3, display: 'block',
              width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none',
            }} />

            {debugInfo && debugOptions?.coordinates && (
              <div style={{
                position: 'absolute', left: 10, bottom: 10, zIndex: 8,
                background: '#102018dc', border: '1px solid #7dff9b', color: '#eaffef',
                padding: '6px 8px', borderRadius: 4, font: '11px monospace', pointerEvents: 'none',
              }}>
                x {debugInfo.x} · y {debugInfo.y} · collision {debugInfo.collision}
              </div>
            )}

            {collecting && !isAnnotating && (
              <div style={{
                position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
                zIndex: 6, background: '#3a2c12', border: '3px solid #8fbf5a', borderRadius: 4,
                boxShadow: '0 0 24px rgba(143,191,90,.45)', padding: '6px 16px',
                display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif',
                color: '#fffaf0', fontSize: 13, whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#ffd98a', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
                {collecting.cat ? `${collecting.cat} 소리 전사하기` : '동물의 소리 전사하기'}
              </div>
            )}
          </>
        )}
      </div>

      <DPad press={press} release={release} onExit={onExit} onConfirm={collecting ? confirmCollect : null} />
      {total > 0 && collected === total && <CompleteModal zone="Animal" onExit={onExit} />}
      {exitConfirm && (
        <ExitConfirmModal zone="Animal" onConfirm={onExit} onCancel={() => setExitConfirm(false)} />
      )}
    </div>
  )
}
