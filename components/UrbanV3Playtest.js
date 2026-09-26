'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DPad, PixelChar, SPRITE_H, SPRITE_W } from '@/components/ZoneMap'
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
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collidesPlayerAt,
  moveUrbanV3Player,
  overlapsExitTrigger,
  playerFootRectAt,
  surfaceAt,
} from '@/lib/urbanV3WorldConfig.mjs'

const SPEED = 3.25

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Unable to load ${src}`))
  image.src = src
})

function paintDebugOverlay(canvas, view, position) {
  const { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY } = view
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.save()
  context.translate(offsetX, offsetY)
  context.scale(zoom, zoom)
  context.translate(-camX, -camY)
  context.lineWidth = 1.5 / zoom

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

export default function UrbanV3Playtest() {
  const headerRef = useRef(null)
  const stageRef = useRef(null)
  const baseCanvasRef = useRef(null)
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
  const lastCollisionRef = useRef('none')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [moving, setMoving] = useState(false)
  const [dir, setDir] = useState('up')
  const [overview, setOverview] = useState(false)
  const [collision, setCollision] = useState(true)
  const [debug, setDebug] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(56)
  const [telemetry, setTelemetry] = useState({ position: '720, 958', surface: 'plaza', collider: 'none' })

  useEffect(() => { overviewRef.current = overview }, [overview])
  useEffect(() => { collisionRef.current = collision }, [collision])
  useEffect(() => { debugRef.current = debug }, [debug])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadImage('/assets/urban-city-v3/playtest/base-map.png'),
      loadImage('/assets/urban-city-v3/playtest/foreground-map.png'),
    ]).then(([base, foreground]) => {
      if (cancelled) return
      assetsRef.current = { base, foreground }
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
      for (const canvas of [baseCanvasRef.current, debugCanvasRef.current, foregroundCanvasRef.current]) {
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
    const collisionEnabled = collisionRef.current
    const next = moveUrbanV3Player(current, dx, dy, { collisionEnabled })
    let hit = null
    if (collisionEnabled && dx && next.x === current.x) hit = collidesPlayerAt(current.x + dx, current.y)
    if (collisionEnabled && dy && next.y === current.y) hit = collidesPlayerAt(next.x, current.y + dy) || hit
    lastCollisionRef.current = hit?.id || 'none'
    positionRef.current = next
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
  }, [move])

  useEffect(() => {
    let frame
    let previous = performance.now()
    let lastTelemetryUpdate = 0
    let wasMoving = false
    const loop = (now) => {
      const dt = Math.min(3, (now - previous) / 16.67)
      previous = now
      const pressed = keysRef.current
      let dx = 0
      let dy = 0
      let nextDirection = null
      if (pressed.up) { dy -= SPEED * dt; nextDirection = 'up' }
      if (pressed.down) { dy += SPEED * dt; nextDirection = 'down' }
      if (pressed.left) { dx -= SPEED * dt; nextDirection = 'left' }
      if (pressed.right) { dx += SPEED * dt; nextDirection = 'right' }
      const isMoving = dx !== 0 || dy !== 0
      if (isMoving) move(dx, dy)
      if (nextDirection) setDir((current) => current === nextDirection ? current : nextDirection)
      if (isMoving !== wasMoving) {
        wasMoving = isMoving
        setMoving(isMoving)
      }

      const assets = assetsRef.current
      const { width, height, dpr } = metricsRef.current
      const baseCanvas = baseCanvasRef.current
      const debugCanvas = debugCanvasRef.current
      const foregroundCanvas = foregroundCanvasRef.current
      if (assets && baseCanvas && debugCanvas && foregroundCanvas && width > 0 && height > 0) {
        const pixelWidth = width * dpr
        const pixelHeight = height * dpr
        const viewH = overviewRef.current ? WORLD_HEIGHT : Math.min(700, WORLD_HEIGHT)
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
          context.drawImage(image, camX, camY, viewW, viewH, offsetX, offsetY, renderedW, renderedH)
        }
        paint(baseCanvas, assets.base, '#050a19')
        if (debugRef.current) {
          paintDebugOverlay(debugCanvas, { pixelWidth, pixelHeight, zoom, offsetX, offsetY, camX, camY }, positionRef.current)
        } else {
          debugCanvas.getContext('2d').clearRect(0, 0, pixelWidth, pixelHeight)
        }
        paint(foregroundCanvas, assets.foreground)
        if (playerRef.current) {
          const cssZoom = zoom / dpr
          playerRef.current.style.left = `${offsetX / dpr + (x - camX - SPRITE_W / 2) * cssZoom}px`
          playerRef.current.style.top = `${offsetY / dpr + (y - camY - SPRITE_H) * cssZoom}px`
          playerRef.current.style.transform = `scale(${cssZoom})`
        }
        if (stageRef.current) {
          stageRef.current.dataset.urbanV3Ready = 'true'
          stageRef.current.dataset.playerPosition = `${x.toFixed(1)},${y.toFixed(1)}`
          stageRef.current.dataset.playerSurface = surfaceAt(x, y)
          stageRef.current.dataset.lastCollider = lastCollisionRef.current
          stageRef.current.dataset.colliderCount = String(OBJECT_COLLIDERS.length)
          stageRef.current.dataset.debugCollision = String(debugRef.current)
          stageRef.current.dataset.atExit = String(overlapsExitTrigger(positionRef.current))
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
  }, [move])

  const teleport = (name) => {
    positionRef.current = { ...SPAWN_POINTS[name] }
    lastCollisionRef.current = 'none'
    setOverview(false)
  }

  return (
    <main data-urban-v3-playtest style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#050a19', color: '#eafcff' }}>
      <header ref={headerRef} style={{
        minHeight: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', boxSizing: 'border-box',
        background: '#07112bf2', borderBottom: '1px solid #45d9ff', fontFamily: 'monospace', flexWrap: 'wrap',
      }}>
        <strong style={{ color: '#62e5ff' }}>Urban v3 Playtest</strong>
        <span style={{ color: '#ffca63', fontSize: 12 }}>precise collision</span>
        <span data-v3-telemetry style={{ fontSize: 11 }}>
          {telemetry.position} · {telemetry.surface} · hit {telemetry.collider}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {Object.keys(SPAWN_POINTS).map((name) => <button key={name} data-v3-teleport={name} onClick={() => teleport(name)}>{name}</button>)}
          <button data-v3-overview onClick={() => setOverview((value) => !value)}>{overview ? 'camera' : '전체맵'}</button>
          <button data-v3-collision onClick={() => setCollision((value) => !value)}>collision {collision ? 'ON' : 'OFF'}</button>
          <button data-v3-debug-collision aria-pressed={debug} onClick={() => setDebug((value) => !value)}>debug collision {debug ? 'ON' : 'OFF'}</button>
        </div>
      </header>
      <section ref={stageRef} style={{ position: 'absolute', inset: `${headerHeight}px 0 0`, overflow: 'hidden' }}>
        <canvas ref={baseCanvasRef} aria-label="Urban v3 playable map" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        <canvas ref={debugCanvasRef} aria-label="Urban v3 collision debug overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 1 }} />
        <div ref={playerRef} data-v3-player style={{
          position: 'absolute', width: SPRITE_W, height: SPRITE_H, transformOrigin: '0 0', pointerEvents: 'none', zIndex: 2,
        }}><PixelChar dir={dir} moving={moving} /></div>
        <canvas ref={foregroundCanvasRef} aria-label="Urban v3 foreground occlusion" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 3 }} />
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
      <DPad press={press} release={release} />
    </main>
  )
}
