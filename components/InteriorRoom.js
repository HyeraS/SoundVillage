'use client'

import { useEffect, useRef, useState } from 'react'
import { useKeys, SPEED } from '@/components/GameEngine'
import { getInteriorItem } from '@/lib/interiorCatalog'

/* ─────────────────────────────────────────────
   집꾸미기 스테이지 — design_handoff_cozy_room/Cozy Room.dc.html의 그리드
   규격을 그대로 옮긴 순수 렌더 상수/함수. README "그리드 규격" 표와 1:1 대응하며,
   편집 모드의 격자 오버레이·고스트 프리뷰도 이 상수를 그대로 재사용한다.
───────────────────────────────────────────── */
export const COLS = 12, ROWS = 5, CELL = 64, ROWD = 48, WALL_ROWS = 2, WALL_ROWD = 112, WALL_H = 224
export const STAGE_W = COLS * CELL       // 768
export const STAGE_H = WALL_H + ROWS * ROWD // 464
const AVATAR_NATIVE = 32 // avatar.png 원본 픽셀 크기(32x32)

/* 바닥/벽 아이템 공통 배치 수식.
   - 가로 중앙: 칸 폭(fw*CELL) 안에서 스프라이트 실제 폭만큼 중앙 정렬
   - 벽: row*WALL_ROWD 기준 세로 중앙 + 8px 보정(액자·커튼이 살짝 아래로 걸리게)
   - 바닥: 칸 하단 기준 정렬(bottom), z-index = row*10+5로 앞줄이 뒷줄을 덮게 함 */
export function spriteStyle(it, placement, scale, { ghost = false } = {}) {
  const fw = it.fw || 1
  const w = (it.nw || 16) * scale
  const h = (it.nh || 16) * scale
  const left = placement.col * CELL + (fw * CELL - w) / 2
  const flip = placement.flip ? -1 : 1
  const base = {
    position: 'absolute',
    left,
    width: w,
    height: h,
    backgroundImage: `url(${it.src})`,
    backgroundSize: '100% 100%',
    imageRendering: 'pixelated',
    transform: `scaleX(${flip})`,
    ...(ghost ? { opacity: 0.55, pointerEvents: 'none' } : { cursor: 'pointer' }),
  }
  if (it.layer === 'wall') {
    return { ...base, top: placement.row * WALL_ROWD + (WALL_ROWD - h) / 2 + 8 }
  }
  return {
    ...base,
    bottom: (ROWS - 1 - placement.row) * ROWD,
    zIndex: placement.row * 10 + 5,
    filter: 'drop-shadow(0 2px 0 rgba(58,42,20,.22))',
  }
}

/* 러그는 2×2칸(기본) 영역에 32px 원본 타일을 pixelScale배로 늘려 채운다. */
export function rugStyle(it, placement, scale) {
  const fw = it.fw || 2, fh = it.fh || 2
  return {
    position: 'absolute',
    left: placement.col * CELL,
    bottom: (ROWS - 1 - placement.row) * ROWD,
    width: fw * CELL,
    height: fh * ROWD,
    backgroundImage: `url(${it.src})`,
    backgroundSize: `${32 * scale}px ${32 * scale}px`,
    imageRendering: 'pixelated',
    zIndex: 1,
    cursor: 'pointer',
  }
}

/* 고스트(놓기 전 미리보기) — 프로토타입의 ghostStyle 계산을 그대로 옮김.
   놓인 아이템과 달리 스테이지 루트(0,0) 기준 절대좌표로 그려진다(바닥 아이템처럼
   floor 하위 컨테이너의 top:WALL_H를 다시 더하지 않도록 주의 — 이미 WALL_H를
   식에 포함해서 계산함). col은 가로 넘침 방지로 COLS-fw까지 클램프한다. */
export function computeGhostStyle(tool, hoverCell, scale) {
  const layerOk = (tool.layer === 'wall') === (hoverCell.layer === 'wall')
  if (!layerOk) return null
  const p = { col: Math.min(hoverCell.col, COLS - (tool.fw || 1)), row: hoverCell.row, flip: false }

  if (tool.layer === 'rug') {
    const fw = tool.fw || 2, fh = tool.fh || 2
    return {
      position: 'absolute',
      left: p.col * CELL,
      top: WALL_H + (ROWS - 1 - p.row) * ROWD - (fh * ROWD - ROWD),
      width: fw * CELL,
      height: fh * ROWD,
      backgroundImage: `url(${tool.src})`,
      backgroundSize: `${32 * scale}px ${32 * scale}px`,
      imageRendering: 'pixelated',
      opacity: 0.55,
      pointerEvents: 'none',
    }
  }
  if (tool.layer === 'wall') {
    return spriteStyle(tool, p, scale, { ghost: true })
  }
  const w = (tool.nw || 16) * scale, h = (tool.nh || 16) * scale
  return {
    position: 'absolute',
    left: p.col * CELL + ((tool.fw || 1) * CELL - w) / 2,
    top: WALL_H + ROWS * ROWD - (ROWS - 1 - p.row) * ROWD - h,
    width: w,
    height: h,
    backgroundImage: `url(${tool.src})`,
    backgroundSize: '100% 100%',
    imageRendering: 'pixelated',
    opacity: 0.55,
    pointerEvents: 'none',
  }
}

/* 팝오버(뒤집기/옮기기/치우기) 위치 — 프로토타입의 popoverStyle 계산 그대로.
   x/y 모두 스테이지 루트 기준. 러그는 sel.layer가 'wall'이 아니므로 바닥 분기를
   그대로 타되 it.nh가 없어 기본값 16이 쓰인다(프로토타입과 동일한 동작). */
export function computePopoverAnchor(placedItem, catalogItem, scale) {
  const fw = catalogItem.fw || 1
  const x = placedItem.col * CELL + (fw * CELL) / 2
  const y = placedItem.layer === 'wall'
    ? placedItem.row * WALL_ROWD + 100
    : WALL_H + ROWS * ROWD - (ROWS - 1 - placedItem.row) * ROWD - (catalogItem.nh || 16) * scale - 14
  return {
    left: Math.max(8, Math.min(x - 100, STAGE_W - 210)),
    top: Math.max(6, y - 44),
  }
}

/* ─────────────────────────────────────────────
   스테이지(768×464) 자체만 그린다 — "방 패널" 카드(padding/border/그림자)와 그
   아래 힌트·버튼 줄은 같은 카드 안에 함께 있어야 해서(README 마크업 참고)
   호출부(InteriorDecorRoom)가 감싼다. isEdit일 때만 격자 오버레이·고스트·
   팝오버가 그려진다.
───────────────────────────────────────────── */
export default function InteriorRoom({
  room, pixelScale = 4,
  isEdit = false, tool = null, hoverCell = null,
  onHoverCell, onClickCell,
  selectedUid = null, onSelectItem,
  popover = null,
  inputBlocked = false,
  // 4단계(집 안 실시간 동기화) — WorldMap과 동일한 lib/duoSession.js를
  // 그대로 쓴다. 이 컴포넌트는 자신이 호스트 방인지 방문 중인지 모르고,
  // duoScreen 문자열과 sendPosition/partnerPos만 그대로 전달받아 쓴다.
  duoScreen = null, sendPosition = null, partnerPos = null, partnerLabel = '',
}) {
  const S = pixelScale
  const wallpaper = getInteriorItem(room.wallpaper)
  const floor = getInteriorItem(room.floor)
  const wallItems = room.items.filter(i => i.layer === 'wall')
  const floorItems = room.items.filter(i => i.layer === 'floor')
  const rugItems = room.items.filter(i => i.layer === 'rug')

  const applySelection = (style, uid) => {
    if (uid === selectedUid) { style.outline = '3px solid #E9B44C'; style.outlineOffset = '2px' }
    return style
  }

  const ghostStyle = isEdit && tool && hoverCell ? computeGhostStyle(tool, hoverCell, S) : null

  /* ─────────────────────────────────────────────
     아바타 이동 — 프로젝트의 WorldMap과 동일한 useKeys/SPEED를 재사용해
     방향키/WASD로 캐릭터를 움직인다. 좌표는 바닥 하위 컨테이너 기준
     (left, bottom) — 기존에 하드코딩돼 있던 초기 위치(2*CELL+8, 2)를 그대로
     시작점으로 쓴다. 걷기 애니메이션 프레임은 디자인에 없어(정지 프레임 1장뿐)
     좌우 이동 시 좌우 반전만 적용한다.
  ───────────────────────────────────────────── */
  const AVATAR_W = AVATAR_NATIVE * S, AVATAR_H = AVATAR_NATIVE * S
  const [avatarPos, setAvatarPos] = useState({ x: 2 * CELL + 8, y: 2 })
  const [facingLeft, setFacingLeft] = useState(false)
  const avatarPosRef = useRef(avatarPos)
  const { keys } = useKeys({ disabled: inputBlocked, screen: 'interior' })

  useEffect(() => {
    const maxX = STAGE_W - AVATAR_W
    const maxY = ROWS * ROWD - 24
    let rafId
    let last = performance.now()
    const loop = now => {
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      const k = keys.current
      let { x, y } = avatarPosRef.current
      let dx = 0, dy = 0
      if (k.up) dy += SPEED * dt
      if (k.down) dy -= SPEED * dt
      if (k.left) dx -= SPEED * dt
      if (k.right) dx += SPEED * dt
      let moved = false
      if (dx || dy) {
        x = Math.max(0, Math.min(maxX, x + dx))
        y = Math.max(0, Math.min(maxY, y + dy))
        if (dx < 0) setFacingLeft(true)
        else if (dx > 0) setFacingLeft(false)
        avatarPosRef.current = { x, y }
        setAvatarPos({ x, y })
        moved = true
      }
      if (duoScreen) sendPosition?.(x, y, dx < 0 ? 'left' : 'right', duoScreen, moved)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [keys, AVATAR_W, duoScreen, sendPosition])

  // 발밑(bottom) 위치로 어느 줄에 있는지 추정해, 그 줄 가구와 같은 규칙(row*10+5)
  // 으로 앞뒤 관계를 맞춘다 — +6이라 같은 줄 가구보다 살짝 앞에 그려진다.
  const avatarRow = Math.max(0, Math.min(ROWS - 1, Math.round(ROWS - 1 - avatarPos.y / ROWD)))
  const avatarZIndex = avatarRow * 10 + 6

  return (
      <div style={{
        position: 'relative', isolation: 'isolate', zIndex: 0,
        width: STAGE_W, height: STAGE_H, margin: '0 auto',
        overflow: 'hidden', border: '3px solid var(--text-dark)', background: '#CBB79B',
      }}>
        {/* 벽 영역 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: WALL_H, background: '#C8B49A' }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${wallpaper.src})`,
            backgroundSize: `${32 * S}px ${24 * S}px`,
            imageRendering: 'pixelated',
          }} />
          {/* 걸레받이 */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 10,
            background: 'var(--brown)', borderTop: '3px solid var(--brown-dark)',
          }} />
        </div>

        {/* 바닥 영역 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: WALL_H, bottom: 0,
          backgroundImage: `url(${floor.src})`,
          backgroundSize: `${32 * S}px ${32 * S}px`,
          imageRendering: 'pixelated',
        }} />

        {/* 벽 아이템 — 원본은 z-index를 안 줬지만, 그러면 z-index:auto 티어라 DOM상
            나중에 그려지는 편집 격자 오버레이가 클릭을 가로챌 수 있다. 격자 셀보다
            높은 값(20)을 명시로 줘서 "놓인 소품을 누르면 선택된다"가 항상 보장되게 함. */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: WALL_H }}>
          {wallItems.map(p => {
            const it = getInteriorItem(p.itemId)
            const style = applySelection(spriteStyle(it, p, S), p.uid)
            style.zIndex = 20
            return <div key={p.uid} style={style} onClick={onSelectItem ? () => onSelectItem(p.uid) : undefined} />
          })}
        </div>

        {/* 바닥/러그/아바타 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: WALL_H, bottom: 0 }}>
          {rugItems.map(p => {
            const it = getInteriorItem(p.itemId)
            const style = applySelection(rugStyle(it, p, S), p.uid)
            return <div key={p.uid} style={style} onClick={onSelectItem ? () => onSelectItem(p.uid) : undefined} />
          })}
          {floorItems.map(p => {
            const it = getInteriorItem(p.itemId)
            const style = applySelection(spriteStyle(it, p, S), p.uid)
            return <div key={p.uid} style={style} onClick={onSelectItem ? () => onSelectItem(p.uid) : undefined} />
          })}
          <div style={{
            position: 'absolute', left: avatarPos.x, bottom: avatarPos.y,
            width: AVATAR_W, height: AVATAR_H,
            backgroundImage: 'url(/assets/interior/avatar.png)', backgroundSize: '100% 100%',
            imageRendering: 'pixelated', zIndex: avatarZIndex,
            animation: 'bob 2.6s ease-in-out infinite',
            filter: 'drop-shadow(0 3px 0 rgba(58,42,20,.25))',
            transform: `scaleX(${facingLeft ? -1 : 1})`,
          }} />
          {partnerPos && partnerPos.screen === duoScreen && (() => {
            const partnerRow = Math.max(0, Math.min(ROWS - 1, Math.round(ROWS - 1 - partnerPos.y / ROWD)))
            return (
              <div style={{
                position: 'absolute', left: partnerPos.x, bottom: partnerPos.y,
                width: AVATAR_W, height: AVATAR_H, zIndex: partnerRow * 10 + 6,
              }}>
                <div style={{
                  position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Gothic A1', sans-serif",
                  textShadow: '0 0 3px #000, 0 0 3px #000, 0 1px 1px #000', whiteSpace: 'nowrap',
                }}>{partnerLabel}</div>
                <div style={{
                  width: '100%', height: '100%',
                  backgroundImage: 'url(/assets/interior/avatar.png)', backgroundSize: '100% 100%',
                  imageRendering: 'pixelated',
                  animation: 'bob 2.6s ease-in-out infinite',
                  filter: 'drop-shadow(0 3px 0 rgba(58,42,20,.25))',
                  transform: `scaleX(${partnerPos.facing === 'left' ? -1 : 1})`,
                }} />
              </div>
            )
          })()}
        </div>

        {/* 편집 격자 오버레이 + 고스트 */}
        {isEdit && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, width: STAGE_W, height: WALL_H,
              display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${WALL_ROWS}, ${WALL_ROWD}px)`,
            }}>
              {Array.from({ length: WALL_ROWS }).flatMap((_, r) =>
                Array.from({ length: COLS }).map((__, c) => (
                  <div
                    key={`w${r}${c}`}
                    className="interior-grid-cell"
                    style={{ zIndex: 2 }}
                    onClick={() => onClickCell?.('wall', c, r)}
                    onMouseEnter={() => onHoverCell?.('wall', c, r)}
                  />
                ))
              )}
            </div>
            <div style={{
              position: 'absolute', left: 0, top: WALL_H, width: STAGE_W, height: ROWS * ROWD,
              display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${ROWD}px)`,
            }}>
              {Array.from({ length: ROWS }).flatMap((_, r) =>
                Array.from({ length: COLS }).map((__, c) => (
                  <div
                    key={`f${r}${c}`}
                    className="interior-grid-cell"
                    style={{ zIndex: 2 }}
                    onClick={() => onClickCell?.('floor', c, r)}
                    onMouseEnter={() => onHoverCell?.('floor', c, r)}
                  />
                ))
              )}
            </div>
            {ghostStyle && <div style={ghostStyle} />}
          </div>
        )}

        {/* 팝오버(뒤집기/옮기기/치우기) — 내용은 호출부(InteriorDecorRoom)가 만든다 */}
        {popover}
      </div>
  )
}
