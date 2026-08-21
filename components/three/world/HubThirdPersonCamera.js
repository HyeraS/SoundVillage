'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import {
  HUB_THIRD_PERSON_CAMERA_CONFIG,
  dampingAlpha,
  getCameraOrbitTargetYaw,
  getResponsiveHubThirdPersonSettings,
  getYawForward,
  normalizeAngle,
  shouldAutoFollowCamera,
  shouldRotateAutoFollow,
  stepAutoFollowYaw,
  updateStableFacingCandidate,
} from '@/lib/three/cameraConfig.mjs'

export default function HubThirdPersonCamera({ playerRef, yawRef, facingYawRef, movingRef, reducedMotion, paused, debugCamera, debugLabel = 'hub-third-person' }) {
  const { camera, gl, size } = useThree()
  const cameraRef = useRef(camera)
  const initializedRef = useRef(false)
  const desired = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(), [])
  const lookAt = useMemo(() => new Vector3(), [])
  const draggingRef = useRef(false)
  const pointerIdRef = useRef(null)
  const lastManualInputAtRef = useRef(Number.NEGATIVE_INFINITY)
  const candidateFacingYawRef = useRef(null)
  const stableFacingSecondsRef = useRef(0)

  useEffect(() => { cameraRef.current = camera }, [camera])

  useEffect(() => {
    const canvas = gl.domElement
    let previousX = 0
    const down = event => {
      if (paused || event.button > 0) return
      draggingRef.current = true
      pointerIdRef.current = event.pointerId
      previousX = event.clientX
      canvas.setPointerCapture?.(event.pointerId)
    }
    const move = event => {
      if (!draggingRef.current || paused) return
      const deltaX = event.clientX - previousX
      previousX = event.clientX
      yawRef.current = normalizeAngle(yawRef.current - deltaX * 0.0045)
      lastManualInputAtRef.current = performance.now() / 1000
    }
    const up = event => {
      if (draggingRef.current) lastManualInputAtRef.current = performance.now() / 1000
      draggingRef.current = false
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      pointerIdRef.current = null
    }
    const blur = () => {
      if (draggingRef.current) lastManualInputAtRef.current = performance.now() / 1000
      draggingRef.current = false
      if (pointerIdRef.current !== null && canvas.hasPointerCapture?.(pointerIdRef.current)) {
        canvas.releasePointerCapture(pointerIdRef.current)
      }
      pointerIdRef.current = null
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    window.addEventListener('blur', blur)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', blur)
      if (pointerIdRef.current !== null && canvas.hasPointerCapture?.(pointerIdRef.current)) {
        canvas.releasePointerCapture(pointerIdRef.current)
      }
      pointerIdRef.current = null
      draggingRef.current = false
    }
  }, [gl, paused, yawRef])

  useEffect(() => () => {
    const root = document.querySelector('[data-testid="three-prototype"]')
    if (!root) return
    delete root.dataset.cameraPosition
    delete root.dataset.cameraTarget
    delete root.dataset.cameraLayout
    delete root.dataset.cameraPaused
    delete root.dataset.cameraYaw
    delete root.dataset.cameraAutoFollow
    delete root.dataset.cameraStableFacingSeconds
    delete root.dataset.cameraAutoTargetYaw
  }, [])

  useFrame((_, delta) => {
    const player = playerRef.current
    if (!player) return
    const activeCamera = cameraRef.current
    const responsive = getResponsiveHubThirdPersonSettings(size.width, size.height)
    const moving = Boolean(movingRef?.current)
    if (moving && Number.isFinite(facingYawRef?.current)) {
      const stableFacing = updateStableFacingCandidate(
        candidateFacingYawRef.current,
        stableFacingSecondsRef.current,
        facingYawRef.current,
        delta,
        HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowDirectionTolerance,
      )
      candidateFacingYawRef.current = stableFacing.candidateYaw
      stableFacingSecondsRef.current = stableFacing.stableSeconds
    } else {
      candidateFacingYawRef.current = null
      stableFacingSecondsRef.current = 0
    }
    const manualFollowAllowed = !paused && shouldAutoFollowCamera({
      dragging: draggingRef.current,
      moving,
      secondsSinceManualInput: performance.now() / 1000 - lastManualInputAtRef.current,
      graceSeconds: HUB_THIRD_PERSON_CAMERA_CONFIG.manualGraceSeconds,
    })
    const autoTargetYaw = Number.isFinite(candidateFacingYawRef.current)
      ? getCameraOrbitTargetYaw(candidateFacingYawRef.current)
      : yawRef.current
    const autoFollowing = manualFollowAllowed && shouldRotateAutoFollow({
      cameraYaw: yawRef.current,
      targetYaw: autoTargetYaw,
      stableSeconds: stableFacingSecondsRef.current,
      delay: HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowDelay,
      deadZone: HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowDeadZone,
    })
    if (autoFollowing) {
      yawRef.current = stepAutoFollowYaw(
        yawRef.current,
        autoTargetYaw,
        HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowYawDamping,
        HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowMaxYawSpeed,
        HUB_THIRD_PERSON_CAMERA_CONFIG.autoFollowDeadZone,
        delta,
      )
    }
    const yaw = yawRef.current
    const forward = getYawForward(yaw)
    desired.set(
      player.position.x - forward.x * HUB_THIRD_PERSON_CAMERA_CONFIG.distance,
      HUB_THIRD_PERSON_CAMERA_CONFIG.height,
      player.position.z - forward.z * HUB_THIRD_PERSON_CAMERA_CONFIG.distance,
    )
    target.set(
      player.position.x + forward.x * HUB_THIRD_PERSON_CAMERA_CONFIG.lookAhead,
      HUB_THIRD_PERSON_CAMERA_CONFIG.lookHeight,
      player.position.z + forward.z * HUB_THIRD_PERSON_CAMERA_CONFIG.lookAhead,
    )

    if (activeCamera.isPerspectiveCamera && activeCamera.fov !== responsive.fov) {
      activeCamera.fov = responsive.fov
      activeCamera.near = HUB_THIRD_PERSON_CAMERA_CONFIG.near
      activeCamera.far = HUB_THIRD_PERSON_CAMERA_CONFIG.far
      activeCamera.updateProjectionMatrix()
    }

    if (!initializedRef.current) {
      activeCamera.position.copy(desired)
      lookAt.copy(target)
      initializedRef.current = true
    } else if (!paused) {
      const positionAmount = reducedMotion ? 1 : dampingAlpha(HUB_THIRD_PERSON_CAMERA_CONFIG.positionDamping, delta)
      const targetAmount = reducedMotion ? 1 : dampingAlpha(HUB_THIRD_PERSON_CAMERA_CONFIG.targetDamping, delta)
      activeCamera.position.lerp(desired, positionAmount)
      lookAt.lerp(target, targetAmount)
    }
    activeCamera.lookAt(lookAt)

    if (debugCamera) {
      const root = document.querySelector('[data-testid="three-prototype"]')
      if (root) {
        root.dataset.cameraPosition = `${activeCamera.position.x.toFixed(2)}, ${activeCamera.position.y.toFixed(2)}, ${activeCamera.position.z.toFixed(2)}`
        root.dataset.cameraTarget = `${lookAt.x.toFixed(2)}, ${lookAt.y.toFixed(2)}, ${lookAt.z.toFixed(2)}`
        root.dataset.cameraLayout = `${debugLabel} · ${responsive.layout} · FOV ${responsive.fov}°`
        root.dataset.cameraPaused = String(paused)
        root.dataset.cameraYaw = yaw.toFixed(4)
        root.dataset.cameraAutoFollow = String(autoFollowing)
        root.dataset.cameraStableFacingSeconds = stableFacingSecondsRef.current.toFixed(3)
        root.dataset.cameraAutoTargetYaw = autoTargetYaw.toFixed(4)
      }
    }
  })

  return null
}
