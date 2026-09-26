'use client'
import { useEffect, useRef, useCallback } from 'react'
import { trackEvent } from '@/lib/userEvents'

/* ─────────────────────────────────────────────
   상수
───────────────────────────────────────────── */
export const TILE  = 32   // 타일 1칸 px
export const SPEED = 5.85  // 픽셀/프레임 (기존 3 × 1.3 × 1.5)

export const ZONE_META = {
  Animal: { label: '동물 마을',        color: '#5B9E3A', bg: '#1C3512', emoji: '🐾' },
  Human:  { label: '사람 마을',        color: '#E8A04A', bg: '#2A1A08', emoji: '👤' },
  Nature: { label: '자연 마을',        color: '#4A8FD4', bg: '#0E2040', emoji: '🌿' },
  Urban:  { label: '도시 마을',        color: '#51D7F0', bg: '#08132E', emoji: '🏙' },
  Music:  { label: '음악 마을',        color: '#9B6DD4', bg: '#18123A', emoji: '🎵' },
  Lab:    { label: '미지의 소리 마을', color: '#D4883A', bg: '#1A1420', emoji: '✨' },
}

/* ─────────────────────────────────────────────
   입력 훅 — 방향키 / WASD / 모바일 방향 버튼
───────────────────────────────────────────── */
const KEY_TO_DIRECTION = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
}

export function clearMovementKeys(keys) {
  keys.up = false
  keys.down = false
  keys.left = false
  keys.right = false
}

export function useKeys({ disabled = false, screen = null, zone = null } = {}) {
  const keys = useRef({ up: false, down: false, left: false, right: false })
  const disabledRef = useRef(disabled)
  const contextRef = useRef({ screen, zone })

  useEffect(() => {
    disabledRef.current = disabled
    contextRef.current = { screen, zone }
    if (disabled) clearMovementKeys(keys.current)
  }, [disabled, screen, zone])

  useEffect(() => {
    const isTyping = () => {
      const t = document.activeElement?.tagName
      return t === 'INPUT' || t === 'TEXTAREA' || document.activeElement?.isContentEditable
    }
    const down = e => {
      const direction = KEY_TO_DIRECTION[e.key]
      if (!direction || isTyping() || disabledRef.current) return
      e.preventDefault()
      if (!e.repeat && !keys.current[direction] && contextRef.current.screen) {
        trackEvent('map_control_activated', {
          ...contextRef.current,
          target_type: 'map_control', target_id: `map-control-${direction}`,
          interaction_method: 'keyboard', metadata: { source: e.key.startsWith('Arrow') ? 'arrow_key' : 'wasd' },
        })
      }
      keys.current[direction] = true
    }
    const up = e => { if (KEY_TO_DIRECTION[e.key]) keys.current[KEY_TO_DIRECTION[e.key]] = false }
    const reset = () => clearMovementKeys(keys.current)
    const visibility = () => { if (document.visibilityState !== 'visible') reset() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      reset()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  // 모바일 방향 버튼용 세터
  const press = useCallback((dir, interactionMethod = 'touch') => {
    if (disabledRef.current || keys.current[dir]) return
    keys.current[dir] = true
    if (contextRef.current.screen) trackEvent('map_control_activated', {
      ...contextRef.current,
      target_type: 'map_control', target_id: `map-control-${dir}`,
      interaction_method: interactionMethod, metadata: { source: 'dpad' },
    })
  }, [])
  const release = useCallback(dir => { keys.current[dir] = false }, [])

  return { keys, press, release }
}

export function useCollectiblePromptLogging(collectible, zone) {
  const previousTargetRef = useRef(null)
  useEffect(() => {
    const targetId = collectible?.sound?.sound_id || collectible?.id || null
    if (targetId === previousTargetRef.current) return
    previousTargetRef.current = targetId
    if (!targetId) return
    const payload = {
      screen: 'zone', zone, sound_id: collectible?.sound?.sound_id,
      target_type: 'sound_collectible', target_id: targetId,
    }
    trackEvent('collectible_approached', payload)
    trackEvent('collectible_prompt_shown', payload)
  }, [collectible, zone])
}

/* ─────────────────────────────────────────────
   충돌 감지 AABB
───────────────────────────────────────────── */
export function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}
