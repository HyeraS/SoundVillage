'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, SPEED, overlaps, TILE } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, CompleteModal, ExitConfirmModal, DPad, CHAR_W, CHAR_H, SPRITE_W, SPRITE_H } from '@/components/ZoneMap'
import {
  T, MAP_W, MAP_H, mulberry32,
  buildVillage, moveWithCollision, PLAYER_BOX,
  drawStatic, drawItem, drawLockFog,
} from '@/lib/musicVillage'

// 화면에서 마을/캐릭터가 차지하는 비율을 다른 Zone(ZoneMap.js)과 똑같이 맞춘다 —
// 그쪽은 항상 24x18타일(768x576 월드px)을 한 화면에 담고(SVG viewBox), 캐릭터
// 스프라이트는 그 월드 좌표계 기준 72x88px다. 고정 줌(×2) 대신 "이 FOV를 실제
// 캔버스 크기에 맞게 얼마나 확대해야 하는가"를 매 프레임 계산해서 쓰면, 화면
// 크기가 달라져도 마을/캐릭터 비율이 항상 다른 Zone과 동일해진다(비율 유지
// letterbox — 다른 Zone의 SVG preserveAspectRatio="xMidYMid meet"과 동일 동작).
const FOV_W = 24 * TILE
const FOV_H = 18 * TILE

// 월드맵으로 나가는 입구 — 버스킹 광장(스폰 지점) 남쪽, 맵 최남단 걸을 수 있는
// 줄(ty=34)에서 스폰과 가까운 걸을 수 있는 칸을 골랐다(alpha 대신 walkable()로
// 실측 확인). 스폰 지점과 거리를 둬서(9타일) 입장하자마자 바로 나가기 확인
// 팝업이 뜨지 않게 한다 — 다른 Zone도 스폰을 입구에서 몇 칸 띄워 두는 것과 동일.
const ENTRANCE = { x: 21 * T + 16, y: 34 * T + 20 }
const ENTRANCE_RADIUS = 26

function hashSeed(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

// district(구역) 영역 안의 걸을 수 있는 타일을 모두 모아 시드 고정 셔플 후,
// 서로 2칸 이상 떨어진 자리부터 채운다 — 자리가 모자라면(구역이 작아 간격을
// 다 못 지키면) 남은 아이템은 간격 제약 없이 채우되, walkable 타일 밖으로는
// 절대 나가지 않는다(빌딩/물 위에 아이템이 놓여 못 줍는 상황 방지).
function pickPositions(district, count, walkable, rnd) {
  const pool = []
  for (let ty = district.area.y; ty < district.area.y + district.area.h; ty++) {
    for (let tx = district.area.x; tx < district.area.x + district.area.w; tx++) {
      if (walkable(tx, ty)) pool.push({ tx, ty })
    }
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const chosen = []
  for (const p of pool) {
    if (chosen.length >= count) break
    if (chosen.every(c => Math.abs(c.tx - p.tx) >= 2 || Math.abs(c.ty - p.ty) >= 2)) chosen.push(p)
  }
  if (chosen.length < count) {
    for (const p of pool) {
      if (chosen.length >= count) break
      if (!chosen.some(c => c.tx === p.tx && c.ty === p.ty)) chosen.push(p)
    }
  }
  return chosen
}

// 실제 SOUND_ITEMS.Music(sounds prop)을 music-village.js가 만든 구역(district)
// 좌표계에 배치한다. buildVillage() 자체의 절차적 아이템 생성(village.items)은
// 쓰지 않고 무시 — 소리 데이터는 항상 이 함수가 만든 배열을 통해서만 온다.
// zone + 소리 id 목록으로 시드를 고정해 같은 참여자가 재입장해도 항상 같은
// 배치가 나온다(spawnSoundItems의 기존 관례와 동일).
function spawnMusicItems(sounds, village) {
  const seed = hashSeed('Music|' + sounds.map(s => s.sound_id).sort().join(','))
  const rnd  = mulberry32(seed)
  const byBlock = new Map()
  sounds.forEach(s => {
    const b = s.block || 1
    if (!byBlock.has(b)) byBlock.set(b, [])
    byBlock.get(b).push(s)
  })
  const items = []
  byBlock.forEach((list, block) => {
    const district = village.districts.find(d => d.block === block) || village.districts[0]
    const positions = pickPositions(district, list.length, village.walkable, rnd)
    list.forEach((s, i) => {
      const pos = positions[i] || positions[positions.length - 1] || { tx: district.area.x, ty: district.area.y }
      items.push({
        id:    s.sound_id,
        sound: s,
        tx:    pos.tx,
        ty:    pos.ty,
        neon:  district.neon,
        kind:  hashSeed(s.sound_id) % 2 === 0 ? 'note' : 'tape',
        phase: rnd() * Math.PI * 2,
      })
    })
  })
  return items
}

export default function MusicZoneMap({ sounds, onCollectSound, onExit, collectedIds = new Set(), isAnnotating = false, blockNum = 1, blockTotal = 1 }) {
  const { keys, press, release } = useKeys()

  const villageRef = useRef(null)
  if (villageRef.current === null) villageRef.current = buildVillage('B')
  const village = villageRef.current

  const itemsRef = useRef(null)
  if (itemsRef.current === null) itemsRef.current = spawnMusicItems(sounds, village)
  const items = itemsRef.current

  const stageRef         = useRef(null)
  const canvasRef        = useRef(null)
  const staticCanvasRef  = useRef(null)
  useEffect(() => {
    const off = document.createElement('canvas')
    off.width  = MAP_W * T
    off.height = MAP_H * T
    drawStatic(off.getContext('2d'), village, { neon: true })
    staticCanvasRef.current = off
  }, [village])

  // 캔버스를 다른 Zone과 동일하게 컨테이너 실측 크기로 꽉 채운다(고정 960x600
  // 프레임이 아님) — 리사이즈될 때마다 canvas의 실제 픽셀 크기를 갱신한다.
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
  }, [])

  const posRef        = useRef({ ...village.spawn })
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

  // 입구(월드맵으로 나가는 곳) — 캐릭터가 걸어서 들어서면 확인 팝업 표시.
  // ESC는 기존처럼 확인 없이 즉시 나가고, 이건 다른 Zone처럼 "걸어서 나가기"
  // 대안 경로다.
  const [exitConfirm, setExitConfirm] = useState(false)
  const inExitZoneRef = useRef(false)

  useEffect(() => { isAnnotatingRef.current = isAnnotating }, [isAnnotating])
  useEffect(() => { blockNumRef.current = blockNum }, [blockNum])
  useEffect(() => { collectedIdsRef.current = collectedIds }, [collectedIds])
  useEffect(() => {
    if (!isAnnotating) { collectingRef.current = false; collectingItemRef.current = null }
  }, [isAnnotating])

  // PixelChar의 걷기 프레임은 내부적으로 Date.now()를 읽어서 결정되는데(다른
  // Zone은 SVG 트리 전체가 매 프레임 다시 렌더링돼서 자연스럽게 갱신됨), 여기는
  // 캔버스를 ref로 직접 그리느라 dir/moving 값이 바뀔 때만 리렌더한다 — 그러면
  // 한 방향으로 계속 걷는 동안 PixelChar가 한 번도 다시 안 그려져서 다리가 멈춘
  // 채로 미끄러지는 것처럼 보인다. WORLD_CHARACTER 걷기 프레임 갱신 주기(100ms)에
  // 맞춰 리렌더만 강제로 트리거해서 다른 Zone과 같은 걷기 모션을 만든다.
  useEffect(() => {
    const id = setInterval(() => {
      if (movingRef.current) setAnimTick(t => t + 1)
    }, 100)
    return () => clearInterval(id)
  }, [])

  // ESC(나가기) + Enter(전사 패널 열기) — 다른 Zone과 동일한 키 규약
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

  // 게임 루프 — 캔버스는 매 프레임 직접 그리고(React 리렌더와 분리), 캐릭터
  // 스프라이트는 별도 DOM 오버레이의 style을 ref로 직접 갱신한다. 전부 ref만
  // 읽으므로 이펙트는 마운트 시 한 번만 걸면 된다.
  useEffect(() => {
    let raf
    let lastTime = performance.now()
    const loop = (now) => {
      // 다른 Zone(ZoneMap.js)과 동일하게 프레임 간 실제 경과 시간으로 속도를
      // 보정한다(60fps 기준 dt=1, 최대 3배 캡) — 이게 없으면 모니터 주사율에
      // 따라 이동 속도가 달라져서 다른 마을과 체감 속도가 어긋난다.
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

      // 근접 판정 — annotation 패널이 열려 있는 동안은 새 발견 차단
      if (!collectingRef.current && !isAnnotatingRef.current) {
        for (const item of items) {
          if (collectedIdsRef.current.has(item.id)) continue
          if ((item.sound.block || 1) > blockNumRef.current) continue
          const ix = item.tx * T + 16 - 12, iy = item.ty * T + 14 - 12
          if (overlaps(px - PLAYER_BOX.w / 2, py - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h, ix, iy, 24, 24)) {
            collectingRef.current = true
            collectingItemRef.current = item
            setCollecting(item)
            break
          }
        }
      } else if (collectingRef.current && collectingItemRef.current && !isAnnotatingRef.current) {
        const fi = collectingItemRef.current
        const ix = fi.tx * T + 16 - 12, iy = fi.ty * T + 14 - 12
        if (!overlaps(px - PLAYER_BOX.w / 2, py - PLAYER_BOX.h, PLAYER_BOX.w, PLAYER_BOX.h, ix, iy, 24, 24)) {
          collectingRef.current = false
          collectingItemRef.current = null
          setCollecting(null)
        }
      }

      // 입구 근접 판정 — annotation 패널이 열려 있는 동안은 확인 팝업을 새로
      // 띄우지 않는다(다른 Zone과 동일 규칙).
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
      const off    = staticCanvasRef.current
      let camX = 0, camY = 0, zoom = 1, offsetX = 0, offsetY = 0
      if (canvas && off && canvas.width > 0 && canvas.height > 0) {
        // 다른 Zone과 동일하게 항상 FOV_W x FOV_H(24x18타일) 월드 영역을 화면에
        // 담는다. 캔버스 실측 크기에 맞춰 얼마나 확대할지(zoom)를 계산하고,
        // 화면 비율이 FOV 비율(4:3)과 다르면 남는 쪽에 레터박스를 준다 — SVG의
        // preserveAspectRatio="xMidYMid meet"과 동일한 결과.
        zoom = Math.min(canvas.width / FOV_W, canvas.height / FOV_H)
        const contentW = FOV_W * zoom, contentH = FOV_H * zoom
        offsetX = (canvas.width - contentW) / 2
        offsetY = (canvas.height - contentH) / 2

        // 카메라 — 플레이어 중심, 맵 경계에서 클램프. 보이는 월드 영역은 항상
        // FOV_W x FOV_H로 고정(다른 Zone과 동일 — 화면 크기와 무관하게 town이
        // 차지하는 비율이 같아진다).
        camX = Math.max(0, Math.min(px - FOV_W / 2, MAP_W * T - FOV_W))
        camY = Math.max(0, Math.min(py - FOV_H / 2, MAP_H * T - FOV_H))

        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#0f0920'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(zoom, zoom)
        ctx.translate(-camX, -camY)
        ctx.drawImage(off, 0, 0)

        // 입구 표시 — 다른 Zone의 "↓ 입구" 표시와 같은 역할, 위치만 이 마을의
        // 실제 걸을 수 있는 남쪽 지점(ENTRANCE)에 맞춰 그린다.
        ctx.font = 'bold 11px "Courier New", monospace'
        const entLabel = '↓ 입구'
        const entW = ctx.measureText(entLabel).width + 20
        ctx.fillStyle = 'rgba(20,16,48,0.82)'
        ctx.fillRect(ENTRANCE.x - entW / 2, ENTRANCE.y - 10, entW, 20)
        ctx.strokeStyle = '#7cf2c4'
        ctx.lineWidth = 2
        ctx.strokeRect(ENTRANCE.x - entW / 2, ENTRANCE.y - 10, entW, 20)
        ctx.fillStyle = '#7cf2c4'
        ctx.textBaseline = 'middle'
        ctx.fillText(entLabel, ENTRANCE.x - entW / 2 + 10, ENTRANCE.y)

        for (const item of items) {
          if ((item.sound.block || 1) > blockNumRef.current) continue
          const done = collectedIdsRef.current.has(item.id)
          if (done) ctx.globalAlpha = 0.35
          drawItem(ctx, item, now)
          if (done) ctx.globalAlpha = 1
        }
        drawLockFog(ctx, village, blockNumRef.current, now)
        ctx.restore()
      }

      // 캐릭터 오버레이 — world → screen 좌표 변환(레터박스 오프셋 + 동적 줌).
      // 발치(px,py)를 스프라이트 하단 중앙에 맞춘다(음악 마을 엔진의 pos는
      // 발치 기준점). 스프라이트 크기(72x88)는 다른 Zone과 동일한 월드 단위라,
      // 같은 zoom을 곱하면 화면 상 캐릭터 비율도 다른 Zone과 항상 같아진다.
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
  }, [])

  const total     = items.length
  const collected = items.filter(it => collectedIds.has(it.id)).length
  const remaining = total - collected

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
      <ZoneHUD zone="Music" collected={collected} total={total} onExit={onExit} blockNum={blockNum} blockTotal={blockTotal} />

      {/* 다른 Zone(ZoneMap.js)과 동일하게 HUD 아래 전체 화면을 꽉 채운다 —
          960x600 고정 프레임을 중앙에 띄우지 않는다(화면 비율 불일치 수정). */}
      <div ref={stageRef} style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        background: '#0f0920', overflow: 'hidden',
      }}>
        <canvas ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />

        {/* 캐릭터 — 기존 Zone들과 동일한 PixelChar(현재 게임 캐릭터 에셋) 재사용 */}
        <div ref={playerWrapRef} style={{
          position: 'absolute', left: 0, top: 0,
          width: SPRITE_W, height: SPRITE_H,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}>
          <PixelChar dir={dir} moving={moving} />
        </div>

        {/* 비네트 */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(12,6,28,.62) 100%)',
        }} />

        {/* 근접 프롬프트 */}
        {collecting && !isAnnotating && (
          <div style={{
            position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
            background: '#1a1033', border: '3px solid #ff5fa2', borderRadius: 4,
            boxShadow: '0 0 24px rgba(255,95,162,.45)',
            padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'Nunito, sans-serif', color: '#f4ecff', fontSize: 13, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#ffd166', fontWeight: 800, fontSize: 11 }}>Enter ↵</span>
            {collecting.kind === 'note' ? '음표' : '카세트'} 소리 전사하기
          </div>
        )}
      </div>

      <DPad press={press} release={release} onExit={onExit}
        onConfirm={collecting ? confirmCollect : null} />

      {remaining === 0 && total > 0 && <CompleteModal zone="Music" onExit={onExit} />}

      {exitConfirm && (
        <ExitConfirmModal
          zone="Music"
          onConfirm={onExit}
          onCancel={() => setExitConfirm(false)}
        />
      )}
    </div>
  )
}
