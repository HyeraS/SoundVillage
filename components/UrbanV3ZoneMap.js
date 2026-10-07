'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SPEED, TILE, useCollectiblePromptLogging, useKeys } from '@/components/GameEngine'
import { CompleteModal, DPad, ExitConfirmModal, PixelChar, ZoneHUD } from '@/components/ZoneMap'
import { useWalkFrame } from '@/components/useWalkFrame'
import { getCharacterRenderMetrics, placeCharacterAtScreenFoot } from '@/lib/characterRenderMetrics.mjs'
import { spawnUrbanV3SoundItems, URBAN_V3_SOUND_INTERACTION_RADIUS } from '@/lib/urbanV3SoundItems.mjs'
import { drawVillageCurrencyIcon } from '@/lib/villageCurrencyIconCanvas.mjs'
import {
  OBJECT_COLLIDERS,
  PLAYER_FOOT_BOX,
  SPAWN_POINTS,
  VILLAGE_MANIFEST,
  collidesPlayerAt,
  moveUrbanV3Player,
  overlapsExitTrigger,
  playerFootRectAt,
} from '@/lib/urbanV3WorldConfig.mjs'
import { basePointToCurrent, baseRectToCurrent, createWorldTransform } from '@/lib/villageWorldTransform.mjs'

const BASE_FOV_HEIGHT = 700 / 1.3
const BASE_SPEED = SPEED * BASE_FOV_HEIGHT / (18 * TILE)

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Urban V3 asset failed to load: ${src}`))
  image.src = src
})

function drawMarkers(context, items, blockNum, collectedIds, nearbyId, now) {
  for (const item of items) {
    const unlocked = item.block <= blockNum
    const collected = collectedIds.has(item.id)
    const nearby = item.id === nearbyId
    const pulse = nearby ? 1.5 + Math.sin(now / 130 + item.phase) * 1.5 : 0
    const x = item.x
    const y = item.y - 9
    const iconSize = nearby ? 28 : 24
    context.save()
    context.globalAlpha = unlocked ? collected ? 0.38 : 1 : 0.28
    if (nearby) {
      context.fillStyle = '#50e6ff33'
      context.strokeStyle = '#fff19a'
      context.lineWidth = 2
      context.beginPath()
      context.arc(x, y, 16 + pulse, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
    if (!drawVillageCurrencyIcon(context, 'Urban', x, y, { size: iconSize })) {
      context.beginPath()
      context.fillStyle = collected ? '#66717a' : nearby ? '#fff19a' : '#50e6ff'
      context.strokeStyle = nearby ? '#fff' : '#102a52'
      context.arc(x, y, 8 + pulse, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.fillStyle = collected ? '#cbd0d4' : '#07112b'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.font = 'bold 12px sans-serif'
      context.fillText(collected ? '✓' : '♪', x, y)
    } else if (collected) {
      context.globalAlpha = unlocked ? 0.9 : 0.38
      context.strokeStyle = '#fff'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(x - 4, y)
      context.lineTo(x - 1, y + 3)
      context.lineTo(x + 5, y - 4)
      context.stroke()
    }
    context.restore()
  }
}

export default function UrbanV3ZoneMap({
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
  currentWorldWidth = VILLAGE_MANIFEST.baseWorldWidth,
  currentWorldHeight = VILLAGE_MANIFEST.baseWorldHeight,
  debugCollision = false,
  debugFirstItem = false,
  debugStart = null,
}) {
  const worldSize = useMemo(() => ({ currentWorldWidth, currentWorldHeight }), [currentWorldHeight, currentWorldWidth])
  const transform = useMemo(() => createWorldTransform({
    baseWorldWidth: VILLAGE_MANIFEST.baseWorldWidth,
    baseWorldHeight: VILLAGE_MANIFEST.baseWorldHeight,
    ...worldSize,
  }), [worldSize])
  const items = useMemo(() => spawnUrbanV3SoundItems(sounds).map((item) => Object.freeze({
    ...item, ...basePointToCurrent(item, transform),
  })), [sounds, transform])
  const spawn = useMemo(() => debugStart && Number.isFinite(debugStart.x) && Number.isFinite(debugStart.y)
    ? basePointToCurrent(debugStart, transform)
    : debugFirstItem && items[0]
      ? { x: items[0].x, y: items[0].y }
      : basePointToCurrent(SPAWN_POINTS.entrance, transform), [debugFirstItem, debugStart, items, transform])
  const stageRef = useRef(null)
  const baseCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const playerRef = useRef(null)
  const assetsRef = useRef(null)
  const metricsRef = useRef({ width: 1, height: 1, dpr: 1 })
  const positionRef = useRef(spawn)
  const itemsRef = useRef(items)
  const collectedRef = useRef(collectedIds)
  const blockRef = useRef(blockNum)
  const annotatingRef = useRef(isAnnotating)
  const nearbyRef = useRef(null)
  const exitRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [nearby, setNearby] = useState(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const [dir, setDir] = useState('up')
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)
  const frameIndex = useWalkFrame(moving)
  const { keys, press, release } = useKeys({ disabled: isAnnotating || exitConfirm, screen: 'zone', zone: 'Urban' })
  useCollectiblePromptLogging(nearby, 'Urban')

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { collectedRef.current = collectedIds }, [collectedIds])
  useEffect(() => { blockRef.current = blockNum }, [blockNum])
  useEffect(() => { annotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { positionRef.current = spawn }, [spawn])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadImage(VILLAGE_MANIFEST.background.src), loadImage(VILLAGE_MANIFEST.mask.src)])
      .then(([background, mask]) => {
        if (cancelled) return
        assetsRef.current = { background, mask }
        setReady(true)
      })
      .catch((assetError) => { if (!cancelled) setError(assetError.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const resize = () => {
      const width = Math.max(1, Math.round(stage.clientWidth))
      const height = Math.max(1, Math.round(stage.clientHeight))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      metricsRef.current = { width, height, dpr }
      for (const canvas of [baseCanvasRef.current, overlayCanvasRef.current]) {
        if (!canvas) continue
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const collectNearby = useCallback(() => {
    const item = nearbyRef.current
    if (!item || annotatingRef.current) return
    nearbyRef.current = null
    setNearby(null)
    onCollectSound(item.sound)
  }, [onCollectSound])

  useEffect(() => {
    const handle = (event) => {
      if (event.key === 'Escape' && !event.repeat && !annotatingRef.current) onExit()
      if (event.key === 'Enter' && !event.repeat) collectNearby()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [collectNearby, onExit])

  useEffect(() => {
    let frame
    let previous = performance.now()
    const loop = (now) => {
      const dt = Math.min(3, (now - previous) / 16.67)
      previous = now
      const pressed = keys.current
      let dx = 0
      let dy = 0
      let nextDir = null
      if (!annotatingRef.current && !exitRef.current) {
        if (pressed.up) { dy -= BASE_SPEED * dt * transform.scaleY; nextDir = 'up' }
        if (pressed.down) { dy += BASE_SPEED * dt * transform.scaleY; nextDir = 'down' }
        if (pressed.left) { dx -= BASE_SPEED * dt * transform.scaleX; nextDir = 'left' }
        if (pressed.right) { dx += BASE_SPEED * dt * transform.scaleX; nextDir = 'right' }
      }
      const before = positionRef.current
      const after = dx || dy ? moveUrbanV3Player(before, dx, dy, worldSize) : before
      positionRef.current = after
      const didMove = after.x !== before.x || after.y !== before.y
      if (nextDir) setDir((current) => current === nextDir ? current : nextDir)
      if (didMove !== movingRef.current) { movingRef.current = didMove; setMoving(didMove) }

      let nearest = null
      let nearestDistance = URBAN_V3_SOUND_INTERACTION_RADIUS * Math.max(transform.scaleX, transform.scaleY)
      for (const item of itemsRef.current) {
        if (item.block > blockRef.current || collectedRef.current.has(item.id)) continue
        const distance = Math.hypot(item.x - after.x, item.y - after.y)
        if (distance <= nearestDistance) { nearest = item; nearestDistance = distance }
      }
      if (nearbyRef.current?.id !== nearest?.id) { nearbyRef.current = nearest; setNearby(nearest) }

      const atExit = overlapsExitTrigger(after, worldSize)
      if (atExit && !exitRef.current && !annotatingRef.current) setExitConfirm(true)
      exitRef.current = atExit

      const assets = assetsRef.current
      const baseCanvas = baseCanvasRef.current
      const overlayCanvas = overlayCanvasRef.current
      const { width, height, dpr } = metricsRef.current
      if (assets && baseCanvas && overlayCanvas && width > 0 && height > 0) {
        const pixelWidth = width * dpr
        const pixelHeight = height * dpr
        const viewHeight = Math.min(currentWorldHeight, BASE_FOV_HEIGHT * transform.scaleY)
        const viewWidth = Math.min(currentWorldWidth, viewHeight * pixelWidth / pixelHeight)
        const zoom = Math.min(pixelWidth / viewWidth, pixelHeight / viewHeight)
        const renderedWidth = viewWidth * zoom
        const renderedHeight = viewHeight * zoom
        const offsetX = (pixelWidth - renderedWidth) / 2
        const offsetY = (pixelHeight - renderedHeight) / 2
        const cameraX = Math.max(0, Math.min(currentWorldWidth - viewWidth, after.x - viewWidth / 2))
        const cameraY = Math.max(0, Math.min(currentWorldHeight - viewHeight, after.y - viewHeight / 2))
        const setup = (context) => {
          context.save()
          context.translate(offsetX, offsetY)
          context.scale(zoom, zoom)
          context.translate(-cameraX, -cameraY)
        }
        const background = baseCanvas.getContext('2d')
        background.imageSmoothingEnabled = false
        background.fillStyle = '#050a19'
        background.fillRect(0, 0, pixelWidth, pixelHeight)
        setup(background)
        background.drawImage(assets.background, 0, 0, currentWorldWidth, currentWorldHeight)
        background.restore()

        const overlay = overlayCanvas.getContext('2d')
        overlay.imageSmoothingEnabled = false
        overlay.clearRect(0, 0, pixelWidth, pixelHeight)
        setup(overlay)
        drawMarkers(overlay, itemsRef.current, blockRef.current, collectedRef.current, nearest?.id, now)
        if (debugCollision) {
          overlay.save()
          overlay.globalAlpha = 0.28
          overlay.drawImage(assets.mask, 0, 0, currentWorldWidth, currentWorldHeight)
          overlay.restore()
          overlay.fillStyle = 'rgba(255,60,70,.32)'
          overlay.strokeStyle = '#ff7b85'
          for (const collider of OBJECT_COLLIDERS) {
            const current = baseRectToCurrent(collider, transform)
            overlay.fillRect(current.x, current.y, current.w, current.h)
            overlay.strokeRect(current.x, current.y, current.w, current.h)
          }
          const foot = playerFootRectAt(after.x, after.y, worldSize)
          overlay.fillStyle = 'rgba(255,235,55,.5)'
          overlay.fillRect(foot.x, foot.y, foot.w, foot.h)
        }
        overlay.restore()

        if (playerRef.current) {
          const cssZoom = zoom / dpr
          const metrics = getCharacterRenderMetrics({ stageWidth: width, stageHeight: height, sceneCameraScale: cssZoom * transform.scaleY })
          const footX = offsetX / dpr + (after.x - cameraX) * cssZoom
          const footY = offsetY / dpr + (after.y - cameraY) * cssZoom
          const placement = placeCharacterAtScreenFoot(footX, footY, metrics)
          playerRef.current.style.left = `${placement.left}px`
          playerRef.current.style.top = `${placement.top}px`
          playerRef.current.style.transform = `scale(${metrics.screenScale})`
          playerRef.current.dataset.worldX = after.x.toFixed(2)
          playerRef.current.dataset.worldY = after.y.toFixed(2)
          playerRef.current.dataset.movementBlocked = (dx || dy) && !didMove ? 'true' : 'false'
        }
        if (stageRef.current) {
          stageRef.current.dataset.urbanV3Ready = 'true'
          stageRef.current.dataset.worldWidth = String(currentWorldWidth)
          stageRef.current.dataset.worldHeight = String(currentWorldHeight)
          stageRef.current.dataset.worldScale = String(transform.scaleX)
          stageRef.current.dataset.maskSource = VILLAGE_MANIFEST.mask.src
          stageRef.current.dataset.generatedMask = 'true'
          stageRef.current.dataset.nearbySoundId = nearest?.id || ''
          stageRef.current.dataset.atExit = String(atExit)
          stageRef.current.dataset.lastCollider = (dx || dy) && !didMove
            ? collidesPlayerAt(after.x + dx, after.y + dy, worldSize)?.id || 'none'
            : 'none'
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [currentWorldHeight, currentWorldWidth, debugCollision, keys, transform, worldSize])

  const total = items.length
  const collected = items.filter((item) => collectedIds.has(item.id)).length
  return (
    <div data-urban-zone="urban-v3-production" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none', background: '#050a19' }}>
      <ZoneHUD zone="Urban" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />
      <div ref={stageRef} data-testid="urban-v3-stage" style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <canvas ref={baseCanvasRef} aria-label="Urban V3 production map" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        <div ref={playerRef} data-testid="urban-v3-player" data-frame-index={frameIndex} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', pointerEvents: 'none', zIndex: 2 }}>
          <PixelChar dir={dir} moving={moving} frameIndex={frameIndex} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout} />
        </div>
        <canvas ref={overlayCanvasRef} aria-label="Urban V3 sound markers and collision debug" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 3 }} />
        {!ready && !error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#eafcff', zIndex: 5 }}>도시 마을 불러오는 중…</div>}
        {error && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: '#260b16', zIndex: 5 }}>{error}</div>}
        {nearby && !isAnnotating && <div style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 5, background: '#07112bee', border: '2px solid #50e6ff', color: '#eafcff', padding: '7px 15px', borderRadius: 6 }}><b>Enter ↵</b> 이 소리 전사하기</div>}
      </div>
      <DPad press={press} release={release} onExit={onExit} onConfirm={nearby ? collectNearby : null} />
      {total > 0 && collected === total && <CompleteModal zone="Urban" onExit={onExit} />}
      {exitConfirm && <ExitConfirmModal zone="Urban" onConfirm={onExit} onCancel={() => { exitRef.current = false; setExitConfirm(false) }} />}
    </div>
  )
}
