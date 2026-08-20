'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { moveWithCollisions } from '@/lib/three/collision.mjs'
import { PLAYER_RADIUS, PLAYER_START, WORLD_BOUNDS, WORLD_COLLIDERS } from '@/lib/three/modelConfig.mjs'
import ModelAsset from './ModelAsset'

const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
}

export default function Player3D({ playerRef, inputRef, placements, completedIds, enabled, onNearbySoundChange, reducedMotion, loadModel, debug = false }) {
  const keyboardRef = useRef({ up: false, down: false, left: false, right: false })
  const positionRef = useRef({ x: PLAYER_START[0], z: PLAYER_START[2] })
  const nearbyIdRef = useRef(null)
  const walkingRef = useRef(false)

  useEffect(() => {
    const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable
    const down = event => {
      const direction = KEY_MAP[event.key]
      if (!direction || isTyping()) return
      event.preventDefault()
      keyboardRef.current[direction] = true
    }
    const up = event => {
      const direction = KEY_MAP[event.key]
      if (direction) keyboardRef.current[direction] = false
    }
    const blur = () => { keyboardRef.current = { up: false, down: false, left: false, right: false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => () => {
    const root = document.querySelector('[data-testid="three-prototype"]')
    if (root) {
      delete root.dataset.playerX
      delete root.dataset.playerZ
      delete root.dataset.nearbySound
      delete root.dataset.playerPaused
    }
  }, [debug])

  useFrame(({ clock }, delta) => {
    const group = playerRef.current
    if (!group) return
    const keyboard = keyboardRef.current
    const mobile = inputRef.current
    let x = Number(keyboard.right || mobile.right) - Number(keyboard.left || mobile.left)
    let z = Number(keyboard.down || mobile.down) - Number(keyboard.up || mobile.up)
    const moving = enabled && (x !== 0 || z !== 0)

    if (moving) {
      const length = Math.hypot(x, z) || 1
      x /= length
      z /= length
      const speed = 4.1 * Math.min(delta, 0.05)
      const next = moveWithCollisions(positionRef.current, { x: x * speed, z: z * speed }, PLAYER_RADIUS, WORLD_BOUNDS, WORLD_COLLIDERS)
      positionRef.current = next
      group.position.x = next.x
      group.position.z = next.z
      group.rotation.y = Math.atan2(x, z)
    }

    if (!reducedMotion) group.position.y = moving ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.06 : 0
    if (walkingRef.current !== moving) walkingRef.current = moving

    let nearest = null
    let nearestDistance = 1.62
    for (const placement of placements) {
      if (completedIds.has(placement.id)) continue
      const distance = Math.hypot(positionRef.current.x - placement.position[0], positionRef.current.z - placement.position[2])
      if (distance < nearestDistance) { nearest = placement; nearestDistance = distance }
    }
    const nextId = nearest?.id ?? null
    if (debug) {
      const root = document.querySelector('[data-testid="three-prototype"]')
      if (root) {
        root.dataset.playerX = positionRef.current.x.toFixed(3)
        root.dataset.playerZ = positionRef.current.z.toFixed(3)
        root.dataset.nearbySound = nextId || ''
        root.dataset.playerPaused = String(!enabled)
      }
    }
    if (nearbyIdRef.current !== nextId) {
      nearbyIdRef.current = nextId
      onNearbySoundChange(nearest)
    }
  })

  return (
    <group ref={playerRef} position={PLAYER_START}>
      <ModelAsset assetKey="player" loadModel={loadModel} />
    </group>
  )
}
