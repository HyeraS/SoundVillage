'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AnnotationPanel from '@/components/AnnotationPanel'
import { SPEED as VILLAGE_SPEED, TILE } from '@/components/GameEngine'
import { DPad, PixelChar, SPRITE_H, SPRITE_W } from '@/components/ZoneMap'
import { useWalkFrame } from '@/components/useWalkFrame'
import soundMetadata from '@/data/sound_metadata.json'
import {
  URBAN_V3_SOUND_INTERACTION_RADIUS,
  spawnUrbanV3SoundItems,
} from '@/lib/urbanV3SoundItems.mjs'
import {
  ACCESSIBILITY_TARGETS,
  BLOCKED_ROAD_REGIONS,
  CROSSWALK_REGIONS,
  ENTRANCE_REGIONS,
  OBJECT_COLLIDERS,
  PLAYER_FOOT_BOX,
  PLAZA_REGIONS,
  SIDEWALK_REGIONS,
  SPAWN_POINTS,
  STAIR_REGIONS,
  VILLAGE_MANIFEST,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collidesPlayerAt,
  moveUrbanV3Player,
  overlapsExitTrigger,
  playerFootRectAt,
  surfaceAt,
} from '@/lib/urbanV3WorldConfig.mjs'
import { worldPointToScreen } from '@/lib/villageWorldTransform.mjs'

export const URBAN_V3_SCENE_SCALE = 1.3
export const URBAN_V3_CAMERA_HEIGHT = 700 / URBAN_V3_SCENE_SCALE
export const URBAN_V3_SPEED = VILLAGE_SPEED * URBAN_V3_CAMERA_HEIGHT / (18 * TILE)
const SPEED = URBAN_V3_SPEED
const ALL_URBAN_SOUNDS = (soundMetadata.sounds || []).filter((sound) => sound.game_zone === 'Urban')

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Unable to load ${src}`))
  image.src = src
})

function paintDebugOverlay(canvas, view, position, maskImage) {
  const { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY } = view
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.save()
  context.translate(offsetX, offsetY)
  context.scale(zoom, zoom)
  context.translate(-camX, -camY)
  context.lineWidth = 1.5 / zoom
  context.imageSmoothingEnabled = false
  if (maskImage) {
    context.save()
    context.globalAlpha = 0.28
    context.drawImage(maskImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    context.restore()
  }

  const paintRegions = (regions, fillStyle, strokeStyle) => {
    context.fillStyle = fillStyle
    context.strokeStyle = strokeStyle
    for (const region of regions) {
      if (!region.points) {
        context.fillRect(region.x, region.y, region.w, region.h)
        context.strokeRect(region.x, region.y, region.w, region.h)
        continue
      }
      context.beginPath()
      region.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.closePath()
      context.fill()
      context.stroke()
    }
  }

  paintRegions(BLOCKED_ROAD_REGIONS, 'rgba(255, 147, 45, 0.34)', 'rgba(255, 178, 82, 0.9)')
  paintRegions([...SIDEWALK_REGIONS, ...PLAZA_REGIONS], 'rgba(47, 224, 120, 0.25)', 'rgba(103, 255, 162, 0.8)')
  paintRegions([...CROSSWALK_REGIONS, ...STAIR_REGIONS, ...ENTRANCE_REGIONS], 'rgba(32, 224, 220, 0.35)', 'rgba(86, 255, 249, 0.95)')
  paintRegions(OBJECT_COLLIDERS, 'rgba(255, 61, 77, 0.38)', 'rgba(255, 112, 123, 0.95)')
  paintRegions([playerFootRectAt(position.x, position.y)], 'rgba(255, 225, 39, 0.55)', 'rgba(255, 247, 126, 1)')
  context.restore()
}

function paintSoundItems(canvas, view, items, activeBlock, collectedIds, nearbyId, now) {
  const { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY } = view
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.save()
  context.translate(offsetX, offsetY)
  context.scale(zoom, zoom)
  context.translate(-camX, -camY)
  context.lineWidth = 1.5 / zoom
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = 'bold 12px sans-serif'

  for (const item of items) {
    const unlocked = item.block <= activeBlock
    const collected = collectedIds.has(item.id)
    const nearby = item.id === nearbyId
    const pulse = nearby ? 1.5 + Math.sin(now / 130 + item.phase) * 1.5 : 0
    context.globalAlpha = unlocked ? 1 : 0.28
    context.beginPath()
    context.fillStyle = collected ? '#66717a' : nearby ? '#fff19a' : '#50e6ff'
    context.strokeStyle = nearby ? '#ffffff' : '#102a52'
    context.arc(item.x, item.y - 9, 8 + pulse, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = collected ? '#cbd0d4' : '#07112b'
    context.fillText(collected ? '✓' : '♪', item.x, item.y - 9)
  }
  context.restore()
  context.globalAlpha = 1
}

export default function UrbanV3Playtest() {
  const headerRef = useRef(null)
  const stageRef = useRef(null)
  const baseCanvasRef = useRef(null)
  const soundCanvasRef = useRef(null)
  const debugCanvasRef = useRef(null)
  const foregroundCanvasRef = useRef(null)
  const playerRef = useRef(null)
  const assetsRef = useRef(null)
  const positionRef = useRef({ ...SPAWN_POINTS.entrance })
  const keysRef = useRef({ up: false, down: false, left: false, right: false })
  const metricsRef = useRef({ width: 0, height: 0, dpr: 1 })
  const overviewRef = useRef(false)
  const collisionRef = useRef(true)
  const debugRef = useRef(false)
  const activeSoundRef = useRef(null)
  const itemsRef = useRef([])
  const activeBlockRef = useRef(1)
  const collectedIdsRef = useRef(new Set())
  const nearbyItemRef = useRef(null)
  const frameIndexRef = useRef(0)
  const lastCollisionRef = useRef('none')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [moving, setMoving] = useState(false)
  const [dir, setDir] = useState('up')
  const [overview, setOverview] = useState(false)
  const [collision, setCollision] = useState(true)
  const [debug, setDebug] = useState(false)
  const [group, setGroup] = useState('A')
  const urbanSounds = useMemo(() => ALL_URBAN_SOUNDS.filter((sound) => sound.group === group), [group])
  const soundItems = useMemo(() => spawnUrbanV3SoundItems(urbanSounds), [urbanSounds])
  const maxBlock = useMemo(() => urbanSounds.reduce((max, sound) => Math.max(max, Number(sound.block) || 1), 1), [urbanSounds])
  const [activeBlock, setActiveBlock] = useState(6)
  const [collectedIds, setCollectedIds] = useState(() => new Set())
  const [nearbyItem, setNearbyItem] = useState(null)
  const [activeSound, setActiveSound] = useState(null)
  const [headerHeight, setHeaderHeight] = useState(56)
  const [telemetry, setTelemetry] = useState({ position: '720, 958', surface: 'plaza', collider: 'none' })
  const frameIndex = useWalkFrame(moving)

  useEffect(() => { overviewRef.current = overview }, [overview])
  useEffect(() => { collisionRef.current = collision }, [collision])
  useEffect(() => { debugRef.current = debug }, [debug])
  useEffect(() => { activeSoundRef.current = activeSound }, [activeSound])
  useEffect(() => { itemsRef.current = soundItems }, [soundItems])
  useEffect(() => { activeBlockRef.current = activeBlock }, [activeBlock])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => { frameIndexRef.current = frameIndex }, [frameIndex])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadImage(VILLAGE_MANIFEST.background.src),
      loadImage(VILLAGE_MANIFEST.mask.src),
    ]).then(([base, mask]) => {
      if (cancelled) return
      assetsRef.current = { base, mask, foreground: null }
      setReady(true)
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return undefined
    const resize = () => setHeaderHeight(Math.max(56, Math.ceil(header.getBoundingClientRect().height)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const resize = () => {
      const width = Math.max(1, Math.round(stage.clientWidth))
      const height = Math.max(1, Math.round(stage.clientHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      metricsRef.current = { width, height, dpr }
      for (const canvas of [baseCanvasRef.current, soundCanvasRef.current, debugCanvasRef.current, foregroundCanvasRef.current]) {
        if (!canvas) continue
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [headerHeight])

  const move = useCallback((dx, dy) => {
    const current = positionRef.current
    if (activeSoundRef.current) return current
    const collisionEnabled = collisionRef.current
    const next = moveUrbanV3Player(current, dx, dy, { collisionEnabled })
    let hit = null
    if (collisionEnabled && dx && next.x === current.x) hit = collidesPlayerAt(current.x + dx, current.y)
    if (collisionEnabled && dy && next.y === current.y) hit = collidesPlayerAt(next.x, current.y + dy) || hit
    lastCollisionRef.current = hit?.id || 'none'
    positionRef.current = next
    return next
  }, [])

  const openNearbySound = useCallback(() => {
    const item = nearbyItemRef.current
    if (!item || activeSoundRef.current) return
    keysRef.current = { up: false, down: false, left: false, right: false }
    setMoving(false)
    activeSoundRef.current = item.sound
    setActiveSound(item.sound)
  }, [])

  const press = useCallback((direction) => {
    keysRef.current[direction] = true
    const delta = {
      up: [0, -SPEED * 2], down: [0, SPEED * 2], left: [-SPEED * 2, 0], right: [SPEED * 2, 0],
    }[direction]
    if (delta) move(delta[0], delta[1])
  }, [move])

  const release = useCallback((direction) => { keysRef.current[direction] = false }, [])

  useEffect(() => {
    const mapping = {
      ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    }
    const down = (event) => {
      if (event.key === 'Enter' && !event.repeat) {
        if (nearbyItemRef.current && !activeSoundRef.current) {
          event.preventDefault()
          openNearbySound()
        }
        return
      }
      if (activeSoundRef.current) return
      const direction = mapping[event.key]
      if (!direction) return
      event.preventDefault()
      if (!keysRef.current[direction]) {
        const [dx, dy] = {
          up: [0, -SPEED * 2], down: [0, SPEED * 2], left: [-SPEED * 2, 0], right: [SPEED * 2, 0],
        }[direction]
        move(dx, dy)
      }
      keysRef.current[direction] = true
    }
    const up = (event) => {
      const direction = mapping[event.key]
      if (!direction) return
      event.preventDefault()
      keysRef.current[direction] = false
    }
    const blur = () => { keysRef.current = { up: false, down: false, left: false, right: false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [move, openNearbySound])

  useEffect(() => {
    let frame
    let previous = performance.now()
    let lastTelemetryUpdate = 0
    let wasMoving = false
    const loop = (now) => {
      const dt = Math.min(3, (now - previous) / 16.67)
      previous = now
      const pressed = activeSoundRef.current ? {} : keysRef.current
      let dx = 0
      let dy = 0
      let nextDirection = null
      if (pressed.up) { dy -= SPEED * dt; nextDirection = 'up' }
      if (pressed.down) { dy += SPEED * dt; nextDirection = 'down' }
      if (pressed.left) { dx -= SPEED * dt; nextDirection = 'left' }
      if (pressed.right) { dx += SPEED * dt; nextDirection = 'right' }
      const beforeMove = positionRef.current
      const nextPosition = (dx !== 0 || dy !== 0) ? move(dx, dy) : beforeMove
      const isMoving = nextPosition.x !== beforeMove.x || nextPosition.y !== beforeMove.y
      if (nextDirection) setDir((current) => current === nextDirection ? current : nextDirection)
      if (isMoving !== wasMoving) {
        wasMoving = isMoving
        setMoving(isMoving)
      }

      const assets = assetsRef.current
      const { width, height, dpr } = metricsRef.current
      const baseCanvas = baseCanvasRef.current
      const soundCanvas = soundCanvasRef.current
      const debugCanvas = debugCanvasRef.current
      const foregroundCanvas = foregroundCanvasRef.current
      if (assets && baseCanvas && soundCanvas && debugCanvas && foregroundCanvas && width > 0 && height > 0) {
        const pixelWidth = width * dpr
        const pixelHeight = height * dpr
        const viewH = overviewRef.current ? WORLD_HEIGHT : Math.min(URBAN_V3_CAMERA_HEIGHT, WORLD_HEIGHT)
        const viewW = Math.min(WORLD_WIDTH, viewH * pixelWidth / pixelHeight)
        const zoom = Math.min(pixelWidth / viewW, pixelHeight / viewH)
        const renderedW = viewW * zoom
        const renderedH = viewH * zoom
        const offsetX = (pixelWidth - renderedW) / 2
        const offsetY = (pixelHeight - renderedH) / 2
        const { x, y } = positionRef.current
        const camX = overviewRef.current ? (WORLD_WIDTH - viewW) / 2 : Math.max(0, Math.min(WORLD_WIDTH - viewW, x - viewW / 2))
        const camY = overviewRef.current ? (WORLD_HEIGHT - viewH) / 2 : Math.max(0, Math.min(WORLD_HEIGHT - viewH, y - viewH / 2))
        const paint = (canvas, image, clearColor = null) => {
          const context = canvas.getContext('2d')
          context.imageSmoothingEnabled = false
          context.clearRect(0, 0, pixelWidth, pixelHeight)
          if (clearColor) {
            context.fillStyle = clearColor
            context.fillRect(0, 0, pixelWidth, pixelHeight)
          }
          if (image) context.drawImage(image, camX, camY, viewW, viewH, offsetX, offsetY, renderedW, renderedH)
        }
        paint(baseCanvas, assets.base, '#050a19')
        let nearestItem = null
        let nearestDistance = URBAN_V3_SOUND_INTERACTION_RADIUS
        for (const item of itemsRef.current) {
          if (item.block > activeBlockRef.current || collectedIdsRef.current.has(item.id)) continue
          const distance = Math.hypot(item.x - x, item.y - y)
          if (distance <= nearestDistance) {
            nearestDistance = distance
            nearestItem = item
          }
        }
        if (nearbyItemRef.current?.id !== nearestItem?.id) {
          nearbyItemRef.current = nearestItem
          setNearbyItem(nearestItem)
        }
        paintSoundItems(
          soundCanvas,
          { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY },
          itemsRef.current,
          activeBlockRef.current,
          collectedIdsRef.current,
          nearestItem?.id,
          now,
        )
        if (debugRef.current) {
          paintDebugOverlay(debugCanvas, { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY }, positionRef.current, assets.mask)
        } else {
          debugCanvas.getContext('2d').clearRect(0, 0, pixelWidth, pixelHeight)
        }
        paint(foregroundCanvas, assets.foreground)
        if (playerRef.current) {
          const mapCssZoom = zoom / dpr
          const characterCssZoom = mapCssZoom / URBAN_V3_SCENE_SCALE
          const screen = worldPointToScreen({ x, y }, {
            x: camX, y: camY, zoom: mapCssZoom, offsetX: offsetX / dpr, offsetY: offsetY / dpr,
          })
          playerRef.current.style.left = `${screen.x - (SPRITE_W / 2) * characterCssZoom}px`
          playerRef.current.style.top = `${screen.y - SPRITE_H * characterCssZoom}px`
          playerRef.current.style.transform = `scale(${characterCssZoom})`
        }
        if (stageRef.current) {
          stageRef.current.dataset.urbanV3Ready = 'true'
          stageRef.current.dataset.playerPosition = `${x.toFixed(1)},${y.toFixed(1)}`
          stageRef.current.dataset.playerSurface = surfaceAt(x, y)
          stageRef.current.dataset.lastCollider = lastCollisionRef.current
          stageRef.current.dataset.colliderCount = String(OBJECT_COLLIDERS.length)
          stageRef.current.dataset.debugCollision = String(debugRef.current)
          stageRef.current.dataset.atExit = String(overlapsExitTrigger(positionRef.current))
          stageRef.current.dataset.urbanSceneScale = String(URBAN_V3_SCENE_SCALE)
          stageRef.current.dataset.urbanMoveSpeed = String(URBAN_V3_SPEED)
          stageRef.current.dataset.urbanSoundGroup = group
          stageRef.current.dataset.urbanSoundItems = String(itemsRef.current.length)
          stageRef.current.dataset.nearbySoundId = nearestItem?.id || ''
          stageRef.current.dataset.walkFrame = String(frameIndexRef.current)
        }
        if (now - lastTelemetryUpdate > 120) {
          lastTelemetryUpdate = now
          setTelemetry({
            position: `${Math.round(x)}, ${Math.round(y)}`,
            surface: surfaceAt(x, y),
            collider: lastCollisionRef.current,
          })
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [group, move])

  const teleport = (name) => {
    positionRef.current = { ...SPAWN_POINTS[name] }
    lastCollisionRef.current = 'none'
    setOverview(false)
  }

  const teleportToSound = () => {
    const item = soundItems.find((candidate) => candidate.block <= activeBlock && !collectedIds.has(candidate.id))
    if (!item) return
    positionRef.current = { x: item.x, y: item.y }
    lastCollisionRef.current = 'none'
    setOverview(false)
  }

  const selectGroup = (nextGroup) => {
    const nextSounds = ALL_URBAN_SOUNDS.filter((sound) => sound.group === nextGroup)
    setGroup(nextGroup)
    setActiveBlock(nextSounds.reduce((max, sound) => Math.max(max, Number(sound.block) || 1), 1))
    setCollectedIds(new Set())
    collectedIdsRef.current = new Set()
    setNearbyItem(null)
    nearbyItemRef.current = null
    activeSoundRef.current = null
    setActiveSound(null)
  }

  const closeAnnotation = () => {
    activeSoundRef.current = null
    setActiveSound(null)
  }

  const finishAnnotation = () => {
    const completedSound = activeSoundRef.current
    if (completedSound) {
      setCollectedIds((current) => {
        const next = new Set(current)
        next.add(completedSound.sound_id)
        collectedIdsRef.current = next
        return next
      })
    }
    closeAnnotation()
  }

  return (
    <main data-urban-v3-playtest style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#050a19', color: '#eafcff' }}>
      <header ref={headerRef} style={{
        minHeight: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', boxSizing: 'border-box',
        background: '#07112bf2', borderBottom: '1px solid #45d9ff', fontFamily: 'monospace', flexWrap: 'wrap',
      }}>
        <strong style={{ color: '#62e5ff' }}>Urban v3 Playtest</strong>
        <span style={{ color: '#ffca63', fontSize: 12 }}>city scale {URBAN_V3_SCENE_SCALE}× · precise collision</span>
        <span data-v3-telemetry style={{ fontSize: 11 }}>
          {telemetry.position} · {telemetry.surface} · hit {telemetry.collider}
        </span>
        <span data-v3-audio-telemetry style={{ color: '#7ff4ff', fontSize: 11 }}>
          audio {group} · {collectedIds.size}/{soundItems.length} · block {activeBlock}/{maxBlock}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button data-v3-audio-group="A" aria-pressed={group === 'A'} onClick={() => selectGroup('A')}>audio A</button>
          <button data-v3-audio-group="B" aria-pressed={group === 'B'} onClick={() => selectGroup('B')}>audio B</button>
          <button data-v3-block-down onClick={() => setActiveBlock((value) => Math.max(1, value - 1))}>block -</button>
          <button data-v3-block-up onClick={() => setActiveBlock((value) => Math.min(maxBlock, value + 1))}>block +</button>
          <button data-v3-teleport="audio" onClick={teleportToSound}>audio spot</button>
          {Object.keys(SPAWN_POINTS).map((name) => <button key={name} data-v3-teleport={name} onClick={() => teleport(name)}>{name}</button>)}
          <button data-v3-overview onClick={() => setOverview((value) => !value)}>{overview ? 'camera' : '전체맵'}</button>
          <button data-v3-collision onClick={() => setCollision((value) => !value)}>collision {collision ? 'ON' : 'OFF'}</button>
          <button data-v3-debug-collision aria-pressed={debug} onClick={() => setDebug((value) => !value)}>debug collision {debug ? 'ON' : 'OFF'}</button>
        </div>
      </header>
      <section ref={stageRef} style={{ position: 'absolute', inset: `${headerHeight}px 0 0`, overflow: 'hidden' }}>
        <canvas ref={baseCanvasRef} aria-label="Urban v3 playable map" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        <canvas ref={soundCanvasRef} aria-label="Urban v3 sound locations" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 1 }} />
        <canvas ref={debugCanvasRef} aria-label="Urban v3 collision debug overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 2 }} />
        <div ref={playerRef} data-v3-player data-frame-index={frameIndex} style={{
          position: 'absolute', width: SPRITE_W, height: SPRITE_H, transformOrigin: '0 0', pointerEvents: 'none', zIndex: 3,
        }}><PixelChar dir={dir} moving={moving} frameIndex={frameIndex} /></div>
        <canvas ref={foregroundCanvasRef} aria-label="Urban v3 foreground occlusion" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 4 }} />
        {nearbyItem && !activeSound && <div data-v3-sound-prompt style={{
          position: 'absolute', left: '50%', bottom: 112, zIndex: 6, transform: 'translateX(-50%)',
          padding: '8px 12px', border: '1px solid #7ff4ff', borderRadius: 8, background: '#07112be8',
          color: '#f4fbff', font: '12px/1.35 monospace', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          ♪ {nearbyItem.sound.sub_category || nearbyItem.sound.audioset_class || nearbyItem.id} · Enter / ✓ 음원 듣기
        </div>}
        {debug && <aside data-v3-debug-panel style={{
          position: 'absolute', right: 10, bottom: 10, zIndex: 4, padding: '8px 10px', border: '1px solid #58fff6',
          background: '#061227e8', font: '11px/1.45 monospace', pointerEvents: 'none', maxWidth: 'min(310px, 70vw)',
        }}>
          <div>coord {telemetry.position}</div>
          <div>surface {telemetry.surface}</div>
          <div>collider {telemetry.collider}</div>
          <div>targets {Object.keys(ACCESSIBILITY_TARGETS).length} · foot {PLAYER_FOOT_BOX.w}×{PLAYER_FOOT_BOX.h}</div>
        </aside>}
        {!ready && !error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#050a19', zIndex: 9 }}>v3 assets loading…</div>}
        {error && <div data-v3-error style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#260b16', zIndex: 9 }}>{error}</div>}
      </section>
      <DPad press={press} release={release} onConfirm={nearbyItem && !activeSound ? openNearbySound : undefined} />
      {activeSound && <AnnotationPanel
        sound={activeSound}
        zone="Urban"
        participantId="URBAN_V3_QA_LOCAL"
        sessionId={`V3-${group}`}
        dryRun
        onClose={closeAnnotation}
        onComplete={finishAnnotation}
      />}
    </main>
  )
}
