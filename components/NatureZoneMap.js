'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H,
  loadNatureVillage, moveWithCollision, spawnNatureItems,
  drawOrb, drawLockFog, PLAYER_BOX,
} from '@/lib/natureVillage'

// 다른 Zone(ZoneMap.js/MusicZoneMap.js)과 동일한 FOV(24x18타일)를 써서 마을/캐릭터
// 화면 비율을 맞춘다 — 자세한 이유는 MusicZoneMap.js 상단 주석 참고.
const FOV_W = 24 * TILE
const FOV_H = 18 * TILE

// 월드맵으로 나가는 입구 — 맵 남쪽 벽 밖으로 이어지는 실제 걸을 수 있는 타일
// (collision 그리드 BFS로 스폰에서 도달 가능함을 미리 검증, 육안 어림짐작 아님).
// 스폰(17,33)과 8타일 이상 떨어뜨려서 입장 즉시 나가기 팝업이 뜨지 않게 한다.
const ENTRANCE = { x: 9 * T + 16, y: 34 * T + 20 }
const ENTRANCE_RADIUS = 26

export default function NatureZoneMap({ sounds, onCollectSound, onExit, collectedIds = new Set(), isAnnotating = false, blockNum = 1, blockTotal = 1 }) {
  const { keys, press, release } = useKeys()

  const [village, setVillage] = useState(null)
  const villageRef = useRef(null)
  const itemsRef   = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadNatureVillage().then(v => {
      if (cancelled) return
      villageRef.current = v
      itemsRef.current = spawnNatureItems(sounds, v)
      setVillage(v)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stageRef  = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const resize = () => {
      const w = Math.round(stage.clientWidth)
      const h = Math.round(stage.clientHeight)
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
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
  const collectingRef     = useRef(false)
  const collectingItemRef = useRef(null)
  const isAnnotatingRef   = useRef(isAnnotating)
  const blockNumRef       = useRef(blockNum)
  const collectedIdsRef   = useRef(collectedIds)
  const playerWrapRef     = useRef(null)

  const [exitConfirm, setExitConfirm] = useState(false)
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
      if (e.key === 'Escape') { if (!isAnnotatingRef.current) onExit(); return }
      if (e.key === 'Enter' && collectingItemRef.current && !isAnnotatingRef.current) {
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
        const edx = px - ENTRANCE.x, edy = py - ENTRANCE.y
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
        zoom = Math.min(canvas.width / FOV_W, canvas.height / FOV_H)
        const contentW = FOV_W * zoom, contentH = FOV_H * zoom
        offsetX = (canvas.width - contentW) / 2
        offsetY = (canvas.height - contentH) / 2

        camX = Math.max(0, Math.min(px - FOV_W / 2, MAP_W * T - FOV_W))
        camY = Math.max(0, Math.min(py - FOV_H / 2, MAP_H * T - FOV_H))

        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#7fa84a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(zoom, zoom)
        ctx.translate(-camX, -camY)
        ctx.drawImage(off, 0, 0)

        ctx.font = 'bold 11px "Courier New", monospace'
        const entLabel = '↓ 입구'
        const entW = ctx.measureText(entLabel).width + 20
        ctx.fillStyle = 'rgba(20,16,48,0.72)'
        ctx.fillRect(ENTRANCE.x - entW / 2, ENTRANCE.y - 10, entW, 20)
        ctx.strokeStyle = '#eafccb'
        ctx.lineWidth = 2
        ctx.strokeRect(ENTRANCE.x - entW / 2, ENTRANCE.y - 10, entW, 20)
        ctx.fillStyle = '#eafccb'
        ctx.textBaseline = 'middle'
        ctx.fillText(entLabel, ENTRANCE.x - entW / 2 + 10, ENTRANCE.y)

        for (const item of items) {
          if (item.block > blockNumRef.current) continue
          const done = collectedIdsRef.current.has(item.id)
          if (done) ctx.globalAlpha = 0.35
          drawOrb(ctx, item, now)
          if (done) ctx.globalAlpha = 1
        }
        drawLockFog(ctx, sounds, blockNumRef.current, now)
        ctx.restore()
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
  }, [village])

  const total     = sounds.length
  const collected = sounds.filter(s => collectedIds.has(s.sound_id)).length

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
      <ZoneHUD zone="Nature" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />

      <div ref={stageRef} style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        background: '#7fa84a', overflow: 'hidden',
      }}>
        {!village ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, fontFamily: 'Nunito, sans-serif',
          }}>
            <div style={{ fontSize: 28 }}>🌿</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#233a12' }}>자연 마을 불러오는 중...</div>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef}
              style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />

            <div ref={playerWrapRef} style={{
              position: 'absolute', left: 0, top: 0,
              width: SPRITE_W, height: SPRITE_H,
              transformOrigin: '0 0',
              pointerEvents: 'none',
            }}>
              <PixelChar dir={dir} moving={moving} />
            </div>

            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(20,40,10,.28) 100%)',
            }} />

            {collecting && !isAnnotating && (
              <div style={{
                position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
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

      <DPad press={press} release={release} onExit={onExit}
        onConfirm={collecting ? confirmCollect : null} />

      {total > 0 && collected === total && <CompleteModal zone="Nature" onExit={onExit} />}

      {exitConfirm && (
        <ExitConfirmModal
          zone="Nature"
          onConfirm={onExit}
          onCancel={() => setExitConfirm(false)}
        />
      )}
    </div>
  )
}
