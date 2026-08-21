'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { moveWithCollisions } from '@/lib/three/collision.mjs'
import { movementDirectionToFacingYaw, screenInputToWorld, shouldRefreshMovementBasis } from '@/lib/three/cameraConfig.mjs'
import { PLAYER_RADIUS, PLAYER_START, WORLD_BOUNDS, WORLD_COLLIDERS } from '@/lib/three/modelConfig.mjs'
import { findNearestInteractionTarget } from '@/lib/three/sceneFlow.mjs'
import ModelAsset from './ModelAsset'

const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
}

export default function Player3D({
  playerRef,
  inputRef,
  placements,
  completedIds,
  enabled,
  onNearbySoundChange,
  reducedMotion,
  loadModel,
  debug = false,
  startPosition = PLAYER_START,
  worldBounds = WORLD_BOUNDS,
  worldColliders = WORLD_COLLIDERS,
  interactionRadius = 1.62,
  movementPositionOffset,
  movementYawRef,
  facingYawRef,
  movingRef,
  showModel = true,
}) {
  const keyboardRef = useRef({ up: false, down: false, left: false, right: false })
  const positionRef = useRef({ x: startPosition[0], z: startPosition[2] })
  const nearbyIdRef = useRef(null)
  const walkingRef = useRef(false)
  const movementBasisYawRef = useRef(null)
  const previousInputRef = useRef(null)

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

  useEffect(() => {
    if (enabled) return
    keyboardRef.current = { up: false, down: false, left: false, right: false }
    inputRef.current = { up: false, down: false, left: false, right: false }
  }, [enabled, inputRef])

  useEffect(() => () => {
    const root = document.querySelector('[data-testid="three-prototype"]')
    if (root) {
      delete root.dataset.playerX
      delete root.dataset.playerZ
      delete root.dataset.nearbySound
      delete root.dataset.playerPaused
      delete root.dataset.playerFacingYaw
    }
  }, [debug])

  useFrame(({ clock }, delta) => {
    const group = playerRef.current
    if (!group) return
    const keyboard = keyboardRef.current
    const mobile = inputRef.current
    const screenX = Number(keyboard.right || mobile.right) - Number(keyboard.left || mobile.left)
    const screenZ = Number(keyboard.down || mobile.down) - Number(keyboard.up || mobile.up)
    const moving = enabled && (screenX !== 0 || screenZ !== 0)
    if (movingRef) movingRef.current = moving

    if (moving) {
      const yaw = movementYawRef?.current
      const screenInput = { x: screenX, z: screenZ }
      if (Number.isFinite(yaw) && shouldRefreshMovementBasis(previousInputRef.current, screenInput, walkingRef.current)) {
        movementBasisYawRef.current = yaw
      }
      previousInputRef.current = screenInput
      const basisYaw = Number.isFinite(movementBasisYawRef.current) ? movementBasisYawRef.current : yaw
      const activeMovementOffset = Number.isFinite(basisYaw) ? [-Math.sin(basisYaw), 0, Math.cos(basisYaw)] : movementPositionOffset
      const worldDirection = screenInputToWorld(screenX, screenZ, activeMovementOffset)
      const speed = 4.1 * Math.min(delta, 0.05)
      const next = moveWithCollisions(positionRef.current, { x: worldDirection.x * speed, z: worldDirection.z * speed }, PLAYER_RADIUS, worldBounds, worldColliders)
      positionRef.current = next
      group.position.x = next.x
      group.position.z = next.z
      group.rotation.y = Math.atan2(worldDirection.x, worldDirection.z)
      const facingYaw = movementDirectionToFacingYaw(worldDirection)
      if (facingYawRef && facingYaw !== null) facingYawRef.current = facingYaw
    } else {
      movementBasisYawRef.current = null
      previousInputRef.current = null
    }

    if (!reducedMotion) group.position.y = moving ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.06 : 0
    if (walkingRef.current !== moving) walkingRef.current = moving

    const nearest = findNearestInteractionTarget(placements, completedIds, positionRef.current, interactionRadius)
    const nextId = nearest?.id ?? null
    if (debug) {
      const root = document.querySelector('[data-testid="three-prototype"]')
      if (root) {
        root.dataset.playerX = positionRef.current.x.toFixed(3)
        root.dataset.playerZ = positionRef.current.z.toFixed(3)
        root.dataset.nearbySound = nextId || ''
        root.dataset.playerPaused = String(!enabled)
        if (facingYawRef && Number.isFinite(facingYawRef.current)) root.dataset.playerFacingYaw = facingYawRef.current.toFixed(4)
      }
    }
    if (nearbyIdRef.current !== nextId) {
      nearbyIdRef.current = nextId
      onNearbySoundChange(nearest)
    }
  })

  return (
    <group ref={playerRef} position={startPosition}>
      {showModel && <ModelAsset assetKey="player" loadModel={loadModel} />}
    </group>
  )
}
