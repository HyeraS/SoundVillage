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

export function dampingAlpha(damping, delta) {
  return 1 - Math.exp(-damping * Math.max(0, delta))
}
