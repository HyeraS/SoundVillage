'use client'
import { useEffect, useRef, useState } from 'react'
import { useCollectiblePromptLogging, useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H,
  loadNatureVillage, moveWithCollision, spawnNatureItems,
  drawOrb, drawWaterShimmers, drawLockFog, PLAYER_BOX,
} from '@/lib/natureVillage'

// 다른 Zone(ZoneMap.js/MusicZoneMap.js)과 동일한 FOV(24x18타일)를 써서 마을/캐릭터
// 화면 비율을 맞춘다 — 자세한 이유는 MusicZoneMap.js 상단 주석 참고.
const FOV_W = 24 * TILE
const FOV_H = 18 * TILE

// 월드맵으로 나가는 입구는 village.exit 단일 소스를 쓴다. 해당 좌표는 스폰과
// 분리되어 있고 collision 그리드 BFS로 도달 가능함을 자동 검증한다.
const ENTRANCE_RADIUS = 26

export default function NatureZoneMap({ sounds, onCollectSound, onExit, collectedIds = new Set(), isAnnotating = false, blockNum = 1, blockTotal = 1, debugTarget = null, debugOverview = false, debugStaticArt = false, debugFirstItem = false, outfitSrc, accessorySrc, characterLoadout }) {
  const [village, setVillage] = useState(null)
  const [loadError, setLoadError] = useState('')
  const villageRef = useRef(null)
  const itemsRef   = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadNatureVillage()
      .then(v => {
        if (cancelled) return
        const items = spawnNatureItems(sounds, v)
        if (debugFirstItem && items[0]) {
          v.spawn = { x: items[0].tx * T + 16, y: items[0].ty * T + 16 }
        }
        villageRef.current = v
        itemsRef.current = items
        setVillage(v)
      })
      .catch(error => {
        if (cancelled) return
        console.error('[NatureZone] 맵 로드 실패:', error)
        setLoadError(error instanceof Error ? error.message : String(error))
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stageRef  = useRef(null)
  const canvasRef = useRef(null)
  const foregroundRef = useRef(null)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const foreground = foregroundRef.current
    if (!stage || !canvas || !foreground) return
    const resize = () => {
      const w = Math.round(stage.clientWidth)
      const h = Math.round(stage.clientHeight)
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      if (foreground.width !== w) foreground.width = w
      if (foreground.height !== h) foreground.height = h
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [village])

  const posRef        = useRef({ x: 0, y: 0 })
  const dirRef         = useRef('down')
  const movingRef      = useRef(false)
  const [dir, setDir]     = useState('down')
  const [moving, setMoving] = useState(false)
  const [, setAnimTick] = useState(0)
  const [collecting, setCollecting] = useState(null)
  useCollectiblePromptLogging(collecting, 'Nature')
  const collectingRef     = useRef(false)
  const collectingItemRef = useRef(null)
  const isAnnotatingRef   = useRef(isAnnotating)
  const blockNumRef       = useRef(blockNum)
  const collectedIdsRef   = useRef(collectedIds)
  const playerWrapRef     = useRef(null)

  const [exitConfirm, setExitConfirm] = useState(false)
  const { keys, press, release } = useKeys({ disabled: isAnnotating || exitConfirm, screen: 'zone', zone: 'Nature' })
  const inExitZoneRef = useRef(false)

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => {
    if (!isAnnotating) { collectingRef.current = false; collectingItemRef.current = null }
  }, [isAnnotating])

  useEffect(() => {
    if (!village) return
    posRef.current = { ...village.spawn }
  }, [village])

  useEffect(() => {
    if (!village || !debugTarget) return
    posRef.current = { x: debugTarget.x * T + 16, y: debugTarget.y * T + 16 }
  }, [village, debugTarget])

  // PixelChar 걷기 프레임 강제 리렌더 — MusicZoneMap.js와 동일한 이유(캔버스를
  // ref로 직접 그려서 dir/moving만으로는 계속 걷는 동안 다리가 멈춰 보임).
  useEffect(() => {
    const id = setInterval(() => {
      if (movingRef.current) setAnimTick(t => t + 1)
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape' && !e.repeat) { if (!isAnnotatingRef.current) onExit(); return }
      if (e.key === 'Enter' && !e.repeat && collectingItemRef.current && !isAnnotatingRef.current) {
        const item = collectingItemRef.current
        collectingItemRef.current = null
        setCollecting(null)
        onCollectSound(item.sound)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit, onCollectSound])

  const confirmCollect = () => {
    const item = collectingItemRef.current
    if (!item) return
    collectingItemRef.current = null
    setCollecting(null)
    onCollectSound(item.sound)
  }

  useEffect(() => {
    if (!village) return
    let raf
    let lastTime = performance.now()
    const items = itemsRef.current
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now

      const k = keys.current
      let { x, y } = posRef.current
      let dx = 0, dy = 0, newDir = null
      const spd = SPEED * dt
      if (k.up)    { dy -= spd; newDir = 'up' }
      if (k.down)  { dy += spd; newDir = 'down' }
      if (k.left)  { dx -= spd; newDir = 'left' }
      if (k.right) { dx += spd; newDir = 'right' }
      const moved = dx !== 0 || dy !== 0

      if (moved) {
        posRef.current = moveWithCollision(village, { x, y }, dx, dy)
        if (newDir && newDir !== dirRef.current) { dirRef.current = newDir; setDir(newDir) }
      }
      if (moved !== movingRef.current) { movingRef.current = moved; setMoving(moved) }

      const { x: px, y: py } = posRef.current

      if (!collectingRef.current && !isAnnotatingRef.current) {
        for (const item of items) {
          if (collectedIdsRef.current.has(item.id)) continue
          if (item.block > blockNumRef.current) continue
          const ix = item.tx * T + 16 - 12, iy = item.ty * T + 16 - 12
          if (overlaps(px - PLAYER_BOX.w / 2, py - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h, ix, iy, 24, 24)) {
            collectingRef.current = true
            collectingItemRef.current = item
            setCollecting(item)
            break
          }
        }
      } else if (collectingRef.current && collectingItemRef.current && !isAnnotatingRef.current) {
        const fi = collectingItemRef.current
        const ix = fi.tx * T + 16 - 12, iy = fi.ty * T + 16 - 12
        if (!overlaps(px - PLAYER_BOX.w / 2, py - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h, ix, iy, 24, 24)) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      if (!isAnnotatingRef.current) {
        const edx = px - village.exit.x, edy = py - village.exit.y
        const nearEntrance = edx * edx + edy * edy < ENTRANCE_RADIUS * ENTRANCE_RADIUS
        if (nearEntrance && !inExitZoneRef.current) {
          inExitZoneRef.current = true
          setExitConfirm(true)
        } else if (!nearEntrance) {
          inExitZoneRef.current = false
        }
      }

      const canvas = canvasRef.current
      const off    = village.staticCanvas
      let camX = 0, camY = 0, zoom = 1, offsetX = 0, offsetY = 0
      if (canvas && off && canvas.width > 0 && canvas.height > 0) {
        let viewW = debugOverview ? MAP_W * T : FOV_W
        let viewH = debugOverview ? MAP_H * T : FOV_H
        const portraitPlay = !debugOverview && canvas.width <= 600 && canvas.height > canvas.width
        const landscapePlay = !debugOverview && canvas.width <= 900 && canvas.height <= 600
        if (portraitPlay) {
          zoom = canvas.height / viewH
          viewW = canvas.width / zoom
        } else if (landscapePlay) {
          zoom = canvas.width / viewW
          viewH = canvas.height / zoom
        } else {
          zoom = Math.min(canvas.width / viewW, canvas.height / viewH)
        }
        const contentW = viewW * zoom, contentH = viewH * zoom
        offsetX = (canvas.width - contentW) / 2
        offsetY = (canvas.height - contentH) / 2

        camX = debugOverview ? 0 : Math.max(0, Math.min(px - viewW / 2, MAP_W * T - viewW))
        camY = debugOverview ? 0 : Math.max(0, Math.min(py - viewH / 2, MAP_H * T - viewH))

        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#7fa84a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(zoom, zoom)
        ctx.translate(-camX, -camY)
        ctx.drawImage(off, 0, 0)
        if (!debugStaticArt) drawWaterShimmers(ctx, now)

        if (!debugStaticArt) {
          ctx.font = 'bold 11px "Courier New", monospace'
          const entLabel = '↓ 입구'
          const entW = ctx.measureText(entLabel).width + 20
          ctx.fillStyle = 'rgba(20,16,48,0.72)'
          ctx.fillRect(village.exit.x - entW / 2, village.exit.y - 10, entW, 20)
          ctx.strokeStyle = '#eafccb'
          ctx.lineWidth = 2
          ctx.strokeRect(village.exit.x - entW / 2, village.exit.y - 10, entW, 20)
          ctx.fillStyle = '#eafccb'
          ctx.textBaseline = 'middle'
          ctx.fillText(entLabel, village.exit.x - entW / 2 + 10, village.exit.y)
        }

        if (!debugStaticArt) {
          for (const item of items) {
            if (item.block > blockNumRef.current) continue
            const done = collectedIdsRef.current.has(item.id)
            if (done) ctx.globalAlpha = 0.35
            drawOrb(ctx, item, now)
            if (done) ctx.globalAlpha = 1
          }
          drawLockFog(ctx, sounds, blockNumRef.current, now)
        }
        ctx.restore()

        const foreground = foregroundRef.current
        if (foreground && village.foregroundCanvas) {
          const fg = foreground.getContext('2d')
          fg.imageSmoothingEnabled = false
          fg.clearRect(0, 0, foreground.width, foreground.height)
          fg.save()
          fg.translate(offsetX, offsetY)
          fg.scale(zoom, zoom)
          fg.translate(-camX, -camY)
          fg.drawImage(village.foregroundCanvas, 0, 0)
          fg.restore()
        }
      }

      if (playerWrapRef.current) {
        const screenLeft = offsetX + (px - SPRITE_W / 2 - camX) * zoom
        const screenTop  = offsetY + (py - SPRITE_H - camY) * zoom
        playerWrapRef.current.style.left = `${screenLeft}px`
        playerWrapRef.current.style.top  = `${screenTop}px`
        playerWrapRef.current.style.transform = `scale(${zoom})`
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [village, debugOverview, debugStaticArt])

  const total     = sounds.length
  const collected = sounds.filter(s => collectedIds.has(s.sound_id)).length

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
      {!debugStaticArt && <ZoneHUD zone="Nature" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />}

      <div ref={stageRef} style={{
        position: 'absolute', top: debugStaticArt ? 0 : 56, left: 0, right: 0, bottom: 0,
        background: '#7fa84a', overflow: 'hidden',
      }}>
        {!village ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, fontFamily: 'Nunito, sans-serif',
          }}>
            <div style={{ fontSize: 28 }}>{loadError ? '⚠️' : '🌿'}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#233a12' }}>
              {loadError ? `자연 마을 로드 실패: ${loadError}` : '자연 마을 불러오는 중...'}
            </div>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} data-testid="nature-canvas"
              style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />

            {!debugStaticArt && (
              <div ref={playerWrapRef} data-testid="nature-player" style={{
                position: 'absolute', left: 0, top: 0,
                width: SPRITE_W, height: SPRITE_H,
                transformOrigin: '0 0',
                pointerEvents: 'none', zIndex: 2,
              }}>
                <PixelChar dir={dir} moving={moving} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout} />
              </div>
            )}

            <canvas ref={foregroundRef} aria-hidden="true"
              style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 3 }} />

            {collecting && !isAnnotating && !debugStaticArt && (
              <div style={{
                position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
                zIndex: 4,
                background: '#2c4a1a', border: '3px solid #a8d96a', borderRadius: 4,
                boxShadow: '0 0 24px rgba(168,217,106,.45)',
                padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'Nunito, sans-serif', color: '#f4ffe4', fontSize: 13, whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#ffe28a', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
                자연의 소리 전사하기
              </div>
            )}
          </>
        )}
      </div>

      {!debugStaticArt && (
        <DPad press={press} release={release} onExit={onExit}
          onConfirm={collecting ? confirmCollect : null} />
      )}

      {!debugStaticArt && total > 0 && collected === total && <CompleteModal zone="Nature" onExit={onExit} />}

      {!debugStaticArt && exitConfirm && (
        <ExitConfirmModal
          zone="Nature"
          onConfirm={onExit}
          onCancel={() => setExitConfirm(false)}
        />
      )}
    </div>
  )
}
