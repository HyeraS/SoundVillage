export const CAMERA_CONFIG = Object.freeze({
  fov: 38,
  mobilePortraitFov: 42,
  mobileLandscapeFov: 40,
  near: 0.1,
  far: 80,
  positionOffset: Object.freeze([3.1, 5.2, 5.4]),
  lookTargetHeight: 0.95,
  lookAhead: 0.85,
  mobilePortraitLookAhead: 0.55,
  mobileLandscapeLookAhead: 0.7,
  positionDamping: 4.8,
  targetDamping: 6.5,
})

export const HUB_THIRD_PERSON_CAMERA_CONFIG = Object.freeze({
  fov: 48,
  mobilePortraitFov: 53,
  mobileLandscapeFov: 50,
  height: 3.35,
  distance: 5.2,
  lookHeight: 0.92,
  lookAhead: 1.65,
  positionDamping: 7.5,
  targetDamping: 9,
  autoFollowDelay: 0.35,
  autoFollowDeadZone: 22 * Math.PI / 180,
  autoFollowMaxYawSpeed: 75 * Math.PI / 180,
  autoFollowYawDamping: 2.4,
  autoFollowDirectionTolerance: 6 * Math.PI / 180,
  manualGraceSeconds: 1.1,
  near: 0.08,
  far: 80,
})

export function getCameraHorizontalBasis(positionOffset = CAMERA_CONFIG.positionOffset) {
  const horizontalLength = Math.hypot(positionOffset[0], positionOffset[2]) || 1
  return {
    forward: { x: -positionOffset[0] / horizontalLength, z: -positionOffset[2] / horizontalLength },
    right: { x: positionOffset[2] / horizontalLength, z: -positionOffset[0] / horizontalLength },
  }
}

export function screenInputToWorld(screenX, screenZ, positionOffset = CAMERA_CONFIG.positionOffset) {
  const length = Math.hypot(screenX, screenZ)
  if (!length) return { x: 0, z: 0 }
  const normalizedX = screenX / length
  const normalizedZ = screenZ / length
  const { forward, right } = getCameraHorizontalBasis(positionOffset)
  return {
    x: right.x * normalizedX - forward.x * normalizedZ,
    z: right.z * normalizedX - forward.z * normalizedZ,
  }
}

export function getResponsiveCameraSettings(width, height) {
  const portrait = width < 720 && height >= width
  const landscape = width < 900 && height < width
  if (portrait) return { fov: CAMERA_CONFIG.mobilePortraitFov, lookAhead: CAMERA_CONFIG.mobilePortraitLookAhead, layout: 'mobile-portrait' }
  if (landscape) return { fov: CAMERA_CONFIG.mobileLandscapeFov, lookAhead: CAMERA_CONFIG.mobileLandscapeLookAhead, layout: 'mobile-landscape' }
  return { fov: CAMERA_CONFIG.fov, lookAhead: CAMERA_CONFIG.lookAhead, layout: 'desktop' }
}

export function getResponsiveHubThirdPersonSettings(width, height) {
  const portrait = width < 720 && height >= width
  const landscape = width < 900 && height < width
  if (portrait) return { fov: HUB_THIRD_PERSON_CAMERA_CONFIG.mobilePortraitFov, layout: 'mobile-portrait' }
  if (landscape) return { fov: HUB_THIRD_PERSON_CAMERA_CONFIG.mobileLandscapeFov, layout: 'mobile-landscape' }
  return { fov: HUB_THIRD_PERSON_CAMERA_CONFIG.fov, layout: 'desktop' }
}

export function dampingAlpha(damping, delta) {
  return 1 - Math.exp(-damping * Math.max(0, delta))
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function shortestAngleDelta(from, to) {
  return normalizeAngle(to - from)
}

export function dampAngle(from, to, damping, delta) {
  return normalizeAngle(from + shortestAngleDelta(from, to) * dampingAlpha(damping, delta))
}

export function updateStableFacingCandidate(candidateYaw, stableSeconds, facingYaw, delta, tolerance) {
  const nextYaw = normalizeAngle(facingYaw)
  const directionChanged = !Number.isFinite(candidateYaw) || Math.abs(shortestAngleDelta(candidateYaw, nextYaw)) > tolerance
  if (directionChanged) return { candidateYaw: nextYaw, stableSeconds: 0 }
  return { candidateYaw, stableSeconds: stableSeconds + Math.max(0, delta) }
}

export function shouldRotateAutoFollow({ cameraYaw, targetYaw, stableSeconds, delay, deadZone }) {
  return stableSeconds >= delay && Math.abs(shortestAngleDelta(cameraYaw, targetYaw)) > deadZone
}

export function stepAutoFollowYaw(cameraYaw, targetYaw, damping, maxYawSpeed, deadZone, delta) {
  const difference = shortestAngleDelta(cameraYaw, targetYaw)
  if (Math.abs(difference) <= deadZone || delta <= 0) return normalizeAngle(cameraYaw)
  const dampedStep = difference * dampingAlpha(damping, delta)
  const maxStep = Math.max(0, maxYawSpeed) * delta
  const limitedStep = Math.max(-maxStep, Math.min(maxStep, dampedStep))
  return normalizeAngle(cameraYaw + limitedStep)
}

export function movementDirectionToFacingYaw(direction) {
  if (!direction || Math.hypot(direction.x, direction.z) === 0) return null
  return normalizeAngle(Math.atan2(direction.x, -direction.z))
}

export function getCameraOrbitTargetYaw(playerFacingYaw) {
  return normalizeAngle(playerFacingYaw)
}

export function getYawForward(yaw) {
  return { x: Math.sin(yaw), z: -Math.cos(yaw) }
}

export function shouldAutoFollowCamera({ dragging, moving, secondsSinceManualInput, graceSeconds }) {
  return !dragging && moving && secondsSinceManualInput >= graceSeconds
}

export function shouldRefreshMovementBasis(previousInput, nextInput, wasMoving) {
  return !wasMoving || !previousInput || previousInput.x !== nextInput.x || previousInput.z !== nextInput.z
}
