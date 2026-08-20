'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { clamp } from '@/lib/three/collision.mjs'

export default function FollowCamera({ playerRef, reducedMotion }) {
  const { camera, size } = useThree()
  const cameraRef = useRef(camera)
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  const lookAt = useMemo(() => new Vector3(), [])

  useEffect(() => { cameraRef.current = camera }, [camera])

  useFrame((_, delta) => {
    const player = playerRef.current
    if (!player) return
    const activeCamera = cameraRef.current
    target.set(clamp(player.position.x, -6.8, 6.8), 0, clamp(player.position.z, -4.2, 4.2))
    desired.set(target.x + 8.8, 11.5, target.z + 9.6)
    const amount = reducedMotion ? 1 : 1 - Math.exp(-5 * delta)
    activeCamera.position.lerp(desired, amount)
    lookAt.lerp(target, amount)
    activeCamera.lookAt(lookAt)
    const nextZoom = size.width < 560 ? 37 : size.width < 900 ? 43 : 49
    if (activeCamera.zoom !== nextZoom) { activeCamera.zoom = nextZoom; activeCamera.updateProjectionMatrix() }
  })

  return null
}
