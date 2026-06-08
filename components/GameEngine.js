'use client'
import { useEffect, useRef, useCallback } from 'react'

/* ─────────────────────────────────────────────
   상수
───────────────────────────────────────────── */
export const TILE  = 32   // 타일 1칸 px
export const SPEED = 3    // 픽셀/프레임

export const ZONE_META = {
  Animal: { label: '동물 마을',        color: '#5B9E3A', bg: '#1C3512', emoji: '🐾' },
  Human:  { label: '사람 마을',        color: '#E8A04A', bg: '#2A1A08', emoji: '👤' },
  Nature: { label: '자연 마을',        color: '#4A8FD4', bg: '#0E2040', emoji: '🌿' },
  Urban:  { label: '도시 마을',        color: '#C4B99A', bg: '#1C1B17', emoji: '🏙' },
  Music:  { label: '음악 마을',        color: '#9B6DD4', bg: '#18123A', emoji: '🎵' },
  Lab:    { label: '미지의 소리 마을', color: '#D4883A', bg: '#1A1420', emoji: '✨' },
}

/* ─────────────────────────────────────────────
   입력 훅 — 방향키 / WASD / 모바일 방향 버튼
───────────────────────────────────────────── */
export function useKeys() {
  const keys = useRef({ up: false, down: false, left: false, right: false })

  useEffect(() => {
    const MAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    }
    const down = e => { if (MAP[e.key]) { e.preventDefault(); keys.current[MAP[e.key]] = true } }
    const up   = e => { if (MAP[e.key]) keys.current[MAP[e.key]] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // 모바일 방향 버튼용 세터
  const press   = useCallback(dir => { keys.current[dir] = true  }, [])
  const release = useCallback(dir => { keys.current[dir] = false }, [])

  return { keys, press, release }
}

/* ─────────────────────────────────────────────
   충돌 감지 AABB
───────────────────────────────────────────── */
export function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}