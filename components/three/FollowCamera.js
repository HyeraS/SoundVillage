'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { CAMERA_CONFIG, dampingAlpha, getCameraHorizontalBasis, getResponsiveCameraSettings } from '@/lib/three/cameraConfig.mjs'

export default function FollowCamera({ playerRef, reducedMotion, paused, debugCamera }) {
  const { camera, size } = useThree()
  const cameraRef = useRef(camera)
  const initializedRef = useRef(false)
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  const lookAt = useMemo(() => new Vector3(), [])
  const { forward } = useMemo(() => getCameraHorizontalBasis(), [])

  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => () => {
    const root = document.querySelector('[data-testid="three-prototype"]')
    if (!root) return
    delete root.dataset.cameraPosition
    delete root.dataset.cameraTarget
    delete root.dataset.cameraLayout
    delete root.dataset.cameraPaused
  }, [])

  useFrame((_, delta) => {
    const player = playerRef.current
    if (!player) return
    const activeCamera = cameraRef.current
    const responsive = getResponsiveCameraSettings(size.width, size.height)
    target.set(
      player.position.x + forward.x * responsive.lookAhead,
      CAMERA_CONFIG.lookTargetHeight,
      player.position.z + forward.z * responsive.lookAhead,
    )
    desired.set(
      player.position.x + CAMERA_CONFIG.positionOffset[0],
      CAMERA_CONFIG.positionOffset[1],
      player.position.z + CAMERA_CONFIG.positionOffset[2],
    )

    if (activeCamera.isPerspectiveCamera && activeCamera.fov !== responsive.fov) {
      activeCamera.fov = responsive.fov
      activeCamera.updateProjectionMatrix()
    }

    if (!initializedRef.current) {
      activeCamera.position.copy(desired)
      lookAt.copy(target)
      initializedRef.current = true
    } else if (!paused) {
      const positionAmount = reducedMotion ? 1 : dampingAlpha(CAMERA_CONFIG.positionDamping, delta)
      const targetAmount = reducedMotion ? 1 : dampingAlpha(CAMERA_CONFIG.targetDamping, delta)
      activeCamera.position.lerp(desired, positionAmount)
      lookAt.lerp(target, targetAmount)
    }
    activeCamera.lookAt(lookAt)

    if (debugCamera) {
      const root = document.querySelector('[data-testid="three-prototype"]')
      if (root) {
        root.dataset.cameraPosition = `${activeCamera.position.x.toFixed(2)}, ${activeCamera.position.y.toFixed(2)}, ${activeCamera.position.z.toFixed(2)}`
        root.dataset.cameraTarget = `${lookAt.x.toFixed(2)}, ${lookAt.y.toFixed(2)}, ${lookAt.z.toFixed(2)}`
        root.dataset.cameraLayout = `${responsive.layout} · FOV ${responsive.fov}°`
        root.dataset.cameraPaused = String(paused)
      }
    }
  })

  return null
}
